import React, { useState, useEffect } from 'react';
import type { AppSettings, ModelConfig, ModelState } from '../types';

interface StatusMsg {
  type: 'loading' | 'success' | 'error';
  msg: string;
}

interface ModelEntry extends ModelConfig {
  downloaded: boolean;
}

type PerModelState = Record<string, ModelState>;

interface Props {
  onClose?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 ** 2);
  return `${mb.toFixed(1)} MB`;
}

export default function Settings({ onClose }: Props) {
  const [form, setForm] = useState<AppSettings>({
    jiraBaseUrl: '',
    jiraEmail: '',
    jiraApiToken: '',
    jiraProjectKey: '',
    storyPointsField: 'story_points',
    selectedModelId: '',
  });
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [modelStates, setModelStates] = useState<PerModelState>({});

  useEffect(() => {
    const init = async () => {
      const [s, modelList] = await Promise.all([
        window.electronAPI.getSettings(),
        window.electronAPI.getModels(),
      ]);
      setForm({
        jiraBaseUrl: s.jiraBaseUrl ?? '',
        jiraEmail: s.jiraEmail ?? '',
        jiraApiToken: s.jiraApiToken ?? '',
        jiraProjectKey: s.jiraProjectKey ?? '',
        storyPointsField: s.storyPointsField ?? 'story_points',
        selectedModelId: s.selectedModelId ?? '',
      });
      setModels(modelList);

      // Build initial per-model states from download flags
      const initial: PerModelState = {};
      for (const m of modelList) {
        initial[m.id] = { state: m.downloaded ? 'downloaded' : 'not-downloaded' };
      }
      setModelStates(initial);

      setLoading(false);
    };
    init();

    window.electronAPI.onModelDownloadProgress((progress) => {
      setModelStates((prev) => ({
        ...prev,
        [progress.modelId]: { state: 'downloading', downloaded: progress.downloaded, total: progress.total, percent: progress.percent },
      }));
    });

    window.electronAPI.onModelStatusChanged((status) => {
      setModelStates((prev) => ({
        ...prev,
        [status.modelId]: status,
      }));
    });

    return () => {
      window.electronAPI.removeModelListeners();
    };
  }, []);

  const handleChange = <K extends keyof AppSettings>(key: K, val: AppSettings[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
  };

  const handleSave = async () => {
    setStatus({ type: 'loading', msg: 'Saving settings…' });
    const res = await window.electronAPI.saveSettings(form);
    if (res.success) {
      setStatus({ type: 'success', msg: 'Settings saved successfully!' });
      setTimeout(() => setStatus(null), 3000);
    } else {
      setStatus({ type: 'error', msg: (res as { success: false; error: string }).error || 'Failed to save settings.' });
    }
  };

  const handleTestConnection = async () => {
    setStatus({ type: 'loading', msg: 'Testing Jira connection…' });
    const res = await window.electronAPI.testJiraConnection(form);
    if (res.success) {
      setStatus({ type: 'success', msg: res.message });
    } else {
      setStatus({ type: 'error', msg: res.error });
    }
  };

  const handleDownload = async (modelId: string) => {
    setModelStates((prev) => ({
      ...prev,
      [modelId]: { state: 'downloading', downloaded: 0, total: 0, percent: 0 },
    }));
    await window.electronAPI.downloadModel(modelId);
  };

  const handleCancel = async (modelId: string) => {
    await window.electronAPI.cancelDownload(modelId);
  };

  const handleLoadModel = async (modelId: string) => {
    await window.electronAPI.loadModel(modelId);
  };

  const handleSelectModel = (modelId: string) => {
    handleChange('selectedModelId', modelId);
  };

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" style={{ margin: '0 auto 12px', width: 28, height: 28 }} />
        <p>Loading settings…</p>
      </div>
    );
  }

  return (
    <div>
      {/* Local AI Model Section */}
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="settings-section-title">Local AI Model</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Choose a model to run entirely on your machine — no API key needed.
          Select an active model after downloading it.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {models.map((model) => {
            const ms = modelStates[model.id] ?? { state: 'not-downloaded' };
            const isSelected = form.selectedModelId === model.id;

            return (
              <div
                key={model.id}
                style={{
                  border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 8,
                  padding: '12px 14px',
                  background: isSelected ? 'rgba(99,102,241,0.07)' : 'var(--bg-tertiary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {model.name}
                      {isSelected && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--accent-light)', fontWeight: 400 }}>
                          ● Active
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{model.description}</div>
                  </div>

                  {!isSelected && ms.state === 'downloaded' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ flexShrink: 0 }}
                      onClick={() => handleSelectModel(model.id)}
                    >
                      Use this model
                    </button>
                  )}
                  {!isSelected && ms.state === 'ready' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ flexShrink: 0 }}
                      onClick={() => handleSelectModel(model.id)}
                    >
                      Use this model
                    </button>
                  )}
                </div>

                {ms.state === 'not-downloaded' && (
                  <button className="btn btn-primary btn-sm" onClick={() => handleDownload(model.id)}>
                    Download
                  </button>
                )}

                {ms.state === 'downloading' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>
                      <span>Downloading…</span>
                      <span>
                        {formatBytes(ms.downloaded)} / {ms.total > 0 ? formatBytes(ms.total) : '?'} ({ms.percent}%)
                      </span>
                    </div>
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 8 }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${ms.percent}%`,
                          background: 'var(--accent)',
                          transition: 'width 0.3s ease',
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleCancel(model.id)}>
                      Cancel
                    </button>
                  </div>
                )}

                {ms.state === 'downloaded' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: 'var(--success)', fontSize: 12 }}>&#10003; Downloaded</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleLoadModel(model.id)}>
                      Load into memory
                    </button>
                  </div>
                )}

                {ms.state === 'loading' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="spinner" />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading into memory…</span>
                  </div>
                )}

                {ms.state === 'ready' && (
                  <span style={{ color: 'var(--success)', fontSize: 12 }}>&#10003; Loaded and ready</span>
                )}

                {ms.state === 'error' && (
                  <div>
                    <p style={{ color: 'var(--error)', fontSize: 12, marginBottom: 6 }}>
                      Error: {ms.message}
                    </p>
                    <button className="btn btn-primary btn-sm" onClick={() => handleDownload(model.id)}>
                      Retry Download
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Jira Section */}
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="settings-section-title">Jira Configuration</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label>Jira Base URL</label>
            <input
              type="url"
              placeholder="https://your-domain.atlassian.net"
              value={form.jiraBaseUrl}
              onChange={(e) => handleChange('jiraBaseUrl', e.target.value)}
            />
          </div>
          <div className="settings-grid">
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="your.email@example.com"
                value={form.jiraEmail}
                onChange={(e) => handleChange('jiraEmail', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>API Token</label>
              <input
                type="password"
                placeholder="Your Jira API token"
                value={form.jiraApiToken}
                onChange={(e) => handleChange('jiraApiToken', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Project Key</label>
              <input
                type="text"
                placeholder="e.g. PROJ"
                value={form.jiraProjectKey}
                onChange={(e) => handleChange('jiraProjectKey', e.target.value.toUpperCase())}
              />
            </div>
            <div className="form-group">
              <label>Story Points Field</label>
              <input
                type="text"
                placeholder="story_points or customfield_10016"
                value={form.storyPointsField}
                onChange={(e) => handleChange('storyPointsField', e.target.value)}
              />
            </div>
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          Generate your Jira API token at{' '}
          <span style={{ color: 'var(--accent-light)' }}>
            id.atlassian.com/manage-profile/security/api-tokens
          </span>
        </p>
      </div>

      {status && (
        <div className={`status-bar ${status.type}`} style={{ marginBottom: 14, whiteSpace: 'pre-line' }}>
          {status.type === 'loading' && <div className="spinner" />}
          {status.type === 'success' && <span>&#10003;</span>}
          {status.type === 'error' && <span>&#9888;</span>}
          <span>{status.msg}</span>
        </div>
      )}

      <div className="action-row">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={status?.type === 'loading'}
        >
          {status?.type === 'loading' ? (
            <>
              <div className="spinner" /> Saving…
            </>
          ) : (
            'Save Settings'
          )}
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleTestConnection}
          disabled={status?.type === 'loading'}
        >
          Test Jira Connection
        </button>
        {onClose && (
          <button className="btn btn-secondary" onClick={onClose}>
            Back to Workflow
          </button>
        )}
      </div>
    </div>
  );
}
