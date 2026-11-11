import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/v2/signing-requests/*/decisions": [
      "./src/server/signing/layout-worker.mjs",
      "./src/server/signing/pdf-layout.mjs",
      "./src/server/signing/render-worker.mjs",
      "./node_modules/pdf-lib/**/*",
      "./node_modules/@pdf-lib/**/*",
      "./node_modules/pako/**/*",
      "./node_modules/tslib/**/*",
      "./node_modules/qrcode/**/*",
      "./node_modules/pngjs/**/*",
      "./node_modules/dijkstrajs/**/*",
      "./node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf",
    ],
    "/api/v2/signing-receipts/*/render": [
      "./src/server/signing/pdf-layout.mjs",
      "./src/server/signing/render-worker.mjs",
      "./node_modules/pdf-lib/**/*",
      "./node_modules/@pdf-lib/**/*",
      "./node_modules/pako/**/*",
      "./node_modules/tslib/**/*",
      "./node_modules/qrcode/**/*",
      "./node_modules/pngjs/**/*",
      "./node_modules/dijkstrajs/**/*",
      "./node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf",
    ],
    "/api/v1/documents": [
      "./src/server/documents/pdf-worker.mjs",
      "./node_modules/pdf-lib/**/*",
      "./node_modules/@pdf-lib/**/*",
      "./node_modules/pako/**/*",
      "./node_modules/tslib/**/*",
    ],
    "/api/v1/documents/*/resubmissions": [
      "./src/server/documents/pdf-worker.mjs",
      "./node_modules/pdf-lib/**/*",
      "./node_modules/@pdf-lib/**/*",
      "./node_modules/pako/**/*",
      "./node_modules/tslib/**/*",
    ],
    "/api/v2/signing-documents": [
      "./src/server/documents/pdf-worker.mjs",
      "./node_modules/pdf-lib/**/*",
      "./node_modules/@pdf-lib/**/*",
      "./node_modules/pako/**/*",
      "./node_modules/tslib/**/*",
    ],
  },
  logging: {
    serverFunctions: false,
    incomingRequests: { ignore: [/\/auth\/(?:confirm|callback)/] },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/auth/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/api/v1/documents/:documentId/file",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/api/v2/signing-receipts/:receiptId/file",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/api/v2/signing-documents/:documentId/file",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
