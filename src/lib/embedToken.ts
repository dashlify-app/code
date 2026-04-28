import crypto from 'node:crypto';

/**
 * Embed token generator + validator.
 *
 * Storage: only the SHA-256 hash is persisted in EmbedToken.tokenHash.
 * Plaintext is shown to the user once at creation time and is embedded
 * (obfuscated) into the downloaded HTML file.
 *
 * Format: 48 hex chars (24 bytes random) → ~192 bits of entropy.
 */

const TOKEN_BYTES = 24; // 48 hex chars
const TOKEN_PREFIX = 'dlf_'; // helps identify tokens in logs/leak detection

export interface GenerateResult {
  /** Plaintext token — show once, never persist. */
  plaintext: string;
  /** SHA-256 hash — store this in DB. */
  hash: string;
}

export function generateToken(): GenerateResult {
  const random = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const plaintext = `${TOKEN_PREFIX}${random}`;
  const hash = hashToken(plaintext);
  return { plaintext, hash };
}

export function hashToken(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

/**
 * Validates the shape of a token before doing any DB work.
 * Cheap rejection for malformed inputs.
 */
export function isWellFormed(token: unknown): token is string {
  return (
    typeof token === 'string' &&
    token.startsWith(TOKEN_PREFIX) &&
    token.length === TOKEN_PREFIX.length + TOKEN_BYTES * 2 &&
    /^[a-z0-9_]+$/.test(token)
  );
}

/**
 * Constant-time comparison helper (for any future direct comparisons).
 * Most consumers will compare hashes directly via DB query, but this
 * exists for any client-side or server-side equality checks needed.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
