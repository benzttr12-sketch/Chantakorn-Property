import { createHash, timingSafeEqual } from 'node:crypto';
export function validMediaToken(token: unknown, hash: unknown) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) return false;
  return timingSafeEqual(Buffer.from(createHash('sha256').update(token).digest('hex'), 'hex'), Buffer.from(hash, 'hex'));
}
