'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { db, Profile, TrackingSettings, Screenshot } from '@/lib/db';
import { encodeSetupCode, getSupabasePublicConfig, TRACKER_RELEASES_URL } from '@/lib/trackerSetup';
import { Monitor, Settings, Image as ImageIcon, Download, Copy, RefreshCw, ShieldAlert } from 'lucide-react';

interface TrackingViewProps {
  role: 'admin' | 'hr';
}

const AGENT_SCRIPT_PATH = '/delcargo_tracker_agent.py';
const RELEASES_URL = TRACKER_RELEASES_URL;

export function TrackingView({ role }: TrackingViewProps) {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [settingsList, setSettingsList] = useState<TrackingSettings[]>([]);
  const [regionFilter, setRegionFilter] = useState<'All' | 'USA' | 'Pakistan'>('All');

  // Setup Agent modal
  const [setupEmp, setSetupEmp] = useState<Profile | null>(null);
  const [copied, setCopied] = useState(false);

  // Screenshot viewer modal
  const [viewerEmp, setViewerEmp] = useState<Profile | null>(null);
  const [viewerRange, setViewerRange] = useState<'week' | 'month'>('week');
  const [viewerShots, setViewerShots] = useState<Screenshot[]>([]);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(() => {
    const emps = db.getEmployees().filter(e => e.role === 'employee' || e.role === 'team_lead');
    setEmployees(emps);
    setSettingsList(db.getTrackingSettings());
  }, []);

  useEffect(() => {
    loadData();
    // Monthly retention sweep — fire-and-forget, runs once per HR/Admin
    // dashboard visit. Safe to call repeatedly; it no-ops once this month
    // has already been checked (see checkScreenshotRetention in db.ts).
    db.checkScreenshotRetention();
  }, [loadData]);

  const settingsFor = (email: string): TrackingSettings =>
    settingsList.find(s => s.employeeEmail.toLowerCase() === email.toLowerCase())
    || { employeeEmail: email, enabled: false, intervalMinutes: 15, excludeFromAutoDelete: false, agentToken: '' };

  const handleToggle = async (email: string, enabled: boolean) => {
    const updated = await db.updateTrackingSettings(email, { enabled });
    setSettingsList(updated);
  };

  const handleIntervalChange = async (email: string, minutes: number) => {
    if (minutes < 1) return;
    const updated = await db.updateTrackingSettings(email, { intervalMinutes: minutes });
    setSettingsList(updated);
  };

  const handleExcludeToggle = async (email: string, excludeFromAutoDelete: boolean) => {
    const updated = await db.updateTrackingSettings(email, { excludeFromAutoDelete });
    setSettingsList(updated);
  };

  const handleOpenSetup = async (emp: Profile) => {
    setCopied(false);
    let settings = settingsFor(emp.email);
    if (!settings.agentToken) {
      const updated = await db.updateTrackingSettings(emp.email, {});
      setSettingsList(updated);
      settings = updated.find(s => s.employeeEmail.toLowerCase() === emp.email.toLowerCase()) || settings;
    }
    setSetupEmp(emp);
  };

  const handleRegenerateToken = async (email: string) => {
    const confirmed = window.confirm('Regenerating the token will disconnect the currently installed agent until it is reconfigured with the new token. Continue?');
    if (!confirmed) return;
    await db.regenerateAgentToken(email);
    setSettingsList(db.getTrackingSettings());
  };

  const copyConfig = (settings: TrackingSettings) => {
    const config = `SUPABASE_URL=${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pftbzajbfelexyyhqmef.supabase.co'}\nSUPABASE_ANON_KEY=${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_fqs9oSIYNtzkhqOa-xzAjg_9DxUGbAI'}\nAGENT_TOKEN=${settings.agentToken}`;
    navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copySetupCode = (settings: TrackingSettings) => {
    const { url, key } = getSupabasePublicConfig();
    const code = encodeSetupCode(url, key, settings.agentToken);
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenViewer = async (emp: Profile) => {
    setViewerEmp(emp);
    setViewerRange('week');
    await loadViewerShots(emp.email, 'week');
  };

  const loadViewerShots = async (email: string, range: 'week' | 'month') => {
    setViewerLoading(true);
    try {
      const now = new Date();
      const since = new Date(now);
      if (range === 'week') since.setDate(now.getDate() - 7);
      else since.setMonth(now.getMonth() - 1);
      const shots = await db.getScreenshots({ employeeEmail: email, sinceISO: since.toISOString() });
      setViewerShots(shots);
    } finally {
      setViewerLoading(false);
    }
  };

  const handleRangeChange = (range: 'week' | 'month') => {
    setViewerRange(range);
    if (viewerEmp) loadViewerShots(viewerEmp.email, range);
  };

  const handleExportZip = async () => {
    if (!viewerEmp || viewerShots.length === 0) return;
    setExporting(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const manifestRows = ['Timestamp,Filename'];
      viewerShots.forEach((s, i) => {
        const ts = new Date(s.timestamp);
        const filename = `${ts.toISOString().replace(/[:.]/g, '-')}_${i}.jpg`;
        const base64Data = s.imageData.split(',')[1] || s.imageData;
        zip.file(filename, base64Data, { base64: true });
        manifestRows.push(`${s.timestamp},${filename}`);
      });
      zip.file('manifest.csv', manifestRows.join('\n'));
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${viewerEmp.fullName.replace(/\s+/g, '_')}_screenshots_${viewerRange}_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. See console for details.');
    } finally {
      setExporting(false);
    }
  };

  const filteredEmployees = employees.filter(emp => regionFilter === 'All' || (emp.region || 'Pakistan') === regionFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Monitor className="h-5 w-5 md:h-6 md:w-6 text-orange-600" /> Employee Screen Tracking
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Enable desktop screenshot monitoring per employee, set capture intervals, and manage the monthly retention policy.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start">
          {(['All', 'USA', 'Pakistan'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRegionFilter(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${regionFilter === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <Card className="border border-amber-200 bg-amber-50/60">
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 font-semibold leading-relaxed">
            This feature requires each employee to install the free DelCargo Tracker desktop app (Windows/Mac) — a browser tab alone cannot silently capture the desktop.
            It runs quietly in the background (system tray) and only captures while you&apos;ve toggled tracking on below and the employee is on a manually-started shift.
            Employees can now get their own setup code directly from their Shift Tracker page — you don&apos;t have to hand it to them, though the button below still works if you want to.
            Each employee&apos;s setup code only ever connects to their own account (the app confirms the resolved identity before connecting) and can&apos;t reveal or alter anyone else&apos;s.
            Screenshots are stored via the Supabase free tier for small-scale testing; captured images older than 30 days are automatically deleted each month
            (with a warning first), unless an employee is explicitly excluded below.
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0 border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm text-left border-collapse">
            <thead className="text-xs font-bold text-slate-500 bg-slate-50 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Region</th>
                <th className="px-6 py-4 text-center">Tracking</th>
                <th className="px-6 py-4 text-center">Interval (min)</th>
                <th className="px-6 py-4 text-center">Exclude from Auto-Delete</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredEmployees.map(emp => {
                const settings = settingsFor(emp.email);
                return (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{emp.fullName}</div>
                      <div className="text-xs text-slate-450">{emp.email}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-semibold">{emp.region || 'Pakistan'}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggle(emp.email, !settings.enabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                      <div className="mt-1">
                        <Badge variant={settings.enabled ? 'success' : 'default'}>{settings.enabled ? 'Active' : 'Off'}</Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input
                        type="number"
                        min={1}
                        defaultValue={settings.intervalMinutes}
                        onBlur={(e) => handleIntervalChange(emp.email, Number(e.target.value) || settings.intervalMinutes)}
                        className="w-20 bg-slate-50 border border-slate-200 rounded-md py-1.5 px-2 text-center text-xs focus:border-orange-500 outline-none"
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={settings.excludeFromAutoDelete}
                        onChange={(e) => handleExcludeToggle(emp.email, e.target.checked)}
                        className="h-4 w-4 accent-orange-600 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col sm:flex-row justify-center gap-2">
                        <button
                          onClick={() => handleOpenSetup(emp)}
                          className="text-[10px] font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-2 py-1.5 rounded-lg active:scale-97 transition-all flex items-center gap-1.5"
                        >
                          <Settings className="h-3.5 w-3.5" /> Setup Agent
                        </button>
                        <button
                          onClick={() => handleOpenViewer(emp)}
                          className="text-[10px] font-bold text-slate-650 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded-lg active:scale-97 transition-all flex items-center gap-1.5"
                        >
                          <ImageIcon className="h-3.5 w-3.5" /> Screenshots
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold italic">No employees found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Setup Agent Modal */}
      <Modal isOpen={!!setupEmp} onClose={() => setSetupEmp(null)} title={setupEmp ? `Setup Agent — ${setupEmp.fullName}` : 'Setup Agent'}>
        {setupEmp && (() => {
          const settings = settingsFor(setupEmp.email);
          return (
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  <span className="font-bold text-slate-800">Step 1.</span> Have the employee download the <span className="font-semibold">DelCargo Tracker</span> app for their computer (no Python or setup required) and install it like any other program.
                </p>
                <a
                  href={RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 px-3 py-2 rounded-lg active:scale-97 transition-all"
                >
                  <Download className="h-3.5 w-3.5" /> Get DelCargo Tracker (Windows / Mac)
                </a>
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  <span className="font-bold text-slate-800">Step 2.</span> Copy this one-time setup code and have them paste it into the app when it first opens.
                </p>
                <div className="bg-slate-900 text-slate-100 rounded-lg p-3 font-mono text-[10px] leading-relaxed overflow-x-auto break-all">
                  {encodeSetupCode(
                    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pftbzajbfelexyyhqmef.supabase.co',
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_fqs9oSIYNtzkhqOa-xzAjg_9DxUGbAI',
                    settings.agentToken
                  )}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => copySetupCode(settings)}
                    className="text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 px-3 py-2 rounded-lg flex items-center gap-1.5 active:scale-97 transition-all"
                  >
                    <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied!' : 'Copy Setup Code'}
                  </button>
                  <button
                    onClick={() => handleRegenerateToken(setupEmp.email)}
                    className="text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-lg flex items-center gap-1.5 active:scale-97 transition-all"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerate Token
                  </button>
                </div>
              </div>

              <details className="border-t border-slate-200 pt-3">
                <summary className="text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer">Advanced: raw script (requires Python)</summary>
                <div className="mt-2 space-y-2">
                  <div className="bg-slate-900 text-slate-100 rounded-lg p-3 font-mono text-[10px] leading-relaxed overflow-x-auto whitespace-pre">
{`SUPABASE_URL=${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pftbzajbfelexyyhqmef.supabase.co'}
SUPABASE_ANON_KEY=${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_fqs9oSIYNtzkhqOa-xzAjg_9DxUGbAI'}
AGENT_TOKEN=${settings.agentToken}`}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => copyConfig(settings)}
                      className="text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg flex items-center gap-1.5 active:scale-97 transition-all"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy Config
                    </button>
                    <a
                      href={AGENT_SCRIPT_PATH}
                      download
                      className="text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg flex items-center gap-1.5 active:scale-97 transition-all"
                    >
                      <Download className="h-3.5 w-3.5" /> Download .py Script
                    </a>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Requires Python 3 installed on the employee&apos;s machine. Run <code className="bg-slate-100 px-1 rounded">pip install pyautogui pillow requests --break-system-packages</code> then <code className="bg-slate-100 px-1 rounded">python delcargo_tracker_agent.py</code>.
                  </p>
                </div>
              </details>

              <p className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-200 pt-3">
                Tracking must be toggled &quot;Active&quot; above for captures to be accepted. The app only captures while that toggle is on and (for remote employees) their shift is active.
              </p>
            </div>
          );
        })()}
      </Modal>

      {/* Screenshot Viewer Modal */}
      <Modal isOpen={!!viewerEmp} onClose={() => setViewerEmp(null)} title={viewerEmp ? `Screenshots — ${viewerEmp.fullName}` : 'Screenshots'}>
        {viewerEmp && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => handleRangeChange('week')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewerRange === 'week' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                >
                  Past Week
                </button>
                <button
                  onClick={() => handleRangeChange('month')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewerRange === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                >
                  Past Month
                </button>
              </div>
              <button
                onClick={handleExportZip}
                disabled={viewerShots.length === 0 || exporting}
                className="text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 px-3 py-2 rounded-lg flex items-center gap-1.5 active:scale-97 transition-all"
              >
                <Download className="h-3.5 w-3.5" /> {exporting ? 'Exporting…' : `Export ${viewerShots.length} as ZIP`}
              </button>
            </div>

            {viewerLoading ? (
              <p className="text-center text-slate-400 text-xs font-semibold py-10">Loading screenshots…</p>
            ) : viewerShots.length === 0 ? (
              <p className="text-center text-slate-400 text-xs font-semibold italic py-10">No screenshots captured in this period.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                {viewerShots.map(shot => (
                  <div key={shot.id} className="space-y-1">
                    <img src={shot.imageData} alt="Screenshot" className="w-full h-24 object-cover rounded-lg border border-slate-200" />
                    <p className="text-[9px] text-slate-400 font-semibold text-center">{new Date(shot.timestamp).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
