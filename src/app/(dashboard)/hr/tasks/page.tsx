'use client';

import React, { useState, useEffect } from 'react';
import { TaskBoard } from '@/components/ui/TaskBoard';
import { TaskModal } from '@/components/ui/TaskModal';
import { db, Task, Profile } from '@/lib/db';
import { ClipboardList } from 'lucide-react';

export default function HRTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [isTaskOpen, setIsTaskOpen] = useState(false);

  useEffect(() => {
    setTasks(db.getTasks());
    setEmployees(db.getEmployees());
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Task Management</h1>
          <p className="text-slate-500">Create, assign, and track tasks across all teams.</p>
        </div>
        <button
          onClick={() => setIsTaskOpen(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all flex items-center gap-1.5 shadow-sm"
        >
          <ClipboardList className="h-4 w-4" /> Assign New Task
        </button>
      </div>

      <TaskBoard
        tasks={tasks}
        onUpdate={updated => setTasks(updated)}
        canDelete={true}
        readOnly={false}
      />

      <TaskModal
        isOpen={isTaskOpen}
        onClose={() => setIsTaskOpen(false)}
        employees={employees.filter(e => e.role === 'employee' || e.isTeamLead)}
        createdBy="hr"
        onTaskAdded={task => setTasks(prev => [task, ...prev])}
      />
    </div>
  );
}
