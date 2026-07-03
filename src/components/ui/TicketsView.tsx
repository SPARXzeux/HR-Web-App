'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { db, Ticket, Profile } from '@/lib/db';
import { HelpCircle, Plus, Send, Lock, RotateCcw, User, Mail, Calendar, Briefcase, Users, Eye, CheckCircle2, AlertCircle } from 'lucide-react';

interface TicketsViewProps {
  role: 'admin' | 'hr' | 'employee' | 'team_lead';
}

export function TicketsView({ role }: TicketsViewProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [currentEmail, setCurrentEmail] = useState('');
  const [userProfile, setUserProfile] = useState<Profile | null>(null);

  // Modals
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [inspectEmployee, setInspectEmployee] = useState<Profile | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [replyMsg, setReplyMsg] = useState('');
  const [success, setSuccess] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const email = localStorage.getItem('user_email') || '';
    setCurrentEmail(email);
    const emps = db.getEmployees();
    setEmployees(emps);
    setUserProfile(emps.find(e => e.email === email) || null);

    const all = db.getTickets();
    if (role === 'employee' || role === 'team_lead') {
      setTickets(all.filter(t => t.employeeEmail === email));
    } else {
      setTickets(all);
    }
  }, [role]);

  // Scroll chat to bottom when replies change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicket?.replies]);

  const handleOpenTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !desc || !userProfile) return;

    const newT = db.createTicket({
      employeeName: userProfile.fullName,
      employeeEmail: userProfile.email,
      title,
      description: desc
    });

    setTickets(prev => [newT, ...prev]);
    setSuccess('Support ticket opened successfully!');
    setTimeout(() => {
      setIsNewOpen(false);
      setTitle('');
      setDesc('');
      setSuccess('');
    }, 1200);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMsg.trim() || !selectedTicket || !userProfile) return;

    const updated = db.addTicketReply(selectedTicket.id, {
      senderName: userProfile.fullName,
      senderRole: role,
      message: replyMsg.trim()
    });

    // Update locally
    const updatedTicket = updated.find(t => t.id === selectedTicket.id);
    if (updatedTicket) setSelectedTicket(updatedTicket);
    setTickets(role === 'employee' || role === 'team_lead' ? updated.filter(t => t.employeeEmail === currentEmail) : updated);
    setReplyMsg('');
  };

  const handleCloseTicket = (id: string) => {
    if (!window.confirm('Are you sure you want to mark this support ticket as closed?')) return;
    const updated = db.updateTicketStatus(id, 'closed');
    const updatedTicket = updated.find(t => t.id === id);
    if (updatedTicket) setSelectedTicket(updatedTicket);
    setTickets(role === 'employee' || role === 'team_lead' ? updated.filter(t => t.employeeEmail === currentEmail) : updated);
  };

  const handleReopenTicket = (id: string) => {
    if (!window.confirm('Are you sure you want to re-open this ticket?')) return;
    const updated = db.updateTicketStatus(id, 'open');
    const updatedTicket = updated.find(t => t.id === id);
    if (updatedTicket) setSelectedTicket(updatedTicket);
    setTickets(role === 'employee' || role === 'team_lead' ? updated.filter(t => t.employeeEmail === currentEmail) : updated);
  };

  const handleInspectApplicant = (email: string) => {
    const p = employees.find(e => e.email === email);
    if (p) setInspectEmployee(p);
  };

  const isClosed = selectedTicket?.status === 'closed';
  const isAdmin = role === 'admin';
  const isHR = role === 'hr';
  const isEmp = role === 'employee' || role === 'team_lead';

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Support Help Desk</h1>
          <p className="text-slate-500 text-sm">Open support cases, seek assistance, and view ticket logs.</p>
        </div>
        {isEmp && (
          <button
            onClick={() => setIsNewOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="h-4.5 w-4.5" /> File a Ticket
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Tickets List */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Active Tickets ({tickets.length})</h3>
          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
            {tickets.map(t => {
              const active = selectedTicket?.id === t.id;
              return (
                <Card
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className={`border transition-all cursor-pointer p-4 ${
                    active ? 'border-orange-500 bg-orange-50/20' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-bold text-slate-900 text-sm line-clamp-1">{t.title}</span>
                    <Badge variant={t.status === 'open' ? 'warning' : 'success'}>
                      {t.status === 'open' ? 'Open' : 'Closed'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1 mb-2">{t.description}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                    <span>👤 {t.employeeName}</span>
                    <span>{t.createdAt}</span>
                  </div>
                </Card>
              );
            })}
            {tickets.length === 0 && (
              <div className="text-center py-12 text-slate-400 font-semibold italic text-xs border border-dashed border-slate-200 rounded-xl bg-white">
                No tickets listed.
              </div>
            )}
          </div>
        </div>

        {/* Conversation Chat Panel */}
        <div className="lg:col-span-7">
          {selectedTicket ? (
            <Card className="border border-slate-200 overflow-hidden flex flex-col min-h-[480px]">
              {/* Header */}
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    {selectedTicket.title}
                  </h3>
                  <div className="text-[10px] text-slate-550 font-bold mt-0.5 flex items-center gap-1.5">
                    <span>Opened by:</span>
                    <button 
                      onClick={() => handleInspectApplicant(selectedTicket.employeeEmail)}
                      className="text-orange-700 hover:underline flex items-center gap-0.5"
                    >
                      {selectedTicket.employeeName} ({selectedTicket.employeeEmail}) <Eye className="h-3 w-3 inline" />
                    </button>
                  </div>
                </div>

                {/* Operations */}
                <div className="flex items-center gap-2">
                  {isHR && !isClosed && (
                    <button
                      onClick={() => handleCloseTicket(selectedTicket.id)}
                      className="text-xs font-semibold bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg active:scale-97 transition-all flex items-center gap-1"
                    >
                      <Lock className="h-3.5 w-3.5" /> Close Ticket
                    </button>
                  )}
                  {isHR && isClosed && (
                    <button
                      onClick={() => handleReopenTicket(selectedTicket.id)}
                      className="text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg active:scale-97 transition-all flex items-center gap-1"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Re-open Ticket
                    </button>
                  )}
                  {isClosed && !isHR && (
                    <span className="text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-1 rounded-full uppercase tracking-wider">
                      🔒 CLOSED BY HR
                    </span>
                  )}
                </div>
              </div>

              {/* Chat replies log */}
              <div className="flex-1 p-5 space-y-4 max-h-[300px] overflow-y-auto bg-slate-50/30">
                {/* Employee Description */}
                <div className="flex items-start gap-2.5 max-w-[85%]">
                  <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                    {selectedTicket.employeeName[0]}
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3 shadow-sm text-xs">
                    <p className="font-bold text-slate-800 text-[10px] mb-0.5">{selectedTicket.employeeName} (Author)</p>
                    <p className="text-slate-750 font-medium leading-relaxed">{selectedTicket.description}</p>
                    <span className="block text-[9px] text-slate-400 font-semibold mt-1 text-right">{selectedTicket.createdAt}</span>
                  </div>
                </div>

                {/* Replies list */}
                {selectedTicket.replies.map(rep => {
                  const isSenderSelf = rep.senderName === userProfile?.fullName;
                  return (
                    <div 
                      key={rep.id} 
                      className={`flex items-start gap-2.5 max-w-[85%] ${
                        isSenderSelf ? 'ml-auto flex-row-reverse' : ''
                      }`}
                    >
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs uppercase flex-shrink-0 ${
                        isSenderSelf ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-750'
                      }`}>
                        {rep.senderName[0]}
                      </div>
                      <div className={`rounded-2xl p-3 shadow-sm text-xs ${
                        isSenderSelf 
                          ? 'bg-orange-600 text-white rounded-tr-none' 
                          : 'bg-white border border-slate-200 text-slate-850 rounded-tl-none'
                      }`}>
                        <p className={`font-bold text-[10px] mb-0.5 ${isSenderSelf ? 'text-orange-200' : 'text-slate-550'}`}>
                          {rep.senderName} ({rep.senderRole.toUpperCase()})
                        </p>
                        <p className="font-medium leading-relaxed">{rep.message}</p>
                        <span className={`block text-[9px] mt-1 text-right ${isSenderSelf ? 'text-orange-200' : 'text-slate-400'}`}>
                          {rep.timestamp}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Chat input bar */}
              <div className="p-4 border-t border-slate-200 bg-white">
                {isClosed ? (
                  <div className="text-xs text-slate-400 font-semibold italic text-center py-2 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center gap-1">
                    <Lock className="h-3.5 w-3.5" /> This support ticket is closed and read-only.
                  </div>
                ) : isAdmin ? (
                  <div className="text-xs text-slate-400 font-semibold italic text-center py-2 bg-slate-50 border border-slate-100 rounded-lg">
                    🔒 Admins can only view logs and history. Replies are disabled.
                  </div>
                ) : (
                  <form onSubmit={handleSendReply} className="flex gap-2">
                    <input
                      type="text"
                      value={replyMsg}
                      onChange={e => setReplyMsg(e.target.value)}
                      placeholder="Type your support message..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs focus:border-orange-500 outline-none text-slate-900"
                    />
                    <button
                      type="submit"
                      disabled={!replyMsg.trim()}
                      className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold p-2.5 rounded-lg active:scale-97 transition-all flex items-center justify-center shadow-sm"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </div>
            </Card>
          ) : (
            <div className="border-2 border-dashed border-slate-200 rounded-xl bg-white/50 py-32 text-center text-slate-400 font-semibold italic text-sm">
              Select a support ticket from the list to view history and chat logs.
            </div>
          )}
        </div>
      </div>

      {/* New ticket modal */}
      <Modal isOpen={isNewOpen} onClose={() => setIsNewOpen(false)} title="File Support Ticket">
        <form onSubmit={handleOpenTicket} className="space-y-4">
          {success && (
            <div className="p-3 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> {success}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Ticket Title / Topic *</label>
            <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900" placeholder="e.g. Salary discrepancy / System access issues" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Describe the Problem *</label>
            <textarea required rows={4} value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900 resize-none" placeholder="Explain the situation in details so HR can assist you..." />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setIsNewOpen(false)} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all">Cancel</button>
            <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all shadow-sm">File Ticket</button>
          </div>
        </form>
      </Modal>

      {/* Inspect employee profile modal */}
      {inspectEmployee && (
        <Modal isOpen={true} onClose={() => setInspectEmployee(null)} title="Employee Profile Inspector">
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-slate-50 p-4 border border-slate-200 rounded-xl">
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-700 text-sm">
                {inspectEmployee.fullName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{inspectEmployee.fullName}</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{inspectEmployee.jobTitle || inspectEmployee.role}</p>
              </div>
            </div>

            <div className="space-y-2.5 divide-y divide-slate-100 text-xs font-semibold">
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-450 uppercase text-[9px] tracking-wider">Email Address</span>
                <span className="text-slate-800 font-medium">{inspectEmployee.email}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-450 uppercase text-[9px] tracking-wider">Department Teams</span>
                <span className="text-slate-850">{inspectEmployee.teams.join(', ') || 'No Team'}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-450 uppercase text-[9px] tracking-wider">Service Start Date</span>
                <span className="text-slate-800">{new Date(inspectEmployee.joinedDate).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-450 uppercase text-[9px] tracking-wider">Gender</span>
                <span className="text-slate-800 capitalize">{inspectEmployee.gender || 'male'}</span>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200">
              <button onClick={() => setInspectEmployee(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-xs">
                Close Inspector
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
