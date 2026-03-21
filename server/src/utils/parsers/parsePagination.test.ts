import { describe, expect, it } from "vitest";

import { parsePagination } from "app/utils/parsers/parsePagination.js";

describe("parsePagination", () => {
  it("returns default limit and offset when both undefined", () => {
    expect(parsePagination(undefined, undefined)).toEqual({ limit: 50, offset: 0 });
  });

  it("returns default limit and offset when both empty string", () => {
    expect(parsePagination("", "")).toEqual({ limit: 50, offset: 0 });
  });

  it("uses provided limit when valid number", () => {
    expect(parsePagination("10", undefined)).toEqual({ limit: 10, offset: 0 });
    expect(parsePagination("25", undefined)).toEqual({ limit: 25, offset: 0 });
  });

  it("uses default limit when limit param is NaN or invalid", () => {
    expect(parsePagination("invalid", undefined)).toEqual({ limit: 50, offset: 0 });
    expect(parsePagination("abc", undefined)).toEqual({ limit: 50, offset: 0 });
  });

  it("clamps limit to 1 when below 1", () => {
    expect(parsePagination("0", "0")).toEqual({ limit: 1, offset: 0 });
    expect(parsePagination("-5", "0")).toEqual({ limit: 1, offset: 0 });
  });

  it("clamps limit to 100 when above 100", () => {
    expect(parsePagination("150", "0")).toEqual({ limit: 100, offset: 0 });
    expect(parsePagination("999", "5")).toEqual({ limit: 100, offset: 5 });
  });

  it("floors limit to integer", () => {
    expect(parsePagination("10.7", "0")).toEqual({ limit: 10, offset: 0 });
  });

  it("uses provided offset when valid number", () => {
    expect(parsePagination("10", "5")).toEqual({ limit: 10, offset: 5 });
    expect(parsePagination(undefined, "20")).toEqual({ limit: 50, offset: 20 });
  });

  it("uses 0 for offset when offset param is undefined or empty string", () => {
    expect(parsePagination("10", undefined)).toEqual({ limit: 10, offset: 0 });
    expect(parsePagination("10", "")).toEqual({ limit: 10, offset: 0 });
  });

  it("uses 0 for offset when offset param is NaN", () => {
    expect(parsePagination(undefined, "invalid")).toEqual({ limit: 50, offset: 0 });
    expect(parsePagination("10", "abc")).toEqual({ limit: 10, offset: 0 });
  });

  it("floors offset to integer and clamps to at least 0", () => {
    expect(parsePagination("10", "5.9")).toEqual({ limit: 10, offset: 5 });
    expect(parsePagination("10", "-3")).toEqual({ limit: 10, offset: 0 });
  });

  it("accepts limit at boundaries 1 and 100", () => {
    expect(parsePagination("1", "0")).toEqual({ limit: 1, offset: 0 });
    expect(parsePagination("100", "0")).toEqual({ limit: 100, offset: 0 });
  });
});
