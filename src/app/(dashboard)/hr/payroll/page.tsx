'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { db, PayrollRecord, LeaveApplication, formatMoney } from '@/lib/db';

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

  const handleProcess = async (id: string) => {
    const record = payrollData.find(emp => emp.id === id);
    if (!record) return;

    // Permanently fold any pending anniversary increment into the
    // employee's real base salary the moment their payroll is processed —
    // from the next cycle onward getPayroll() will show 0 increment and the
    // new, higher baseSalary.
    if (record.incrementAmount > 0) {
      await db.applyAnniversaryIncrement(record.employeeId, record.incrementAmount);
    }

    const updated = payrollData.map(emp =>
      emp.id === id ? { ...emp, processed: true } : emp
    );
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

  // Base + increment + bonus - deductions must be summed separately per
  // currency — USA (USD) and Pakistan (PKR) salaries are not interchangeable.
  const totalPayrollUSD = payrollData
    .filter(emp => emp.region === 'USA')
    .reduce((acc, emp) => acc + (emp.baseSalary + emp.incrementAmount + emp.bonus - emp.deductions), 0);
  const totalPayrollPKR = payrollData
    .filter(emp => emp.region !== 'USA')
    .reduce((acc, emp) => acc + (emp.baseSalary + emp.incrementAmount + emp.bonus - emp.deductions), 0);
  const totalPending = payrollData.filter(e => !e.processed).length;

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-slate-900">Monthly Payroll Ledger</h1>
          <p className="text-xs md:text-sm text-slate-500">Manage base salaries, bonuses, and calculate monthly net payouts.</p>
        </div>
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg self-start md:self-auto">
          <button 
            onClick={() => setActiveTab('all')}
            className={`px-3 py-2 md:py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'all' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            All
          </button>
          <button 
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-2 md:py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'pending' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            Pending ({totalPending})
          </button>
          <button 
            onClick={() => setActiveTab('processed')}
            className={`px-3 py-2 md:py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'processed' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            Processed
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        <Card>
          <CardContent className="pt-5 md:pt-6">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Projected Payout</p>
            <p className="text-xl md:text-2xl font-bold text-slate-900 mt-2">{formatMoney(totalPayrollUSD, 'USA')}</p>
            <p className="text-xs md:text-sm font-semibold text-slate-500 mt-1">{formatMoney(totalPayrollPKR, 'Pakistan')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 md:pt-6">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Remaining Checklist</p>
            <div className="flex items-center gap-2 mt-2">
              {totalPending > 0 ? (
                <>
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <p className="text-xs md:text-sm font-semibold text-slate-800">{totalPending} employees pending processing</p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <p className="text-xs md:text-sm font-semibold text-slate-800">All payroll records completed for this month</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card className="overflow-hidden p-0 border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-sm text-left border-collapse">
              <thead className="text-xs font-bold text-slate-500 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Employee Details</th>
                  <th className="px-6 py-4 text-right">Base Salary</th>
                  <th className="px-6 py-4 text-right">Increment</th>
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
                  const netPayable = emp.baseSalary + emp.incrementAmount + emp.bonus - emp.deductions;
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{emp.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{emp.role}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-900">
                        {formatMoney(emp.baseSalary, emp.region)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {emp.incrementAmount > 0 ? (
                          <div>
                            <span className="text-emerald-600 font-bold">+{formatMoney(emp.incrementAmount, emp.region)}</span>
                            <div className="text-[9px] text-emerald-500 font-bold uppercase">Anniversary</div>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-medium">—</span>
                        )}
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
                          <span className="text-slate-900 font-medium">{formatMoney(emp.bonus, emp.region)}</span>
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
                          <span className="text-slate-900 font-medium">{formatMoney(emp.deductions, emp.region)}</span>
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
                        <div className="font-semibold text-slate-900">{formatMoney(netPayable, emp.region)}</div>
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

      {/* Mobile Card Stack */}
      <div className="md:hidden space-y-3">
        {filteredData.map(emp => {
          const netPayable = emp.baseSalary + emp.incrementAmount + emp.bonus - emp.deductions;
          const urgentCount = leavesList.filter(l => l.employeeName === emp.name && l.type === 'Urgent').length;
          return (
            <div key={emp.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">{emp.name}</p>
                  <p className="text-xs text-slate-500">{emp.role}</p>
                </div>
                {emp.processed ? (
                  <Badge variant="success">Completed</Badge>
                ) : (
                  <Badge variant="warning">Pending</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Base Salary</p>
                  <p className="text-xs font-bold text-slate-800">{formatMoney(emp.baseSalary, emp.region)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Net Payable</p>
                  <p className="text-xs font-bold text-slate-800">{formatMoney(netPayable, emp.region)}</p>
                </div>
                {emp.incrementAmount > 0 && (
                  <div className="col-span-2">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Anniversary Increment</p>
                    <p className="text-xs font-bold text-emerald-600">+{formatMoney(emp.incrementAmount, emp.region)}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Unpaid Leaves</p>
                  <p className="text-xs font-bold text-slate-800">{emp.unpaidLeaves} day(s)</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Bonus / Deductions</p>
                  <p className="text-xs font-bold text-slate-800">{formatMoney(emp.bonus, emp.region)} / {formatMoney(emp.deductions, emp.region)}</p>
                </div>
              </div>
              {urgentCount > 0 && (
                <p className={`text-[10px] font-bold ${urgentCount <= 3 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {urgentCount <= 3 ? `Rebate Eligible (${urgentCount} UL)` : `No Rebate (${urgentCount} UL)`}
                </p>
              )}
              {!emp.processed && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase mb-1">Bonus ($)</p>
                    <input 
                      type="text" 
                      value={emp.bonus || ''} 
                      onChange={(e) => handleUpdateAmount(emp.id, 'bonus', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2 text-xs focus:border-orange-500 outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase mb-1">Deductions ($)</p>
                    <input 
                      type="text" 
                      value={emp.deductions || ''} 
                      onChange={(e) => handleUpdateAmount(emp.id, 'deductions', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2 text-xs focus:border-orange-500 outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>
              )}
              {!emp.processed && (
                <button 
                  onClick={() => handleProcess(emp.id)}
                  className="w-full text-xs font-semibold text-orange-650 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-2.5 rounded-lg transition-all active:scale-97 border border-orange-200"
                >
                  Complete Payout
                </button>
              )}
            </div>
          );
        })}
        {filteredData.length === 0 && (
          <p className="text-xs text-slate-400 font-semibold italic text-center py-8">No records found.</p>
        )}
      </div>
    </div>
  );
}
