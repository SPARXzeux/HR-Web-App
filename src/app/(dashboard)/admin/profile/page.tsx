'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { db, Profile } from '@/lib/db';
import { PasswordInput } from '@/components/ui/PasswordInput';
import {
  User, Mail, Briefcase, Calendar, ShieldCheck, KeyRound, CheckCircle2, AlertCircle, Edit2
} from 'lucide-react';

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hrProfile, setHrProfile] = useState<Profile | null>(null);

  // Password reset states
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  // Profile Edit states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [targetEmail, setTargetEmail] = useState('admin@delcargo.us');
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState<'male' | 'female'>('male');
  const [editTitle, setEditTitle] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const loadProfiles = () => {
    const email = localStorage.getItem('user_email');
    const employees = db.getEmployees();
    const p = employees.find(e => e.email && email && e.email.toLowerCase() === email.toLowerCase());
    const hr = employees.find(e => e.email && e.email.toLowerCase() === 'hr@delcargo.us');
    if (p) setProfile(p);
    if (hr) setHrProfile(hr);
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  // Update Edit inputs when target changes
  useEffect(() => {
    const target = targetEmail === 'admin@delcargo.us' ? profile : hrProfile;
    if (target) {
      setEditName(target.fullName);
      setEditGender(target.gender === 'female' ? 'female' : 'male');
      setEditTitle(target.jobTitle || '');
    }
  }, [targetEmail, profile, hrProfile]);

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
      loadProfiles();
      setResetSuccess('Password updated successfully!');
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
      setTimeout(() => { setIsResetOpen(false); setResetSuccess(''); }, 1400);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName) return;

    db.updateProfileDetails(targetEmail, {
      fullName: editName,
      gender: editGender,
      jobTitle: editTitle
    });

    loadProfiles();
    setEditSuccess('Profile updated successfully!');
    setTimeout(() => {
      setIsEditOpen(false);
      setEditSuccess('');
    }, 1200);
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
    { icon: Briefcase, label: 'Designation / Title', value: profile.jobTitle || 'System Administrator' },
    { icon: User,      label: 'Gender / Pronouns',   value: profile.gender ? (profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)) : 'Male' },
    { icon: Calendar,  label: 'Joined Date',         value: joined },
    { icon: ShieldCheck, label: 'Security Role',      value: 'System Administrator' },
  ];

  return (
    <div className="space-y-8 max-w-2xl font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Profile</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage your system credentials and preferences.</p>
        </div>
        <button
          onClick={() => {
            setTargetEmail(profile.email);
            setIsEditOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-97 self-stretch sm:self-auto"
        >
          <Edit2 className="h-3.5 w-3.5" /> Edit System Profiles
        </button>
      </div>

      {/* Avatar + Name card */}
      <Card className="p-0 overflow-hidden border border-slate-200">
        <div className="h-24 bg-gradient-to-r from-orange-600 to-orange-500" />
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
            <div className="flex gap-2">
              <button
                onClick={() => setIsResetOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-all border border-slate-200 active:scale-97"
              >
                <KeyRound className="h-3.5 w-3.5" /> Reset Password
              </button>
            </div>
          </div>

          <h2 className="text-xl font-bold text-slate-900">{profile.fullName}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full capitalize">
              {profile.jobTitle || 'System Administrator'}
            </span>
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
        </div>
      </Card>

      {/* Profile Edit Modal */}
      <Modal isOpen={isEditOpen} onClose={() => { setIsEditOpen(false); setEditSuccess(''); }} title="Edit System Profile">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {editSuccess && (
            <div className="p-3 text-xs bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />{editSuccess}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Select Profile to Edit</label>
            <select
              value={targetEmail}
              onChange={e => setTargetEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none text-slate-900 font-semibold"
            >
              <option value="admin@delcargo.us">Admin Profile (admin@delcargo.us)</option>
              <option value="hr@delcargo.us">HR Profile (hr@delcargo.us)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Full Name</label>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none text-slate-900 font-semibold"
              placeholder="Full Name"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Gender</label>
            <select
              value={editGender}
              onChange={e => setEditGender(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none text-slate-900 font-semibold"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Job Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none text-slate-900 font-semibold"
              placeholder="e.g. HR Director / System Administrator"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-lg text-sm active:scale-97 transition-all mt-4"
          >
            Save Profile Changes
          </button>
        </form>
      </Modal>

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
              placeholder="Enter new password"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Confirm New Password</label>
            <PasswordInput
              value={confirmPass}
              onChange={setConfirmPass}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
              placeholder="Confirm new password"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded-lg text-sm active:scale-97 transition-all mt-4"
          >
            Update Password
          </button>
        </form>
      </Modal>
    </div>
  );
}
