export interface AirtableAttachment {
  id?: string;
  url: string;
  filename: string;
  size?: number;
  type?: string;
  width?: number;
  height?: number;
  thumbnails?: {
    small?: AirtableThumbnail;
    large?: AirtableThumbnail;
    full?: AirtableThumbnail;
  };
}

export interface AirtableThumbnail {
  url: string;
  width: number;
  height: number;
}

export interface AttachmentUploadResult {
  url: string;
  filename: string;
  size: number;
  type: string;
}

export function formatForAirtableAttachment(upload: AttachmentUploadResult): AirtableAttachment[] {
  return [{
    url: upload.url,
    filename: upload.filename,
    size: upload.size,
    type: upload.type,
  }];
}