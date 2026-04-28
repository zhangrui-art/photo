"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { uploadToCOS, getSignedUrls, deleteFromCOS } from "@/lib/cos";

interface PhotoGroup {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

interface Photo {
  id: string;
  group_id: string;
  cos_key: string;
  filename: string;
}

export default function PhotosPage() {
  const [groups, setGroups] = useState<PhotoGroup[]>([]);
  const [photos, setPhotos] = useState<Record<string, Photo[]>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [showUpload, setShowUpload] = useState(false);
  const [addToGroupId, setAddToGroupId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState<{ index: number; groupPhotos: Photo[]; groupId: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const loadData = useCallback(async () => {
    const { data: groupData } = await supabase
      .from("photo_groups")
      .select("*")
      .order("created_at", { ascending: false });

    if (groupData) {
      setGroups(groupData);
      if (groupData.length === 0) return;

      const { data: photoData } = await supabase
        .from("photos")
        .select("*")
        .in("group_id", groupData.map((g) => g.id));

      const grouped: Record<string, Photo[]> = {};
      const allKeys: string[] = [];
      photoData?.forEach((p) => {
        if (!grouped[p.group_id]) grouped[p.group_id] = [];
        grouped[p.group_id].push(p);
        if (p.cos_key) allKeys.push(p.cos_key);
      });
      setPhotos(grouped);

      if (allKeys.length > 0) {
        const urls = await getSignedUrls(allKeys);
        setSignedUrls((prev) => ({ ...prev, ...urls }));
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleFiles(newFiles: FileList | File[]) {
    const arr = Array.from(newFiles).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...arr]);
    arr.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (files.length === 0) return;
    if (!addToGroupId && !title.trim()) return;
    setUploading(true);

    try {
      let groupId = addToGroupId;

      if (!groupId) {
        const { data: group } = await supabase
          .from("photo_groups")
          .insert({ title: title.trim(), description: description.trim() })
          .select()
          .single();
        if (!group) throw new Error("Failed to create group");
        groupId = group.id;
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`上传中 ${i + 1}/${files.length}...`);

        const ext = file.name.split(".").pop() || "jpg";
        const cosKey = `photos/${groupId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        await uploadToCOS(file, cosKey);

        const { error: insertErr } = await supabase.from("photos").insert({
          group_id: groupId,
          cos_key: cosKey,
          filename: file.name,
          url: cosKey,
        });
        if (insertErr) throw new Error("保存记录失败: " + insertErr.message);
      }

      resetUploadForm();
      await loadData();
    } catch (err) {
      console.error("Upload failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      alert("上传失败: " + msg);
    } finally {
      setUploading(false);
    }
  }

  function resetUploadForm() {
    setTitle("");
    setDescription("");
    setFiles([]);
    setPreviews([]);
    setShowUpload(false);
    setAddToGroupId(null);
  }

  function startAddToGroup(groupId: string) {
    setAddToGroupId(groupId);
    setShowUpload(true);
    setTitle("");
    setDescription("");
    setFiles([]);
    setPreviews([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deletePhoto(photo: Photo, groupId: string) {
    if (!confirm("确定删除这张照片吗？")) return;
    await deleteFromCOS([photo.cos_key]);
    await supabase.from("photos").delete().eq("id", photo.id);
    await loadData();
    if (lightbox) {
      const remaining = (photos[groupId] || []).filter((p) => p.id !== photo.id);
      if (remaining.length === 0) {
        setLightbox(null);
      } else {
        const newIdx = Math.min(lightbox.index, remaining.length - 1);
        setLightbox({ index: newIdx, groupPhotos: remaining, groupId });
      }
    }
  }

  async function downloadPhoto(cosKey: string, filename: string) {
    const url = signedUrls[cosKey];
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename || "photo.jpg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    }
  }

  function lightboxNav(dir: number) {
    if (!lightbox) return;
    const newIdx = lightbox.index + dir;
    if (newIdx < 0 || newIdx >= lightbox.groupPhotos.length) return;
    setLightbox({ ...lightbox, index: newIdx });
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      lightboxNav(diff > 0 ? 1 : -1);
    }
  }

  async function deleteGroup(groupId: string) {
    if (!confirm("确定删除这个相册和所有照片吗？")) return;

    const groupPhotos = photos[groupId] || [];
    const keys = groupPhotos.map((p) => p.cos_key).filter(Boolean);
    await deleteFromCOS(keys);
    await supabase.from("photos").delete().eq("group_id", groupId);
    await supabase.from("photo_groups").delete().eq("id", groupId);
    await loadData();
  }

  const currentLightboxPhoto = lightbox ? lightbox.groupPhotos[lightbox.index] : null;
  const currentLightboxUrl = currentLightboxPhoto ? signedUrls[currentLightboxPhoto.cos_key] : null;

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">相册</h1>
          <p className="text-muted mt-1">上传和管理你的照片</p>
        </div>
        <button
          onClick={() => { if (showUpload) { resetUploadForm(); } else { setAddToGroupId(null); setShowUpload(true); } }}
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          上传
        </button>
      </div>

      {showUpload && (
        <div className="bg-white rounded-2xl border border-border p-6 mb-8 fade-in">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            {addToGroupId
              ? `添加照片到「${groups.find((g) => g.id === addToGroupId)?.title}」`
              : "新建相册"}
          </h2>

          {!addToGroupId && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">标题 *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="相册标题"
                  className="w-full px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">描述</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="可选描述"
                  className="w-full px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
          )}

          <div
            className={`upload-zone rounded-xl p-8 text-center cursor-pointer mb-4 ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-slate-500 font-medium">点击或拖拽照片到这里</p>
            <p className="text-sm text-muted mt-1">支持批量上传，仅限图片</p>
          </div>

          {previews.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-slate-700 mb-2">已选择 {files.length} 张照片</p>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              disabled={uploading || files.length === 0 || (!addToGroupId && !title.trim())}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
            >
              {uploading ? uploadProgress || "上传中..." : `上传 ${files.length} 张照片`}
            </button>
            <button
              onClick={resetUploadForm}
              className="px-6 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-16 h-16 text-slate-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
          </svg>
          <p className="text-slate-400 text-lg">还没有相册</p>
          <p className="text-sm text-muted mt-1">点击上传添加你的第一个相册</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.id} className="bg-white rounded-2xl border border-border p-6 card-hover">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{group.title}</h3>
                  {group.description && (
                    <p className="text-sm text-muted mt-0.5">{group.description}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(group.created_at).toLocaleDateString("zh-CN")} &middot; {(photos[group.id] || []).length} 张照片
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startAddToGroup(group.id)}
                    className="text-slate-400 hover:text-indigo-500 transition-colors p-1"
                    title="添加照片"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteGroup(group.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    title="删除相册"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {(photos[group.id] || []).map((photo, idx) => (
                  <div
                    key={photo.id}
                    className="aspect-square rounded-lg overflow-hidden bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setLightbox({ index: idx, groupPhotos: photos[group.id], groupId: group.id })}
                  >
                    {signedUrls[photo.cos_key] ? (
                      <img src={signedUrls[photo.cos_key]} alt={photo.filename} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && currentLightboxPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex flex-col"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <span className="text-white/70 text-sm">
              {lightbox.index + 1} / {lightbox.groupPhotos.length}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => downloadPhoto(currentLightboxPhoto.cos_key, currentLightboxPhoto.filename)}
                className="text-white/70 hover:text-white p-2"
                title="下载"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </button>
              <button
                onClick={() => deletePhoto(currentLightboxPhoto, lightbox.groupId)}
                className="text-white/70 hover:text-red-400 p-2"
                title="删除"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
              <button
                onClick={() => setLightbox(null)}
                className="text-white/70 hover:text-white p-2"
                title="关闭"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center relative px-4 min-h-0">
            {lightbox.index > 0 && (
              <button
                className="hidden md:block absolute left-2 text-white/60 hover:text-white text-4xl z-10"
                onClick={() => lightboxNav(-1)}
              >
                &#8249;
              </button>
            )}
            {currentLightboxUrl ? (
              <img
                src={currentLightboxUrl}
                alt=""
                className="max-w-full max-h-full object-contain rounded-lg select-none"
                draggable={false}
              />
            ) : (
              <div className="text-white/50">加载中...</div>
            )}
            {lightbox.index < lightbox.groupPhotos.length - 1 && (
              <button
                className="hidden md:block absolute right-2 text-white/60 hover:text-white text-4xl z-10"
                onClick={() => lightboxNav(1)}
              >
                &#8250;
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
