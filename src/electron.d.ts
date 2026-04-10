import type {
  AppSettings,
  JiraTask,
  ParseDocxResult,
  GenerateTasksResult,
  CreateTasksResult,
  SaveSettingsResult,
  ModelState,
  ModelDownloadProgress,
  ModelConfig,
  CurrentSession,
  HistoryEntry,
} from './types';

declare global {
  interface Window {
    electronAPI: {
      openFileDialog: () => Promise<string | null>;
      openImageDialog: () => Promise<string[]>;
      parseDocx: (filePath: string) => Promise<ParseDocxResult>;
      generateTasks: (text: string) => Promise<GenerateTasksResult>;
      createJiraTasks: (tasks: JiraTask[], config: AppSettings) => Promise<CreateTasksResult>;
      testJiraConnection: (config: AppSettings) => Promise<{ success: true; message: string } | { success: false; error: string }>;
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: AppSettings) => Promise<SaveSettingsResult>;

      // Model management
      getModels: () => Promise<Array<ModelConfig & { downloaded: boolean }>>;
      getModelStatus: () => Promise<ModelState>;
      downloadModel: (modelId: string) => Promise<{ success: boolean; error?: string }>;
      cancelDownload: (modelId: string) => Promise<{ success: boolean }>;
      loadModel: (modelId: string) => Promise<{ success: boolean; error?: string }>;
      onModelDownloadProgress: (callback: (progress: ModelDownloadProgress & { modelId: string }) => void) => void;
      onModelStatusChanged: (callback: (status: ModelState & { modelId: string }) => void) => void;
      removeModelListeners: () => void;

      // Session persistence
      getCurrentSession: () => Promise<{ success: true; session: CurrentSession | null } | { success: false; error: string }>;
      saveCurrentSession: (session: CurrentSession) => Promise<{ success: boolean; error?: string }>;

      // History
      getHistory: () => Promise<{ success: true; entries: HistoryEntry[] } | { success: false; error: string }>;
      saveHistoryEntry: (entry: HistoryEntry) => Promise<{ success: boolean; error?: string }>;
      deleteHistoryEntry: (id: string) => Promise<{ success: boolean; error?: string }>;

      // Auto-updater
      onUpdateAvailable: (callback: (info: { version: string }) => void) => void;
      onUpdateNotAvailable: (callback: () => void) => void;
      onUpdateDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => void;
      onUpdateDownloaded: (callback: (info: { version: string }) => void) => void;
      onUpdateError: (callback: (err: { message: string }) => void) => void;
      installUpdate: () => Promise<void>;
      removeUpdateListeners: () => void;
    };
  }
}

export {};
