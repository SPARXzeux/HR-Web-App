'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, UserPlus, Clock, LogOut, Wallet, ClipboardList, Star, BookOpen, Briefcase, HelpCircle } from 'lucide-react';
import { db } from '@/lib/db';

interface SidebarProps {
  role: 'admin' | 'hr' | 'employee' | 'team_lead';
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isTeamLead, setIsTeamLead] = useState(false);

  useEffect(() => {
    const email = localStorage.getItem('user_email');
    if (email) {
      const employees = db.getEmployees();
      const profile = employees.find(e => e.email === email);
      setIsTeamLead(!!(profile?.isTeamLead && (profile.leadTeams?.length ?? 0) > 0));
    }
  }, []);

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
    { name: 'Policy Handbook', href: '/admin/policy', icon: BookOpen },
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
    { name: 'Policy Handbook', href: '/hr/policy', icon: BookOpen },
    { name: 'Career Board', href: '/hr/careers', icon: Briefcase },
    { name: 'Support Tickets', href: '/hr/tickets', icon: HelpCircle },
  ];

  const employeeItems = [
    { name: 'My Dashboard', href: '/employee', icon: LayoutDashboard },
    { name: 'My Leaves', href: '/employee/leaves', icon: Clock },
    { name: 'Salary History', href: '/employee/salary', icon: Wallet },
    { name: 'Policy Handbook', href: '/employee/policy', icon: BookOpen },
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

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-screen sticky top-0">
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
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-orange-700' : 'text-slate-400'}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700 transition-colors duration-150"
        >
          <LogOut className="mr-3 h-5 w-5 text-slate-400" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
