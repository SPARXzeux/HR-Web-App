'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { ArrowLeft, Eye, EyeOff, Mail } from 'lucide-react';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Warm up the database by syncing from Supabase immediately on mount
    db.syncFromSupabase().catch(err => {
      console.error('[Auth Sync] Pre-login database synchronization failed:', err);
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    setTimeout(() => {
      setLoading(false);
      let role: 'admin' | 'hr' | 'employee' | 'team_lead' | null = null;

      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail === 'admin@delcargo.us' && password === 'Aamir@123') {
        role = 'admin';
      } else if (cleanEmail === 'hr@delcargo.us' && password === 'HR@123') {
        role = 'hr';
      } else {
        // Query the local database for employee accounts
        const employees = db.getEmployees();
        const profile = employees.find(emp => emp.email.toLowerCase() === cleanEmail);
        if (profile && (profile.password === password || (!profile.password && password === 'employee123'))) {
          if (profile.offboarded) {
            setError('This account has been deactivated / offboarded.');
            return;
          }
          role = profile.role;
        }
      }

      if (role) {
        localStorage.setItem('user_role', role);
        localStorage.setItem('user_email', cleanEmail);
        // team_lead users share the employee dashboard
        const dashRoute = role === 'team_lead' ? 'employee' : role;
        router.push(`/${dashRoute}`);
      } else {
        setError('Invalid email or password.');
      }
    }, 800);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 font-sans animate-in fade-in duration-200">
      <div className="w-full max-w-5xl mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
        </Link>
      </div>
      <Card className="w-full max-w-5xl shadow-xl bg-white border border-slate-200 rounded-3xl overflow-hidden grid grid-cols-1 md:grid-cols-2 p-0">
        {/* Left Side: Premium Image Cover */}
        <div className="relative hidden md:flex flex-col justify-end p-8 bg-slate-900 overflow-hidden">
          <img 
            src="/delcargo_warehouse_hightech.png" 
            alt="Sign In Visual Cover" 
            className="absolute inset-0 w-full h-full object-cover opacity-75 object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/30 to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-36 bg-gradient-to-r from-transparent via-white/20 via-white/60 to-white z-10 pointer-events-none" />
          <div className="relative z-20 space-y-1">
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full w-fit">
              DelCargo Portal
            </span>
            <h2 className="text-xl font-bold text-white uppercase tracking-wider mt-1" style={{ fontFamily: 'Georgia, serif' }}>
              Streamlining Supply Chains
            </h2>
          </div>
        </div>

        {/* Right Side: Form Content container */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <CardHeader className="text-center pb-2 p-0 mb-6">
            <div className="mx-auto bg-orange-600 h-11 w-11 rounded-xl flex items-center justify-center mb-4 shadow-md shadow-orange-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <CardTitle className="text-xl font-bold text-slate-900">Welcome back</CardTitle>
            <p className="text-xs text-slate-500 mt-1 font-semibold">Sign in to your HR Operations account</p>
          </CardHeader>
          <CardContent className="p-0">
            {error && (
              <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm font-semibold mb-4 border border-rose-100">
                {error}
              </div>
            )}
            {db.getLastSyncError() && (
              <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-xs font-semibold mb-4 border border-rose-100 text-left">
                ⚠️ Supabase Connection Issue:<br/>
                <span className="font-mono text-[10px] mt-1 block text-rose-700 bg-white/50 p-1.5 rounded border border-rose-200/50">{db.getLastSyncError()}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 rounded-xl outline-none text-xs font-semibold transition-all text-slate-900"
                  placeholder="you@delcargo.us"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 rounded-xl outline-none text-xs font-semibold transition-all text-slate-900"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setIsForgotOpen(true)}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-xl transition-all shadow-md shadow-orange-600/10 mt-4 disabled:opacity-70 flex justify-center items-center active:scale-97 text-xs uppercase tracking-wider"
              >
                {loading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : 'Sign In'}
              </button>
            </form>
          </CardContent>
        </div>
      </Card>

      <Modal isOpen={isForgotOpen} onClose={() => setIsForgotOpen(false)} title="Forgot Password">
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-orange-50 border border-orange-100 p-4 rounded-xl">
            <Mail className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-700 font-semibold leading-relaxed">
              Self-service password reset isn't available yet. To reset your password, please contact your HR administrator directly — they can reset it for you from the Employee Directory.
            </p>
          </div>
          <div className="text-xs text-slate-500 space-y-1">
            <p className="font-bold text-slate-700">HR Contact</p>
            <p>hr@delcargo.us</p>
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button
              onClick={() => setIsForgotOpen(false)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-xs transition-all active:scale-97"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
