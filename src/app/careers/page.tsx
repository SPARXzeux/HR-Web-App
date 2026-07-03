'use client';

import React from 'react';
import { CareersView } from '@/components/ui/CareersView';
import Link from 'next/link';

export default function PublicCareersPage() {
  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      {/* Mini public header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sm:px-12 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="font-bold text-lg text-orange-600 tracking-tight">DelCargo Logistics</div>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Careers</span>
        </div>
        <Link 
          href="/auth"
          className="text-xs font-bold text-slate-600 hover:text-orange-600 transition-colors"
        >
          Employee Portal Login →
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-12 px-6 sm:px-12 max-w-5xl mx-auto w-full">
        <CareersView role="public" />
      </main>

      {/* Footer */}
      <footer className="h-14 border-t border-slate-250 bg-white flex items-center justify-center text-[10px] font-semibold text-slate-400">
        © {new Date().getFullYear()} DelCargo Operations Team. All rights reserved.
      </footer>
    </div>
  );
}
