// Synthetic local UI only: never load env files or call Supabase.
import { createServer } from "vite";
import { resolve } from "node:path";
const server = await createServer({
  configFile: false,
  root: resolve("tests/ui/archive"),
  publicDir: false,
  resolve: {
    alias: {
      "@": resolve("src"),
      "next/link": resolve("tests/ui/operations/link.tsx"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 3204,
    strictPort: true,
    fs: { allow: [process.cwd()] },
  },
});
await server.listen();
console.log(
  "Synthetic archive component on loopback port 3204; no cloud integration.",
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => void server.close().then(() => process.exit(0)));
