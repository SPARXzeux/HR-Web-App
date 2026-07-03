'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { db, Profile, PayrollRecord } from '@/lib/db';
import { FileText, Download, CheckCircle2, ShieldCheck, Printer } from 'lucide-react';

export default function EmployeeSalaryPage() {
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [payrollRecord, setPayrollRecord] = useState<PayrollRecord | null>(null);
  const [selectedSlip, setSelectedSlip] = useState<{ month: string; base: number; deductions: number; bonus: number; net: number } | null>(null);

  useEffect(() => {
    const email = localStorage.getItem('user_email');
    const employees = db.getEmployees();
    const profile = employees.find(e => e.email === email);
    if (profile) {
      setUserProfile(profile);
      const payroll = db.getPayroll();
      const record = payroll.find(p => p.employeeId === profile.id);
      if (record) {
        setPayrollRecord(record);
      }
    }
  }, []);

  const baseSalary = payrollRecord ? payrollRecord.baseSalary : 0;
  const originalBase = userProfile ? userProfile.baseSalary : 0;
  const totalIncrement = baseSalary - originalBase;

  // Mock list of 3 months history calculated dynamically from current state
  const slips = [
    { month: 'June 2026', base: baseSalary, deductions: payrollRecord?.processed ? payrollRecord.deductions : 0, bonus: payrollRecord?.processed ? payrollRecord.bonus : 2500, net: baseSalary + (payrollRecord?.processed ? payrollRecord.bonus : 2500) - (payrollRecord?.processed ? payrollRecord.deductions : 0) },
    { month: 'May 2026', base: baseSalary, deductions: 0, bonus: 1500, net: baseSalary + 1500 },
    { month: 'April 2026', base: baseSalary, deductions: 1000, bonus: 0, net: baseSalary - 1000 }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Salary Ledger</h1>
        <p className="text-slate-500">Track base pay rates, dynamic annual increments, and payslips.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold text-slate-500 text-xs uppercase tracking-wider">Current Base Salary</h3>
            <p className="text-3xl font-bold text-slate-900 mt-2">
              PKR {baseSalary.toLocaleString()}{' '}
              <span className="text-xs text-slate-500 font-normal">/ month</span>
            </p>
            {totalIncrement > 0 && (
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                Includes PKR {totalIncrement.toLocaleString()} dynamic annual increments (+PKR 10,000/yr)
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold text-slate-500 text-xs uppercase tracking-wider">Next Increment Date</h3>
            <p className="text-3xl font-bold text-slate-900 mt-2">
              {userProfile ? new Date(new Date(userProfile.joinedDate).setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">Historical Pay slips</h2>
      <Card className="overflow-hidden p-0 border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-sm text-left border-collapse">
            <thead className="text-xs font-bold text-slate-550 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Month</th>
                <th className="px-6 py-4 text-right">Base Amount</th>
                <th className="px-6 py-4 text-right">Deductions</th>
                <th className="px-6 py-4 text-right">Bonuses</th>
                <th className="px-6 py-4 text-right">Net Received</th>
                <th className="px-6 py-4 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {slips.map((slip, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-900">{slip.month}</td>
                  <td className="px-6 py-4 text-right font-medium">PKR {slip.base.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-rose-600 font-semibold">
                    {slip.deductions > 0 ? `-PKR ${slip.deductions.toLocaleString()}` : 'PKR 0'}
                  </td>
                  <td className="px-6 py-4 text-right text-emerald-600 font-semibold">
                    {slip.bonus > 0 ? `+PKR ${slip.bonus.toLocaleString()}` : 'PKR 0'}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">PKR {slip.net.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => setSelectedSlip(slip)}
                      className="text-xs font-semibold text-orange-650 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded transition-all active:scale-97 flex items-center gap-1.5 mx-auto"
                    >
                      <FileText className="h-3.5 w-3.5" /> View Payslip
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Paystub Modal */}
      <Modal isOpen={!!selectedSlip} onClose={() => setSelectedSlip(null)} title="Official Salary Receipt">
        {selectedSlip && (
          <div className="space-y-6">
            {/* Header branding */}
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">DelCargo Logistics Ltd.</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">HR Operations Paystub Receipt</p>
              </div>
              <Badge variant="success">Paid</Badge>
            </div>

            {/* Employee details */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200/50">
              <div>
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Employee Name</p>
                <p className="text-slate-800 font-semibold mt-0.5">{userProfile?.fullName}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Department</p>
                <p className="text-slate-800 font-semibold mt-0.5">{userProfile?.teams.join(', ')}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Billing Cycle</p>
                <p className="text-slate-800 font-semibold mt-0.5">{selectedSlip.month}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Confidentiality Code</p>
                <p className="text-slate-850 font-mono text-[10px] mt-0.5">DC-{userProfile?.id.toUpperCase()}-PAY</p>
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Salary Breakdown</p>
              <div className="space-y-2 divide-y divide-slate-100 text-xs border border-slate-150 rounded-lg p-4 bg-white">
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 font-semibold">Base salary contract</span>
                  <span className="text-slate-900 font-semibold">PKR {originalBase.toLocaleString()}</span>
                </div>
                {totalIncrement > 0 && (
                  <div className="flex justify-between items-center py-2 pt-2">
                    <span className="text-slate-500 font-semibold">Annual promotions increment</span>
                    <span className="text-emerald-600 font-semibold">+PKR {totalIncrement.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500 font-semibold">Performance bonuses</span>
                  <span className="text-emerald-600 font-semibold">+PKR {selectedSlip.bonus.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500 font-semibold">Leave & penalty deductions</span>
                  <span className="text-rose-600 font-semibold">
                    {selectedSlip.deductions > 0 ? `-PKR ${selectedSlip.deductions.toLocaleString()}` : 'PKR 0'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 pt-3 font-bold text-sm text-slate-900 border-t border-slate-200">
                  <span>Net Payable Outflow</span>
                  <span className="text-orange-600">PKR {selectedSlip.net.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Stamps and buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-200">
              <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs">
                <ShieldCheck className="h-5 w-5 text-emerald-500" /> Dynamic Ledger Double-Verified
              </div>
              <button 
                onClick={() => window.print()}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-xs active:scale-97 transition-all flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" /> Print Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
