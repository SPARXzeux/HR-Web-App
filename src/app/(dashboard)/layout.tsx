'use client';

import React, { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { useRouter } from 'next/navigation';
import { db, Profile } from '@/lib/db';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle2, ChevronRight, BookOpen, User, ShieldCheck, HelpCircle, FileText, Upload } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<'admin' | 'hr' | 'employee' | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  
  // Onboarding States
  const [onboardStep, setOnboardStep] = useState(1);
  const [acceptedDocs, setAcceptedDocs] = useState({ conduct: false, handbook: false, privacy: false });
  const [signName, setSignName] = useState('');
  const [stepperError, setStepperError] = useState('');
  const [showConsent, setShowConsent] = useState(false);

  // Document Upload Simulator States
  const [cvFile, setCvFile] = useState<string | null>(null);
  const [cnicFile, setCnicFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState({ cv: false, cnic: false });

  const router = useRouter();

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role') as 'admin' | 'hr' | 'employee' | null;
    const savedEmail = localStorage.getItem('user_email');
    
    if (!savedRole || !savedEmail) {
      router.push('/auth');
    } else {
      setRole(savedRole);
      setEmail(savedEmail);
      
      const employees = db.getEmployees();
      const userProfile = employees.find(e => e.email === savedEmail);
      if (userProfile) {
        setProfile(userProfile);
      }

      if (savedRole === 'employee') {
        const consent = localStorage.getItem(`consent_accepted_${savedEmail}`);
        if (!consent) {
          setShowConsent(true);
        }
      }
    }
  }, [router]);

  const handleConsentAccept = () => {
    if (email) {
      localStorage.setItem(`consent_accepted_${email}`, 'true');
      setShowConsent(false);
    }
  };

  const simulateUpload = (type: 'cv' | 'cnic', name: string) => {
    setUploading(prev => ({ ...prev, [type]: true }));
    setTimeout(() => {
      setUploading(prev => ({ ...prev, [type]: false }));
      if (type === 'cv') setCvFile(name);
      else setCnicFile(name);
    }, 1200);
  };

  const handleNextStep = () => {
    setStepperError('');
    if (onboardStep === 1) {
      setOnboardStep(2);
    } else if (onboardStep === 2) {
      if (!cvFile || !cnicFile) {
        setStepperError('Required: CV and CNIC images must be uploaded to proceed.');
        return;
      }
      setOnboardStep(3);
    } else if (onboardStep === 3) {
      setOnboardStep(4);
    }
  };

  const handleCompleteOnboarding = () => {
    setStepperError('');
    if (!signName || signName.trim().toLowerCase() !== profile?.fullName.trim().toLowerCase()) {
      setStepperError('Please sign with your exact full name to confirm.');
      return;
    }

    if (!acceptedDocs.conduct || !acceptedDocs.handbook || !acceptedDocs.privacy) {
      setStepperError('Please read and accept all policy documents.');
      return;
    }

    if (email) {
      db.updateOnboardingStatus(email, true);
      const employees = db.getEmployees();
      const updated = employees.find(e => e.email === email);
      if (updated) {
        setProfile(updated);
      }
      // Add welcome notification
      db.addNotification(email, 'employee', 'Welcome onboard! Your dashboard is now fully unlocked.');
    }
  };

  if (!role || (role === 'employee' && !profile)) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <svg className="animate-spin h-8 w-8 text-orange-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  // Force onboarding stepper gate if user is employee and onboarding is incomplete
  if (role === 'employee' && profile && !profile.onboardingCompleted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl mx-auto w-full bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
          
          {/* Header */}
          <div className="text-center pb-6 border-b border-slate-200 mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Employee Onboarding</h1>
            <p className="text-sm text-slate-500 mt-2">Welcome to DelCargo! Complete these simple steps to access your dashboard.</p>
          </div>

          {/* Stepper Indicators */}
          <div className="flex justify-between items-center mb-8 relative">
            <div className="absolute left-0 right-0 h-0.5 bg-slate-200 top-1/2 -translate-y-1/2 z-0"></div>
            
            <div className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold z-10 ${
              onboardStep >= 1 ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'
            }`}>
              1
            </div>
            <div className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold z-10 ${
              onboardStep >= 2 ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'
            }`}>
              2
            </div>
            <div className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold z-10 ${
              onboardStep >= 3 ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'
            }`}>
              3
            </div>
            <div className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold z-10 ${
              onboardStep >= 4 ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'
            }`}>
              4
            </div>
          </div>

          {/* Error notice */}
          {stepperError && (
            <div className="p-3 text-xs bg-rose-50 text-rose-600 border border-rose-100 rounded-lg font-semibold mb-6 animate-in fade-in duration-150">
              {stepperError}
            </div>
          )}

          {/* Step 1: Confirmation */}
          {onboardStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <User className="h-5 w-5 text-orange-600" /> Step 1: Verify Profile
              </h2>
              <p className="text-sm text-slate-655">Verify your current organizational details before proceeding:</p>
              
              <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200/50">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-500">Full Name</span>
                  <span className="font-medium text-slate-900">{profile.fullName}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-500">Email</span>
                  <span className="font-medium text-slate-900">{profile.email}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-500">Role</span>
                  <span className="font-medium text-slate-900 capitalize">{profile.role}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-500">Assigned Teams</span>
                  <span className="font-medium text-slate-900">{profile.teams.join(', ')}</span>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-200">
                <button 
                  onClick={handleNextStep}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all flex items-center gap-1"
                >
                  Verify & Continue <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Document Uploader Simulator */}
          {onboardStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Upload className="h-5 w-5 text-orange-600" /> Step 2: Upload Documents
              </h2>
              <p className="text-sm text-slate-655 font-medium">Please upload CNIC card images (both sides) and CV as requested by HR:</p>

              <div className="space-y-4">
                {/* CV file box */}
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 flex flex-col justify-between min-h-[100px]">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm font-bold text-slate-900">1. Curriculum Vitae (CV) *</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">PDF or Word format under 5MB</p>
                    </div>
                    {cvFile ? (
                      <span className="text-emerald-600 font-bold text-xs flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Uploaded</span>
                    ) : uploading.cv ? (
                      <span className="text-slate-400 text-xs animate-pulse">Uploading file...</span>
                    ) : (
                      <label className="text-xs bg-orange-600 text-white hover:bg-orange-700 px-3 py-1.5 rounded cursor-pointer font-bold select-none transition-all active:scale-97">
                        Upload PDF
                        <input 
                          type="file" 
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => simulateUpload('cv', e.target.files?.[0]?.name || 'Sarah_Connor_CV.pdf')}
                        />
                      </label>
                    )}
                  </div>
                  {cvFile && (
                    <div className="text-xs font-semibold text-slate-600 mt-3 flex items-center gap-1 bg-white p-2 rounded border border-slate-200">
                      <FileText className="h-4 w-4 text-orange-600" /> {cvFile}
                    </div>
                  )}
                </div>

                {/* CNIC file box */}
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 flex flex-col justify-between min-h-[100px]">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm font-bold text-slate-900">2. CNIC Card (Both Sides) *</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">JPG or PNG image scan</p>
                    </div>
                    {cnicFile ? (
                      <span className="text-emerald-600 font-bold text-xs flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Uploaded</span>
                    ) : uploading.cnic ? (
                      <span className="text-slate-400 text-xs animate-pulse">Uploading scans...</span>
                    ) : (
                      <label className="text-xs bg-orange-600 text-white hover:bg-orange-700 px-3 py-1.5 rounded cursor-pointer font-bold select-none transition-all active:scale-97">
                        Upload Scan
                        <input 
                          type="file" 
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => simulateUpload('cnic', e.target.files?.[0]?.name || 'Sarah_Connor_CNIC.png')}
                        />
                      </label>
                    )}
                  </div>
                  {cnicFile && (
                    <div className="text-xs font-semibold text-slate-600 mt-3 flex items-center gap-1 bg-white p-2 rounded border border-slate-200">
                      <FileText className="h-4 w-4 text-orange-600" /> {cnicFile}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-200">
                <button 
                  onClick={() => setOnboardStep(1)}
                  className="bg-white border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all"
                >
                  Back
                </button>
                <button 
                  onClick={handleNextStep}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all flex items-center gap-1"
                >
                  Confirm & Continue <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Features Guide */}
          {onboardStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-orange-600" /> Step 3: Platform Features Guide
              </h2>
              <p className="text-sm text-slate-655">Review the features available on your DelCargo portal:</p>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                  <h4 className="text-sm font-semibold text-slate-900">1. My Dashboard</h4>
                  <p className="text-xs text-slate-500 mt-1">Check active balances for paid time off (PTO) and sick leaves. View the target release dates for monthly salaries.</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                  <h4 className="text-sm font-semibold text-slate-900">2. Leave Management</h4>
                  <p className="text-xs text-slate-500 mt-1">Submit new leave requests by selecting dates and a reason. Track approvals as HR and CEOs update them in real time.</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                  <h4 className="text-sm font-semibold text-slate-900">3. Salary Ledgers</h4>
                  <p className="text-xs text-slate-500 mt-1">Access detailed payslips. View base pay configurations, performance bonus credits, and leaf-deduction breakdowns.</p>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-200">
                <button 
                  onClick={() => setOnboardStep(2)}
                  className="bg-white border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all"
                >
                  Back
                </button>
                <button 
                  onClick={handleNextStep}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all flex items-center gap-1"
                >
                  Confirm & Continue <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Sign Off & Policies */}
          {onboardStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-orange-600" /> Step 4: Policies & Sign Off
              </h2>
              <p className="text-sm text-slate-655 font-medium">Please read and acknowledge the shared corporate guidelines:</p>

              <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
                <div className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-900">Code of Conduct</span>
                    <input 
                      type="checkbox" 
                      checked={acceptedDocs.conduct}
                      onChange={(e) => setAcceptedDocs(prev => ({ ...prev, conduct: e.target.checked }))}
                      className="h-4 w-4 text-orange-650 rounded border-slate-350 focus:ring-orange-500"
                    />
                  </div>
                  <p className="text-xs text-slate-555">Professional interaction guidelines and conflict resolution frameworks.</p>
                </div>

                <div className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-900">Employee Handbook</span>
                    <input 
                      type="checkbox" 
                      checked={acceptedDocs.handbook}
                      onChange={(e) => setAcceptedDocs(prev => ({ ...prev, handbook: e.target.checked }))}
                      className="h-4 w-4 text-orange-650 rounded border-slate-350 focus:ring-orange-500"
                    />
                  </div>
                  <p className="text-xs text-slate-555">Detailed guidelines on leave policies, salary increment cycles, and tools usage.</p>
                </div>

                <div className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-900">Privacy & Data Policy</span>
                    <input 
                      type="checkbox" 
                      checked={acceptedDocs.privacy}
                      onChange={(e) => setAcceptedDocs(prev => ({ ...prev, privacy: e.target.checked }))}
                      className="h-4 w-4 text-orange-650 rounded border-slate-350 focus:ring-orange-500"
                    />
                  </div>
                  <p className="text-xs text-slate-555">Privacy guarantees and guidelines for processing corporate and customer data.</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">
                  Digital Signature <span className="text-slate-400 font-semibold text-[10px] lowercase">(Case-insensitive: must match your full name "{profile.fullName}" exactly)</span>
                </label>
                <input 
                  type="text" 
                  value={signName}
                  onChange={(e) => setSignName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-3 text-sm focus:border-orange-500 outline-none text-slate-900 font-medium"
                  placeholder={profile.fullName}
                />
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-200">
                <button 
                  onClick={() => setOnboardStep(3)}
                  className="bg-white border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all"
                >
                  Back
                </button>
                <button 
                  onClick={handleCompleteOnboarding}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4" /> Complete Onboarding
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      <Sidebar role={role} />
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-6 md:p-8 pb-20 md:pb-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Consent Popup Overlay Gate */}
      {showConsent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-xl shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-150">
            <div className="text-center pb-4 border-b border-slate-200 mb-6">
              <h2 className="text-xl font-bold text-slate-900">DelCargo HR Consent & Data Agreement</h2>
              <p className="text-xs text-slate-500 mt-1">Please review the terms of data access before continuing.</p>
            </div>
            
            <div className="space-y-4 text-xs text-slate-700 bg-slate-50 p-6 rounded-lg border border-slate-200/50 max-h-[420px] overflow-y-auto leading-relaxed font-medium">
              <p className="text-sm font-semibold text-slate-900">Hello {profile?.fullName || 'Employee'}, welcome to the team {profile?.teams.join(' and ') || 'Operations'}!</p>
              <p className="font-semibold text-slate-800">Please review the following important HR policies:</p>
              
              <ol className="list-decimal pl-5 space-y-2.5">
                <li>Your first month’s salary will be reserved and can be claimed upon resignation.</li>
                <li>Kindly share your CV, clear front and back images of CNIC along with your bank account details.</li>
                <li>You are entitled to 1 paid time-off (PTO) leave per month.</li>
                <li>PTO requests must be submitted at least 2 weeks in advance.</li>
                <li>For emergency leaves, 2 days’ salary will be deducted for each day of emergency leave. However, if you take no more than 3 emergency leaves in a year, the deducted amount will be reimbursed at year-end.</li>
                <li>
                  Unused PTOs can be:
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>Accumulated and used together (e.g., for vacations),</li>
                    <li>Rolled over to the next year, or</li>
                    <li>Cashed out at the end of the year.</li>
                  </ul>
                </li>
                <li>An annual promotion of PKR 10,000 will be applied.</li>
                <li>Salary details are confidential. Please do not disclose your salary to other employees. If someone asks or insists, report it to HR immediately.</li>
              </ol>

              <div className="pt-4 border-t border-slate-200/60 text-slate-500 font-semibold space-y-0.5">
                <p>If you have any questions or need clarification, feel free to reach out.</p>
                <p className="mt-2">Thank you!</p>
                <p className="text-slate-700">HR Manager</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end pt-4 border-t border-slate-200">
              <button 
                onClick={handleConsentAccept}
                className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm active:scale-97 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4" /> I Agree & Consent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
