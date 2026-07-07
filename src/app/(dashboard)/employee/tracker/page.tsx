'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { db, Profile, TimesheetEntry, TrackingSettings } from '@/lib/db';
import { encodeSetupCode, getSupabasePublicConfig, TRACKER_RELEASES_URL } from '@/lib/trackerSetup';
import { Timer, Monitor, ShieldAlert, MapPin, Download, Copy, RefreshCw } from 'lucide-react';

export default function TrackerPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [openShift, setOpenShift] = useState<TimesheetEntry | null>(null);
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>([]);
  const [elapsedLabel, setElapsedLabel] = useState('0h 0m 0s');
  const [trackingSettings, setTrackingSettings] = useState<TrackingSettings | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    const email = localStorage.getItem('user_email');
    const employees = db.getEmployees();
    const userProfile = employees.find(e => e.email && email && e.email.toLowerCase() === email.toLowerCase());
    if (userProfile) {
      setProfile(userProfile);
      refreshShiftData(userProfile.email);
      loadOwnTrackingSettings(userProfile.email);
    }
  }, []);

  // Employee self-service: fetch (and if needed, create) this employee's own
  // tracking settings row. Scoped strictly to their own logged-in email —
  // never any other employee's — so this never grants or reveals access to
  // anyone else's setup. Creating an agentToken here does NOT turn tracking
  // on; that "enabled" flag is still only ever flipped by HR/Admin or by
  // this employee's own Start/End Shift buttons on the Dashboard page.
  const loadOwnTrackingSettings = async (email: string) => {
    let settings = db.getTrackingSettingsFor(email);
    if (!settings.agentToken) {
      const updated = await db.updateTrackingSettings(email, {});
      settings = updated.find(s => s.employeeEmail.toLowerCase() === email.toLowerCase()) || settings;
    }
    setTrackingSettings(settings);
  };

  const handleCopySetupCode = () => {
    if (!trackingSettings?.agentToken) return;
    const { url, key } = getSupabasePublicConfig();
    const code = encodeSetupCode(url, key, trackingSettings.agentToken);
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleRegenerateOwnCode = async () => {
    if (!profile) return;
    const confirmed = window.confirm('Regenerating your setup code will disconnect the tracker app on any computer currently using your old code, until it is reconnected with the new one. Continue?');
    if (!confirmed) return;
    await db.regenerateAgentToken(profile.email);
    loadOwnTrackingSettings(profile.email);
  };

  const refreshShiftData = (email: string) => {
    const all = db.getTimesheets().filter(t => t.employeeEmail.toLowerCase() === email.toLowerCase());
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

          {/* Self-service screen tracking setup — no need to ask HR/Admin for a link or code */}
          <Card className="border border-slate-200 bg-white">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5 text-orange-500" /> Workstation Activity Monitoring
              </h3>
              <Badge variant={trackingSettings?.enabled ? 'success' : 'default'}>
                {trackingSettings?.enabled ? 'Active' : 'Off'}
              </Badge>
            </div>
            <CardContent className="p-5 space-y-3 font-sans">
              <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">
                Install the free DelCargo Tracker app once — it runs quietly in the background (system tray) and only captures periodic screenshots while HR/Admin has tracking enabled for you and you&apos;re on a manually-started shift. Keyboard/mouse activity monitoring is not implemented — only periodic screenshots.
              </p>

              {trackingSettings?.agentToken ? (
                <>
                  <a
                    href={TRACKER_RELEASES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 px-3 py-2 rounded-lg active:scale-97 transition-all w-full justify-center"
                  >
                    <Download className="h-3.5 w-3.5" /> Get DelCargo Tracker (Windows / Mac)
                  </a>

                  <div>
                    <p className="text-[10px] text-slate-500 font-semibold mb-1">Paste this code into the app when it first opens:</p>
                    <div className="bg-slate-900 text-slate-100 rounded-lg p-3 font-mono text-[10px] leading-relaxed overflow-x-auto break-all">
                      {encodeSetupCode(getSupabasePublicConfig().url, getSupabasePublicConfig().key, trackingSettings.agentToken)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleCopySetupCode}
                      className="text-[10px] font-bold text-white bg-slate-800 hover:bg-slate-900 px-3 py-2 rounded-lg flex items-center gap-1.5 active:scale-97 transition-all"
                    >
                      <Copy className="h-3.5 w-3.5" /> {codeCopied ? 'Copied!' : 'Copy My Setup Code'}
                    </button>
                    <button
                      onClick={handleRegenerateOwnCode}
                      className="text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-lg flex items-center gap-1.5 active:scale-97 transition-all"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Regenerate My Code
                    </button>
                  </div>

                  <p className="text-[9px] text-slate-400 leading-relaxed border-t border-slate-200 pt-2">
                    This code is unique to your account only — don&apos;t share it with a coworker, and don&apos;t paste someone else&apos;s code into your own tracker app. The app will show you which email address it connected as before it starts — always double-check that&apos;s you.
                  </p>
                </>
              ) : (
                <p className="text-[10px] text-slate-400 italic">Preparing your setup code…</p>
              )}
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
