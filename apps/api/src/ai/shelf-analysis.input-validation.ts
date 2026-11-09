import { AnalyzeShelfInput } from './ai-provider.types';

const MAX_IMAGES = 8;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeCanonicalBase64(value: unknown): Buffer {
  if (typeof value !== 'string' || value.length === 0 || value.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('Each image must contain canonical base64 data');
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length === 0 || decoded.toString('base64') !== value) {
    throw new Error('Each image must contain canonical base64 data');
  }
  return decoded;
}

function matchesSignature(mimeType: string, bytes: Buffer): boolean {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  if (mimeType === 'image/webp') {
    return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

export function validateAnalyzeShelfInput(value: unknown): AnalyzeShelfInput {
  if (!isRecord(value) || typeof value.captureSessionId !== 'string' ||
      value.captureSessionId.trim().length === 0 || value.captureSessionId.length > 128 ||
      !Array.isArray(value.images) || value.images.length < 1 || value.images.length > MAX_IMAGES) {
    throw new Error(`A shelf analysis requires a session ID and 1-${MAX_IMAGES} images`);
  }

  const seenIds = new Set<string>();
  let totalBytes = 0;
  const images = value.images.map((raw, index) => {
    if (!isRecord(raw) || typeof raw.imageId !== 'string' || raw.imageId.trim().length === 0 ||
        raw.imageId.length > 128 || seenIds.has(raw.imageId)) {
      throw new Error(`Image ${index + 1} must have a unique non-empty imageId of at most 128 characters`);
    }
    seenIds.add(raw.imageId);
    if (typeof raw.mimeType !== 'string' || !MIME_TYPES.has(raw.mimeType)) {
      throw new Error(`Image ${index + 1} has an unsupported MIME type`);
    }
    const bytes = decodeCanonicalBase64(raw.dataBase64);
    if (!matchesSignature(raw.mimeType, bytes)) {
      throw new Error(`Image ${index + 1} content does not match its declared MIME type`);
    }
    totalBytes += bytes.length;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error('Combined shelf images exceed the 20 MiB request limit');
    return {
      imageId: raw.imageId,
      mimeType: raw.mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
      dataBase64: raw.dataBase64 as string,
    };
  });

  let storeCatalogHints: AnalyzeShelfInput['storeCatalogHints'];
  if (value.storeCatalogHints !== undefined) {
    if (!Array.isArray(value.storeCatalogHints) || value.storeCatalogHints.length > 200) {
      throw new Error('storeCatalogHints must contain at most 200 entries');
    }
    storeCatalogHints = value.storeCatalogHints.map((raw, index) => {
      if (!isRecord(raw) || typeof raw.productId !== 'string' || !raw.productId ||
          raw.productId.length > 128 || typeof raw.displayName !== 'string' ||
          !raw.displayName.trim() || raw.displayName.length > 200 ||
          (raw.brand !== undefined && (typeof raw.brand !== 'string' || raw.brand.length > 120)) ||
          (raw.barcode !== undefined && (typeof raw.barcode !== 'string' || raw.barcode.length > 64))) {
        throw new Error(`Catalog hint ${index + 1} contains invalid fields`);
      }
      return {
        productId: raw.productId,
        displayName: raw.displayName,
        ...(raw.brand !== undefined ? { brand: raw.brand as string } : {}),
        ...(raw.barcode !== undefined ? { barcode: raw.barcode as string } : {}),
      };
    });
  }

  return {
    captureSessionId: value.captureSessionId,
    images,
    ...(storeCatalogHints !== undefined ? { storeCatalogHints } : {}),
  };
}
