import { BadRequestException } from '@nestjs/common';
import { Express } from 'express';

interface ImageValidationOptions {
  maxSize?: number; // in bytes, default: 5MB
  allowedMimeTypes?: string[];
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MIME_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
};

function normalizeMimeType(mimeType: string | undefined): string {
  if (!mimeType) return '';
  const normalized = mimeType.trim().toLowerCase();
  return MIME_ALIASES[normalized] ?? normalized;
}

function detectMimeTypeFromBuffer(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WEBP: "RIFF"...."WEBP"
  const riff =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46;
  const webp =
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;
  if (riff && webp) {
    return 'image/webp';
  }

  return null;
}

export function validateImageFile(
  file: Express.Multer.File | undefined,
  options: ImageValidationOptions = {},
): void {
  if (!file) {
    throw new BadRequestException('Image file is required');
  }

  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
  const allowedMimeTypes = (
    options.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES
  ).map((mimeType) => normalizeMimeType(mimeType));

  // Check file exists
  if (!file.buffer || file.size === 0) {
    throw new BadRequestException('File buffer is empty');
  }

  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / 1024 / 1024).toFixed(2);
    throw new BadRequestException(
      `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
    );
  }

  const normalizedIncomingMimeType = normalizeMimeType(file.mimetype);
  const detectedMimeType = detectMimeTypeFromBuffer(file.buffer);

  const resolvedMimeType = allowedMimeTypes.includes(normalizedIncomingMimeType)
    ? normalizedIncomingMimeType
    : detectedMimeType && allowedMimeTypes.includes(detectedMimeType)
      ? detectedMimeType
      : null;

  // Check MIME type (accept incoming MIME or sniffed MIME from buffer)
  if (!resolvedMimeType) {
    throw new BadRequestException(
      `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
    );
  }

  // Normalize MIME for downstream consumers (e.g., Cloudinary metadata).
  file.mimetype = resolvedMimeType;

  // Check file extension when filename exists.
  const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
  const fileExtension = file.originalname?.split('.').pop()?.toLowerCase();

  if (fileExtension && !validExtensions.includes(fileExtension)) {
    throw new BadRequestException(
      `Invalid file extension. Allowed extensions: ${validExtensions.join(', ')}`,
    );
  }
}

export function getImageValidationError(error: unknown): string {
  if (error instanceof BadRequestException) {
    return error.message;
  }
  return 'Image upload validation failed';
}
