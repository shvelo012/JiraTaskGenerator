import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings, JiraTask, ModelDownloadProgress, ModelState, CurrentSession, HistoryEntry } from './src/types';

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
  getModelStatus: (): Promise<ModelState> =>
    ipcRenderer.invoke('get-model-status'),

  downloadModel: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('download-model'),

  cancelDownload: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('cancel-download'),

  loadModel: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('load-model'),

  onModelDownloadProgress: (callback: (progress: ModelDownloadProgress) => void) => {
    ipcRenderer.on('model-download-progress', (_event, progress) => callback(progress));
  },

  onModelStatusChanged: (callback: (status: ModelState) => void) => {
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
});
