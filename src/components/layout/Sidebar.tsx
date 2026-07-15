'use client';
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, UserPlus, Clock, LogOut, Wallet, ClipboardList, Star, BookOpen, Briefcase, HelpCircle, Menu, X, FileText, MapPin, Monitor, MessageSquare } from 'lucide-react';
import { useProfiles, useTeams, useTickets, useAllMessages, useKVByPrefix, hasUnseenTicketActivity, hasUnseenMessageActivity, TrackingSettings } from '@/lib/hrData';

interface SidebarProps {
  role: 'admin' | 'hr' | 'employee' | 'team_lead';
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android'>('ios');
  const [userEmail, setUserEmail] = useState('');
  const [myTeamIds, setMyTeamIds] = useState<string[] | 'all'>([]);
  const drawerRef = useRef<HTMLDivElement>(null);
  const { data: profiles } = useProfiles();
  const { data: allTeams } = useTeams();
  // Self-healing fallback: hr_profiles.tracking_enabled (which used to be
  // the only thing gating this nav link) can be out of sync with the real
  // "is screen tracking actually on" flag, which lives in this KV row
  // instead. Checking both means employees whose tracking was turned on
  // via the Tracking Monitor page before the two flags were kept in sync
  // still see the link, without HR/Admin needing to re-toggle anything.
  const { data: trackingSettingsRows } = useKVByPrefix('hr_tracking_settings_prod_v1');
  // Polls every 15s via useTickets' own refetchInterval, so the dot can
  // light up without the user needing to be on the tickets page.
  const { data: allTickets } = useTickets();
  // Same idea for Team Chat — see useAllMessages' comment in hrData.ts.
  const { data: allMessages } = useAllMessages();

  const hasUnseenTickets = hasUnseenTicketActivity(allTickets || [], role, userEmail);
  const hasUnseenChat = hasUnseenMessageActivity(allMessages || [], myTeamIds, role, userEmail);

  useEffect(() => {
    const email = localStorage.getItem('user_email');
    if (email) setUserEmail(email);
    if (email && profiles) {
      const profile = profiles.find(e => e.email && email && e.email.toLowerCase() === email.toLowerCase());
      setIsTeamLead(!!(profile?.isTeamLead && (profile.leadTeams?.length ?? 0) > 0));

      const settingsList = ((trackingSettingsRows || []).find(r => r.key === 'hr_tracking_settings_prod_v1')?.value as TrackingSettings[]) || [];
      const mySettings = settingsList.find(s => s.employeeEmail?.toLowerCase() === email.toLowerCase());
      setTrackingEnabled(!!profile?.trackingEnabled || !!mySettings?.enabled);

      // Admin is auto-a-member of every team channel (see TeamChatView),
      // so their "unseen" signature spans every team, not just ones
      // they're formally on. Everyone else: the specific teams they're a
      // member of or lead, resolved to ids via hr_teams.
      if (role === 'admin') {
        setMyTeamIds('all');
      } else if (profile && allTeams) {
        const names = new Set([...(profile.teams || []), ...(profile.leadTeams || [])]);
        setMyTeamIds(allTeams.filter(t => names.has(t.name)).map(t => t.id));
      }
    }

    // Dynamic OS Platform Detection for iOS vs Android
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
      document.body.classList.add('platform-ios');
      document.body.classList.remove('platform-android');
    } else if (/android/.test(ua)) {
      setPlatform('android');
      document.body.classList.add('platform-android');
      document.body.classList.remove('platform-ios');
    } else {
      // Desktop Developer Emulation check (Chrome devtools overrides userAgent on devices)
      if (ua.includes('android')) {
        setPlatform('android');
      } else {
        setPlatform('ios'); // default fallback
      }
    }
  }, [profiles, allTeams, role, trackingSettingsRows]);

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
    { name: 'Warehouses', href: '/admin/warehouses', icon: MapPin },
    { name: 'Tasks', href: '/admin/tasks', icon: ClipboardList },
    { name: 'Leaves Approval', href: '/admin/leaves', icon: Clock },
    { name: 'Payroll & Salary', href: '/admin/payroll', icon: Wallet },
    { name: 'Career Board', href: '/admin/careers', icon: Briefcase },
    { name: 'Master Reports', href: '/admin/reports', icon: FileText },
    { name: 'Screen Tracking', href: '/admin/tracking', icon: Monitor },
    { name: 'Support Tickets', href: '/admin/tickets', icon: HelpCircle },
    { name: 'Team Chats', href: '/admin/team-chats', icon: MessageSquare },
  ];

  const hrItems = [
    { name: 'HR Dashboard', href: '/hr', icon: LayoutDashboard },
    { name: 'Task Management', href: '/hr/tasks', icon: ClipboardList },
    { name: 'Onboarding', href: '/hr/onboarding', icon: UserPlus },
    { name: 'Leave Management', href: '/hr/leaves', icon: Clock },
    { name: 'Team Management', href: '/hr/teams', icon: Users },
    { name: 'Payroll Records', href: '/hr/payroll', icon: Wallet },
    { name: 'Career Board', href: '/hr/careers', icon: Briefcase },
    { name: 'Master Reports', href: '/hr/reports', icon: FileText },
    { name: 'Screen Tracking', href: '/hr/tracking', icon: Monitor },
    { name: 'Support Tickets', href: '/hr/tickets', icon: HelpCircle },
  ];

  const employeeItems = [
    { name: 'My Dashboard', href: '/employee', icon: LayoutDashboard },
    ...(trackingEnabled ? [{ name: 'Timesheet Tracker', href: '/employee/tracker', icon: Clock }] : []),
    { name: 'My Leaves', href: '/employee/leaves', icon: Clock },
    { name: 'Salary History', href: '/employee/salary', icon: Wallet },
    { name: 'Career Board', href: '/employee/careers', icon: Briefcase },
    { name: 'Support Tickets', href: '/employee/tickets', icon: HelpCircle },
    { name: 'Team Chat', href: '/employee/chat', icon: MessageSquare },
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

  // Mobile bar tabs mapping
  const getMobileQuickLinks = () => {
    if (role === 'hr') {
      return [
        { name: 'Home', href: '/hr', icon: LayoutDashboard },
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
    return [
      { name: 'Dashboard', href: '/employee', icon: LayoutDashboard },
      { name: 'Leaves', href: '/employee/leaves', icon: Clock },
      { name: 'Tickets', href: '/employee/tickets', icon: HelpCircle },
      ...(isTeamLead ? [{ name: 'Team Tasks', href: '/employee/tasks', icon: Star }] : [{ name: 'Salary', href: '/employee/salary', icon: Wallet }]),
    ];
  };

  const mobileQuickLinks = getMobileQuickLinks();
  const mobileSideLinks = links.filter(link => !mobileQuickLinks.some(quick => quick.href === link.href));
  const isChatScreen = pathname.endsWith('/chat') || pathname.endsWith('/team-chats');

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
            const showDot = (item.href.endsWith('/tickets') && hasUnseenTickets) || ((item.href.endsWith('/chat') || item.href.endsWith('/team-chats')) && hasUnseenChat);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 relative ${
                  isActive
                    ? 'bg-orange-50 text-orange-700'
                    : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="relative mr-3">
                  <Icon className={`h-5 w-5 ${isActive ? 'text-orange-700' : 'text-slate-400'}`} />
                  {showDot && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-rose-500 border border-white" />}
                </span>
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
      </aside>      {/* iOS vs Android Responsive Bottom Tab Bar */}
      {!isChatScreen && (
        platform === 'ios' ? (
          /* iOS Style: Translucent frosted glass tab bar, thin lines, SF Symbols feel */
          <div 
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/70 backdrop-blur-xl border-t border-slate-200/40 pb-safe shadow-sm flex justify-around items-center pt-2 pb-3 px-3"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif' }}
          >
            {mobileQuickLinks.map(item => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              const showDot = (item.href.endsWith('/tickets') && hasUnseenTickets) || ((item.href.endsWith('/chat') || item.href.endsWith('/team-chats')) && hasUnseenChat);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex flex-col items-center gap-1 active:opacity-40 transition-opacity duration-75 relative ${
                    isActive ? 'text-orange-600' : 'text-slate-400'
                  }`}
                >
                  <span className="relative">
                    <Icon className="h-5.5 w-5.5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                    {showDot && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-rose-500 border border-white" />}
                  </span>
                  <span className="text-[9px] font-medium tracking-tight">{item.name}</span>
                </Link>
              );
            })}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className={`flex flex-col items-center gap-1 active:opacity-40 transition-opacity duration-75 relative ${
                isMobileMenuOpen ? 'text-orange-600' : 'text-slate-400'
              }`}
            >
              <Menu className="h-5.5 w-5.5 shrink-0" strokeWidth={2} />
              <span className="text-[9px] font-medium tracking-tight">Menu</span>
            </button>
          </div>
        ) : (
          /* Android Style: Material Design 3 Solid Tab Bar, Active Highlight Indicator Pills, MD Typography, Light Mode */
          <div 
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200/80 pb-safe shadow-lg flex justify-around items-center pt-3 pb-4 px-1"
            style={{ fontFamily: 'Roboto, "Noto Sans", sans-serif' }}
          >
            {mobileQuickLinks.map(item => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              const showDot = (item.href.endsWith('/tickets') && hasUnseenTickets) || ((item.href.endsWith('/chat') || item.href.endsWith('/team-chats')) && hasUnseenChat);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform duration-100 relative"
                >
                  <div className={`relative px-5 py-1 rounded-full flex items-center justify-center transition-all ${
                    isActive ? 'bg-orange-50 text-orange-700 shadow-sm' : 'bg-transparent text-slate-400'
                  }`}>
                    <Icon className="h-5 w-5 shrink-0" />
                    {showDot && <span className="absolute top-0 right-3 h-2 w-2 rounded-full bg-rose-500 border border-white" />}
                  </div>
                  <span className={`text-[10px] tracking-wide font-medium ${isActive ? 'text-orange-700 font-bold' : 'text-slate-500'}`}>
                    {item.name}
                  </span>
                </Link>
              );
            })}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform duration-100 relative"
            >
              <div className={`px-5 py-1 rounded-full flex items-center justify-center transition-all ${
                isMobileMenuOpen ? 'bg-orange-50 text-orange-700 shadow-sm' : 'bg-transparent text-slate-400'
              }`}>
                <Menu className="h-5 w-5 shrink-0" />
              </div>
              <span className={`text-[10px] tracking-wide font-medium ${isMobileMenuOpen ? 'text-orange-700 font-bold' : 'text-slate-500'}`}>
                Menu
              </span>
            </button>
          </div>
        )
      )}

      {/* Mobile Drawer (Left Slide-Out) Styled by Platform */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          <div 
            ref={drawerRef}
            className={`relative flex flex-col w-64 max-w-xs h-full shadow-2xl p-5 z-50 justify-between animate-in slide-in-from-left duration-200 bg-white/95 backdrop-blur-md border-r border-slate-200/50 rounded-r-2xl`}
            style={{ 
              fontFamily: platform === 'ios' 
                ? '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' 
                : 'Roboto, sans-serif'
            }}
          >
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="font-bold text-lg tracking-tight text-orange-600">
                  DelCargo Menu
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-full transition-colors text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Links */}
              <nav className="space-y-1">
                {mobileSideLinks.map(item => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  const showDot = (item.href.endsWith('/tickets') && hasUnseenTickets) || ((item.href.endsWith('/chat') || item.href.endsWith('/team-chats')) && hasUnseenChat);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-orange-50 text-orange-700'
                          : 'text-slate-650 hover:bg-slate-50'
                      }`}
                    >
                      <span className="relative">
                        <Icon className={`h-4.5 w-4.5 shrink-0 ${
                          isActive ? 'text-orange-700' : 'text-slate-450'
                        }`} />
                        {showDot && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-rose-500 border border-white" />}
                      </span>
                      {item.name}
                    </Link>
                  );
                })}

                {/* Policy Handbook link */}
                <Link
                  href={policyHref}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isPolicyActive 
                      ? 'bg-orange-50 text-orange-700'
                      : 'text-slate-650 hover:bg-slate-50'
                  }`}
                >
                  <BookOpen className={`h-4.5 w-4.5 shrink-0 ${
                    isPolicyActive ? 'text-orange-700' : 'text-slate-450'
                  }`} />
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
