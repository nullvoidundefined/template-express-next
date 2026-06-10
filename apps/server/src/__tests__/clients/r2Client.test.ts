import { assertValidKey } from 'app/clients/r2Client.js';
import { describe, expect, it } from 'vitest';

describe('r2', () => {
  describe('assertValidKey', () => {
    it('accepts valid keys', () => {
      expect(() => assertValidKey('users/abc/avatar.png')).not.toThrow();
      expect(() => assertValidKey('uploads/2026/file.pdf')).not.toThrow();
    });

    it('rejects keys with path traversal', () => {
      expect(() => assertValidKey('../etc/passwd')).toThrow('Invalid R2 key');
      expect(() => assertValidKey('users/../admin')).toThrow('Invalid R2 key');
    });

    it('rejects keys with invalid characters', () => {
      expect(() => assertValidKey('file name.txt')).toThrow('Invalid R2 key');
      expect(() => assertValidKey('file;rm -rf')).toThrow('Invalid R2 key');
    });
  });
});
