# สถานะการพัฒนา e-Saraban

> เอกสารติดตามความคืบหน้า — คู่กับ [spec.md](./spec.md)
> อัปเดตล่าสุด: **22 สิงหาคม 2569** · เฟสปัจจุบัน: **P0 — Foundation ปิดแล้ว · ถัดไปคือ P1**

---

## 1. สรุปสถานะ P0 — Foundation

Checklist ตาม spec §13 · ประมาณการ 1 สัปดาห์

| # | งาน | สถานะ |
|---|-----|:---:|
| 1 | `pnpm create next-app` (Next 16 + TS strict) | ✅ เสร็จ |
| 2 | Tailwind v4 + shadcn/ui | ✅ เสร็จ |
| 3 | Prisma 7 + PostgreSQL | ✅ เสร็จ · migrate + seed ผ่านแล้ว |
| 4 | Docker Compose | ✅ เสร็จ · ทดสอบ stack ครบวงจรแล้ว |
| 5 | ESLint / Prettier | ✅ เสร็จ · บังคับกติกาห้าม semicolon อัตโนมัติแล้ว |
| 6 | โครงโฟลเดอร์ §11.2 | ✅ เสร็จ · ฝั่ง backend ครบ · route group รอ P1 (ดู §6.11) |
| 7 | CI (typecheck / lint / test) | ⏭️ **ข้ามตามคำสั่งผู้ใช้** (22 ส.ค. 2569) — ดู §6.12 |

**Definition of Done ของ P0: ✅ ปิดครบแล้ว**

| เกณฑ์ | ผล |
|---|---|
| `pnpm dev` | ✅ ผ่าน |
| `pnpm build` | ✅ ผ่าน (4 static pages) |
| `pnpm lint` / `pnpm typecheck` / `pnpm format:check` | ✅ ผ่าน ไม่มี warning |
| `pnpm db:migrate` | ✅ ผ่าน — migration แรก `20260822024855_init_extensions` |
| `pnpm db:seed` | ✅ ผ่าน — collation ICU th-TH + `extension ครบ: pg_trgm, unaccent` |
| stack ครบ (`--profile prod`) | ✅ nginx → app → postgres ตอบ HTTP 200 |
| เรียงลำดับภาษาไทย | ✅ `กา · เก · ไก่ · ขา · เข · ครุย · เคย · งาน · สารบรรณ · เอกสาร` |

---

## 2. สภาพแวดล้อมและเวอร์ชันที่ใช้จริง

| | |
|---|---|
| Node.js | 24.14.1 |
| pnpm | 11.5.1 |
| OS | Windows 11 |
| Docker Engine | 29.7.2 (Docker Desktop) · Compose v5.4.0 |
| Next.js | 16.3.1 (App Router + Turbopack) · `output: "standalone"` |
| React | 19.2.8 |
| TypeScript | 5.9.3 — `strict` + `noUncheckedIndexedAccess` |
| Tailwind CSS | 4.3.3 |
| shadcn/ui | CLI 4.18.0 · style `radix-nova` · icon `lucide` |
| Prisma | 7.9.1 (client + CLI + adapter-pg) |
| PostgreSQL | **16.15** (image `postgres:16-alpine`) |
| collation ของ DB | **ICU `th-TH`** · encoding UTF8 · extension `pg_trgm` + `unaccent` |
| nginx | 1.29-alpine |

### คำสั่งที่ใช้ได้แล้ว

```bash
# แอป
pnpm dev             # dev server
pnpm build           # production build
pnpm start           # รัน production build
pnpm lint            # ESLint
pnpm lint:fix        # ESLint --fix (ลบ semicolon ให้ได้)
pnpm format          # Prettier --write ทั้ง repo
pnpm format:check    # Prettier --check (ใช้ใน CI)
pnpm typecheck       # tsc --noEmit

# ฐานข้อมูล (ต้อง docker compose up -d ก่อน)
pnpm db:generate     # prisma generate
pnpm db:migrate      # prisma migrate dev
pnpm db:deploy       # prisma migrate deploy
pnpm db:seed         # prisma db seed
pnpm db:studio       # prisma studio

# Docker
docker compose up -d                    # โหมด dev — postgres อย่างเดียว
docker compose --profile prod up -d     # โหมด prod — postgres + migrate + app + nginx
docker compose --profile prod build     # build image ใหม่
docker compose down                     # ปิด (ข้อมูลยังอยู่ใน volume)
```

**วิธีทำงานประจำวัน:** `docker compose up -d` แล้ว `pnpm dev` บนเครื่อง —
ไม่ต้องรันแอปใน container ตอน dev (ช้ากว่ามากบน Windows ตามที่เอกสาร Next แนะนำเอง)

---

## 3. โครงสร้างโปรเจกต์ปัจจุบัน

```
E_Saraban/
├── docs/
│   ├── spec.md                 SRS (baseline)
│   └── progress.md             เอกสารนี้
├── docker/
│   └── nginx/
│       ├── conf.d/default.conf reverse proxy + security header + block TLS ที่คอมเมนต์ไว้
│       └── certs/              ที่วาง cert (gitignore ทั้งโฟลเดอร์)
├── prisma/
│   ├── schema.prisma           generator + datasource + extensions (ยังไม่มี model)
│   ├── migrations/
│   │   └── 20260822024855_init_extensions/   CREATE EXTENSION pg_trgm, unaccent
│   └── seed.ts                 ตรวจ connection + ICU collation th-TH + extension
├── prisma.config.ts            schema/migrations path · seed command · datasource url
├── src/
│   ├── app/
│   │   ├── fonts/              IBM Plex Sans Thai 8 ไฟล์ .woff2 + LICENSE
│   │   ├── globals.css         shadcn design tokens (light + .dark)
│   │   ├── layout.tsx          lang="th" · next/font/local · metadata ไทย
│   │   └── page.tsx            หน้า smoke test ชั่วคราว
│   ├── components/ui/button.tsx
│   ├── constants/              ★ ข้อความ UI แยกจาก component (spec §12)
│   │   ├── app.ts              APP_NAME · APP_DESCRIPTION · APP_LOCALE
│   │   └── document.ts         ชั้นความลับ · ชั้นความเร็ว · ชื่อบทบาท
│   ├── server/
│   │   ├── context.ts          ServiceContext (spec §11.3 ข้อ 2)
│   │   ├── actions/            README — Server Actions (P1+)
│   │   ├── services/           README — business logic (P1+)
│   │   └── repositories/       README — Prisma query (P1+)
│   ├── schemas/                README — Zod (ติดตั้ง zod ตอน P1)
│   ├── lib/
│   │   ├── db.ts               PrismaClient singleton + PrismaPg adapter
│   │   ├── utils.ts            cn()
│   │   ├── thai/               ★ พ.ศ. · เลขไทย — ใช้งานได้จริงแล้ว
│   │   ├── authz/              ★ PERMISSIONS · SCOPES · ROLE_CODES (can() รอ P1)
│   │   ├── storage/            ★ StorageAdapter interface (LocalFs รอ P3)
│   │   ├── notification/       ★ NotificationAdapter interface (InApp รอ P5)
│   │   ├── auth/               README — session · password · rate-limit (P1)
│   │   ├── crypto/             README — envelope encryption (P3)
│   │   └── audit/              README — audit writer + hash chain (P1/P3)
│   └── generated/prisma/       Prisma Client (gitignored — generate ตอน postinstall)
├── Dockerfile                  multi-stage: base → deps → builder → migrator | runner
├── docker-compose.yml          postgres (dev) + migrate/app/nginx (profile prod)
├── .dockerignore
├── next.config.ts              output standalone + serverActions.bodySizeLimit
├── eslint.config.mjs           next core-web-vitals + typescript + prettier + @stylistic/semi
├── .prettierrc.json            semi:false · printWidth 100 · plugin tailwindcss
├── .prettierignore
├── .gitattributes              บังคับ LF ทั้ง repo (กัน core.autocrlf ของ Windows)
├── components.json             shadcn config
├── .env                        ค่า dev จริง (gitignored)
├── .env.example                template — POSTGRES_* · DATABASE_URL · FILE_MASTER_KEY · AUTH_SECRET · *_PORT
└── pnpm-workspace.yaml         allowBuilds สำหรับ prisma / esbuild
```

### ยังไม่ได้สร้าง — ตั้งใจเว้นไว้ (เหตุผลใน §6.11)

```
src/app/(auth)/login/                     -> P1 พร้อมหน้า login จริง
src/app/(app)/{dashboard,inbox,...}/      -> P1 พร้อม layout ที่มี sidebar + context switcher
src/app/api/files/[attachmentId]/route.ts -> P3 พร้อม secure file delivery
```

---

## 4. สถาปัตยกรรม Docker ที่วางไว้

```
                    :80 / :443
                        │
                   ┌────▼────┐
                   │  nginx  │  TLS termination · client_max_body_size 55m
                   └────┬────┘  security header · gzip · stream ไฟล์แนบ
                        │ :3000
                   ┌────▼────┐
                   │   app   │  node server.js (standalone) · non-root uid 1001
                   └────┬────┘  volume file-storage → /app/storage
                        │ :5432
                   ┌────▼─────┐
                   │ postgres │  volume postgres-data
                   └──────────┘
                        ▲
                   ┌────┴────┐
                   │ migrate │  prisma migrate deploy แล้วจบ (exit 0)
                   └─────────┘  app รอ service นี้สำเร็จก่อนสตาร์ท
```

**ลำดับการสตาร์ท** ผูกด้วย condition ของ compose ทั้งเส้น:
`postgres healthy` → `migrate completed_successfully` → `app healthy` → `nginx`
จึงไม่มีทางที่แอปจะขึ้นมาก่อน schema พร้อม

**ขนาด image:** app 288MB · migrator 1.57GB (ใช้ภายในเท่านั้น ไม่ต้อง deploy) ·
postgres 420MB · nginx 93.5MB

---

## 5. กติกาการทำงานของโปรเจกต์นี้

| กติกา | รายละเอียด |
|---|---|
| **ห้าม semicolon** | ไฟล์ TypeScript/JavaScript ทุกไฟล์ที่เขียนเอง — ยกเว้น `next-env.d.ts` ที่ Next generate ใหม่ทุก build |
| **Package manager** | pnpm เท่านั้น (spec §11.1) |
| **รีวิวทีละขั้น** | ทำเสร็จแต่ละขั้นแล้วหยุดรายงานก่อนไปขั้นถัดไป |
| **ภาษา** | UI ภาษาไทยอย่างเดียว · comment ในโค้ดเป็นไทยได้ |
| **Git** | commit เมื่อผู้ใช้สั่งเท่านั้น · ถ้าอยู่บน branch หลักให้แตก branch ก่อน |

### 5.1 สถานะ git

```
8181f87  P0 Foundation: วางฐานโปรเจกต์ e-Saraban ให้ครบ   <- branch p0-foundation (HEAD)
e6b5e1e  Initial commit from Create Next App              <- branch master
```

- งาน P0 ทั้งหมด commit แล้วเมื่อ **22 ส.ค. 2569** — 60 ไฟล์ · +11,826 / −115
- อยู่บน branch **`p0-foundation`** · `master` ยังค้างอยู่ที่ commit ของ template
- **ยังไม่มี remote** — ถ้าจะ push ต้อง `git remote add origin <url>` ก่อน
- รวมกลับ master: `git checkout master && git merge p0-foundation`

**ที่ไม่ได้เข้า git โดยตั้งใจ**

| อะไร | ทำไม |
|---|---|
| `.env` | มีค่า `FILE_MASTER_KEY` / `AUTH_SECRET` จริง — ตรวจแล้วว่าไม่หลุดเข้า commit |
| `src/generated/prisma/` | generate ใหม่ได้ผ่าน `postinstall` |
| `docker/nginx/certs/*` | private key ห้ามเข้า git เด็ดขาด |
| `.claude/skills/` `.agents/skills/` `.windsurf/skills/` `skills-lock.json` | agent skills ที่ prisma init แถมมา — เนื้อหาเดียวกัน 3 ชุด 213 ไฟล์ · ดึงกลับได้ผ่าน prisma CLI · **ignore เจาะจงที่ `skills/` ไม่ใช่ทั้งโฟลเดอร์** เผื่อวันหลังจะ commit `.claude/settings.json` |

---

## 6. บันทึกเรื่องที่พบระหว่างพัฒนา (Implementation Notes)

เรื่องที่ต่างจากที่ spec หรือเอกสารทั่วไปคาดไว้ — บันทึกกันลืม

### 6.1 create-next-app

- โฟลเดอร์ชื่อ `E_Saraban` มีตัวพิมพ์ใหญ่ → npm ปฏิเสธชื่อ package
  **แก้โดย** scaffold ในโฟลเดอร์ชั่วคราวชื่อ `e-saraban` แบบ `--skip-install` แล้วย้ายไฟล์เข้ามา
  `package.json` จึงชื่อ `"e-saraban"`
- `--src-dir=false` **ไม่ทำงาน** — Commander อ่านว่า "มี flag" = เปิด src-dir
  ผลคือได้ `src/` ซึ่ง**ตรงกับ spec §11.2 พอดี** → ตัดสินใจเก็บไว้
- Next 16 **ไม่มี `next lint` แล้ว** — script ที่ generate มาคือ `"lint": "eslint"` ถูกต้องอยู่แล้ว

### 6.2 shadcn/ui (CLI 4.x)

- `-b` **ไม่ใช่ base color อีกแล้ว** แต่เป็น component library: `radix` / `base` / `aria`
  → เลือก **`radix`** (shadcn/ui แบบคลาสสิก)
- ต้องระบุ preset ด้วย (`nova`, `vega`, `maia`, `lyra`, `mira`, `luma`, `sera`, `rhea`)
  → เลือก **`nova`** เพราะใช้ Lucide ตรงกับ spec §11.1
- base color ที่ได้จริงคือ **`neutral`** (มากับ preset ไม่ใช่ค่าที่เลือกเอง)
  ผลดี: เทาไร้ chroma ไม่ชนกับสีชั้นความลับใน §8.1 (เทา/เหลือง/ส้ม/แดง)
- `shadcn` กลายเป็น **runtime dependency** เพราะ `globals.css` มี `@import "shadcn/tailwind.css"`

คำสั่งที่ใช้จริง:

```bash
pnpm dlx shadcn@latest init -t next -b radix -p nova --css-variables --no-monorepo --no-rtl -y
```

### 6.3 ฟอนต์ไทย

- spec §10.2 บังคับ self-host ไม่พึ่ง CDN (เพราะ deploy on-premise)
- ใช้ **IBM Plex Sans Thai** ดึงไฟล์จาก `@fontsource/ibm-plex-sans-thai` (devDependency ไว้อ้างอิงที่มา)
  แล้ว**คัดลอก `.woff2` เข้า `src/app/fonts/`** → ต่อผ่าน `next/font/local`
  ผลคือ **Docker build ไม่ต้องต่อเน็ตโหลดฟอนต์** (ยืนยันแล้วว่า build ใน container ผ่าน)
- แต่ละน้ำหนักมี 2 subset (thai + latin) รวม 8 ไฟล์ ≈ 120KB · น้ำหนัก 400/500/600/700
- ผูกกับ CSS variable `--font-sans` ซึ่ง Tailwind token `font-sans` ชี้อยู่แล้ว
- `--font-mono` เดิมชี้ Geist Mono ที่ถอดออก → เปลี่ยนเป็น system mono stack

### 6.4 Prisma 7 — breaking changes

สำคัญที่สุดของขั้นก่อน ต่างจาก Prisma 6 ชัดเจน:

1. **`url = env("DATABASE_URL")` ใช้ใน `schema.prisma` ไม่ได้แล้ว**
   → ย้ายไป `prisma.config.ts` ที่ `datasource.url` (ใช้เฉพาะฝั่ง CLI)

2. **runtime client ต้องใช้ driver adapter**
   → ติดตั้ง `@prisma/adapter-pg` + `pg` และส่ง connection string ใน `src/lib/db.ts`

   ```ts
   new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
   ```

3. generator เปลี่ยนเป็น `prisma-client` (ไม่ใช่ `prisma-client-js`) และ **บังคับระบุ `output`**
   → generate ออกมาเป็นไฟล์ `.ts` ที่ `src/generated/prisma/`

4. seed command ย้ายไปอยู่ใน `prisma.config.ts` ที่ `migrations.seed` (ไม่ใช่ `package.json`)

5. `prisma init` **แถม agent skills มาให้โดยไม่ได้ขอ**:
   `.claude/skills/` · `.windsurf/skills/` · `.agents/skills/` · `skills-lock.json` (9 skills)
   → **ยังไม่ได้ตัดสินใจว่าจะเก็บหรือลบ** (ดู §8)

6. `prisma.config.ts` อ่าน `DATABASE_URL` ตั้งแต่ตอน **`prisma generate`** ไม่ใช่แค่ตอน migrate
   → ตอน build image ต้องมีค่าตัวแปรนี้อยู่ (ใส่ค่าปลอมไว้ใน stage build แล้วล้างทิ้งใน runner)

### 6.5 pnpm 11

- บล็อก postinstall script โดยอัตโนมัติ → ต้องอนุญาตใน `pnpm-workspace.yaml`

  ```yaml
  allowBuilds:
    "@prisma/engines": true
    esbuild: true
    prisma: true
  ```

### 6.6 .gitignore

- `.env*` กลืน `.env.example` ไปด้วย → เพิ่ม `!.env.example` ท้ายไฟล์
- `src/generated/prisma` ถูก ignore → เพิ่ม `postinstall: prisma generate` ให้ CI/Docker generate เอง

### 6.7 Docker + pnpm + Next standalone — กับดักที่เสียเวลาที่สุดของขั้นนี้

**อาการ:** `docker compose --profile prod up` แล้ว container `app` restart วนไม่หยุด

```
Error: Cannot find module
  '/app/node_modules/.pnpm/next@16.3.1_.../node_modules/@swc/helpers/esm/_interop_require_default.js'
```

**สาเหตุ:** output file tracing ของ Next เดินตาม symlink ของ pnpm ไม่ครบ —
`.next/standalone` ได้ `@swc/helpers` มาที่ระดับบนสุด แต่ `next` เป็น symlink ชี้เข้า
`.pnpm/next@.../node_modules/next` ทำให้ Node ไล่หา `@swc/helpers` ในพาธใต้ `.pnpm/`
ซึ่งไม่ถูกคัดลอกมาด้วย

**ทางแก้:** สั่ง pnpm ติดตั้งแบบ flat เฉพาะใน image — เพิ่ม `nodeLinker: hoisted`
ต่อท้าย `pnpm-workspace.yaml` ก่อน `pnpm install`

**กับดักซ้อนที่ทำให้ทางแก้ไม่ได้ผลรอบแรก:** stage `builder` ทำ `COPY . .`
ซึ่ง**ทับ `pnpm-workspace.yaml` กลับเป็นฉบับเดิม** พอเรียก `pnpm exec` / `pnpm run`
pnpm เห็นว่า `node_modules` ไม่ตรงกับ config เลย**ติดตั้งใหม่กลับเป็น layout แบบ symlink**
→ ต้องเติม `nodeLinker: hoisted` **ซ้ำอีกครั้งหลัง `COPY . .`**

> ⚠️ ถ้าวันหลังแก้ Dockerfile แล้ว app พังตอนบูตด้วย MODULE_NOT_FOUND ให้ดูตรงนี้ก่อน
> วิธีตรวจเร็ว: `docker build --target builder -t chk . && docker run --rm chk ls -la node_modules/next`
> ต้องเป็น**ไดเรกทอรีจริง ไม่ใช่ symlink**

### 6.8 อย่างอื่นในขั้น Docker Compose

- **`docker compose` แทนค่าตัวแปรทั้งไฟล์เสมอ ไม่สนใจ profile** — ใช้ `${VAR:?ข้อความ}`
  กับ service ที่อยู่ใน profile `prod` ไม่ได้ เพราะโหมด dev (`docker compose up -d` เอา postgres
  อย่างเดียว) จะ error ตามไปด้วย → เปลี่ยนเป็น `${VAR:-}` แล้วไปบังคับตรวจตอนสตาร์ทแอปแทน (P1/P3)
- **`proxyClientMaxBodySize` ไม่ใช่ตัวคุมขนาด upload** — มันคุม body ที่ `proxy.ts` buffer ไว้
  ตัวที่ต้องตั้งคือ `experimental.serverActions.bodySizeLimit` (ค่าปริยาย **1MB**)
  ตั้งเป็น `52mb` ให้รับไฟล์ 50MB ตาม spec §8.3 ได้ · nginx ตั้ง `client_max_body_size 55m` ครอบอีกชั้น
- **`proxy_set_header Connection "upgrade"` แบบตายตัวทำ keepalive พัง** — ต้องใช้ `map`
  แปลง `$http_upgrade` เป็น `$connection_upgrade` ให้ request ธรรมดาได้ค่า `close`
- extension `pg_trgm` / `unaccent` **ไม่ต้องมี init script ใน compose** — Prisma จัดการให้ผ่าน
  `previewFeatures = ["postgresqlExtensions"]` แล้ว migration แรกออกมาเป็น `CREATE EXTENSION IF NOT EXISTS`

### 6.9 การรองรับภาษาไทยฝั่ง PostgreSQL

**ปัญหา:** `postgres:16-alpine` ตั้ง `LANG=en_US.utf8` มาให้ แต่ **musl ของ alpine ไม่มี
collation จริง** — `en_US.utf8` จึงเรียงตามลำดับ byte เฉย ๆ ผลคือ**สระหน้า (เ แ โ ใ ไ)
ซึ่งเขียนนำหน้าพยัญชนะ ถูกจัดไปกองท้ายตาราง** แทนที่จะเรียงตามพยัญชนะที่ตามมา

```
ก่อนแก้ (byte order)   กา · ขา · ครุย · เก · เข · เคย · ไก่      ← ผิด
หลังแก้ (ICU th-TH)    กา · เก · ไก่ · ขา · เข · ครุย · เคย      ← ถูกตามพจนานุกรม
```

**ทางแก้:** ตั้ง locale provider เป็น ICU ตอน `initdb`

```yaml
POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale-provider=icu --icu-locale=th-TH"
```

- image `postgres:16-alpine` compile มาพร้อม `--with-icu` อยู่แล้ว (มี collation ICU 908 ตัว
  รวม `th-TH-x-icu`) จึงไม่ต้องเปลี่ยน image
- ได้ `datlocprovider = i` · `daticulocale = th-TH` → `ORDER BY` บนคอลัมน์ text
  เรียงไทยถูกโดย**ไม่ต้องเขียน `COLLATE` ในทุก query** ซึ่งสำคัญมากเพราะ Prisma
  ไม่มีทางใส่ `COLLATE` ใน `orderBy` ได้ตรง ๆ
- `datcollate` ยังโชว์ `en_US.utf8` อยู่ — **ปกติ** เพราะเป็นค่า libc ที่ไม่ถูกใช้แล้วเมื่อ provider เป็น ICU

> ⚠️ **`initdb` อ่านค่านี้ครั้งเดียวตอนสร้าง cluster** — เปลี่ยนทีหลังบน dev ต้อง
> `docker compose down && docker volume rm esaraban_postgres-data && docker compose up -d`
> บน production ต้อง `pg_dump` → สร้าง cluster ใหม่ → restore
> `prisma/seed.ts` จึง **assert ค่านี้ทุกครั้ง** กันคนเผลอใช้ volume เก่าแล้วไม่มีอะไรเตือน

**ตรวจแล้วว่าไม่กระทบของเดิม:** `pg_trgm` (`similarity()` = 0.6875), `unaccent`,
`LIKE`, `ILIKE`, `upper()` ทำงานปกติทั้งหมด

**ข้อจำกัดที่เหลือ — ต้องจัดการตอน P2 (โมดูลค้นหา):**

| เรื่อง | รายละเอียด |
|---|---|
| `unaccent` ไม่ตัดวรรณยุกต์ไทย | `unaccent('เก่า')` = `'เก่า'` (dictionary มาตรฐานรู้จักแค่ diacritic ของ Latin) → ถ้าอยากให้ค้น "เกา" เจอ "เก่า" ต้องทำ rules file เอง |
| index สำหรับ `LIKE 'ก%'` | พอ collation ไม่ใช่ `C` แล้ว B-tree ธรรมดาใช้เร่ง prefix ไม่ได้ ต้องใช้ `text_pattern_ops` (หรือพึ่ง GIN ของ pg_trgm ตาม spec §9.2 ซึ่งไม่ขึ้นกับ collation) |
| ค้นแบบไม่สนตัวพิมพ์/วรรณยุกต์ | ทำได้ด้วย collation แบบ non-deterministic (`und-u-ks-level1`) แต่ PostgreSQL **ห้ามใช้ `LIKE` และ pg_trgm กับ collation แบบนั้น** → ถ้าจะใช้ ต้องแยกเป็นคอลัมน์ต่างหาก ไม่ใช่คอลัมน์ที่ค้นหา |
| ICU version upgrade | เปลี่ยนเวอร์ชัน ICU ของ image เมื่อไร ต้อง `REINDEX` index ที่อิง collation — ตรึงเวอร์ชัน image ไว้ อย่าใช้ tag ลอย |

### 6.10 ESLint / Prettier

**แบ่งหน้าที่:** Prettier เป็นเจ้าของ "รูปแบบ" · ESLint เป็นเจ้าของ "ความถูกต้อง"
`eslint-config-prettier/flat` วางไว้**หลัง** config อื่นทั้งหมด เพื่อปิด rule จัดรูปแบบที่ชนกัน

**เรื่องกติกาห้าม semicolon — ตั้งซ้ำสองที่โดยตั้งใจ**

| ตัวไหน | ทำอะไร |
|---|---|
| `.prettierrc.json` → `"semi": false` | ตัวจัดรูปแบบจริง — `pnpm format` ลบให้หมด |
| `eslint.config.mjs` → `"@stylistic/semi": ["error", "never"]` | ให้ `pnpm lint` (และ CI) ฟ้องได้เอง ไม่ต้องรอ `format:check` · `pnpm lint:fix` ลบให้ได้ |

- rule นี้ต้องประกาศ**หลัง** `prettier` ใน array ไม่งั้นจะถูก `eslint-config-prettier` ปิดทิ้ง
- **ใช้ `@stylistic/semi` ไม่ใช่ rule `semi` ที่มากับ ESLint** — ตัวที่มากับ ESLint รู้จักแต่ไวยากรณ์ JS
  เจอ syntax เฉพาะของ TS (`interface`, index signature, `declare`) แล้วรายงานผิด
  ส่วน rule จัดรูปแบบใน core ก็ถูก deprecate ไปอยู่ `@stylistic` หมดแล้ว
- ทดสอบแล้ว: ใส่ `;` ในไฟล์ที่มี `interface` + `declare` → ฟ้อง **เฉพาะจุดที่ผิดจริง** จุดเดียว
  และ `eslint --fix` ลบออกให้ถูกต้อง

**`printWidth: 100`** — เลือกจากของจริง ไม่ใช่ค่ามาตรฐาน: โค้ดที่เขียนมือไว้ยาวสุด 98 ตัวอักษร
ถ้าใช้ 80 หรือ 90 array ฟอนต์ใน `layout.tsx` จะแตกจาก 8 บรรทัดเป็น 40 บรรทัดโดยไม่ได้อะไรกลับมา

**`prettier-plugin-tailwindcss`** — เรียงลำดับ class ของ Tailwind ให้อัตโนมัติ
Tailwind v4 ไม่มี `tailwind.config` แล้ว จึงต้องชี้ที่ stylesheet แทน:
`"tailwindStylesheet": "./src/app/globals.css"`

**`.gitattributes` — จำเป็น ไม่ใช่ของแถม**

เครื่อง dev ตั้ง `core.autocrlf=true` ไว้ ถ้าไม่มีไฟล์นี้ git จะแปลงเป็น CRLF ตอน checkout
ชนกับ `"endOfLine": "lf"` ของ Prettier → **`pnpm format:check` จะฟ้องทุกไฟล์ทั้งที่ไม่มีใครแก้อะไร**
(จะเจอตอนตั้ง CI พอดี) แก้ด้วย `* text=auto eol=lf` + ประกาศ `binary` ให้ `.woff2` และรูปภาพ

**`*.md` อยู่ใน `.prettierignore`** — เอกสารเป็นภาษาไทยและมีตารางเยอะ
Prettier คำนวณความกว้างอักษรไทยผิดแล้วจัดตารางเพี้ยน จึงปล่อยให้จัดมือ

### 6.11 โครงโฟลเดอร์ §11.2 — เกณฑ์ว่าอะไร "เขียนเลย" อะไร "รอ"

โฟลเดอร์เปล่า git ไม่เก็บให้ ทุกโฟลเดอร์จึงต้องมีไฟล์จริง คำถามคือควรใส่อะไร
เกณฑ์ที่ใช้: **เขียนโค้ดเฉพาะสิ่งที่ spec กำหนดไว้ครบแล้วและไม่ต้องรอ dependency**
ที่เหลือใส่ `README.md` สั้น ๆ บอกว่าโฟลเดอร์นี้ไว้ทำอะไรและเฟสไหนมาเติม
— ไม่เขียน stub ที่เดาเอาไว้ก่อน เพราะโค้ดเดาผิดลบยากกว่าโฟลเดอร์ว่าง

**เขียนโค้ดจริงแล้ว**

| ที่ | เพราะ |
|---|---|
| `lib/thai/` | spec §10.2 บอกชัด "แสดง พ.ศ. เสมอ" · เป็น pure function ไม่ผูกกับอะไร |
| `lib/authz/permissions.ts` | ตาราง §4.2 ระบุรหัสสิทธิ์ครบทุกตัวแล้ว |
| `lib/storage/` · `lib/notification/` | spec §11.3 ข้อ 3 **บังคับให้เป็น interface ตั้งแต่วันแรก** |
| `server/context.ts` | spec §11.3 ข้อ 2 กำหนดรูปร่าง `ctx` ไว้แล้ว |
| `constants/` | spec §12 สั่งแยกข้อความออกจาก component |

**ใส่ README ไว้ก่อน:** `server/{actions,services,repositories}/` · `lib/{auth,crypto,audit}/` ·
`schemas/` — ทั้งหมดต้องรอ schema ของ P1 หรือ package ที่ยังไม่ได้ติดตั้ง
(`zod`, `jose`, `argon2`)

**ตั้งใจไม่สร้าง route group ของ `src/app/`** — `(auth)/` `(app)/` ไม่มีผลอะไรถ้าไม่มี
`page.tsx` และ `api/files/[attachmentId]/route.ts` ถ้าสร้างไว้เปล่า ๆ จะกลายเป็น
**endpoint ที่เปิดอยู่จริงแต่ยังไม่มีการตรวจสิทธิ์** ซึ่งอันตรายกว่าไม่มี
→ สร้างพร้อมของจริงใน P1 / P3

**เรื่องที่ต่างจาก spec เล็กน้อย**

- เพิ่ม `src/constants/` ซึ่ง**ไม่มีในผัง §11.2** แต่ §12 สั่งให้มี constants file
  วางไว้ระดับ `src/` ไม่ใช่ `src/lib/` เพราะเป็นข้อมูลล้วน ไม่มี logic
- `ServiceContext` เพิ่ม `tenantId` (จาก §11.3 ข้อ 4) และ `clearanceLevel` (จาก §8.1)
  นอกเหนือจาก 3 ฟิลด์ที่ §11.3 ข้อ 2 เขียนไว้ — ทั้งคู่จำเป็นในทุก query อยู่แล้ว
- **ยังไม่ทำ renderer ของ pattern เลขหนังสือ** (`{unitCode}/{seq:4}`) ทั้งที่ §11.2
  จัดให้อยู่ใน `lib/thai/` เพราะ pattern อ่านจากตาราง `NumberSequence` ที่ยังไม่มี
  และเป็นจุดที่ spec §7.3 ทำเครื่องหมาย ⚠️ Critical ไว้ → ทำใน P2 พร้อม test

**ตรวจแล้วว่า timezone ไม่หลุด** — จุดที่พังง่ายที่สุดของ `lib/thai/`
container รันด้วย `TZ=UTC` ถ้าไม่ตรึงโซนเวลา เอกสารที่สร้างหลัง 19:00 น. จะกลายเป็นวันถัดไป
ทดสอบด้วยเวลาที่ข้ามเที่ยงคืนและข้ามปีจริง (`TZ=UTC`):

```
22 ส.ค. 17:30 UTC  ->  23 ส.ค. 2569 00:30   (ไม่ใช่ 22 ส.ค.)
31 ธ.ค. 17:30 UTC  ->  1 ม.ค. 2570 00:30 · getBuddhistYear = 2570
```

ข้อหลังสำคัญเป็นพิเศษ เพราะปี พ.ศ. คือส่วนหนึ่งของคีย์ที่ใช้รีเซ็ตเลขทะเบียน (spec §7.2)
ถ้าคำนวณผิดหนึ่งวัน เลขทะเบียนต้นปีจะไปต่อท้ายปีเก่า

**ยืนยันแล้วว่า `node:24-alpine` มี full ICU** (ไม่ใช่ small-icu) — ถ้าเป็น small
`Intl` จะ fallback เป็นอังกฤษเงียบ ๆ วันที่ไทยจะเพี้ยนเฉพาะตอน production เท่านั้น

### 6.12 CI — ข้ามตามคำสั่ง

ผู้ใช้สั่งข้ามขั้นที่ 7 เมื่อ **22 สิงหาคม 2569** จึง**ยังไม่มี** GitHub Actions workflow
และ**ยังไม่ได้ติดตั้ง Vitest**

**สิ่งที่ยังตรวจได้ตามปกติ** — คำสั่งพร้อมใช้อยู่แล้ว แค่ต้องรันเอง ไม่มีอะไรบังคับ:

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm build
```

**สิ่งที่หายไปเพราะข้ามขั้นนี้**

| เรื่อง | ผลกระทบ |
|---|---|
| ไม่มีตัวบังคับก่อน merge | กติกาห้าม semicolon / format ยังต้องอาศัยวินัยคนรันเอง |
| **ยังไม่มี test runner** | เป็นตัวบล็อกจริงตั้งแต่ **P1** ขึ้นไป ไม่ใช่แค่เรื่อง CI |

> ⚠️ **test runner ไม่ใช่เรื่องของ CI อย่างเดียว** — spec §13 ตั้ง Definition of Done ไว้ว่า
> P1 ต้องมี "unit test ของ `can()` ครอบทุก scope" และ P2 ต้องผ่าน
> "ยิง `issueNumber` 50 ครั้งพร้อมกัน → ได้เลข 1–50 ครบ ไม่ซ้ำ ไม่ข้าม" (§14 ทำเครื่องหมาย ⚠️ Critical)
> ทั้งสองข้อปิดไม่ได้ถ้าไม่มี Vitest → **ต้องติดตั้งตอนเริ่ม P1 อยู่ดี** แม้จะไม่ทำ CI ก็ตาม

ถ้าจะกลับมาทำ CI ภายหลัง งานที่เหลือคือไฟล์ workflow ไฟล์เดียวที่รัน 4 คำสั่งข้างบน
+ `pnpm test` — ของอย่างอื่นพร้อมหมดแล้ว (lockfile · `postinstall: prisma generate` ·
`format:check` · Dockerfile ที่ build ผ่าน)

---

## 7. ตัวบล็อกที่ค้างอยู่

**ไม่มี** — Docker Desktop ติดตั้งแล้ว ตัวบล็อกเดิมของ P0 ถูกปลดครบ

---

## 8. เรื่องที่รอการตัดสินใจ

| # | เรื่อง | ตัวเลือก |
|---|-------|---------|
| 1 | ~~agent skills ที่ Prisma แถมมา~~ | ✅ **gitignore ทั้ง 3 ชุด** (22 ส.ค. 2569) — ไฟล์ยังอยู่ในเครื่อง ใช้งานได้ปกติ แต่ไม่เข้า git · ระบุเจาะจงที่ `skills/` ไม่ใช่ทั้งโฟลเดอร์ เผื่อวันหลังจะ commit `.claude/settings.json` |
| 2 | ~~ติดตั้ง Docker Desktop~~ | ✅ ทำแล้ว |
| 3 | **base color `neutral`** | เก็บไว้ / เปลี่ยนเป็นโทน slate อมฟ้า |
| 4 | **`public/*.svg` ของ Next** | ลบเมื่อไร (next.svg, vercel.svg, file.svg, globe.svg, window.svg) |
| 5 | **`AGENTS.md` / `CLAUDE.md`** | template ของ Next 16 — ยังไม่ได้แก้ให้ตรงกับโปรเจกต์ |
| 6 | ~~metadata ยัง hardcode~~ | ✅ ย้ายไป `src/constants/app.ts` แล้ว — `layout.tsx` อ้างจากที่นั่น |
| 7 | ~~ICU collation ภาษาไทยของ Postgres~~ | ✅ ทำแล้ว — ดู §6.9 |
| 8 | **endpoint `/api/health`** | ตอนนี้ healthcheck ของ container ยิง `/` ซึ่งเป็นหน้า render จริง — ควรทำ endpoint เบา ๆ ตอน P1 |
| 9 | **default password ใน `docker-compose.yml`** | `${POSTGRES_PASSWORD:-esaraban_dev_password}` ทำให้ dev รันได้ทันทีโดยไม่ต้องตั้ง `.env` แต่ถ้าขึ้น production แล้วลืมสร้าง `.env` จะได้รหัสผ่านที่รู้กันทั้ง repo → **ก่อน deploy จริงต้องตัด fallback ทิ้ง** ให้ compose fail ถ้าไม่มีค่า |

---

## 9. คำถามค้างจาก spec §15 (ต้องเคลียร์ก่อน P2)

ยังไม่มีข้อไหนได้คำตอบ · ที่กระทบใกล้ตัวที่สุด:

| # | คำถาม | กระทบขั้นไหน |
|---|-------|-------------|
| 7 | สเปกเซิร์ฟเวอร์ on-premise + TLS cert | **ยังค้าง** — เขียน compose/nginx ด้วยค่ามาตรฐานไปก่อนแล้ว · block HTTPS คอมเมนต์รออยู่ใน `docker/nginx/conf.d/default.conf` |
| 3 | ผังหน่วยงานจริง + รหัสหนังสือ | seed data ของ P1 |
| 5 | ปีที่ใช้รีเซ็ตเลข (ปีงบ / ปีปฏิทิน) | P2 — เปลี่ยนทีหลังทำให้เลขทะเบียนไม่ต่อเนื่อง |
| 2 | ตัวอย่างเลขหนังสือจริง 3–5 แบบ | P2 — ผิดแล้วต้องแก้เอกสารที่ออกเลขไปแล้ว |
| 6 | นโยบายเอกสารลับ | P3 |
| 4 | รูปแบบทะเบียนที่ต้อง export | P4 |
| 1 | ยืนยัน A1 (โมดูลหนังสือรับ) | ขอบเขต P5 |

---

## 10. แผนงานถัดไป

**P0 ปิดแล้ว** (ขั้นที่ 7 ข้ามตามคำสั่ง — ดู §6.12) ถัดไปคือ **P1 — Identity & Org**
ประมาณการ 2–3 สัปดาห์ · Definition of Done ตาม spec §13:
*"Admin สร้างโครงสร้าง 3 ระดับ + ผู้ใช้ 2 สังกัด แล้วสลับ context ได้ ·
unit test ของ `can()` ครอบทุก scope"*

ขอบเขต P1: Auth (login/logout/เปลี่ยนรหัส/lockout) · Session table · OrgUnit CRUD +
tree UI + materialized path · User CRUD + multi-affiliation · Role/Permission + `can()` ·
Context Switcher · Audit เบื้องต้น

### ของที่ต้องเคลียร์ก่อนเริ่ม P1

| # | เรื่อง | หมายเหตุ |
|---|-------|---------|
| 1 | **ติดตั้ง Vitest** | DoD ของ P1 บังคับให้มี unit test ของ `can()` — ปิดไม่ได้ถ้าไม่มี (ดู §6.12) |
| 2 | ติดตั้ง `zod` · `jose` · `argon2` | spec §11.1 · โฟลเดอร์ `src/schemas/` และ `src/lib/auth/` รออยู่แล้ว |
| 3 | **คำถาม §15 ข้อ 3** — ผังหน่วยงานจริง + รหัสหนังสือ | ต้องใช้เป็น seed data ของ P1 |
| 4 | ตัดสินใจเรื่องค้างใน §8 (ข้อ 1, 3, 4, 5, 8) | ไม่บล็อก แต่ยิ่งทิ้งไว้ยิ่งแก้ยาก |
| 5 | **commit งาน P0** | ยังไม่เคย commit เลย — repo มีแต่ initial commit ของ template |

### ยังไม่ได้ทำ เพราะยังไม่ถึงเวลา

- **pre-commit hook** (husky + lint-staged) — ทำพร้อม CI เมื่อกลับมาทำ
- **ตั้งค่า format-on-save ของ editor** — ยังไม่รู้ว่าทีมใช้ VS Code หรือ Windsurf
  (ในโปรเจกต์มีทั้ง `.claude/` และ `.windsurf/`) ระหว่างนี้ใช้ `pnpm format` เอาก่อน

### ลำดับที่แนะนำสำหรับ P1

เรียงตามการพึ่งพากัน — ทำสลับลำดับจะติดกันเอง

| ลำดับ | งาน | หมายเหตุ |
|:--:|---|---|
| 1 | ติดตั้ง Vitest + `zod` `jose` `argon2` | เขียน test ชุดแรกให้ `src/lib/thai/` ทันที (มีโค้ดจริงรออยู่แล้ว · เคสสำคัญคือข้ามเที่ยงคืน / ข้ามปี พ.ศ. ตาม §6.11) |
| 2 | **ออกแบบ schema §9** ลง `prisma/schema.prisma` | Tenant · OrgUnit (materialized path) · User · UserOrgRole · Role · Permission · Session · AuditLog · ใส่ `tenantId` ทุกตารางตั้งแต่วันแรก (§11.3 ข้อ 4) |
| 3 | migration + seed จริง | permissions ทั้ง 22 รหัสจาก `src/lib/authz` · role→permission matrix ตาม §4.2 · org tree ตัวอย่าง · admin คนแรก · **ต้องได้คำตอบ §15 ข้อ 3 ก่อน** ไม่งั้น seed จะต้องรื้อ |
| 4 | `src/lib/auth/` | argon2 + session table + jose · lockout ตาม §8.4 |
| 5 | `src/lib/authz/can()` + scope resolver | **จุดที่ต้องมี unit test ครอบทุก scope** (OWN / UNIT / SUBTREE / ORG) — เป็น DoD ของ P1 |
| 6 | `src/server/{repositories,services,actions}/` ชุดแรก | ตามกติกา §11.3: action บาง · service หนา · ตรวจสิทธิ์ที่ service |
| 7 | UI — `(auth)/login` · `(app)/` layout + Context Switcher · `/admin/org-units` · `/admin/users` | ตอนนี้ค่อยสร้าง route group (§6.11) · ข้อความไทยลง `src/constants/` ห้ามเขียนใน component |
| 8 | audit เบื้องต้น | เขียนใน transaction เดียวกับงานหลักตั้งแต่ตัวแรก (§11.3 ข้อ 5) — ย้อนกลับมาใส่ทีหลังยาก |

### สิ่งที่วางรากไว้ให้ P1 แล้ว — อย่าสร้างซ้ำ

| มีอยู่แล้วที่ | ใช้ทำอะไร |
|---|---|
| `src/lib/authz/permissions.ts` | `PERMISSIONS` ครบ 22 รหัส · `PERMISSION_SCOPES` · `ROLE_CODES` — seed อ่านจากที่นี่ |
| `src/server/context.ts` | `ServiceContext` — service ทุกตัวรับเป็น argument แรก |
| `src/lib/thai/` | `formatThaiDate` · `getBuddhistYear` (ใช้ตอนรีเซ็ตเลขทะเบียน) · เลขไทย |
| `src/constants/` | `APP_NAME` · `CONFIDENTIALITY_LEVELS` · `URGENCY_LEVELS` · `ROLE_LABELS` |
| `src/lib/storage/` · `src/lib/notification/` | interface พร้อมแล้ว — P1 ยังไม่ต้องแตะ แต่ห้ามข้ามไป import ตรง |
| `src/lib/db.ts` | PrismaClient singleton + driver adapter — อย่าสร้าง client ใหม่ที่อื่น |

---

## 11. วิธีรันและทดสอบ — baseline ที่ยืนยันแล้ว

ทดสอบครั้งล่าสุด **22 สิงหาคม 2569** ผ่านทั้งหมด · ตัวเลขข้างล่างใช้เทียบได้ว่าอะไรถดถอย

### 11.1 โหมด dev (ใช้ทุกวัน)

```bash
docker compose up -d     # postgres อย่างเดียว
pnpm dev                 # http://localhost:3000
```

| จุดตรวจ | ผลที่ควรได้ |
|---|---|
| สตาร์ท | `✓ Ready in ~0.9s` (Turbopack) · บรรทัด `- Environments: .env` ต้องขึ้น |
| `GET /` | 200 · ~22.7KB · `lang="th"` · `<title>ระบบสารบรรณอิเล็กทรอนิกส์</title>` |
| เส้นทางที่ไม่มี | 404 |
| CSS · ฟอนต์ `.woff2` | 200 · `text/css` / `font/woff2` — เสิร์ฟจากเครื่อง ไม่ต่อ CDN |
| `pnpm db:seed` | ✔ เชื่อมต่อ · ✔ collation ICU th-TH · ✔ extension ครบ |

### 11.2 โหมด production

```bash
docker compose --profile prod up -d     # http://localhost/
```

| จุดตรวจ | ผลที่ควรได้ |
|---|---|
| ลำดับสตาร์ท | postgres healthy → migrate `Exited (0)` → app healthy → nginx |
| `GET /` ผ่าน nginx | 200 · ~16ms · 18.8KB |
| security header | `X-Content-Type-Options` · `X-Frame-Options: DENY` · `Referrer-Policy` |
| gzip | 22.7KB → **3.6KB** (`curl -H "Accept-Encoding: gzip"`) |
| หน้าตา | ต้องเหมือน dev ทุกประการ |

### 11.3 ดูหน้าจอจริง (ไม่ต้องติดตั้ง Playwright)

เครื่องนี้มี Chrome อยู่แล้ว ใช้โหมด headless ถ่ายภาพได้เลย —
สำคัญเพราะ **หน้า smoke test มีไว้ตรวจฟอนต์ไทยโดยเฉพาะ** ดูแต่ HTML ไม่พอ

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless=new --disable-gpu --hide-scrollbars --window-size=1280,900 \
  --screenshot="ที่เก็บ/home.png" --virtual-time-budget=6000 \
  http://localhost:3000/
```

สิ่งที่ต้องเห็นในภาพ: หัวเรื่องไทย · น้ำหนักฟอนต์ต่างกันชัด 4 ระดับ (400/500/600/700) ·
เลขไทย ๑๒๓๔๕๖๗๘๙๐ · หางสระและวรรณยุกต์ไม่ทับกัน · ปุ่ม shadcn 4 แบบ

### 11.4 ตรวจคุณภาพโค้ด

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm build
```

ทั้ง 4 ต้องผ่านโดยไม่มี warning · `pnpm build` ได้ 4 static pages
(ยังไม่มี CI คอยบังคับ — ต้องรันเอง ดู §6.12)

### 11.5 กับดักตอนทดสอบบน Git Bash

ยิง `curl http://localhost:3000/ไม่มีหน้านี้` แล้วได้ **200** ทั้งที่ควรเป็น 404
— **ไม่ใช่บั๊กของแอป** Git Bash แปลงอักษรไทยเป็น `????????????` แล้ว `?` ตัวแรก
กลายเป็นจุดเริ่ม query string จึงเท่ากับขอหน้าแรก
ทดสอบ path ภาษาไทยต้อง **percent-encode เอง** ถึงจะได้ 404 ตามจริง
