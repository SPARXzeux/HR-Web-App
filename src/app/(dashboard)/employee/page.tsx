'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Clock, CheckCircle2, ChevronRight, AlertTriangle, Briefcase, Calendar, User, Flag, Monitor } from 'lucide-react';
import { db, LeaveApplication, Profile, Task } from '@/lib/db';
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
  const [isSimulatedInside, setIsSimulatedInside] = useState<string | null>(null);

  // Detailed Task Modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Team Lead review tracker states
  const [selectedReviewEmp, setSelectedReviewEmp] = useState<Profile | null>(null);
  const [reviewEntries, setReviewEntries] = useState<any[]>([]);

  const handleOpenReviewModal = (emp: Profile) => {
    setSelectedReviewEmp(emp);
    const key = `timesheets_${emp.email}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      setReviewEntries(JSON.parse(saved));
    } else {
      setReviewEntries([]);
    }
  };

  useEffect(() => {
    const email = localStorage.getItem('user_email');
    const employees = db.getEmployees();
    const profile = employees.find(e => e.email === email);
    if (profile) {
      setUserProfile(profile);
      const savedShift = localStorage.getItem(`shift_active_${profile.email}`) === 'true';
      setShiftActive(savedShift);
      if (savedShift) {
        setGeofenceStatus(profile.region === 'USA' ? 'Inside Warehouse' : 'Shift Active');
      }
    }
    
    setAllEmployees(employees);
    setAnnouncements(db.getAnnouncements());
    setWarehouses(db.getWarehouses());

    const allLeaves = db.getLeaves();
    const allTasks = db.getTasks();
    if (profile) {
      setLeaves(allLeaves.filter(l => l.employeeName === profile.fullName));
      setMyTasks(allTasks.filter(t => t.assignedEmail === profile.email));
    }

    const handleSearch = (e: Event) => {
      setSearchQuery((e as CustomEvent).detail || '');
    };
    window.addEventListener('globalSearch', handleSearch);
    return () => window.removeEventListener('globalSearch', handleSearch);
  }, []);

  const handleSimulateGeofence = (whId: string | null) => {
    if (!userProfile) return;
    
    if (whId) {
      const wh = warehouses.find(w => w.id === whId);
      if (wh) {
        setIsSimulatedInside(whId);
        setGeofenceStatus(`Inside ${wh.name}`);
        setShiftActive(true);
        localStorage.setItem(`shift_active_${userProfile.email}`, 'true');
        db.addNotification(userProfile.email, 'employee', `Auto Shift ON: Checked-in at ${wh.name}.`);
        db.addNotification('all', 'hr', `${userProfile.fullName} checked-in at ${wh.name} via geofencing.`);
      }
    } else {
      if (isSimulatedInside) {
        const wh = warehouses.find(w => w.id === isSimulatedInside);
        const whName = wh ? wh.name : 'warehouse';
        setIsSimulatedInside(null);
        setGeofenceStatus('Outside Geofence');
        setShiftActive(false);
        localStorage.setItem(`shift_active_${userProfile.email}`, 'false');
        db.addNotification(userProfile.email, 'employee', `Auto Shift OFF: Checked-out from ${whName}.`);
        db.addNotification('all', 'hr', `${userProfile.fullName} checked-out from ${whName} via geofencing.`);
      }
    }
  };

  const handleUpdateTaskStatus = (taskId: string, nextStatus: Task['status']) => {
    const updated = db.updateTaskStatus(taskId, nextStatus);
    const email = localStorage.getItem('user_email');
    setMyTasks(updated.filter(t => t.assignedEmail === email));
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
  const myTeams = userProfile ? userProfile.teams : [];
  const teamMembers = allEmployees.filter(emp => 
    emp.id !== userProfile?.id && 
    emp.teams.some(t => myTeams.includes(t))
  );
  const teamLead = allEmployees.find(emp => 
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
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
        <div className="flex items-center gap-4">
          <img 
            src={userProfile?.profilePicture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop'} 
            alt="Profile Preview" 
            className="h-14 w-14 rounded-full object-cover border-2 border-orange-500 shadow-sm" 
          />
          <div>
            <h1 className="text-xl font-bold text-slate-900">{userProfile?.fullName || 'Employee'}</h1>
            <p className="text-xs text-slate-500 font-semibold">{userProfile?.jobTitle || 'Team Member'} · <span className="text-orange-655 font-bold">{userProfile?.region === 'USA' ? 'USA Operations' : 'Pakistan (Remote)'}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl font-bold text-slate-600">
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
                    <p className="text-xs font-semibold text-slate-500">PTO Balance</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">12 Days</p>
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
                    <p className="text-xs font-semibold text-slate-500">Sick Leave</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">5 Days</p>
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
              <div className="overflow-x-auto">
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
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Simulate Warehouse Entry/Exit</p>
                  {warehouses
                    .filter(wh => userProfile.assignedWarehouses?.includes(wh.id))
                    .map(wh => {
                      const isInside = isSimulatedInside === wh.id;
                      return (
                        <button
                          key={wh.id}
                          onClick={() => handleSimulateGeofence(isInside ? null : wh.id)}
                          className={`w-full text-left p-2.5 rounded-xl border text-xs font-bold transition-all active:scale-97 flex justify-between items-center ${
                            isInside 
                              ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/50' 
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>{isInside ? 'Simulate Exit:' : 'Simulate Enter:'} {wh.name}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{wh.radius}m fence</span>
                        </button>
                      );
                    })}
                  {(!userProfile.assignedWarehouses || userProfile.assignedWarehouses.length === 0) && (
                    <p className="text-[10px] text-slate-400 italic">No warehouses assigned by HR yet.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shift Controls</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setShiftActive(true);
                        setGeofenceStatus('Shift Active');
                        localStorage.setItem(`shift_active_${userProfile?.email}`, 'true');
                        db.addNotification(userProfile?.email || '', 'employee', 'Shift started manually.');
                        db.addNotification('all', 'hr', `${userProfile?.fullName} started shift manually.`);
                      }}
                      disabled={shiftActive}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all active:scale-97 text-center shadow-sm"
                    >
                      Start Shift
                    </button>
                    <button
                      onClick={() => {
                        setShiftActive(false);
                        setGeofenceStatus('Shift Ended');
                        localStorage.setItem(`shift_active_${userProfile?.email}`, 'false');
                        db.addNotification(userProfile?.email || '', 'employee', 'Shift ended manually.');
                        db.addNotification('all', 'hr', `${userProfile?.fullName} ended shift manually.`);
                      }}
                      disabled={!shiftActive}
                      className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all active:scale-97 text-center shadow-sm"
                    >
                      End Shift
                    </button>
                  </div>
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
                    .filter(emp => emp.id !== userProfile.id && emp.teams.some(t => userProfile.leadTeams?.includes(t)))
                    .map(member => (
                      <div key={member.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-150 bg-slate-50/50 text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <img src={member.profilePicture || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=256&auto=format&fit=crop'} alt="Member" className="h-6 w-6 rounded-full object-cover border" />
                          <div className="truncate max-w-[110px]">
                            <div className="font-bold text-slate-800 truncate">{member.fullName}</div>
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
                    <img src={teamLead.profilePicture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop'} alt="Lead" className="h-6 w-6 rounded-full object-cover border" />
                    <div>
                      <div className="font-bold text-slate-800">⭐ {teamLead.fullName}</div>
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
                      <img src={member.profilePicture || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=256&auto=format&fit=crop'} alt="Member" className="h-5 w-5 rounded-full object-cover" />
                      <div className="truncate">
                        <div className="font-semibold text-slate-800 truncate">{member.fullName}</div>
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
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-bold py-2 rounded-lg text-xs hover:bg-slate-100 transition-all active:scale-97 text-center"
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
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-xs"
                >
                  Start Task
                </button>
              )}
              {selectedTask.status === 'in_progress' && (
                <button
                  onClick={() => handleUpdateTaskStatus(selectedTask.id, 'done')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-xs"
                >
                  Mark Completed
                </button>
              )}
              <button
                onClick={() => setSelectedTask(null)}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-xs"
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
                <p className="text-sm font-bold text-slate-900">{selectedReviewEmp.fullName}</p>
                <p className="text-[10px] text-slate-455 font-bold">{selectedReviewEmp.email} · {selectedReviewEmp.jobTitle || 'Staff'}</p>
              </div>
              <Badge variant={selectedReviewEmp.region === 'USA' ? 'default' : 'success'}>
                {selectedReviewEmp.region === 'USA' ? 'USA Operations' : 'Pakistan Remote'}
              </Badge>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Historical Sessions (Current Week)</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="font-bold text-slate-555 bg-slate-50 border-b border-slate-200 uppercase tracking-widest text-[9px]">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Tracked Task</th>
                      <th className="px-4 py-2.5 text-right">Time Spent</th>
                      <th className="px-4 py-2.5 text-right">Avg Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {reviewEntries.map((entry, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-bold text-slate-700">{entry.date}</td>
                        <td className="px-4 py-3 text-slate-600 font-medium">{entry.task}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">{entry.duration}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{entry.score}%</td>
                      </tr>
                    ))}
                    {reviewEntries.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400 font-semibold italic">No tracked session history.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
