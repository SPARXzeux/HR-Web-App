'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { OrgCalendar } from '@/components/ui/OrgCalendar';
import { TaskModal } from '@/components/ui/TaskModal';
import { Users, Clock, CheckCircle2, ClipboardList, UserCog, PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { db, LeaveApplication, Profile, Task } from '@/lib/db';

export default function HRDashboard() {
  const router = useRouter();

  // Data
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isTaskOpen, setIsTaskOpen] = useState(false);
  const [isTeamLeadOpen, setIsTeamLeadOpen] = useState(false);
  const [isOnboardOpen, setIsOnboardOpen] = useState(false);

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
    setEmployees(db.getEmployees());
    setLeaves(db.getLeaves());
    setTasks(db.getTasks());
    setTeams(db.getTeams());

    const handleSearch = (e: Event) => setSearchQuery((e as CustomEvent).detail || '');
    window.addEventListener('globalSearch', handleSearch);
    return () => window.removeEventListener('globalSearch', handleSearch);
  }, []);

  const handleOnboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardError('');
    if (!fullName || !email || !salary) { setOnboardError('Please fill in all required fields.'); return; }
    if (isNaN(Number(salary)) || Number(salary) <= 0) { setOnboardError('Please enter a valid base salary.'); return; }

    db.addEmployee({ fullName, email, role: role as Profile['role'], joinedDate: new Date().toISOString().split('T')[0], baseSalary: Number(salary), teams: [team], password: tempPassword || 'employee123' });
    db.addNotification('all', 'hr', `New employee ${fullName} (${role}) registered.`);
    setOnboardSuccess('Employee registered!');
    setEmployees(db.getEmployees());
    setTimeout(() => { setIsOnboardOpen(false); setFullName(''); setEmail(''); setSalary(''); setTempPassword(''); setOnboardSuccess(''); }, 1200);
  };

  const handleLeadToggle = (teamName: string) => {
    setLeadTeamSelections(prev =>
      prev.includes(teamName) ? prev.filter(t => t !== teamName) : [...prev, teamName]
    );
  };

  const handleSaveTeamLead = () => {
    if (!leadEmployeeId) return;
    db.setTeamLead(leadEmployeeId, leadTeamSelections);
    setEmployees(db.getEmployees());
    const emp = employees.find(e => e.id === leadEmployeeId);
    setLeadSuccess(`${emp?.fullName} is now team lead of: ${leadTeamSelections.join(', ') || '(none)'}`);
    setTimeout(() => { setIsTeamLeadOpen(false); setLeadSuccess(''); setLeadEmployeeId(''); setLeadTeamSelections([]); }, 1400);
  };

  // Stats
  const pendingLeaves = leaves.filter(l => l.status === 'pending').length;
  const activeTasks = tasks.filter(t => t.status !== 'done').length;
  const teamLeads = employees.filter(e => e.isTeamLead).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">HR Dashboard</h1>
          <p className="text-slate-500">Overview, scheduling calendar, and team operations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsTaskOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <ClipboardList className="h-4 w-4" /> Assign Task
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Total Employees</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{employees.length}</p>
              </div>
              <div className="h-11 w-11 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Pending Leaves</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{pendingLeaves}</p>
              </div>
              <div className="h-11 w-11 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Active Tasks</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{activeTasks}</p>
              </div>
              <div className="h-11 w-11 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                <ClipboardList className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Team Leads</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{teamLeads}</p>
              </div>
              <div className="h-11 w-11 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <UserCog className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Org Calendar */}
      <Card className="p-0">
        <div className="px-6 pt-5 pb-2 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Organisation Calendar</h2>
          <p className="text-xs text-slate-500 mt-0.5">Leaves, task deadlines, and schedule conflicts — all teams in one view.</p>
        </div>
        <div className="p-6">
          <OrgCalendar leaves={leaves} tasks={tasks} employees={employees} />
        </div>
      </Card>

      {/* Leave Quick Preview */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-slate-900">Pending Leave Requests</h2>
        <div className="space-y-2">
          {leaves.filter(l => l.status === 'pending').slice(0, 5).map(l => (
            <Card key={l.id} className="p-4">
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
            className="text-xs font-semibold text-orange-600 hover:text-orange-700 mt-1"
          >
            View full Kanban board →
          </button>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* Task Assignment Modal */}
      <TaskModal
        isOpen={isTaskOpen}
        onClose={() => setIsTaskOpen(false)}
        employees={employees.filter(e => e.role === 'employee' || e.isTeamLead)}
        createdBy="hr"
        onTaskAdded={task => setTasks(prev => [task, ...prev])}
      />

    </div>
  );
}
