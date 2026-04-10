import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings, JiraTask, ModelDownloadProgress, ModelState, ModelConfig, CurrentSession, HistoryEntry } from './src/types';

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: (): Promise<string | null> =>
    ipcRenderer.invoke('open-file-dialog'),

  openImageDialog: (): Promise<string[]> =>
    ipcRenderer.invoke('open-image-dialog'),

  parseDocx: (filePath: string) =>
    ipcRenderer.invoke('parse-docx', filePath),

  generateTasks: (text: string) =>
    ipcRenderer.invoke('generate-tasks', text),

  createJiraTasks: (tasks: JiraTask[], config: AppSettings) =>
    ipcRenderer.invoke('create-jira-tasks', tasks, config),

  testJiraConnection: (config: AppSettings) =>
    ipcRenderer.invoke('test-jira-connection', config),

  getSettings: () =>
    ipcRenderer.invoke('get-settings'),

  saveSettings: (settings: AppSettings) =>
    ipcRenderer.invoke('save-settings', settings),

  // Model management
  getModels: (): Promise<Array<ModelConfig & { downloaded: boolean }>> =>
    ipcRenderer.invoke('get-models'),

  getModelStatus: (): Promise<ModelState> =>
    ipcRenderer.invoke('get-model-status'),

  downloadModel: (modelId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('download-model', modelId),

  cancelDownload: (modelId: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('cancel-download', modelId),

  loadModel: (modelId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('load-model', modelId),

  onModelDownloadProgress: (callback: (progress: ModelDownloadProgress & { modelId: string }) => void) => {
    ipcRenderer.on('model-download-progress', (_event, progress) => callback(progress));
  },

  onModelStatusChanged: (callback: (status: ModelState & { modelId: string }) => void) => {
    ipcRenderer.on('model-status-changed', (_event, status) => callback(status));
  },

  removeModelListeners: () => {
    ipcRenderer.removeAllListeners('model-download-progress');
    ipcRenderer.removeAllListeners('model-status-changed');
  },

  // Session persistence
  getCurrentSession: () =>
    ipcRenderer.invoke('get-current-session'),

  saveCurrentSession: (session: CurrentSession) =>
    ipcRenderer.invoke('save-current-session', session),

  // History
  getHistory: () =>
    ipcRenderer.invoke('get-history'),

  saveHistoryEntry: (entry: HistoryEntry) =>
    ipcRenderer.invoke('save-history-entry', entry),

  deleteHistoryEntry: (id: string) =>
    ipcRenderer.invoke('delete-history-entry', id),

  // Auto-updater
  onUpdateAvailable: (callback: (info: { version: string }) => void) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info));
  },
  onUpdateNotAvailable: (callback: () => void) => {
    ipcRenderer.on('update-not-available', () => callback());
  },
  onUpdateDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => {
    ipcRenderer.on('update-download-progress', (_event, progress) => callback(progress));
  },
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info));
  },
  onUpdateError: (callback: (err: { message: string }) => void) => {
    ipcRenderer.on('update-error', (_event, err) => callback(err));
  },
  installUpdate: (): Promise<void> =>
    ipcRenderer.invoke('install-update'),
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('update-not-available');
    ipcRenderer.removeAllListeners('update-download-progress');
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.removeAllListeners('update-error');
  },
});
