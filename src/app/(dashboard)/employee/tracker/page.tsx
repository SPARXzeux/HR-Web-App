'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { db, Profile, TimesheetEntry } from '@/lib/db';
import { Timer, Monitor, ShieldAlert, MapPin } from 'lucide-react';

export default function TrackerPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [openShift, setOpenShift] = useState<TimesheetEntry | null>(null);
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>([]);
  const [elapsedLabel, setElapsedLabel] = useState('0h 0m 0s');

  useEffect(() => {
    const email = localStorage.getItem('user_email');
    const employees = db.getEmployees();
    const userProfile = employees.find(e => e.email === email);
    if (userProfile) {
      setProfile(userProfile);
      refreshShiftData(userProfile.email);
    }
  }, []);

  const refreshShiftData = (email: string) => {
    const all = db.getTimesheets().filter(t => t.employeeEmail === email);
    const open = all.find(t => t.status === 'in_progress') || null;
    setOpenShift(open);
    setTimesheetEntries(all.sort((a, b) => (b.clockIn || '').localeCompare(a.clockIn || '')));
  };

  // Live elapsed-time ticker for the currently open shift, computed from the
  // real clock-in timestamp — not a locally-simulated counter, so it stays
  // correct even across page reloads.
  useEffect(() => {
    if (!openShift) {
      setElapsedLabel('0h 0m 0s');
      return;
    }

    const tick = () => {
      const startMs = new Date(openShift.clockIn).getTime();
      const diffSecs = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const hrs = Math.floor(diffSecs / 3600);
      const mins = Math.floor((diffSecs % 3600) / 60);
      const secs = diffSecs % 60;
      setElapsedLabel(`${hrs}h ${mins}m ${secs}s`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [openShift]);

  // Poll for shift changes made elsewhere (e.g. geofence auto clock-in/out
  // happening on the dashboard page) so this view stays in sync.
  useEffect(() => {
    if (!profile) return;
    const interval = setInterval(() => refreshShiftData(profile.email), 5000);
    return () => clearInterval(interval);
  }, [profile]);

  return (
    <div className="space-y-4 md:space-y-6 font-sans">
      <div>
        <h1 className="text-lg md:text-2xl font-bold text-slate-900">Shift Tracker</h1>
        <p className="text-xs md:text-sm text-slate-500">
          Real clock-in / clock-out history, sourced directly from your synced shift records — no simulated data.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">

        {/* Current shift status (left 5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className={`border-t-4 shadow-md ${openShift ? 'border-t-emerald-500 bg-white' : 'border-t-slate-350 bg-slate-50/50'}`}>
            <CardContent className="p-6 space-y-6">
              {openShift ? (
                <div className="text-center space-y-2">
                  <span className="text-[10px] font-bold text-emerald-650 uppercase tracking-widest bg-emerald-50 border border-emerald-150 px-3 py-1 rounded-full w-fit mx-auto flex items-center gap-1.5 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> On Shift
                  </span>
                  <div className="text-3xl md:text-4xl font-bold text-slate-900 font-mono pt-2 flex items-center justify-center gap-2">
                    <Timer className="h-8 w-8 text-emerald-500" />
                    {elapsedLabel}
                  </div>
                  <p className="text-[10px] text-slate-450 font-semibold leading-relaxed">
                    Clocked in at {new Date(openShift.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {profile?.region === 'USA' ? ' via GPS warehouse geofencing.' : ' (manual shift start).'}
                  </p>
                </div>
              ) : (
                <div className="text-center py-8 space-y-3 font-sans">
                  <ShieldAlert className="h-10 w-10 text-slate-350 mx-auto" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Off Shift</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed font-semibold">
                      {profile?.region === 'USA'
                        ? 'Your shift will start automatically when your device enters your assigned warehouse geofence (see the Dashboard page).'
                        : 'Start your shift manually from the Dashboard page when you begin work.'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {profile?.region === 'USA' && (
            <Card className="border border-slate-200 bg-white">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-orange-500" /> Location-Based Attendance
                </h3>
              </div>
              <CardContent className="p-5 text-xs text-slate-500 font-semibold leading-relaxed">
                Shift start/end for USA warehouse staff is fully automatic and based on your device's real GPS location relative to your assigned warehouse. Manage and view live geofence status from the Dashboard page.
              </CardContent>
            </Card>
          )}

          {/* Honest placeholder — no fake activity/screenshot data */}
          <Card className="border border-slate-200 bg-white">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Workstation Activity Monitoring</h3>
            </div>
            <CardContent className="p-6 text-center space-y-3 font-sans">
              <Monitor className="h-8 w-8 text-slate-300 mx-auto" />
              <div>
                <h4 className="text-xs font-bold text-slate-750">Desktop Capture Client Not Installed</h4>
                <p className="text-[10px] text-slate-450 leading-relaxed font-semibold mt-1">
                  Screenshot captures and keyboard/mouse activity monitoring require installing the Windows background client agent, which is not yet available. This section will populate with real data once that client ships.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Real timesheet log (right 7 cols) */}
        <div className="lg:col-span-7">
          <Card className="border border-slate-200 h-full">
            <div className="px-4 md:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Shift History</h3>
              <Badge variant="default">Total: {timesheetEntries.length} Shifts</Badge>
            </div>
            <CardContent className="p-0">
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="font-bold text-slate-555 bg-slate-50 uppercase tracking-widest border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Clock In</th>
                      <th className="px-5 py-3.5">Clock Out</th>
                      <th className="px-5 py-3.5 text-right">Duration</th>
                      <th className="px-5 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {timesheetEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-55/30 transition-colors">
                        <td className="px-5 py-4 font-bold text-slate-800">{entry.date}</td>
                        <td className="px-5 py-4 text-slate-550 font-medium font-mono">{new Date(entry.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="px-5 py-4 text-slate-550 font-medium font-mono">{entry.clockOut ? new Date(entry.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td className="px-5 py-4 text-right font-bold text-slate-900">{entry.duration || '—'}</td>
                        <td className="px-5 py-4 text-right">
                          <Badge variant={entry.status === 'in_progress' ? 'warning' : 'success'}>
                            {entry.status === 'in_progress' ? 'On Shift' : 'Completed'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {timesheetEntries.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold italic">No shifts recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Mobile card stack */}
              <div className="md:hidden space-y-2 p-3">
                {timesheetEntries.map((entry) => (
                  <div key={entry.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-900">{entry.date}</p>
                      <Badge variant={entry.status === 'in_progress' ? 'warning' : 'success'}>
                        {entry.status === 'in_progress' ? 'On Shift' : 'Completed'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">Clock In / Out</p>
                        <p className="text-xs font-semibold text-slate-700 font-mono">
                          {new Date(entry.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' → '}
                          {entry.clockOut ? new Date(entry.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">Duration</p>
                        <p className="text-xs font-bold text-slate-900">{entry.duration || '—'}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {timesheetEntries.length === 0 && (
                  <p className="py-6 text-center text-slate-400 font-semibold italic text-xs">No shifts recorded yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
