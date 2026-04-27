"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Memo {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

const COLORS = [
  "from-indigo-50 to-blue-50 border-indigo-100",
  "from-emerald-50 to-teal-50 border-emerald-100",
  "from-amber-50 to-orange-50 border-amber-100",
  "from-pink-50 to-rose-50 border-pink-100",
  "from-violet-50 to-purple-50 border-violet-100",
  "from-cyan-50 to-sky-50 border-cyan-100",
];

export default function MemosPage() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const loadMemos = useCallback(async () => {
    const { data } = await supabase
      .from("memos")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setMemos(data);
  }, []);

  useEffect(() => {
    loadMemos();
  }, [loadMemos]);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await supabase
          .from("memos")
          .update({ title: title.trim(), description: description.trim() })
          .eq("id", editingId);
      } else {
        await supabase
          .from("memos")
          .insert({ title: title.trim(), description: description.trim() });
      }
      resetForm();
      await loadMemos();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(memo: Memo) {
    setEditingId(memo.id);
    setTitle(memo.title);
    setDescription(memo.description);
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setTitle("");
    setDescription("");
  }

  async function deleteMemo(id: string) {
    if (!confirm("确定删除这条备忘录吗？")) return;
    await supabase.from("memos").delete().eq("id", id);
    await loadMemos();
  }

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">备忘录</h1>
          <p className="text-muted mt-1">记录你的想法和灵感</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          新建备忘
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-border p-6 mb-8 fade-in">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            {editingId ? "编辑备忘" : "新建备忘"}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">标题 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="你在想什么？"
                className="w-full px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="在这里写下详细内容..."
                rows={5}
                className="w-full px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
              >
                {saving ? "保存中..." : editingId ? "更新" : "保存"}
              </button>
              <button
                onClick={resetForm}
                className="px-6 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {memos.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-16 h-16 text-slate-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <p className="text-slate-400 text-lg">还没有备忘录</p>
          <p className="text-sm text-muted mt-1">点击新建备忘开始记录</p>
        </div>
      ) : (
        <div className="masonry-grid">
          {memos.map((memo, i) => (
            <div
              key={memo.id}
              className={`bg-gradient-to-br ${COLORS[i % COLORS.length]} rounded-2xl border p-5 card-hover`}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-slate-800 flex-1 mr-2">{memo.title}</h3>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(memo)}
                    className="p-1.5 rounded-lg hover:bg-white/50 text-slate-400 hover:text-slate-600 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteMemo(memo.id)}
                    className="p-1.5 rounded-lg hover:bg-white/50 text-slate-400 hover:text-red-500 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
              {memo.description && (
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{memo.description}</p>
              )}
              <p className="text-xs text-slate-400 mt-3">
                {new Date(memo.created_at).toLocaleDateString("zh-CN", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
