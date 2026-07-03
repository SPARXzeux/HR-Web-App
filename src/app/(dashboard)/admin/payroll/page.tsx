'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DollarSign, CheckCircle2, TrendingUp } from 'lucide-react';
import { db, PayrollRecord } from '@/lib/db';

interface PayrollSummary {
  department: string;
  headcount: number;
  totalBase: number;
  totalBonuses: number;
  totalDeductions: number;
}

export default function AdminPayrollPage() {
  const [summaries, setSummaries] = useState<PayrollSummary[]>([]);
  const [isReleased, setIsReleased] = useState(false);

  useEffect(() => {
    const payroll = db.getPayroll();
    const employees = db.getEmployees();
    
    // Group dynamically by employee teams/departments
    const depts = Array.from(new Set(employees.flatMap(e => e.teams)));
    const calculatedSummaries = depts.map(dept => {
      const deptEmployees = employees.filter(e => e.teams.includes(dept));
      const deptPayroll = payroll.filter(p => deptEmployees.some(e => e.id === p.employeeId));
      
      return {
        department: dept,
        headcount: deptEmployees.length,
        totalBase: deptPayroll.reduce((acc, p) => acc + p.baseSalary, 0),
        totalBonuses: deptPayroll.reduce((acc, p) => acc + p.bonus, 0),
        totalDeductions: deptPayroll.reduce((acc, p) => acc + p.deductions, 0)
      };
    });
    
    setSummaries(calculatedSummaries);
  }, []);

  const grandTotalBase = summaries.reduce((acc, s) => acc + s.totalBase, 0);
  const grandTotalBonuses = summaries.reduce((acc, s) => acc + s.totalBonuses, 0);
  const grandTotalDeductions = summaries.reduce((acc, s) => acc + s.totalDeductions, 0);
  const grandNetPayable = grandTotalBase + grandTotalBonuses - grandTotalDeductions;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payroll & Financials Overview</h1>
          <p className="text-slate-500">High-level cost tracking, departmental breakdowns, and global payout releasing.</p>
        </div>
        {!isReleased ? (
          <button 
            onClick={() => setIsReleased(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm active:scale-97 duration-150 flex items-center gap-1.5"
          >
            <CheckCircle2 className="h-4 w-4" />
            Release Monthly Funds
          </button>
        ) : (
          <Badge variant="success" className="text-sm px-4 py-2 rounded-lg flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Monthly Funds Released
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">Total Net Outflow</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">${grandNetPayable.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <DollarSign className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">Accumulated Bonuses</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">${grandTotalBonuses.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-650">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500">Payroll Status</p>
                <div className="mt-3">
                  {isReleased ? (
                    <Badge variant="success">Completed</Badge>
                  ) : (
                    <Badge variant="warning">Awaiting Approval</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">Departmental Breakdowns</h2>
      <Card className="overflow-hidden p-0 border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs font-bold text-slate-500 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4 text-center">Headcount</th>
                <th className="px-6 py-4 text-right">Total Base</th>
                <th className="px-6 py-4 text-right">Total Bonuses</th>
                <th className="px-6 py-4 text-right">Total Deductions</th>
                <th className="px-6 py-4 text-right">Department Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {summaries.map(s => {
                const deptNet = s.totalBase + s.totalBonuses - s.totalDeductions;
                return (
                  <tr key={s.department} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">{s.department}</td>
                    <td className="px-6 py-4 text-center font-semibold text-slate-550">{s.headcount}</td>
                    <td className="px-6 py-4 text-right text-slate-900 font-medium">${s.totalBase.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-semibold">+${s.totalBonuses.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-rose-600 font-semibold">-${s.totalDeductions.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">${deptNet.toLocaleString()}</td>
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
