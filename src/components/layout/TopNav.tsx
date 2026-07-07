'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Search, X, User, CheckCircle2, Settings, LogOut, UserCircle, KeyRound, ClipboardList, HelpCircle, Users, BadgeHelp } from 'lucide-react';
import { db, Notification, Profile, Task, Ticket } from '@/lib/db';
import { useRouter } from 'next/navigation';

export function TopNav() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // Bumped after marking notifications read to force a re-render of
  // read/unread state computed via db.isNotificationRead (which reads the
  // per-user read map, not component state).
  const [readVersion, setReadVersion] = useState(0);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);

  // Search Results States (filtered by RBAC)
  const [matchedEmployees, setMatchedEmployees] = useState<Profile[]>([]);
  const [matchedTasks, setMatchedTasks] = useState<Task[]>([]);
  const [matchedTickets, setMatchedTickets] = useState<Ticket[]>([]);
  const [matchedTeams, setMatchedTeams] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role');
    const savedEmail = localStorage.getItem('user_email');
    setRole(savedRole);
    setEmail(savedEmail);

    if (savedEmail) {
      const employees = db.getEmployees();
      const profile = employees.find(e => e.email && savedEmail && e.email.toLowerCase() === savedEmail.toLowerCase());
      if (profile) {
        setDisplayName(profile.fullName);
        setProfilePicture(profile.profilePicture || null);
      } else {
        setDisplayName(savedEmail?.split('@')[0] || '');
      }
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
      setShowResults(false);
      return;
    }

    const q = query.toLowerCase();
    setShowResults(true);

    if (role === 'hr' || role === 'admin') {
      const allEmps = db.getEmployees();
      setMatchedEmployees(allEmps.filter(e =>
        e.fullName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.jobTitle || '').toLowerCase().includes(q)
      ));
    } else {
      setMatchedEmployees([]);
    }

    const allTasks = db.getTasks();
    let tasksScope: Task[] = [];
    if (role === 'hr' || role === 'admin') {
      tasksScope = allTasks;
    } else if (email) {
      tasksScope = allTasks.filter(t => t.assignedEmail === email);
    }
    setMatchedTasks(tasksScope.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    ));

    const allTickets = db.getTickets();
    let ticketsScope: Ticket[] = [];
    if (role === 'hr' || role === 'admin') {
      ticketsScope = allTickets;
    } else if (email) {
      ticketsScope = allTickets.filter(t => t.employeeEmail.toLowerCase() === email.toLowerCase());
    }
    setMatchedTickets(ticketsScope.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    ));

    if (role === 'hr' || role === 'admin') {
      const allTeams = ['Engineering', 'Design', 'Marketing', 'Operations', 'HR', 'Support'];
      setMatchedTeams(allTeams.filter(t => t.toLowerCase().includes(q)));
    } else {
      setMatchedTeams([]);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    performSearch(val);
    window.dispatchEvent(new CustomEvent('globalSearch', { detail: val }));
  };

  const handleToggleBell = () => {
    setIsBellOpen(prev => !prev);
    setIsProfileOpen(false);
    if (!isBellOpen && email && role) {
      db.markNotificationsAsRead(email, role);
      // Re-render read/unread state locally without waiting on the next
      // poll — the actual read tracking (per-user for broadcasts) already
      // lives in Supabase via markNotificationsAsRead.
      setReadVersion(v => v + 1);
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
    setShowResults(false);
    setIsMobileSearchOpen(false);
    router.push(url);
  };

  const unreadCount = email
    ? notifications.filter(n => !db.isNotificationRead(n, email)).length
    : 0;
  // Referenced only to satisfy the dependency-tracking eslint rule; the
  // actual re-computation is triggered by readVersion bumping this render.
  void readVersion;
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';
  const hasAnyResults = matchedEmployees.length > 0 || matchedTasks.length > 0 || matchedTickets.length > 0 || matchedTeams.length > 0;

  // Shared search results dropdown content
  const SearchResults = () => (
    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 max-h-[60vh] overflow-y-auto divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-150">
      {matchedEmployees.length > 0 && (
        <div className="p-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <User className="h-3 w-3" /> Employees ({matchedEmployees.length})
          </div>
          <div className="space-y-1">
            {matchedEmployees.slice(0, 4).map(emp => (
              <button key={emp.email} onClick={() => navigateToResult(role === 'hr' ? `/hr/teams` : `/admin/payroll`)}
                className="w-full text-left p-2.5 hover:bg-slate-50 rounded-xl text-xs flex justify-between items-center transition-colors min-h-[44px]">
                <div>
                  <p className="font-bold text-slate-800">{emp.fullName}</p>
                  <p className="text-[10px] text-slate-400">{emp.email}</p>
                </div>
                <span className="text-[9px] uppercase tracking-wider font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">{emp.role}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {matchedTasks.length > 0 && (
        <div className="p-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <ClipboardList className="h-3 w-3" /> Tasks ({matchedTasks.length})
          </div>
          <div className="space-y-1">
            {matchedTasks.slice(0, 4).map(task => (
              <button key={task.id} onClick={() => navigateToResult(role === 'hr' ? `/hr/tasks` : role === 'admin' ? `/admin/tasks` : `/employee/tasks`)}
                className="w-full text-left p-2.5 hover:bg-slate-50 rounded-xl text-xs flex justify-between items-center transition-colors min-h-[44px]">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800 truncate">{task.title}</p>
                  <p className="text-[10px] text-slate-400 truncate">{task.assignedTo}</p>
                </div>
                <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ml-2 ${task.status === 'done' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>{task.status}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {matchedTickets.length > 0 && (
        <div className="p-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <HelpCircle className="h-3 w-3" /> Tickets ({matchedTickets.length})
          </div>
          <div className="space-y-1">
            {matchedTickets.slice(0, 4).map(ticket => (
              <button key={ticket.id} onClick={() => navigateToResult(role === 'hr' ? `/hr/tickets` : role === 'admin' ? `/admin/tickets` : `/employee/tickets`)}
                className="w-full text-left p-2.5 hover:bg-slate-50 rounded-xl text-xs flex justify-between items-center transition-colors min-h-[44px]">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800 truncate">{ticket.title}</p>
                  <p className="text-[10px] text-slate-400 truncate">{ticket.employeeName}</p>
                </div>
                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ml-2 ${ticket.status === 'open' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{ticket.status}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {matchedTeams.length > 0 && (
        <div className="p-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Users className="h-3 w-3" /> Teams ({matchedTeams.length})
          </div>
          <div className="space-y-1">
            {matchedTeams.map(t => (
              <button key={t} onClick={() => navigateToResult(role === 'hr' ? `/hr/teams` : `/admin`)}
                className="w-full text-left p-2.5 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 flex justify-between items-center transition-colors min-h-[44px]">
                <span>👥 {t} Division</span>
                <span className="text-[9px] uppercase font-bold text-orange-600">View</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {!hasAnyResults && (
        <div className="p-8 text-center text-slate-400 font-semibold italic text-xs">No matching results found.</div>
      )}
    </div>
  );

  return (
    <>
      {/* Main TopNav bar */}
      <header className="h-14 md:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-20 gap-3">

        {/* Desktop Search Bar — hidden on mobile */}
        <div className="hidden md:flex flex-1 items-center max-w-md relative">
          <Search className="absolute left-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            onFocus={() => search.trim() && setShowResults(true)}
            placeholder="Search employees, tasks, tickets..."
            className="w-full bg-slate-50 border border-slate-200 rounded-full py-1.5 pl-10 pr-4 text-sm focus:border-orange-500 outline-none text-slate-900 focus:bg-white transition-all font-semibold"
          />
          {showResults && search.trim().length > 0 && <SearchResults />}
        </div>

        {/* Mobile: Brand name (left side) */}
        <div className="md:hidden font-bold text-base text-orange-600 tracking-tight">
          DelCargo HR
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-1.5 md:gap-3">

          {/* Mobile search icon */}
          <button
            onClick={() => setIsMobileSearchOpen(true)}
            className="md:hidden p-2 rounded-full text-slate-500 hover:bg-slate-100 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Bell */}
          <div ref={bellRef} className="relative">
            <button
              onClick={handleToggleBell}
              className="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition-colors relative min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center border border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {isBellOpen && (
              <div className="fixed top-16 left-4 right-4 sm:absolute sm:top-12 sm:right-0 sm:left-auto sm:w-[320px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-150">
                <div className="p-3.5 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                  <span className="font-bold text-xs text-slate-800">Notifications</span>
                  <span className="text-[9px] text-slate-500 font-semibold capitalize">Scope: {role}</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                  {notifications.map(n => (
                    <div key={n.id} className={`p-3.5 text-xs flex flex-col gap-1 ${email && !db.isNotificationRead(n, email) ? 'bg-orange-50/40' : ''}`}>
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

          {/* Profile avatar */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => { setIsProfileOpen(prev => !prev); setIsBellOpen(false); }}
              className="h-9 w-9 rounded-full border-2 border-orange-200 flex items-center justify-center font-bold text-xs hover:border-orange-400 transition-colors shadow-sm overflow-hidden"
            >
              {profilePicture ? (
                <img src={profilePicture} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span className="bg-orange-100 text-orange-700 w-full h-full flex items-center justify-center">{initials}</span>
              )}
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-12 w-[min(220px,85vw)] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-150">
                <div className="p-3.5 border-b border-slate-100 bg-slate-50/50">
                  <p className="font-bold text-slate-900 text-sm truncate">{displayName}</p>
                  <p className="text-[10px] text-slate-500 truncate">{email}</p>
                  <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider text-orange-700 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded">{role}</span>
                </div>
                <div className="py-1.5">
                  <button onClick={handleGoToProfile}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors min-h-[44px]">
                    <UserCircle className="h-4 w-4 text-slate-400" /> View Profile
                  </button>
                  <button onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors border-t border-slate-100 min-h-[44px]">
                    <LogOut className="h-4 w-4 text-rose-500" /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Full-Screen Search Overlay */}
      {isMobileSearchOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-slate-200">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={handleSearchChange}
                autoFocus
                placeholder="Search anything..."
                className="w-full bg-slate-50 border border-slate-200 rounded-full py-2.5 pl-10 pr-4 text-sm focus:border-orange-500 outline-none text-slate-900 focus:bg-white transition-all font-semibold"
              />
            </div>
            <button
              onClick={() => { setIsMobileSearchOpen(false); setSearch(''); setShowResults(false); }}
              className="p-2.5 rounded-full text-slate-500 hover:bg-slate-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search results in overlay */}
          <div className="flex-1 overflow-y-auto">
            {search.trim().length > 0 && showResults && (
              <div className="divide-y divide-slate-100">
                {matchedEmployees.length > 0 && (
                  <div className="p-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                      <User className="h-3 w-3" /> Employees
                    </div>
                    <div className="space-y-1">
                      {matchedEmployees.map(emp => (
                        <button key={emp.email} onClick={() => navigateToResult(role === 'hr' ? `/hr/teams` : `/admin/payroll`)}
                          className="w-full text-left p-3 hover:bg-slate-50 rounded-xl text-sm flex justify-between items-center transition-colors min-h-[52px]">
                          <div>
                            <p className="font-bold text-slate-800">{emp.fullName}</p>
                            <p className="text-xs text-slate-400">{emp.email}</p>
                          </div>
                          <span className="text-[9px] uppercase tracking-wider font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200">{emp.role}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {matchedTasks.length > 0 && (
                  <div className="p-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                      <ClipboardList className="h-3 w-3" /> Tasks
                    </div>
                    <div className="space-y-1">
                      {matchedTasks.map(task => (
                        <button key={task.id} onClick={() => navigateToResult(role === 'hr' ? `/hr/tasks` : role === 'admin' ? `/admin/tasks` : `/employee/tasks`)}
                          className="w-full text-left p-3 hover:bg-slate-50 rounded-xl text-sm flex justify-between items-center transition-colors min-h-[52px]">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-800 truncate">{task.title}</p>
                            <p className="text-xs text-slate-400 truncate">{task.assignedTo}</p>
                          </div>
                          <span className={`text-[9px] uppercase font-bold px-2 py-1 rounded border ml-2 ${task.status === 'done' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>{task.status}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {matchedTickets.length > 0 && (
                  <div className="p-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                      <HelpCircle className="h-3 w-3" /> Tickets
                    </div>
                    <div className="space-y-1">
                      {matchedTickets.map(ticket => (
                        <button key={ticket.id} onClick={() => navigateToResult(role === 'hr' ? `/hr/tickets` : role === 'admin' ? `/admin/tickets` : `/employee/tickets`)}
                          className="w-full text-left p-3 hover:bg-slate-50 rounded-xl text-sm flex justify-between items-center transition-colors min-h-[52px]">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-800 truncate">{ticket.title}</p>
                            <p className="text-xs text-slate-400 truncate">{ticket.employeeName}</p>
                          </div>
                          <span className={`text-[9px] uppercase font-bold px-2 py-1 rounded border ml-2 ${ticket.status === 'open' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{ticket.status}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!hasAnyResults && (
                  <div className="p-12 text-center text-slate-400 font-semibold text-sm">No results for "{search}"</div>
                )}
              </div>
            )}
            {!search.trim() && (
              <div className="p-8 text-center text-slate-400 font-medium text-sm">Start typing to search across all records</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
