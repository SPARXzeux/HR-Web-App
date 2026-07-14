'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { BookOpen, Calendar, HelpCircle, AlertCircle, Award } from 'lucide-react';

export function PolicyView() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">DelCargo Company Policy Handbook</h1>
        <p className="text-slate-555 text-sm">Official company time-off, accrual rules, settlements, and benefits guidelines.</p>
      </div>

      {/* Accrual Rates Table */}
      <Card className="border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-orange-600" />
          <h3 className="font-bold text-slate-900 text-sm">PTO Accrual Structure</h3>
        </div>
        <CardContent className="p-6 space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            DelCargo utilizes a combined sick + vacation bank. Accruals run monthly on your individual anniversary date, capping at a maximum service ceiling of 30 days.
          </p>
          <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full min-w-[450px] text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-650 font-bold uppercase tracking-wider">
                  <th className="px-4 py-3">Years of Service</th>
                  <th className="px-4 py-3 text-center">Annual Days Equivalent</th>
                  <th className="px-4 py-3 text-right">Monthly Accrual Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-slate-700 font-medium">
                <tr><td className="px-4 py-2.5">Year 1</td><td className="px-4 py-2.5 text-center">10 days</td><td className="px-4 py-2.5 text-right font-mono">0.83 / mo</td></tr>
                <tr><td className="px-4 py-2.5">Year 2</td><td className="px-4 py-2.5 text-center">12 days</td><td className="px-4 py-2.5 text-right font-mono">1.00 / mo</td></tr>
                <tr><td className="px-4 py-2.5">Year 3</td><td className="px-4 py-2.5 text-center">14 days</td><td className="px-4 py-2.5 text-right font-mono">1.17 / mo</td></tr>
                <tr><td className="px-4 py-2.5">Year 4</td><td className="px-4 py-2.5 text-center">16 days</td><td className="px-4 py-2.5 text-right font-mono">1.33 / mo</td></tr>
                <tr><td className="px-4 py-2.5">Year 5</td><td className="px-4 py-2.5 text-center">18 days</td><td className="px-4 py-2.5 text-right font-mono">1.50 / mo</td></tr>
                <tr><td className="px-4 py-2.5">Year 6</td><td className="px-4 py-2.5 text-center">20 days</td><td className="px-4 py-2.5 text-right font-mono">1.67 / mo</td></tr>
                <tr><td className="px-4 py-2.5">Year 7</td><td className="px-4 py-2.5 text-center">22 days</td><td className="px-4 py-2.5 text-right font-mono">1.83 / mo</td></tr>
                <tr><td className="px-4 py-2.5">Year 8</td><td className="px-4 py-2.5 text-center">25 days</td><td className="px-4 py-2.5 text-right font-mono">2.08 / mo</td></tr>
                <tr><td className="px-4 py-2.5">Year 9</td><td className="px-4 py-2.5 text-center">27 days</td><td className="px-4 py-2.5 text-right font-mono">2.25 / mo</td></tr>
                <tr className="bg-orange-50/20 font-bold"><td className="px-4 py-2.5 text-orange-950">Year 10+</td><td className="px-4 py-2.5 text-center text-orange-950">30 days (Permanent Cap)</td><td className="px-4 py-2.5 text-right font-mono text-orange-950">2.50 / mo</td></tr>
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2">
            {[
              { year: 'Year 1', days: '10 days', rate: '0.83 / mo' },
              { year: 'Year 2', days: '12 days', rate: '1.00 / mo' },
              { year: 'Year 3', days: '14 days', rate: '1.17 / mo' },
              { year: 'Year 4', days: '16 days', rate: '1.33 / mo' },
              { year: 'Year 5', days: '18 days', rate: '1.50 / mo' },
              { year: 'Year 6', days: '20 days', rate: '1.67 / mo' },
              { year: 'Year 7', days: '22 days', rate: '1.83 / mo' },
              { year: 'Year 8', days: '25 days', rate: '2.08 / mo' },
              { year: 'Year 9', days: '27 days', rate: '2.25 / mo' },
              { year: 'Year 10+', days: '30 days (Permanent Cap)', rate: '2.50 / mo', isCap: true },
            ].map((row, idx) => (
              <div key={idx} className={`border border-slate-200 rounded-xl p-3 shadow-sm ${row.isCap ? 'bg-orange-50/20 border-orange-100' : 'bg-white'}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className={`font-bold ${row.isCap ? 'text-orange-950' : 'text-slate-700'}`}>{row.year}</span>
                  <span className={`font-mono text-xs ${row.isCap ? 'text-orange-950' : 'text-slate-700'}`}>{row.rate}</span>
                </div>
                <div className={`text-[10px] ${row.isCap ? 'text-orange-900 font-bold' : 'text-slate-500 font-medium'}`}>
                  {row.days}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Parental Leave Info */}
      <Card className="border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <Award className="h-5 w-5 text-orange-600" />
          <h3 className="font-bold text-slate-900 text-sm">Parental Leave Policy</h3>
        </div>
        <CardContent className="p-6 space-y-2.5 text-xs leading-relaxed text-slate-600">
          <p>
            DelCargo values family integration and supports new parents. Under our updated benefits structure, employees meeting the following conditions can apply for fully paid **Parental Leave**:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 font-medium">
            <li>Available exclusively to female employees.</li>
            <li>Requires at least 1 year (12 months) of continuous tenure with DelCargo.</li>
            <li>Parental leave requests are granted for exactly **30 days** of consecutive calendar rest.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Notice & Settlement Guidelines */}
      <Card className="border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-orange-600" />
          <h3 className="font-bold text-slate-900 text-sm">Settlement & Notices</h3>
        </div>
        <CardContent className="p-6 space-y-4 text-xs text-slate-650 leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                PTO Application Notice
              </h4>
              <p>Employees must provide at least **2 weeks (14 days) advance notice** when applying for general PTO. Emergency Urgent requests bypass this timeline but require direct HR review.</p>
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-orange-600" />
                January 31st Settlement
              </h4>
              <p>On January 31st of every calendar year, unused accrued days can either be rolled over (maximum of **5 days**) or cashed out. The payout rate is computed using the daily rate formula: `Daily Rate = Base Monthly salary ÷ 22`.</p>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-600 font-medium mt-2">
            ℹ️ <strong>Contract End Payout:</strong> In the event of contract termination or voluntary exit, the remaining accrued PTO balance is paid out in full on the final settlement invoice.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
