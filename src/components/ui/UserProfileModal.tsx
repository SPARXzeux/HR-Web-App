'use client';

import React, { useState, useEffect } from 'react';
import {
  Profile,
  formatMoney,
  saveProfileExtras,
  getRemainingPTO,
  getFinalLeavePayout,
  getPTOAccrualDate,
  useProfiles,
  useWarehouses,
  useLeaves,
  hrActions,
  displayName,
} from '@/lib/hrData';
import { Badge } from './Badge';
import { ConfirmDialog } from './ConfirmDialog';
import { Avatar } from './Avatar';
import { X, User, Mail, Shield, ShieldAlert, Key, DollarSign, Calendar, MapPin, Landmark, Briefcase, FileText, CheckSquare, Square, Trash2, Download } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeEmail: string;
  currentUserRole: 'admin' | 'hr' | 'employee' | 'team_lead';
  currentUserEmail: string;
  onUpdate?: () => void;
}

export function UserProfileModal({ isOpen, onClose, employeeEmail, currentUserRole, currentUserEmail, onUpdate }: UserProfileModalProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isOffboarding, setIsOffboarding] = useState(false);
  const [showOffboardConfirm, setShowOffboardConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Deletion is irreversible and now actually purges everything (documents,
  // payroll, leaves, tasks, tickets, timesheets, screenshots, tracking
  // token) — HR/Admin must download a copy of the employee's data before
  // the delete button becomes usable. Resets whenever a different profile
  // is opened, see the effect below.
  const [hasDownloadedArchive, setHasDownloadedArchive] = useState(false);
  const [isExportingArchive, setIsExportingArchive] = useState(false);

  // Edit fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [region, setRegion] = useState<'USA' | 'Pakistan'>('Pakistan');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [role, setRole] = useState<'employee' | 'hr' | 'admin' | 'team_lead'>('employee');
  const [assignedWarehouses, setAssignedWarehouses] = useState<string[]>([]);
  const [joinedDate, setJoinedDate] = useState('');
  const [salaryStartDate, setSalaryStartDate] = useState('');
  const [accountCreationDate, setAccountCreationDate] = useState('');
  // HR/Admin-only field — see displayName() in hrData.ts. Team members and
  // team leads only ever see this in place of the real name.
  const [alias, setAlias] = useState('');

  // Offboarding fields
  const [itClearance, setItClearance] = useState(false);
  const [financeClearance, setFinanceClearance] = useState(false);
  const [hrClearance, setHrClearance] = useState(false);
  const [notes, setNotes] = useState('');

  const { data: allProfiles, refetch: refetchProfiles } = useProfiles();
  const { data: allWarehouses } = useWarehouses();
  const { data: allLeaves } = useLeaves();
  const warehouses = allWarehouses || [];
  const leaves = allLeaves || [];

  useEffect(() => {
    if (isOpen && employeeEmail && allProfiles) {
      const emps = allProfiles;
      const match = emps.find(e => e.email && employeeEmail && e.email.toLowerCase() === employeeEmail.toLowerCase());
      const curr = emps.find(e => e.email && currentUserEmail && e.email.toLowerCase() === currentUserEmail.toLowerCase());
      setCurrentUser(curr || null);

      if (match) {
        setProfile(match);
        setFullName(match.fullName);
        setEmail(match.email);
        setPassword(match.password || 'employee123');
        setJobTitle(match.jobTitle || 'Staff');
        setBaseSalary(match.baseSalary.toString());
        setRegion(match.region || 'Pakistan');
        setGender(match.gender || 'male');
        setRole(match.role);
        setJoinedDate(match.joinedDate || new Date().toISOString().split('T')[0]);
        setSalaryStartDate(match.salaryStartDate || match.joinedDate || new Date().toISOString().split('T')[0]);
        setAccountCreationDate(match.accountCreationDate || match.joinedDate || new Date().toISOString().split('T')[0]);
        setAssignedWarehouses(match.assignedWarehouses || []);
        setAlias(match.alias || '');
        
        if (match.offboardingStatus) {
          setItClearance(match.offboardingStatus.itClearance);
          setFinanceClearance(match.offboardingStatus.financeClearance);
          setHrClearance(match.offboardingStatus.hrClearance);
          setNotes(match.offboardingStatus.notes || '');
        } else {
          setItClearance(false);
          setFinanceClearance(false);
          setHrClearance(false);
          setNotes('');
        }
      }
      setIsEditing(false);
      setIsOffboarding(false);
      setHasDownloadedArchive(false);
    }
  }, [isOpen, employeeEmail, currentUserEmail, allProfiles]);

  if (!isOpen || !profile) return null;

  // Access Control logic checks
  const canEdit = 
    currentUserRole === 'admin' || 
    (currentUserRole === 'hr' && profile.role !== 'admin' && profile.role !== 'hr');

  // Admin can change HR, HR can change Employees
  const canManageThisProfile = 
    currentUserRole === 'admin' ||
    (currentUserRole === 'hr' && profile.role !== 'admin' && profile.role !== 'hr');

  // Let's implement team scope checking
  const isViewingTheirLead = profile.isTeamLead && profile.leadTeams?.some(t => currentUser?.teams.includes(t));
  const isLeadViewingMember = currentUserRole === 'team_lead' && profile.teams.some(t => currentUser?.leadTeams?.includes(t));
  const inSameTeam = profile.teams.some(t => currentUser?.teams.includes(t));

  const hasAccess = 
    currentUserRole === 'admin' ||
    currentUserRole === 'hr' ||
    isViewingTheirLead ||
    isLeadViewingMember ||
    inSameTeam;

  if (!hasAccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-200 text-center space-y-4">
          <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto" />
          <h3 className="font-bold text-slate-800">Access Restricted</h3>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            You do not have permission to view this profile. Profiles can only be viewed by administrators, HR, or team members and team leaders sharing the same department.
          </p>
          <button onClick={onClose} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 rounded-xl text-xs">
            Close Panel
          </button>
        </div>
      </div>
    );
  }

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;

    await hrActions.updateProfileDetails(profile.id, {
      fullName,
      email,
      password,
      jobTitle,
      baseSalary: Number(baseSalary) || 0,
      region,
      gender,
      role,
      joinedDate,
      salaryStartDate,
      accountCreationDate,
      assignedWarehouses,
      alias: alias.trim() || undefined,
    });

    setIsEditing(false);
    refetchProfiles();
    onUpdate?.();
  };

  const handleOffboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Don't mutate yet — require explicit confirmation first
    setShowOffboardConfirm(true);
  };

  const confirmOffboard = async () => {
    // Company policy: full payout of the remaining combined PTO/Sick bank
    // at contract end, computed from real accrual + leave records.
    const finalLeavePayout = getFinalLeavePayout(profile, leaves);

    // Offboarding only flips these overlay flags — it deliberately does not
    // touch hr_messages, hr_tasks, hr_tickets, documents, etc. Their chat
    // history, sent files, and every other record stay exactly where they
    // are (the profile itself isn't deleted, just flagged). Only the
    // separate, irreversible "Delete Account Permanently" action actually
    // removes data — see hrActions.deleteEmployee's purge list, which is
    // intentionally its own explicit step, not something offboarding does
    // implicitly.
    await saveProfileExtras(profile.id, {
      offboarded: true,
      offboardDate: new Date().toISOString().split('T')[0],
      offboardingStatus: {
        itClearance,
        financeClearance,
        hrClearance,
        notes,
        finalLeavePayout
      }
    });

    setShowOffboardConfirm(false);
    setIsOffboarding(false);
    refetchProfiles();
    onUpdate?.();
  };

  const handleDownloadArchive = async () => {
    if (!profile) return;
    setIsExportingArchive(true);
    try {
      const { filename, blob } = await hrActions.exportEmployeeArchive(profile);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setHasDownloadedArchive(true);
    } catch (err) {
      console.error('Employee data export failed:', err);
      alert('Could not prepare the data export. See console for details — deletion is still blocked until this succeeds.');
    } finally {
      setIsExportingArchive(false);
    }
  };

  const confirmDeletePermanently = async () => {
    setIsDeleting(true);
    try {
      // Purges everything tied to this employee — profile, documents,
      // payroll, leaves, tasks, tickets, timesheets, screenshots, tracking
      // token, notifications — not just the profile listing. See
      // hrActions.deleteEmployee in hrData.ts.
      await hrActions.deleteEmployee(profile.id, profile.email, profile.fullName);
      setShowDeleteConfirm(false);
      onUpdate?.();
      onClose();
    } catch (err) {
      // Without this, a thrown error here left the button stuck on
      // "Deleting…" forever with setIsDeleting(false) never reached.
      console.error('Employee deletion failed:', err);
      alert('Could not fully delete this employee. Some of their data may have already been removed — check the console, refresh, and try again. If it keeps failing, their profile is still intact.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReactivate = async () => {
    await saveProfileExtras(profile.id, {
      offboarded: false,
      offboardDate: undefined,
      offboardingStatus: undefined
    });
    refetchProfiles();
    onUpdate?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white w-full shadow-2xl overflow-hidden rounded-t-2xl md:rounded-2xl max-h-[92vh] md:max-h-[85vh] md:max-w-lg flex flex-col border border-slate-200">
        <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
            <User className="h-4 w-4 text-orange-600" /> Employee Profile Card
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5 overflow-y-auto flex-1 space-y-5">
          {/* Header summary */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <Avatar src={profile.profilePicture} name={displayName(profile, currentUserRole)} size={48} />
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                {displayName(profile, currentUserRole)}
                {profile.offboarded && <Badge variant="danger">Offboarded</Badge>}
              </h3>
              <p className="text-[10px] text-slate-455 font-bold uppercase tracking-wider mt-0.5">{profile.jobTitle || profile.role}</p>
            </div>
          </div>

          {/* Normal profile view details */}
          {!isEditing && !isOffboarding && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Email Address</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5 flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-slate-400" /> {profile.email}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">System Role</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5 flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-slate-400" /> {profile.role}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Base Salary</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5 flex items-center gap-1"><DollarSign className="h-3.5 w-3.5 text-slate-400" /> {formatMoney(profile.baseSalary, profile.region)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Location / Region</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5 flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {profile.region || 'Pakistan'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Joined Date</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5 flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /> {profile.joinedDate}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase" title="PTO accrual is calculated from this date">Account Creation Date</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5 flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /> {profile.accountCreationDate || profile.joinedDate}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Gender</p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5 capitalize">{profile.gender || 'male'}</p>
                </div>
              </div>

              {/* Departments */}
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Departments / Teams</p>
                <div className="flex flex-wrap gap-1">
                  {profile.teams.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">No assigned teams</span>
                  ) : (
                    profile.teams.map(t => <Badge key={t} variant="default">{t}</Badge>)
                  )}
                </div>
              </div>

              {/* Warehouses */}
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Assigned Warehouses</p>
                <div className="flex flex-wrap gap-1">
                  {!profile.assignedWarehouses || profile.assignedWarehouses.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">No warehouses assigned</span>
                  ) : (
                    profile.assignedWarehouses.map(wId => {
                      const wh = warehouses.find(w => w.id === wId);
                      // If this ID doesn't resolve to a current warehouse, it's
                      // almost always a stale/mismatched ID left over from a
                      // past data migration rather than a real "code" — show
                      // it as unresolved instead of printing the raw ID.
                      return <Badge key={wId} variant="success">{wh ? wh.name : 'Unrecognized warehouse (re-assign needed)'}</Badge>;
                    })
                  )}
                </div>
                {(profile.assignedWarehouses || []).some(wId => !warehouses.find(w => w.id === wId)) && canManageThisProfile && (
                  <button
                    type="button"
                    onClick={async () => {
                      const cleaned = (profile.assignedWarehouses || []).filter(wId => warehouses.find(w => w.id === wId));
                      await hrActions.updateProfileDetails(profile.id, { assignedWarehouses: cleaned });
                      refetchProfiles();
                      onUpdate?.();
                    }}
                    className="mt-1.5 text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:underline"
                  >
                    Remove unrecognized warehouse links
                  </button>
                )}
              </div>

              {/* Bank Details */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                <p className="font-bold text-slate-800 flex items-center gap-1">🏦 Bank Information</p>
                {profile.bankName ? (
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600">
                    <div>
                      <span className="block text-[9px] text-slate-400 font-bold">BANK</span>
                      {profile.bankName}
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 font-bold">ACCOUNT</span>
                      {profile.accountNumber}
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[9px] text-slate-400 font-bold">IBAN / ROUTING</span>
                      <span className="font-mono">{profile.iban}</span>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-400 italic text-[11px]">Bank details are not shared yet.</span>
                )}
              </div>

              {/* Offboarding Summary if offboarded */}
              {profile.offboarded && profile.offboardingStatus && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl space-y-2 text-xs">
                  <p className="font-bold text-rose-800 flex items-center gap-1">⚠️ Offboarding Clearance</p>
                  <div className="space-y-1 text-[11px] font-semibold text-rose-700">
                    <p>📅 Offboard Date: {profile.offboardDate}</p>
                    <p className="flex items-center gap-1.5 mt-1">
                      {profile.offboardingStatus.itClearance ? '🟢' : '🔴'} IT Hardware Clearance
                    </p>
                    <p className="flex items-center gap-1.5">
                      {profile.offboardingStatus.financeClearance ? '🟢' : '🔴'} Finance Settlement
                    </p>
                    <p className="flex items-center gap-1.5">
                      {profile.offboardingStatus.hrClearance ? '🟢' : '🔴'} HR Official Signoff
                    </p>
                    {profile.offboardingStatus.finalLeavePayout !== undefined && (
                      <p className="flex items-center gap-1.5 mt-1 pt-1.5 border-t border-rose-200/50">
                        💰 Final PTO/Sick Payout: <span className="font-bold">{formatMoney(profile.offboardingStatus.finalLeavePayout, profile.region)}</span>
                      </p>
                    )}
                    {profile.offboardingStatus.notes && (
                      <p className="mt-2 text-slate-550 border-t border-rose-200/50 pt-1.5 font-medium leading-relaxed">
                        Notes: {profile.offboardingStatus.notes}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              {canManageThisProfile && (
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditing(true)} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-97">
                      Edit Credentials
                    </button>
                    {profile.offboarded ? (
                      <button onClick={handleReactivate} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-97">
                        Reactivate Employee
                      </button>
                    ) : (
                      <button onClick={() => setIsOffboarding(true)} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-97">
                        Offboard Account
                      </button>
                    )}
                  </div>
                  {profile.offboarded && (
                    <div className="space-y-1.5 pt-1">
                      <button
                        type="button"
                        onClick={handleDownloadArchive}
                        disabled={isExportingArchive}
                        className="w-full flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-all active:scale-97 disabled:opacity-60"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {isExportingArchive ? 'Preparing download…' : hasDownloadedArchive ? 'Re-download Employee Data' : 'Download Employee Data First'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={!hasDownloadedArchive}
                        title={!hasDownloadedArchive ? "Download this employee's data first — deletion is permanent and cannot be undone." : undefined}
                        className="w-full flex items-center justify-center gap-1.5 bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 font-bold py-2.5 rounded-xl text-xs transition-all active:scale-97 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete Account Permanently
                      </button>
                      {!hasDownloadedArchive && (
                        <p className="text-[10px] text-slate-400 font-medium text-center">
                          Download their data first — includes documents, payroll, leave/task/ticket history, and screenshots. Deletion cannot be undone.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Edit form */}
          {isEditing && (
            <form onSubmit={handleSaveChanges} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Full Name *</label>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-orange-500 font-semibold" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Alias <span className="normal-case font-medium text-slate-400">(shown to their team instead of their real name)</span></label>
                <input type="text" value={alias} onChange={e => setAlias(e.target.value)} placeholder="e.g. Falcon, Agent-07, Employee 14" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-orange-500 font-semibold" />
                <p className="text-[10px] text-slate-400 font-medium">Only HR/Admin ever see the real name. Leave blank to show the real name to everyone (not recommended once this is enforced in production).</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Email Address *</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-orange-500 font-semibold" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Account Password *</label>
                <input type="text" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-orange-500 font-semibold" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Job Title / Designation</label>
                  <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-orange-500 font-semibold" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Base Salary</label>
                  <input type="number" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-orange-500 font-semibold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Region / Base Location</label>
                  <select value={region} onChange={e => setRegion(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-orange-500 font-semibold cursor-pointer">
                    <option value="Pakistan">Pakistan</option>
                    <option value="USA">USA</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Gender</label>
                  <select value={gender} onChange={e => setGender(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-orange-500 font-semibold cursor-pointer">
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">System Role *</label>
                <select value={role} onChange={e => setRole(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-orange-500 font-semibold cursor-pointer">
                  <option value="employee">Employee</option>
                  <option value="team_lead">Team Lead</option>
                  <option value="hr">HR Admin</option>
                  {currentUserRole === 'admin' && <option value="admin">System Admin</option>}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Joining Date *</label>
                  <input
                    type="date"
                    required
                    value={joinedDate}
                    onChange={e => setJoinedDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-orange-500 font-semibold cursor-pointer"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase" title="Salary tracking starts from this month">Salary Track Month *</label>
                  <input
                    type="date"
                    required
                    value={salaryStartDate}
                    onChange={e => setSalaryStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-orange-500 font-semibold cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase" title="PTO accrual is calculated from this date instead of the joining date">
                  Account Creation Date *
                </label>
                <input
                  type="date"
                  required
                  value={accountCreationDate}
                  onChange={e => setAccountCreationDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-orange-500 font-semibold cursor-pointer"
                />
                <p className="text-[9px] text-slate-400 font-semibold">PTO accrual is calculated from this date, not the joining date.</p>
              </div>

              {/* Warehouse selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Assigned Warehouses</label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  {warehouses.map(wh => (
                    <label key={wh.id} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assignedWarehouses.includes(wh.id)}
                        onChange={e => {
                          if (e.target.checked) setAssignedWarehouses(prev => [...prev, wh.id]);
                          else setAssignedWarehouses(prev => prev.filter(id => id !== wh.id));
                        }}
                        className="rounded border-slate-350 text-orange-655 focus:ring-orange-500"
                      />
                      {wh.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs">
                  Cancel
                </button>
                <button type="submit" className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-xl text-xs">
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* Offboarding checklist form */}
          {isOffboarding && (
            <form onSubmit={handleOffboardSubmit} className="space-y-4">
              <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl space-y-1.5">
                <p className="font-bold text-rose-800 text-xs flex items-center gap-1.5"><ShieldAlert className="h-4 w-4" /> Account Offboarding Checklist</p>
                <p className="text-[11px] text-rose-700 font-semibold leading-relaxed">
                  Completing this checklist deactivates this user's account and blocks all access to the workspace immediately.
                </p>
              </div>

              <div className="p-3.5 bg-emerald-50 border border-emerald-150 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Final PTO/Sick Bank Payout</p>
                  <p className="text-[9px] text-emerald-600 font-semibold mt-0.5">
                    {getRemainingPTO(leaves, profile.fullName, getPTOAccrualDate(profile))} remaining days × daily rate (monthly salary ÷ 22)
                  </p>
                </div>
                <p className="text-lg font-bold text-emerald-800">{formatMoney(getFinalLeavePayout(profile, leaves), profile.region)}</p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itClearance}
                    onChange={e => setItClearance(e.target.checked)}
                    className="rounded border-slate-350 text-orange-655 focus:ring-orange-500"
                  />
                  1. IT Hardware Clearance & Assets Recovered
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={financeClearance}
                    onChange={e => setFinanceClearance(e.target.checked)}
                    className="rounded border-slate-350 text-orange-655 focus:ring-orange-500"
                  />
                  2. Finance Account Settlement & Pending dues paid
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hrClearance}
                    onChange={e => setHrClearance(e.target.checked)}
                    className="rounded border-slate-350 text-orange-655 focus:ring-orange-500"
                  />
                  3. HR Resignation clearance signed off
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Offboarding Notes / Reason</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Reason for resignation or termination checklist notes..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs outline-none focus:border-orange-500 font-semibold resize-none"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsOffboarding(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs">
                  Cancel
                </button>
                <button type="submit" className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs">
                  Deactivate & Offboard
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showOffboardConfirm}
        onClose={() => setShowOffboardConfirm(false)}
        onConfirm={confirmOffboard}
        title="Offboard this employee?"
        message={`This will deactivate ${profile.fullName}'s account and immediately block all access to the workspace. A final PTO/Sick bank payout of ${formatMoney(getFinalLeavePayout(profile, leaves), profile.region)} will be recorded. Their record stays in the system as "Offboarded" and can be reactivated later.`}
        confirmLabel="Yes, Offboard"
        variant="warning"
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => !isDeleting && setShowDeleteConfirm(false)}
        onConfirm={confirmDeletePermanently}
        title="Permanently delete this account?"
        message={`This will completely and irreversibly purge ${profile.fullName} from the database: profile, uploaded documents (CV/passport/ID), payroll history, leave applications, tasks, tickets, timesheets, screenshots, and their tracking device access. This cannot be undone — make sure you've downloaded a copy first.`}
        confirmLabel={isDeleting ? 'Deleting…' : 'Delete Permanently'}
        variant="danger"
        requireTextMatch="DELETE"
      />
    </div>
  );
}
