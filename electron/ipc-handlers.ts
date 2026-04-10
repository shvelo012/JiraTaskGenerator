import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as mammoth from 'mammoth';
import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import Store from 'electron-store';
import { app } from 'electron';
import type { IpcMain, BrowserWindow } from 'electron';
import type { AppSettings, JiraTask, CurrentSession, HistoryEntry } from '../src/types';
import {
  MODELS,
  DEFAULT_MODEL_ID,
  isModelDownloaded,
  downloadModel,
  cancelDownload,
  loadModel,
  generateTasks as llamaGenerateTasks,
} from './llm-manager';

interface StoreSchema extends AppSettings {}
interface DataStoreSchema {
  currentSession: CurrentSession | null;
  sessionHistory: HistoryEntry[];
}

const isDev = !app.isPackaged;

const store = new Store<StoreSchema>({
  name: isDev ? 'jira-task-converter-settings-dev' : 'jira-task-converter-settings',
  defaults: {
    jiraBaseUrl: '',
    jiraEmail: '',
    jiraApiToken: '',
    jiraProjectKey: '',
    storyPointsField: 'story_points',
    selectedModelId: DEFAULT_MODEL_ID,
  },
});

const dataStore = new Store<DataStoreSchema>({
  name: isDev ? 'jira-task-converter-data-dev' : 'jira-task-converter-data',
  defaults: {
    currentSession: null,
    sessionHistory: [],
  },
});

function formatJiraError(err: AxiosError): string {
  const status = err.response?.status;
  const data = err.response?.data as
    | { errorMessages?: string[]; errors?: Record<string, string> }
    | undefined;

  const parts: string[] = [];

  if (status) parts.push(`HTTP ${status}`);

  if (data?.errorMessages?.length) {
    parts.push(...data.errorMessages);
  }

  if (data?.errors && Object.keys(data.errors).length > 0) {
    for (const [field, msg] of Object.entries(data.errors)) {
      parts.push(`${field}: ${msg}`);
    }
  }

  if (parts.length <= (status ? 1 : 0)) {
    parts.push(err.message || 'Unknown error');
  }

  return parts.join(' — ');
}

export function registerIpcHandlers(ipcMain: IpcMain, getWindow: () => BrowserWindow | null): void {
  // ── Parse DOCX ─────────────────────────────────────────────────────────────
  ipcMain.handle('parse-docx', async (_event, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const extractedImages: string[] = [];
      let imageIndex = 0;

      const imageHandler = mammoth.images.imgElement(async (image) => {
        const buffer = await image.read();
        const ext = image.contentType.split('/')[1]?.split('+')[0] ?? 'png';
        const tempPath = path.join(os.tmpdir(), `jira-img-${Date.now()}-${imageIndex}.${ext}`);
        imageIndex++;
        fs.writeFileSync(tempPath, buffer);
        extractedImages.push(tempPath);
        return { src: tempPath };
      });

      const [htmlResult, textResult] = await Promise.all([
        mammoth.convertToHtml({ path: filePath }, { convertImage: imageHandler }),
        mammoth.extractRawText({ path: filePath }),
      ]);

      if (!textResult.value || textResult.value.trim().length === 0) {
        throw new Error('The document appears to be empty or could not be parsed.');
      }

      return {
        success: true,
        text: textResult.value,
        images: extractedImages,
        warnings: [...htmlResult.messages, ...textResult.messages],
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Generate Tasks via local LLM ────────────────────────────────────────────
  ipcMain.handle('generate-tasks', async (_event, text: string) => {
    try {
      const modelId = store.get('selectedModelId') || DEFAULT_MODEL_ID;
      if (!isModelDownloaded(modelId)) {
        throw new Error('Selected model is not downloaded yet. Please download it in Settings first.');
      }
      const tasks = await llamaGenerateTasks(text, modelId);
      return { success: true, tasks };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Get All Models (with per-model download state) ──────────────────────────
  ipcMain.handle('get-models', async () => {
    return MODELS.map((m) => ({
      ...m,
      downloaded: isModelDownloaded(m.id),
    }));
  });

  // ── Model Status (for active/selected model) ────────────────────────────────
  ipcMain.handle('get-model-status', async () => {
    const modelId = store.get('selectedModelId') || DEFAULT_MODEL_ID;
    if (!isModelDownloaded(modelId)) return { state: 'not-downloaded' };
    return { state: 'downloaded' };
  });

  // ── Download Model ──────────────────────────────────────────────────────────
  ipcMain.handle('download-model', async (_event, modelId: string) => {
    try {
      const win = getWindow();
      await downloadModel(modelId, (downloaded, total, percent) => {
        win?.webContents.send('model-download-progress', { modelId, downloaded, total, percent });
      });
      getWindow()?.webContents.send('model-status-changed', { modelId, state: 'downloaded' });
      return { success: true };
    } catch (err) {
      const message = (err as Error).message;
      getWindow()?.webContents.send('model-status-changed', { modelId, state: 'error', message });
      return { success: false, error: message };
    }
  });

  // ── Cancel Download ─────────────────────────────────────────────────────────
  ipcMain.handle('cancel-download', async (_event, modelId: string) => {
    cancelDownload();
    getWindow()?.webContents.send('model-status-changed', { modelId, state: 'not-downloaded' });
    return { success: true };
  });

  // ── Load Model ──────────────────────────────────────────────────────────────
  ipcMain.handle('load-model', async (_event, modelId: string) => {
    try {
      getWindow()?.webContents.send('model-status-changed', { modelId, state: 'loading' });
      await loadModel(modelId);
      getWindow()?.webContents.send('model-status-changed', { modelId, state: 'ready' });
      return { success: true };
    } catch (err) {
      const message = (err as Error).message;
      getWindow()?.webContents.send('model-status-changed', { modelId, state: 'error', message });
      return { success: false, error: message };
    }
  });

  // ── Create Jira Tasks ───────────────────────────────────────────────────────
  ipcMain.handle('create-jira-tasks', async (_event, tasks: JiraTask[], jiraConfig: Partial<AppSettings>) => {
    try {
      const cfg = {
        baseUrl: jiraConfig?.jiraBaseUrl || store.get('jiraBaseUrl'),
        email: jiraConfig?.jiraEmail || store.get('jiraEmail'),
        token: jiraConfig?.jiraApiToken || store.get('jiraApiToken'),
        projectKey: jiraConfig?.jiraProjectKey || store.get('jiraProjectKey'),
        storyPointsField: jiraConfig?.storyPointsField || store.get('storyPointsField') || 'story_points',
      };

      if (!cfg.baseUrl || !cfg.email || !cfg.token || !cfg.projectKey) {
        throw new Error('Jira configuration is incomplete. Please check Settings.');
      }

      const auth = Buffer.from(`${cfg.email}:${cfg.token}`).toString('base64');
      const baseUrl = cfg.baseUrl.replace(/\/$/, '');
      const url = `${baseUrl}/rest/api/3/issue`;

      const results = [];

      for (const task of tasks) {
        try {
          const body: Record<string, unknown> = {
            fields: {
              project: { key: cfg.projectKey },
              summary: task.summary,
              description: {
                type: 'doc',
                version: 1,
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: task.description || task.summary }],
                  },
                ],
              },
              issuetype: { name: task.issueType || 'Task' },
              priority: { name: task.priority || 'Medium' },
            },
          };

          const postOptions = {
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          };

          if (cfg.storyPointsField && task.storyPoints) {
            (body.fields as Record<string, unknown>)[cfg.storyPointsField] = Number(task.storyPoints);
          }

          let response: { data: { key: string } };
          try {
            response = await axios.post<{ key: string }>(url, body, postOptions);
          } catch (firstErr) {
            const axiosErr = firstErr as AxiosError<{ errors?: Record<string, string> }>;
            const fieldErrors = axiosErr.response?.data?.errors ?? {};
            const isStoryPointsError = cfg.storyPointsField && cfg.storyPointsField in fieldErrors;

            if (!isStoryPointsError) throw firstErr;

            delete (body.fields as Record<string, unknown>)[cfg.storyPointsField];
            response = await axios.post<{ key: string }>(url, body, postOptions);
          }

          const jiraKey = response.data.key;

          // Upload per-task image attachments
          for (const imagePath of task.images ?? []) {
            if (!fs.existsSync(imagePath)) continue;
            try {
              const form = new FormData();
              form.append('file', fs.createReadStream(imagePath), path.basename(imagePath));
              await axios.post(
                `${baseUrl}/rest/api/3/issue/${jiraKey}/attachments`,
                form,
                {
                  headers: {
                    Authorization: `Basic ${auth}`,
                    'X-Atlassian-Token': 'no-check',
                    ...form.getHeaders(),
                  },
                },
              );
            } catch {
              // attachment failure doesn't fail the task
            }
          }

          results.push({
            taskId: task.id,
            summary: task.summary,
            success: true,
            jiraKey,
            jiraUrl: `${baseUrl}/browse/${jiraKey}`,
          });
        } catch (taskErr) {
          results.push({
            taskId: task.id,
            summary: task.summary,
            success: false,
            error: formatJiraError(taskErr as AxiosError),
          });
        }
      }

      const succeeded = results.filter((r) => r.success).length;
      return { success: true, results, succeeded, total: tasks.length };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Test Jira Connection ────────────────────────────────────────────────────
  ipcMain.handle('test-jira-connection', async (_event, jiraConfig: Partial<AppSettings>) => {
    try {
      const cfg = {
        baseUrl: jiraConfig?.jiraBaseUrl || store.get('jiraBaseUrl'),
        email: jiraConfig?.jiraEmail || store.get('jiraEmail'),
        token: jiraConfig?.jiraApiToken || store.get('jiraApiToken'),
        projectKey: jiraConfig?.jiraProjectKey || store.get('jiraProjectKey'),
      };

      if (!cfg.baseUrl || !cfg.email || !cfg.token) {
        throw new Error('Base URL, email, and API token are required.');
      }

      const auth = Buffer.from(`${cfg.email}:${cfg.token}`).toString('base64');
      const baseUrl = cfg.baseUrl.replace(/\/$/, '');

      const myselfRes = await axios.get<{ displayName: string; emailAddress: string }>(
        `${baseUrl}/rest/api/3/myself`,
        { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } },
      );

      const user = myselfRes.data;
      const lines: string[] = [`Authenticated as: ${user.displayName} (${user.emailAddress})`];

      if (cfg.projectKey) {
        try {
          const projRes = await axios.get<{ name: string }>(
            `${baseUrl}/rest/api/3/project/${cfg.projectKey}`,
            { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } },
          );
          lines.push(`Project found: ${projRes.data.name} (${cfg.projectKey})`);
        } catch (projErr) {
          lines.push(`Project "${cfg.projectKey}": ${formatJiraError(projErr as AxiosError)}`);
        }
      }

      return { success: true, message: lines.join('\n') };
    } catch (err) {
      const axiosErr = err as AxiosError;
      const cfg = {
        baseUrl: (jiraConfig?.jiraBaseUrl || store.get('jiraBaseUrl') || '').replace(/\/$/, ''),
        email: jiraConfig?.jiraEmail || store.get('jiraEmail') || '',
        token: jiraConfig?.jiraApiToken || store.get('jiraApiToken') || '',
      };
      const message = axiosErr.response ? formatJiraError(axiosErr) : (err as Error).message;
      return {
        success: false,
        error: `${message}\n\nUsing URL: ${cfg.baseUrl}\nUsing email: ${cfg.email}\nToken length: ${cfg.token.length}`,
      };
    }
  });

  // ── Current Session ─────────────────────────────────────────────────────────
  ipcMain.handle('get-current-session', async () => {
    try {
      const session = dataStore.get('currentSession');
      return { success: true, session };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('save-current-session', async (_event, session: CurrentSession) => {
    try {
      dataStore.set('currentSession', session);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── History ──────────────────────────────────────────────────────────────────
  ipcMain.handle('get-history', async () => {
    try {
      const entries = dataStore.get('sessionHistory');
      return { success: true, entries };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('save-history-entry', async (_event, entry: HistoryEntry) => {
    try {
      const existing = dataStore.get('sessionHistory');
      const updated = [entry, ...existing].slice(0, 50);
      dataStore.set('sessionHistory', updated);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('delete-history-entry', async (_event, id: string) => {
    try {
      const existing = dataStore.get('sessionHistory');
      dataStore.set('sessionHistory', existing.filter((e) => e.id !== id));
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Settings ────────────────────────────────────────────────────────────────
  ipcMain.handle('get-settings', async (): Promise<AppSettings> => ({
    jiraBaseUrl: store.get('jiraBaseUrl'),
    jiraEmail: store.get('jiraEmail'),
    jiraApiToken: store.get('jiraApiToken'),
    jiraProjectKey: store.get('jiraProjectKey'),
    storyPointsField: store.get('storyPointsField'),
    selectedModelId: store.get('selectedModelId') || DEFAULT_MODEL_ID,
  }));

  ipcMain.handle('save-settings', async (_event, settings: Partial<AppSettings>) => {
    try {
      const keys: (keyof AppSettings)[] = [
        'jiraBaseUrl',
        'jiraEmail',
        'jiraApiToken',
        'jiraProjectKey',
        'storyPointsField',
        'selectedModelId',
      ];
      for (const key of keys) {
        if (settings[key] !== undefined) {
          store.set(key as string, settings[key] as string);
        }
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
