'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { db, LeaveApplication, Profile } from '@/lib/db';
import { Clock, PlusCircle, CheckCircle2, AlertCircle, HelpCircle, BadgeCheck } from 'lucide-react';

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

  // Cashout simulator state
  const [cashoutDays, setCashoutDays] = useState(0);
  const [simRollover, setSimRollover] = useState(0);

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

  // Sync cashout days input limit with remaining PTO balance
  const remainingPTO = userProfile ? db.getRemainingPTO(userProfile.fullName, userProfile.joinedDate) : 0;
  useEffect(() => {
    if (remainingPTO > 0) {
      setCashoutDays(Math.floor(remainingPTO));
      setSimRollover(Math.max(0, Math.min(5, Math.floor(remainingPTO - Math.floor(remainingPTO)))));
    }
  }, [remainingPTO]);

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

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24)) + 1;

    // 1. Parental Leave Validations
    if (leaveType === 'parental_leave') {
      if (!userProfile) return;
      if (userProfile.gender !== 'female') {
        setError('Parental leave is only available to female employees.');
        return;
      }
      const tenure = db.calculateTenure(userProfile.joinedDate);
      if (tenure.totalMonths < 12) {
        setError('Parental leave requires at least 1 year (12 months) of continuous service at DelCargo.');
        return;
      }
      if (diffDays !== 30) {
        setError('Parental leave requests must be submitted for exactly 30 days.');
        return;
      }
    }

    // 2. PTO Validations
    if (leaveType === 'pto') {
      // Must be exactly 1 day
      if (diffDays !== 1) {
        setError('PTO requests can only be taken for exactly 1 day.');
        return;
      }

      // Must be submitted at least 14 days (2 weeks) in advance
      const today = new Date();
      today.setHours(0,0,0,0);
      start.setHours(0,0,0,0);
      const differenceInTime = start.getTime() - today.getTime();
      const differenceInDays = differenceInTime / (1000 * 3600 * 24);
      if (differenceInDays < 14) {
        setError('PTO requests must be submitted at least 14 days (2 weeks) in advance.');
        return;
      }

      // Check remaining balance
      if (remainingPTO < 1) {
        setError('Insufficient accrued PTO balance remaining.');
        return;
      }

      // Only 1 PTO request per calendar month
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
      type: leaveType === 'pto' ? 'PTO' : leaveType === 'sick' ? 'Sick Leave' : leaveType === 'parental_leave' ? 'Parental Leave' : 'Urgent',
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

  const filteredLeaves = leaves.filter(l =>
    l.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.duration.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Accurate PTO stats
  const accruedPTO = userProfile ? db.calculatePTOAccrued(userProfile.joinedDate) : 0;
  const takenPTO = leaves
    .filter(l => l.type === 'PTO' && l.status === 'approved')
    .reduce((acc, l) => {
      const dates = db.parseLeaveDates(l.duration);
      if (!dates) return acc + 1;
      return acc + (Math.ceil(Math.abs(dates.end.getTime() - dates.start.getTime()) / (1000 * 3600 * 24)) + 1);
    }, 0);

  // Settlement computations
  const currentBaseSalary = userProfile ? db.calculateCurrentSalary(userProfile) : 0;
  const ptoDailyRate = Math.round(currentBaseSalary / 22);
  const potentialCashoutVal = Math.max(0, cashoutDays * ptoDailyRate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-slate-900">My Leave Requests</h1>
          <p className="text-xs md:text-sm text-slate-500">View accrued time-off metrics and submit applications.</p>
        </div>
        <button
          onClick={() => setIsLeaveOpen(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2.5 md:py-2 rounded-lg text-sm active:scale-97 transition-all flex items-center gap-1.5 shadow-sm"
        >
          <PlusCircle className="h-4.5 w-4.5" /> Apply for Leave
        </button>
      </div>

      {/* Dynamic PTO balances */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-slate-200">
          <CardContent className="pt-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remaining PTO Bank</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">{remainingPTO} Days</p>
            <p className="text-[10px] text-slate-400 mt-1">Capped at 30 days maximum ceiling</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="pt-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Accrued PTO</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{accruedPTO} Days</p>
            <p className="text-[10px] text-slate-400 mt-1">Accumulated at individual anniversary dates</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="pt-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Approved PTO Taken</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{takenPTO} Days</p>
            <p className="text-[10px] text-slate-400 mt-1">Reflected upon official CEO validation</p>
          </CardContent>
        </Card>
      </div>

      {/* Jan 31 Settlement Simulator */}
      <Card className="border border-slate-200 bg-slate-50/50">
        <div className="px-5 pt-4 pb-1 border-b border-slate-200 bg-white">
          <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
            <BadgeCheck className="h-4 w-4 text-orange-600" />
            January 31st Settlement & Cash Out Simulator
          </h3>
        </div>
        <CardContent className="p-5 space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Simulate your end-of-cycle options. You can roll over up to <strong>5 unused PTO days</strong> to the next year and cash out the rest.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
            <div className="space-y-1">
              <label className="text-slate-500 uppercase tracking-wider text-[10px]">Cash Out Days</label>
              <input
                type="number"
                min={0}
                max={Math.floor(remainingPTO)}
                value={cashoutDays}
                onChange={e => {
                  const val = Math.max(0, Math.min(Math.floor(remainingPTO), Number(e.target.value)));
                  setCashoutDays(val);
                  setSimRollover(Math.max(0, Math.min(5, Math.floor(remainingPTO - val))));
                }}
                className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-slate-850"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-500 uppercase tracking-wider text-[10px]">Rolled Over Days</label>
              <p className="bg-white border border-slate-200 rounded-lg py-2 px-3 text-slate-850 font-mono">
                {simRollover} Days (Max 5)
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-slate-500 uppercase tracking-wider text-[10px]">Calculated Payout</label>
              <p className="bg-white border border-slate-200 rounded-lg py-2 px-3 text-emerald-800 font-mono font-bold">
                PKR {potentialCashoutVal.toLocaleString()}
              </p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold">
            Based on: Daily rate (PKR {ptoDailyRate.toLocaleString()}) = Monthly Salary (PKR {currentBaseSalary.toLocaleString()}) ÷ 22 days.
          </p>
        </CardContent>
      </Card>

      {/* History log */}
      <Card className="overflow-hidden p-0 border border-slate-200">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm text-left border-collapse">
            <thead className="text-xs font-bold text-slate-550 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
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
                  <td className="px-6 py-4 text-slate-650 font-medium">{leave.duration}</td>
                  <td className="px-6 py-4 text-slate-500">{leave.reason}</td>
                  <td className="px-6 py-4 text-center">{getStatusBadge(leave.status)}</td>
                </tr>
              ))}
              {filteredLeaves.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-slate-400 font-semibold italic text-xs">
                    No leave requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Mobile card stack */}
        <div className="md:hidden space-y-2 p-3">
          {filteredLeaves.map(leave => (
            <div key={leave.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">{leave.type}</p>
                {getStatusBadge(leave.status)}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Dates</p>
                  <p className="text-xs font-semibold text-slate-700">{leave.duration}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Reason</p>
                  <p className="text-xs font-semibold text-slate-700">{leave.reason}</p>
                </div>
              </div>
            </div>
          ))}
          {filteredLeaves.length === 0 && (
            <p className="text-center py-12 text-slate-400 font-semibold italic text-xs">No leave requests found</p>
          )}
        </div>
      </Card>

      {/* Apply modal */}
      <Modal isOpen={isLeaveOpen} onClose={() => setIsLeaveOpen(false)} title="Apply for Leave">
        <form onSubmit={handleLeaveSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-600 border border-rose-100 rounded-lg font-semibold flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              {success}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-555 uppercase tracking-wider">Leave Type</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
            >
              <option value="pto">PTO / Vacation</option>
              <option value="sick">Sick Leave</option>
              <option value="urgent">Urgent Leave</option>
              {userProfile?.gender === 'female' && (
                <option value="parental_leave">Parental Leave (30 Days)</option>
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-555 uppercase tracking-wider">Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-555 uppercase tracking-wider">End Date *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-555 uppercase tracking-wider">Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900 resize-none"
              placeholder="Provide explanation..."
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setIsLeaveOpen(false)} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2.5 md:py-2 rounded-lg text-sm active:scale-97 transition-all">Cancel</button>
            <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2.5 md:py-2 rounded-lg text-sm active:scale-97 transition-all shadow-sm">Submit Request</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
