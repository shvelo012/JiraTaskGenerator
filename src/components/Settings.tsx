import React, { useState, useEffect } from 'react';
import type { AppSettings, ModelState } from '../types';

interface StatusMsg {
  type: 'loading' | 'success' | 'error';
  msg: string;
}

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
  });
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const [loading, setLoading] = useState(true);
  const [modelState, setModelState] = useState<ModelState>({ state: 'not-downloaded' });

  useEffect(() => {
    window.electronAPI.getSettings().then((s) => {
      setForm({
        jiraBaseUrl: s.jiraBaseUrl ?? '',
        jiraEmail: s.jiraEmail ?? '',
        jiraApiToken: s.jiraApiToken ?? '',
        jiraProjectKey: s.jiraProjectKey ?? '',
        storyPointsField: s.storyPointsField ?? 'story_points',
      });
      setLoading(false);
    });

    window.electronAPI.getModelStatus().then(setModelState);

    window.electronAPI.onModelDownloadProgress((progress) => {
      setModelState({ state: 'downloading', ...progress });
    });

    window.electronAPI.onModelStatusChanged(setModelState);

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

  const handleDownload = async () => {
    setModelState({ state: 'downloading', downloaded: 0, total: 0, percent: 0 });
    await window.electronAPI.downloadModel();
  };

  const handleCancel = async () => {
    await window.electronAPI.cancelDownload();
  };

  const handleLoadModel = async () => {
    await window.electronAPI.loadModel();
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
          Llama 3.2 3B Instruct — runs entirely on your machine, no API key needed (~2 GB download)
        </p>

        {modelState.state === 'not-downloaded' && (
          <div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              Model not downloaded yet.
            </p>
            <button className="btn btn-primary" onClick={handleDownload}>
              Download Model
            </button>
          </div>
        )}

        {modelState.state === 'downloading' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: 'var(--text-muted)' }}>
              <span>Downloading…</span>
              <span>
                {formatBytes(modelState.downloaded)} / {modelState.total > 0 ? formatBytes(modelState.total) : '?'} ({modelState.percent}%)
              </span>
            </div>
            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 4, height: 8, overflow: 'hidden', marginBottom: 10 }}>
              <div
                style={{
                  height: '100%',
                  width: `${modelState.percent}%`,
                  background: 'var(--accent)',
                  transition: 'width 0.3s ease',
                  borderRadius: 4,
                }}
              />
            </div>
            <button className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        )}

        {modelState.state === 'downloaded' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--success)', fontSize: 13 }}>&#10003; Model downloaded</span>
            <button className="btn btn-secondary btn-sm" onClick={handleLoadModel}>
              Load into memory
            </button>
          </div>
        )}

        {modelState.state === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="spinner" />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading model into memory…</span>
          </div>
        )}

        {modelState.state === 'ready' && (
          <span style={{ color: 'var(--success)', fontSize: 13 }}>&#10003; Model loaded and ready</span>
        )}

        {modelState.state === 'error' && (
          <div>
            <p style={{ color: 'var(--error)', fontSize: 12, marginBottom: 8 }}>
              Error: {modelState.message}
            </p>
            <button className="btn btn-primary" onClick={handleDownload}>
              Retry Download
            </button>
          </div>
        )}
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
