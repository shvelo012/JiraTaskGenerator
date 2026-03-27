# Jira Task Converter

A desktop application that converts DOCX documents into Jira tasks using a locally-run AI model. No external AI API keys required — everything runs on your machine.

## Features

- Parse DOCX files and extract text + embedded images
- Generate Jira tasks (summary, description, type, priority, story points) using a local LLM (Llama 3.2 3B)
- Review and edit tasks before pushing to Jira
- Attach images to tasks (extracted from DOCX or added manually)
- Push tasks directly to your Jira project via the REST API
- Session persistence — your last session is auto-saved and restored on relaunch
- Session history — browse and review all past Jira push sessions

---

## Requirements

- **Node.js** v18 or later
- **npm** v9 or later
- A **Jira Cloud** account with API access
- ~2.5 GB of free disk space for the AI model (downloaded on first use)

---

## Installation

```bash
git clone <repo-url>
cd JiraTaksConverter
npm install
```

---

## Development

Run in development mode (hot reload):

```bash
npm run dev
```

This starts three parallel processes:
1. TypeScript compiler watching `electron/` and `main.ts`
2. Webpack watching `src/` (renderer)
3. Electron launcher (waits for compiled output before starting)

---

## Building

Build both the main process and renderer:

```bash
npm run build
```

Then launch the built app:

```bash
npm run electron
```

Or build + launch in one command:

```bash
npm start
```

---

## Packaging (Distributable)

### Linux (AppImage + .deb)

```bash
npm run dist:linux
```

Output is placed in the `release/` directory.

### Windows

> **Note:** Building a Windows NSIS installer on Linux requires [Wine](https://www.winehq.org/) to be installed. If Wine is not available, the `zip` target is used instead (no Wine required). For a proper `.exe` installer, build on a Windows machine.

```bash
npm run dist:win
```

### macOS

```bash
npm run dist:mac
```

---

## First-Time Setup

### 1. Configure Jira Settings

Open the app, go to **Settings**, and fill in:

| Field | Description |
|---|---|
| **Jira Base URL** | Your Atlassian domain, e.g. `https://your-org.atlassian.net` |
| **Email** | The email address of your Jira account |
| **API Token** | Generate one at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) |
| **Project Key** | The short key shown in your Jira project URL, e.g. `PROJ` |
| **Story Points Field** | The custom field ID used for story points in your Jira instance, e.g. `story_points` or `customfield_10016`. Leave blank to skip story points. |

Click **Test Connection** to verify your credentials before using the app.

### 2. Download the AI Model

In **Settings**, under **Local AI Model**, click **Download Model**.

- The model is **Llama 3.2 3B Instruct (Q4_K_M quantized)**, ~2.0 GB
- Downloaded from HuggingFace and stored in your app data directory
- Download only happens once; the model is reused on subsequent launches
- You can cancel the download and resume later

After downloading, click **Load into Memory** to prepare the model for inference.

---

## Usage

### Workflow

1. **Upload Document** — Click "Choose File" and select a `.docx` file. The app extracts text and any embedded images.
2. **Generate Tasks** — The local AI analyzes the document and generates a list of Jira tasks.
3. **Review & Edit** — Edit task summaries, descriptions, types, priorities, story points, and image attachments before pushing.
4. **Push to Jira** — Click "Create in Jira" to create all tasks. Results are shown with direct links to each created issue.

### Image Attachments

- Images embedded in the DOCX are automatically extracted and pre-attached to the first task.
- You can reassign images to specific tasks in the edit view.
- Click the attachment button in any task card to manually add images from your filesystem.
- Attached images are uploaded to Jira alongside the issue.

### Session Persistence

- Your current session (document, tasks, step) is automatically saved after every change.
- If you close and reopen the app, the previous session is restored.
- Clicking **Reset / Start Over** clears the saved session.

### History

- After a successful Jira push, the session is saved to **History**.
- Access history from the sidebar to review past sessions, see which tasks were created or failed, and view task details.
- Individual history entries can be deleted.

---

## Project Structure

```
JiraTaksConverter/
├── main.ts                  # Electron main process entry point
├── preload.ts               # Context bridge (exposes APIs to renderer)
├── electron/
│   ├── ipc-handlers.ts      # All IPC handlers (Jira, LLM, settings, history)
│   └── llm-manager.ts       # Model download, load, and inference logic
├── src/
│   ├── index.tsx            # Renderer entry point
│   ├── index.html           # HTML shell
│   ├── types.ts             # Shared TypeScript types
│   ├── electron.d.ts        # Window.electronAPI type declarations
│   ├── App.tsx              # Root application component
│   ├── styles/
│   │   └── app.css
│   └── components/
│       ├── FileUpload.tsx   # Document picker and parse trigger
│       ├── TaskList.tsx     # List of task cards
│       ├── TaskCard.tsx     # Individual task view/edit card
│       ├── Settings.tsx     # Jira config + model management UI
│       └── HistoryPanel.tsx # Session history list and detail view
├── tsconfig.json            # TypeScript config (main process)
├── tsconfig.renderer.json   # TypeScript config (renderer / React)
├── webpack.config.js        # Webpack config for renderer bundle
└── package.json
```

---

## Jira API Token

1. Go to [https://id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **Create API token**
3. Give it a label (e.g. "Jira Task Converter")
4. Copy the token and paste it into Settings

> The token is stored locally using `electron-store` and is never sent anywhere except your own Jira instance.

---

## Troubleshooting

### "You do not have permission to create issues in this project"
- Ensure the Jira account used has the **Create Issues** project permission.
- Use an organization admin account if possible.
- Check the Project Key is correct (case-sensitive).

### "Field 'story_points' cannot be set"
- The story points field name varies by Jira configuration.
- Try `customfield_10016` (the most common default) or leave the field blank to skip story points entirely.
- The app will automatically retry without story points if it receives a 400 error on this field.

### "Model not downloaded"
- Go to **Settings** and download the model before generating tasks.

### App shows blank window or crashes on launch
- Run `npm run build` before `npm run electron`.
- Check the DevTools console (View > Toggle Developer Tools) for errors.

### TypeScript IDE errors on `window.electronAPI`
- Make sure your IDE is using the workspace TypeScript version.
- In VS Code: open the command palette → "TypeScript: Select TypeScript Version" → "Use Workspace Version".
- Restart the TS language server if needed.

---

## Tech Stack

| Component | Technology |
|---|---|
| Desktop shell | Electron 31 |
| UI | React 19 + TypeScript |
| Bundler | Webpack 5 |
| Local AI | node-llama-cpp v3 + Llama 3.2 3B (GGUF) |
| DOCX parsing | mammoth |
| HTTP client | axios |
| Settings storage | electron-store |
| Packaging | electron-builder |
