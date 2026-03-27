import React from 'react';
import type { HistoryEntry, JiraTask, TaskCreationResult } from '../types';
import TaskList from './TaskList';

interface Props {
  entries: HistoryEntry[];
  selectedEntry: HistoryEntry | null;
  onSelectEntry: (entry: HistoryEntry | null) => void;
  onDeleteEntry: (id: string) => void;
  onClose: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const noopUpdate = (_id: string, _updated: Partial<JiraTask>) => {};
const noopDelete = (_id: string) => {};

export default function HistoryPanel({ entries, selectedEntry, onSelectEntry, onDeleteEntry, onClose }: Props) {
  if (selectedEntry) {
    const failed = selectedEntry.jiraResults.filter((r) => !r.success).length;

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onSelectEntry(null)}>
            ‹ Back
          </button>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedEntry.documentName}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(selectedEntry.savedAt)}</div>
          </div>
        </div>

        <div className="progress-summary" style={{ marginBottom: 16 }}>
          <div className="progress-stat">
            <div className="stat-num stat-total">{selectedEntry.taskCount}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="progress-stat">
            <div className="stat-num stat-success">{selectedEntry.succeededCount}</div>
            <div className="stat-label">Created</div>
          </div>
          <div className="progress-stat">
            <div className="stat-num stat-error">{failed}</div>
            <div className="stat-label">Failed</div>
          </div>
        </div>

        <TaskList
          tasks={selectedEntry.tasks}
          onUpdate={noopUpdate}
          onDelete={noopDelete}
          creationResults={selectedEntry.jiraResults}
        />

        <div className="action-row" style={{ marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close History
          </button>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">&#128203;</div>
        <p>No history yet.</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
          Sessions are saved automatically after pushing tasks to Jira.
        </p>
      </div>
    );
  }

  return (
    <div>
      {entries.map((entry) => (
        <div key={entry.id} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.documentName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{formatDate(entry.savedAt)}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => onSelectEntry(entry)}>
                View
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  if (window.confirm('Delete this history entry?')) {
                    onDeleteEntry(entry.id);
                  }
                }}
              >
                &#128465;
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="info-tag">
              {entry.taskCount} task{entry.taskCount !== 1 ? 's' : ''}
            </span>
            <span className="info-tag" style={{ color: 'var(--success)' }}>
              {entry.succeededCount} created
            </span>
            {entry.taskCount - entry.succeededCount > 0 && (
              <span className="info-tag" style={{ color: 'var(--error)' }}>
                {entry.taskCount - entry.succeededCount} failed
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
