'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { db, CareerPosition } from '@/lib/db';
import { Briefcase, MapPin, Plus, Trash2, CheckCircle2, UserCircle2, ArrowRight } from 'lucide-react';

interface CareersViewProps {
  role: 'admin' | 'hr' | 'employee' | 'team_lead' | 'public';
}

export function CareersView({ role }: CareersViewProps) {
  const [positions, setPositions] = useState<CareerPosition[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<CareerPosition | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [dept, setDept] = useState('Engineering');
  const [loc, setLoc] = useState('');
  const [desc, setDesc] = useState('');
  const [reqsText, setReqsText] = useState('');
  const [success, setSuccess] = useState('');

  // Application form states
  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [applySuccess, setApplySuccess] = useState('');

  useEffect(() => {
    setPositions(db.getCareers());
  }, []);

  const handleAddJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !loc || !desc) return;
    const requirements = reqsText.split('\n').map(r => r.trim()).filter(Boolean);
    const newJob = db.addCareer({
      title,
      department: dept,
      location: loc,
      description: desc,
      requirements,
    });
    setPositions(prev => [...prev, newJob]);
    setSuccess('Position listed successfully!');
    setTimeout(() => {
      setIsAddOpen(false);
      setTitle('');
      setLoc('');
      setDesc('');
      setReqsText('');
      setSuccess('');
    }, 1200);
  };

  const handleDeleteJob = (id: string) => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return;
    const updated = db.deleteCareer(id);
    setPositions(updated);
  };

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName || !applicantEmail) return;

    db.addNotification('all', 'hr', `New application for "${selectedJob?.title}" submitted by ${applicantName} (${applicantEmail})`);
    setApplySuccess('Application submitted successfully! Our HR team will get back to you.');
    setTimeout(() => {
      setIsApplyOpen(false);
      setApplicantName('');
      setApplicantEmail('');
      setCoverLetter('');
      setApplySuccess('');
      setSelectedJob(null);
    }, 2000);
  };

  const canEdit = role === 'hr' || role === 'admin';

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">DelCargo Careers Board</h1>
          <p className="text-slate-500 text-sm">Join our growing logistics tech team. Browse active openings below.</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsAddOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="h-4.5 w-4.5" /> Post New Job
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {positions.map(job => (
          <Card key={job.id} className="border border-slate-200 hover:border-orange-300 hover:shadow-md transition-all flex flex-col justify-between">
            <CardContent className="p-5 space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{job.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold mt-1">
                    <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded border border-orange-100 uppercase tracking-wide text-[9px] font-bold">{job.department}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location}</span>
                  </div>
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleDeleteJob(job.id)}
                    className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded transition-all"
                    title="Delete listing"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{job.description}</p>

              {job.requirements.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Key Requirements</p>
                  <ul className="list-disc pl-4 text-xs text-slate-700 space-y-0.5">
                    {job.requirements.slice(0, 3).map((req, idx) => (
                      <li key={idx}>{req}</li>
                    ))}
                    {job.requirements.length > 3 && (
                      <li className="list-none text-[10px] font-bold text-slate-400 mt-1">+{job.requirements.length - 3} more requirements</li>
                    )}
                  </ul>
                </div>
              )}
            </CardContent>

            <div className="px-5 pb-5 pt-2 border-t border-slate-100/50 flex justify-end">
              <button
                onClick={() => { setSelectedJob(job); setIsApplyOpen(true); }}
                className="flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 hover:translate-x-0.5 transition-all"
              >
                Apply for position <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </Card>
        ))}

        {positions.length === 0 && (
          <div className="md:col-span-2 text-center py-16 text-slate-400 italic text-sm border-2 border-dashed border-slate-200 rounded-xl">
            No active open positions. Check back later!
          </div>
        )}
      </div>

      {/* Post job Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Create New Job Listing">
        <form onSubmit={handleAddJob} className="space-y-4">
          {success && (
            <div className="p-3 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> {success}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Job Title *</label>
            <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900" placeholder="e.g. Lead QA Engineer" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Department</label>
              <select value={dept} onChange={e => setDept(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900">
                <option value="Engineering">Engineering</option>
                <option value="Design">Design</option>
                <option value="Marketing">Marketing</option>
                <option value="Operations">Operations</option>
                <option value="HR">HR</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Location *</label>
              <input type="text" required value={loc} onChange={e => setLoc(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900" placeholder="e.g. Remote / Lahore" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Description *</label>
            <textarea required rows={3} value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900 resize-none" placeholder="Provide details about the role..." />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Requirements (One per line)</label>
            <textarea rows={3} value={reqsText} onChange={e => setReqsText(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900" placeholder="Requirement 1&#10;Requirement 2&#10;Requirement 3" />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setIsAddOpen(false)} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all">Cancel</button>
            <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all shadow-sm">Post Opening</button>
          </div>
        </form>
      </Modal>

      {/* Apply Modal */}
      <Modal isOpen={isApplyOpen} onClose={() => setIsApplyOpen(false)} title={`Apply: ${selectedJob?.title}`}>
        <form onSubmit={handleApplySubmit} className="space-y-4">
          {applySuccess ? (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-800 text-xs font-semibold leading-relaxed">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mb-1" />
              {applySuccess}
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Full Name *</label>
                <input type="text" required value={applicantName} onChange={e => setApplicantName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900" placeholder="e.g. your name" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Email Address *</label>
                <input type="email" required value={applicantEmail} onChange={e => setApplicantEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900" placeholder="e.g. applicant@company.com" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Cover Letter / Note</label>
                <textarea rows={3} value={coverLetter} onChange={e => setCoverLetter(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900 resize-none" placeholder="Say hello or detail your fit..." />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setIsApplyOpen(false)} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all">Cancel</button>
                <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all shadow-sm">Submit Application</button>
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
