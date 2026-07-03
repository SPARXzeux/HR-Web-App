'use client';

import React, { useState, useEffect } from 'react';
import { TaskBoard } from '@/components/ui/TaskBoard';
import { TaskModal } from '@/components/ui/TaskModal';
import { Modal } from '@/components/ui/Modal';
import { db, Task, Profile } from '@/lib/db';
import { ClipboardList, Star, CheckCircle2, UserCog } from 'lucide-react';

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [isTaskOpen, setIsTaskOpen] = useState(false);
  const [isLeadOpen, setIsLeadOpen] = useState(false);

  // Team Lead modal state
  const [leadEmpId, setLeadEmpId] = useState('');
  const [leadTeams, setLeadTeams] = useState<string[]>([]);
  const [leadSuccess, setLeadSuccess] = useState('');

  useEffect(() => {
    setTasks(db.getTasks());
    setEmployees(db.getEmployees());
    setTeams(db.getTeams());
  }, []);

  const handleSaveLead = () => {
    if (!leadEmpId) return;
    db.setTeamLead(leadEmpId, leadTeams);
    const updated = db.getEmployees();
    setEmployees(updated);
    const emp = updated.find(e => e.id === leadEmpId);
    setLeadSuccess(`${emp?.fullName} — team lead updated!`);
    setTimeout(() => { setIsLeadOpen(false); setLeadSuccess(''); setLeadEmpId(''); setLeadTeams([]); }, 1300);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Task Overview</h1>
          <p className="text-slate-500">Assign and monitor tasks across all departments and teams.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setIsLeadOpen(true)}
            className="bg-white hover:bg-amber-50 border border-amber-200 text-amber-700 font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all flex items-center gap-1.5"
          >
            <Star className="h-4 w-4" /> Manage Team Leads
          </button>
          <button
            onClick={() => setIsTaskOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <ClipboardList className="h-4 w-4" /> Assign New Task
          </button>
        </div>
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
        createdBy="admin"
        onTaskAdded={task => setTasks(prev => [task, ...prev])}
      />

      {/* Team Lead Management Modal */}
      <Modal isOpen={isLeadOpen} onClose={() => setIsLeadOpen(false)} title="Manage Team Leads">
        <div className="space-y-4">
          {leadSuccess && (
            <div className="p-3 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />{leadSuccess}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Select Employee</label>
            <select
              value={leadEmpId}
              onChange={e => {
                setLeadEmpId(e.target.value);
                const emp = employees.find(em => em.id === e.target.value);
                setLeadTeams(emp?.leadTeams || []);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
            >
              <option value="">— Select employee —</option>
              {employees.filter(e => e.role === 'employee').map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} {emp.isTeamLead ? '⭐ (Lead)' : ''} — {emp.teams.join(', ') || 'No team'}
                </option>
              ))}
            </select>
          </div>

          {leadEmpId && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Lead of Teams</label>
              {teams.map(t => (
                <label key={t} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={leadTeams.includes(t)}
                    onChange={() => setLeadTeams(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                    className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{t}</span>
                </label>
              ))}
            </div>
          )}

          {/* Current leads list */}
          <div className="border-t border-slate-200 pt-4 space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Team Leads</p>
            {employees.filter(e => e.isTeamLead && (e.leadTeams?.length ?? 0) > 0).map(emp => (
              <div key={emp.id} className="flex items-center justify-between text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <span className="font-semibold text-slate-800">⭐ {emp.fullName}</span>
                <span className="text-amber-700 font-semibold">{emp.leadTeams?.join(', ')}</span>
              </div>
            ))}
            {employees.filter(e => e.isTeamLead && (e.leadTeams?.length ?? 0) > 0).length === 0 && (
              <p className="text-xs text-slate-400 italic">No team leads assigned yet.</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button onClick={() => setIsLeadOpen(false)} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all">Cancel</button>
            <button onClick={handleSaveLead} disabled={!leadEmpId} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all shadow-sm">Save</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
