import crypto from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { query } from "app/db/pool/pool.js";
import * as authRepo from "app/repositories/auth/auth.js";
import { mockResult } from "app/utils/tests/mockResult.js";
import { uuid } from "app/utils/tests/uuids.js";

const mockClient = {};

vi.mock("app/db/pool/pool.js", () => {
  const queryFn = vi.fn();
  return {
    query: queryFn,
    withTransaction: vi.fn((fn: (client: unknown) => Promise<unknown>) => fn(mockClient)),
  };
});

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn(() => Promise.resolve("hashed")),
    compare: vi.fn((plain: string, hash: string) =>
      Promise.resolve(hash === "hashed" && plain.length > 0),
    ),
  },
}));

const mockQuery = vi.mocked(query);

describe("auth repository", () => {
  const id = uuid();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createUser inserts and returns user", async () => {
    const row = {
      id,
      email: "u@example.com",
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockQuery.mockResolvedValueOnce(mockResult([row]));

    const result = await authRepo.createUser("u@example.com", "password123");

    expect(result).toEqual(row);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO users"),
      ["u@example.com", "hashed"],
      undefined,
    );
  });

  it("createUser throws when insert returns no row", async () => {
    mockQuery.mockResolvedValueOnce(mockResult([], 0));
    await expect(authRepo.createUser("u@example.com", "pwd")).rejects.toThrow(
      "Insert returned no row",
    );
  });

  it("findUserByEmail returns user when found", async () => {
    const row = {
      id: id,
      email: "u@example.com",
      password_hash: "hashed",
      created_at: new Date(),
      updated_at: null,
    };
    mockQuery.mockResolvedValueOnce(mockResult([row]));

    const result = await authRepo.findUserByEmail("u@example.com");

    expect(result).toEqual(row);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("SELECT"), ["u@example.com"]);
  });

  it("findUserByEmail returns null when not found", async () => {
    mockQuery.mockResolvedValueOnce(mockResult([]));
    const result = await authRepo.findUserByEmail("nobody@example.com");
    expect(result).toBeNull();
  });

  it("findUserById returns user when found", async () => {
    const row = {
      id: id,
      email: "u@example.com",
      created_at: new Date(),
      updated_at: null,
    };
    mockQuery.mockResolvedValueOnce(mockResult([row]));
    const result = await authRepo.findUserById(id);
    expect(result).toEqual(row);
  });

  it("findUserById returns null when not found", async () => {
    mockQuery.mockResolvedValueOnce(mockResult([]));
    const result = await authRepo.findUserById(id);
    expect(result).toBeNull();
  });

  it("verifyPassword returns true when match", async () => {
    const result = await authRepo.verifyPassword("pwd", "hashed");
    expect(result).toBe(true);
  });

  it("verifyPassword returns false when no match", async () => {
    const result = await authRepo.verifyPassword("pwd", "other");
    expect(result).toBe(false);
  });

  it("createSession inserts hash of token and returns raw token", async () => {
    mockQuery.mockResolvedValueOnce(mockResult([], 1));
    const result = await authRepo.createSession(id);
    expect(typeof result).toBe("string");
    expect(result).toHaveLength(64);
    const storedHash = crypto.createHash("sha256").update(result, "utf8").digest("hex");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO sessions"),
      [storedHash, id, expect.any(Date)],
      undefined,
    );
  });

  it("getSessionWithUser returns user when session valid", async () => {
    const row = {
      id: id,
      email: "u@example.com",
      created_at: new Date(),
      updated_at: null,
    };
    mockQuery.mockResolvedValueOnce(mockResult([row]));
    const result = await authRepo.getSessionWithUser("session-id");
    expect(result).toEqual(row);
    const expectedHash = crypto.createHash("sha256").update("session-id", "utf8").digest("hex");
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("sessions"), [expectedHash]);
  });

  it("getSessionWithUser returns null when no row", async () => {
    mockQuery.mockResolvedValueOnce(mockResult([]));
    const result = await authRepo.getSessionWithUser("bad");
    expect(result).toBeNull();
  });

  it("deleteSession returns true when deleted", async () => {
    mockQuery.mockResolvedValueOnce(mockResult([], 1));
    const result = await authRepo.deleteSession("sid");
    expect(result).toBe(true);
    const expectedHash = crypto.createHash("sha256").update("sid", "utf8").digest("hex");
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM sessions"), [
      expectedHash,
    ]);
  });

  it("deleteSession returns false when not found", async () => {
    mockQuery.mockResolvedValueOnce(mockResult([], 0));
    const result = await authRepo.deleteSession("sid");
    expect(result).toBe(false);
  });

  it("deleteSessionsForUser runs delete query", async () => {
    mockQuery.mockResolvedValueOnce(mockResult([], 2));
    await authRepo.deleteSessionsForUser(id);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM sessions"), [id]);
  });

  it("createUserAndSession runs user and session inserts in transaction", async () => {
    const userRow = {
      id,
      email: "u@example.com",
      created_at: new Date(),
      updated_at: null,
    };
    mockQuery.mockResolvedValueOnce(mockResult([userRow])).mockResolvedValueOnce(mockResult([], 1));
    const result = await authRepo.createUserAndSession("u@example.com", "pwd");
    expect(result.user).toEqual(userRow);
    expect(typeof result.sessionId).toBe("string");
    expect(result.sessionId).toHaveLength(64);
    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("INSERT INTO users"),
      ["u@example.com", "hashed"],
      mockClient,
    );
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO sessions"),
      [expect.any(String), id, expect.any(Date)],
      mockClient,
    );
  });
});
