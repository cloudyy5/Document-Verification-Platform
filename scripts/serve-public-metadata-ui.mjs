// Synthetic UI host only; no environment file, Supabase, Auth or cloud I/O.
import { createServer } from "vite";
import { resolve } from "node:path";
const server = await createServer({
  configFile: false,
  root: resolve("tests/ui/public-metadata"),
  publicDir: false,
  resolve: {
    alias: {
      "@": resolve("src"),
      "next/link": resolve("tests/ui/operations/link.tsx"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 3205,
    strictPort: true,
    fs: { allow: [process.cwd()] },
  },
});
await server.listen();
console.log(
  "Synthetic public metadata UI on loopback port 3205; no cloud connection.",
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => void server.close().then(() => process.exit(0)));
