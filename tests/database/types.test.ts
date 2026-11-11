import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { expect, test } from "vitest";
import { renderDatabaseTypes } from "../../scripts/database-types.mjs";

test("generated Supabase types match the migrated PostgreSQL schema", async () => {
  if (process.env.DVP_DATABASE_TEST_ISOLATED !== "1") {
    throw new Error(
      "Run database checks through npm run test:db against its isolated cluster.",
    );
  }
  const client = new Client({
    connectionString: process.env.DATABASE_TEST_URL,
  });
  await client.connect();
  try {
    const expected = await renderDatabaseTypes(client);
    const actual = await readFile(
      path.join(process.cwd(), "src/types/database.ts"),
      "utf8",
    );
    expect(
      actual.replace(/\r\n/g, "\n"),
      "Run npm run db:types after changing migrations",
    ).toBe(expected);
  } finally {
    await client.end();
  }
});
