'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { db, Profile } from '@/lib/db';
import { Users, Trash2, Plus, AlertTriangle, CheckCircle2, UserCog, Star } from 'lucide-react';

export default function HRTeamsPage() {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  
  // Drag and Drop & Prompt Modal State
  const [draggedEmployee, setDraggedEmployee] = useState<Profile | null>(null);
  const [targetTeam, setTargetTeam] = useState<string | null>(null);
  const [isPromptOpen, setIsPromptOpen] = useState(false);

  // Manage Team Leads Modal State
  const [isTeamLeadOpen, setIsTeamLeadOpen] = useState(false);
  const [leadEmployeeId, setLeadEmployeeId] = useState('');
  const [leadTeamSelections, setLeadTeamSelections] = useState<string[]>([]);
  const [leadSuccess, setLeadSuccess] = useState('');

  useEffect(() => {
    setEmployees(db.getEmployees());
    setTeams(db.getTeams());

    const handleSearch = (e: Event) => {
      setSearchQuery((e as CustomEvent).detail || '');
    };
    window.addEventListener('globalSearch', handleSearch);
    return () => window.removeEventListener('globalSearch', handleSearch);
  }, []);

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    const updated = db.addTeam(newTeamName.trim());
    setTeams(updated);
    setNewTeamName('');
    setSaveSuccess(`Team "${newTeamName.trim()}" created successfully!`);
    setTimeout(() => setSaveSuccess(null), 1500);
  };

  const handleDeleteTeam = (teamName: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete the "${teamName}" team? Members will be removed from this team.`);
    if (!confirmDelete) return;

    const updatedTeams = db.deleteTeam(teamName);
    setTeams(updatedTeams);
    setEmployees(db.getEmployees()); // Reload employee states since they got updated
    setSaveSuccess(`Deleted team "${teamName}"`);
    setTimeout(() => setSaveSuccess(null), 1500);
  };

  const handleDragStart = (emp: Profile) => {
    setDraggedEmployee(emp);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Enable drop target
  };

  const handleDropOnTeam = (teamName: string) => {
    if (!draggedEmployee) return;

    if (draggedEmployee.teams.includes(teamName)) {
      return;
    }

    setTargetTeam(teamName);

    if (draggedEmployee.teams.length > 0) {
      setIsPromptOpen(true);
    } else {
      performAllocation(draggedEmployee.id, [teamName]);
    }
  };

  const performAllocation = (employeeId: string, finalTeams: string[]) => {
    const updated = db.updateEmployeeTeams(employeeId, finalTeams);
    setEmployees(updated);
    setDraggedEmployee(null);
    setTargetTeam(null);
    setIsPromptOpen(false);

    setSaveSuccess('Assignments updated successfully!');
    setTimeout(() => setSaveSuccess(null), 1500);
  };

  const handleConfirmMultiTeam = (mode: 'both' | 'reassign') => {
    if (!draggedEmployee || !targetTeam) return;

    if (mode === 'both') {
      const mergedTeams = [...draggedEmployee.teams, targetTeam];
      performAllocation(draggedEmployee.id, mergedTeams);
    } else {
      performAllocation(draggedEmployee.id, [targetTeam]);
    }
  };

  const handleToggleTeamLead = (emp: Profile) => {
    const alreadyLead = emp.isTeamLead && (emp.leadTeams?.length ?? 0) > 0;
    if (alreadyLead) {
      db.setTeamLead(emp.id, []);
      setSaveSuccess(`${emp.fullName} is no longer a team lead.`);
    } else {
      const leadTeams = emp.teams.length > 0 ? emp.teams : [];
      db.setTeamLead(emp.id, leadTeams);
      setSaveSuccess(`${emp.fullName} is now Team Lead of: ${leadTeams.join(', ') || '(no teams yet)'}`);
    }
    setEmployees(db.getEmployees());
    setTimeout(() => setSaveSuccess(null), 2000);
  };

  const handleLeadToggle = (teamName: string) => {
    setLeadTeamSelections(prev =>
      prev.includes(teamName) ? prev.filter(t => t !== teamName) : [...prev, teamName]
    );
  };

  const handleSaveTeamLead = () => {
    if (!leadEmployeeId) return;
    db.setTeamLead(leadEmployeeId, leadTeamSelections);
    setEmployees(db.getEmployees());
    const emp = employees.find(e => e.id === leadEmployeeId);
    setLeadSuccess(`${emp?.fullName} is now team lead of: ${leadTeamSelections.join(', ') || '(none)'}`);
    setTimeout(() => { setIsTeamLeadOpen(false); setLeadSuccess(''); setLeadEmployeeId(''); setLeadTeamSelections([]); }, 1400);
  };

  const filteredEmployees = employees.filter(emp => {
    return emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           emp.role.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teams & Allocations</h1>
          <p className="text-slate-500">Create custom teams and drag employees to allocate them.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsTeamLeadOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <UserCog className="h-4 w-4" /> Manage Team Leads
          </button>
          {saveSuccess && (
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-in fade-in duration-150 shadow-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {saveSuccess}
            </div>
          )}
        </div>
      </div>

      {/* Inline Team Builder Form */}
      <Card className="p-4 bg-slate-50/50 border border-slate-200">
        <form onSubmit={handleCreateTeam} className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="flex-1 w-full space-y-1">
            <input 
              type="text" 
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Enter team/department name (e.g. Quality Assurance)"
              className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
            />
          </div>
          <button 
            type="submit" 
            className="w-full sm:w-auto bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all flex items-center justify-center gap-1"
          >
            <Plus className="h-4 w-4" /> Create Team
          </button>
        </form>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Panel: Draggable Employees */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
            <Users className="h-4 w-4 text-orange-600" /> Employee List
          </h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredEmployees.map(emp => (
              <div 
                key={emp.id}
                draggable
                onDragStart={() => handleDragStart(emp)}
                className="cursor-grab select-none hover:shadow-md transition-all active:scale-97"
              >
                <Card className="p-4 bg-white border border-slate-200 hover:border-slate-350">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                        {emp.fullName}
                        {emp.isTeamLead && (emp.leadTeams?.length ?? 0) > 0 && (
                          <span title={`Lead of: ${emp.leadTeams?.join(', ')}`} className="text-amber-500">⭐</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-550 mt-0.5 uppercase tracking-wide font-medium">{emp.jobTitle || emp.role}</div>
                    </div>
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); handleToggleTeamLead(emp); }}
                      title={emp.isTeamLead && (emp.leadTeams?.length ?? 0) > 0 ? 'Remove team lead' : 'Make team lead'}
                      className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-all active:scale-95 ${
                        emp.isTeamLead && (emp.leadTeams?.length ?? 0) > 0
                          ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700'
                      }`}
                    >
                      <Star className="h-3 w-3" />
                      {emp.isTeamLead && (emp.leadTeams?.length ?? 0) > 0 ? 'Lead' : 'Set Lead'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {emp.teams.length === 0 ? (
                      <span className="text-[10px] text-slate-400">No teams assigned</span>
                    ) : (
                      emp.teams.map(t => (
                        <Badge key={t} variant="default" className="text-[9px] px-1.5 py-0.2">{t}</Badge>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel: Teams Drop Zones Grid */}
        <div className="lg:col-span-8 space-y-4">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
            Departments / Dropzones
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {teams.map(teamName => {
              const members = employees.filter(e => e.teams.includes(teamName));
              return (
                <div 
                  key={teamName}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDropOnTeam(teamName)}
                  className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 min-h-[160px] flex flex-col transition-all hover:bg-slate-100/50"
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-xs text-slate-700 uppercase tracking-wider">{teamName}</span>
                    <button 
                      onClick={() => handleDeleteTeam(teamName)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-white transition-colors"
                      title="Delete Team"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-2">
                    {members.map(member => (
                      <div key={member.id} className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm text-xs font-semibold text-slate-700 flex justify-between items-center">
                        <span>{member.fullName}</span>
                        <div className="flex items-center gap-1.5">
                          {member.isTeamLead && member.leadTeams?.includes(teamName) && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              ⭐ Lead
                            </span>
                          )}
                          <button 
                            onClick={() => {
                              const remain = member.teams.filter(t => t !== teamName);
                              performAllocation(member.id, remain);
                            }}
                            className="text-slate-350 hover:text-rose-600 text-[10px] font-bold"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    {members.length === 0 && (
                      <div className="h-full flex items-center justify-center text-slate-400 text-[10px] font-bold py-6">
                        Drag members here
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Team Lead Management Modal */}
      <Modal isOpen={isTeamLeadOpen} onClose={() => setIsTeamLeadOpen(false)} title="Manage Team Leads">
        <div className="space-y-4">
          {leadSuccess && (
            <div className="p-3 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />{leadSuccess}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Select Employee</label>
            <select
              value={leadEmployeeId}
              onChange={e => {
                setLeadEmployeeId(e.target.value);
                const emp = employees.find(em => em.id === e.target.value);
                setLeadTeamSelections(emp?.leadTeams || []);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:border-orange-500 outline-none text-slate-900"
            >
              <option value="">— Select employee —</option>
              {employees.filter(e => e.role === 'employee').map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} {emp.isTeamLead ? '⭐ (Lead)' : ''} — {emp.teams.join(', ')}
                </option>
              ))}
            </select>
          </div>

          {leadEmployeeId && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-550 uppercase tracking-wider">Assign as Lead of Teams</label>
              <div className="space-y-2 mt-1">
                {teams.map(t => (
                  <label key={t} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={leadTeamSelections.includes(t)}
                      onChange={() => handleLeadToggle(t)}
                      className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{t}</span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Deselecting all teams removes the Team Lead designation.</p>
            </div>
          )}

          {/* Current Team Leads List */}
          <div className="border-t border-slate-200 pt-4 space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Team Leads</p>
            {employees.filter(e => e.isTeamLead && (e.leadTeams?.length ?? 0) > 0).map(emp => (
              <div key={emp.id} className="flex items-center justify-between text-xs bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                <span className="font-semibold text-slate-800">⭐ {emp.fullName}</span>
                <span className="text-purple-700 font-semibold">{emp.leadTeams?.join(', ')}</span>
              </div>
            ))}
            {employees.filter(e => e.isTeamLead && (e.leadTeams?.length ?? 0) > 0).length === 0 && (
              <p className="text-xs text-slate-400 italic">No team leads assigned yet.</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button onClick={() => setIsTeamLeadOpen(false)} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all">Cancel</button>
            <button onClick={handleSaveTeamLead} disabled={!leadEmployeeId} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm active:scale-97 transition-all shadow-sm">Save Changes</button>
          </div>
        </div>
      </Modal>

      {/* Multi-Team Confirmation Prompt Dialog */}
      <Modal isOpen={isPromptOpen} onClose={() => setIsPromptOpen(false)} title="Conflict Checklist: Multi-Team Assignment">
        <div className="space-y-4">
          <div className="flex gap-3 bg-amber-50 border border-amber-100 p-4 rounded-lg text-amber-900 text-xs font-semibold leading-relaxed">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="font-bold text-sm text-amber-950 mb-1">Employee is already assigned to other teams</p>
              <p className="font-medium text-amber-800">
                <strong>{draggedEmployee?.fullName}</strong> is currently assigned to: <strong>{draggedEmployee?.teams.join(', ')}</strong>.
              </p>
            </div>
          </div>
          
          <p className="text-xs text-slate-600 leading-relaxed font-semibold">
            Would you like to assign them to <strong>{targetTeam}</strong> as an additional department, or reassign them to <strong>{targetTeam}</strong> exclusively?
          </p>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-200">
            <button 
              onClick={() => setIsPromptOpen(false)}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-750 font-semibold px-4 py-2 rounded-lg text-xs active:scale-97 transition-all order-3 sm:order-1"
            >
              Cancel Drop
            </button>
            <button 
              onClick={() => handleConfirmMultiTeam('reassign')}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-lg text-xs active:scale-97 transition-all order-2 sm:order-2"
            >
              Reassign Exclusively
            </button>
            <button 
              onClick={() => handleConfirmMultiTeam('both')}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg text-xs active:scale-97 transition-all shadow-sm order-1 sm:order-3"
            >
              Add to Both Teams
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
