/**
 * MIME type utilities for attachment handling
 */

const MIME_TYPES: Record<string, string> = {
  // Images
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  // Documents
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Text
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  html: "text/html",
  // Audio/Video
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  // Archives
  zip: "application/zip",
};

/**
 * Guess content type from filename extension
 */
export function guessContentType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  return MIME_TYPES[ext || ""] || "application/octet-stream";
}
