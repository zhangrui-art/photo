import imageCompression from "browser-image-compression";

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const options = {
    maxSizeMB: 0.15,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: "image/jpeg" as const,
  };

  const compressed = await imageCompression(file, options);
  return new File([compressed], file.name, { type: compressed.type });
}
