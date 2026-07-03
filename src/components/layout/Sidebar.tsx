'use client';
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, UserPlus, Clock, LogOut, Wallet, ClipboardList, Star, BookOpen, Briefcase, HelpCircle, MoreHorizontal, X } from 'lucide-react';
import { db } from '@/lib/db';

interface SidebarProps {
  role: 'admin' | 'hr' | 'employee' | 'team_lead';
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const email = localStorage.getItem('user_email');
    if (email) {
      const employees = db.getEmployees();
      const profile = employees.find(e => e.email === email);
      setIsTeamLead(!!(profile?.isTeamLead && (profile.leadTeams?.length ?? 0) > 0));
    }
  }, []);

  // Click outside listener for mobile more drawer
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMobileMoreOpen(false);
      }
    };
    if (isMobileMoreOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMobileMoreOpen]);

  const handleSignOut = () => {
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_email');
    router.push('/auth');
  };

  const adminItems = [
    { name: 'Overview', href: '/admin', icon: LayoutDashboard },
    { name: 'Tasks', href: '/admin/tasks', icon: ClipboardList },
    { name: 'Leaves Approval', href: '/admin/leaves', icon: Clock },
    { name: 'Payroll & Salary', href: '/admin/payroll', icon: Wallet },
    { name: 'Career Board', href: '/admin/careers', icon: Briefcase },
    { name: 'Support Tickets', href: '/admin/tickets', icon: HelpCircle },
  ];

  const hrItems = [
    { name: 'HR Dashboard', href: '/hr', icon: LayoutDashboard },
    { name: 'Task Management', href: '/hr/tasks', icon: ClipboardList },
    { name: 'Onboarding', href: '/hr/onboarding', icon: UserPlus },
    { name: 'Leave Management', href: '/hr/leaves', icon: Clock },
    { name: 'Team Management', href: '/hr/teams', icon: Users },
    { name: 'Payroll Records', href: '/hr/payroll', icon: Wallet },
    { name: 'Career Board', href: '/hr/careers', icon: Briefcase },
    { name: 'Support Tickets', href: '/hr/tickets', icon: HelpCircle },
  ];

  const employeeItems = [
    { name: 'My Dashboard', href: '/employee', icon: LayoutDashboard },
    { name: 'My Leaves', href: '/employee/leaves', icon: Clock },
    { name: 'Salary History', href: '/employee/salary', icon: Wallet },
    { name: 'Career Board', href: '/employee/careers', icon: Briefcase },
    { name: 'Support Tickets', href: '/employee/tickets', icon: HelpCircle },
    ...(isTeamLead ? [{ name: 'Team Tasks ⭐', href: '/employee/tasks', icon: Star }] : []),
  ];

  const navMap: Record<string, typeof adminItems> = {
    admin: adminItems,
    hr: hrItems,
    employee: employeeItems,
    team_lead: employeeItems,
  };

  const links = navMap[role] ?? employeeItems;

  // Dedicated role-scoped policy href
  const policyHref = role === 'admin' ? '/admin/policy' : role === 'hr' ? '/hr/policy' : '/employee/policy';
  const isPolicyActive = pathname === policyHref;

  // Bottom Mobile Bar: Main 4 links
  const mobileQuickLinks = links.slice(0, 4);
  // Rest of the links go inside "More" panel
  const mobileMoreLinks = links.slice(4);

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex w-64 border-r border-slate-200 bg-white flex-col h-screen sticky top-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <div className="font-bold text-xl text-orange-600">
            DelCargo HR
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          {links.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-orange-50 text-orange-700'
                    : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-orange-700' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Actions section */}
        <div className="p-4 border-t border-slate-200 space-y-1">
          <Link
            href={policyHref}
            className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
              isPolicyActive
                ? 'bg-orange-50 text-orange-700'
                : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BookOpen className={`mr-3 h-5 w-5 ${isPolicyActive ? 'text-orange-700' : 'text-slate-400'}`} />
            Policy Handbook
          </Link>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700 transition-colors duration-150"
          >
            <LogOut className="mr-3 h-5 w-5 text-slate-400" />
            Sign out
          </button>
        </div>
      </aside>

      {/* iOS/Android Native-style Translucent Bottom Navigation Bar (visible on mobile only) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-lg border-t border-slate-200/60 pb-safe shadow-lg flex justify-around items-center pt-2.5 pb-3.5 px-2">
        {mobileQuickLinks.map(item => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center gap-1 active:scale-90 transition-transform duration-100 relative ${
                isActive ? 'text-orange-600' : 'text-slate-450 hover:text-slate-600'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-[9px] font-bold tracking-tight">{item.name.replace('Management', '').replace('Dashboard', '').trim()}</span>
            </Link>
          );
        })}

        {/* More Button to trigger popover drawer */}
        <button
          onClick={() => setIsMobileMoreOpen(prev => !prev)}
          className={`flex flex-col items-center gap-1 active:scale-90 transition-transform duration-100 relative ${
            isMobileMoreOpen ? 'text-orange-600' : 'text-slate-450'
          }`}
        >
          <MoreHorizontal className="h-5 w-5 shrink-0" />
          <span className="text-[9px] font-bold tracking-tight">More</span>
        </button>

        {/* Drawer overlay for additional options */}
        {isMobileMoreOpen && (
          <div 
            ref={moreMenuRef}
            className="absolute bottom-16 right-4 left-4 bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl rounded-2xl p-4 space-y-1 animate-in slide-in-from-bottom-5 duration-200 z-50 max-h-[300px] overflow-y-auto"
          >
            <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">More Actions</span>
              <button onClick={() => setIsMobileMoreOpen(false)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List remaining navigation options */}
            {mobileMoreLinks.map(item => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMoreOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive 
                      ? 'bg-orange-50 text-orange-700' 
                      : 'text-slate-650 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-orange-700' : 'text-slate-400'}`} />
                  {item.name}
                </Link>
              );
            })}

            {/* Policy Handbook Link inside More drawer */}
            <Link
              href={policyHref}
              onClick={() => setIsMobileMoreOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isPolicyActive ? 'bg-orange-50 text-orange-700' : 'text-slate-650 hover:bg-slate-55'
              }`}
            >
              <BookOpen className={`h-4 w-4 shrink-0 ${isPolicyActive ? 'text-orange-700' : 'text-slate-400'}`} />
              Policy Handbook
            </Link>

            {/* Sign Out Option */}
            <button
              onClick={() => { setIsMobileMoreOpen(false); handleSignOut(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border-t border-slate-100 mt-2"
            >
              <LogOut className="h-4 w-4 shrink-0 text-rose-500" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </>
  );
}
