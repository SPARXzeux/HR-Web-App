'use client';
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, UserPlus, Clock, LogOut, Wallet, ClipboardList, Star, BookOpen, Briefcase, HelpCircle, Menu, X } from 'lucide-react';
import { db } from '@/lib/db';

interface SidebarProps {
  role: 'admin' | 'hr' | 'employee' | 'team_lead';
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const email = localStorage.getItem('user_email');
    if (email) {
      const employees = db.getEmployees();
      const profile = employees.find(e => e.email === email);
      setIsTeamLead(!!(profile?.isTeamLead && (profile.leadTeams?.length ?? 0) > 0));
    }
  }, []);

  // Click outside listener for mobile drawer
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMobileMenuOpen]);

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

  // Bottom Mobile Bar: Keep most used tabs (Dashboard, Tasks, Leaves, Tickets)
  const getMobileQuickLinks = () => {
    if (role === 'hr') {
      return [
        { name: 'HR Dashboard', href: '/hr', icon: LayoutDashboard },
        { name: 'Tasks', href: '/hr/tasks', icon: ClipboardList },
        { name: 'Leaves', href: '/hr/leaves', icon: Clock },
        { name: 'Tickets', href: '/hr/tickets', icon: HelpCircle },
      ];
    }
    if (role === 'admin') {
      return [
        { name: 'Overview', href: '/admin', icon: LayoutDashboard },
        { name: 'Tasks', href: '/admin/tasks', icon: ClipboardList },
        { name: 'Leaves', href: '/admin/leaves', icon: Clock },
        { name: 'Tickets', href: '/admin/tickets', icon: HelpCircle },
      ];
    }
    // Employee
    return [
      { name: 'Dashboard', href: '/employee', icon: LayoutDashboard },
      { name: 'Leaves', href: '/employee/leaves', icon: Clock },
      { name: 'Tickets', href: '/employee/tickets', icon: HelpCircle },
      ...(isTeamLead ? [{ name: 'Team Tasks', href: '/employee/tasks', icon: Star }] : [{ name: 'Salary', href: '/employee/salary', icon: Wallet }]),
    ];
  };

  const mobileQuickLinks = getMobileQuickLinks();

  // All links not included in the quick bottom bar go into the Left Side Menu Drawer
  const mobileSideLinks = links.filter(link => 
    !mobileQuickLinks.some(quick => quick.href === link.href)
  );

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

      {/* iOS/Android Native-style Translucent Bottom Navigation Bar */}
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
              <span className="text-[9px] font-bold tracking-tight">{item.name}</span>
            </Link>
          );
        })}

        {/* Menu Tab button to open side drawer */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className={`flex flex-col items-center gap-1 active:scale-90 transition-transform duration-100 relative ${
            isMobileMenuOpen ? 'text-orange-600' : 'text-slate-450'
          }`}
        >
          <Menu className="h-5 w-5 shrink-0" />
          <span className="text-[9px] font-bold tracking-tight">Menu</span>
        </button>
      </div>

      {/* Mobile Slide-Out Side Menu Drawer (Left Side Menu) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop Blur Overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Left Drawer Content */}
          <div 
            ref={drawerRef}
            className="relative flex flex-col w-64 max-w-xs bg-white h-full shadow-2xl p-5 border-r border-slate-200 animate-in slide-in-from-left duration-200 z-50 justify-between"
          >
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="font-bold text-lg text-orange-600 tracking-tight">DelCargo Menu</div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Links */}
              <nav className="space-y-1">
                {mobileSideLinks.map(item => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 ${
                        isActive 
                          ? 'bg-orange-50 text-orange-700' 
                          : 'text-slate-650 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-orange-700' : 'text-slate-400'}`} />
                      {item.name}
                    </Link>
                  );
                })}

                {/* Policy Handbook link */}
                <Link
                  href={policyHref}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 ${
                    isPolicyActive ? 'bg-orange-50 text-orange-700' : 'text-slate-650 hover:bg-slate-50'
                  }`}
                >
                  <BookOpen className={`h-4.5 w-4.5 shrink-0 ${isPolicyActive ? 'text-orange-700' : 'text-slate-400'}`} />
                  Policy Handbook
                </Link>
              </nav>
            </div>

            {/* Bottom Actions inside side menu */}
            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={() => { setIsMobileMenuOpen(false); handleSignOut(); }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <LogOut className="h-4.5 w-4.5 shrink-0 text-rose-500" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
