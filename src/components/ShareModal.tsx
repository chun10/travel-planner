"use client";

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Pencil, Eye } from 'lucide-react';

interface ShareModalProps {
  tripId: string | null;
  tripName: string;
  onClose: () => void;
}

export default function ShareModal({ tripId, tripName, onClose }: ShareModalProps) {
  const [copiedView, setCopiedView] = useState(false);
  const [copiedEdit, setCopiedEdit] = useState(false);
  const [editToken, setEditToken] = useState<string>('');

  // Generate edit token on mount (simple random string)
  useEffect(() => {
    if (tripId) {
      // Generate a simple token based on tripId + random
      const token = btoa(tripId + '-' + Date.now()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
      setEditToken(token);
    }
  }, [tripId]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  
  const viewLink = tripId ? `${origin}?trip=${tripId}` : '';
  const editLink = tripId && editToken ? `${origin}?trip=${tripId}&edit=${editToken}` : '';

  const handleCopy = (link: string, setCopied: (v: boolean) => void) => {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[400px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-lg text-slate-800">分享行程</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* View Only Link */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Eye size={14} className="text-slate-400" />
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">僅檢視連結</label>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">給家人朋友</span>
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={viewLink || '行程同步中，請稍後再試...'}
                className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-600 truncate"
              />
              <button
                onClick={() => handleCopy(viewLink, setCopiedView)}
                className={`shrink-0 px-3 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${
                  copiedView
                    ? 'bg-green-50 text-green-600 border border-green-200'
                    : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                {copiedView ? <Check size={14} /> : <Copy size={14} />}
                {copiedView ? '已複製' : '複製'}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">任何人可查看，但無法編輯</p>
          </div>

          {/* Edit Link */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Pencil size={14} className="text-blue-500" />
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">可編輯連結</label>
              <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">自己用</span>
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={editLink || '產生中...'}
                className="flex-1 text-xs bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-blue-700 truncate"
              />
              <button
                onClick={() => handleCopy(editLink, setCopiedEdit)}
                disabled={!editLink}
                className={`shrink-0 px-3 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${
                  copiedEdit
                    ? 'bg-green-50 text-green-600 border border-green-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copiedEdit ? <Check size={14} /> : <Copy size={14} />}
                {copiedEdit ? '已複製' : '複製'}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">打開連結即可編輯，請妥善保管</p>
          </div>
        </div>
      </div>
    </div>
  );
}
