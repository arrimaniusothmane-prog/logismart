import { randomBytes, randomUUID, createHash } from 'node:crypto';

/**
 * Identifiants publics.
 * - tracking : format lisible par un humain, difficile à deviner.
 * - token    : 256 bits d'entropie (opaque, utilisé pour le lien public).
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans O/0/I/1 ambigus

export function generateTrackingNumber(prefix = 'LS'): string {
  const bytes = randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i += 1) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return `${prefix}-${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 10)}`;
}

/** Jeton opaque public (tracking, widget…). 32 bytes → 256 bits. */
export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Identifiant public court d'entreprise (widget chatbot). */
export function generatePublicId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
