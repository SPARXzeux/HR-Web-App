'use client';

import React from 'react';
import { CareersView } from '@/components/ui/CareersView';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      {/* Premium Public Landing Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sm:px-12 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="font-bold text-lg text-orange-600 tracking-tight">DelCargo Logistics</div>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Careers Portal</span>
        </div>
        <Link 
          href="/auth"
          className="text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-xl transition-all shadow-sm shadow-orange-600/10 active:scale-97"
        >
          Sign In to Employee Portal →
        </Link>
      </header>

      {/* Main Landing Content */}
      <main className="flex-1 py-16 px-6 sm:px-12 max-w-5xl mx-auto w-full">
        <CareersView role="public" />
      </main>

      {/* Footer */}
      <footer className="h-14 border-t border-slate-200 bg-white flex items-center justify-center text-[10px] font-semibold text-slate-400">
        © {new Date().getFullYear()} DelCargo Operations Team. All rights reserved.
      </footer>
    </div>
  );
}
