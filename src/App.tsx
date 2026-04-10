import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import TaskList from './components/TaskList';
import Settings from './components/Settings';
import HistoryPanel from './components/HistoryPanel';
import type { JiraTask, TaskCreationResult, HistoryEntry, UpdateStatus } from './types';

interface Step {
  id: string;
  label: string;
}

const STEPS: Step[] = [
  { id: 'upload', label: 'Upload Document' },
  { id: 'review', label: 'Review Tasks' },
  { id: 'create', label: 'Create in Jira' },
];

interface DocData {
  text: string;
  fileName: string;
  filePath: string;
  images: string[];
}

interface StatusMsg {
  type: 'loading' | 'success' | 'error';
  msg: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: string;
  doneSteps: string[];
}

function StepIndicator({ steps, currentStep, doneSteps }: StepIndicatorProps) {
  return (
    <div className="step-indicator">
      {steps.map((s, i) => {
        const isDone = doneSteps.includes(s.id);
        const isActive = currentStep === s.id;
        const cls = isDone ? 'done' : isActive ? 'active' : '';
        return (
          <React.Fragment key={s.id}>
            <div className={`step-indicator-item ${cls}`}>
              <div className="si-num">{isDone ? '✓' : i + 1}</div>
              <div className="si-label">{s.label}</div>
            </div>
            {i < steps.length - 1 && (
              <div className={`step-indicator-line ${isDone ? 'done' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<'workflow' | 'settings' | 'history'>('workflow');
  const [activeStep, setActiveStep] = useState('upload');
  const [doneSteps, setDoneSteps] = useState<string[]>([]);

  const [docData, setDocData] = useState<DocData | null>(null);
  const [tasks, setTasks] = useState<JiraTask[]>([]);
  const [creationResults, setCreationResults] = useState<TaskCreationResult[] | null>(null);

  const [aiStatus, setAiStatus] = useState<StatusMsg | null>(null);
  const [jiraStatus, setJiraStatus] = useState<StatusMsg | null>(null);

  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<HistoryEntry | null>(null);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: 'idle' });

  // ── Auto-updater listeners ────────────────────────────────────────────────
  useEffect(() => {
    window.electronAPI.onUpdateAvailable((info) => {
      setUpdateStatus({ state: 'available', version: info.version });
    });
    window.electronAPI.onUpdateDownloadProgress((progress) => {
      setUpdateStatus({ state: 'downloading', percent: progress.percent });
    });
    window.electronAPI.onUpdateDownloaded((info) => {
      setUpdateStatus({ state: 'ready', version: info.version });
    });
    window.electronAPI.onUpdateError((err) => {
      setUpdateStatus({ state: 'error', message: err.message });
    });
    return () => {
      window.electronAPI.removeUpdateListeners();
    };
  }, []);

  // ── Restore session + load history on mount ──────────────────────────────
  useEffect(() => {
    const init = async () => {
      const sessionResult = await window.electronAPI.getCurrentSession();
      if (sessionResult.success && sessionResult.session) {
        const s = sessionResult.session;
        if (s.docInfo) {
          setDocData({
            text: s.docInfo.text,
            fileName: s.docInfo.fileName,
            filePath: s.docInfo.filePath,
            images: s.docInfo.images,
          });
        }
        if (s.tasks.length > 0) setTasks(s.tasks);
        if (s.creationResults) setCreationResults(s.creationResults);
        setActiveStep(s.activeStep);
        setDoneSteps(s.doneSteps);
      }
      setSessionRestored(true);

      const historyResult = await window.electronAPI.getHistory();
      if (historyResult.success) setHistoryEntries(historyResult.entries);
    };
    init();
  }, []);

  // ── Auto-save current session on any state change ────────────────────────
  useEffect(() => {
    if (!sessionRestored) return;
    window.electronAPI.saveCurrentSession({
      docInfo: docData
        ? { fileName: docData.fileName, filePath: docData.filePath, text: docData.text, images: docData.images }
        : null,
      tasks,
      creationResults,
      activeStep,
      doneSteps,
    });
  }, [tasks, docData, creationResults, activeStep, doneSteps, sessionRestored]);

  const markDone = (stepId: string) => {
    setDoneSteps((prev) => (prev.includes(stepId) ? prev : [...prev, stepId]));
  };

  const handleFileParsed = (data: DocData | null) => {
    setDocData(data);
    if (data) {
      markDone('upload');
    } else {
      setDoneSteps([]);
      setTasks([]);
      setCreationResults(null);
      setAiStatus(null);
      setJiraStatus(null);
      setActiveStep('upload');
    }
  };

  const handleGenerateTasks = async () => {
    if (!docData?.text) return;
    setAiStatus({ type: 'loading', msg: 'Generating tasks with AI… This may take a moment.' });
    setTasks([]);
    setCreationResults(null);

    const result = await window.electronAPI.generateTasks(docData.text);

    if (result.success) {
      setTasks(result.tasks);
      markDone('upload');
      markDone('review');
      setActiveStep('review');
      setAiStatus({
        type: 'success',
        msg: `${result.tasks.length} task${result.tasks.length !== 1 ? 's' : ''} generated successfully.`,
      });
    } else {
      setAiStatus({ type: 'error', msg: result.error || 'Failed to generate tasks.' });
    }
  };

  const handleTaskUpdate = (taskId: string, updated: Partial<JiraTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t)));
  };

  const handleTaskDelete = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleAddTask = () => {
    const newTask: JiraTask = {
      id: `task-${Date.now()}`,
      summary: 'New Task',
      description: '',
      issueType: 'Task',
      priority: 'Medium',
      storyPoints: 3,
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const handleCreateJira = async () => {
    if (tasks.length === 0) return;
    setJiraStatus({ type: 'loading', msg: `Creating ${tasks.length} task${tasks.length !== 1 ? 's' : ''} in Jira…` });
    setCreationResults(null);

    const settings = await window.electronAPI.getSettings();
    const result = await window.electronAPI.createJiraTasks(tasks, settings);

    if (result.success) {
      setCreationResults(result.results);
      markDone('review');
      markDone('create');
      setActiveStep('create');
      setJiraStatus({
        type: result.succeeded === result.total ? 'success' : 'error',
        msg: `${result.succeeded} of ${result.total} task${result.total !== 1 ? 's' : ''} created in Jira.`,
      });

      // Save to history
      const entry: HistoryEntry = {
        id: Date.now().toString(),
        savedAt: new Date().toISOString(),
        documentName: docData?.fileName ?? 'Unknown Document',
        taskCount: tasks.length,
        succeededCount: result.succeeded,
        tasks: [...tasks],
        jiraResults: result.results,
      };
      await window.electronAPI.saveHistoryEntry(entry);
      setHistoryEntries((prev) => [entry, ...prev]);
    } else {
      setJiraStatus({ type: 'error', msg: result.error || 'Failed to create Jira tasks.' });
    }
  };

  const handleReset = () => {
    setDocData(null);
    setTasks([]);
    setCreationResults(null);
    setAiStatus(null);
    setJiraStatus(null);
    setDoneSteps([]);
    setActiveStep('upload');
    window.electronAPI.saveCurrentSession({
      docInfo: null,
      tasks: [],
      creationResults: null,
      activeStep: 'upload',
      doneSteps: [],
    });
  };

  const handleDeleteHistoryEntry = async (id: string) => {
    await window.electronAPI.deleteHistoryEntry(id);
    setHistoryEntries((prev) => prev.filter((e) => e.id !== id));
    if (selectedHistoryEntry?.id === id) setSelectedHistoryEntry(null);
  };

  const stepNavClick = (stepId: string) => {
    setActiveStep(stepId);
    setView('workflow');
    setSelectedHistoryEntry(null);
  };

  const successCount = creationResults ? creationResults.filter((r) => r.success).length : 0;
  const failureCount = creationResults ? creationResults.filter((r) => !r.success).length : 0;

  const stepHeaders: Record<string, { title: string; desc: string }> = {
    upload: { title: 'Upload Document', desc: 'Select or drop a DOCX file to extract its content.' },
    review: { title: 'Review Generated Tasks', desc: 'Edit, delete, or add tasks before pushing to Jira.' },
    create: { title: 'Create Tasks in Jira', desc: 'Push the reviewed tasks to your Jira project.' },
    settings: { title: 'Settings', desc: 'Configure your local AI model and Jira connection.' },
    history: { title: 'Session History', desc: 'Browse and review previously completed sessions.' },
  };

  const currentHeader =
    view === 'settings'
      ? stepHeaders.settings
      : view === 'history'
      ? stepHeaders.history
      : (stepHeaders[activeStep] ?? stepHeaders.upload);

  const updateBanner = () => {
    if (updateStatus.state === 'available') {
      return (
        <div className="update-banner update-banner--available">
          <span>Update v{updateStatus.version} available — downloading…</span>
        </div>
      );
    }
    if (updateStatus.state === 'downloading') {
      return (
        <div className="update-banner update-banner--downloading">
          <span>Downloading update… {updateStatus.percent}%</span>
          <div className="update-progress-bar">
            <div className="update-progress-fill" style={{ width: `${updateStatus.percent}%` }} />
          </div>
        </div>
      );
    }
    if (updateStatus.state === 'ready') {
      return (
        <div className="update-banner update-banner--ready">
          <span>Update v{updateStatus.version} ready to install.</span>
          <button className="update-install-btn" onClick={() => window.electronAPI.installUpdate()}>
            Restart &amp; Install
          </button>
          <button className="update-dismiss-btn" onClick={() => setUpdateStatus({ state: 'idle' })}>
            Later
          </button>
        </div>
      );
    }
    if (updateStatus.state === 'error') {
      return (
        <div className="update-banner update-banner--error">
          <span>Update check failed: {updateStatus.message}</span>
          <button className="update-dismiss-btn" onClick={() => setUpdateStatus({ state: 'idle' })}>
            Dismiss
          </button>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="app-root">
      {updateBanner()}
      <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">J</div>
            <h1>
              Jira Task
              <br />
              Converter
            </h1>
          </div>
          <p className="sidebar-subtitle">DOCX → AI → Jira</p>
        </div>

        <nav className="sidebar-nav">
          <p className="sidebar-section-label">Workflow</p>
          {STEPS.map((s, i) => {
            const isDone = doneSteps.includes(s.id);
            const isActive = view === 'workflow' && activeStep === s.id;
            return (
              <button
                key={s.id}
                className={`step-nav-item ${isActive ? 'active' : ''} ${isDone && !isActive ? 'completed' : ''}`}
                onClick={() => stepNavClick(s.id)}
              >
                <div className="step-num">{isDone ? '✓' : i + 1}</div>
                {s.label}
              </button>
            );
          })}

          {tasks.length > 0 && (
            <>
              <div className="divider" style={{ margin: '14px 0 10px' }} />
              <p className="sidebar-section-label">Summary</p>
              <div className="info-tag" style={{ width: '100%', justifyContent: 'space-between', padding: '6px 8px' }}>
                <span>Tasks generated</span>
                <strong style={{ color: 'var(--accent-light)' }}>{tasks.length}</strong>
              </div>
              {creationResults && (
                <>
                  <div className="info-tag" style={{ width: '100%', justifyContent: 'space-between', padding: '6px 8px', marginTop: 6 }}>
                    <span>Created</span>
                    <strong style={{ color: 'var(--success)' }}>{successCount}</strong>
                  </div>
                  {failureCount > 0 && (
                    <div className="info-tag" style={{ width: '100%', justifyContent: 'space-between', padding: '6px 8px', marginTop: 6 }}>
                      <span>Failed</span>
                      <strong style={{ color: 'var(--error)' }}>{failureCount}</strong>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <div className="divider" style={{ margin: '14px 0 10px' }} />
          <p className="sidebar-section-label">History</p>
          <button
            className={`step-nav-item ${view === 'history' ? 'active' : ''}`}
            onClick={() => { setView('history'); setSelectedHistoryEntry(null); }}
          >
            <div className="step-num">H</div>
            Session History
            {historyEntries.length > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                {historyEntries.length}
              </span>
            )}
          </button>
        </nav>

        <button
          className={`sidebar-settings-btn ${view === 'settings' ? 'active' : ''}`}
          onClick={() => setView(view === 'settings' ? 'workflow' : 'settings')}
        >
          &#9881; Settings
        </button>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="main-header">
          <h2>{currentHeader.title}</h2>
          <p>{currentHeader.desc}</p>
        </div>

        <div className="main-body">
          {view === 'history' ? (
            <HistoryPanel
              entries={historyEntries}
              selectedEntry={selectedHistoryEntry}
              onSelectEntry={setSelectedHistoryEntry}
              onDeleteEntry={handleDeleteHistoryEntry}
              onClose={() => setView('workflow')}
            />
          ) : view === 'settings' ? (
            <Settings onClose={() => setView('workflow')} />
          ) : (
            <>
              <StepIndicator steps={STEPS} currentStep={activeStep} doneSteps={doneSteps} />

              {/* Step: Upload */}
              {activeStep === 'upload' && (
                <div>
                  <FileUpload onFileParsed={handleFileParsed} />

                  {docData && (
                    <>
                      <div className="divider" />
                      <div className="card" style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                          Document preview (first 500 chars):
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'monospace', lineHeight: 1.6 }}>
                          {docData.text.slice(0, 500)}
                          {docData.text.length > 500 && (
                            <span style={{ color: 'var(--text-muted)' }}>
                              {' '}…({(docData.text.length - 500).toLocaleString()} more chars)
                            </span>
                          )}
                        </p>
                      </div>

                      {aiStatus && (
                        <div className={`status-bar ${aiStatus.type}`} style={{ marginBottom: 14 }}>
                          {aiStatus.type === 'loading' && <div className="spinner" />}
                          {aiStatus.type === 'success' && <span>&#10003;</span>}
                          {aiStatus.type === 'error' && <span>&#9888;</span>}
                          <span>{aiStatus.msg}</span>
                        </div>
                      )}

                      <div className="action-row">
                        <button
                          className="btn btn-primary"
                          onClick={handleGenerateTasks}
                          disabled={aiStatus?.type === 'loading'}
                        >
                          {aiStatus?.type === 'loading' ? (
                            <><div className="spinner" /> Generating Tasks…</>
                          ) : (
                            'Generate Tasks with AI'
                          )}
                        </button>
                        {tasks.length > 0 && (
                          <button className="btn btn-secondary" onClick={() => setActiveStep('review')}>
                            View {tasks.length} Tasks ›
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Step: Review */}
              {activeStep === 'review' && (
                <div>
                  {tasks.length > 0 ? (
                    <>
                      <div className="task-list-header">
                        <h3>
                          Generated Tasks <span className="task-count-badge">{tasks.length}</span>
                        </h3>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary btn-sm" onClick={handleAddTask}>
                            + Add Task
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setActiveStep('upload')}>
                            ‹ Re-generate
                          </button>
                        </div>
                      </div>

                      <TaskList
                        tasks={tasks}
                        onUpdate={handleTaskUpdate}
                        onDelete={handleTaskDelete}
                        creationResults={creationResults}
                      />

                      {jiraStatus && (
                        <div className={`status-bar ${jiraStatus.type}`} style={{ marginTop: 16 }}>
                          {jiraStatus.type === 'loading' && <div className="spinner" />}
                          {jiraStatus.type === 'success' && <span>&#10003;</span>}
                          {jiraStatus.type === 'error' && <span>&#9888;</span>}
                          <span>{jiraStatus.msg}</span>
                        </div>
                      )}

                      <div className="action-row" style={{ marginTop: 20 }}>
                        <button
                          className="btn btn-success"
                          onClick={handleCreateJira}
                          disabled={tasks.length === 0 || jiraStatus?.type === 'loading'}
                        >
                          {jiraStatus?.type === 'loading' ? (
                            <><div className="spinner" /> Creating in Jira…</>
                          ) : (
                            `Push ${tasks.length} Task${tasks.length !== 1 ? 's' : ''} to Jira`
                          )}
                        </button>
                        {creationResults && (
                          <button className="btn btn-secondary" onClick={() => setActiveStep('create')}>
                            View Results ›
                          </button>
                        )}
                        <button className="btn btn-secondary" onClick={handleReset}>
                          ↺ Start Over
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">&#128203;</div>
                      <p>No tasks generated yet.</p>
                      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setActiveStep('upload')}>
                        Go to Upload
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Step: Create */}
              {activeStep === 'create' && (
                <div>
                  {creationResults ? (
                    <>
                      <div className="progress-summary">
                        <div className="progress-stat">
                          <div className="stat-num stat-total">{creationResults.length}</div>
                          <div className="stat-label">Total Tasks</div>
                        </div>
                        <div className="progress-stat">
                          <div className="stat-num stat-success">{successCount}</div>
                          <div className="stat-label">Created</div>
                        </div>
                        <div className="progress-stat">
                          <div className="stat-num stat-error">{failureCount}</div>
                          <div className="stat-label">Failed</div>
                        </div>
                      </div>

                      <div className="results-list">
                        {creationResults.map((r) => (
                          <div key={r.taskId} className={`result-item ${r.success ? 'success' : 'failure'}`}>
                            <span className="result-icon">{r.success ? '✓' : '✗'}</span>
                            <div className="result-text">
                              <div className="result-title">{r.summary}</div>
                              {r.success ? (
                                <div className="result-sub">Created as {r.jiraKey}</div>
                              ) : (
                                <div className="result-sub" style={{ color: 'var(--error)' }}>{r.error}</div>
                              )}
                            </div>
                            {r.success && r.jiraUrl && (
                              <a href={r.jiraUrl} target="_blank" rel="noreferrer" className="jira-link">
                                Open ↗
                              </a>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="action-row" style={{ marginTop: 24 }}>
                        {failureCount > 0 && (
                          <button className="btn btn-primary" onClick={handleCreateJira} disabled={jiraStatus?.type === 'loading'}>
                            Retry Failed Tasks
                          </button>
                        )}
                        <button className="btn btn-secondary" onClick={() => setActiveStep('review')}>
                          ‹ Back to Review
                        </button>
                        <button className="btn btn-secondary" onClick={handleReset}>
                          ↺ Start Over
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">&#128640;</div>
                      <p>No results yet. Review and push tasks to Jira first.</p>
                      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setActiveStep('review')}>
                        Go to Review
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      </div>
    </div>
  );
}
