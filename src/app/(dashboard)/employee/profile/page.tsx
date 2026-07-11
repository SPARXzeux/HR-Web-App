'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useProfiles, hrActions, Profile, formatMoney } from '@/lib/hrData';
import { compressImageToWebP, validatePdfSize, fileToDataUrl, MAX_DOCUMENT_IMAGE_BYTES } from '@/lib/imageCompressor';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { AvatarCropperModal } from '@/components/ui/AvatarCropperModal';
import {
  User, Mail, Briefcase, Calendar, Users, ShieldCheck,
  KeyRound, CheckCircle2, AlertCircle, Star, Landmark, Pencil, Camera, FileText, Upload
} from 'lucide-react';

export default function EmployeeProfilePage() {
  const { data: allProfiles, refetch: refetchProfiles } = useProfiles();

  const [profile, setProfile] = useState<Profile | null>(null);

  // Profile picture upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [photoSuccess, setPhotoSuccess] = useState('');

  // Documents (CV, identity docs, passport)
  const cvInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);
  const passportInputRef = useRef<HTMLInputElement>(null);
  const [docBusy, setDocBusy] = useState<string | null>(null);
  const [docError, setDocError] = useState('');
  const [docSuccess, setDocSuccess] = useState('');

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
    if (!email || !allProfiles) return;
    const p = allProfiles.find(e => e.email && e.email.toLowerCase() === email.toLowerCase());
    if (p) setProfile(p);
  }, [allProfiles]);

  const handlePhotoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.');
      setTimeout(() => setPhotoError(''), 3000);
      return;
    }
    setPendingPhotoFile(file);
  };

  const handlePhotoSave = async (webpDataUrl: string) => {
    if (!profile?.id) return;
    try {
      await hrActions.updateProfileDetails(profile.id, { profilePicture: webpDataUrl });
      const { data: refreshed } = await refetchProfiles();
      const updatedProfile = refreshed?.find(p => p.id === profile.id);
      if (updatedProfile) setProfile(updatedProfile);
      setPendingPhotoFile(null);
      setPhotoSuccess('Profile picture updated!');
      setTimeout(() => setPhotoSuccess(''), 2000);
    } catch (err) {
      console.error('[Profile] Photo update error:', err);
      setPhotoError('Failed to save profile picture.');
      setTimeout(() => setPhotoError(''), 3000);
    }
  };

  // Converts an uploaded document File to a storable data URL: images are
  // compressed to WebP (max 3 MB), PDFs are stored as-is after a size check
  // (max 5 MB) — no lossy conversion for PDFs.
  const fileToStoredData = async (file: File): Promise<{ data: string; error: string | null }> => {
    if (file.type === 'application/pdf') {
      const err = validatePdfSize(file);
      if (err) return { data: '', error: err };
      return { data: await fileToDataUrl(file), error: null };
    }
    if (file.type.startsWith('image/')) {
      const data = await compressImageToWebP(file, 0.8, MAX_DOCUMENT_IMAGE_BYTES);
      return { data, error: null };
    }
    return { data: '', error: 'Only image files or PDFs are supported.' };
  };

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !profile?.id) return;
    setDocError(''); setDocSuccess('');
    setDocBusy('cv');
    try {
      const { data, error } = await fileToStoredData(file);
      if (error) { setDocError(error); return; }
      await hrActions.updateProfileDetails(profile.id, { cvFileName: file.name, cvFileData: data });
      const { data: refreshed } = await refetchProfiles();
      const updated = refreshed?.find(p => p.id === profile.id);
      if (updated) setProfile(updated);
      setDocSuccess('CV / Resume uploaded successfully!');
      setTimeout(() => setDocSuccess(''), 2500);
    } catch (err) {
      console.error('[Profile] CV upload error:', err);
      setDocError('Failed to upload CV. Please try again.');
    } finally {
      setDocBusy(null);
    }
  };

  const handleIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !profile?.id) return;
    setDocError(''); setDocSuccess('');
    setDocBusy('id');
    try {
      const { data, error } = await fileToStoredData(file);
      if (error) { setDocError(error); return; }
      const existing = profile.identityDocs || [];
      await hrActions.updateProfileDetails(profile.id, { identityDocs: [...existing, { name: file.name, data }] });
      const { data: refreshed } = await refetchProfiles();
      const updated = refreshed?.find(p => p.id === profile.id);
      if (updated) setProfile(updated);
      setDocSuccess('Identity document uploaded successfully!');
      setTimeout(() => setDocSuccess(''), 2500);
    } catch (err) {
      console.error('[Profile] ID doc upload error:', err);
      setDocError('Failed to upload document. Please try again.');
    } finally {
      setDocBusy(null);
    }
  };

  const handlePassportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !profile?.id) return;
    setDocError(''); setDocSuccess('');
    setDocBusy('passport');
    try {
      const { data, error } = await fileToStoredData(file);
      if (error) { setDocError(error); return; }
      await hrActions.updateProfileDetails(profile.id, { passportFileName: file.name, passportFileData: data });
      const { data: refreshed } = await refetchProfiles();
      const updated = refreshed?.find(p => p.id === profile.id);
      if (updated) setProfile(updated);
      setDocSuccess('Passport uploaded successfully!');
      setTimeout(() => setDocSuccess(''), 2500);
    } catch (err) {
      console.error('[Profile] Passport upload error:', err);
      setDocError('Failed to upload passport. Please try again.');
    } finally {
      setDocBusy(null);
    }
  };

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
    if (!email || !profile?.id) return;

    try {
      await hrActions.updateProfileDetails(profile.id, {
        bankName: bankNameInput.trim(),
        accountNumber: accountNumberInput.trim(),
        iban: ibanInput.trim(),
      });
      const { data: refreshed } = await refetchProfiles();
      const updatedProfile = refreshed?.find(p => p.id === profile.id);
      if (updatedProfile) setProfile(updatedProfile);
      setBankSuccess('Bank details updated successfully!');
      setTimeout(() => { setIsBankEditOpen(false); setBankSuccess(''); }, 1000);
    } catch (err) {
      console.error(err);
      setBankError('Failed to save bank details.');
    }
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
    if (newPass === currentPass) {
      setResetError('New password must be different from current password.');
      return;
    }
    if (newPass !== confirmPass) {
      setResetError('New passwords do not match.');
      return;
    }

    if (profile?.id) {
      // hr_profiles is a base (non-auth) collection. The password field is
      // a plain text column, updated via hrActions.resetPassword.
      hrActions.resetPassword(profile.id, newPass)
        .then(async () => {
          const { data: refreshed } = await refetchProfiles();
          const updatedProfile = refreshed?.find(p => p.id === profile.id);
          if (updatedProfile) setProfile(updatedProfile);
          setResetSuccess('Password updated successfully!');
          setTimeout(() => {
            setIsResetOpen(false);
            setCurrentPass('');
            setNewPass('');
            setConfirmPass('');
            setResetSuccess('');
          }, 1200);
        })
        .catch(err => {
          console.error('[Profile] Password update error:', err);
          setResetError('Failed to change password. Please try again.');
        });
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm font-semibold">
        Loading profile…
      </div>
    );
  }

  // Profile.baseSalary already reflects every processed anniversary
  // increment, so it IS the current effective salary (mirrors old
  // db.calculateCurrentSalary()).
  const salary = profile.baseSalary;
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
            <div className="relative group">
              {profile.profilePicture ? (
                <img
                  src={profile.profilePicture}
                  alt="Profile"
                  className="h-20 w-20 rounded-full bg-white border-4 border-white shadow-md object-cover"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-white border-4 border-white shadow-md flex items-center justify-center text-2xl font-bold text-orange-600 bg-orange-50">
                  {profile.fullName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Change profile picture"
                className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center shadow-md border-2 border-white transition-all active:scale-90"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoInputChange}
                className="hidden"
              />
            </div>
            <button
              onClick={() => setIsResetOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2.5 md:py-1.5 rounded-lg transition-all border border-slate-200 active:scale-97"
            >
              <KeyRound className="h-3.5 w-3.5" /> Reset Password
            </button>
          </div>

          {(photoError || photoSuccess) && (
            <div className={`mb-3 p-2.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 ${photoError ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
              {photoError ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {photoError || photoSuccess}
            </div>
          )}

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

      {/* Documents section */}
      <Card className="border border-slate-200 p-0 overflow-hidden">
        <div className="px-6 pt-5 pb-2 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm">My Documents</h3>
          <p className="text-[10px] text-slate-400 mt-1">Images up to 3 MB (auto-converted to WebP), PDFs up to 5 MB. Visible to HR/Admin under Master Reports.</p>
        </div>

        {(docError || docSuccess) && (
          <div className={`mx-6 mt-4 p-2.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 ${docError ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
            {docError ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {docError || docSuccess}
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {/* CV / Resume */}
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-slate-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CV / Resume</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{profile.cvFileName || 'Not uploaded yet'}</p>
              </div>
            </div>
            <button
              onClick={() => cvInputRef.current?.click()}
              disabled={docBusy === 'cv'}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg transition-all border border-slate-200 active:scale-97 disabled:opacity-60"
            >
              <Upload className="h-3.5 w-3.5" /> {docBusy === 'cv' ? 'Uploading…' : profile.cvFileData ? 'Replace' : 'Upload'}
            </button>
            <input ref={cvInputRef} type="file" accept="image/*,application/pdf" onChange={handleCvUpload} className="hidden" />
          </div>

          {/* Identity documents */}
          <div className="px-6 py-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{profile.region === 'USA' ? 'Driver License / Work Permit' : 'CNIC (Front/Back)'}</p>
                <p className="text-xs text-slate-500 mt-0.5">{(profile.identityDocs || []).length} document(s) on file</p>
              </div>
              <button
                onClick={() => idInputRef.current?.click()}
                disabled={docBusy === 'id'}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg transition-all border border-slate-200 active:scale-97 disabled:opacity-60"
              >
                <Upload className="h-3.5 w-3.5" /> {docBusy === 'id' ? 'Uploading…' : 'Add Document'}
              </button>
              <input ref={idInputRef} type="file" accept="image/*,application/pdf" onChange={handleIdUpload} className="hidden" />
            </div>
            {(profile.identityDocs || []).length > 0 && (
              <ul className="text-xs text-slate-600 space-y-1 pl-1">
                {(profile.identityDocs || []).map((d, i) => <li key={i} className="truncate">• {d.name}</li>)}
              </ul>
            )}
          </div>

          {/* Passport */}
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-slate-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Passport (Optional)</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{profile.passportFileName || 'Not uploaded yet'}</p>
              </div>
            </div>
            <button
              onClick={() => passportInputRef.current?.click()}
              disabled={docBusy === 'passport'}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg transition-all border border-slate-200 active:scale-97 disabled:opacity-60"
            >
              <Upload className="h-3.5 w-3.5" /> {docBusy === 'passport' ? 'Uploading…' : profile.passportFileData ? 'Replace' : 'Upload'}
            </button>
            <input ref={passportInputRef} type="file" accept="image/*,application/pdf" onChange={handlePassportUpload} className="hidden" />
          </div>
        </div>
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

      {/* Avatar Cropper Modal */}
      <AvatarCropperModal
        file={pendingPhotoFile}
        onClose={() => setPendingPhotoFile(null)}
        onSave={handlePhotoSave}
      />
    </div>
  );
}
