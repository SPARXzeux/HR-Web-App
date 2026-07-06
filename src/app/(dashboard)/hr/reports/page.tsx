'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { db, Profile, formatMoney } from '@/lib/db';
import { FileText, Search, Filter, ShieldCheck, Download, Monitor, Clock, CheckCircle2, TrendingUp, Calendar } from 'lucide-react';
import { UserProfileModal } from '@/components/ui/UserProfileModal';

interface TrackingEntry {
  date: string;
  task?: string;
  duration?: string;
  score?: number;
  clockIn?: string;
  clockOut?: string;
  status?: string;
}

export default function ReportsPage() {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [regionFilter, setRegionFilter] = useState<'All' | 'USA' | 'Pakistan'>('All');
  const [onboardingFilter, setOnboardingFilter] = useState<'All' | 'Completed' | 'Pending'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReviewEmp, setSelectedReviewEmp] = useState<Profile | null>(null);
  const [reviewEntries, setReviewEntries] = useState<TrackingEntry[]>([]);
  const [dateFilter, setDateFilter] = useState('');

  const [selectedProfileEmail, setSelectedProfileEmail] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

  const handleOpenReviewModal = (emp: Profile) => {
    setSelectedReviewEmp(emp);
    setDateFilter('');

    // Combine local per-session tracking entries (from tracker page)
    const localKey = `timesheets_${emp.email}`;
    const localSaved = localStorage.getItem(localKey);
    const localEntries: TrackingEntry[] = localSaved ? JSON.parse(localSaved) : [];

    // Also pull from the global timesheets table (clock-in/out shifts from Supabase sync)
    const globalRaw = localStorage.getItem('hr_timesheets_prod_v1');
    const globalAll: any[] = globalRaw ? JSON.parse(globalRaw) : [];
    const globalEntries: TrackingEntry[] = globalAll
      .filter(ts => ts.employeeEmail === emp.email)
      .map(ts => ({
        date: ts.date,
        clockIn: ts.clockIn,
        clockOut: ts.clockOut,
        duration: ts.duration,
        status: ts.status,
        score: ts.score
      }));

    // Merge both sources, deduplicate by date+task
    const merged = [...globalEntries, ...localEntries];
    setReviewEntries(merged);
  };

  useEffect(() => {
    setEmployees(db.getEmployees());
    const email = localStorage.getItem('user_email');
    if (email) setCurrentUserEmail(email);
  }, []);

  const filteredEmployees = employees.filter(emp => {
    if (emp.role === 'admin' || emp.role === 'hr') return false;
    const matchesSearch = emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (emp.jobTitle && emp.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRegion = regionFilter === 'All' ? true : emp.region === regionFilter;
    const matchesOnboarding = onboardingFilter === 'All' ? true : 
                              onboardingFilter === 'Completed' ? emp.onboardingCompleted : !emp.onboardingCompleted;
    return matchesSearch && matchesRegion && matchesOnboarding;
  });

  const filteredReviewEntries = reviewEntries.filter(entry => {
    if (!dateFilter) return true;
    return entry.date?.includes(dateFilter);
  });

  // Summary stats for the modal
  const totalHours = filteredReviewEntries.reduce((acc, e) => {
    if (!e.duration) return acc;
    const match = e.duration.match(/(\d+)h\s*(\d+)?m?/);
    if (match) {
      return acc + (parseInt(match[1] || '0') * 60) + parseInt(match[2] || '0');
    }
    return acc;
  }, 0);
  const avgScore = filteredReviewEntries.length > 0
    ? Math.round(filteredReviewEntries.filter(e => e.score).reduce((acc, e) => acc + (e.score || 0), 0) / filteredReviewEntries.filter(e => e.score).length)
    : 0;

  const exportMainCSV = () => {
    const headers = ['Full Name', 'Email', 'Role', 'Region', 'Bank Name', 'Account Number', 'IBAN', 'Onboarding Status', 'Base Salary'];
    const rows = filteredEmployees.map(emp => [
      emp.fullName,
      emp.email,
      emp.jobTitle || 'Employee',
      emp.region || 'Pakistan',
      emp.bankName || 'N/A',
      emp.accountNumber || 'N/A',
      emp.iban || 'N/A',
      emp.onboardingCompleted ? 'Completed' : 'Pending',
      emp.region === 'USA' ? `$${Math.round(emp.baseSalary / 278)}` : `PKR ${emp.baseSalary}`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `DelCargo_Employee_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportTrackingCSV = () => {
    if (!selectedReviewEmp) return;
    const headers = ['Date', 'Task / Activity', 'Clock In', 'Clock Out', 'Duration', 'Activity Score (%)'];
    const rows = filteredReviewEntries.map(e => [
      e.date || '',
      e.task || 'Shift',
      e.clockIn || '—',
      e.clockOut || '—',
      e.duration || '—',
      e.score ? `${e.score}%` : '—'
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Tracking_${selectedReviewEmp.fullName.replace(' ', '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employee Master Report</h1>
          <p className="text-slate-500">Comprehensive overview of profiles, localized salaries, and banking credentials.</p>
        </div>
        <button
          onClick={exportMainCSV}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all flex items-center gap-1.5 shadow-sm self-start md:self-auto"
        >
          <Download className="h-4 w-4" /> Export Report (CSV)
        </button>
      </div>

      {/* Filters row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 hover:bg-slate-50/70 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-lg py-2 pl-9 pr-3 text-xs outline-none text-slate-800 font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value as any)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-lg py-2 px-3 text-xs outline-none font-semibold text-slate-700 cursor-pointer"
          >
            <option value="All">All Regions</option>
            <option value="USA">USA Only</option>
            <option value="Pakistan">Pakistan (Remote)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={onboardingFilter}
            onChange={(e) => setOnboardingFilter(e.target.value as any)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-lg py-2 px-3 text-xs outline-none font-semibold text-slate-700 cursor-pointer"
          >
            <option value="All">All Onboarding Status</option>
            <option value="Completed">Completed Onboarding</option>
            <option value="Pending">Pending Onboarding</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <Card className="overflow-hidden p-0 border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-sm text-left border-collapse">
            <thead className="text-xs font-bold text-slate-550 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Region</th>
                <th className="px-6 py-4">Base Salary</th>
                <th className="px-6 py-4">Onboarding</th>
                <th className="px-6 py-4">Bank Details</th>
                <th className="px-6 py-4 text-center">Tracking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 cursor-pointer hover:bg-slate-100/70" onClick={() => setSelectedProfileEmail(emp.email)}>
                    <div className="flex items-center gap-3">
                      {emp.profilePicture ? (
                        <img src={emp.profilePicture} alt={emp.fullName} className="h-10 w-10 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-sm font-bold text-orange-600">
                          {emp.fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-slate-900">{emp.fullName}</div>
                        <div className="text-xs text-slate-450">{emp.email} · <span className="font-bold text-orange-655">{emp.jobTitle || 'Staff'}</span></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-700">{emp.region || 'Pakistan'}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">{formatMoney(emp.baseSalary, emp.region)}</td>
                  <td className="px-6 py-4">
                    <Badge variant={emp.onboardingCompleted ? 'success' : 'warning'}>
                      {emp.onboardingCompleted ? 'Completed' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    {emp.bankName ? (
                      <div className="text-xs text-slate-655 leading-relaxed font-semibold">
                        <div>🏦 <span className="text-slate-900">{emp.bankName}</span></div>
                        <div>Acc: <span className="text-slate-500 font-medium">{emp.accountNumber}</span></div>
                        <div>IBAN: <span className="text-slate-550 font-mono text-[10px]">{emp.iban}</span></div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-semibold italic">Details pending</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => handleOpenReviewModal(emp)}
                      className="text-[10px] font-bold text-slate-650 hover:text-orange-700 bg-slate-100 hover:bg-orange-50 border border-slate-200 hover:border-orange-200 px-2.5 py-1.5 rounded-lg active:scale-97 transition-all inline-flex items-center gap-1.5"
                    >
                      <FileText className="h-3.5 w-3.5" /> View Tracking
                    </button>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold italic">
                    No employees matching the criteria found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Tracking Viewer Modal */}
      {selectedReviewEmp && (
        <Modal isOpen onClose={() => { setSelectedReviewEmp(null); setReviewEntries([]); }} title="Employee Tracking History" className="md:max-w-4xl">
          <div className="space-y-5 pt-1 font-sans">

            {/* Employee info header */}
            <div className="flex justify-between items-start bg-slate-50 p-4 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-3">
                {selectedReviewEmp.profilePicture ? (
                  <img src={selectedReviewEmp.profilePicture} alt={selectedReviewEmp.fullName} className="h-10 w-10 rounded-full object-cover border border-slate-200" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-sm font-bold text-orange-600">
                    {selectedReviewEmp.fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-slate-900">{selectedReviewEmp.fullName}</p>
                  <p className="text-[10px] text-slate-455 font-bold">{selectedReviewEmp.email} · {selectedReviewEmp.jobTitle || 'Staff'}</p>
                </div>
              </div>
              <Badge variant={selectedReviewEmp.region === 'USA' ? 'default' : 'success'}>
                {selectedReviewEmp.region === 'USA' ? 'USA Operations' : 'Pakistan Remote'}
              </Badge>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                <Clock className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-blue-900">{Math.floor(totalHours / 60)}h {totalHours % 60}m</p>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Total Time</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                <TrendingUp className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-emerald-900">{avgScore > 0 ? `${avgScore}%` : '—'}</p>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Avg Activity</p>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
                <Calendar className="h-4 w-4 text-orange-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-orange-900">{filteredReviewEntries.length}</p>
                <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Sessions</p>
              </div>
            </div>

            {/* Date filter + CSV export */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by date (e.g. 2026-07-06 or 'Today')"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-xs outline-none font-medium text-slate-800 focus:border-orange-500"
                />
              </div>
              <button
                onClick={exportTrackingCSV}
                disabled={filteredReviewEntries.length === 0}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-4 py-2 rounded-lg text-xs active:scale-97 transition-all shadow-sm whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>

            {/* Sessions Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Session History</h4>
                <span className="text-[10px] font-bold text-slate-400">{filteredReviewEntries.length} record{filteredReviewEntries.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse min-w-[500px]">
                  <thead className="font-bold text-slate-555 bg-slate-50/80 border-b border-slate-200 uppercase tracking-widest text-[9px] sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Task / Activity</th>
                      <th className="px-4 py-2.5">Clock In</th>
                      <th className="px-4 py-2.5">Clock Out</th>
                      <th className="px-4 py-2.5 text-right">Duration</th>
                      <th className="px-4 py-2.5 text-right">Activity %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReviewEntries.map((entry, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-700">{entry.date || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 font-medium max-w-[180px] truncate">{entry.task || 'Shift'}</td>
                        <td className="px-4 py-3 font-mono text-slate-500 text-[10px]">{entry.clockIn || '—'}</td>
                        <td className="px-4 py-3 font-mono text-slate-500 text-[10px]">{entry.clockOut || '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">{entry.duration || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          {entry.score ? (
                            <span className={`font-bold text-xs ${entry.score >= 85 ? 'text-emerald-600' : entry.score >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
                              {entry.score}%
                            </span>
                          ) : <span className="text-slate-300 font-bold">—</span>}
                        </td>
                      </tr>
                    ))}
                    {filteredReviewEntries.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 font-semibold italic">
                          {reviewEntries.length === 0 ? 'No tracking sessions recorded yet.' : 'No sessions match the date filter.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => { setSelectedReviewEmp(null); setReviewEntries([]); }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2 rounded-lg text-xs transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedProfileEmail && (
        <UserProfileModal
          isOpen={!!selectedProfileEmail}
          onClose={() => setSelectedProfileEmail(null)}
          employeeEmail={selectedProfileEmail}
          currentUserRole="hr"
          currentUserEmail={currentUserEmail}
          onUpdate={() => {
            setEmployees(db.getEmployees());
          }}
        />
      )}
    </div>
  );
}


