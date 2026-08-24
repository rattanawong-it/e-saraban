# syntax=docker/dockerfile:1

# e-Saraban — production image
# multi-stage: base → deps → builder → (migrator | runner)
# ใช้ output: "standalone" ของ Next 16 เพื่อให้ image ปลายทางไม่ต้องมี node_modules ทั้งก้อน

ARG NODE_VERSION=24.14.1

# ── base ─────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS base
# openssl: schema engine ของ Prisma CLI ต้องใช้ตอน migrate บน musl
RUN apk add --no-cache openssl
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1
# generate ไม่ได้ต่อฐานข้อมูลจริง แต่ prisma.config.ts อ่านตัวแปรนี้ตอน build
# ค่าปลอมนี้อยู่แค่ stage build — ไม่ติดไปกับ image ปลายทาง
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
RUN corepack enable pnpm
WORKDIR /app

# ── deps — ติดตั้ง dependency อย่างเดียว ให้ layer นี้ถูก cache ไว้ ─────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
# nodeLinker: hoisted — output file tracing ของ Next ตาม symlink ของ pnpm ไม่ครบ
# (@swc/helpers หายจาก .next/standalone แล้ว server.js พังตอนบูต)
# ตั้งเฉพาะใน image เท่านั้น — node_modules บนเครื่อง dev ยังเป็น symlink ตามเดิม
RUN printf '\nnodeLinker: hoisted\n' >> pnpm-workspace.yaml
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── builder — generate client + next build ───────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# COPY ข้างบนทับ pnpm-workspace.yaml ด้วยไฟล์เดิม ทำให้ pnpm เห็นว่า node_modules
# ไม่ตรงกับ config แล้วสั่ง install ใหม่เป็น layout แบบ symlink — ต้องใส่ค่ากลับ
RUN printf '\nnodeLinker: hoisted\n' >> pnpm-workspace.yaml
# src/generated/ อยู่ใน .dockerignore (regenerate ใหม่ได้เสมอ) จึงต้อง generate ตรงนี้
RUN pnpm exec prisma generate
RUN pnpm build

# ── migrator — รัน migrate/seed แล้วจบ (service `migrate` ใน compose) ──
# ต้องมี node_modules เต็มก้อน เพราะใช้ prisma CLI + tsx ซึ่งไม่ได้อยู่ใน standalone
FROM builder AS migrator
CMD ["pnpm", "db:deploy"]

# ── runner — image ที่ deploy จริง ───────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# ค่า DATABASE_URL ปลอมจาก base ต้องไม่ติดมากับ image ที่รันจริง
ENV DATABASE_URL=""

RUN addgroup -g 1001 -S nodejs \
 && adduser -u 1001 -S nextjs -G nodejs

# standalone ไม่คัด public/ กับ .next/static ให้ ต้องคัดเอง
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# ที่เก็บไฟล์แนบของ StorageAdapter แบบ LocalFs (spec §11.2) — map เป็น volume ใน compose
RUN mkdir -p /app/storage && chown nextjs:nodejs /app/storage

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
