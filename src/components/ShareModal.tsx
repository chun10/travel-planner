"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { X, Copy, Check, UserPlus, Trash2, Mail, Eye, Pencil } from 'lucide-react';

interface Collaborator {
  id: string;
  user_id: string;
  role: 'editor' | 'viewer';
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface ShareModalProps {
  tripId: string | null;
  tripName: string;
  isOwner: boolean;
  onClose: () => void;
}

export default function ShareModal({ tripId, tripName, isOwner, onClose }: ShareModalProps) {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tripId) loadCollaborators();
  }, [tripId]);

  async function loadCollaborators() {
    if (!tripId) return;
    const { data: collabRows } = await supabase
      .from('trip_collaborators')
      .select('*')
      .eq('trip_id', tripId);

    if (!collabRows || collabRows.length === 0) {
      setCollaborators([]);
      return;
    }

    // Fetch profile info for each collaborator
    const userIds = collabRows.map((c: any) => c.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const enriched: Collaborator[] = collabRows.map((row: any) => {
      const profile = profileMap.get(row.user_id);
      return {
        id: row.id,
        user_id: row.user_id,
        role: row.role,
        display_name: profile?.display_name || null,
        email: profile?.email || null,
        avatar_url: profile?.avatar_url || null,
      };
    });

    setCollaborators(enriched);
  }

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripId) { setError('行程尚未同步到雲端，請稍後再試。'); return; }
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Look up user by email
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email.trim())
        .single();

      if (profileError || !profiles) {
        setError('找不到此 Email 的使用者。請確認該使用者已註冊。');
        setLoading(false);
        return;
      }

      if (profiles.id === user?.id) {
        setError('不能將自己加入為協作者。');
        setLoading(false);
        return;
      }

      // Insert collaborator
      const { error: insertError } = await supabase
        .from('trip_collaborators')
        .insert({
          trip_id: tripId,
          user_id: profiles.id,
          role,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          setError('此使用者已是協作者。');
        } else {
          setError(`新增失敗: ${insertError.message}`);
        }
        setLoading(false);
        return;
      }

      setSuccess(`已成功新增 ${profiles.display_name || email} 為 ${role === 'editor' ? '編輯者' : '檢視者'}`);
      setEmail('');
      await loadCollaborators();
    } catch (e) {
      setError('新增協作者時發生錯誤。');
    }
    setLoading(false);
  };

  const handleRemoveCollaborator = async (collabId: string) => {
    await supabase.from('trip_collaborators').delete().eq('id', collabId);
    await loadCollaborators();
  };

  const handleChangeRole = async (collabId: string, newRole: 'editor' | 'viewer') => {
    await supabase
      .from('trip_collaborators')
      .update({ role: newRole })
      .eq('id', collabId);
    await loadCollaborators();
  };

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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[400px] max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-lg text-slate-800">分享行程</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
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

          {/* Add Collaborator Form */}
          {isOwner && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">新增協作者</label>
              <form onSubmit={handleAddCollaborator} className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      placeholder="Email 信箱"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors"
                    />
                  </div>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                    className="shrink-0 px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-slate-50 text-slate-600 font-medium"
                  >
                    <option value="editor">編輯者</option>
                    <option value="viewer">檢視者</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <UserPlus size={16} />
                  {loading ? '處理中...' : '新增協作者'}
                </button>
              </form>
            </div>
          )}

          {/* Messages */}
          {error && (
            <div className="bg-red-50 text-red-600 text-xs font-bold px-4 py-2.5 rounded-xl border border-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 text-green-600 text-xs font-bold px-4 py-2.5 rounded-xl border border-green-200">
              {success}
            </div>
          )}

          {/* Collaborator List */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">
              協作者 ({collaborators.length} 人)
            </label>
            <div className="space-y-2">
              {collaborators.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">目前沒有協作者</p>
              )}
              {collaborators.map((collab) => (
                <div key={collab.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold overflow-hidden shrink-0">
                    {collab.avatar_url ? (
                      <img src={collab.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (collab.display_name || collab.email || '?')[0].toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">
                      {collab.display_name || collab.email || '未知使用者'}
                      {collab.user_id === user?.id && (
                        <span className="text-xs text-slate-400 font-normal ml-1">(你)</span>
                      )}
                    </p>
                    {collab.email && (
                      <p className="text-[10px] text-slate-400 truncate">{collab.email}</p>
                    )}
                  </div>
                  {isOwner && collab.user_id !== user?.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <select
                        value={collab.role}
                        onChange={(e) => handleChangeRole(collab.id, e.target.value as 'editor' | 'viewer')}
                        className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600 font-medium"
                      >
                        <option value="editor">編輯</option>
                        <option value="viewer">檢視</option>
                      </select>
                      <button
                        onClick={() => handleRemoveCollaborator(collab.id)}
                        className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                        title="移除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
