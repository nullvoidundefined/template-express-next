import { hashToken } from 'app/services/hashService.js';
import { describe, expect, it } from 'vitest';

describe('hashToken', () => {
  it('returns the SHA-256 hex digest of the input', () => {
    // Well-known SHA-256("abc"). Asserting a concrete value pins the algorithm
    // and encoding so a session token hashed here matches one hashed elsewhere.
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('is deterministic for the same input', () => {
    expect(hashToken('session-token')).toBe(hashToken('session-token'));
  });

  it('produces different digests for different inputs', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });
});
