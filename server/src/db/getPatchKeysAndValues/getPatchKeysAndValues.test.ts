import { describe, expect, it } from "vitest";

import { getPatchKeysAndValues } from "app/db/getPatchKeysAndValues/getPatchKeysAndValues.js";

const ALLOWED = ["name", "email", "notes"] as const;

describe("getPatchKeysAndValues", () => {
  it("builds SET clause for a single field", () => {
    const { keys, values } = getPatchKeysAndValues(ALLOWED, { name: "Alice" });
    expect(keys).toBe("name = $1");
    expect(values).toEqual(["Alice"]);
  });

  it("builds SET clause for multiple fields in allowedFields order", () => {
    const { keys, values } = getPatchKeysAndValues(ALLOWED, {
      email: "a@b.com",
      name: "Alice",
    });
    expect(keys).toBe("name = $1, email = $2");
    expect(values).toEqual(["Alice", "a@b.com"]);
  });

  it("maps undefined values to null via ??", () => {
    const { values } = getPatchKeysAndValues(ALLOWED, { name: undefined, email: "a@b.com" });
    expect(values).toEqual(["a@b.com"]);
  });

  it("preserves explicit null values", () => {
    const { keys, values } = getPatchKeysAndValues(ALLOWED, { notes: null });
    expect(keys).toBe("notes = $1");
    expect(values).toEqual([null]);
  });

  it("returns empty clause when no allowed fields are present", () => {
    const { keys, values } = getPatchKeysAndValues(ALLOWED, {});
    expect(keys).toBe("");
    expect(values).toEqual([]);
  });

  it("ignores fields not in allowedFields", () => {
    const data = { name: "Alice", bogus: "ignored" } as Record<string, string>;
    const { keys, values } = getPatchKeysAndValues(ALLOWED, data);
    expect(keys).toBe("name = $1");
    expect(values).toEqual(["Alice"]);
  });

  it("handles numeric values", () => {
    const fields = ["count", "label"] as const;
    const { keys, values } = getPatchKeysAndValues(fields, { count: 42, label: "x" });
    expect(keys).toBe("count = $1, label = $2");
    expect(values).toEqual([42, "x"]);
  });
});
