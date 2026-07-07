'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { db, Profile, formatMoney } from '@/lib/db';
import { PasswordInput } from '@/components/ui/PasswordInput';
import {
  User, Mail, Briefcase, Calendar, Users, ShieldCheck,
  KeyRound, CheckCircle2, AlertCircle, Star, Landmark, Pencil
} from 'lucide-react';

export default function EmployeeProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  // Password reset
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  // Bank details self-service edit
  const [isBankEditOpen, setIsBankEditOpen] = useState(false);
  const [bankNameInput, setBankNameInput] = useState('');
  const [accountNumberInput, setAccountNumberInput] = useState('');
  const [ibanInput, setIbanInput] = useState('');
  const [bankError, setBankError] = useState('');
  const [bankSuccess, setBankSuccess] = useState('');

  useEffect(() => {
    const email = localStorage.getItem('user_email');
    const employees = db.getEmployees();
    const p = employees.find(e => e.email && email && e.email.toLowerCase() === email.toLowerCase());
    if (p) setProfile(p);
  }, []);

  const openBankEdit = () => {
    if (!profile) return;
    setBankNameInput(profile.bankName || '');
    setAccountNumberInput(profile.accountNumber || '');
    setIbanInput(profile.iban || '');
    setBankError('');
    setBankSuccess('');
    setIsBankEditOpen(true);
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBankError('');
    setBankSuccess('');

    if (!bankNameInput.trim() || !accountNumberInput.trim() || !ibanInput.trim()) {
      setBankError('Please fill in all bank detail fields.');
      return;
    }

    const email = localStorage.getItem('user_email');
    if (!email) return;

    await db.updateProfileDetails(email, {
      bankName: bankNameInput.trim(),
      accountNumber: accountNumberInput.trim(),
      iban: ibanInput.trim()
    });
    const employees = db.getEmployees();
    const updated = employees.find(e => e.email && email && e.email.toLowerCase() === email.toLowerCase());
    if (updated) setProfile(updated);
    setBankSuccess('Bank details updated successfully!');
    setTimeout(() => { setIsBankEditOpen(false); setBankSuccess(''); }, 1400);
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (!currentPass || !newPass || !confirmPass) {
      setResetError('Please fill in all fields.');
      return;
    }
    if (profile?.password && profile.password !== currentPass) {
      setResetError('Current password is incorrect.');
      return;
    }
    if (newPass.length < 6) {
      setResetError('New password must be at least 6 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      setResetError('New passwords do not match.');
      return;
    }

    const email = localStorage.getItem('user_email');
    if (email) {
      db.resetPassword(email, newPass);
      const employees = db.getEmployees();
      const updated = employees.find(e => e.email && email && e.email.toLowerCase() === email.toLowerCase());
      if (updated) setProfile(updated);
      setResetSuccess('Password updated successfully!');
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
      setTimeout(() => { setIsResetOpen(false); setResetSuccess(''); }, 1400);
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm font-semibold">
        Loading profile…
      </div>
    );
  }

  const salary = db.calculateCurrentSalary(profile);
  const joined = new Date(profile.joinedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const infoRows = [
    { icon: Mail,      label: 'Email Address',       value: profile.email },
    { icon: Briefcase, label: 'Designation / Title', value: profile.jobTitle || 'Employee' },
    { icon: User,      label: 'Gender / Pronouns',   value: profile.gender ? (profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)) : 'Male' },
    { icon: Calendar,  label: 'Joined Date',         value: joined },
    { icon: Users,     label: 'Department Teams',    value: profile.teams.join(', ') || '—' },
    { icon: ShieldCheck, label: 'Onboarding Status',  value: profile.onboardingCompleted ? 'Completed ✓' : 'Incomplete' },
  ];

  return (
    <div className="space-y-6 md:space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-lg md:text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-xs md:text-sm text-slate-500 mt-0.5">Personal information and account settings.</p>
      </div>

      {/* Avatar + Name card */}
      <Card className="p-0 overflow-hidden border border-slate-200">
        {/* Top banner */}
        <div className="h-24 bg-gradient-to-r from-orange-500 to-orange-400" />
        <div className="px-6 pb-6">
          <div className="-mt-10 mb-4 flex items-end justify-between">
            {profile.profilePicture ? (
              <img 
                src={profile.profilePicture} 
                alt="Profile" 
                className="h-20 w-20 rounded-full bg-white border-4 border-white shadow-md object-cover"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-white border-4 border-white shadow-md flex items-center justify-center text-2xl font-bold text-orange-600 bg-orange-50">
                {profile.fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
              </div>
            )}
            <button
              onClick={() => setIsResetOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2.5 md:py-1.5 rounded-lg transition-all border border-slate-200 active:scale-97"
            >
              <KeyRound className="h-3.5 w-3.5" /> Reset Password
            </button>
          </div>

          <h2 className="text-xl font-bold text-slate-900">{profile.fullName}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full capitalize">{profile.jobTitle || profile.role}</span>
            {profile.isTeamLead && (profile.leadTeams?.length ?? 0) > 0 && (
              <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Star className="h-3 w-3" /> Team Lead · {profile.leadTeams?.join(', ')}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Info grid */}
      <Card className="border border-slate-200 p-0 overflow-hidden">
        <div className="px-6 pt-5 pb-2 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm">Account Details</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {infoRows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-4 px-6 py-4">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Icon className="h-4 w-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{value}</p>
              </div>
            </div>
          ))}
          {/* Salary row */}
          <div className="flex items-center gap-4 px-6 py-4">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-600 font-bold text-sm">{profile.region === 'USA' ? '$' : '₨'}</span>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Salary</p>
              <p className="text-sm font-semibold text-emerald-700 mt-0.5">{formatMoney(salary, profile.region)} / month</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Bank Details section */}
      <Card className="border border-slate-200 p-0 overflow-hidden">
        <div className="px-6 pt-5 pb-2 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Bank Details</h3>
          <button
            onClick={openBankEdit}
            className="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-all border border-slate-200 active:scale-97"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        </div>
        {profile.bankName ? (
          <div className="divide-y divide-slate-100">
            <div className="flex items-center gap-4 px-6 py-4">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Landmark className="h-4 w-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank Name</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{profile.bankName}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 px-6 py-4">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Landmark className="h-4 w-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Number</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5 font-mono truncate">{profile.accountNumber || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 px-6 py-4">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Landmark className="h-4 w-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{profile.region === 'USA' ? 'Routing Number' : 'IBAN'}</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5 font-mono truncate">{profile.iban || '—'}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-6 text-center">
            <p className="text-xs text-slate-400 italic font-semibold">No bank details on file yet. Add them so payroll can process your salary correctly.</p>
          </div>
        )}
      </Card>

      {/* Security section */}
      <Card className="border border-slate-200 p-0 overflow-hidden">
        <div className="px-6 pt-5 pb-2 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm">Security</h3>
        </div>
        <div className="px-4 md:px-6 py-4 md:py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <KeyRound className="h-4 w-4 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Password</p>
              <p className="text-xs text-slate-500 mt-0.5">Change your account password at any time.</p>
            </div>
          </div>
          <button
            onClick={() => setIsResetOpen(true)}
            className="w-full sm:w-auto flex-shrink-0 bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2.5 md:py-2 rounded-lg text-sm active:scale-97 transition-all shadow-sm"
          >
            Change Password
          </button>
        </div>
      </Card>

      {/* Password Reset Modal */}
      <Modal isOpen={isResetOpen} onClose={() => { setIsResetOpen(false); setResetError(''); setResetSuccess(''); }} title="Change Password">
        <form onSubmit={handleResetSubmit} className="space-y-4">
          {resetError && (
            <div className="p-3 text-xs bg-rose-50 text-rose-600 border border-rose-100 rounded-lg font-semibold flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />{resetError}
            </div>
          )}
          {resetSuccess && (
            <div className="p-3 text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />{resetSuccess}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Current Password</label>
            <PasswordInput
              value={currentPass}
              onChange={setCurrentPass}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
              placeholder="Enter current password"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">New Password</label>
            <PasswordInput
              value={newPass}
              onChange={setNewPass}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
              placeholder="Min. 6 characters"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Confirm New Password</label>
            <PasswordInput
              value={confirmPass}
              onChange={setConfirmPass}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
              placeholder="Repeat new password"
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setIsResetOpen(false)} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2.5 md:py-2 rounded-lg text-sm active:scale-97 transition-all">Cancel</button>
            <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2.5 md:py-2 rounded-lg text-sm active:scale-97 transition-all shadow-sm">Update Password</button>
          </div>
        </form>
      </Modal>

      {/* Bank Details Edit Modal */}
      <Modal isOpen={isBankEditOpen} onClose={() => { setIsBankEditOpen(false); setBankError(''); setBankSuccess(''); }} title="Edit Bank Details">
        <form onSubmit={handleBankSubmit} className="space-y-4">
          {bankError && (
            <div className="p-3 text-xs bg-rose-50 text-rose-600 border border-rose-100 rounded-lg font-semibold flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />{bankError}
            </div>
          )}
          {bankSuccess && (
            <div className="p-3 text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />{bankSuccess}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Bank Name</label>
            <input
              type="text"
              value={bankNameInput}
              onChange={e => setBankNameInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
              placeholder="e.g. Habib Bank Limited"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Account Number</label>
            <input
              type="text"
              value={accountNumberInput}
              onChange={e => setAccountNumberInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900 font-mono"
              placeholder="Enter your account number"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">
              {profile.region === 'USA' ? 'Routing Number' : 'IBAN'}
            </label>
            <input
              type="text"
              value={ibanInput}
              onChange={e => setIbanInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900 font-mono"
              placeholder={profile.region === 'USA' ? 'e.g. 021000021' : 'e.g. PK12ABCD0000001234567890'}
            />
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed">
            Changes to your bank details are saved immediately and visible to HR/Payroll for your next salary cycle.
          </p>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setIsBankEditOpen(false)} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2.5 md:py-2 rounded-lg text-sm active:scale-97 transition-all">Cancel</button>
            <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2.5 md:py-2 rounded-lg text-sm active:scale-97 transition-all shadow-sm">Save Bank Details</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
