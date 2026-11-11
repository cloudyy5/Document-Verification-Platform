import type { Client } from "pg";

export function renderDatabaseTypes(
  client: Pick<Client, "query">,
): Promise<string>;
