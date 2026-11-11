import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const target = fileURLToPath(new URL("../.env.local", import.meta.url));
const template = await readFile(
  new URL("../.env.example", import.meta.url),
  "utf8",
);
try {
  await writeFile(
    target,
    template.replace(
      /^AUTH_FLOW_SECRET=$/m,
      `AUTH_FLOW_SECRET=${randomBytes(32).toString("base64url")}`,
    ),
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Created .env.local with a private auth flow secret. Fill Supabase connection values locally; no secret was printed.",
  );
} catch (error) {
  if (error.code !== "EEXIST")
    throw new Error("Could not prepare local authentication configuration.", {
      cause: error,
    });
  console.log(
    ".env.local already exists and was preserved. Ensure APP_URL, AUTH_FLOW_SECRET and the three Supabase variables are configured locally.",
  );
}
