import type {
  AppSettings,
  JiraTask,
  ParseDocxResult,
  GenerateTasksResult,
  CreateTasksResult,
  SaveSettingsResult,
  ModelState,
  ModelDownloadProgress,
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
      getModelStatus: () => Promise<ModelState>;
      downloadModel: () => Promise<{ success: boolean; error?: string }>;
      cancelDownload: () => Promise<{ success: boolean }>;
      loadModel: () => Promise<{ success: boolean; error?: string }>;
      onModelDownloadProgress: (callback: (progress: ModelDownloadProgress) => void) => void;
      onModelStatusChanged: (callback: (status: ModelState) => void) => void;
      removeModelListeners: () => void;

      // Session persistence
      getCurrentSession: () => Promise<{ success: true; session: CurrentSession | null } | { success: false; error: string }>;
      saveCurrentSession: (session: CurrentSession) => Promise<{ success: boolean; error?: string }>;

      // History
      getHistory: () => Promise<{ success: true; entries: HistoryEntry[] } | { success: false; error: string }>;
      saveHistoryEntry: (entry: HistoryEntry) => Promise<{ success: boolean; error?: string }>;
      deleteHistoryEntry: (id: string) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

export {};
