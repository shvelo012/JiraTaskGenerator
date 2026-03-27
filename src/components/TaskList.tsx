import React from 'react';
import TaskCard from './TaskCard';
import type { JiraTask, TaskCreationResult } from '../types';

interface Props {
  tasks: JiraTask[];
  onUpdate: (taskId: string, updated: Partial<JiraTask>) => void;
  onDelete: (taskId: string) => void;
  creationResults: TaskCreationResult[] | null;
}

export default function TaskList({ tasks, onUpdate, onDelete, creationResults }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">&#128203;</div>
        <p>No tasks yet. Upload a document and generate tasks to see them here.</p>
      </div>
    );
  }

  const resultMap: Record<string, TaskCreationResult> = {};
  if (creationResults) {
    for (const r of creationResults) {
      resultMap[r.taskId] = r;
    }
  }

  return (
    <div className="task-grid">
      {tasks.map((task, i) => (
        <TaskCard
          key={task.id}
          task={task}
          index={i}
          onUpdate={(updated) => onUpdate(task.id, updated)}
          onDelete={onDelete}
          creationResult={resultMap[task.id] ?? null}
        />
      ))}
    </div>
  );
}
