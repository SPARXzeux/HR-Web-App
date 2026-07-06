'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { db, CareerPosition } from '@/lib/db';
import { MapPin, Plus, Trash2, CheckCircle2, ArrowRight, X, Briefcase, FileText } from 'lucide-react';

interface CareersViewProps {
  role: 'admin' | 'hr' | 'employee' | 'team_lead' | 'public';
}

export function CareersView({ role }: CareersViewProps) {
  const [positions, setPositions] = useState<CareerPosition[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<CareerPosition | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

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
  const categories = ['All', 'Engineering', 'Design', 'Marketing', 'Operations', 'HR'];

  const filteredJobs = selectedCategory === 'All' 
    ? positions 
    : positions.filter(j => j.department.toLowerCase() === selectedCategory.toLowerCase());

  return (
    <div className="space-y-16 max-w-6xl mx-auto font-sans">
      
      {/* High-End Editorial Hero Section */}
      <section className="text-center space-y-4 py-8">
        <h1 className="text-4xl sm:text-5xl font-light text-slate-900 tracking-tight uppercase" style={{ fontFamily: 'Georgia, serif' }}>
          Work with DelCargo
        </h1>
        <div className="h-0.5 w-12 bg-orange-600 mx-auto" />
        <p className="max-w-2xl mx-auto text-slate-500 text-sm sm:text-base font-light leading-relaxed">
          We are building the future of supply-chain technology. Join our collaborative logistics and product teams in creating beautiful, operational-grade software.
        </p>
      </section>

      {/* Categories Filter tab */}
      <div className="border-b border-slate-200 flex flex-wrap gap-6 justify-center text-xs uppercase tracking-wider font-bold text-slate-400">
        {categories.map(cat => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`pb-3 transition-colors ${
                active 
                  ? 'border-b-2 border-orange-600 text-slate-900' 
                  : 'hover:text-slate-700'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Grid listing */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-light text-slate-900 uppercase tracking-widest" style={{ fontFamily: 'Georgia, serif' }}>
            Open Positions ({filteredJobs.length})
          </h2>
          {canEdit && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-xl text-xs active:scale-97 transition-all flex items-center gap-1 shadow-sm"
            >
              <Plus className="h-4 w-4" /> Post Job
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filteredJobs.map(job => (
            <div 
              key={job.id} 
              className="bg-white border border-slate-200 hover:border-orange-200 p-6 sm:p-8 flex flex-col justify-between transition-all"
            >
              <div className="space-y-6">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-lg tracking-tight">{job.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-400 font-semibold mt-1">
                      <span className="text-orange-700 font-bold uppercase tracking-wider text-[9px]">{job.department}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location}</span>
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => handleDeleteJob(job.id)}
                      className="text-slate-350 hover:text-rose-600 p-1 hover:bg-rose-50 rounded transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed font-light">{job.description}</p>

                {job.requirements.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Requirements</p>
                    <ul className="space-y-1">
                      {job.requirements.map((req, idx) => (
                        <li key={idx} className="text-xs text-slate-650 font-medium flex items-start gap-2">
                          <span className="h-1 w-1 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-slate-100 mt-6 flex justify-end">
                <button
                  onClick={() => { setSelectedJob(job); setIsApplyOpen(true); }}
                  className="flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 tracking-wider uppercase transition-colors"
                >
                  Apply now <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          {filteredJobs.length === 0 && (
            <div className="md:col-span-2 text-center py-20 text-slate-400 font-light italic text-sm border border-dashed border-slate-200 bg-white">
              No vacancies listed in this category.
            </div>
          )}
        </div>
      </div>

      {role === 'public' && (
        <>
          {/* About Us Section */}
          <section className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 mb-8 shadow-sm overflow-hidden font-sans">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* Left Column: Descriptive texts & stats */}
              <div className="lg:col-span-7 space-y-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest bg-orange-50 border border-orange-100 px-3 py-1 rounded-full">
                    Global Freight & Software
                  </span>
                  <h3 className="text-2xl font-light text-slate-900 uppercase tracking-wider mt-2" style={{ fontFamily: 'Georgia, serif' }}>
                    Who We Are
                  </h3>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                  DelCargo is a leading-edge global logistics and software engineering provider. We combine digital shipping architectures with physical distribution hubs to enable intelligent supply chain management. By fusing freight yards with automated tracking platforms, we help scale global commerce.
                </p>

                <p className="text-xs text-slate-550 leading-relaxed font-medium">
                  We maintain strategic warehousing facilities in major transit centers across North America and remote design cells in South Asia, operating with around-the-clock synchrony to keep supply lines operating optimally.
                </p>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                  <div>
                    <p className="text-lg font-bold text-slate-900">34+</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Transit Hubs</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900">1.2M+</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Packages/Yr</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900">99.8%</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">On-Time Rate</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Image */}
              <div className="lg:col-span-5 relative group overflow-hidden rounded-2xl border border-slate-200 shadow">
                <img 
                  src="/delcargo_warehouse_hightech.png" 
                  alt="High Tech Warehouse" 
                  className="w-full h-64 object-cover object-center group-hover:scale-103 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex flex-col justify-end p-4">
                  <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">Operations Hub</p>
                  <p className="text-white text-xs font-bold mt-0.5">Automated Warehouse JFK Center</p>
                </div>
              </div>

            </div>
          </section>

          {/* Culture & Benefits Section */}
          <section className="bg-slate-50/50 py-12 px-6 sm:px-12 border border-slate-200 space-y-8">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-light text-slate-900 uppercase tracking-widest" style={{ fontFamily: 'Georgia, serif' }}>
              Life at DelCargo
            </h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Perks & Compensation</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 text-center sm:text-left">
            <div className="space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">Good Salary</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-light">We offer competitive salaries calibrated for regional standards, with guaranteed annual increments.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">Accrued PTOs</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-light">Accrue leave balance every month with cashing out settlements.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">Learning & Tech</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-light">Collaborate using modern architectures, framework toolsets, and clean design structures.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">Parental Leaves</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-light">Gender-balanced opportunities including fully paid Parental Leaves.</p>
            </div>
          </div>
        </section>
      </>
    )}

      {role === 'employee' && (
        /* Referral Program Info Block */
        <section className="bg-orange-50/40 py-12 px-6 sm:px-12 border border-orange-100 rounded-2xl space-y-4">
          <h3 className="text-lg font-bold text-slate-950 flex items-center gap-1.5">
            🎁 Employee Referral Program
          </h3>
          <p className="text-xs text-slate-655 max-w-3xl leading-relaxed font-medium">
            Know someone who would be a perfect fit? Refer them! If your referred candidate gets selected and successfully completes <strong>6 months</strong> of service with DelCargo, you will receive a cash referral reward of <strong>PKR 10,000</strong>. Submissions can be sent directly to HR.
          </p>
        </section>
      )}

      {/* Add job listing Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Create New Job Listing">
        <form onSubmit={handleAddJob} className="space-y-4 pt-1">
          {success && (
            <div className="p-3 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> {success}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Job Title *</label>
            <input 
              type="text" 
              required 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold" 
              placeholder="e.g. Lead QA Engineer" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Department</label>
              <select 
                value={dept} 
                onChange={e => setDept(e.target.value)} 
                className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.875rem center',
                  backgroundSize: '1rem'
                }}
              >
                <option value="Engineering">Engineering</option>
                <option value="Design">Design</option>
                <option value="Marketing">Marketing</option>
                <option value="Operations">Operations</option>
                <option value="HR">HR</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Location *</label>
              <input 
                type="text" 
                required 
                value={loc} 
                onChange={e => setLoc(e.target.value)} 
                className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold" 
                placeholder="e.g. Remote (Pakistan)" 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description *</label>
            <textarea 
              required 
              rows={3} 
              value={desc} 
              onChange={e => setDesc(e.target.value)} 
              className="w-full bg-slate-50/50 hover:bg-slate-55 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold resize-none" 
              placeholder="Provide details about the role..." 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Requirements (One per line)</label>
            <textarea 
              rows={3} 
              value={reqsText} 
              onChange={e => setReqsText(e.target.value)} 
              className="w-full bg-slate-50/50 hover:bg-slate-55 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold" 
              placeholder="Requirement 1&#10;Requirement 2&#10;Requirement 3" 
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setIsAddOpen(false)} className="bg-white hover:bg-slate-55 border border-slate-200 text-slate-650 hover:text-slate-800 font-bold px-4 py-2 rounded-xl text-xs active:scale-97 transition-all">Cancel</button>
            <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-4 py-2 rounded-xl text-xs active:scale-97 transition-all shadow-sm">Post Opening</button>
          </div>
        </form>
      </Modal>

      {/* Apply Modal */}
      <Modal isOpen={isApplyOpen} onClose={() => setIsApplyOpen(false)} title={`Apply: ${selectedJob?.title}`}>
        <form onSubmit={handleApplySubmit} className="space-y-4 pt-1">
          {applySuccess ? (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-semibold leading-relaxed">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mb-1" />
              {applySuccess}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-555 uppercase tracking-wider">Full Name *</label>
                <input 
                  type="text" 
                  required 
                  value={applicantName} 
                  onChange={e => setApplicantName(e.target.value)} 
                  className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold" 
                  placeholder="e.g. John Doe" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-555 uppercase tracking-wider">Email Address *</label>
                <input 
                  type="email" 
                  required 
                  value={applicantEmail} 
                  onChange={e => setApplicantEmail(e.target.value)} 
                  className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold" 
                  placeholder="e.g. applicant@company.com" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-555 uppercase tracking-wider">Cover Letter / Note</label>
                <textarea 
                  rows={3} 
                  value={coverLetter} 
                  onChange={e => setCoverLetter(e.target.value)} 
                  className="w-full bg-slate-50/50 hover:bg-slate-55 border border-slate-200 focus:border-orange-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs outline-none text-slate-900 transition-all focus:ring-2 focus:ring-orange-100 font-semibold resize-none" 
                  placeholder="Say hello or detail your fit..." 
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setIsApplyOpen(false)} className="bg-white hover:bg-slate-55 border border-slate-200 text-slate-650 hover:text-slate-800 font-bold px-4 py-2 rounded-xl text-xs active:scale-97 transition-all">Cancel</button>
                <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-4 py-2 rounded-xl text-xs active:scale-97 transition-all shadow-sm">Submit Application</button>
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
