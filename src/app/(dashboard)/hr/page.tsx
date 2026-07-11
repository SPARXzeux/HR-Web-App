'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { OrgCalendar } from '@/components/ui/OrgCalendar';
import { TaskModal } from '@/components/ui/TaskModal';
import { Users, Clock, CheckCircle2, ClipboardList, UserCog, PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { hrActions, Profile, useProfiles, useLeaves, useTasks, useTeams, useAnnouncements, useWarehouses } from '@/lib/hrData';

export default function HRDashboard() {
  const router = useRouter();

  // Data
  const { data: employees = [], refetch: refetchProfiles } = useProfiles();
  const { data: leaves = [], refetch: refetchLeaves } = useLeaves();
  const { data: tasks = [], refetch: refetchTasks } = useTasks();
  const { data: teamsData = [], refetch: refetchTeams } = useTeams();
  const teams = teamsData.map(t => t.name); // extract names
  const { data: announcements = [], refetch: refetchAnnouncements } = useAnnouncements();
  const { data: warehouses = [], refetch: refetchWarehouses } = useWarehouses();
  
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isTaskOpen, setIsTaskOpen] = useState(false);
  const [isTeamLeadOpen, setIsTeamLeadOpen] = useState(false);
  const [isOnboardOpen, setIsOnboardOpen] = useState(false);
  const [isAnnounceOpen, setIsAnnounceOpen] = useState(false);

  // Announcement form states
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annTargetType, setAnnTargetType] = useState<'all' | 'usa' | 'pakistan' | 'warehouses'>('all');
  const [annSelectedWarehouses, setAnnSelectedWarehouses] = useState<string[]>([]);
  const [annSuccess, setAnnSuccess] = useState('');

  // Team Lead assignment form
  const [leadEmployeeId, setLeadEmployeeId] = useState('');
  const [leadTeamSelections, setLeadTeamSelections] = useState<string[]>([]);
  const [leadSuccess, setLeadSuccess] = useState('');

  // Onboard form
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('employee');
  const [salary, setSalary] = useState('');
  const [team, setTeam] = useState('Engineering');
  const [tempPassword, setTempPassword] = useState('');
  const [onboardError, setOnboardError] = useState('');
  const [onboardSuccess, setOnboardSuccess] = useState('');

  useEffect(() => {
    // Monthly screenshot retention sweep — no-ops if already checked this
    // month or nothing is due; see checkScreenshotRetention in hrData.ts.
    hrActions.checkScreenshotRetention();

    const handleSearch = (e: Event) => setSearchQuery((e as CustomEvent).detail || '');
    window.addEventListener('globalSearch', handleSearch);
    return () => window.removeEventListener('globalSearch', handleSearch);
  }, []);

  const handleAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;

    const targetVal = annTargetType === 'warehouses' ? annSelectedWarehouses : annTargetType;
    await hrActions.addAnnouncement(annTitle, annContent, targetVal, 'HR Manager');
    refetchAnnouncements();
    setAnnSuccess('Announcement posted successfully!');

    setTimeout(() => {
      setIsAnnounceOpen(false);
      setAnnTitle('');
      setAnnContent('');
      setAnnTargetType('all');
      setAnnSelectedWarehouses([]);
      setAnnSuccess('');
    }, 1200);
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardError('');
    if (!fullName || !email || !salary) { setOnboardError('Please fill in all required fields.'); return; }
    if (isNaN(Number(salary)) || Number(salary) <= 0) { setOnboardError('Please enter a valid base salary.'); return; }

    await hrActions.addEmployee({ fullName, email, role: role as Profile['role'], joinedDate: new Date().toISOString().split('T')[0], baseSalary: Number(salary), teams: [team], password: tempPassword || 'employee123' });
    await hrActions.addNotification('all', 'hr', `New employee ${fullName} (${role}) registered.`);
    await hrActions.addNotification('all', 'admin', `New employee ${fullName} (${role}) registered.`);
    setOnboardSuccess('Employee registered!');
    refetchProfiles();
    setTimeout(() => { setIsOnboardOpen(false); setFullName(''); setEmail(''); setSalary(''); setTempPassword(''); setOnboardSuccess(''); }, 1200);
  };

  const handleLeadToggle = (teamName: string) => {
    setLeadTeamSelections(prev =>
      prev.includes(teamName) ? prev.filter(t => t !== teamName) : [...prev, teamName]
    );
  };

  const handleSaveTeamLead = async () => {
    if (!leadEmployeeId) return;
    await hrActions.setTeamLead(leadEmployeeId, leadTeamSelections);
    refetchProfiles();
    const emp = employees.find((e: Profile) => e.id === leadEmployeeId);
    setLeadSuccess(`${emp?.fullName} is now team lead of: ${leadTeamSelections.join(', ') || '(none)'}`);
    setTimeout(() => { setIsTeamLeadOpen(false); setLeadSuccess(''); setLeadEmployeeId(''); setLeadTeamSelections([]); }, 1400);
  };

  // Stats
  const pendingLeaves = leaves.filter(l => l.status === 'pending').length;
  const activeTasks = tasks.filter(t => t.status !== 'done').length;
  const teamLeads = employees.filter(e => e.isTeamLead).length;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-slate-900">HR Dashboard</h1>
          <p className="text-xs md:text-sm text-slate-500">Overview, scheduling calendar, and team operations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsAnnounceOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 md:py-2 rounded-lg text-sm active:scale-97 transition-all flex items-center gap-1.5 shadow-sm min-h-[44px] md:min-h-0"
          >
            <PlusCircle className="h-4 w-4" /> Post Announcement
          </button>
          <button
            onClick={() => setIsTaskOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2.5 md:py-2 rounded-lg text-sm active:scale-97 transition-all flex items-center gap-1.5 shadow-sm min-h-[44px] md:min-h-0"
          >
            <ClipboardList className="h-4 w-4" /> Assign Task
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="pt-4 md:pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs font-semibold text-slate-500">Total Employees</p>
                <p className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">{employees.length}</p>
              </div>
              <div className="h-10 w-10 md:h-11 md:w-11 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Users className="h-4 w-4 md:h-5 md:w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs font-semibold text-slate-500">Pending Leaves</p>
                <p className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">{pendingLeaves}</p>
              </div>
              <div className="h-10 w-10 md:h-11 md:w-11 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Clock className="h-4 w-4 md:h-5 md:w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs font-semibold text-slate-500">Active Tasks</p>
                <p className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">{activeTasks}</p>
              </div>
              <div className="h-10 w-10 md:h-11 md:w-11 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                <ClipboardList className="h-4 w-4 md:h-5 md:w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] md:text-xs font-semibold text-slate-500">Team Leads</p>
                <p className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">{teamLeads}</p>
              </div>
              <div className="h-10 w-10 md:h-11 md:w-11 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <UserCog className="h-4 w-4 md:h-5 md:w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Org Calendar */}
      <Card className="p-0">
        <div className="px-4 md:px-6 pt-4 md:pt-5 pb-2 border-b border-slate-100">
          <h2 className="text-sm md:text-base font-bold text-slate-900">Organisation Calendar</h2>
          <p className="text-[10px] md:text-xs text-slate-500 mt-0.5">Leaves, task deadlines, and schedule conflicts — all teams in one view.</p>
        </div>
        <div className="p-3 md:p-6">
          <OrgCalendar leaves={leaves as any} tasks={tasks as any} employees={employees} />
        </div>
      </Card>

      {/* Announcements Panel */}
      <Card className="p-0">
        <div className="px-4 md:px-6 pt-4 md:pt-5 pb-2 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-sm md:text-base font-bold text-slate-900">Recent Announcements</h2>
            <p className="text-[10px] md:text-xs text-slate-500 mt-0.5">Corporate updates and targeted broadcast messages.</p>
          </div>
        </div>
        <CardContent className="p-4 md:p-6 space-y-3 md:space-y-4">
          {announcements.map(ann => (
            <div key={ann.id} className="p-3 md:p-4 rounded-xl border border-slate-150 bg-slate-50/50 flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{ann.title}</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{ann.content}</p>
                </div>
                <Badge variant={ann.target === 'all' ? 'default' : 'warning'} className="self-start shrink-0">
                  Target: {Array.isArray(ann.target) 
                    ? `Warehouses (${ann.target.map((tId: string) => warehouses.find(w => w.id === tId)?.name || tId).join(', ')})`
                    : ann.target.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mt-3 pt-2 border-t border-slate-100">
                <span>By {ann.createdBy}</span>
                <span>{ann.timestamp}</span>
              </div>
            </div>
          ))}
          {announcements.length === 0 && (
            <p className="text-xs text-slate-400 font-semibold italic text-center py-4">No announcements posted yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Leave Quick Preview */}
      <div className="space-y-3">
        <h2 className="text-sm md:text-base font-bold text-slate-900">Pending Leave Requests</h2>
        <div className="space-y-2">
          {leaves.filter(l => l.status === 'pending').slice(0, 5).map(l => (
            <Card key={l.id} className="p-3 md:p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-900 text-sm">{l.employeeName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{l.type} · {l.duration}</div>
                </div>
                <Badge variant="warning">Pending</Badge>
              </div>
            </Card>
          ))}
          {leaves.filter(l => l.status === 'pending').length === 0 && (
            <div className="text-xs text-slate-400 font-medium italic">No pending leave requests.</div>
          )}
          <button
            onClick={() => router.push('/hr/leaves')}
            className="text-xs font-semibold text-orange-600 hover:text-orange-700 mt-1 py-2.5 md:py-1"
          >
            View full Kanban board →
          </button>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* Announcement Modal */}
      <Modal isOpen={isAnnounceOpen} onClose={() => setIsAnnounceOpen(false)} title="Create New Announcement">
        <form onSubmit={handleAnnouncementSubmit} className="space-y-4 pt-1">
          {annSuccess && (
            <div className="p-3 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> {annSuccess}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Announcement Title *</label>
            <input 
              type="text" 
              required 
              value={annTitle} 
              onChange={e => setAnnTitle(e.target.value)} 
              className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold" 
              placeholder="e.g. System Maintenance Notice" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Content *</label>
            <textarea 
              required 
              rows={4} 
              value={annContent} 
              onChange={e => setAnnContent(e.target.value)} 
              className="w-full bg-slate-50/50 hover:bg-slate-55 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold resize-none" 
              placeholder="Type announcement details here..." 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Audience *</label>
            <select
              value={annTargetType}
              onChange={e => setAnnTargetType(e.target.value as any)}
              className="w-full bg-slate-50/50 hover:bg-slate-55 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold cursor-pointer"
            >
              <option value="all">All Employees</option>
              <option value="usa">USA Employees Only</option>
              <option value="pakistan">Pakistani Employees (Remote) Only</option>
              <option value="warehouses">Specific Warehouses</option>
            </select>
          </div>

          {annTargetType === 'warehouses' && (
            <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-36 overflow-y-auto">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Select Warehouses</label>
              <div className="space-y-1.5">
                {warehouses.map(wh => (
                  <label key={wh.id} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={annSelectedWarehouses.includes(wh.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setAnnSelectedWarehouses(prev => [...prev, wh.id]);
                        } else {
                          setAnnSelectedWarehouses(prev => prev.filter(id => id !== wh.id));
                        }
                      }}
                      className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    {wh.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setIsAnnounceOpen(false)} className="bg-white hover:bg-slate-55 border border-slate-200 text-slate-650 hover:text-slate-800 font-bold px-4 py-2.5 md:py-2 rounded-xl text-xs active:scale-97 transition-all">Cancel</button>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 md:py-2 rounded-xl text-xs active:scale-97 transition-all shadow-sm">Post Announcement</button>
          </div>
        </form>
      </Modal>

      {/* Task Assignment Modal */}
      <TaskModal
        isOpen={isTaskOpen}
        onClose={() => setIsTaskOpen(false)}
        employees={employees.filter((e: Profile) => e.role === 'employee' || e.isTeamLead)}
        createdBy="hr"
        onTaskAdded={(task) => refetchTasks()}
      />

    </div>
  );
}
