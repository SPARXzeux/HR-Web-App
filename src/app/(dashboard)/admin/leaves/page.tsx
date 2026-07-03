'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { db, LeaveApplication } from '@/lib/db';
import { CheckCircle2, ShieldCheck, List } from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  'PTO': 'bg-blue-100 text-blue-800',
  'Sick Leave': 'bg-amber-100 text-amber-800',
  'Urgent': 'bg-rose-100 text-rose-800',
};

const STATUS_BADGE_MAP: Record<LeaveApplication['status'], { variant: 'success' | 'warning' | 'danger' | 'default'; label: string }> = {
  pending:     { variant: 'warning', label: 'Pending'      },
  hr_approved: { variant: 'default', label: 'HR Approved'  },
  approved:    { variant: 'success', label: 'CEO Approved' },
  rejected:    { variant: 'danger',  label: 'Rejected'     },
};

type TabView = 'queue' | 'history';

export default function AdminLeavesPage() {
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState<TabView>('queue');
  const [histFilter, setHistFilter] = useState<LeaveApplication['status'] | 'all'>('all');
  const [histType, setHistType] = useState<'all' | 'PTO' | 'Sick Leave' | 'Urgent'>('all');

  useEffect(() => {
    setLeaves(db.getLeaves());
    const handleSearch = (e: Event) => setSearchQuery((e as CustomEvent).detail || '');
    window.addEventListener('globalSearch', handleSearch);
    return () => window.removeEventListener('globalSearch', handleSearch);
  }, []);

  const handleCEOAction = (id: string, action: 'approve' | 'reject') => {
    const updated: LeaveApplication[] = leaves.map(l => {
      if (l.id !== id) return l;
      const nextStatus: LeaveApplication['status'] = action === 'approve' ? 'approved' : 'rejected';
      const employees = db.getEmployees();
      const emp = employees.find(e => e.fullName === l.employeeName);
      if (emp) {
        db.addNotification(emp.email, 'employee', `Your leave (${l.duration.split(' - ')[0]}) was ${action === 'approve' ? 'approved' : 'rejected'} by the CEO.`);
      }
      db.addNotification('all', 'hr', `CEO ${action === 'approve' ? 'Approved' : 'Rejected'} leave for ${l.employeeName}.`);
      return { ...l, status: nextStatus };
    });
    setLeaves(updated);
    db.saveLeaves(updated);
    setSuccessMsg(`Leave ${action === 'approve' ? 'approved' : 'rejected'} by CEO!`);
    setTimeout(() => setSuccessMsg(''), 1500);
  };

  const stats = {
    total: leaves.length,
    pending: leaves.filter(l => l.status === 'pending').length,
    hrApproved: leaves.filter(l => l.status === 'hr_approved').length,
    approved: leaves.filter(l => l.status === 'approved').length,
    rejected: leaves.filter(l => l.status === 'rejected').length,
  };

  const pendingCEOLeaves = leaves.filter(l =>
    l.status === 'hr_approved' &&
    (l.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
     l.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
     l.reason.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const historyLeaves = leaves.filter(l =>
    (histFilter === 'all' || l.status === histFilter) &&
    (histType === 'all' || l.type === histType) &&
    (searchQuery === '' ||
      l.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.reason.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leave Approvals</h1>
          <p className="text-slate-500 text-sm">Final CEO decisions on HR-approved leaves. See full org history in the History tab.</p>
        </div>
        {successMsg && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-in fade-in duration-150 shadow-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />{successMsg}
          </div>
        )}
      </div>

      {/* Stat overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Requests', value: stats.total,      bg: 'bg-slate-50 border-slate-200',         text: 'text-slate-700'   },
          { label: 'Pending',        value: stats.pending,    bg: 'bg-amber-50 border-amber-200',          text: 'text-amber-700'   },
          { label: 'Awaiting CEO',   value: stats.hrApproved, bg: 'bg-blue-50 border-blue-200',            text: 'text-blue-700'    },
          { label: 'Approved',       value: stats.approved,   bg: 'bg-emerald-50 border-emerald-200',      text: 'text-emerald-700' },
          { label: 'Rejected',       value: stats.rejected,   bg: 'bg-rose-50 border-rose-200',            text: 'text-rose-700'    },
        ].map(s => (
          <Card key={s.label} className={`border ${s.bg}`}>
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-all ${
            activeTab === 'queue'
              ? 'border-orange-500 text-orange-700 bg-orange-50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="h-4 w-4" /> CEO Approval Queue
          {stats.hrApproved > 0 && (
            <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{stats.hrApproved}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-all ${
            activeTab === 'history'
              ? 'border-orange-500 text-orange-700 bg-orange-50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <List className="h-4 w-4" /> Full History
        </button>
      </div>

      {/* ── CEO QUEUE TAB ── */}
      {activeTab === 'queue' && (
        <Card className="overflow-hidden p-0 border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-sm text-left border-collapse">
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
                {pendingCEOLeaves.map(leave => (
                  <tr key={leave.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">{leave.employeeName}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_COLORS[leave.type] || ''}`}>{leave.type}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium text-xs">{leave.duration}</td>
                    <td className="px-6 py-4 text-slate-500 max-w-xs truncate text-xs">{leave.reason}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleCEOAction(leave.id, 'approve')} className="text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded transition-all active:scale-97">
                          CEO Approve
                        </button>
                        <button onClick={() => handleCEOAction(leave.id, 'reject')} className="text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded transition-all active:scale-97">
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingCEOLeaves.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400 font-semibold italic text-sm">
                      No leaves waiting for CEO approval.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <select
              value={histFilter}
              onChange={e => setHistFilter(e.target.value as LeaveApplication['status'] | 'all')}
              className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="hr_approved">HR Approved</option>
              <option value="approved">CEO Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={histType}
              onChange={e => setHistType(e.target.value as typeof histType)}
              className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
            >
              <option value="all">All Types</option>
              <option value="PTO">PTO</option>
              <option value="Sick Leave">Sick Leave</option>
              <option value="Urgent">Urgent</option>
            </select>
            <span className="text-xs text-slate-400 font-semibold self-center">{historyLeaves.length} records</span>
          </div>

          <Card className="overflow-hidden p-0 border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-sm text-left border-collapse">
                <thead className="text-xs font-bold text-slate-550 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-4">Employee</th>
                    <th className="px-5 py-4">Type</th>
                    <th className="px-5 py-4">Dates</th>
                    <th className="px-5 py-4">Reason</th>
                    <th className="px-5 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyLeaves.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{l.employeeName}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_COLORS[l.type] || 'bg-slate-100 text-slate-600'}`}>{l.type}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium text-xs">{l.duration}</td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs max-w-[200px] truncate">{l.reason}</td>
                      <td className="px-5 py-3.5 text-center">
                        <Badge variant={STATUS_BADGE_MAP[l.status].variant}>{STATUS_BADGE_MAP[l.status].label}</Badge>
                      </td>
                    </tr>
                  ))}
                  {historyLeaves.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400 font-semibold italic text-sm">
                        No records match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
