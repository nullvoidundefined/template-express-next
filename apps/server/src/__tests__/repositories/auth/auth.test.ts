import { mockResult } from 'app/__tests__/helpers/mockResult.js';
import { uuid } from 'app/__tests__/helpers/uuids.js';
import type { PoolClient } from 'app/db/pool/pool.js';
import { query, withTransaction } from 'app/db/pool/pool.js';
import * as authRepo from 'app/repositories/auth/auth.js';
import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockClient = {} as unknown as PoolClient;

vi.mock('app/db/pool/pool.js', () => {
  const queryFn = vi.fn();
  return {
    query: queryFn,
    withTransaction: vi.fn((fn: (client: PoolClient) => Promise<unknown>) =>
      fn(mockClient),
    ),
  };
});

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(() => Promise.resolve('hashed')),
    compare: vi.fn((plain: string, hash: string) =>
      Promise.resolve(hash === 'hashed' && plain.length > 0),
    ),
  },
}));

const mockQuery = vi.mocked(query);

describe('auth repository', () => {
  const id = uuid();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createUser inserts and returns user', async () => {
    const row = {
      id,
      email: 'u@example.com',
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockQuery.mockResolvedValueOnce(mockResult([row]));

    const result = await authRepo.createUser('u@example.com', 'password123');

    expect(result).toEqual(row);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      ['u@example.com', 'hashed'],
      undefined,
    );
  });

  it('createUser throws when insert returns no row', async () => {
    mockQuery.mockResolvedValueOnce(mockResult([], 0));
    await expect(authRepo.createUser('u@example.com', 'pwd')).rejects.toThrow(
      'Insert returned no row',
    );
  });

  it('findUserByEmail returns user when found', async () => {
    const row = {
      id,
      email: 'u@example.com',
      password_hash: 'hashed',
      created_at: new Date(),
      updated_at: null,
    };
    mockQuery.mockResolvedValueOnce(mockResult([row]));

    const result = await authRepo.findUserByEmail('u@example.com');

    expect(result).toEqual(row);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [
      'u@example.com',
    ]);
  });

  it('findUserByEmail returns null when not found', async () => {
    mockQuery.mockResolvedValueOnce(mockResult([]));
    const result = await authRepo.findUserByEmail('nobody@example.com');
    expect(result).toBeNull();
  });

  it('findUserById returns user when found', async () => {
    const row = {
      id,
      email: 'u@example.com',
      created_at: new Date(),
      updated_at: null,
    };
    mockQuery.mockResolvedValueOnce(mockResult([row]));
    const result = await authRepo.findUserById(id);
    expect(result).toEqual(row);
  });

  it('findUserById returns null when not found', async () => {
    mockQuery.mockResolvedValueOnce(mockResult([]));
    const result = await authRepo.findUserById(id);
    expect(result).toBeNull();
  });

  it('authenticate returns null when user not found', async () => {
    mockQuery.mockResolvedValueOnce(mockResult([]));
    const result = await authRepo.authenticate('nobody@example.com', 'pwd');
    expect(result).toBeNull();
  });

  it('authenticate returns null when password does not match', async () => {
    const row = {
      id,
      email: 'u@example.com',
      password_hash: 'wrongHash',
      created_at: new Date(),
      updated_at: null,
    };
    mockQuery.mockResolvedValueOnce(mockResult([row]));
    const result = await authRepo.authenticate('u@example.com', 'pwd');
    expect(result).toBeNull();
  });

  it('authenticate returns User without password_hash when credentials valid', async () => {
    const row = {
      id,
      email: 'u@example.com',
      password_hash: 'hashed',
      created_at: new Date(),
      updated_at: null,
    };
    mockQuery.mockResolvedValueOnce(mockResult([row]));
    const result = await authRepo.authenticate('u@example.com', 'correctpwd');
    expect(result).toEqual({
      id,
      email: 'u@example.com',
      created_at: row.created_at,
      updated_at: null,
    });
    expect(result).not.toHaveProperty('password_hash');
  });

  it('verifyPassword returns true when match', async () => {
    const result = await authRepo.verifyPassword('pwd', 'hashed');
    expect(result).toBe(true);
  });

  it('verifyPassword returns false when no match', async () => {
    const result = await authRepo.verifyPassword('pwd', 'other');
    expect(result).toBe(false);
  });

  it('createSession inserts hash of token and returns raw token', async () => {
    mockQuery.mockResolvedValueOnce(mockResult([], 1));
    const result = await authRepo.createSession(id);
    expect(typeof result).toBe('string');
    expect(result).toHaveLength(64);
    const storedHash = crypto
      .createHash('sha256')
      .update(result, 'utf8')
      .digest('hex');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sessions'),
      [storedHash, id, expect.any(Date)],
      undefined,
    );
  });

  it('getSessionWithUser returns user when session valid', async () => {
    const row = {
      id,
      email: 'u@example.com',
      created_at: new Date(),
      updated_at: null,
    };
    mockQuery.mockResolvedValueOnce(mockResult([row]));
    const result = await authRepo.getSessionWithUser('session-id');
    expect(result).toEqual(row);
    const expectedHash = crypto
      .createHash('sha256')
      .update('session-id', 'utf8')
      .digest('hex');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('sessions'),
      [expectedHash],
    );
  });

  it('getSessionWithUser returns null when no row', async () => {
    mockQuery.mockResolvedValueOnce(mockResult([]));
    const result = await authRepo.getSessionWithUser('bad');
    expect(result).toBeNull();
  });

  it('deleteSession returns true when deleted', async () => {
    mockQuery.mockResolvedValueOnce(mockResult([], 1));
    const result = await authRepo.deleteSession('sid');
    expect(result).toBe(true);
    const expectedHash = crypto
      .createHash('sha256')
      .update('sid', 'utf8')
      .digest('hex');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM sessions'),
      [expectedHash],
    );
  });

  it('deleteSession returns false when not found', async () => {
    mockQuery.mockResolvedValueOnce(mockResult([], 0));
    const result = await authRepo.deleteSession('sid');
    expect(result).toBe(false);
  });

  it('deleteSessionsForUser runs delete query', async () => {
    mockQuery.mockResolvedValueOnce(mockResult([], 2));
    await authRepo.deleteSessionsForUser(id);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM sessions'),
      [id],
    );
  });

  it('deleteExpiredSessions returns count of deleted rows', async () => {
    mockQuery.mockResolvedValueOnce(mockResult([], 3));
    const result = await authRepo.deleteExpiredSessions();
    expect(result).toBe(3);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM sessions WHERE expires_at'),
    );
  });

  it('loginUser deletes expired sessions for user then creates new session', async () => {
    mockQuery
      .mockResolvedValueOnce(mockResult([], 0)) // delete expired sessions for user
      .mockResolvedValueOnce(mockResult([], 1)); // insert new session
    const result = await authRepo.loginUser(id);
    expect(typeof result).toBe('string');
    expect(result).toHaveLength(64);
    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('DELETE FROM sessions WHERE user_id'),
      [id],
      mockClient,
    );
  });

  it('createUserAndSession runs user and session inserts in transaction', async () => {
    const userRow = {
      id,
      email: 'u@example.com',
      created_at: new Date(),
      updated_at: null,
    };
    mockQuery
      .mockResolvedValueOnce(mockResult([userRow]))
      .mockResolvedValueOnce(mockResult([], 1));
    const result = await authRepo.createUserAndSession('u@example.com', 'pwd');
    expect(result.user).toEqual(userRow);
    expect(typeof result.sessionId).toBe('string');
    expect(result.sessionId).toHaveLength(64);
    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO users'),
      ['u@example.com', 'hashed'],
      mockClient,
    );
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO sessions'),
      [expect.any(String), id, expect.any(Date)],
      mockClient,
    );
  });
});

describe('createPasswordReset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a password_reset row and returns void', async () => {
    mockQuery.mockResolvedValueOnce(mockResult([], 1));
    await expect(
      authRepo.createPasswordReset('user-id', 'hashed-token', new Date()),
    ).resolves.toBeUndefined();
  });
});

describe('updateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates passwordHash and returns updated user', async () => {
    const updated: {
      id: string;
      email: string;
      created_at: Date;
      updated_at: Date;
    } = {
      id: uuid(),
      email: 'a@b.com',
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockQuery.mockResolvedValueOnce(mockResult([updated]));
    const result = await authRepo.updateUser(updated.id, {
      passwordHash: 'new-hash',
    });
    expect(result).toEqual(updated);
  });

  it('throws if no row returned', async () => {
    mockQuery.mockResolvedValueOnce(mockResult([], 0));
    await expect(
      authRepo.updateUser('id', { passwordHash: 'h' }),
    ).rejects.toThrow();
  });
});

describe('consumePasswordReset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(withTransaction).mockImplementation((fn) => fn(mockClient));
  });

  it('returns null when token not found', async () => {
    mockQuery.mockResolvedValueOnce(mockResult([]));
    const result = await authRepo.consumePasswordReset(
      'not-a-token',
      'new-hash',
    );
    expect(result).toBeNull();
  });

  it('returns null when token already used', async () => {
    const row = {
      id: uuid(),
      user_id: uuid(),
      expires_at: new Date(Date.now() + 60_000),
      used_at: new Date(),
    };
    mockQuery.mockResolvedValueOnce(mockResult([row]));
    const result = await authRepo.consumePasswordReset(
      'used-token',
      'new-hash',
    );
    expect(result).toBeNull();
  });

  it('returns null when token is expired', async () => {
    const row = {
      id: uuid(),
      user_id: uuid(),
      expires_at: new Date(Date.now() - 60_000),
      used_at: null,
    };
    mockQuery.mockResolvedValueOnce(mockResult([row]));
    const result = await authRepo.consumePasswordReset(
      'expired-token',
      'new-hash',
    );
    expect(result).toBeNull();
  });
});
