import type pg from "pg";

export function mockResult<T extends pg.QueryResultRow>(
  rows: T[],
  rowCount?: number,
): pg.QueryResult<T> {
  return { rows, rowCount: rowCount ?? rows.length, command: "", oid: 0, fields: [] };
}
