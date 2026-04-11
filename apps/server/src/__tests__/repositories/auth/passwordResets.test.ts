import { query } from 'app/db/pool/pool.js';
import {
  createPasswordResetToken,
  findPasswordResetByToken,
  markPasswordResetUsed,
  updateUserPassword,
} from 'app/repositories/auth/auth.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/db/pool/pool.js', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(() => Promise.resolve('hashed')),
    compare: vi.fn(),
  },
}));

describe('createPasswordResetToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a row and returns a 64-char hex token', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    const token = await createPasswordResetToken('user-uuid');
    expect(token).toHaveLength(64);
    expect(vi.mocked(query)).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO password_resets'),
      expect.arrayContaining(['user-uuid']),
    );
  });
});

describe('findPasswordResetByToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when no row found', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const result = await findPasswordResetByToken('sometoken');
    expect(result).toBeNull();
  });

  it('returns the row when found', async () => {
    const mockRow = {
      expires_at: new Date(Date.now() + 3600_000),
      id: 'reset-id',
      used_at: null,
      user_id: 'user-uuid',
    };
    vi.mocked(query).mockResolvedValueOnce({
      rows: [mockRow],
      rowCount: 1,
    } as never);
    const result = await findPasswordResetByToken('sometoken');
    expect(result).toEqual(mockRow);
  });
});

describe('markPasswordResetUsed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls UPDATE with the correct id', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await markPasswordResetUsed('reset-id');
    expect(vi.mocked(query)).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE password_resets'),
      ['reset-id'],
    );
  });
});

describe('updateUserPassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls UPDATE users with user id', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await updateUserPassword('user-uuid', 'newpassword123');
    expect(vi.mocked(query)).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users'),
      expect.arrayContaining(['user-uuid']),
    );
  });
});
