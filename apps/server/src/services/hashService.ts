import crypto from 'node:crypto';

// One-way hash for session and reset tokens. SHA-256 is appropriate here (not
// bcrypt) because the tokens are high-entropy random values, not user passwords,
// so there is nothing to brute-force. The cookie holds the raw token; the DB
// holds only this hash, so a database dump never exposes live sessions.
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export { hashToken };
