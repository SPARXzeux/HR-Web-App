'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    setTimeout(() => {
      setLoading(false);
      let role: 'admin' | 'hr' | 'employee' | 'team_lead' | null = null;

      if (email === 'admin@company.com' && password === 'admin123') {
        role = 'admin';
      } else if (email === 'hr@company.com' && password === 'hr123') {
        role = 'hr';
      } else {
        // Query the local database for employee accounts
        const employees = db.getEmployees();
        const profile = employees.find(emp => emp.email === email);
        if (profile && (profile.password === password || (!profile.password && password === 'employee123'))) {
          role = profile.role;
        }
      }

      if (role) {
        localStorage.setItem('user_role', role);
        localStorage.setItem('user_email', email);
        // team_lead users share the employee dashboard
        const dashRoute = role === 'team_lead' ? 'employee' : role;
        router.push(`/${dashRoute}`);
      } else {
        setError('Invalid email or password.');
      }
    }, 800);
  };

  const handleFillCredentials = (mockEmail: string, mockPass: string) => {
    setEmail(mockEmail);
    setPassword(mockPass);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg bg-white border border-slate-200">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-orange-600 h-12 w-12 rounded-xl flex items-center justify-center mb-4 shadow-md shadow-orange-500/20">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <p className="text-sm text-slate-500 mt-2">Sign in to your HR Operations account</p>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm font-semibold mb-4 border border-rose-100">
              {error}
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
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-550 outline-none text-sm transition-shadow"
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Password</label>
                <a href="#" className="text-xs font-semibold text-blue-600 hover:underline">Forgot password?</a>
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-550 outline-none text-sm transition-shadow"
                placeholder="••••••••"
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-sm mt-4 disabled:opacity-70 flex justify-center items-center active:scale-97"
            >
              {loading ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Mock Accounts for Testing</h4>
            <div className="space-y-2">
              <button 
                onClick={() => handleFillCredentials('admin@company.com', 'admin123')}
                className="w-full flex items-center justify-between p-2.5 text-left text-xs bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 active:scale-97"
              >
                <div>
                  <span className="font-semibold text-slate-700">Admin Account</span>
                  <p className="text-[10px] text-slate-500">admin@company.com / admin123</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200/50 text-[10px] font-semibold">Admin</span>
              </button>

              <button 
                onClick={() => handleFillCredentials('hr@company.com', 'hr123')}
                className="w-full flex items-center justify-between p-2.5 text-left text-xs bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 active:scale-97"
              >
                <div>
                  <span className="font-semibold text-slate-700">HR Account</span>
                  <p className="text-[10px] text-slate-500">hr@company.com / hr123</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/50 text-[10px] font-semibold">HR</span>
              </button>

              <button 
                onClick={() => handleFillCredentials('employee@company.com', 'employee123')}
                className="w-full flex items-center justify-between p-2.5 text-left text-xs bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 active:scale-97"
              >
                <div>
                  <span className="font-semibold text-slate-700">Employee Account</span>
                  <p className="text-[10px] text-slate-500">employee@company.com / employee123</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-805 border border-blue-200/50 text-[10px] font-semibold">Employee</span>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
