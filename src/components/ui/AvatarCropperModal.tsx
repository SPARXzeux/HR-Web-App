'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { compressImageToWebP, MAX_PROFILE_PICTURE_BYTES } from '@/lib/imageCompressor';
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Check, X } from 'lucide-react';

interface AvatarCropperModalProps {
  file: File | null;
  onClose: () => void;
  onSave: (webpDataUrl: string) => void;
}

// Fixed square preview size (css px). Every user gets the same circular
// crop frame regardless of the source image's aspect ratio (fixes vertical
// photos rendering as tall ovals instead of a proper circle).
const PREVIEW_SIZE = 260;
const OUTPUT_SIZE = 512;

export function AvatarCropperModal({ file, onClose, onSave }: AvatarCropperModalProps) {
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const dragState = useRef<{ dragging: boolean; startX: number; startY: number; panX: number; panY: number }>({
    dragging: false, startX: 0, startY: 0, panX: 0, panY: 0,
  });

  useEffect(() => {
    if (!file) { setImgEl(null); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setImgEl(img);
    img.src = url;
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = imgEl ? Math.max(PREVIEW_SIZE / imgEl.naturalWidth, PREVIEW_SIZE / imgEl.naturalHeight) : 1;
  const totalScale = baseScale * zoom;

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current.dragging) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setPan({ x: dragState.current.panX + dx, y: dragState.current.panY + dy });
  };
  const handlePointerUp = () => { dragState.current.dragging = false; };

  const handleSave = useCallback(async () => {
    if (!imgEl) return;
    setSaving(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) { setSaving(false); return; }

      ctx.save();
      // Circular clip so the baked-in image itself is a perfect circle,
      // consistent everywhere it's rendered (tables, cards, thumbnails),
      // not just where CSS happens to round it.
      ctx.beginPath();
      ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      const scaleRatio = OUTPUT_SIZE / PREVIEW_SIZE;
      ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
      ctx.translate(pan.x * scaleRatio, pan.y * scaleRatio);
      ctx.rotate((rotation * Math.PI) / 180);
      const s = totalScale * scaleRatio;
      ctx.scale(s, s);
      ctx.drawImage(imgEl, -imgEl.naturalWidth / 2, -imgEl.naturalHeight / 2);
      ctx.restore();

      const rawDataUrl = canvas.toDataURL('image/webp', 0.92);
      const finalDataUrl = await compressImageToWebP(rawDataUrl, 0.9, MAX_PROFILE_PICTURE_BYTES);
      onSave(finalDataUrl);
    } finally {
      setSaving(false);
    }
  }, [imgEl, pan, rotation, totalScale, onSave]);

  return (
    <Modal isOpen={!!file} onClose={onClose} title="Adjust Profile Picture">
      {imgEl && (
        <div className="space-y-5">
          <div
            className="relative mx-auto rounded-full overflow-hidden border-2 border-slate-200 bg-slate-900 cursor-grab active:cursor-grabbing touch-none select-none"
            style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <img
              src={imgEl.src}
              alt="Crop preview"
              draggable={false}
              className="absolute top-1/2 left-1/2 max-w-none pointer-events-none"
              style={{
                width: imgEl.naturalWidth,
                height: imgEl.naturalHeight,
                transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${totalScale})`,
                transformOrigin: 'center center',
              }}
            />
            {/* Circular frame overlay guide */}
            <div className="absolute inset-0 rounded-full ring-2 ring-inset ring-white/70 pointer-events-none" />
          </div>
          <p className="text-center text-[10px] text-slate-400 font-semibold">Drag to reposition · use the controls below to zoom or rotate</p>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <ZoomOut className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                className="w-full accent-orange-600"
              />
              <ZoomIn className="h-4 w-4 text-slate-400 shrink-0" />
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setRotation(r => r - 90)}
                className="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg transition-all active:scale-97"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Rotate Left
              </button>
              <button
                type="button"
                onClick={() => setRotation(r => r + 90)}
                className="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg transition-all active:scale-97"
              >
                <RotateCw className="h-3.5 w-3.5" /> Rotate Right
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs active:scale-97 transition-all"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-xs active:scale-97 transition-all"
            >
              <Check className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save Photo'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
