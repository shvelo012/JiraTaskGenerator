import React, { useState } from 'react';
import type { JiraTask, TaskCreationResult } from '../types';

const ISSUE_TYPES: JiraTask['issueType'][] = ['Story', 'Task', 'Bug'];
const PRIORITIES: JiraTask['priority'][] = ['High', 'Medium', 'Low'];
const STORY_POINTS = [1, 2, 3, 5, 8, 13];

function IssueTypeBadge({ type }: { type: JiraTask['issueType'] }) {
  const cls = { Story: 'badge-story', Task: 'badge-task', Bug: 'badge-bug' }[type] ?? 'badge-task';
  return <span className={`badge ${cls}`}>{type}</span>;
}

function PriorityBadge({ priority }: { priority: JiraTask['priority'] }) {
  const cls =
    { High: 'badge-high', Medium: 'badge-medium', Low: 'badge-low' }[priority] ?? 'badge-medium';
  const icons: Record<JiraTask['priority'], string> = { High: '▲', Medium: '■', Low: '▼' };
  return (
    <span className={`badge ${cls}`}>
      {icons[priority]} {priority}
    </span>
  );
}

interface Props {
  task: JiraTask;
  index: number;
  onUpdate: (updated: Partial<JiraTask>) => void;
  onDelete: (taskId: string) => void;
  creationResult: TaskCreationResult | null;
}

export default function TaskCard({ task, index, onUpdate, onDelete, creationResult }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<JiraTask>({ ...task });

  const handleSave = () => {
    onUpdate({ ...draft });
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft({ ...task });
    setEditing(false);
  };

  const handleDraftChange = <K extends keyof JiraTask>(key: K, val: JiraTask[K]) => {
    setDraft((d) => ({ ...d, [key]: val }));
  };

  return (
    <div className={`task-card ${editing ? 'editing' : ''}`}>
      {/* Header */}
      <div className="task-card-header">
        <span className="task-num">#{index + 1}</span>
        <span className="task-summary">{task.summary}</span>
        <div className="task-card-badges">
          <IssueTypeBadge type={task.issueType} />
          <PriorityBadge priority={task.priority} />
          <span className="badge badge-points">{task.storyPoints} SP</span>
        </div>
      </div>

      {/* Body */}
      {!editing ? (
        <div className="task-card-body">
          {task.description ? (
            <p className="task-desc">{task.description}</p>
          ) : (
            <p className="task-desc" style={{ fontStyle: 'italic', opacity: 0.5 }}>
              No description.
            </p>
          )}
          {(task.images ?? []).length > 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              &#128247; {task.images!.length} image{task.images!.length !== 1 ? 's' : ''} attached
            </p>
          )}
        </div>
      ) : (
        <div className="edit-form">
          <div className="form-group">
            <label>Summary</label>
            <input
              type="text"
              value={draft.summary}
              onChange={(e) => handleDraftChange('summary', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              rows={4}
              value={draft.description}
              onChange={(e) => handleDraftChange('description', e.target.value)}
            />
          </div>
          {/* Images */}
          <div className="form-group">
            <label>Attachments</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(draft.images ?? []).map((imgPath, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                    &#128247; {imgPath.split(/[\\/]/).pop()}
                  </span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDraftChange('images', (draft.images ?? []).filter((_, j) => j !== i))}
                    style={{ padding: '2px 8px', fontSize: 11 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                className="btn btn-secondary btn-sm"
                style={{ alignSelf: 'flex-start', marginTop: 2 }}
                onClick={async () => {
                  const paths = await window.electronAPI.openImageDialog();
                  if (paths.length > 0) {
                    handleDraftChange('images', [...(draft.images ?? []), ...paths]);
                  }
                }}
              >
                + Add Images
              </button>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Issue Type</label>
              <select
                value={draft.issueType}
                onChange={(e) => handleDraftChange('issueType', e.target.value as JiraTask['issueType'])}
              >
                {ISSUE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select
                value={draft.priority}
                onChange={(e) => handleDraftChange('priority', e.target.value as JiraTask['priority'])}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Story Points</label>
              <select
                value={draft.storyPoints}
                onChange={(e) => handleDraftChange('storyPoints', Number(e.target.value))}
              >
                {STORY_POINTS.map((sp) => (
                  <option key={sp} value={sp}>
                    {sp}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Creation result */}
      {creationResult && (
        <div
          className={`status-bar ${creationResult.success ? 'success' : 'error'}`}
          style={{ margin: '0 14px 10px', borderRadius: 6 }}
        >
          {creationResult.success ? (
            <>
              <span>&#10003;</span>
              <span>
                Created:{' '}
                <a
                  href={creationResult.jiraUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 700 }}
                >
                  {creationResult.jiraKey}
                </a>
              </span>
            </>
          ) : (
            <>
              <span>&#9888;</span>
              <span>Error: {creationResult.error}</span>
            </>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="task-card-footer">
        {!editing ? (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
              &#9998; Edit
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(task.id)}>
              &#128465;
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>
              Save
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleCancel}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
