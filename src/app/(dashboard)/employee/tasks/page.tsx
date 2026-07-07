'use client';

import React, { useState, useEffect } from 'react';
import { TaskBoard } from '@/components/ui/TaskBoard';
import { db, Task, Profile } from '@/lib/db';
import { Badge } from '@/components/ui/Badge';
import { Users } from 'lucide-react';

export default function TeamLeadTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [teamFilter, setTeamFilter] = useState<'all' | 'my' | string>('all');

  useEffect(() => {
    const email = localStorage.getItem('user_email');
    const employees = db.getEmployees();
    const profile = employees.find(e => e.email && email && e.email.toLowerCase() === email.toLowerCase());
    if (profile) {
      setUserProfile(profile);
    }
    setTasks(db.getTasks());
  }, []);

  if (!userProfile?.isTeamLead) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
        <Users className="h-12 w-12 opacity-30" />
        <p className="font-semibold text-sm">You are not designated as a Team Lead.</p>
        <p className="text-xs">Contact HR to update your role.</p>
      </div>
    );
  }

  const leadTeams = userProfile.leadTeams || [];

  // Filter logic based on tab
  const visibleTasks = tasks.filter(t => {
    if (teamFilter === 'my') return t.assignedEmail === userProfile.email;
    if (teamFilter === 'all') return leadTeams.includes(t.team);
    return t.team === teamFilter; // specific team tab
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Team Tasks</h1>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <p className="text-slate-500 text-sm">You are Team Lead of:</p>
          {leadTeams.map(t => (
            <Badge key={t} variant="default" className="text-xs">⭐ {t}</Badge>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTeamFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            teamFilter === 'all' ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All Teams ({leadTeams.join(', ')})
        </button>
        <button
          onClick={() => setTeamFilter('my')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            teamFilter === 'my' ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Assigned To Me
        </button>
        {leadTeams.map(t => (
          <button
            key={t}
            onClick={() => setTeamFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              teamFilter === t ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t} Team
          </button>
        ))}
      </div>

      <TaskBoard
        tasks={visibleTasks}
        onUpdate={updated => setTasks(updated)}
        canDelete={false}
        readOnly={false}
      />
    </div>
  );
}
