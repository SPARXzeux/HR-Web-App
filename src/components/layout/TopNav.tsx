'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Search, User, CheckCircle2, Settings, LogOut, UserCircle, KeyRound } from 'lucide-react';
import { db, Notification } from '@/lib/db';
import { useRouter } from 'next/navigation';

export function TopNav() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role');
    const savedEmail = localStorage.getItem('user_email');
    setRole(savedRole);
    setEmail(savedEmail);

    // Resolve display name from DB
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setIsBellOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    window.dispatchEvent(new CustomEvent('globalSearch', { detail: val }));
  };

  const handleToggleBell = () => {
    setIsBellOpen(prev => !prev);
    setIsProfileOpen(false);
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
    // Route to role-scoped profile page
    const dashPrefix = role === 'admin' ? '/admin' : role === 'hr' ? '/hr' : '/employee';
    router.push(`${dashPrefix}/profile`);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // Avatar initials
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20">
      {/* Search */}
      <div className="flex-1 flex items-center max-w-md relative">
        <Search className="absolute left-3 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          placeholder="Search employees, teams, leaves..."
          className="w-full bg-slate-50 border border-slate-200 rounded-full py-1.5 pl-10 pr-4 text-sm focus:border-orange-500 outline-none text-slate-900 focus:bg-white transition-all"
        />
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
            onClick={() => { setIsProfileOpen(prev => !prev); setIsBellOpen(false); }}
            className="h-8 w-8 rounded-full bg-orange-100 border-2 border-orange-200 flex items-center justify-center text-orange-700 font-bold text-xs hover:bg-orange-200 transition-colors shadow-sm"
          >
            {initials}
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 top-11 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-150">
              {/* Identity header */}
              <div className="p-3.5 border-b border-slate-100 bg-slate-50/50">
                <p className="font-bold text-slate-900 text-sm truncate">{displayName}</p>
                <p className="text-[10px] text-slate-500 truncate">{email}</p>
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
                {role === 'employee' && (
                  <button
                    onClick={() => { setIsProfileOpen(false); router.push('/employee/profile'); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <KeyRound className="h-4 w-4 text-slate-400" /> Reset Password
                  </button>
                )}
              </div>

              <div className="border-t border-slate-100 py-1.5">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
