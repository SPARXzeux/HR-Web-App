'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { db, LeaveApplication, Profile } from '@/lib/db';
import { Clock, PlusCircle, CheckCircle2 } from 'lucide-react';

export default function EmployeeLeavesPage() {
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userProfile, setUserProfile] = useState<Profile | null>(null);

  // Modal state
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [leaveType, setLeaveType] = useState('pto');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const email = localStorage.getItem('user_email');
    const employees = db.getEmployees();
    const profile = employees.find(e => e.email === email);
    if (profile) {
      setUserProfile(profile);
      const allLeaves = db.getLeaves();
      setLeaves(allLeaves.filter(l => l.employeeName === profile.fullName));
    }

    const handleSearch = (e: Event) => {
      setSearchQuery((e as CustomEvent).detail || '');
    };
    window.addEventListener('globalSearch', handleSearch);
    return () => window.removeEventListener('globalSearch', handleSearch);
  }, []);

  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!startDate || !endDate || !reason) {
      setError('Please fill in all required fields.');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      setError('End date cannot be before start date.');
      return;
    }

    if (leaveType === 'pto') {
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24)) + 1;
      if (diffDays !== 1) {
        setError('PTO requests can only be taken for exactly 1 day.');
        return;
      }
    }

    if (leaveType === 'pto') {
      const today = new Date();
      today.setHours(0,0,0,0);
      start.setHours(0,0,0,0);
      const differenceInTime = start.getTime() - today.getTime();
      const differenceInDays = differenceInTime / (1000 * 3600 * 24);
      if (differenceInDays < 14) {
        setError('PTO requests must be submitted at least 14 days in advance.');
        return;
      }
    }

    if (leaveType === 'pto') {
      const startMonth = start.getMonth();
      const startYear = start.getFullYear();
      const hasExistingPTO = leaves.some(l => {
        if (l.type !== 'PTO') return false;
        const existingStartStr = l.duration.split(' - ')[0];
        const existingStart = new Date(existingStartStr);
        return existingStart.getMonth() === startMonth && existingStart.getFullYear() === startYear;
      });
      if (hasExistingPTO) {
        setError('You can only apply for 1 PTO request per calendar month.');
        return;
      }
    }

    const formatDate = (date: Date) =>
      date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    const durationStr = `${formatDate(start)} - ${formatDate(end)}`;

    const newLeave: LeaveApplication = {
      id: `l_${Date.now()}`,
      employeeName: userProfile?.fullName || 'Employee',
      type: leaveType === 'pto' ? 'PTO' : leaveType === 'sick' ? 'Sick Leave' : 'Urgent',
      duration: durationStr,
      reason,
      status: 'pending'
    };

    const allLeaves = db.getLeaves();
    db.saveLeaves([newLeave, ...allLeaves]);
    db.addNotification('all', 'hr', `New ${newLeave.type} leave request from ${userProfile?.fullName || 'an employee'}.`);
    setLeaves(prev => [newLeave, ...prev]);
    setSuccess('Leave request submitted!');
    setTimeout(() => { setIsLeaveOpen(false); setLeaveType('pto'); setStartDate(''); setEndDate(''); setReason(''); setSuccess(''); }, 1400);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'hr_approved':
        return <Badge variant="default">HR Approved (Pending CEO)</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const totalLeaves = leaves.length;
  const pendingLeaves = leaves.filter(l => l.status === 'pending' || l.status === 'hr_approved').length;
  const approvedLeaves = leaves.filter(l => l.status === 'approved').length;
  const rejectedLeaves = leaves.filter(l => l.status === 'rejected').length;

  const filteredLeaves = leaves.filter(l =>
    l.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.duration.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Leave Requests</h1>
          <p className="text-slate-500">Manage and track your time-off applications.</p>
        </div>
        <button
          onClick={() => setIsLeaveOpen(true)}
          className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm active:scale-97 duration-150 text-sm"
        >
          <PlusCircle className="h-4 w-4" />
          Apply for Leave
        </button>
      </div>

      {/* Stat Summary Chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{totalLeaves}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">{pendingLeaves}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved</p>
                <p className="text-3xl font-bold text-emerald-600 mt-1">{approvedLeaves}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rejected</p>
                <p className="text-3xl font-bold text-rose-600 mt-1">{rejectedLeaves}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leave History Table */}
      <Card className="overflow-hidden p-0 border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm text-left border-collapse">
            <thead className="text-xs font-bold text-slate-500 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Dates</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLeaves.map(leave => (
                <tr key={leave.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-900">{leave.type}</td>
                  <td className="px-6 py-4 text-slate-600 font-medium">{leave.duration}</td>
                  <td className="px-6 py-4 text-slate-500">{leave.reason}</td>
                  <td className="px-6 py-4 text-center">{getStatusBadge(leave.status)}</td>
                </tr>
              ))}
              {filteredLeaves.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-slate-400 font-semibold italic">
                    No leave requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Apply for Leave Modal */}
      <Modal isOpen={isLeaveOpen} onClose={() => setIsLeaveOpen(false)} title="Apply for Leave">
        <form onSubmit={handleLeaveSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-600 border border-rose-100 rounded-lg font-semibold">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg font-semibold">
              {success}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Leave Type</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
            >
              <option value="pto">PTO / Vacation</option>
              <option value="sick">Sick Leave</option>
              <option value="urgent">Urgent Leave</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">End Date *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900 resize-none"
              placeholder="Provide a brief explanation for your leave..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsLeaveOpen(false)}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all shadow-sm"
            >
              Submit Request
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
