export interface JiraTask {
  id: string;
  summary: string;
  description: string;
  issueType: 'Story' | 'Task' | 'Bug';
  priority: 'High' | 'Medium' | 'Low';
  storyPoints: number;
  images?: string[]; // local file paths to attach as Jira attachments
}

export interface AppSettings {
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
  jiraProjectKey: string;
  storyPointsField: string;
  selectedModelId: string;
}

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  filename: string;
  url: string;
}

export type ModelState =
  | { state: 'not-downloaded' }
  | { state: 'downloading'; downloaded: number; total: number; percent: number }
  | { state: 'downloaded' }
  | { state: 'loading' }
  | { state: 'ready' }
  | { state: 'error'; message: string };

export interface ModelDownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
}

export interface SessionDocInfo {
  fileName: string;
  filePath: string;
  text: string;
  images: string[];
}

export interface CurrentSession {
  docInfo: SessionDocInfo | null;
  tasks: JiraTask[];
  creationResults: TaskCreationResult[] | null;
  activeStep: string;
  doneSteps: string[];
}

export interface HistoryEntry {
  id: string;
  savedAt: string;
  documentName: string;
  taskCount: number;
  succeededCount: number;
  tasks: JiraTask[];
  jiraResults: TaskCreationResult[];
}

export interface ParseDocxSuccess {
  success: true;
  text: string;
  images: string[]; // temp file paths of extracted images
  warnings: unknown[];
}

export interface ParseDocxFailure {
  success: false;
  error: string;
}

export type ParseDocxResult = ParseDocxSuccess | ParseDocxFailure;

export interface GenerateTasksSuccess {
  success: true;
  tasks: JiraTask[];
}

export interface GenerateTasksFailure {
  success: false;
  error: string;
}

export type GenerateTasksResult = GenerateTasksSuccess | GenerateTasksFailure;

export interface TaskCreationResult {
  taskId: string;
  summary: string;
  success: boolean;
  jiraKey?: string;
  jiraUrl?: string;
  error?: string;
}

export interface CreateTasksSuccess {
  success: true;
  results: TaskCreationResult[];
  succeeded: number;
  total: number;
}

export interface CreateTasksFailure {
  success: false;
  error: string;
}

export type CreateTasksResult = CreateTasksSuccess | CreateTasksFailure;

export interface SaveSettingsSuccess {
  success: true;
}

export interface SaveSettingsFailure {
  success: false;
  error: string;
}

export type SaveSettingsResult = SaveSettingsSuccess | SaveSettingsFailure;
