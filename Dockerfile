# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 1. Stage Dependencies (Dipakai bersama oleh dev dan builder)
FROM base AS dependencies
COPY package.json package-lock.json ./
COPY scripts/prepare-pdfjs.mjs ./scripts/prepare-pdfjs.mjs
RUN npm ci --no-audit --no-fund

# 2. Stage Development (Hot-reload & full source mount)
FROM dependencies AS dev
ENV NODE_ENV=development \
    HOSTNAME=0.0.0.0 \
    PORT=3000

USER node
EXPOSE 3000
CMD ["npm", "run", "dev"]

# 3. Stage Builder (Compile production bundle)
FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY} \
    NEXT_OUTPUT_STANDALONE=1

RUN node scripts/check-docker-public-env.mjs
RUN npm run build

# 4. Stage Runner / Production (Minimalist standalone image)
FROM base AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/login',{redirect:'manual',signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]