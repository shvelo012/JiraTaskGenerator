import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { app } from 'electron';
import type { IncomingMessage } from 'http';
import type { JiraTask } from '../src/types';

// ── Constants ────────────────────────────────────────────────────────────────

const MODEL_FILENAME = 'Llama-3.2-3B-Instruct-Q4_K_M.gguf';
const MODEL_URL =
  'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf';

// ── ESM interop ───────────────────────────────────────────────────────────────
// node-llama-cpp is ESM-only. TypeScript (module:commonjs) compiles import()
// to require(), which breaks ESM packages. Using new Function bypasses that.
async function importLlamaCpp(): Promise<typeof import('node-llama-cpp')> {
  return new Function('return import("node-llama-cpp")')();
}

// ── Singletons ───────────────────────────────────────────────────────────────

let llamaInstance: import('node-llama-cpp').Llama | null = null;
let loadedModel: import('node-llama-cpp').LlamaModel | null = null;
let activeDownload: IncomingMessage | null = null;

// ── Paths ────────────────────────────────────────────────────────────────────

export function getModelsDir(): string {
  return path.join(app.getPath('userData'), 'models');
}

export function getModelPath(): string {
  return path.join(getModelsDir(), MODEL_FILENAME);
}

export function isModelDownloaded(): boolean {
  return fs.existsSync(getModelPath());
}

// ── Download ─────────────────────────────────────────────────────────────────

export function downloadModel(
  onProgress: (downloaded: number, total: number, percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const modelsDir = getModelsDir();
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }

    const finalPath = getModelPath();
    const partPath = `${finalPath}.part`;

    function doRequest(url: string): void {
      https.get(url, (res: IncomingMessage) => {
        // Follow redirects (HuggingFace uses 302)
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doRequest(res.headers.location);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }

        const total = parseInt(res.headers['content-length'] ?? '0', 10);
        let downloaded = 0;
        activeDownload = res;

        const fileStream = fs.createWriteStream(partPath);

        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0;
          onProgress(downloaded, total, percent);
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          activeDownload = null;
          fs.renameSync(partPath, finalPath);
          resolve();
        });

        fileStream.on('error', (err) => {
          activeDownload = null;
          fs.unlink(partPath, () => {});
          reject(err);
        });

        res.on('error', (err) => {
          activeDownload = null;
          fs.unlink(partPath, () => {});
          reject(err);
        });
      }).on('error', (err) => {
        activeDownload = null;
        reject(err);
      });
    }

    doRequest(MODEL_URL);
  });
}

export function cancelDownload(): void {
  if (activeDownload) {
    activeDownload.destroy();
    activeDownload = null;
    const partPath = `${getModelPath()}.part`;
    fs.unlink(partPath, () => {});
  }
}

// ── Load ─────────────────────────────────────────────────────────────────────

export async function loadModel(): Promise<void> {
  if (loadedModel) return;

  const { getLlama } = await importLlamaCpp();

  llamaInstance = await getLlama();
  loadedModel = await llamaInstance.loadModel({ modelPath: getModelPath() });
}

export function unloadModel(): void {
  loadedModel = null;
  llamaInstance = null;
}

// ── Inference ─────────────────────────────────────────────────────────────────

export async function generateTasks(text: string): Promise<JiraTask[]> {
  if (!isModelDownloaded()) {
    throw new Error('Model not downloaded. Please download it in Settings first.');
  }

  await loadModel();

  const { LlamaChatSession } = await importLlamaCpp();

  // Create a fresh context per generation and dispose after — avoids "no sequences left"
  const context = await loadedModel!.createContext({ contextSize: 4096 });

  let raw: string;
  try {
    const session = new LlamaChatSession({
      contextSequence: context.getSequence(),
      systemPrompt:
        'You are a project manager assistant. Extract actionable Jira tasks from documents. ' +
        'Respond with a valid JSON array only — no markdown, no code fences, no explanation.',
    });

    const userMessage =
      `Document:\n${text}\n\n` +
      'Return a JSON array where each element has:\n' +
      '- "summary": short task title (string)\n' +
      '- "description": detailed description (string)\n' +
      '- "issueType": "Story", "Task", or "Bug"\n' +
      '- "priority": "High", "Medium", or "Low"\n' +
      '- "storyPoints": Fibonacci number 1, 2, 3, 5, 8, or 13\n\n' +
      'Return ONLY the JSON array starting with [ and ending with ].';

    raw = await session.prompt(userMessage);
  } finally {
    await context.dispose();
  }

  let jsonText = raw.trim();
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonText = fenceMatch[1].trim();

  const startIdx = jsonText.indexOf('[');
  const endIdx = jsonText.lastIndexOf(']');
  if (startIdx !== -1 && endIdx !== -1) {
    jsonText = jsonText.slice(startIdx, endIdx + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Model returned invalid JSON. Raw: ${raw.slice(0, 300)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Model response is not a JSON array.');
  }

  return (parsed as Record<string, unknown>[]).map((t, i) => ({
    id: `task-${Date.now()}-${i}`,
    summary: String(t.summary ?? 'Untitled Task').trim(),
    description: String(t.description ?? '').trim(),
    issueType: (['Story', 'Task', 'Bug'] as const).includes(t.issueType as JiraTask['issueType'])
      ? (t.issueType as JiraTask['issueType'])
      : 'Task',
    priority: (['High', 'Medium', 'Low'] as const).includes(t.priority as JiraTask['priority'])
      ? (t.priority as JiraTask['priority'])
      : 'Medium',
    storyPoints: Number.isFinite(Number(t.storyPoints)) ? Number(t.storyPoints) : 3,
  }));
}
