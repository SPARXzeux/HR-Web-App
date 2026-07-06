'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { db, Profile } from '@/lib/db';
import { PasswordInput } from '@/components/ui/PasswordInput';
import {
  User, Mail, Briefcase, Calendar, ShieldCheck, KeyRound, CheckCircle2, AlertCircle
} from 'lucide-react';

export default function HRProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  // Password reset states
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  useEffect(() => {
    const email = localStorage.getItem('user_email');
    const employees = db.getEmployees();
    const p = employees.find(e => e.email === email);
    if (p) setProfile(p);
  }, []);

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
      const updated = employees.find(e => e.email === email);
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

  const joined = new Date(profile.joinedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const infoRows = [
    { icon: Mail,      label: 'Email Address',       value: profile.email },
    { icon: Briefcase, label: 'Designation / Title', value: profile.jobTitle || 'HR Manager' },
    { icon: User,      label: 'Gender / Pronouns',   value: profile.gender ? (profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)) : 'Female' },
    { icon: Calendar,  label: 'Joined Date',         value: joined },
    { icon: ShieldCheck, label: 'Security Role',      value: 'HR Director' },
  ];

  return (
    <div className="space-y-6 md:space-y-8 max-w-2xl font-sans">
      {/* Header */}
      <div>
        <h1 className="text-lg md:text-2xl font-bold text-slate-900">HR Profile</h1>
        <p className="text-xs md:text-sm text-slate-500 mt-0.5">Manage your HR credentials and account details.</p>
      </div>

      {/* Avatar + Name card */}
      <Card className="p-0 overflow-hidden border border-slate-200">
        <div className="h-20 md:h-24 bg-gradient-to-r from-orange-600 to-orange-500" />
        <div className="px-4 md:px-6 pb-5 md:pb-6">
          <div className="-mt-10 mb-4 flex items-end justify-between">
            {profile.profilePicture ? (
              <img 
                src={profile.profilePicture} 
                alt="Profile" 
                className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-white border-4 border-white shadow-md object-cover"
              />
            ) : (
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-white border-4 border-white shadow-md flex items-center justify-center text-xl md:text-2xl font-bold text-orange-600 bg-orange-50">
                {profile.fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
              </div>
            )}
            <button
              onClick={() => setIsResetOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 md:py-1.5 rounded-lg transition-all border border-slate-200 active:scale-97 min-h-[44px] md:min-h-0"
            >
              <KeyRound className="h-3.5 w-3.5" /> Reset Password
            </button>
          </div>

          <h2 className="text-lg md:text-xl font-bold text-slate-900">{profile.fullName}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full capitalize">
              {profile.jobTitle || 'HR Director'}
            </span>
          </div>
        </div>
      </Card>

      {/* Info grid */}
      <Card className="border border-slate-200 p-0 overflow-hidden">
        <div className="px-4 md:px-6 pt-4 md:pt-5 pb-2 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm">Account Details</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {infoRows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 md:gap-4 px-4 md:px-6 py-3.5 md:py-4">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Icon className="h-4 w-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                <p className="text-xs md:text-sm font-semibold text-slate-900 mt-0.5 truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Security Section */}
      <Card className="border border-slate-200 p-0 overflow-hidden">
        <div className="px-4 md:px-6 pt-4 md:pt-5 pb-2 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm">Security</h3>
        </div>
        <div className="px-4 md:px-6 py-4 md:py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <KeyRound className="h-4 w-4 text-slate-500" />
            </div>
            <div>
              <p className="text-xs md:text-sm font-semibold text-slate-900">Password</p>
              <p className="text-xs text-slate-500 mt-0.5">Change your account password at any time.</p>
            </div>
          </div>
          <button
            onClick={() => setIsResetOpen(true)}
            className="flex-shrink-0 bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2.5 md:py-2 rounded-lg text-sm active:scale-97 transition-all shadow-sm min-h-[44px] md:min-h-0"
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
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 md:py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
              placeholder="Enter current password"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">New Password</label>
            <PasswordInput
              value={newPass}
              onChange={setNewPass}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 md:py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
              placeholder="Enter new password"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Confirm New Password</label>
            <PasswordInput
              value={confirmPass}
              onChange={setConfirmPass}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 md:py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
              placeholder="Confirm new password"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 md:py-2 rounded-lg text-sm active:scale-97 transition-all mt-4 min-h-[44px] md:min-h-0"
          >
            Update Password
          </button>
        </form>
      </Modal>
    </div>
  );
}
