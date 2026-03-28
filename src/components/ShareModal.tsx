"use client";

import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

interface ShareModalProps {
  tripId: string | null;
  tripName: string;
  onClose: () => void;
}

export default function ShareModal({ tripId, tripName, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (!tripId) return;
    const url = `${window.location.origin}?trip=${tripId}`;
    navigator.clipboard.writeText(url).then(() => {
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

        <div className="px-5 py-5 space-y-4">
          <p className="text-sm text-slate-600">
            分享連結給朋友，任何人都可以查看並編輯此行程！
          </p>
          
          {/* Share Link */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">分享連結</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={tripId ? `${typeof window !== 'undefined' ? window.location.origin : ''}?trip=${tripId}` : '行程同步中，請稍後再試...'}
                className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-600 truncate"
              />
              <button
                onClick={handleCopyLink}
                className={`shrink-0 px-3 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${
                  copied
                    ? 'bg-green-50 text-green-600 border border-green-200'
                    : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? '已複製' : '複製'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
