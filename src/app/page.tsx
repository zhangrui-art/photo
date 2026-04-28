"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getSignedUrls } from "@/lib/cos";

export default function Home() {
  const [photoCount, setPhotoCount] = useState(0);
  const [memoCount, setMemoCount] = useState(0);
  const [recentPhotos, setRecentPhotos] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      const [{ count: pc }, { count: mc }, { data: photos }] = await Promise.all([
        supabase.from("photos").select("*", { count: "exact", head: true }),
        supabase.from("memos").select("*", { count: "exact", head: true }),
        supabase.from("photos").select("cos_key").order("created_at", { ascending: false }).limit(6),
      ]);
      setPhotoCount(pc ?? 0);
      setMemoCount(mc ?? 0);

      const keys = photos?.map((p) => p.cos_key).filter(Boolean) ?? [];
      if (keys.length > 0) {
        const urls = await getSignedUrls(keys);
        setRecentPhotos(keys.map((k) => urls[k]).filter(Boolean));
      }
    }
    load();
  }, []);

  return (
    <div className="fade-in">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-800">欢迎回来</h1>
        <p className="text-muted mt-2">这是你的空间总览</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
        <Link href="/photos" className="card-hover block bg-white rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-muted">照片</p>
              <p className="text-2xl font-bold text-slate-800">{photoCount}</p>
            </div>
          </div>
        </Link>

        <Link href="/memos" className="card-hover block bg-white rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-muted">备忘录</p>
              <p className="text-2xl font-bold text-slate-800">{memoCount}</p>
            </div>
          </div>
        </Link>
      </div>

      {recentPhotos.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">最近上传</h2>
            <Link href="/photos" className="text-sm text-indigo-500 hover:text-indigo-600 font-medium">
              查看全部 &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {recentPhotos.map((url, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden bg-slate-100">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
