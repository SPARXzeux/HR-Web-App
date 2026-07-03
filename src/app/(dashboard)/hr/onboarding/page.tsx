'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { db, Profile } from '@/lib/db';
import { UserPlus, CheckCircle2, AlertCircle } from 'lucide-react';

export default function HROnboardingPage() {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [isOnboardOpen, setIsOnboardOpen] = useState(false);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('employee');
  const [salary, setSalary] = useState('');
  const [team, setTeam] = useState('Engineering');
  const [tempPassword, setTempPassword] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [onboardError, setOnboardError] = useState('');
  const [onboardSuccess, setOnboardSuccess] = useState('');

  useEffect(() => {
    setEmployees(db.getEmployees());
    setTeams(db.getTeams());
  }, []);

  const handleOnboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardError('');
    setOnboardSuccess('');

    if (!fullName || !email || !salary || !jobTitle) {
      setOnboardError('Please fill in all required fields.');
      return;
    }

    if (isNaN(Number(salary)) || Number(salary) <= 0) {
      setOnboardError('Please enter a valid base salary.');
      return;
    }

    db.addEmployee({
      fullName,
      email,
      role: role as 'employee' | 'hr' | 'admin',
      joinedDate: new Date().toISOString().split('T')[0],
      baseSalary: Number(salary),
      teams: [team],
      password: tempPassword || 'employee123',
      jobTitle,
      gender,
    });

    db.addNotification('all', 'hr', `New employee ${fullName} onboarded onto team ${team}.`);
    setOnboardSuccess('Employee successfully registered!');
    setEmployees(db.getEmployees());

    setTimeout(() => {
      setIsOnboardOpen(false);
      setFullName('');
      setEmail('');
      setSalary('');
      setTeam('Engineering');
      setTempPassword('');
      setJobTitle('');
      setGender('male');
      setOnboardSuccess('');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Onboarding Pipelines</h1>
          <p className="text-slate-500">Track registration completeness and generate invitation credentials.</p>
        </div>
        <button
          onClick={() => setIsOnboardOpen(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all flex items-center gap-1.5 shadow-sm"
        >
          <UserPlus className="h-4 w-4" /> Onboard Employee
        </button>
      </div>

      <Card className="overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs font-bold text-slate-550 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Job Title (Role)</th>
                <th className="px-6 py-4 text-center">Gender</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Invited Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-900">{emp.fullName}</td>
                  <td className="px-6 py-4">{emp.email}</td>
                  <td className="px-6 py-4 capitalize font-medium text-slate-800">
                    {emp.jobTitle || 'Employee'} <span className="text-[10px] text-slate-400 font-bold uppercase">({emp.role})</span>
                  </td>
                  <td className="px-6 py-4 text-center capitalize font-semibold text-slate-500">{emp.gender || 'male'}</td>
                  <td className="px-6 py-4">
                    <Badge variant={emp.onboardingCompleted ? 'success' : 'warning'}>
                      {emp.onboardingCompleted ? 'Completed' : 'Invite Sent'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-550">{emp.joinedDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Onboard Employee Modal */}
      <Modal isOpen={isOnboardOpen} onClose={() => setIsOnboardOpen(false)} title="Onboard New Employee">
        <form onSubmit={handleOnboardSubmit} className="space-y-4 pt-1">
          {onboardError && (
            <div className="p-3.5 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-xl font-semibold flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-600 shrink-0" />
              {onboardError}
            </div>
          )}
          {onboardSuccess && (
            <div className="p-3.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl font-semibold flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
              {onboardSuccess}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Full Name *</label>
              <input 
                type="text" 
                required 
                value={fullName} 
                onChange={e => setFullName(e.target.value)} 
                className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold" 
                placeholder="e.g. John Doe" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Job Title / Designation *</label>
              <input 
                type="text" 
                required 
                value={jobTitle} 
                onChange={e => setJobTitle(e.target.value)} 
                className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold" 
                placeholder="e.g. QA Specialist" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email Address *</label>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold" 
                placeholder="e.g. john@company.com" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gender</label>
              <select 
                value={gender} 
                onChange={e => setGender(e.target.value as 'male' | 'female')} 
                className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.875rem center',
                  backgroundSize: '1rem'
                }}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Role Type</label>
              <select 
                value={role} 
                onChange={e => setRole(e.target.value)} 
                className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.875rem center',
                  backgroundSize: '1rem'
                }}
              >
                <option value="employee">Employee</option>
                <option value="hr">HR</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Base Salary (PKR) *</label>
              <input 
                type="text" 
                required 
                value={salary} 
                onChange={e => setSalary(e.target.value)} 
                className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold" 
                placeholder="e.g. 50000" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assign Team</label>
              <select 
                value={team} 
                onChange={e => setTeam(e.target.value)} 
                className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.875rem center',
                  backgroundSize: '1rem'
                }}
              >
                {teams.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Temporary Password</label>
              <input 
                type="text" 
                value={tempPassword} 
                onChange={e => setTempPassword(e.target.value)} 
                className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold" 
                placeholder="e.g. welcome123" 
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button 
              type="button" 
              onClick={() => setIsOnboardOpen(false)} 
              className="bg-white hover:bg-slate-55 border border-slate-200 text-slate-650 hover:text-slate-800 font-bold px-4 py-2 rounded-xl text-xs active:scale-97 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-4 py-2 rounded-xl text-xs active:scale-97 transition-all shadow-md shadow-orange-600/10"
            >
              Register & Invite
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
