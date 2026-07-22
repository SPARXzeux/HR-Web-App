'use client';

import React, { useState, useEffect } from 'react';
import { TaskBoard } from '@/components/ui/TaskBoard';
import { TaskModal } from '@/components/ui/TaskModal';
import { Task, Profile, useTasks, useProfiles } from '@/lib/hrData';
import { ClipboardList } from 'lucide-react';

export default function HRTasksPage() {
  const { data: tasks = [], refetch: refetchTasks } = useTasks();
  const { data: employees = [] } = useProfiles();
  const [isTaskOpen, setIsTaskOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Task Management</h1>
          <p className="text-slate-500">Create, assign, and track tasks across all teams.</p>
        </div>
        <button
          onClick={() => setIsTaskOpen(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-colors transition-transform transition-shadow flex items-center gap-1.5 shadow-sm"
        >
          <ClipboardList className="h-4 w-4" /> Assign New Task
        </button>
      </div>

      <TaskBoard
        tasks={tasks}
        onUpdate={() => refetchTasks()}
        canDelete={true}
        readOnly={false}
      />

      <TaskModal
        isOpen={isTaskOpen}
        onClose={() => setIsTaskOpen(false)}
        employees={employees.filter((e: Profile) => e.role === 'employee' || e.isTeamLead)}
        createdBy="hr"
        onTaskAdded={() => refetchTasks()}
      />
    </div>
  );
}
