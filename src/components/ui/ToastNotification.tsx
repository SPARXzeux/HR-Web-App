'use client';

import React, { useState, useEffect } from 'react';
import { Bell, X, ShieldAlert } from 'lucide-react';
import { Notification } from '@/lib/db';

interface ToastMsg extends Notification {
  visible: boolean;
}

export function ToastNotification() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  useEffect(() => {
    const handleNewPush = (e: Event) => {
      const notif = (e as CustomEvent).detail as Notification;
      const newToast: ToastMsg = { ...notif, visible: true };
      
      setToasts(prev => [...prev, newToast]);

      // Auto fade out after 4 seconds
      setTimeout(() => {
        setToasts(prev => prev.map(t => t.id === notif.id ? { ...t, visible: false } : t));
      }, 4000);

      // Remove from state array completely after fade transition completes
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== notif.id));
      }, 4500);
    };

    window.addEventListener('newPushNotification', handleNewPush);
    return () => window.removeEventListener('newPushNotification', handleNewPush);
  }, []);

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="fixed top-5 right-5 z-[9999] space-y-3 pointer-events-none w-full max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`pointer-events-auto bg-white/90 backdrop-blur-md border border-slate-200 shadow-xl rounded-xl p-4 flex gap-3 items-start transition-all duration-300 transform ${
            toast.visible 
              ? 'translate-x-0 opacity-100 scale-100' 
              : 'translate-x-12 opacity-0 scale-95'
          }`}
        >
          <div className="h-8 w-8 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 shrink-0">
            <Bell className="h-4 w-4 animate-bounce" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Push Alert</p>
            <p className="text-xs font-semibold text-slate-800 mt-1 leading-relaxed">{toast.message}</p>
            <span className="text-[9px] text-slate-400 block mt-1.5 font-medium">{toast.timestamp}</span>
          </div>

          <button
            onClick={() => dismissToast(toast.id)}
            className="text-slate-400 hover:text-slate-600 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
