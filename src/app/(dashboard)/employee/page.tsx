'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Clock, CheckCircle2, ChevronRight, AlertTriangle, Briefcase, Calendar, User, Flag } from 'lucide-react';
import { db, LeaveApplication, Profile, Task } from '@/lib/db';

const PRIORITY_STYLES: Record<Task['priority'], string> = {
  high:   'bg-rose-100 text-rose-800 border-rose-200',
  medium: 'bg-orange-100 text-orange-800 border-orange-200',
  low:    'bg-slate-100 text-slate-650 border-slate-200',
};

const STATUS_STYLES: Record<Task['status'], string> = {
  todo:        'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  done:        'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const STATUS_LABELS: Record<Task['status'], string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  done:        'Done',
};

export default function EmployeeDashboard() {
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Detailed Task Modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    const email = localStorage.getItem('user_email');
    const employees = db.getEmployees();
    const profile = employees.find(e => e.email === email);
    if (profile) {
      setUserProfile(profile);
    }
    
    const allLeaves = db.getLeaves();
    const allTasks = db.getTasks();
    if (profile) {
      setLeaves(allLeaves.filter(l => l.employeeName === profile.fullName));
      setMyTasks(allTasks.filter(t => t.assignedEmail === profile.email));
    }

    const handleSearch = (e: Event) => {
      setSearchQuery((e as CustomEvent).detail || '');
    };
    window.addEventListener('globalSearch', handleSearch);
    return () => window.removeEventListener('globalSearch', handleSearch);
  }, []);

  const handleUpdateTaskStatus = (taskId: string, nextStatus: Task['status']) => {
    const updated = db.updateTaskStatus(taskId, nextStatus);
    const email = localStorage.getItem('user_email');
    setMyTasks(updated.filter(t => t.assignedEmail === email));
    setSelectedTask(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'hr_approved':
        return <Badge variant="default">HR Approved</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Dashboard</h1>
          <p className="text-slate-500">Welcome back, {userProfile?.fullName || 'Employee'}. Here is your overview.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">PTO Balance</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">12 Days</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">Sick Leave</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">5 Days</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">Next Payroll</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">Jul 31</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Tasks Section */}
      {myTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900 mt-2">My Tasks</h2>
          <div className="grid grid-cols-1 gap-3">
            {myTasks.map(task => {
              const isOverdue = task.status !== 'done' && new Date(task.dueDate) < new Date();
              const isDueSoon = !isOverdue && task.status !== 'done' && (new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24) <= 3;

              return (
                <Card 
                  key={task.id} 
                  onClick={() => setSelectedTask(task)}
                  className={`p-4 border transition-all cursor-pointer hover:border-orange-350 hover:shadow-sm group ${isOverdue ? 'border-rose-250 bg-rose-50/10' : task.status === 'done' ? 'opacity-70 border-emerald-100' : 'border-slate-200'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`font-bold text-sm text-slate-900 ${task.status === 'done' ? 'line-through opacity-50' : ''}`}>{task.title}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
                        {isOverdue && <span className="text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full">OVERDUE</span>}
                        {isDueSoon && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">DUE SOON</span>}
                      </div>
                      {task.description && <p className="text-xs text-slate-500 mb-1.5 line-clamp-1">{task.description}</p>}
                      <p className="text-[10px] text-slate-400 font-semibold">📅 Due: {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {task.team}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${STATUS_STYLES[task.status]}`}>{STATUS_LABELS[task.status]}</span>
                      <ChevronRight className="h-4 w-4 text-slate-350 group-hover:text-orange-500 transition-colors" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">Recent Leave Requests</h2>
      <Card className="overflow-hidden p-0 border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm text-left border-collapse">
            <thead className="text-xs font-bold text-slate-550 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {leaves
                .filter(l => 
                  l.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  l.reason.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((leave) => (
                  <tr key={leave.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">{leave.type}</td>
                    <td className="px-6 py-4 text-slate-650">{leave.duration}</td>
                    <td className="px-6 py-4 text-slate-500">{leave.reason}</td>
                    <td className="px-6 py-4">{getStatusBadge(leave.status)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Task Detail Modal */}
      {selectedTask && (
        <Modal isOpen onClose={() => setSelectedTask(null)} title="Task Details">
          <div className="space-y-4">
            <div className="flex gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[selectedTask.priority]}`}>
                {selectedTask.priority} priority
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[selectedTask.status]}`}>
                {STATUS_LABELS[selectedTask.status]}
              </span>
            </div>
            
            <div>
              <h3 className="font-bold text-lg text-slate-900">{selectedTask.title}</h3>
              {selectedTask.description && (
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{selectedTask.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
              <div>
                <p className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Due Date</p>
                <p className="font-semibold text-slate-800 mt-0.5">{new Date(selectedTask.dueDate).toLocaleDateString('en-US', { dateStyle: 'medium' })}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Department</p>
                <p className="font-semibold text-slate-800 mt-0.5">{selectedTask.team}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
              {selectedTask.status === 'todo' && (
                <button
                  onClick={() => handleUpdateTaskStatus(selectedTask.id, 'in_progress')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-xs"
                >
                  Start Task
                </button>
              )}
              {selectedTask.status === 'in_progress' && (
                <button
                  onClick={() => handleUpdateTaskStatus(selectedTask.id, 'done')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-xs"
                >
                  Mark Completed
                </button>
              )}
              <button
                onClick={() => setSelectedTask(null)}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
