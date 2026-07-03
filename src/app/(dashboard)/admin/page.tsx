'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { OrgCalendar } from '@/components/ui/OrgCalendar';
import { TaskModal } from '@/components/ui/TaskModal';
import { DollarSign, TrendingUp, Users, Clock, ClipboardList, CheckCircle2, AlertTriangle } from 'lucide-react';
import { db, LeaveApplication, Profile, Task } from '@/lib/db';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isTaskOpen, setIsTaskOpen] = useState(false);

  useEffect(() => {
    setEmployees(db.getEmployees());
    setLeaves(db.getLeaves());
    setTasks(db.getTasks());
  }, []);

  const handleCEOAction = (id: string, action: 'approve' | 'reject') => {
    const updated: LeaveApplication[] = leaves.map(l => {
      if (l.id !== id) return l;
      const nextStatus: LeaveApplication['status'] = action === 'approve' ? 'approved' : 'rejected';
      const employees = db.getEmployees();
      const emp = employees.find(e => e.fullName === l.employeeName);
      if (emp) db.addNotification(emp.email, 'employee', `Your leave (${l.duration.split(' - ')[0]}) was ${action === 'approve' ? 'approved' : 'rejected'} by CEO.`);
      db.addNotification('all', 'hr', `CEO ${action === 'approve' ? 'approved' : 'rejected'} leave for ${l.employeeName}.`);
      return { ...l, status: nextStatus };
    });
    setLeaves(updated);
    db.saveLeaves(updated);
  };

  // Derived stats
  const totalPayroll = employees.reduce((acc, emp) => acc + db.calculateCurrentSalary(emp), 0);
  const hrApprovedLeaves = leaves.filter(l => l.status === 'hr_approved');
  const activeTasks = tasks.filter(t => t.status !== 'done').length;
  const highPriorityTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'done').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Overview</h1>
          <p className="text-slate-500">High-level metrics, leave approvals, and organisation calendar.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsTaskOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <ClipboardList className="h-4 w-4" /> Assign Task
          </button>
          <button
            onClick={() => router.push('/admin/tasks')}
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all"
          >
            View All Tasks
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Monthly Payroll</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">PKR {(totalPayroll).toLocaleString()}</p>
              </div>
              <div className="h-11 w-11 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Total Employees</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{employees.length}</p>
              </div>
              <div className="h-11 w-11 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Awaiting CEO Approval</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{hrApprovedLeaves.length}</p>
              </div>
              <div className="h-11 w-11 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">High Priority Tasks</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{highPriorityTasks}</p>
                <p className="text-[10px] text-slate-400">{activeTasks} total active</p>
              </div>
              <div className="h-11 w-11 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Org Calendar */}
      <Card className="p-0">
        <div className="px-6 pt-5 pb-2 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Organisation Calendar</h2>
          <p className="text-xs text-slate-500 mt-0.5">Leave schedules, task deadlines, and conflict indicators across all departments.</p>
        </div>
        <div className="p-6">
          <OrgCalendar leaves={leaves} tasks={tasks} employees={employees} />
        </div>
      </Card>

      {/* CEO Leave Approval Queue */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          Pending CEO Approval
          {hrApprovedLeaves.length > 0 && (
            <span className="bg-amber-100 text-amber-800 font-bold text-[10px] px-2 py-0.5 rounded-full">{hrApprovedLeaves.length} pending</span>
          )}
        </h2>

        <Card className="overflow-hidden p-0 border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-xs font-bold text-slate-550 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Dates</th>
                  <th className="px-6 py-4">Reason</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {hrApprovedLeaves.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">{l.employeeName}</td>
                    <td className="px-6 py-4">{l.type}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{l.duration}</td>
                    <td className="px-6 py-4 text-slate-500 max-w-xs truncate">{l.reason}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleCEOAction(l.id, 'approve')} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded transition-all active:scale-97">
                          CEO Approve
                        </button>
                        <button onClick={() => handleCEOAction(l.id, 'reject')} className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded transition-all active:scale-97">
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {hrApprovedLeaves.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-semibold italic text-sm">
                      No pending approvals — all leaves are processed.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Task Modal */}
      <TaskModal
        isOpen={isTaskOpen}
        onClose={() => setIsTaskOpen(false)}
        employees={employees.filter(e => e.role === 'employee' || e.isTeamLead)}
        createdBy="admin"
        onTaskAdded={task => setTasks(prev => [task, ...prev])}
      />
    </div>
  );
}
