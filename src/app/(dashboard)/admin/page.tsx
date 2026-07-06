'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { OrgCalendar } from '@/components/ui/OrgCalendar';
import { TaskModal } from '@/components/ui/TaskModal';
import { DollarSign, TrendingUp, Users, Clock, ClipboardList, CheckCircle2, AlertTriangle, PlusCircle } from 'lucide-react';
import { db, LeaveApplication, Profile, Task } from '@/lib/db';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isTaskOpen, setIsTaskOpen] = useState(false);

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [isAnnounceOpen, setIsAnnounceOpen] = useState(false);

  // Announcement form states
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annTargetType, setAnnTargetType] = useState<'all' | 'usa' | 'pakistan' | 'warehouses'>('all');
  const [annSelectedWarehouses, setAnnSelectedWarehouses] = useState<string[]>([]);
  const [annSuccess, setAnnSuccess] = useState('');

  useEffect(() => {
    setEmployees(db.getEmployees());
    setLeaves(db.getLeaves());
    setTasks(db.getTasks());
    setAnnouncements(db.getAnnouncements());
    setWarehouses(db.getWarehouses());
  }, []);

  const handleAnnouncementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;

    const targetVal = annTargetType === 'warehouses' ? annSelectedWarehouses : annTargetType;
    db.addAnnouncement(annTitle, annContent, targetVal, 'CEO Admin');
    setAnnouncements(db.getAnnouncements());
    setAnnSuccess('Announcement posted successfully!');

    setTimeout(() => {
      setIsAnnounceOpen(false);
      setAnnTitle('');
      setAnnContent('');
      setAnnTargetType('all');
      setAnnSelectedWarehouses([]);
      setAnnSuccess('');
    }, 1200);
  };

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
    <div className="space-y-6 px-4 py-4 md:px-0 md:py-0 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-slate-900">Admin Overview</h1>
          <p className="text-xs md:text-sm text-slate-500">High-level metrics, leave approvals, and organisation calendar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsAnnounceOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 md:py-2 rounded-lg text-xs md:text-sm active:scale-97 transition-all flex items-center gap-1.5 shadow-sm min-h-[44px] md:min-h-0"
          >
            <PlusCircle className="h-4 w-4" /> Post Announcement
          </button>
          <button
            onClick={() => setIsTaskOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2.5 md:py-2 rounded-lg text-xs md:text-sm active:scale-97 transition-all flex items-center gap-1.5 shadow-sm min-h-[44px] md:min-h-0"
          >
            <ClipboardList className="h-4 w-4" /> Assign Task
          </button>
          <button
            onClick={() => router.push('/admin/tasks')}
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2.5 md:py-2 rounded-lg text-xs md:text-sm active:scale-97 transition-all min-h-[44px] md:min-h-0"
          >
            View All Tasks
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="pt-4 md:pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs font-semibold text-slate-500">Monthly Payroll</p>
                <p className="text-base md:text-2xl font-bold text-slate-900 mt-1">PKR {(totalPayroll).toLocaleString()}</p>
              </div>
              <div className="h-10 w-10 md:h-11 md:w-11 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs font-semibold text-slate-500">Total Employees</p>
                <p className="text-base md:text-2xl font-bold text-slate-900 mt-1">{employees.length}</p>
              </div>
              <div className="h-10 w-10 md:h-11 md:w-11 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs font-semibold text-slate-500">Awaiting CEO Approval</p>
                <p className="text-base md:text-2xl font-bold text-slate-900 mt-1">{hrApprovedLeaves.length}</p>
              </div>
              <div className="h-10 w-10 md:h-11 md:w-11 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs font-semibold text-slate-500">High Priority Tasks</p>
                <p className="text-base md:text-2xl font-bold text-slate-900 mt-1">{highPriorityTasks}</p>
                <p className="text-[10px] text-slate-400">{activeTasks} total active</p>
              </div>
              <div className="h-10 w-10 md:h-11 md:w-11 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Org Calendar */}
      <Card className="p-0">
        <div className="px-4 md:px-6 pt-5 pb-2 border-b border-slate-100">
          <h2 className="text-sm md:text-base font-bold text-slate-900">Organisation Calendar</h2>
          <p className="text-xs text-slate-500 mt-0.5">Leave schedules, task deadlines, and conflict indicators across all departments.</p>
        </div>
        <div className="p-4 md:p-6">
          <OrgCalendar leaves={leaves} tasks={tasks} employees={employees} />
        </div>
      </Card>

      {/* Announcements Panel */}
      <Card className="p-0">
        <div className="px-4 md:px-6 pt-5 pb-2 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-sm md:text-base font-bold text-slate-900">Recent Announcements</h2>
            <p className="text-xs text-slate-500 mt-0.5">Corporate updates and targeted broadcast messages.</p>
          </div>
        </div>
        <CardContent className="p-4 md:p-6 space-y-4">
          {announcements.map(ann => (
            <div key={ann.id} className="p-4 rounded-xl border border-slate-150 bg-slate-50/50 flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 text-sm">{ann.title}</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{ann.content}</p>
                </div>
                <Badge variant={ann.target === 'all' ? 'default' : 'warning'} className="self-start shrink-0">
                  Target: {Array.isArray(ann.target) 
                    ? `Warehouses (${ann.target.map((tId: string) => warehouses.find(w => w.id === tId)?.name || tId).join(', ')})`
                    : ann.target.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mt-3 pt-2 border-t border-slate-100">
                <span>By {ann.createdBy}</span>
                <span>{ann.timestamp}</span>
              </div>
            </div>
          ))}
          {announcements.length === 0 && (
            <p className="text-xs text-slate-400 font-semibold italic text-center py-4">No announcements posted yet.</p>
          )}
        </CardContent>
      </Card>

      {/* CEO Leave Approval Queue */}
      <div className="space-y-3">
        <h2 className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
          Pending CEO Approval
          {hrApprovedLeaves.length > 0 && (
            <span className="bg-amber-100 text-amber-800 font-bold text-[10px] px-2 py-0.5 rounded-full">{hrApprovedLeaves.length} pending</span>
          )}
        </h2>

        <Card className="overflow-hidden p-0 border border-slate-200">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
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

          {/* Mobile card stack */}
          <div className="md:hidden">
            {hrApprovedLeaves.length === 0 ? (
              <p className="py-10 text-center text-slate-400 font-semibold italic text-sm">No pending approvals — all leaves are processed.</p>
            ) : (
              <div className="space-y-3 p-4">
                {hrApprovedLeaves.map(l => (
                  <div key={l.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-900">{l.employeeName}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">{l.type}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">Dates</p>
                        <p className="text-xs font-bold text-slate-800">{l.duration}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">Reason</p>
                        <p className="text-xs font-bold text-slate-800 truncate">{l.reason}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => handleCEOAction(l.id, 'approve')} className="flex-1 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 py-2.5 rounded-lg transition-all active:scale-97">
                        CEO Approve
                      </button>
                      <button onClick={() => handleCEOAction(l.id, 'reject')} className="flex-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 py-2.5 rounded-lg transition-all active:scale-97">
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Announcement Modal */}
      <Modal isOpen={isAnnounceOpen} onClose={() => setIsAnnounceOpen(false)} title="Create New Announcement">
        <form onSubmit={handleAnnouncementSubmit} className="space-y-4 pt-1">
          {annSuccess && (
            <div className="p-3 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> {annSuccess}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Announcement Title *</label>
            <input 
              type="text" 
              required 
              value={annTitle} 
              onChange={e => setAnnTitle(e.target.value)} 
              className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold" 
              placeholder="e.g. System Maintenance Notice" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Content *</label>
            <textarea 
              required 
              rows={4} 
              value={annContent} 
              onChange={e => setAnnContent(e.target.value)} 
              className="w-full bg-slate-50/50 hover:bg-slate-55 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold resize-none" 
              placeholder="Type announcement details here..." 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Audience *</label>
            <select
              value={annTargetType}
              onChange={e => setAnnTargetType(e.target.value as any)}
              className="w-full bg-slate-50/50 hover:bg-slate-55 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold cursor-pointer"
            >
              <option value="all">All Employees</option>
              <option value="usa">USA Employees Only</option>
              <option value="pakistan">Pakistani Employees (Remote) Only</option>
              <option value="warehouses">Specific Warehouses</option>
            </select>
          </div>

          {annTargetType === 'warehouses' && (
            <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-36 overflow-y-auto">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Select Warehouses</label>
              <div className="space-y-1.5">
                {warehouses.map(wh => (
                  <label key={wh.id} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={annSelectedWarehouses.includes(wh.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setAnnSelectedWarehouses(prev => [...prev, wh.id]);
                        } else {
                          setAnnSelectedWarehouses(prev => prev.filter(id => id !== wh.id));
                        }
                      }}
                      className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    {wh.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setIsAnnounceOpen(false)} className="bg-white hover:bg-slate-55 border border-slate-200 text-slate-655 hover:text-slate-800 font-bold px-4 py-2.5 md:py-2 rounded-xl text-xs active:scale-97 transition-all">Cancel</button>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 md:py-2 rounded-xl text-xs active:scale-97 transition-all shadow-sm">Post Announcement</button>
          </div>
        </form>
      </Modal>

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
