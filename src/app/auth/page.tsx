'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { Truck } from 'lucide-react';

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

      if (email === 'admin@delcargo.us' && password === 'Aamir@123') {
        role = 'admin';
      } else if (email === 'hr@delcargo.us' && password === 'HR@123') {
        role = 'hr';
      } else {
        // Query the database for employee accounts
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 font-sans px-4 relative overflow-hidden">
      {/* Background Tech Gradients */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-white shadow-2xl relative z-10 rounded-3xl overflow-hidden p-0">
        <div className="p-[1px] bg-gradient-to-r from-orange-500 to-amber-600 rounded-3xl">
          <CardContent className="p-8 space-y-6 bg-slate-900 rounded-[23px]">
            <div className="text-center space-y-2">
              <div className="h-10 w-10 bg-orange-600/10 border border-orange-500/20 text-orange-500 flex items-center justify-center rounded-2xl mx-auto shadow-inner">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">Delcargo HR</h2>
                <p className="text-xs text-slate-400 font-medium">Logistics & Workstation Management Portal</p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750/50 focus:bg-slate-850 border border-slate-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-xl outline-none text-xs font-semibold transition-all text-white placeholder-slate-500"
                  placeholder="you@delcargo.us"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Password</label>
                  <a href="#" className="text-xs font-bold text-orange-550 hover:text-orange-550 hover:underline">Forgot password?</a>
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700/50 focus:bg-slate-850 border border-slate-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-xl outline-none text-xs font-semibold transition-all text-white placeholder-slate-500"
                  placeholder="••••••••"
                />
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
    </div>
  );
}
