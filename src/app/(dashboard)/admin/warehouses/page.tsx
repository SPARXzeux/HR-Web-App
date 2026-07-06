'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { db } from '@/lib/db';
import { MapPin, Edit, Trash, CheckCircle2 } from 'lucide-react';

export default function AdminWarehousesPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [whName, setWhName] = useState('');
  const [whLat, setWhLat] = useState('');
  const [whLon, setWhLon] = useState('');
  const [whRadius, setWhRadius] = useState('500');
  const [whSuccess, setWhSuccess] = useState('');

  // Editing state
  const [editingWhId, setEditingWhId] = useState<string | null>(null);
  const [editingWhName, setEditingWhName] = useState('');
  const [editingWhLat, setEditingWhLat] = useState('');
  const [editingWhLon, setEditingWhLon] = useState('');
  const [editingWhRadius, setEditingWhRadius] = useState('500');

  useEffect(() => {
    setWarehouses(db.getWarehouses());
  }, []);

  const handleCreateWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName.trim() || !whLat || !whLon) return;

    db.addWarehouse({
      name: whName.trim(),
      latitude: Number(whLat),
      longitude: Number(whLon),
      radius: Number(whRadius)
    });
    setWarehouses(db.getWarehouses());
    setWhName('');
    setWhLat('');
    setWhLon('');
    setWhRadius('550');
    setWhSuccess('Warehouse created successfully!');
    setTimeout(() => setWhSuccess(''), 1500);
  };

  const handleDeleteWarehouse = (id: string) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this warehouse? Assignments will be updated.');
    if (!confirmDelete) return;

    db.deleteWarehouse(id);
    setWarehouses(db.getWarehouses());
    setWhSuccess('Warehouse deleted successfully.');
    setTimeout(() => setWhSuccess(''), 1500);
  };

  const handleStartEditWarehouse = (wh: any) => {
    setEditingWhId(wh.id);
    setEditingWhName(wh.name);
    setEditingWhLat(wh.latitude.toString());
    setEditingWhLon(wh.longitude.toString());
    setEditingWhRadius(wh.radius.toString());
  };

  const handleUpdateWarehouseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWhId) return;

    db.updateWarehouse(editingWhId, {
      name: editingWhName.trim(),
      latitude: Number(editingWhLat),
      longitude: Number(editingWhLon),
      radius: Number(editingWhRadius)
    });
    setWarehouses(db.getWarehouses());
    setEditingWhId(null);
    setWhSuccess('Warehouse updated successfully.');
    setTimeout(() => setWhSuccess(''), 1500);
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <MapPin className="h-6 w-6 text-orange-655" /> Warehouse Management
        </h1>
        <p className="text-slate-500">Configure global warehouse coordinates and geofence tracking radii for US-based teams.</p>
      </div>

      {whSuccess && (
        <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 font-semibold px-4 py-3 rounded-xl text-xs flex items-center gap-2 animate-fade-in shadow-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {whSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Create Form */}
        <div className="lg:col-span-4">
          <Card className="border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Add Warehouse Location</h3>
            </div>
            <CardContent className="p-6">
              <form onSubmit={handleCreateWarehouse} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Warehouse Name *</label>
                  <input 
                    type="text" 
                    required
                    value={whName}
                    onChange={e => setWhName(e.target.value)}
                    placeholder="e.g. Dallas Distribution Yard"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-3 text-xs focus:border-orange-500 outline-none text-slate-900 font-semibold"
                  />
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Latitude *</label>
                      <input 
                        type="number" 
                        step="0.000001"
                        required
                        value={whLat}
                        onChange={e => setWhLat(e.target.value)}
                        placeholder="e.g. 32.7767"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-3 text-xs focus:border-orange-500 outline-none text-slate-900 font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Longitude *</label>
                      <input 
                        type="number" 
                        step="0.000001"
                        required
                        value={whLon}
                        onChange={e => setWhLon(e.target.value)}
                        placeholder="e.g. -96.7970"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-3 text-xs focus:border-orange-500 outline-none text-slate-900 font-semibold"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Radius (meters) *</label>
                    <input 
                      type="number" 
                      required
                      value={whRadius}
                      onChange={e => setWhRadius(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-3 text-xs focus:border-orange-500 outline-none text-slate-900 font-semibold"
                    />
                  </div>
                </div>
                <button 
                  type="submit" 
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm active:scale-97"
                >
                  Create Warehouse
                </button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Warehouses List */}
        <div className="lg:col-span-8">
          <Card className="border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">Active Warehouses ({warehouses.length})</h3>
            </div>
            <CardContent className="p-4 space-y-2.5">
              {warehouses.map(wh => (
                <div key={wh.id} className="p-4 rounded-xl border border-slate-150 bg-slate-50/50 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-450" /> {wh.name}
                    </div>
                    <div className="text-[10px] text-slate-455 font-bold uppercase tracking-wider mt-1">
                      Coords: <span className="font-mono text-slate-600">{wh.latitude}, {wh.longitude}</span> · Radius: <span className="text-orange-655 font-mono">{wh.radius}m</span>
                    </div>
                  </div>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => handleStartEditWarehouse(wh)}
                      className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-all active:scale-95"
                      title="Edit Warehouse"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteWarehouse(wh.id)}
                      className="p-2 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all active:scale-95"
                      title="Delete Warehouse"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {warehouses.length === 0 && (
                <div className="text-center py-10 text-slate-400 font-semibold italic text-xs">
                  No warehouses configured yet. Add one to start tracking geofenced clock-ins.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {editingWhId && (
        <Modal isOpen onClose={() => setEditingWhId(null)} title="Edit Warehouse Details">
          <form onSubmit={handleUpdateWarehouseSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Warehouse Name *</label>
              <input 
                type="text" 
                required
                value={editingWhName}
                onChange={e => setEditingWhName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs outline-none focus:border-orange-500 font-semibold"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Latitude *</label>
                <input 
                  type="number" 
                  step="0.000001"
                  required
                  value={editingWhLat}
                  onChange={e => setEditingWhLat(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs outline-none focus:border-orange-500 font-semibold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Longitude *</label>
                <input 
                  type="number" 
                  step="0.000001"
                  required
                  value={editingWhLon}
                  onChange={e => setEditingWhLon(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs outline-none focus:border-orange-500 font-semibold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Radius (m) *</label>
                <input 
                  type="number" 
                  required
                  value={editingWhRadius}
                  onChange={e => setEditingWhRadius(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs outline-none focus:border-orange-500 font-semibold"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setEditingWhId(null)} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl text-xs active:scale-97 transition-all">Cancel</button>
              <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs active:scale-97 transition-all shadow-sm">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
