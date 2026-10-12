import { nanoid } from "nanoid";
import { uploadFileAuto } from "@/lib/api/files";
import { resolveApiBaseUrl } from "@/lib/api/client";
import { getQuestNodeAssetUrl } from "@/lib/api/quest-files";

const IMAGE_LIMIT_BYTES = 10 * 1024 * 1024;
const VIDEO_LIMIT_BYTES = 100 * 1024 * 1024;

const IMAGE_MIME_PREFIX = "image/";
const VIDEO_MIME_PREFIX = "video/";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogv",
};

export type AssetKind = "image" | "video";

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
};

// Use resolveApiBaseUrl from @/lib/api/client for consistent API URL resolution
const getApiBaseUrl = resolveApiBaseUrl;

export function resolveNotebookAssetUrl(
  src?: string | null
): string | null | undefined {
  if (!src) return src;
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return src;
  if (src.startsWith("//")) return src;
  const base = src.startsWith("/api/") ? `${getApiBaseUrl()}${src}` : src;
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("ds_access_token")
      : null;
  if (!token) return base;
  if (base.includes("token=")) return base;
  const join = base.includes("?") ? "&" : "?";
  return `${base}${join}token=${encodeURIComponent(token)}`;
}

function resolveExtension(file: File): string {
  const fromMime = EXTENSION_BY_MIME[file.type];
  if (fromMime) return fromMime;
  const parts = file.name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "bin";
}

function resolveMimeType(file: File, ext: string): string {
  if (file.type) return file.type;
  return MIME_BY_EXTENSION[ext] || "application/octet-stream";
}

export function isSupportedNotebookAsset(file: File, kind: AssetKind): boolean {
  const ext = resolveExtension(file);
  const mime = resolveMimeType(file, ext).toLowerCase();
  if (kind === "image") {
    return (
      mime.startsWith(IMAGE_MIME_PREFIX) ||
      ["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)
    );
  }
  return (
    mime.startsWith(VIDEO_MIME_PREFIX) || ["mp4", "webm", "ogv"].includes(ext)
  );
}

function createHiddenAssetFile(file: File, kind: AssetKind): File {
  const ext = resolveExtension(file);
  const name = `.novel-${kind}-${nanoid(12)}.${ext}`;
  const mimeType = resolveMimeType(file, ext);
  return new File([file], name, { type: mimeType });
}

function validateAsset(file: File, kind: AssetKind): void {
  const limit = kind === "image" ? IMAGE_LIMIT_BYTES : VIDEO_LIMIT_BYTES;
  if (file.size > limit) {
    const maxMb = kind === "image" ? 10 : 100;
    throw new Error(`${kind === "image" ? "Image" : "Video"} too large (max ${maxMb}MB).`);
  }
  if (!isSupportedNotebookAsset(file, kind)) {
    throw new Error(kind === "image" ? "Unsupported image type." : "Unsupported video type.");
  }
}

export async function uploadNotebookAsset(
  projectId: string,
  file: File,
  kind: AssetKind
): Promise<string> {
  validateAsset(file, kind);
  const hiddenFile = createHiddenAssetFile(file, kind);
  const created = await uploadFileAuto(projectId, hiddenFile, null);
  return String(resolveNotebookAssetUrl(getQuestNodeAssetUrl(created.id)));
}
