'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Search, User, CheckCircle2, Settings, LogOut, UserCircle, KeyRound, ClipboardList, HelpCircle, Users, BadgeHelp } from 'lucide-react';
import { db, Notification, Profile, Task, Ticket } from '@/lib/db';
import { useRouter } from 'next/navigation';

export function TopNav() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  
  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Search Results States (filtered by RBAC)
  const [matchedEmployees, setMatchedEmployees] = useState<Profile[]>([]);
  const [matchedTasks, setMatchedTasks] = useState<Task[]>([]);
  const [matchedTickets, setMatchedTickets] = useState<Ticket[]>([]);
  const [matchedTeams, setMatchedTeams] = useState<string[]>([]);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role');
    const savedEmail = localStorage.getItem('user_email');
    setRole(savedRole);
    setEmail(savedEmail);

    if (savedEmail) {
      const employees = db.getEmployees();
      const profile = employees.find(e => e.email === savedEmail);
      if (profile) setDisplayName(profile.fullName);
      else setDisplayName(savedEmail?.split('@')[0] || '');
    }

    const loadNotifications = () => {
      if (!savedRole || !savedEmail) return;
      const allNotifs = db.getNotifications();
      const filtered = allNotifs.filter(n =>
        n.recipientEmail === savedEmail ||
        (n.recipientRole === savedRole && n.recipientEmail === 'all')
      );
      setNotifications(filtered);
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 5000);
    window.addEventListener('focus', loadNotifications);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', loadNotifications);
    };
  }, []);

  // Close elements when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setIsBellOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setIsSearchOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Dynamic Search Engine with RBAC
  const performSearch = (query: string) => {
    if (!query.trim() || !role) {
      setMatchedEmployees([]);
      setMatchedTasks([]);
      setMatchedTickets([]);
      setMatchedTeams([]);
      return;
    }

    const q = query.toLowerCase();

    // 1. Employees (RBAC: HR and Admin only)
    if (role === 'hr' || role === 'admin') {
      const allEmps = db.getEmployees();
      const matched = allEmps.filter(e => 
        e.fullName.toLowerCase().includes(q) || 
        e.email.toLowerCase().includes(q) ||
        (e.jobTitle || '').toLowerCase().includes(q)
      );
      setMatchedEmployees(matched);
    } else {
      setMatchedEmployees([]);
    }

    // 2. Tasks (RBAC: Employees see their own, HR/Admin see all)
    const allTasks = db.getTasks();
    let tasksScope: Task[] = [];
    if (role === 'hr' || role === 'admin') {
      tasksScope = allTasks;
    } else if (email) {
      tasksScope = allTasks.filter(t => t.assignedEmail === email);
    }
    const filteredTasks = tasksScope.filter(t => 
      t.title.toLowerCase().includes(q) || 
      t.description.toLowerCase().includes(q)
    );
    setMatchedTasks(filteredTasks);

    // 3. Support Tickets (RBAC: Employees see their own, HR/Admin see all)
    const allTickets = db.getTickets();
    let ticketsScope: Ticket[] = [];
    if (role === 'hr' || role === 'admin') {
      ticketsScope = allTickets;
    } else if (email) {
      ticketsScope = allTickets.filter(t => t.employeeEmail === email);
    }
    const filteredTickets = ticketsScope.filter(t => 
      t.title.toLowerCase().includes(q) || 
      t.description.toLowerCase().includes(q)
    );
    setMatchedTickets(filteredTickets);

    // 4. Teams (RBAC: HR and Admin only)
    if (role === 'hr' || role === 'admin') {
      const allTeams = ['Engineering', 'Design', 'Marketing', 'Operations', 'HR', 'Support'];
      const matched = allTeams.filter(t => t.toLowerCase().includes(q));
      setMatchedTeams(matched);
    } else {
      setMatchedTeams([]);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    performSearch(val);
    setIsSearchOpen(true);
    window.dispatchEvent(new CustomEvent('globalSearch', { detail: val }));
  };

  const handleToggleBell = () => {
    setIsBellOpen(prev => !prev);
    setIsProfileOpen(false);
    setIsSearchOpen(false);
    if (!isBellOpen && email && role) {
      db.markNotificationsAsRead(email, role);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_email');
    router.push('/auth');
  };

  const handleGoToProfile = () => {
    setIsProfileOpen(false);
    const dashPrefix = role === 'admin' ? '/admin' : role === 'hr' ? '/hr' : '/employee';
    router.push(`${dashPrefix}/profile`);
  };

  const navigateToResult = (url: string) => {
    setSearch('');
    setIsSearchOpen(false);
    router.push(url);
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const hasAnyResults = matchedEmployees.length > 0 || matchedTasks.length > 0 || matchedTickets.length > 0 || matchedTeams.length > 0;

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20">
      
      {/* Smart Search Bar Panel */}
      <div ref={searchRef} className="flex-1 flex items-center max-w-md relative">
        <Search className="absolute left-3 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          onFocus={() => setIsSearchOpen(true)}
          placeholder="Search employees, tasks, tickets..."
          className="w-full bg-slate-50 border border-slate-200 rounded-full py-1.5 pl-10 pr-4 text-sm focus:border-orange-500 outline-none text-slate-900 focus:bg-white transition-all font-semibold"
        />

        {/* Dropdown Result Panel (RBAC Compliant) */}
        {isSearchOpen && search.trim().length > 0 && (
          <div className="absolute left-0 right-0 top-11 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-[360px] overflow-y-auto divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-150">
            
            {/* Category: Employees */}
            {matchedEmployees.length > 0 && (
              <div className="p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <User className="h-3 w-3" /> Employees ({matchedEmployees.length})
                </div>
                <div className="space-y-1">
                  {matchedEmployees.map(emp => (
                    <button
                      key={emp.email}
                      onClick={() => navigateToResult(role === 'hr' ? `/hr/teams` : `/admin/payroll`)}
                      className="w-full text-left p-2 hover:bg-slate-50 rounded-lg text-xs flex justify-between items-center transition-colors"
                    >
                      <div>
                        <p className="font-bold text-slate-800">{emp.fullName}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{emp.email} • {emp.jobTitle || 'Employee'}</p>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                        {emp.role}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Category: Tasks */}
            {matchedTasks.length > 0 && (
              <div className="p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <ClipboardList className="h-3 w-3" /> Tasks ({matchedTasks.length})
                </div>
                <div className="space-y-1">
                  {matchedTasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => navigateToResult(role === 'hr' ? `/hr/tasks` : role === 'admin' ? `/admin/tasks` : `/employee/tasks`)}
                      className="w-full text-left p-2 hover:bg-slate-50 rounded-lg text-xs flex justify-between items-center transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 truncate">{task.title}</p>
                        <p className="text-[10px] text-slate-400 font-semibold truncate">Assignee: {task.assignedTo}</p>
                      </div>
                      <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ml-2 ${
                        task.status === 'done' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-250' 
                          : 'bg-orange-50 text-orange-700 border-orange-200'
                      }`}>
                        {task.status}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Category: Support Tickets */}
            {matchedTickets.length > 0 && (
              <div className="p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <HelpCircle className="h-3 w-3" /> Support Tickets ({matchedTickets.length})
                </div>
                <div className="space-y-1">
                  {matchedTickets.map(ticket => (
                    <button
                      key={ticket.id}
                      onClick={() => navigateToResult(role === 'hr' ? `/hr/tickets` : role === 'admin' ? `/admin/tickets` : `/employee/tickets`)}
                      className="w-full text-left p-2 hover:bg-slate-50 rounded-lg text-xs flex justify-between items-center transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 truncate">{ticket.title}</p>
                        <p className="text-[10px] text-slate-400 font-semibold truncate">Opened by: {ticket.employeeName}</p>
                      </div>
                      <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ml-2 ${
                        ticket.status === 'open' 
                          ? 'bg-amber-50 text-amber-700 border-amber-200' 
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {ticket.status}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Category: Teams */}
            {matchedTeams.length > 0 && (
              <div className="p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Users className="h-3 w-3" /> Departments & Teams ({matchedTeams.length})
                </div>
                <div className="space-y-1">
                  {matchedTeams.map(t => (
                    <button
                      key={t}
                      onClick={() => navigateToResult(role === 'hr' ? `/hr/teams` : `/admin`)}
                      className="w-full text-left p-2 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 flex justify-between items-center transition-colors"
                    >
                      <span>👥 {t} Division</span>
                      <span className="text-[9px] uppercase tracking-wider font-bold text-orange-600">View</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!hasAnyResults && (
              <div className="p-8 text-center text-slate-400 font-semibold italic text-xs">
                No matching results found.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Bell */}
        <div ref={bellRef} className="relative">
          <button
            onClick={handleToggleBell}
            className="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition-colors relative"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center border border-white">
                {unreadCount}
              </span>
            )}
          </button>

          {isBellOpen && (
            <div className="absolute right-0 top-12 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-150">
              <div className="p-3.5 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                <span className="font-bold text-xs text-slate-800">Notifications</span>
                <span className="text-[9px] text-slate-500 font-semibold capitalize">Scope: {role}</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                {notifications.map(n => (
                  <div key={n.id} className={`p-3.5 text-xs transition-colors flex flex-col gap-1 ${!n.read ? 'bg-orange-50/40' : ''}`}>
                    <div className="text-slate-700 leading-relaxed font-medium">{n.message}</div>
                    <div className="text-[9px] text-slate-400 font-medium text-right">{n.timestamp}</div>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <div className="p-8 text-center text-slate-400 font-medium text-xs">No alerts active</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile avatar + dropdown */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => { setIsProfileOpen(prev => !prev); setIsBellOpen(false); setIsSearchOpen(false); }}
            className="h-8 w-8 rounded-full bg-orange-100 border-2 border-orange-200 flex items-center justify-center text-orange-700 font-bold text-xs hover:bg-orange-200 transition-colors shadow-sm"
          >
            {initials}
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 top-11 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-150">
              {/* Identity header */}
              <div className="p-3.5 border-b border-slate-100 bg-slate-50/50">
                <p className="font-bold text-slate-900 text-sm truncate">{displayName}</p>
                <p className="text-[10px] text-slate-555 truncate">{email}</p>
                <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider text-orange-700 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded">{role}</span>
              </div>

              {/* Menu items */}
              <div className="py-1.5">
                <button
                  onClick={handleGoToProfile}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <UserCircle className="h-4 w-4 text-slate-400" /> View Profile
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors border-t border-slate-100"
                >
                  <LogOut className="h-4 w-4 text-rose-500" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
