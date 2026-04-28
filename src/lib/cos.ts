export async function uploadToCOS(file: File, key: string): Promise<void> {
  const res = await fetch("/api/cos-proxy-upload", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-COS-Key": key,
    },
    body: file,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      detail = JSON.stringify(data);
    } catch {
      detail = await res.text().catch(() => detail);
    }
    throw new Error(detail);
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
