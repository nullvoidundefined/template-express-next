import { describe, expect, it } from "vitest";

import { parseIdParam } from "app/utils/parsers/parseIdParam.js";

describe("parseIdParam", () => {
  it("returns UUID string for valid UUID", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(parseIdParam(uuid)).toBe(uuid);
    expect(parseIdParam("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(
      "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    );
  });

  it("returns null for invalid format", () => {
    expect(parseIdParam("1")).toBe(null);
    expect(parseIdParam("123")).toBe(null);
    expect(parseIdParam("abc")).toBe(null);
    expect(parseIdParam("550e8400-e29b-41d4-a716-44665544000")).toBe(null);
    expect(parseIdParam("550e8400-e29b-41d4-a716-4466554400000")).toBe(null);
  });

  it("returns null for undefined or array", () => {
    expect(parseIdParam(undefined)).toBe(null);
    expect(parseIdParam([])).toBe(null);
  });

  it("uses first element when array", () => {
    expect(parseIdParam(["550e8400-e29b-41d4-a716-446655440000"])).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });
});
