'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  useProfiles, useTimesheets, useAnnouncements, useWarehouses, useLeaves, useTasks, usePayroll, useTeams,
  hrActions, calculatePTOAccrued, getPTOAccrualDate, LeaveApplication, Profile, Task, Warehouse, TimesheetEntry,
  displayName,
} from '@/lib/hrData';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Clock, CheckCircle2, ChevronRight, AlertTriangle, Briefcase, Calendar, User, Flag, Monitor, MapPin, LocateFixed } from 'lucide-react';
import { checkGeofence } from '@/lib/geofence';
import { useRouter } from 'next/navigation';

const PRIORITY_STYLES: Record<Task['priority'], string> = {
  high:   'bg-rose-100 text-rose-800 border-rose-200',
  medium: 'bg-orange-100 text-orange-800 border-orange-200',
  low:    'bg-slate-100 text-slate-650 border-slate-200',
};

const STATUS_STYLES: Record<Task['status'], string> = {
  todo:        'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  done:        'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const STATUS_LABELS: Record<Task['status'], string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  done:        'Done',
};

export default function EmployeeDashboard() {
  const { data: allProfiles } = useProfiles();
  const { data: allLeaves } = useLeaves();
  const { data: allTasks, refetch: refetchTasks } = useTasks();
  const { data: allAnnouncements } = useAnnouncements();
  const { data: allWarehouses } = useWarehouses();
  const { data: allTimesheets, refetch: refetchTimesheets } = useTimesheets();
  const { data: allPayroll } = usePayroll();
  const { data: allTeams } = useTeams();

  const router = useRouter();
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New States
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<Profile[]>([]);
  
  // Geofencing states
  const [shiftActive, setShiftActive] = useState(false);
  const [geofenceStatus, setGeofenceStatus] = useState('Outside Geofence');
  const [geoPermission, setGeoPermission] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'>('idle');
  const [geoErrorMsg, setGeoErrorMsg] = useState('');
  const [liveDistance, setLiveDistance] = useState<{ meters: number; warehouseName: string; isInside: boolean } | null>(null);

  const profileRef = useRef<Profile | null>(null);
  const warehousesRef = useRef<Warehouse[]>([]);
  const shiftActiveRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);

  // Detailed Task Modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Team Lead review tracker states
  const [selectedReviewEmp, setSelectedReviewEmp] = useState<Profile | null>(null);
  const [reviewEntries, setReviewEntries] = useState<TimesheetEntry[]>([]);

  const handleOpenReviewModal = (emp: Profile) => {
    setSelectedReviewEmp(emp);
    // Real, Supabase-synced shift history — visible regardless of which
    // device/region the employee actually clocked in from.
    const entries = (allTimesheets || [])
      .filter(t => t.employeeEmail.toLowerCase() === emp.email.toLowerCase())
      .sort((a, b) => (b.clockIn || '').localeCompare(a.clockIn || ''));
    setReviewEntries(entries);
  };

  useEffect(() => {
    if (!allProfiles || !allLeaves || !allTasks || !allAnnouncements || !allWarehouses || !allTimesheets) return;

    const email = localStorage.getItem('user_email');
    const employees = allProfiles;
    const profile = employees.find(e => e.email && email && e.email.toLowerCase() === email.toLowerCase());
    if (profile) {
      setUserProfile(profile);
      const openShift = allTimesheets.find(t => t.employeeEmail.toLowerCase() === (profile.email).toLowerCase() && !t.clockOut);
      setShiftActive(!!openShift);
      if (openShift) {
        setGeofenceStatus(profile.region === 'USA' ? 'Inside Warehouse' : 'Shift Active');
      }
    }
    
    setAllEmployees(employees);
    setAnnouncements(allAnnouncements);
    setWarehouses(allWarehouses);
    if (profile) {
      setLeaves(allLeaves.filter(l => l.employeeName === profile.fullName) as any);
      setMyTasks(allTasks.filter(t => t.assignedEmail === profile.email));
    }

    const handleSearch = (e: Event) => {
      setSearchQuery((e as CustomEvent).detail || '');
    };
    window.addEventListener('globalSearch', handleSearch);
    return () => window.removeEventListener('globalSearch', handleSearch);
  }, [allProfiles, allLeaves, allTasks, allAnnouncements, allWarehouses, allTimesheets]);

  // Keep refs in sync so the long-lived geolocation callback always reads
  // fresh data without needing to be re-registered on every render.
  useEffect(() => { profileRef.current = userProfile; }, [userProfile]);
  useEffect(() => { warehousesRef.current = warehouses; }, [warehouses]);
  useEffect(() => { shiftActiveRef.current = shiftActive; }, [shiftActive]);

  // Real GPS-based geofencing — USA employees only. Automatically starts/ends
  // the shift as the employee's device enters or leaves the radius of any
  // warehouse assigned to them. Remote (Pakistan) employees use manual
  // Start/End Shift controls instead (rendered further below) and never
  // trigger this effect.
  useEffect(() => {
    if (!userProfile || userProfile.region !== 'USA') return;

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoPermission('unsupported');
      return;
    }

    setGeoPermission('requesting');

    const handleSuccess = async (position: GeolocationPosition) => {
      setGeoPermission('granted');
      setGeoErrorMsg('');

      const profile = profileRef.current;
      if (!profile) return;

      const assigned = warehousesRef.current.filter(w => profile.assignedWarehouses?.includes(w.id));
      if (assigned.length === 0) {
        setLiveDistance(null);
        return;
      }

      const { isInside, nearestWarehouse, distanceMeters } = checkGeofence(
        position.coords.latitude,
        position.coords.longitude,
        assigned
      );

      if (nearestWarehouse && distanceMeters !== null) {
        setLiveDistance({ meters: Math.round(distanceMeters), warehouseName: nearestWarehouse.name, isInside });
      }

      if (isInside && !shiftActiveRef.current && nearestWarehouse) {
        shiftActiveRef.current = true;
        setShiftActive(true);
        setGeofenceStatus(`Inside ${nearestWarehouse.name}`);
        await hrActions.clockIn(profile.email);
        await refetchTimesheets();
        await hrActions.addNotification(profile.email, 'employee', `Auto Shift ON: Checked-in at ${nearestWarehouse.name} via GPS geofencing.`);
        await hrActions.addNotification('all', 'hr', `${profile.fullName} checked-in at ${nearestWarehouse.name} via geofencing.`);
        await hrActions.addNotification('all', 'admin', `${profile.fullName} checked-in at ${nearestWarehouse.name} via geofencing.`);
      } else if (!isInside && shiftActiveRef.current) {
        const whName = nearestWarehouse ? nearestWarehouse.name : 'the warehouse';
        shiftActiveRef.current = false;
        setShiftActive(false);
        setGeofenceStatus('Outside Geofence');
        await hrActions.clockOut(profile.email);
        await refetchTimesheets();
        await hrActions.addNotification(profile.email, 'employee', `Auto Shift OFF: Left the geofence at ${whName}.`);
        await hrActions.addNotification('all', 'hr', `${profile.fullName} checked-out (left warehouse geofence at ${whName}).`);
        await hrActions.addNotification('all', 'admin', `${profile.fullName} checked-out (left warehouse geofence at ${whName}).`);
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      setGeoPermission('denied');
      setGeoErrorMsg(
        err.code === err.PERMISSION_DENIED
          ? 'Location access denied. Enable location permissions for this site in your browser settings to allow automatic warehouse check-in.'
          : (err.message || 'Unable to determine your location.')
      );
    };

    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 20000,
    });
    watchIdRef.current = watchId;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [userProfile?.email, userProfile?.region]);

  const handleUpdateTaskStatus = async (taskId: string, nextStatus: Task['status']) => {
    await hrActions.updateTaskStatus(taskId, nextStatus);
    await refetchTasks();
    setSelectedTask(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'hr_approved':
        return <Badge variant="default">HR Approved</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  // Find my team details
  const myTeams = userProfile && userProfile.teams ? userProfile.teams : [];
  const teamMembers = (allProfiles || []).filter(emp => 
    emp.id !== userProfile?.id && 
    emp.teams && Array.isArray(emp.teams) &&
    emp.teams.some(t => myTeams.includes(t))
  );
  const teamLead = (allProfiles || []).find(emp => 
    emp.isTeamLead && 
    emp.leadTeams?.some(t => myTeams.includes(t))
  );

  // Filter announcements for current employee
  const myAnnouncements = announcements.filter(ann => {
    if (ann.target === 'all') return true;
    if (userProfile?.region === 'USA' && ann.target === 'usa') return true;
    if (userProfile?.region === 'Pakistan' && ann.target === 'pakistan') return true;
    if (Array.isArray(ann.target) && userProfile?.assignedWarehouses) {
      return ann.target.some((wId: string) => userProfile.assignedWarehouses?.includes(wId));
    }
    return false;
  });

  return (
    <div className="space-y-4 md:space-y-6 font-sans px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-slate-200 p-4 md:p-6 rounded-xl shadow-sm">
        <div className="flex items-center gap-3 md:gap-4">
          <Avatar src={userProfile?.profilePicture} name={userProfile?.fullName || 'Employee'} size={56} className="border-2 border-orange-500" />
          <div>
            <h1 className="text-lg md:text-xl font-bold text-slate-900">{userProfile?.fullName || 'Employee'}</h1>
            <p className="text-xs text-slate-500 font-semibold">{userProfile?.jobTitle || 'Team Member'} · <span className="text-orange-655 font-bold">{userProfile?.region === 'USA' ? 'USA Operations' : 'Pakistan (Remote)'}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 px-3.5 py-2.5 md:py-2 rounded-xl font-bold text-slate-600">
          🏦 {userProfile?.bankName ? `${userProfile.bankName} (Verified)` : 'Bank details pending'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column (8 cols): Stats, Tasks, Leaves */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Leave Balance (PTO + Sick)</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {userProfile ? Math.max(0, calculatePTOAccrued(getPTOAccrualDate(userProfile)) - (allLeaves || []).filter(l => l.employeeName === userProfile.fullName && l.status === 'approved' && ['PTO', 'Sick Leave'].includes(l.type)).length) : 0} Days
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                    <Clock className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Total Accrued This Cycle</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {userProfile ? calculatePTOAccrued(getPTOAccrualDate(userProfile)) : 0} Days
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Shift Status</p>
                    <p className={`text-2xl font-bold mt-1 ${shiftActive ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {shiftActive ? 'ON SHIFT' : 'OFF SHIFT'}
                    </p>
                  </div>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center border ${shiftActive ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                    <Flag className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tasks list */}
          {myTasks.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">My Assigned Tasks ({myTasks.length})</h2>
              <div className="space-y-2">
                {myTasks.map(task => {
                  const isOverdue = task.status !== 'done' && new Date(task.dueDate) < new Date();
                  const isDueSoon = !isOverdue && task.status !== 'done' && (new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24) <= 3;
                  return (
                    <Card 
                      key={task.id} 
                      onClick={() => setSelectedTask(task)}
                      className={`p-4 border transition-all cursor-pointer hover:border-orange-350 hover:shadow-sm group ${isOverdue ? 'border-rose-250 bg-rose-50/10' : task.status === 'done' ? 'opacity-70 border-emerald-100 bg-emerald-50/5' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={`font-bold text-sm text-slate-900 ${task.status === 'done' ? 'line-through opacity-50' : ''}`}>{task.title}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${PRIORITY_STYLES[task.priority]}`}>{task.priority}</span>
                            {isOverdue && <span className="text-[9px] font-bold text-rose-700 bg-rose-100 border border-rose-200 px-1.5 py-0.2 rounded-full">OVERDUE</span>}
                            {isDueSoon && <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.2 rounded-full">DUE SOON</span>}
                          </div>
                          {task.description && <p className="text-xs text-slate-500 mb-1.5 line-clamp-1">{task.description}</p>}
                          <p className="text-[10px] text-slate-400 font-semibold">📅 Due: {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {task.team}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[task.status]}`}>{STATUS_LABELS[task.status]}</span>
                          <ChevronRight className="h-4 w-4 text-slate-350 group-hover:text-orange-500 transition-colors" />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Leaves History */}
          <div className="space-y-3">
            <h2 className="text-base font-bold text-slate-900">Recent Leave Requests</h2>
            <Card className="overflow-hidden p-0 border border-slate-200 bg-white">
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[500px] text-xs text-left border-collapse">
                  <thead className="font-bold text-slate-550 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Duration</th>
                      <th className="px-5 py-3">Reason</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {leaves
                      .filter(l => 
                        l.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        l.reason.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((leave) => (
                        <tr key={leave.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3.5 font-bold text-slate-900">{leave.type}</td>
                          <td className="px-5 py-3.5 text-slate-600 font-medium">{leave.duration}</td>
                          <td className="px-5 py-3.5 text-slate-500">{leave.reason}</td>
                          <td className="px-5 py-3.5">{getStatusBadge(leave.status)}</td>
                        </tr>
                      ))}
                    {leaves.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400 font-semibold italic">No leave history found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Mobile card stack */}
              <div className="md:hidden space-y-2 p-3">
                {leaves
                  .filter(l =>
                    l.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    l.reason.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((leave) => (
                    <div key={leave.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-900">{leave.type}</p>
                        {getStatusBadge(leave.status)}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Duration</p>
                          <p className="text-xs font-semibold text-slate-700">{leave.duration}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Reason</p>
                          <p className="text-xs font-semibold text-slate-700">{leave.reason}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                {leaves.length === 0 && (
                  <p className="py-6 text-center text-slate-400 font-semibold italic text-xs">No leave history found.</p>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Right Column (4 cols): Geofencing, Announcements, Team, Referral */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Geofencing & Location Check-In Widget */}
          <Card className="border border-slate-200 bg-white">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Flag className="h-4 w-4 text-orange-600" /> Geofencing Tracker
              </h3>
              <span className={`h-2.5 w-2.5 rounded-full ${shiftActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-350'}`} />
            </div>
            <CardContent className="p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-150 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-500">Location Status:</span>
                  <span className={`font-bold px-2 py-0.5 rounded-md ${shiftActive ? 'text-emerald-700 bg-emerald-50 border border-emerald-250' : 'text-slate-600 bg-slate-100'}`}>
                    {geofenceStatus}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2.5 pt-2.5 border-t border-slate-100">
                  <span className="font-bold text-slate-500">Auto Shift Logic:</span>
                  <span className="text-slate-450 font-bold">
                    {userProfile?.region === 'USA' ? 'Enabled (Geofencing)' : 'Disabled (Manual)'}
                  </span>
                </div>
              </div>

              {userProfile?.region === 'USA' ? (
                <div className="space-y-2.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <LocateFixed className="h-3 w-3" /> Live GPS Geofencing
                  </p>

                  {(!userProfile.assignedWarehouses || userProfile.assignedWarehouses.length === 0) ? (
                    <p className="text-[10px] text-slate-400 italic">No warehouses assigned by HR yet — geofenced check-in will activate once a warehouse is assigned to your profile.</p>
                  ) : geoPermission === 'unsupported' ? (
                    <p className="text-[10px] text-rose-600 font-semibold leading-relaxed">
                      Your browser/device does not support GPS location. Automatic geofenced check-in is unavailable here — please use a modern mobile or desktop browser.
                    </p>
                  ) : geoPermission === 'denied' ? (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-150 space-y-2">
                      <p className="text-[10px] text-rose-700 font-semibold leading-relaxed">{geoErrorMsg}</p>
                      <button
                        onClick={() => window.location.reload()}
                        className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-lg text-[10px] transition-all active:scale-97"
                      >
                        Retry Location Access
                      </button>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-150 space-y-1.5">
                      <p className="text-[10px] text-slate-500 font-semibold leading-relaxed flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-orange-500 shrink-0" />
                        {geoPermission === 'requesting' && !liveDistance
                          ? 'Acquiring your location…'
                          : liveDistance
                            ? `${liveDistance.isInside ? 'Inside' : liveDistance.meters + 'm from'} ${liveDistance.warehouseName}`
                            : 'Waiting for GPS signal…'}
                      </p>
                      <p className="text-[9px] text-slate-400 leading-relaxed">
                        Your shift starts and ends automatically as you enter or leave an assigned warehouse's geofence — no manual check-in needed.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shift Controls</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={async () => {
                        if (!userProfile?.email) return;
                        setShiftActive(true);
                        setGeofenceStatus('Shift Active');
                        await hrActions.clockIn(userProfile.email);
                        await refetchTimesheets();
                        // Screen tracking (if this employee has the desktop
                        // agent installed) automatically follows the active shift state
                        // via the timesheets table check inside the agent itself.
                        await hrActions.addNotification(userProfile.email, 'employee', 'Shift started manually. Screen tracking is now active for this shift.');
                        await hrActions.addNotification('all', 'hr', `${userProfile.fullName} started shift manually.`);
                        await hrActions.addNotification('all', 'admin', `${userProfile.fullName} started shift manually.`);
                      }}
                      disabled={shiftActive}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all active:scale-97 text-center shadow-sm"
                    >
                      Start Shift
                    </button>
                    <button
                      onClick={async () => {
                        if (!userProfile?.email) return;
                        setShiftActive(false);
                        setGeofenceStatus('Shift Ended');
                        await hrActions.clockOut(userProfile.email);
                        await refetchTimesheets();
                        await hrActions.addNotification(userProfile.email, 'employee', 'Shift ended manually. Screen tracking has stopped.');
                        await hrActions.addNotification('all', 'hr', `${userProfile.fullName} ended shift manually.`);
                        await hrActions.addNotification('all', 'admin', `${userProfile.fullName} ended shift manually.`);
                      }}
                      disabled={!shiftActive}
                      className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all active:scale-97 text-center shadow-sm"
                    >
                      End Shift
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-relaxed">
                    If your account has screen tracking configured by HR/Admin, starting a shift activates it for the duration of your shift; ending your shift turns it off.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Announcements Feed Widget */}
          <Card className="border border-slate-200 bg-white">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Company Announcements</h3>
            </div>
            <CardContent className="p-4 space-y-3 max-h-64 overflow-y-auto">
              {myAnnouncements.map(ann => (
                <div key={ann.id} className="p-3 rounded-lg border border-slate-150 bg-slate-50/50 text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-900 truncate pr-2" title={ann.title}>{ann.title}</span>
                    <span className="text-[9px] text-slate-400 font-medium shrink-0">{ann.timestamp.split(' ')[0]}</span>
                  </div>
                  <p className="text-slate-550 leading-relaxed mt-1 font-medium">{ann.content}</p>
                </div>
              ))}
              {myAnnouncements.length === 0 && (
                <p className="text-xs text-slate-400 font-semibold italic text-center py-2">No announcements for your region.</p>
              )}
            </CardContent>
          </Card>

          {/* Team Monitor (For Team Leads Only) */}
          {userProfile?.isTeamLead && (
            <Card className="border-t-4 border-t-purple-500 bg-white">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  ⭐ Team Tracker Monitor
                </h3>
                <Badge variant="default">Lead</Badge>
              </div>
              <CardContent className="p-4 space-y-3">
                <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">Monitor the active workstation tracking logs of the members you lead:</p>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {allEmployees
                    .filter(emp => emp.id !== userProfile.id && emp.teams && emp.teams.some(t => userProfile.leadTeams?.includes(t)))
                    .map(member => (
                      <div key={member.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-150 bg-slate-50/50 text-xs font-semibold">
                        <div className="flex items-center gap-2">
                        <Avatar src={member.profilePicture} name={displayName(member, userProfile?.role)} size={24} />
                          <div className="truncate max-w-[110px]">
                            <div className="font-bold text-slate-800 truncate">{displayName(member, userProfile?.role)}</div>
                            <div className="text-[9px] text-slate-450 font-semibold truncate">{member.jobTitle || 'Staff'}</div>
                          </div>
                        </div>
                        {member.trackingEnabled ? (
                          <button
                            onClick={() => handleOpenReviewModal(member)}
                            className="text-[9px] font-bold text-slate-650 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded-lg active:scale-97 transition-all flex items-center gap-1 shrink-0"
                          >
                            Review
                          </button>
                        ) : (
                          <span className="text-[9px] text-slate-400 italic shrink-0">No Tracking</span>
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* My Team & Team Lead Widget */}
          <Card className="border border-slate-200 bg-white">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">My Team ({userProfile?.teams.join(', ')})</h3>
            </div>
            <CardContent className="p-4 space-y-3">
              {/* Team Lead */}
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Team Lead</p>
                {teamLead ? (
                  <div className="flex items-center gap-2.5 bg-purple-50/80 border border-purple-100 p-2.5 rounded-lg text-xs">
                  <Avatar src={teamLead.profilePicture} name={displayName(teamLead, userProfile?.role)} size={24} />
                    <div>
                      <div className="font-bold text-slate-800">⭐ {displayName(teamLead, userProfile?.role)}</div>
                      <div className="text-[10px] text-slate-450 font-semibold">{teamLead.email}</div>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 font-semibold italic">No lead assigned to this team.</span>
                )}
              </div>

              {/* Members */}
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Co-Workers</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {teamMembers.map(member => (
                    <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-white text-xs">
                    <Avatar src={member.profilePicture} name={displayName(member, userProfile?.role)} size={20} />
                      <div className="truncate">
                        <div className="font-semibold text-slate-800 truncate">{displayName(member, userProfile?.role)}</div>
                        <div className="text-[9px] text-slate-400 truncate">{member.email}</div>
                      </div>
                    </div>
                  ))}
                  {teamMembers.length === 0 && (
                    <span className="text-xs text-slate-400 italic font-semibold">You are the only member in this team.</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Job Referral Widget */}
          <Card className="border border-slate-200 bg-white">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Candidate Referrals</h3>
            </div>
            <CardContent className="p-5 space-y-3.5 text-xs text-slate-655 leading-relaxed font-semibold">
              <p>Refer candidates to our open positions! If your referral gets hired and completes <strong>6 months</strong> of service, you will receive a bonus reward:</p>
              <div className="bg-emerald-50 border border-emerald-150 text-emerald-800 p-3 rounded-xl font-bold text-center text-sm">
                🎁 Referral Bonus: PKR 10,000
              </div>
              <button 
                onClick={() => router.push('/employee/careers')} 
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-bold py-2.5 md:py-2 rounded-lg text-xs hover:bg-slate-100 transition-all active:scale-97 text-center"
              >
                View open positions to refer →
              </button>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <Modal isOpen onClose={() => setSelectedTask(null)} title="Task Details">
          <div className="space-y-4">
            <div className="flex gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[selectedTask.priority]}`}>
                {selectedTask.priority} priority
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[selectedTask.status]}`}>
                {STATUS_LABELS[selectedTask.status]}
              </span>
            </div>
            
            <div>
              <h3 className="font-bold text-lg text-slate-900">{selectedTask.title}</h3>
              {selectedTask.description && (
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{selectedTask.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
              <div>
                <p className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Due Date</p>
                <p className="font-semibold text-slate-800 mt-0.5">{new Date(selectedTask.dueDate).toLocaleDateString('en-US', { dateStyle: 'medium' })}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Department</p>
                <p className="font-semibold text-slate-800 mt-0.5">{selectedTask.team}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
              {selectedTask.status === 'todo' && (
                <button
                  onClick={() => handleUpdateTaskStatus(selectedTask.id, 'in_progress')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 md:py-2 rounded-lg text-xs"
                >
                  Start Task
                </button>
              )}
              {selectedTask.status === 'in_progress' && (
                <button
                  onClick={() => handleUpdateTaskStatus(selectedTask.id, 'done')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 md:py-2 rounded-lg text-xs"
                >
                  Mark Completed
                </button>
              )}
              <button
                onClick={() => setSelectedTask(null)}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2.5 md:py-2 rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Employee Activity & Timesheet Review Modal */}
      {selectedReviewEmp && (
        <Modal isOpen onClose={() => setSelectedReviewEmp(null)} title="Workstation Timesheet & Activity Review" className="md:max-w-3xl">
          <div className="space-y-6 pt-1 font-sans">
            <div className="flex justify-between items-start bg-slate-50 p-4 border border-slate-200 rounded-xl">
              <div>
                <p className="text-xs text-slate-500 font-semibold">Reviewing Employee</p>
                <p className="text-sm font-bold text-slate-900">{displayName(selectedReviewEmp, userProfile?.role)}</p>
                <p className="text-[10px] text-slate-455 font-bold">{selectedReviewEmp.email} · {selectedReviewEmp.jobTitle || 'Staff'}</p>
              </div>
              <Badge variant={selectedReviewEmp.region === 'USA' ? 'default' : 'success'}>
                {selectedReviewEmp.region === 'USA' ? 'USA Operations' : 'Pakistan Remote'}
              </Badge>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Real Shift History (Clock-In / Clock-Out)</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="font-bold text-slate-555 bg-slate-50 border-b border-slate-200 uppercase tracking-widest text-[9px]">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Clock In</th>
                        <th className="px-4 py-2.5">Clock Out</th>
                        <th className="px-4 py-2.5 text-right">Duration</th>
                        <th className="px-4 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {reviewEntries.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-bold text-slate-700">{entry.date}</td>
                          <td className="px-4 py-3 text-slate-600 font-medium font-mono text-[10px]">{entry.clockIn ? new Date(entry.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                          <td className="px-4 py-3 text-slate-600 font-medium font-mono text-[10px]">{entry.clockOut ? new Date(entry.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">{entry.duration || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <Badge variant={entry.status === 'in_progress' ? 'warning' : 'success'}>
                              {entry.status === 'in_progress' ? 'On Shift' : 'Completed'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      {reviewEntries.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 font-semibold italic">No real shift history recorded yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Mobile card stack */}
                <div className="md:hidden space-y-2 p-3">
                  {reviewEntries.map((entry, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-900">{entry.date}</p>
                        <Badge variant={entry.status === 'in_progress' ? 'warning' : 'success'}>
                          {entry.status === 'in_progress' ? 'On Shift' : 'Completed'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Clock In / Out</p>
                          <p className="text-xs font-semibold text-slate-700 font-mono">
                            {entry.clockIn ? new Date(entry.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                            {' → '}
                            {entry.clockOut ? new Date(entry.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Duration</p>
                          <p className="text-xs font-bold text-slate-900">{entry.duration || '—'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {reviewEntries.length === 0 && (
                    <p className="py-6 text-center text-slate-400 font-semibold italic text-xs">No real shift history recorded yet.</p>
                  )}
                </div>
              </div>
              <div className="space-y-3">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Workspace Screenshots</h4>
              <div className="border border-slate-200 p-6 rounded-xl bg-slate-50/50 text-center space-y-2 font-sans">
                <Monitor className="h-6 w-6 text-slate-350 mx-auto" />
                <div>
                  <h5 className="text-xs font-bold text-slate-700">Desktop Capture Offline</h5>
                  <p className="text-[10px] text-slate-455 leading-relaxed font-semibold mt-1">
                    This feature will be available soon (requires Windows client agent installation).
                  </p>
                </div>
              </div>
            </div>            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200">
              <button
                onClick={() => setSelectedReviewEmp(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2 rounded-lg text-xs"
              >
                Close Logs
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
