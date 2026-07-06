'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { db, Profile, Task } from '@/lib/db';
import { Play, Square, Timer, Activity, Monitor, ShieldAlert, FileText, CheckCircle2 } from 'lucide-react';

export default function TrackerPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [activityScore, setActivityScore] = useState(0);
  const [activeApp, setActiveApp] = useState('System Idle');
  const [screenLogs, setScreenLogs] = useState<Array<{ time: string; app: string; score: number; img: string }>>([]);
  const [timesheetEntries, setTimesheetEntries] = useState<any[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const email = localStorage.getItem('user_email');
    const employees = db.getEmployees();
    const userProfile = employees.find(e => e.email === email);
    if (userProfile) {
      setProfile(userProfile);
      const allTasks = db.getTasks();
      const myTasks = allTasks.filter(t => t.assignedEmail === userProfile.email && t.status !== 'done');
      setTasks(myTasks);
      if (myTasks.length > 0) setSelectedTaskId(myTasks[0].id);

      // Automatically track if shift is active and monitoring is enabled
      const savedShift = localStorage.getItem(`shift_active_${userProfile.email}`) === 'true';
      if (savedShift && userProfile.trackingEnabled) {
        setIsTracking(true);
      }

      // Load timesheet entries from db simulation
      const key = `timesheets_${userProfile.email}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        setTimesheetEntries(JSON.parse(saved));
      } else {
        localStorage.setItem(key, JSON.stringify([]));
        setTimesheetEntries([]);
      }
    }
  }, []);

  // Tracking timer loop
  useEffect(() => {
    if (isTracking) {
      // Simulate active application titles
      const apps = ['VS Code', 'Google Chrome - StackOverflow', 'Figma - UI Mockups', 'GitKraken', 'Next.js Dev Server Console', 'Slack'];
      
      timerRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);

        // Fluctuate activity score randomly to simulate actual keyboard/mouse monitoring
        setActivityScore(Math.floor(Math.random() * 35) + 60);

        // Change simulated active window periodically
        if (Math.random() > 0.85) {
          setActiveApp(apps[Math.floor(Math.random() * apps.length)]);
        }

        // Randomly simulate capturing a screenshot (every ~20-30 seconds or so)
        if (Math.random() > 0.95) {
          const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const mockScreenshots = [
            'https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=300&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=300&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=300&auto=format&fit=crop'
          ];
          const randomImg = mockScreenshots[Math.floor(Math.random() * mockScreenshots.length)];
          setScreenLogs(prev => [
            { time: timeString, app: activeApp, score: activityScore, img: randomImg },
            ...prev.slice(0, 5)
          ]);
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTracking, activeApp, activityScore]);

  const handleToggleTracking = () => {
    if (isTracking) {
      // Stop tracking and save session
      const elapsedHours = (seconds / 3600).toFixed(2);
      const matchedTask = tasks.find(t => t.id === selectedTaskId);
      const taskName = matchedTask ? matchedTask.title : 'General Development Work';
      
      const newEntry = {
        date: 'Today',
        task: taskName,
        duration: formatHours(seconds),
        score: Math.floor(Math.random() * 15) + 78
      };

      const updated = [newEntry, ...timesheetEntries];
      setTimesheetEntries(updated);
      if (profile) {
        localStorage.setItem(`timesheets_${profile.email}`, JSON.stringify(updated));
      }

      setIsTracking(false);
      setSeconds(0);
      setActiveApp('System Idle');
    } else {
      // Start tracking
      setIsTracking(true);
      setSeconds(0);
      setActiveApp('VS Code');
      setActivityScore(85);
    }
  };

  const formatHours = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-4 md:space-y-6 font-sans">
      <div>
        <h1 className="text-lg md:text-2xl font-bold text-slate-900">Workstation Activity & Monitoring</h1>
        <p className="text-xs md:text-sm text-slate-500">Automated employee timesheet, window titles tracking, and random screen capture review.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
        
        {/* Connection status and tracking stats (left 5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className={`border-t-4 shadow-md ${profile?.trackingEnabled ? 'border-t-emerald-500 bg-white' : 'border-t-slate-350 bg-slate-50/50'}`}>
            <CardContent className="p-6 space-y-6">
              {profile?.trackingEnabled ? (
                <>
                  <div className="text-center space-y-2">
                    <span className="text-[10px] font-bold text-emerald-650 uppercase tracking-widest bg-emerald-50 border border-emerald-150 px-3 py-1 rounded-full w-fit mx-auto flex items-center gap-1.5 animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Workstation Client Connected
                    </span>
                    <div className="text-3xl md:text-4xl font-bold text-slate-900 font-mono pt-2 flex items-center justify-center gap-2">
                      <Timer className="h-8 w-8 text-emerald-500 animate-spin" style={{ animationDuration: '3s' }} />
                      {formatHours(seconds)}
                    </div>
                    <p className="text-[10px] text-slate-450 font-semibold leading-relaxed">
                      Your local Windows Workstation Client is actively tracking this session. Screen captures and window titles are processed automatically.
                    </p>
                  </div>

                  {/* Dynamic simulation analytics */}
                  <div className="space-y-3.5 bg-slate-50 p-4 border border-slate-200 rounded-2xl text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold flex items-center gap-1">
                        <Activity className="h-4 w-4 text-emerald-500" /> Simulated Activity Level:
                      </span>
                      <span className="font-bold text-emerald-600">{activityScore}%</span>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full transition-all duration-500"
                        style={{ width: `${activityScore}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
                      <span className="text-slate-500 font-semibold flex items-center gap-1">
                        <Monitor className="h-4 w-4 text-orange-500" /> Active Application:
                      </span>
                      <span className="font-bold text-slate-800 truncate max-w-[180px]" title={activeApp}>
                        {activeApp}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 space-y-3 font-sans">
                  <ShieldAlert className="h-10 w-10 text-slate-350 mx-auto" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Monitoring Inactive</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed font-semibold">
                      Your account is not designated for background workstation tracking. No software client or screenshot monitor is active.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Screenshot capture info notice */}
          <Card className="border border-slate-200 bg-white">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Screenshot Captures</h3>
            </div>
            <CardContent className="p-6 text-center space-y-3 font-sans">
              <Monitor className="h-8 w-8 text-slate-300 mx-auto" />
              <div>
                <h4 className="text-xs font-bold text-slate-750">Desktop Capture Client</h4>
                <p className="text-[10px] text-slate-450 leading-relaxed font-semibold mt-1">
                  This feature will be available soon. It requires installing the Windows background client agent on your workstation.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Historical Timesheet Log (right 7 cols) */}
        <div className="lg:col-span-7">
          <Card className="border border-slate-200 h-full">
            <div className="px-4 md:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Timesheet Log (Current Week)</h3>
              <Badge variant="default">Total: {timesheetEntries.length} Sessions</Badge>
            </div>
            <CardContent className="p-0">
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="font-bold text-slate-555 bg-slate-50 uppercase tracking-widest border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Assigned Task</th>
                      <th className="px-5 py-3.5 text-right">Hours</th>
                      <th className="px-5 py-3.5 text-right">Avg Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {timesheetEntries.map((entry, index) => (
                      <tr key={index} className="hover:bg-slate-55/30 transition-colors">
                        <td className="px-5 py-4 font-bold text-slate-800">{entry.date}</td>
                        <td className="px-5 py-4 text-slate-550 font-medium">{entry.task}</td>
                        <td className="px-5 py-4 text-right font-bold text-slate-900">{entry.duration}</td>
                        <td className="px-5 py-4 text-right font-bold text-emerald-600">{entry.score}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile card stack */}
              <div className="md:hidden space-y-2 p-3">
                {timesheetEntries.map((entry, index) => (
                  <div key={index} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-900">{entry.date}</p>
                      <span className="text-xs font-bold text-emerald-600">{entry.score}%</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">Task</p>
                        <p className="text-xs font-semibold text-slate-700">{entry.task}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">Hours</p>
                        <p className="text-xs font-bold text-slate-900">{entry.duration}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {timesheetEntries.length === 0 && (
                  <p className="py-6 text-center text-slate-400 font-semibold italic text-xs">No sessions recorded yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
