import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema, userSchema } from "app/schemas/auth.js";

describe("registerSchema", () => {
  it("accepts valid email and password", () => {
    const result = registerSchema.safeParse({ email: "a@b.com", password: "12345678" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({ email: "not-email", password: "12345678" });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({ email: "a@b.com", password: "short" });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.message).toBe("Password must be at least 8 characters");
  });

  it("rejects missing fields", () => {
    expect(registerSchema.safeParse({}).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@b.com" }).success).toBe(false);
    expect(registerSchema.safeParse({ password: "12345678" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid email and password", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "x" });
    expect(result.success).toBe(true);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "" });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.message).toBe("Password is required");
  });

  it("rejects invalid email", () => {
    expect(loginSchema.safeParse({ email: "bad", password: "x" }).success).toBe(false);
  });
});

describe("userSchema", () => {
  const validUser = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    email: "a@b.com",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-02T00:00:00.000Z",
  };

  it("accepts a valid user", () => {
    const result = userSchema.safeParse(validUser);
    expect(result.success).toBe(true);
  });

  it("coerces date strings to Date objects", () => {
    const result = userSchema.safeParse(validUser);
    expect(result.success).toBe(true);
    expect(result.data!.created_at).toBeInstanceOf(Date);
    expect(result.data!.updated_at).toBeInstanceOf(Date);
  });

  it("accepts null for updated_at", () => {
    const result = userSchema.safeParse({ ...validUser, updated_at: null });
    expect(result.success).toBe(true);
    expect(result.data!.updated_at).toBeNull();
  });

  it("rejects invalid UUID for id", () => {
    const result = userSchema.safeParse({ ...validUser, id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = userSchema.safeParse({ ...validUser, email: "bad" });
    expect(result.success).toBe(false);
  });
});
