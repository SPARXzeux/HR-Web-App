'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { db, PayrollRecord, LeaveApplication } from '@/lib/db';

export default function HRPayrollPage() {
  const [payrollData, setPayrollData] = useState<PayrollRecord[]>([]);
  const [leavesList, setLeavesList] = useState<LeaveApplication[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const rawPayroll = db.getPayroll();
    const rawLeaves = db.getLeaves();
    setLeavesList(rawLeaves);

    // Dynamic Urgent Leave deduction logic (2x daily rate per day)
    const updatedWithDeductions = rawPayroll.map(pay => {
      // Filter approved urgent leaves for this employee
      const employeeLeaves = rawLeaves.filter(l => l.employeeName === pay.name && l.type === 'Urgent');
      
      const urgentDays = employeeLeaves.reduce((acc, l) => {
        const parts = l.duration.split(' - ');
        if (parts.length < 2) return acc + 1;
        const start = new Date(parts[0]);
        const end = new Date(parts[1]);
        const diff = Math.abs(end.getTime() - start.getTime());
        const days = Math.ceil(diff / (1000 * 3600 * 24)) + 1;
        return acc + days;
      }, 0);

      // 2 days salary deduction per urgent leave day
      const dailyRate = pay.baseSalary / 30;
      const urgentDeduction = Math.round(urgentDays * 2 * dailyRate);

      return {
        ...pay,
        deductions: pay.deductions + urgentDeduction
      };
    });

    setPayrollData(updatedWithDeductions);

    const handleSearch = (e: Event) => {
      setSearchQuery((e as CustomEvent).detail || '');
    };
    window.addEventListener('globalSearch', handleSearch);
    return () => window.removeEventListener('globalSearch', handleSearch);
  }, []);

  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'processed'>('all');

  const handleProcess = (id: string) => {
    const updated = payrollData.map(emp => {
      if (emp.id === id) {
        return { ...emp, processed: true };
      }
      return emp;
    });
    setPayrollData(updated);
    db.savePayroll(updated);
  };

  const handleUpdateAmount = (id: string, field: 'bonus' | 'deductions', value: string) => {
    const numericValue = Number(value.replace(/[^0-9.-]/g, '')) || 0;
    const updated = payrollData.map(emp => {
      if (emp.id === id) {
        return { ...emp, [field]: numericValue };
      }
      return emp;
    });
    setPayrollData(updated);
    db.savePayroll(updated);
  };

  const filteredData = payrollData.filter(emp => {
    // RBAC: HR search across name and role
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          emp.role.toLowerCase().includes(searchQuery.toLowerCase());
                          
    if (!matchesSearch) return false;

    if (activeTab === 'pending') return !emp.processed;
    if (activeTab === 'processed') return emp.processed;
    return true;
  });

  const totalPayroll = payrollData.reduce((acc, emp) => acc + (emp.baseSalary + emp.bonus - emp.deductions), 0);
  const totalPending = payrollData.filter(e => !e.processed).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monthly Payroll Ledger</h1>
          <p className="text-slate-500">Manage base salaries, bonuses, and calculate monthly net payouts.</p>
        </div>
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'all' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            All
          </button>
          <button 
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'pending' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            Pending ({totalPending})
          </button>
          <button 
            onClick={() => setActiveTab('processed')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'processed' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            Processed
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Projected Payout</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">${totalPayroll.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remaining Checklist</p>
            <div className="flex items-center gap-2 mt-2">
              {totalPending > 0 ? (
                <>
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <p className="text-sm font-semibold text-slate-800">{totalPending} employees pending processing</p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <p className="text-sm font-semibold text-slate-800">All payroll records completed for this month</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden p-0 border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-sm text-left border-collapse">
            <thead className="text-xs font-bold text-slate-500 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Employee Details</th>
                <th className="px-6 py-4 text-right">Base Salary</th>
                <th className="px-6 py-4 text-center">Unpaid Leaves</th>
                <th className="px-6 py-4 text-right">Bonus ($)</th>
                <th className="px-6 py-4 text-right">Deductions ($)</th>
                <th className="px-6 py-4 text-right">Net Payable</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredData.map(emp => {
                const netPayable = emp.baseSalary + emp.bonus - emp.deductions;
                return (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{emp.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{emp.role}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">
                      ${emp.baseSalary.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        emp.unpaidLeaves > 0 
                          ? 'bg-amber-50 text-amber-800 border border-amber-200/60' 
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {emp.unpaidLeaves} day(s)
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {emp.processed ? (
                        <span className="text-slate-900 font-medium">${emp.bonus}</span>
                      ) : (
                        <input 
                          type="text" 
                          value={emp.bonus || ''} 
                          onChange={(e) => handleUpdateAmount(emp.id, 'bonus', e.target.value)}
                          className="w-20 bg-slate-50 border border-slate-200 rounded-md py-1 px-2 text-right text-xs focus:border-orange-500 outline-none"
                          placeholder="0"
                        />
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {emp.processed ? (
                        <span className="text-slate-900 font-medium">${emp.deductions.toLocaleString()}</span>
                      ) : (
                        <input 
                          type="text" 
                          value={emp.deductions || ''} 
                          onChange={(e) => handleUpdateAmount(emp.id, 'deductions', e.target.value)}
                          className="w-20 bg-slate-50 border border-slate-200 rounded-md py-1 px-2 text-right text-xs focus:border-orange-500 outline-none"
                          placeholder="0"
                        />
                      )}
                      {(() => {
                        const count = leavesList.filter(l => l.employeeName === emp.name && l.type === 'Urgent').length;
                        if (count > 0 && count <= 3) {
                          return <div className="text-[10px] text-emerald-600 font-bold mt-1">Rebate Eligible ({count} UL)</div>;
                        } else if (count > 3) {
                          return <div className="text-[10px] text-rose-600 font-bold mt-1">No Rebate ({count} UL)</div>;
                        }
                        return null;
                      })()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-semibold text-slate-900">${netPayable.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {emp.processed ? (
                        <Badge variant="success">Completed</Badge>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {emp.processed ? (
                        <span className="text-xs text-slate-400 font-semibold">Processed</span>
                      ) : (
                        <button 
                          onClick={() => handleProcess(emp.id)}
                          className="text-xs font-semibold text-orange-650 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded transition-all active:scale-97"
                        >
                          Complete Payout
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
