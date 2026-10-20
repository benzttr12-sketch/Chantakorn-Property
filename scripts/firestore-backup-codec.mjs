import { Timestamp, GeoPoint, DocumentReference } from '@google-cloud/firestore';

/**
 * Loss-aware Firestore value encoder for an OFFLINE encrypted backup.
 * Encodes special Firestore types explicitly; never silently stringify references
 * or timestamps as plain objects. The format is versioned by backup manifest.
 */
export function encodeFirestoreValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'number') throw new TypeError('Non-finite Firestore number cannot be archived as JSON');
  if (value instanceof Timestamp) {
    return { $fs: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (value instanceof GeoPoint) {
    return { $fs: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof DocumentReference) {
    return { $fs: 'reference', path: value.path };
  }
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new TypeError('Invalid date');
    return { $fs: 'date', iso: value.toISOString() };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { $fs: 'bytes', base64: Buffer.from(value).toString('base64') };
  }
  if (Array.isArray(value)) return { $fs: 'array', values: value.map(encodeFirestoreValue) };
  if (value && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    return { $fs: 'map', entries: Object.entries(value).map(([key, item]) => [key, encodeFirestoreValue(item)]) };
  }
  throw new TypeError(`Unsupported Firestore value type: ${Object.prototype.toString.call(value)}`);
}

export function validateEncryptedBackupManifest(data) {
  if (!data || typeof data !== 'object' || data.version !== 1 ||
      data.encryption !== 'AES-256-GCM' || data.compression !== 'gzip' ||
      !/^[a-f0-9]{64}$/.test(data.sha256 ?? '') ||
      !/^[a-f0-9]{32}$/.test(data.salt ?? '') ||
      !/^[a-f0-9]{24}$/.test(data.iv ?? '') ||
      !/^[a-f0-9]{32}$/.test(data.tag ?? '') ||
      !Number.isSafeInteger(data.records) || data.records < 0 ||
      typeof data.firestoreDatabase !== 'string' || !data.firestoreDatabase) {
    throw new Error('Invalid or incomplete encrypted backup manifest');
  }
  return data;
}
