// Local browser harness only. No env file, Auth, Supabase or database access.
import { createServer } from "vite";
import { resolve } from "node:path";
const server = await createServer({
  configFile: false,
  root: resolve("tests/ui/notifications"),
  publicDir: false,
  resolve: {
    alias: [
      {
        find: "@/app/(auth)/actions",
        replacement: resolve("tests/ui/notifications/auth-actions.ts"),
      },
      { find: "@", replacement: resolve("src") },
      {
        find: "next/link",
        replacement: resolve("tests/ui/operations/link.tsx"),
      },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 3203,
    strictPort: true,
    fs: { allow: [process.cwd()] },
  },
});
await server.listen();
console.log(
  "Synthetic notification component ready on loopback port 3203; no cloud integration.",
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => void server.close().then(() => process.exit(0)));
