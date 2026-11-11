import { format } from "prettier";

/** Generate the Supabase Database generic from the migrated test schema.
 * This introspects PostgreSQL catalogs; it never reads user rows or secrets.
 * Unknown types fail explicitly instead of silently generating `any`.
 */
export async function renderDatabaseTypes(client) {
  const { rows: enums } = await client.query(`
    select t.typname as name, array_agg(e.enumlabel::text order by e.enumsortorder) as values
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public' group by t.typname order by t.typname
  `);
  const enumNames = new Set(enums.map((entry) => entry.name));
  function typeFor(name) {
    if (name.startsWith("_")) return `Array<${typeFor(name.slice(1))}>`;
    if (enumNames.has(name))
      return `Database["public"]["Enums"][${JSON.stringify(name)}]`;
    if (["json", "jsonb"].includes(name)) return "Json";
    if (name === "bool") return "boolean";
    if (["int2", "int4", "int8", "float4", "float8", "numeric"].includes(name))
      return "number";
    if (
      [
        "uuid",
        "text",
        "varchar",
        "bpchar",
        "char",
        "date",
        "timestamp",
        "timestamptz",
        "time",
        "timetz",
        "bytea",
      ].includes(name)
    )
      return "string";
    if (name === "void") return "undefined";
    throw new Error(
      `Database type generator needs an explicit mapping for PostgreSQL type: ${name}`,
    );
  }

  const { rows: columns } = await client.query(`
    select c.relname as table_name, a.attname as column_name,
      t.typname as type_name, not a.attnotnull as nullable,
      (d.oid is not null or a.attidentity <> '' or a.attgenerated <> '') as has_default,
      (a.attidentity = 'a' or a.attgenerated <> '') as generated
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    join pg_type t on t.oid = a.atttypid
    left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and a.attnum > 0 and not a.attisdropped
    order by c.relname, a.attnum
  `);
  const { rows: relationships } = await client.query(`
    select own.relname as table_name, con.conname as name,
      foreign_table.relname as referenced_table,
      array(select a.attname::text from unnest(con.conkey) with ordinality k(num, pos)
        join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.num order by pos) as columns,
      array(select a.attname::text from unnest(con.confkey) with ordinality k(num, pos)
        join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.num order by pos) as referenced_columns,
      exists(select 1 from pg_constraint u where u.conrelid = con.conrelid
        and u.contype in ('p', 'u') and u.conkey = con.conkey) as one_to_one
    from pg_constraint con join pg_class own on own.oid = con.conrelid
    join pg_namespace own_ns on own_ns.oid = own.relnamespace
    join pg_class foreign_table on foreign_table.oid = con.confrelid
    join pg_namespace foreign_ns on foreign_ns.oid = foreign_table.relnamespace
    where con.contype = 'f' and own_ns.nspname = 'public' and foreign_ns.nspname = 'public'
    order by own.relname, con.conname
  `);
  const tables = [...new Set(columns.map((column) => column.table_name))]
    .map((table) => {
      const fields = columns.filter((column) => column.table_name === table);
      const renderFields = (mode) =>
        fields
          .map((column) => {
            const optional =
              mode === "Update" ||
              (mode === "Insert" && (column.nullable || column.has_default));
            const type =
              mode !== "Row" && column.generated
                ? "never"
                : `${typeFor(column.type_name)}${column.nullable ? " | null" : ""}`;
            return `${JSON.stringify(column.column_name)}${optional ? "?" : ""}: ${type};`;
          })
          .join("\n");
      const relations = relationships
        .filter((relation) => relation.table_name === table)
        .map(
          (relation) => `{
      foreignKeyName: ${JSON.stringify(relation.name)};
      columns: ${JSON.stringify(relation.columns)};
      isOneToOne: ${relation.one_to_one};
      referencedRelation: ${JSON.stringify(relation.referenced_table)};
      referencedColumns: ${JSON.stringify(relation.referenced_columns)};
    }`,
        )
        .join(",\n");
      return `${JSON.stringify(table)}: {
      Row: {${renderFields("Row")}};
      Insert: {${renderFields("Insert")}};
      Update: {${renderFields("Update")}};
      Relationships: [${relations}];
    };`;
    })
    .join("\n");

  const { rows: viewColumns } = await client.query(`
    select c.relname as view_name, a.attname as column_name,
      t.typname as type_name, not a.attnotnull as nullable
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    join pg_type t on t.oid = a.atttypid
    where n.nspname = 'public' and c.relkind in ('v', 'm')
      and a.attnum > 0 and not a.attisdropped
    order by c.relname, a.attnum
  `);
  // Views have no own FK constraints. Do not guess relationships from their
  // names or pretend they are writable; API grants remain the authority.
  const views = [...new Set(viewColumns.map((column) => column.view_name))]
    .map((view) => {
      const fields = viewColumns
        .filter((column) => column.view_name === view)
        .map(
          (column) =>
            `${JSON.stringify(column.column_name)}: ${typeFor(column.type_name)}${column.nullable ? " | null" : ""};`,
        )
        .join("\n");
      return `${JSON.stringify(view)}: { Row: {${fields}}; Relationships: []; };`;
    })
    .join("\n");

  const { rows: functions } = await client.query(`
    select p.proname as name, p.proargnames as arg_names, p.pronargdefaults as defaults,
      array(select t.typname::text from unnest(p.proargtypes::oid[]) with ordinality a(oid, pos)
        join pg_type t on t.oid = a.oid order by a.pos) as arg_types,
      return_type.typname as return_type
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    join pg_type return_type on return_type.oid = p.prorettype
    where n.nspname = 'public' and p.prokind = 'f' and return_type.typname <> 'trigger'
    order by p.proname
  `);
  if (new Set(functions.map((fn) => fn.name)).size !== functions.length) {
    throw new Error(
      "Database type generator needs explicit support for overloaded functions.",
    );
  }
  const renderedFunctions = functions
    .map((fn) => {
      const args = fn.arg_types
        .map((type, index) => {
          const name = fn.arg_names?.[index];
          if (!name) throw new Error("Database RPC parameters must be named.");
          return `${JSON.stringify(name)}${index >= fn.arg_types.length - fn.defaults ? "?" : ""}: ${typeFor(type)} | null;`;
        })
        .join("\n");
      return `${JSON.stringify(fn.name)}: {Args: ${args ? `{${args}}` : "Record<PropertyKey, never>"}; Returns: ${typeFor(fn.return_type)}};`;
    })
    .join("\n");
  const renderedEnums = enums
    .map(
      (entry) =>
        `${JSON.stringify(entry.name)}: ${entry.values.map((value) => JSON.stringify(value)).join(" | ")};`,
    )
    .join("\n");

  return format(
    `/** Generated from the migrated, isolated PostgreSQL schema by npm run db:types.
   * Do not edit by hand. Types describe structure; RLS and grants enforce authorization.
   */
  export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
  export type Database = {
    public: {
      Tables: {${tables}};
      Views: {${views}};
      Functions: {${renderedFunctions}};
      Enums: {${renderedEnums}};
      CompositeTypes: Record<string, never>;
    };
  };
  export type AppRole = Database["public"]["Enums"]["app_role"];
  export type DocumentStatus = Database["public"]["Enums"]["document_status"];
  `,
    { parser: "typescript" },
  );
}
