'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { db, Profile, formatMoney } from '@/lib/db';
import { FileText, Search, Filter, ShieldCheck, Download, Monitor } from 'lucide-react';

export default function ReportsPage() {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [regionFilter, setRegionFilter] = useState<'All' | 'USA' | 'Pakistan'>('All');
  const [onboardingFilter, setOnboardingFilter] = useState<'All' | 'Completed' | 'Pending'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReviewEmp, setSelectedReviewEmp] = useState<Profile | null>(null);
  const [reviewEntries, setReviewEntries] = useState<any[]>([]);

  const handleOpenReviewModal = (emp: Profile) => {
    setSelectedReviewEmp(emp);
    const key = `timesheets_${emp.email}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      setReviewEntries(JSON.parse(saved));
    } else {
      setReviewEntries([]);
    }
  };

  useEffect(() => {
    setEmployees(db.getEmployees());
  }, []);

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (emp.jobTitle && emp.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesRegion = regionFilter === 'All' ? true : emp.region === regionFilter;
    
    const matchesOnboarding = onboardingFilter === 'All' ? true : 
                              onboardingFilter === 'Completed' ? emp.onboardingCompleted : !emp.onboardingCompleted;

    return matchesSearch && matchesRegion && matchesOnboarding;
  });

  const exportCSV = () => {
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
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DelCargo_Employee_Report_${new Date().toISOString().split('T')[0]}.csv`);
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
          onClick={exportCSV}
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
                <th className="px-6 py-4 text-center">Monitoring</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={emp.profilePicture || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=256&auto=format&fit=crop'} 
                        alt={emp.fullName} 
                        className="h-10 w-10 rounded-full object-cover border border-slate-200"
                      />
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
                    {emp.trackingEnabled ? (
                      <button 
                        onClick={() => handleOpenReviewModal(emp)}
                        className="text-[10px] font-bold text-slate-650 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg active:scale-97 transition-all inline-flex items-center gap-1.5"
                      >
                        <FileText className="h-3.5 w-3.5" /> Review Tracker
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold italic">No Tracking</span>
                    )}
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

      {/* Employee Activity & Timesheet Review Modal */}
      {selectedReviewEmp && (
        <Modal isOpen onClose={() => setSelectedReviewEmp(null)} title="Workstation Timesheet & Activity Review" className="md:max-w-3xl">
          <div className="space-y-6 pt-1 font-sans">
            <div className="flex justify-between items-start bg-slate-50 p-4 border border-slate-200 rounded-xl">
              <div>
                <p className="text-xs text-slate-500 font-semibold">Reviewing Employee</p>
                <p className="text-sm font-bold text-slate-900">{selectedReviewEmp.fullName}</p>
                <p className="text-[10px] text-slate-455 font-bold">{selectedReviewEmp.email} · {selectedReviewEmp.jobTitle || 'Staff'}</p>
              </div>
              <Badge variant={selectedReviewEmp.region === 'USA' ? 'default' : 'success'}>
                {selectedReviewEmp.region === 'USA' ? 'USA Operations' : 'Pakistan Remote'}
              </Badge>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Historical Sessions (Current Week)</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="font-bold text-slate-555 bg-slate-50 border-b border-slate-200 uppercase tracking-widest text-[9px]">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Tracked Task</th>
                      <th className="px-4 py-2.5 text-right">Time Spent</th>
                      <th className="px-4 py-2.5 text-right">Avg Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {reviewEntries.map((entry, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-bold text-slate-700">{entry.date}</td>
                        <td className="px-4 py-3 text-slate-600 font-medium">{entry.task}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">{entry.duration}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{entry.score}%</td>
                      </tr>
                    ))}
                    {reviewEntries.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400 font-semibold italic">No tracked session history.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Workspace Screenshots</h4>
              <div className="border border-slate-200 p-6 rounded-xl bg-slate-50/50 text-center space-y-2 font-sans">
                <Monitor className="h-6 w-6 text-slate-350 mx-auto" />
                <div>
                  <h5 className="text-xs font-bold text-slate-700">Desktop Capture Offline</h5>
                  <p className="text-[10px] text-slate-455 leading-relaxed font-semibold mt-1">
                    This feature will be available soon (requires Windows client agent installation).
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200">
              <button
                onClick={() => setSelectedReviewEmp(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2 rounded-lg text-xs"
              >
                Close Logs
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
