export async function uploadToCOS(file: File, key: string): Promise<void> {
  const res = await fetch("/api/cos-upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  if (!res.ok) {
    throw new Error("获取上传地址失败");
  }
  const { uploadUrl } = await res.json();

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
  });
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => "");
    throw new Error("COS上传失败: " + (text || putRes.status));
  }
}

export async function getSignedUrls(
  keys: string[]
): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  const res = await fetch("/api/cos-sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys }),
  });
  if (!res.ok) throw new Error("Failed to get signed URLs");
  const data = await res.json();
  return data.urls;
}

export async function deleteFromCOS(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await fetch("/api/cos-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys }),
  });
}
