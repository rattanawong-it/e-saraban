# สถานะการพัฒนา e-Saraban

> เอกสารติดตามความคืบหน้า — คู่กับ [spec.md](./spec.md)
> อัปเดตล่าสุด: **25 สิงหาคม 2569** · เฟสปัจจุบัน: **P0 · P1 ปิดแล้ว · ถัดไปคือ P2 — Core Documents**

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

## 1B. สรุปสถานะ P1 — Identity & Org

Checklist ตาม spec §13 · ประมาณการ 2–3 สัปดาห์ · **ปิดแล้ว 24 สิงหาคม 2569**

| # | งาน | สถานะ |
|---|-----|:---:|
| 1 | Auth — login / logout / เปลี่ยนรหัสผ่าน / lockout | ✅ เสร็จ |
| 2 | ตาราง `Session` + JWT ใน cookie (revoke ได้จริง) | ✅ เสร็จ |
| 3 | OrgUnit CRUD + tree UI + materialized path | ✅ เสร็จ |
| 4 | User CRUD + สังกัดหลายหน่วยงาน | ✅ เสร็จ |
| 5 | Role / Permission + `can()` | ✅ เสร็จ · unit test 33 เคส |
| 6 | Context Switcher | ✅ เสร็จ |
| 7 | Audit เบื้องต้น | ✅ เสร็จ · **ทำ hash chain ครบตั้งแต่ P1 เลย** (เดิมวางไว้ P3) |

**Definition of Done ของ P1: ✅ ปิดครบแล้ว**

| เกณฑ์ | ผล |
|---|---|
| Admin สร้างโครงสร้าง 3 ระดับ | ✅ seed สร้างผัง 11 หน่วย ลึก 3 ระดับ · เพิ่ม/แก้/ย้าย/เก็บถาวรผ่าน UI ได้ |
| ผู้ใช้ 2 สังกัด สลับ context ได้ | ✅ `rattana.wong` สังกัดคณะวิศวฯ (ธุรการหน่วยงาน) + ศูนย์คอมพิวเตอร์ (ผู้ใช้ทั่วไป) |
| unit test ของ `can()` ครอบทุก scope | ✅ 33 เคส ครอบ OWN / UNIT / SUBTREE / ORG และครบทั้ง 6 ด่านของ §4.3 |
| `pnpm lint` / `format:check` / `typecheck` / `build` | ✅ ผ่านทั้งหมด ไม่มี warning |
| `pnpm test` | ✅ 41 เคสผ่าน (can() 33 + lib/thai 8) |

### สิ่งที่ทำเกินขอบเขต P1 (และเหตุผล)

| เรื่อง | ทำไมทำตั้งแต่ตอนนี้ |
|---|---|
| **Audit hash chain** (เดิมอยู่ P3) | ย้อนกลับไปใส่ทีหลังไม่ได้ — แถวที่เขียนไปแล้วก่อนมี chain จะพิสูจน์ย้อนหลังไม่ได้ตลอดไป |
| **บังคับ append-only ที่ระดับ DB** | spec §8.5 เขียนว่า "บังคับที่ระดับฐานข้อมูล" ทำพร้อม migration แรกของตารางง่ายกว่ามาก |
| **หน้า `/admin/audit` เต็มรูปแบบ** | มีข้อมูลให้ดูตั้งแต่ P1 อยู่แล้ว (login · จัดการผู้ใช้ · เปลี่ยนสิทธิ์) ปล่อยไว้เฉย ๆ ไม่ได้ประโยชน์ |
| **หน้า `/register` + `/forgot-password`** | มีในดีไซน์ที่ผู้ใช้ส่งมา และเป็นงานฝั่ง Identity ล้วน — อยู่ใน P1 ตามธรรมชาติ |

---

## 1C. สิ่งที่สร้างขึ้นใน P1

### ฐานข้อมูล — 12 ตาราง (migration `20260824145213_p1_identity_and_org`)

```
tenants · org_units · users · user_org_units
roles · permissions · role_permissions · user_roles
sessions · audit_logs · system_settings
registration_requests · password_reset_requests
```

migration ที่สอง `20260824150000_audit_append_only` เพิ่ม trigger กัน UPDATE/DELETE บน `audit_logs`

### หน้าจอที่ใช้งานได้จริง

| เส้นทาง | สิทธิ์ที่ต้องมี | หมายเหตุ |
|---|---|---|
| `/login` | — | นับครั้งที่ผิด + lockout แบบ exponential backoff |
| `/register` | — | สร้าง **คำขอ** ไม่ใช่บัญชี — ผู้ดูแลต้องอนุมัติก่อน · ไม่ถามคำนำหน้าและชื่อผู้ใช้ ระบบสร้าง username จากอีเมลให้ (ดู §6.16) |
| `/forgot-password` | — | เข้าคิวให้ผู้ดูแลรีเซ็ตให้ (MVP ไม่มีอีเมล ตาม D10) |
| `/change-password` | ล็อกอินแล้ว | บังคับผ่านหน้านี้ก่อนถ้า `mustChangePassword` |
| `/dashboard` | ล็อกอินแล้ว | สถิติฝั่ง Identity & Org + กิจกรรมล่าสุด |
| `/admin/org-units` | `orgunit.manage` | tree · เพิ่ม · แก้ · ย้าย (เขียน path ใหม่ทั้ง subtree) · เก็บถาวร |
| `/admin/users` | `user.manage` | ค้นหา · เพิ่ม · แก้ · สังกัดหลายหน่วยงาน · รีเซ็ตรหัสผ่าน · ระงับบัญชี · คิวคำขอสมัคร · คิวคำขอรีเซ็ต |
| `/admin/roles` | `role.manage` | แก้สิทธิ์และ scope ของแต่ละบทบาทได้จริง |
| `/admin/audit` | `audit.read` | filter · แบ่งหน้า · ปุ่มตรวจ hash chain · export CSV |
| `/admin/settings` | `setting.manage` | ปีที่รีเซ็ตเลข · ไฟล์แนบ · นโยบายรหัสผ่าน · session/lockout |
| `/api/health` | — | healthcheck ของ container (ปิดข้อค้าง §8 ข้อ 8) |

เมนูอื่นในผัง §10.1 (inbox · outbox · drafts · registry · search · reports · numbering)
สร้างเป็นหน้า "อยู่ระหว่างพัฒนา" พร้อมป้ายบอกเฟส — ดีกว่าปล่อย 404 ให้ผู้ใช้เจอ

### บัญชีตั้งต้นจาก seed

รหัสผ่านทุกบัญชีคือ `Esaraban@2569` (ตั้งผ่าน env `SEED_PASSWORD` ได้) · ทุกบัญชีถูกบังคับเปลี่ยนรหัสผ่านครั้งแรก

| username | บทบาท | สังกัด |
|---|---|---|
| `admin` | ผู้ดูแลระบบ (global) | ศูนย์คอมพิวเตอร์ |
| `registrar` | สารบรรณกลาง | งานสารบรรณกลาง |
| `rattana.wong` | ธุรการหน่วยงาน + ผู้ใช้ทั่วไป | **คณะวิศวฯ + ศูนย์คอมพิวเตอร์ (2 สังกัด)** |
| `dean.eng` | ผู้บริหาร | คณะวิศวกรรมศาสตร์ |
| `somchai.j` | ผู้ใช้ทั่วไป | ภาควิชาวิศวกรรมคอมพิวเตอร์ |

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
9be9046  docs: บันทึกสถานะ git · ลำดับงาน P1 · baseline การรันและทดสอบ
8181f87  P0 Foundation: วางฐานโปรเจกต์ e-Saraban ให้ครบ    <- 60 ไฟล์ · +11,826 / −115
e6b5e1e  Initial commit from Create Next App               <- branch master ค้างอยู่ตรงนี้
```

- งาน P0 ทั้งหมด commit แล้วเมื่อ **22 ส.ค. 2569**
- **remote:** <https://github.com/rattanawong-it/e-saraban> · **repo เป็น public**
- local branch **`p0-foundation`** track อยู่กับ **`origin/main`**
  (push ด้วย `git push -u origin p0-foundation:main` เพราะ default branch ของ GitHub ชื่อ `main`)
- `master` ในเครื่องยังค้างที่ commit ของ template — เป็นบรรพบุรุษของ `main` อยู่แล้ว ไม่มีอะไรหาย
  จะลบทิ้งหรือเปลี่ยนชื่อ local branch เป็น `main` (`git branch -m p0-foundation main`) ก็ได้

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

### 6.13 P1 — ของที่ต่างจาก spec โดยตั้งใจ

| เรื่อง | spec เขียนว่า | ที่ทำจริง | เหตุผล |
|---|---|---|---|
| **ฟอนต์** | IBM Plex Sans Thai หรือ Sarabun (§10.2) | **Anuphan (ไทย) + Inter (อังกฤษ/ตัวเลข)** | ดีไซน์ที่ผู้ใช้ส่งมา (`project-ui/Design System.dc.html`) กำหนดคู่นี้ไว้ · ยัง self-host ผ่าน `@fontsource` ตามข้อบังคับ "ไม่พึ่ง CDN" |
| **สีแบรนด์** | base color `neutral` ของ shadcn (P0) | **เขียว #3F6133 ของมหาวิทยาลัยเกริก** | ดีไซน์กำหนดชุดสีทั้งระบบ รวมสีชั้นความลับ 4 ระดับตาม §8.1 — ปิดข้อค้าง §8 ข้อ 3 |
| **Argon2** | package `argon2` (§11.1) | **`@node-rs/argon2`** | `argon2` ต้อง compile ด้วย node-gyp ตอนติดตั้ง ซึ่งพังง่ายทั้งบน Windows (dev) และ alpine (Docker) · ตัวใหม่เป็น binding ของ Rust มี prebuilt ครบทั้ง `win32-x64` และ `linux-x64-musl` · **อัลกอริทึมเดียวกัน (argon2id) hash เข้ากันได้** |
| **ฟอร์ม** | react-hook-form + Zod (§11.1) | **`useActionState` ของ React 19 + Zod** | ฟอร์มใน P1 ต้องตรวจกับฐานข้อมูลอยู่แล้ว (ชื่อผู้ใช้ซ้ำ · รหัสผ่านถูกไหม) การเพิ่ม state ฝั่ง client ไม่ได้อะไรกลับมา แถมทำให้ฟอร์มใช้ไม่ได้ตอน JS ยังโหลดไม่เสร็จ · **Zod schema ยังเป็นตัวเดียวกันทั้งสองฝั่งตามที่ spec ต้องการ** · ถ้า P2 มีฟอร์มที่ซับซ้อนขึ้น (สร้างหนังสือ + drag-drop ไฟล์) ค่อยเพิ่ม react-hook-form เฉพาะจุดนั้น |
| **ไอคอน** | lucide-react (§11.1) | lucide-react | ดีไซน์ใช้ Hugeicons แต่ spec ระบุ lucide และติดตั้งไว้แล้วตั้งแต่ P0 — รูปทรงใกล้เคียงกัน (stroke rounded 24×24) |
| **ย้ายหน่วยงาน** | "tree view, drag-to-move" (§10.1) | **เลือกหน่วยงานแม่ใหม่จาก dropdown** | การย้ายเขียน `path` ใหม่ทั้ง subtree และกระทบสิทธิ์ SUBTREE ทันที — ลากพลาดครั้งเดียวเสียหายกว่าที่ความสะดวกจะคุ้ม · drag-and-drop บนต้นไม้ยังใช้กับคีย์บอร์ด/screen reader ได้ยาก ซึ่งขัด WCAG 2.1 AA ที่ §12 กำหนด |
| **ลืมรหัสผ่าน** | ดีไซน์วาดขั้นตอน "ส่งลิงก์ทางอีเมล" | **คำขอเข้าคิวให้ผู้ดูแลรีเซ็ตให้** | D10 กำหนดว่า MVP แจ้งเตือน in-app เท่านั้น ไม่มีอีเมล · โครงสร้างในฐานข้อมูลเก็บ TTL 30 นาทีไว้แล้ว เผื่อเปิดใช้อีเมลในอนาคต |
| **สมัครใช้งาน** | ไม่มีในสเปก (มีในดีไซน์) | สร้าง **คำขอ** ไม่ใช่บัญชี | บัญชีที่ยังไม่ผ่านการตรวจสอบต้องไม่มีตัวตนในระบบเลย ไม่ใช่มีอยู่แต่ปิดใช้งาน — กันบัญชีค้างครึ่ง ๆ กลาง ๆ |
| **ชื่อผู้ใช้ตอนสมัคร** | ดีไซน์มีช่อง "ชื่อผู้ใช้ที่ต้องการ" | **สร้างจากอีเมลอัตโนมัติ** | ตามคำสั่งผู้ใช้ (25 ส.ค. 2569) — ยิ่งถามน้อยยิ่งกรอกจบเร็ว · `User.username` ยังเป็นตัวล็อกอินตาม §7.1 เหมือนเดิม ไม่ต้องแก้หน้า `/login` หรือบัญชี seed · รายละเอียดใน §6.16 |
| **ธีมมืด** | ไม่มีในสเปก (มีในดีไซน์) | ทำ · เก็บใน **cookie ไม่ใช่ localStorage** | layout อ่านค่าฝั่ง server ได้เลย จึงไม่ต้องมี inline script (ซึ่ง CSP ตาม §8.4 ห้าม) และไม่มีจอกระพริบตอนโหลด |

### 6.14 P1 — กับดักที่เจอจริงตอนพัฒนา

**1. `pg_advisory_xact_lock()` คืนค่า `void` ที่ driver adapter อ่านไม่ได้**

```
DriverAdapterError: UnsupportedNativeDataType
Failed to deserialize column of type 'void'
```

เขียนเป็น `tx.$queryRaw` แล้วพังทุกครั้งที่เขียน audit — ซึ่งคือ **ทุก mutation ของทั้งระบบ**
ต้องใช้ `tx.$executeRaw` แทน เพราะไม่พยายามถอดรหัสผลลัพธ์ที่คืนมา

> ⚠️ เจอเฉพาะตอนรันจริงกับฐานข้อมูล — typecheck กับ build ผ่านหมด
> เป็นเหตุผลที่ต้องมีสคริปต์ยิงจริงก่อนปิดเฟส ไม่ใช่ดูแค่ว่า build ผ่าน

**2. ส่ง icon component ข้ามขอบเขต Server → Client Component ไม่ได้**

```
Error: Functions cannot be passed directly to Client Components
  {$$typeof: ..., render: function Inbox}
```

`(app)/layout.tsx` (Server Component) กรองเมนูแล้วส่งผัง `NAV_GROUPS` ที่มี `icon: LucideIcon`
เข้าไปใน `AppShell` (Client Component) → ทุกหน้าใต้ `(app)` ขึ้น 500 พร้อมกันหมด

**ทางแก้:** layout ส่งแค่ **รายการรหัสสิทธิ์** (ข้อมูลล้วน) แล้วให้ sidebar ฝั่ง client
`import` ผังเมนูเองและกรองเอง — icon จึงไม่เคยข้ามขอบเขต

**3. seed เขียน `sortOrder` ลงหน่วยงานแม่แทนที่จะเป็นลูก**

```ts
for (const [index, child] of node.children.entries()) {
  await prisma.orgUnit.update({ where: { id: unit.id }, ... })  // ← unit คือ "แม่"
  await walk(child, ...)
}
```

ผลคือผังหน่วยงานเรียงมั่ว (คณะวิทยาศาสตร์ขึ้นก่อนคณะวิศวกรรมศาสตร์)
เห็นได้จากภาพหน้าจอเท่านั้น — ไม่มี test ตัวไหนจับได้ · แก้โดยส่ง `sortOrder` เป็นพารามิเตอร์ของ `walk`

**4. lint ฟ้อง 882 error จาก `project-ui/`**

ไฟล์ดีไซน์ที่ผู้ใช้ส่งมาเป็น artifact ของเครื่องมือ ไม่ใช่ซอร์สของแอป
→ เพิ่ม `project-ui/**` ใน `globalIgnores` ของ ESLint และใน `.prettierignore`

**5. `react-hooks/set-state-in-effect` ของ ESLint 9**

Next 16 เปิด rule นี้เป็น **error** ไม่ใช่ warning — pattern `useEffect(() => setX(...))`
ที่เคยเขียนกันทั่วไปใช้ไม่ได้แล้ว
→ เปลี่ยนเป็นคำนวณค่าตอน render แทน (เช่น `const selected = list.find(...) ?? list[0] ?? null`)
ซึ่งอ่านง่ายกว่าเดิมด้วย

**6. React 19 ล้าง uncontrolled form ให้เองหลัง action ทำงานเสร็จ**

ฟอร์มที่ใช้ `action={formAction}` จะถูกรีเซ็ตทุกช่องเมื่อ action คืนค่า **ไม่ว่าจะสำเร็จหรือไม่**
บนหน้า `/register` แปลว่าผู้สมัครที่โดนปฏิเสธเพราะอีเมลซ้ำ ต้องพิมพ์ใหม่ทั้ง 8 ช่อง

**ทางแก้:** เก็บ `new FormData(event.currentTarget)` ไว้ใน ref ตอน `onSubmit`
แล้วเติมกลับเข้า DOM ใน `useEffect` เมื่อ `state.status === "error"` · ล้าง snapshot ทิ้งเมื่อสำเร็จ
เพื่อไม่ให้รหัสผ่านค้างในหน่วยความจำ

> เห็นได้จากภาพหน้าจอเท่านั้นอีกเช่นกัน — typecheck/lint/test ไม่มีตัวไหนจับได้

### 6.15 P1 — เรื่องความปลอดภัยที่ตัดสินใจไว้

| จุด | สิ่งที่ทำ |
|---|---|
| **ไม่บอกใบ้ว่าบัญชีมีจริงไหม** | ชื่อผู้ใช้ไม่มี → ยัง hash รหัสผ่านทิ้งหนึ่งครั้งให้เวลาตอบใกล้เคียงกัน · ตรวจ "บัญชีถูกระงับ" **หลัง** ตรวจรหัสผ่าน |
| **หน้าลืมรหัสผ่านตอบเหมือนกันเสมอ** | ไม่ว่าอีเมลจะมีบัญชีหรือไม่ — กันไม่ให้หน้านี้กลายเป็นเครื่องมือไล่หาอีเมลที่มีอยู่จริง |
| **เปลี่ยนรหัสผ่าน/ระงับบัญชี → เตะทุกเซสชัน** | `revokeAllSessions()` ทำงานทันที ไม่รอเซสชันหมดอายุเอง |
| **audit DENY ทุกครั้งที่ถูกปฏิเสธ** | `toActionError()` เขียน `access.denied` ระดับ WARNING ให้อัตโนมัติเมื่อ service โยน `FORBIDDEN` |
| **เปลี่ยนสิทธิ์ของบทบาท = CRITICAL** | กระทบผู้ใช้ทุกคนที่ถือบทบาทนั้นพร้อมกัน · เปลี่ยน clearance ของผู้ใช้ก็ CRITICAL เช่นกัน |
| **`SYSTEM_ADMIN` ไม่ได้ `document.read`** | ตาม §4.2 — มี unit test ยืนยันไว้ด้วย |
| **ผู้ดูแลระบบรีเซ็ตรหัสผ่านแล้วเห็นรหัสชั่วคราวครั้งเดียว** | ไม่เก็บ plaintext ที่ไหน · ผู้ดูแลคัดลอกไปแจ้งผู้ใช้เอง (MVP ไม่มีอีเมล) |

### 6.16 หน้า `/register` — เวอร์ชันที่ตรงดีไซน์ (25 ส.ค. 2569)

รื้อหน้าสมัครใช้งานให้ตรง `project-ui/Register.dc.html` แล้วตัดสองช่องออกตามคำสั่งผู้ใช้

**สิ่งที่เปลี่ยนบนหน้าจอ**

- ชื่อกับนามสกุลอยู่บรรทัดเดียวกัน (`grid grid-cols-2`) · **ไม่มีช่องคำนำหน้า** · **ไม่มีช่องชื่อผู้ใช้**
- ปุ่มแสดง/ซ่อนรหัสผ่าน · ช่องยืนยันรหัสผ่านพร้อมข้อความ "รหัสผ่านไม่ตรงกัน" ทันทีที่พิมพ์
- ปุ่มส่งปิดไว้จนกรอกครบ — แต่ **ยังกดได้ถ้า JavaScript ยังโหลดไม่เสร็จ** (`complete === null`)
  การตรวจฝั่ง client เป็นความสะดวกเท่านั้น ตัวจริงคือ `registerSchema` + `validatePassword` ฝั่ง server
- จอ "ส่งคำขอแล้ว" แสดงชื่อ · หน่วยงาน · อีเมล และ **ชื่อผู้ใช้ที่ระบบสร้างให้**
  (ต้องแสดง เพราะ MVP ยังไม่มีอีเมลแจ้งผลตาม D10 — ไม่บอกตรงนี้ผู้สมัครจะไม่มีทางรู้)

**ชื่อผู้ใช้มาจากไหน** — `src/lib/auth/username.ts` (ฟังก์ชันบริสุทธิ์ มี unit test 9 เคส)

| ขั้น | ทำอะไร |
|---|---|
| 1 | ตัดส่วนหน้า `@` เป็นตัวพิมพ์เล็ก |
| 2 | อักขระที่ `usernameSchema` ไม่รับ (รวมภาษาไทย) → จุด · ยุบจุดซ้ำ · ตัดตัวคั่นหัวท้าย · จำกัด 45 ตัว |
| 3 | สั้นกว่า 3 ตัว → ต่อ `.user` · ไม่เหลืออะไรเลย → `user` |
| 4 | `reserveUsername()` ใน `auth.service` เช็คกับ `User` **และคำขอที่ยัง PENDING** แล้วต่อท้ายเลขไล่ไป (สูงสุด 50 ครั้ง) |

⚠️ ต้องนับคำขอที่ยัง PENDING ว่า "จองแล้ว" ด้วย ไม่งั้นคำขอสองใบที่อีเมลคล้ายกันจะได้ชื่อเดียวกัน
แล้วไปชนกันตอนผู้ดูแลกดอนุมัติใบที่สอง

**การกันสมัครซ้ำย้ายไปอยู่ที่อีเมล** — เดิมช่องชื่อผู้ใช้ทำหน้าที่นี้
ตอนนี้ `submitRegistration()` ปฏิเสธถ้าอีเมลตรงกับ `User` ที่ยังไม่ถูกลบ หรือคำขอที่ยัง PENDING

**คอลัมน์ `prefix` ยังอยู่ในฐานข้อมูล** (nullable) — ไม่ต้อง migration ·
`/admin/users` ยังให้ผู้ดูแลกรอกคำนำหน้าเองได้ และทุกจุดที่แสดงผลใช้ `prefix ?? ""` อยู่แล้ว

**ผลตรวจด้วย CDP บน dev server จริง**

| เคส | ผล |
|---|---|
| หน้าเปล่า | ไม่มี `#prefix` / `#username` · ชื่อกับนามสกุล `top` ตรงกัน |
| กรอกครบแล้วส่ง | ได้ username จากอีเมล · แถวเข้า `registration_requests` สถานะ PENDING |
| ส่งอีเมลเดิมซ้ำ | `อีเมล "…" ถูกใช้ลงทะเบียนไว้แล้ว` · **ข้อมูลในฟอร์มยังอยู่ครบ** |
| อีเมลชื่อเดียวกันคนละโดเมน | ได้ชื่อต่อท้ายเลข เช่น `test.reg3053952` |
| confirm password ไม่ตรง | กรอบแดง + ข้อความ · ปุ่มส่งยัง disabled |

`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` ผ่านทั้งหมด ·
**test 50 เคส** (เพิ่มจาก 41 ด้วยชุดของ `usernameFromEmail`)

---

## 7. ตัวบล็อกที่ค้างอยู่

**ไม่มี** — Docker Desktop ติดตั้งแล้ว ตัวบล็อกเดิมของ P0 ถูกปลดครบ

---

## 8. เรื่องที่รอการตัดสินใจ

| # | เรื่อง | ตัวเลือก |
|---|-------|---------|
| 1 | ~~agent skills ที่ Prisma แถมมา~~ | ✅ **gitignore ทั้ง 3 ชุด** (22 ส.ค. 2569) — ไฟล์ยังอยู่ในเครื่อง ใช้งานได้ปกติ แต่ไม่เข้า git · ระบุเจาะจงที่ `skills/` ไม่ใช่ทั้งโฟลเดอร์ เผื่อวันหลังจะ commit `.claude/settings.json` |
| 2 | ~~ติดตั้ง Docker Desktop~~ | ✅ ทำแล้ว |
| 3 | ~~base color `neutral`~~ | ✅ **เปลี่ยนเป็นชุดสีของดีไซน์** (24 ส.ค. 2569) — เขียว #3F6133 + สีชั้นความลับ 4 ระดับตาม §8.1 · token ทั้งหมดอยู่ใน `src/app/globals.css` |
| 4 | ~~`public/*.svg` ของ Next~~ | ✅ **ลบแล้ว** (24 ส.ค. 2569) · `public/brand/krirk-logo.png` เข้ามาแทน |
| 5 | **`AGENTS.md` / `CLAUDE.md`** | template ของ Next 16 — ยังไม่ได้แก้ให้ตรงกับโปรเจกต์ |
| 6 | ~~metadata ยัง hardcode~~ | ✅ ย้ายไป `src/constants/app.ts` แล้ว — `layout.tsx` อ้างจากที่นั่น |
| 7 | ~~ICU collation ภาษาไทยของ Postgres~~ | ✅ ทำแล้ว — ดู §6.9 |
| 8 | ~~endpoint `/api/health`~~ | ✅ **ทำแล้ว** (24 ส.ค. 2569) — ตรวจว่าแอปตอบได้ + ต่อฐานข้อมูลติด · `HEALTHCHECK` ใน Dockerfile ชี้มาที่นี่แล้ว |
| 9 | **default password ใน `docker-compose.yml`** | `${POSTGRES_PASSWORD:-esaraban_dev_password}` ทำให้ dev รันได้ทันทีโดยไม่ต้องตั้ง `.env` แต่ถ้าขึ้น production แล้วลืมสร้าง `.env` จะได้รหัสผ่านที่รู้กันทั้ง repo → **ก่อน deploy จริงต้องตัด fallback ทิ้ง** ให้ compose fail ถ้าไม่มีค่า |

---

## 9. คำถามค้างจาก spec §15 (ต้องเคลียร์ก่อน P2)

ยังไม่มีข้อไหนได้คำตอบ · ที่กระทบใกล้ตัวที่สุด:

| # | คำถาม | กระทบขั้นไหน |
|---|-------|-------------|
| 3 | ~~ผังหน่วยงานจริง + รหัสหนังสือ~~ | ✅ **ได้แล้ว + seed ลงฐานข้อมูลแล้ว 25 ส.ค. 2569** — รหัส 6 หลัก 371 หน่วย · spec §16 + `prisma/org-units.csv` |
| 2 | ~~ตัวอย่างเลขหนังสือจริง~~ | ✅ **ได้แล้ว 25 ส.ค. 2569** — `{unitCode}/{seq:4}` เช่น `510000/0451` · spec D16 + §7.1 |
| 5 | ปีที่ใช้รีเซ็ตเลข (ปีงบ / ปีปฏิทิน) | 🟡 **ตอบบางส่วน** — ยืนยันปี 2569 แต่ยังไม่ระบุว่านับแบบไหน · ตั้ง `CALENDAR` ไว้ก่อน · ต่างกันจริงเมื่อถึง 1 ต.ค. 2569 |
| 7 | สเปกเซิร์ฟเวอร์ on-premise + TLS cert | **ยังค้าง** — เขียน compose/nginx ด้วยค่ามาตรฐานไปก่อนแล้ว · block HTTPS คอมเมนต์รออยู่ใน `docker/nginx/conf.d/default.conf` |
| 6 | นโยบายเอกสารลับ | P3 |
| 4 | รูปแบบทะเบียนที่ต้อง export | P4 |
| 1 | ยืนยัน A1 (โมดูลหนังสือรับ) | ขอบเขต P5 |

---

## 10. แผนงานถัดไป

> 📌 **หัวข้อนี้เป็นบันทึกตอนวางแผน P2 (24 ส.ค. 2569)** — P2 และ P3 ปิดไปแล้ว
> แผนงานที่เป็นปัจจุบันอยู่ที่ **§21.7** ท้ายเอกสาร

**P0 · P1 ปิดแล้ว** ถัดไปคือ **P2 — Core Documents**
ประมาณการ 3–4 สัปดาห์ · Definition of Done ตาม spec §13:
*"ทำ flow บันทึกข้อความและหนังสือส่งได้ครบตั้งแต่ร่างถึงปิดเรื่อง · **test เลขซ้ำผ่าน**"*

ขอบเขต P2: DocumentType · สร้าง/แก้/ส่งร่าง · NumberSequence + ออกเลข (พร้อม concurrency test) ·
Attachment upload + PDF preview · Inbox/Outbox/Drafts · state machine + DocumentAction timeline ·
คิวออกเลข + bulk issue · ตีกลับแก้ไข

### ⚠️ ของที่ต้องเคลียร์ก่อนเริ่ม P2 — เป็นตัวบล็อกจริง

**อัปเดต 25 ส.ค. 2569 — ตัวบล็อกหลักถูกปลดแล้ว** ผู้ใช้ส่งผังหน่วยงานจริงและรูปแบบเลขมาครบ

| # | เรื่อง | สถานะ |
|---|-------|---------|
| 1 | ~~spec §15 ข้อ 2 — ตัวอย่างเลขหนังสือจริง~~ | ✅ ปลดแล้ว — `{unitCode}/{seq:4}` (D16) |
| 2 | ~~spec §15 ข้อ 3 — ผังหน่วยงานจริง + รหัสหนังสือ~~ | ✅ ปลดแล้ว — 371 หน่วย รหัส 6 หลัก (D14) · หน่วยที่ออกเลขได้ 190 หน่วย (D15) |
| 3 | **spec §15 ข้อ 5** — ปีงบ หรือ ปีปฏิทิน | 🟡 ยืนยันปี 2569 แล้ว แต่ยังไม่ระบุฐานการนับ · ใช้ `CALENDAR` ไปก่อนได้ เพราะสองแบบให้ค่าเดียวกันจนถึง 30 ก.ย. 2569 — **ไม่บล็อกงานตอนนี้** |
| 4 | **spec §15 ข้อ 1** — ยืนยัน A1 (โมดูลหนังสือรับ) | กระทบว่าจะออกแบบ `direction` กับ bookCode ยังไง — ยังค้าง |

**~~สิ่งที่ต้องทำก่อนงานอื่นใน P2~~** ✅ ทำแล้ว 25 ส.ค. 2569 — ดู §12

### ลำดับที่แนะนำสำหรับ P2

เรียงตามการพึ่งพากัน

| ลำดับ | งาน | หมายเหตุ |
|:--:|---|---|
| 1 | เพิ่ม schema ฝั่งเอกสาร | `DocumentType` · `Document` · `NumberSequence` · `Attachment` · `DocumentRecipient` · `DocumentAction` — ใส่ `@@unique` ของเลขทะเบียนตาม §7.3 ตั้งแต่ migration แรก |
| 2 | **renderer ของ pattern เลขหนังสือ** ใน `src/lib/thai/` | `{unitCode}` `{unitShort}` `{seq}` `{seq:4}` `{year}` `{yearShort}` `{docType}` `{bookCode}` — เขียน unit test คู่กันเลย |
| 3 | **`issueNumber()` + concurrency test** ⚠️ | จุดที่ spec §7.3 ทำเครื่องหมาย Critical · ยิง 50 requests พร้อมกัน → ต้องได้เลข 1–50 ครบ ไม่ซ้ำ ไม่ข้าม · **เป็น acceptance criteria ของ P2** |
| 4 | state machine + `DocumentAction` | ใช้ `can()` ที่มีอยู่แล้วพร้อม `allowedStatuses` — ด่าน STATE ของ §4.3 ทำรอไว้แล้วใน P1 |
| 5 | Attachment upload + StorageAdapter (LocalFs) | interface พร้อมแล้วที่ `src/lib/storage/` · magic-number check ตาม §8.4 · ค่าขนาดไฟล์อ่านจาก `/admin/settings` ที่ทำไว้แล้ว |
| 6 | UI — `/documents/new` · `/documents/[id]` · Inbox/Outbox/Drafts · คิวออกเลข | หน้าเหล่านี้ตอนนี้เป็นหน้า "อยู่ระหว่างพัฒนา" อยู่ — แทนที่ทีละหน้า · ดีไซน์มีครบใน `project-ui/` |
| 7 | เปลี่ยน `/admin/numbering` ให้ตั้ง pattern ได้จริง | ตอนนี้เป็นหน้า placeholder |

### สิ่งที่วางรากไว้ให้ P2 แล้ว — อย่าสร้างซ้ำ

| มีอยู่แล้วที่ | ใช้ทำอะไร |
|---|---|
| `src/lib/authz/can.ts` | ครบทั้ง 6 ด่านของ §4.3 รวม ACL · clearance · **ด่าน STATE** (`allowedStatuses`) — P2 แค่ส่งสถานะเข้าไป |
| `src/lib/audit/` | `writeAudit(tx, …)` + hash chain — ทุก transition ของเอกสารเรียกตัวนี้ |
| `src/server/services/errors.ts` | `assertPermission()` + `ServiceError` — service ใหม่ใช้รูปแบบเดียวกัน |
| `src/server/actions/{types,helpers}.ts` | `ActionState` · `zodErrorState` · `toActionError` (เขียน audit DENY ให้อัตโนมัติ) |
| `src/components/ui/` | ปุ่ม · ฟอร์ม · การ์ด · badge · **`ConfidentialityBadge` 4 ระดับ** พร้อมใช้ |
| `src/lib/settings/` | ขนาดไฟล์สูงสุด · ประเภทไฟล์ที่อนุญาต · `yearMode` — อ่านผ่าน `getSystemSettings()` |
| `src/lib/storage/` · `src/lib/notification/` | interface พร้อมแล้ว — ห้ามข้ามไป import ตรง |
| `src/constants/ui.ts` | ข้อความ UI ทั้งหมด — หน้าใหม่เพิ่มกลุ่มของตัวเองที่นี่ ห้ามเขียนไทยลง component |

### ยังไม่ได้ทำ เพราะยังไม่ถึงเวลา

- **CI** (GitHub Actions) — ผู้ใช้สั่งข้ามตั้งแต่ P0 (§6.12) · คำสั่งพร้อมหมดแล้ว เหลือแค่ workflow ไฟล์เดียว
- **pre-commit hook** (husky + lint-staged) — ทำพร้อม CI
- **Playwright e2e** — อยู่ใน P5 · ระหว่างนี้ทดสอบด้วยสคริปต์ CDP (ดู §11.6)
- **CSP strict + security headers ครบ** — ~~อยู่ใน P3~~ ✅ ทำแล้วใน P3 ที่ `src/proxy.ts` (ดู §21.5)

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

### 11.6 ตรวจ P1 — flow ที่ยืนยันแล้วด้วยการรันจริง (24 ส.ค. 2569)

ทดสอบผ่านเบราว์เซอร์จริง (Chrome headless + DevTools Protocol) ไม่ใช่แค่ดูว่า build ผ่าน

| flow | ผลที่ได้ |
|---|---|
| `GET /` ตอนยังไม่ล็อกอิน | 307 → `/login` |
| `GET /api/health` | 200 `{"status":"ok"}` |
| ล็อกอินด้วยรหัสผ่านผิด | ขึ้น "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง — **เหลือโอกาสอีก 4 ครั้ง**ก่อนบัญชีจะถูกล็อกชั่วคราว" |
| ล็อกอินด้วยรหัสผ่านถูก (บัญชีใหม่) | → `/change-password` โดยบังคับ (`mustChangePassword`) |
| ตั้งรหัสผ่านใหม่ | → `/dashboard` · `mustChangePassword` ถูกล้าง |
| `DEPT_OFFICER` เปิด `/admin/users` | 307 → `/dashboard` (ไม่มีสิทธิ์ `user.manage`) |
| `DEPT_OFFICER` เปิด `/admin/audit` | 200 (มี `audit.read` scope UNIT) |
| `SYSTEM_ADMIN` เปิดหน้า `/admin/*` ทั้งหมด | 200 ทุกหน้า |
| สมัครใช้งานผ่าน `/register` | สร้างคำขอ · ขึ้นหน้า "ส่งคำขอเรียบร้อยแล้ว" |
| สมัครด้วยชื่อผู้ใช้ซ้ำ | ปฏิเสธ: `ชื่อผู้ใช้ "test.register" ถูกใช้ไปแล้ว` |
| คำขอโผล่ในคิวที่ `/admin/users` | ✅ พร้อมปุ่มอนุมัติ/ปฏิเสธ และเลือกบทบาทให้ |
| materialized path ของผัง 3 ระดับ | ✅ `subtree ของคณะวิศวฯ` คืน 3 หน่วย (ตัวเอง + 2 ภาควิชา) |
| audit hash chain | ✅ `verifyAuditChain()` คืน `valid: true` |
| `UPDATE audit_logs` ตรงจาก SQL | ✅ **ฐานข้อมูลปฏิเสธ** — `P0001: audit_logs เป็นตารางแบบ append-only` |

**คำสั่งที่ใช้ตรวจคุณภาพ (ต้องผ่านทั้งหมดก่อนปิดเฟส)**

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
```

ผลล่าสุด: lint 0 error · format ผ่าน · typecheck ผ่าน · **test 41 เคสผ่าน** · build ได้ 24 routes

**ถ่ายภาพหน้าจอที่ต้องล็อกอิน** — Chrome headless อย่างเดียวตั้ง cookie ไม่ได้
ต้องคุยผ่าน DevTools Protocol (Node 24 มี `WebSocket` มาให้แล้ว ไม่ต้องติดตั้ง Playwright):

```bash
chrome --headless=new --remote-debugging-port=9222 --user-data-dir=<tmp> about:blank
# แล้วส่ง Network.setCookie → Page.navigate → Page.captureScreenshot ผ่าน ws://
```

> ⚠️ บน Git Bash ต้องนำหน้าด้วย `MSYS_NO_PATHCONV=1` ไม่งั้น argument ที่ขึ้นต้นด้วย `/`
> (เช่น `/dashboard`) จะถูกแปลงเป็นพาธของ Windows แล้ว CDP จะตอบ `Cannot navigate to invalid URL`

---

## 12. P2 — ผังหน่วยงานจริงลงฐานข้อมูล (25 ส.ค. 2569)

งานชิ้นแรกของ P2 · ปิดแล้ว

**สิ่งที่เปลี่ยน**

| ไฟล์ | เปลี่ยนอะไร |
|---|---|
| `prisma/schema.prisma` | `OrgUnit.canIssueNumber Boolean @default(true)` (D15) |
| `prisma/migrations/20260825044008_p2_org_unit_can_issue_number/` | migration เพิ่มคอลัมน์ |
| `prisma/org-units.csv` | ผังจริง 371 หน่วย — **แหล่งข้อมูลเดียวของผัง** |
| `prisma/seed.ts` | ลบ `ORG_TREE` ที่ hardcode ทิ้ง · อ่าน CSV แทน · ผู้ใช้ตั้งต้นอ้างหน่วยงานด้วยรหัส 6 หลัก |

**สิ่งที่ตัดสินระหว่างทาง**

- **หน่วยงานแม่ของทั้งผัง** — เอกสารต้นทางเริ่มนับที่หน่วยงานภายใน ไม่มีตัวมหาวิทยาลัย
  จึงสร้าง `000000 มหาวิทยาลัยเกริก` เป็น root ให้ (level 0 · `canIssueNumber = false`)
  ถ้าไม่มี root จะได้ผัง 38 ต้นแยกกัน ซึ่งทำให้ scope `SUBTREE` ระดับทั้งองค์กรใช้ไม่ได้
- **ชนิดหน่วยงาน** เดาจากคำขึ้นต้นของชื่อ (`guessType`) เพราะต้นทางไม่มีคอลัมน์ชนิด —
  ใช้แค่แสดงผล ไม่ได้ใช้ตัดสินสิทธิ์หรือการออกเลข
- **ชื่อย่อว่างทั้งหมด** — ต้นทางไม่มี · ให้ผู้ดูแลกรอกเองที่ `/admin/org-units`
- **CSV อยู่ใต้ `prisma/` ไม่ใช่ `docs/`** — `.dockerignore` ตัด `docs/` ออกจาก build context
  ถ้าวางไว้ที่เดิม service `migrate` ในคอนเทนเนอร์จะอ่านไม่เจอ
- **ผู้ใช้ตั้งต้นย้ายสังกัดตามผังใหม่** — `admin`→`720000` ศูนย์เทคโนโลยีสารสนเทศ ·
  `registrar`→`010103` งานสารบรรณ · `rattana.wong`→`510000` คณะบริหารธุรกิจ + `720000` ·
  `dean.eng`→`630000` คณะนวัฒกรรมฯ · `somchai.j`→`630200` สาขาวิชาปัญญาประดิษฐ์ฯ

**ผลหลัง `prisma migrate reset` + `pnpm db:seed`** (ผู้ใช้อนุมัติให้ล้างฐาน dev)

| ระดับ | หน่วยงาน | ออกเลขได้ | ปิดใช้งาน |
|:--:|--:|--:|--:|
| 0 (root) | 1 | 0 | 0 |
| 1 | 38 | 36 | 2 |
| 2 | 161 | 154 | 5 |
| 3 | 172 | 0 | 5 |
| **รวม** | **372** | **190** | **12** |

ตรวจด้วยการรันจริง: `/admin/org-units` แสดงผังครบ (นับ 360 หน่วย = 372 − 12 ที่เก็บถาวร) ·
subtree ของคณะบริหารธุรกิจคืน 36 หน่วย · สังกัดของผู้ใช้ทั้ง 5 บัญชีถูกต้อง ·
`lint · format · typecheck · test 50 เคส · build` ผ่านทั้งหมด

**~~ที่ยังค้างจากขั้นนี้~~ ✅ ปิดแล้ววันเดียวกัน — ดู §13**

---

## 13. P2 — `/admin/org-units` รับผังขนาดจริง (25 ส.ค. 2569)

ปิดสองข้อที่ค้างจาก §12 · หน้านี้ออกแบบไว้ตอน P1 กับผัง 11 หน่วย พอเจอของจริง 372 หน่วยจึงใช้ไม่ไหว

**1. สวิตช์ `canIssueNumber`**

ต่อครบสายตั้งแต่ schema จนถึงหน้าจอ — `createOrgUnitSchema` (update สืบทอดต่อ) → `readCheckbox`
ในทั้ง create/update action → `createOrgUnit`/`updateOrgUnit` → `OrgUnitNode` → แผงรายละเอียด

- ค่าก่อน/หลังของ `canIssueNumber` เข้า audit metadata ด้วย — เป็นค่าที่กระทบเลขทะเบียนโดยตรง
  จึงต้องตามรอยได้ว่าใครเปิด/ปิดเมื่อไร
- แถวในผังต่อท้ายด้วย "· ออกเลขไม่ได้" เมื่อหน่วยนั้นออกเลขไม่ได้ · หัวการ์ดบอก "ออกเลขได้ N"
- ฟอร์มเพิ่มหน่วยงานติ๊กไว้ให้ตั้งแต่ต้น (`defaultChecked`) เพราะหน่วยที่ผู้ดูแลสร้างเองส่วนใหญ่คือระดับ 1–2

**2. ผังพับได้ + ค้นหาได้**

| ก่อน | หลัง |
|---|---|
| กางถึงระดับ 2 อัตโนมัติ · หน้าสูง 10,482px | กางแค่ระดับบนสุด · หน้าสูง **1,369px** |
| ไม่มีช่องค้นหา ต้องไล่หาด้วยตา | ค้นได้ทั้ง **ชื่อและรหัส 6 หลัก** · ผลลัพธ์กางให้อัตโนมัติพร้อมหน่วยงานแม่ |
| — | ปุ่ม "กางทั้งหมด" / "พับทั้งหมด" · ผังมี `max-h-[70vh]` เลื่อนในกรอบตัวเอง |

**กับดักที่เลี่ยงไว้** — ปุ่มกาง/พับทั้งหมดเป็น "คำสั่งครั้งเดียว" ไม่ใช่สถานะถาวร
ถ้าเขียนเป็น `useEffect` ที่ setState จะชน rule `react-hooks/set-state-in-effect` ของ ESLint 9 (§6.14 ข้อ 5)
จึงส่ง timestamp ของการกดลงไปแล้วให้แต่ละแถวเทียบเองตอน render ว่าตอบคำสั่งนี้ไปหรือยัง

**ตรวจด้วยการรันจริง (CDP)**

| เคส | ผล |
|---|---|
| เปิดหน้าแรก | 37 แถว (root + 36 หน่วยระดับ 1 ที่ยังใช้งาน) · สูง 1,369px |
| ค้น `510400` | เหลือ 3 แถว: `000000` → `510000` → `510400` สาขาวิชาบัญชี |
| ค้น "สารบรรณ" | เหลือ 4 แถว ไล่จากรากถึง `010103` งานสารบรรณ |
| กางทั้งหมด → พับทั้งหมด → กางซ้ำ | 360 → 1 → 360 แถว (สั่งซ้ำได้ ไม่ค้าง) |
| เปิดสวิตช์ออกเลขให้ `010103` แล้วบันทึก | ฐานข้อมูลเป็น `true` · audit `orgunit.updated` บันทึก before/after ของ `canIssueNumber` ครบ |

> ค่าของ `010103` ถูกตั้งกลับเป็น `false` แล้วหลังทดสอบ — ตามกติกา D15

**โลโก้ใหม่** — ผู้ใช้ส่งตรามหาวิทยาลัยแบบวางซ้อน (KRIRK UNIVERSITY + 泰国格乐大学) มาแทนของเดิม
ไฟล์ต้นฉบับ 1143×985px **4.31 MB** ย่อเหลือ 600×517px **32 KB** (ยังคง alpha channel)
เพราะจุดที่ใช้จริงสูงแค่ 36–48px · แก้ `width`/`height` ที่ประกาศไว้ให้ตรงสัดส่วนจริง
และเพิ่มความสูงที่แสดง (auth 32→48px · sidebar 24→36px) เพราะตราแบบวางซ้อนอ่านไม่ออกที่ความสูงเดิม

---

## 14. P2 — schema ฝั่งเอกสาร (25 ส.ค. 2569)

migration `20260825051648_p2_documents` · 7 ตาราง 8 enum

| ตาราง | หน้าที่ |
|---|---|
| `document_types` | ประเภทหนังสือ + pattern เลขของตัวเอง (spec §7.1) |
| `documents` | ตัวเอกสาร — มี `@@unique` ของเลขทะเบียนตาม §7.3 ตั้งแต่ migration แรก |
| `number_sequences` | ตัวนับเลขต่อ (หน่วยงาน × ทิศทาง × เล่ม × ปี) |
| `attachments` | ไฟล์แนบ + ฟิลด์เข้ารหัสตาม §8.2 · มี `version` เพราะเอกสารที่ออกเลขแล้วแนบเวอร์ชันใหม่ได้ |
| `document_recipients` | ผู้รับหนังสือเวียน (TO/CC/FYI) |
| `document_actions` | timeline ที่ผู้ใช้เห็น — คนละชั้นกับ audit log |
| `document_acls` | ACL เฉพาะราย — ชนิดตรงกับ `AuthzAclEntry` ใน `can.ts` ที่ทำไว้ตั้งแต่ P1 |

**ของที่ Prisma สร้างเองไม่ได้ — เขียน SQL ต่อท้าย migration เอง**

| สิ่งที่เพิ่ม | ทำไม |
|---|---|
| `documents_number_complete_check` | `docNo` · `seqValue` · `year` ต้องมาครบชุดหรือไม่มาเลย · ครึ่ง ๆ กลาง ๆ = ออกเลขค้างกลางทาง ซึ่งทะเบียนราชการรับไม่ได้ (§6.4) |
| `documents_levels_check` | ชั้นความลับและความเร่งด่วนต้องอยู่ในช่วง 0–3 (§8.1) |
| `document_recipients_principal_check` | ผู้รับต้องเป็นหน่วยงาน **หรือ** บุคคล อย่างใดอย่างหนึ่ง · ปล่อยว่างทั้งคู่ = เวียนไปหา "ไม่มีใคร" โดยระบบไม่รู้ตัว |
| `number_sequences_last_value_check` | ตัวนับติดลบไม่ได้ |
| `documents_subject_trgm_idx` · `documents_docNo_trgm_idx` — **GIN + gin_trgm_ops** | §9.2 — ภาษาไทยไม่มีเว้นวรรค tsvector ตัดคำไม่ได้ · trgm คือกลไกค้นหาหลัก |
| `documents_searchVector_idx` + trigger `documents_search_vector_trigger` | เติม tsvector อัตโนมัติจาก `docNo`+`subject`+`summary`+`refDocNo` ถ่วงน้ำหนัก A/B/C · ใช้ config **`simple`** ไม่ใช่ `english` เพราะ stemmer อังกฤษจะทำให้คำไทยค้นไม่เจอ |

**ตรวจด้วย SQL จริงบนฐาน dev** (ทุกเคสอยู่ในทรานแซกชันที่ ROLLBACK ทิ้ง — ฐานข้อมูลสะอาดเหมือนเดิม)

| เคส | ผล |
|---|---|
| สร้างร่าง → trigger เติม `searchVector` ให้เอง | ✅ |
| ค้นภาษาไทยกลางคำ `%คณะกรรมการ%` | ✅ เจอ |
| ร่างสองใบในหน่วยเดียวกัน (`seqValue` เป็น NULL) | ✅ ไม่ชนกัน — Postgres ไม่ถือว่า NULL ซ้ำ |
| ออกเลข `510000/0001` แล้วออกเลขเดิมซ้ำ | ✅ **ฐานข้อมูลปฏิเสธ** ที่ `@@unique` ของ §7.3 |
| ตั้ง `docNo` โดยไม่มี `seqValue`/`year` | ✅ ปฏิเสธ |
| ชั้นความลับ = 5 | ✅ ปฏิเสธ |
| ผู้รับที่ระบุทั้งหน่วยงานและบุคคล / ไม่ระบุเลย | ✅ ปฏิเสธทั้งสองแบบ |
| ตัวนับเลขติดลบ · คีย์ `NumberSequence` ซ้ำ | ✅ ปฏิเสธทั้งคู่ |
| แก้ชื่อเรื่อง → `searchVector` เปลี่ยนตาม | ✅ |
| ลบหน่วยงานที่มีเอกสารผูกอยู่ | ✅ ปฏิเสธ (FK `Restrict` ตาม §9.3) |

**ประเภทหนังสือของ MVP** — ผู้ใช้ยืนยัน **3 ประเภท** เมื่อ 25 ส.ค. 2569 · seed ลงฐานแล้ว

| code | ชื่อ | ทิศทาง | pattern เลข |
|---|---|---|---|
| `MEMO` | บันทึกข้อความ | INTERNAL | ค่าปริยาย `{unitCode}/{seq:4}` (D16) |
| `OUTGOING` | หนังสือส่งภายนอก | OUTGOING | ค่าปริยาย `{unitCode}/{seq:4}` (D16) |
| `INCOMING` | หนังสือรับ | INCOMING | `รับ {seq}/{year}` — คนละทะเบียนกับหนังสือส่ง |

สองประเภทแรกเก็บ `numberPattern` เป็น `null` โดยตั้งใจ = ใช้ค่าปริยาย
เปลี่ยนค่าปริยายที่เดียวแล้วมีผลทั้งคู่ · **คำสั่ง/ประกาศ ยังไม่ทำ** เพราะยังไม่รู้รูปแบบเลขที่แน่ชัด

**ที่ยังไม่ได้ทำในขั้นนี้** — `issueNumber()` · renderer ของ pattern · service ฝั่งเอกสาร

---

## 15. ล็อกอินด้วยอีเมล + บัญชีผู้ดูแลสำหรับทดสอบ (25 ส.ค. 2569)

**ล็อกอินได้ทั้งชื่อผู้ใช้และอีเมล (D17)**

จำเป็นเพราะหน้า `/register` เลิกถามชื่อผู้ใช้ไปแล้ว (§6.16) ผู้สมัครใหม่จำได้แต่อีเมลของตัวเอง
ถ้าไม่เปิดทางนี้ คนที่สมัครผ่านหน้าเว็บจะเข้าระบบไม่ได้เลยจนกว่าจะมีคนไปบอกชื่อผู้ใช้ให้

| จุดที่แก้ | เปลี่ยนอะไร |
|---|---|
| `src/schemas/auth.schema.ts` | เพิ่ม `loginIdentifierSchema` — ยอมให้มี `@` และ `+` ยาวได้ถึง 120 ตัว · `usernameSchema` เดิมยังคุมชื่อผู้ใช้ตอนสร้างบัญชีเหมือนเดิม |
| `src/server/services/auth.service.ts` | `login()` ค้นด้วย `OR: [{ username }, { email }]` · อีเมลเทียบแบบไม่สนตัวพิมพ์ |
| `src/constants/ui.ts` | ป้ายหน้า login เป็น "ชื่อผู้ใช้หรืออีเมล" |

**ตรวจด้วยการรันจริง (CDP)**

| เคส | ผล |
|---|---|
| ล็อกอินด้วย `rattana.wong@krirk.ac.th` | → `/dashboard` |
| ล็อกอินด้วย `rattana.wong` (ชื่อผู้ใช้เดิม) | → `/dashboard` ยังใช้ได้เหมือนเดิม |
| รหัสผ่านผิด | ถูกปฏิเสธ + นับครั้งเหมือนเดิม ("เหลือโอกาสอีก 4 ครั้ง") |
| เปิด `/admin/users` `/admin/roles` `/admin/settings` `/admin/audit` | เข้าได้ทุกหน้า |

**บัญชีผู้ดูแลสำหรับทดสอบ — อยู่ในฐาน dev เท่านั้น ไม่ได้ commit**

ตามที่ผู้ใช้สั่ง: อีเมล `rattana.wong@krirk.ac.th` · รหัสผ่าน `12345678` ·
เพิ่มบทบาท `SYSTEM_ADMIN` ระดับทั้งองค์กร (ของเดิม `DEPT_OFFICER`@510000 กับ `USER`@720000 ยังอยู่ครบ) ·
ตั้ง `clearanceLevel = 3` และ `mustChangePassword = false` เพื่อให้เข้าใช้งานได้ทันที

> ⚠️ **รหัสผ่านนี้ผิดนโยบายของระบบเองทั้งสามข้อ** — สั้นกว่า 10 ตัว · เป็นตัวเลขล้วน (ต้องมี 2 ประเภทอักขระ) ·
> และอยู่ใน `COMMON_PASSWORDS` ของ `src/lib/auth/password.ts` พอดี
> ตั้งได้เพราะเขียน hash ลงฐานตรง ๆ — `validatePassword()` ทำงานตอน **ตั้ง**รหัสผ่าน ไม่ใช่ตอน**ตรวจ**
> ผลที่ตามมา: ถ้าผู้ใช้กดเปลี่ยนรหัสผ่านที่ `/change-password` จะตั้งค่าเดิมซ้ำไม่ได้ ·
> **ห้ามใช้บัญชีนี้บนเครื่องจริง** และถ้ารัน `prisma migrate reset` บัญชีจะกลับไปเป็นค่า seed (`Esaraban@2569` + ไม่มีสิทธิ์ admin)

---

## 16. P2 — renderer ของเลขทะเบียน (25 ส.ค. 2569)

`src/lib/thai/doc-number.ts` · ฟังก์ชันบริสุทธิ์ล้วน ไม่แตะฐานข้อมูล
(การเดินเลขและล็อกแถวเป็นหน้าที่ของ `issueNumber()` ซึ่งเป็นขั้นถัดไป)

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `renderDocNumber(pattern, ctx)` | pattern + ค่า → เลขที่หนังสือ · รองรับ token ครบ 8 ตัวตาม §7.1 |
| `validateNumberPattern(pattern)` | ตรวจก่อนบันทึกที่ `/admin/numbering` · คืนรายการปัญหา ไม่โยน error |
| `resolveNumberYear(mode, date)` | ปีที่ใช้เป็นคีย์ทะเบียน — รองรับทั้ง `CALENDAR` และ `FISCAL` (§7.2) |
| `previewDocNumber(pattern)` | ตัวอย่างผลลัพธ์สำหรับหน้าตั้งค่า |
| `NUMBER_PATTERN_TOKENS` | รายการ token + ป้ายไทย + ตัวอย่าง ให้ UI เอาไปแสดง |

**สามข้อที่ตัดสินไว้ในโค้ด — มีเหตุผลเรื่องเลขซ้ำอยู่เบื้องหลังทั้งหมด**

1. **เลขยาวกว่าจำนวนหลักที่สั่ง ต้องไม่ถูกตัด** — `{seq:4}` กับลำดับที่ 12345 ให้ `12345`
   ไม่ใช่ `2345` · ตัดแล้วเลขที่ 10001 กับ 1 จะกลายเป็นเลขเดียวกัน ซึ่งร้ายแรงกว่าเลขที่ยาวเกินรูปแบบ
2. **pattern ที่ไม่มี `{seq}` ถือว่าใช้ไม่ได้** — ทุกฉบับจะได้เลขเดียวกันแล้วไปชน `@@unique` ตอนออกเลขฉบับที่สอง
   ดักตั้งแต่ตอนตั้งค่าดีกว่าไปพังตอนสารบรรณกดออกเลข
3. **token ที่ไม่รู้จักโยน error ทันทีตอน render** — ปล่อยผ่านแล้วเลขจะออกมาผิดรูป
   และเลขที่ออกไปแล้วแก้ย้อนหลังไม่ได้ตาม §6.4 · ส่วน `validateNumberPattern` คืนเป็นรายการปัญหา
   เพื่อให้ฟอร์มแสดงได้ทีเดียวหลายข้อ

**ปีงบประมาณ** — เอกสารที่ออกตั้งแต่ **1 ต.ค.** นับเป็นปีถัดไป (15 ต.ค. 2569 → ปีงบ 2570)
คำนวณเดือนด้วย `getThaiMonth()` ที่ตรึง `Asia/Bangkok` เสมอ · container รันด้วย `TZ=UTC`
ถ้าปล่อยตามเครื่อง เอกสารที่ออกหลัง 19:00 น. ของ 30 ก.ย. จะข้ามปีงบไปก่อนเวลาจริง — มี test คุมเคสนี้ไว้

**test 18 เคส** (รวมทั้งโปรเจกต์เป็น **68 เคส**) · lint · format · typecheck · build ผ่านทั้งหมด

---

## 17. P2 — `issueNumber()` + concurrency test ⚠️ (25 ส.ค. 2569)

**นี่คือ acceptance criteria ของ P2 ตาม spec §13/§14** — *"ยิง issueNumber 50 ครั้งพร้อมกัน →
ต้องได้เลข 1–50 ครบ ไม่ซ้ำ ไม่ข้าม"*

`src/server/services/numbering.service.ts` · ทุกอย่างอยู่ในทรานแซกชันเดียว
ถ้าขั้นไหนพัง เลขที่เดินไปแล้วถูก rollback ด้วย จึงไม่เกิด "เลขหาย"
ซึ่งในทะเบียนราชการถือเป็นสัญญาณของการทุจริต (§6.4)

**ลำดับการทำงาน**

1. โหลดเอกสาร → `assertPermission(document.number.issue)` พร้อม `allowedStatuses: ["PENDING_NUMBER"]` (ด่าน STATE ของ §4.3)
2. ปฏิเสธถ้าหน่วยงานเจ้าของเรื่องมี `canIssueNumber = false` (D15)
3. คำนวณปีจาก `yearMode` ของ `/admin/settings`
4. **เดินเลขด้วยคำสั่งเดียว** `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`
5. เลือก pattern: `patternOverride` ของทะเบียน → `numberPattern` ของประเภท → ค่าปริยาย D16
6. `validateNumberPattern()` ก่อน render — pattern พังแล้วโยนทิ้งทั้งทรานแซกชัน ตัวนับกลับไปเท่าเดิม
7. เขียน `docNo` + `seqValue` + `year` + สถานะ `REGISTERED` → `DocumentAction` → `writeAudit`

**ที่ต่างจากสูตรใน spec §7.3 โดยตั้งใจ**

สเปกเขียนไว้เป็น `SELECT ... FOR UPDATE` → ถ้าไม่มีแถวก็ `INSERT` → `UPDATE` ภายใต้ isolation `Serializable`
ที่นี่ยุบเหลือ **คำสั่งเดียว** `INSERT ... ON CONFLICT DO UPDATE ... RETURNING "lastValue"` เพราะ

| เหตุผล | รายละเอียด |
|---|---|
| ไม่มีช่องให้ race | สูตรเดิมมีช่วง "หลังเช็คว่าไม่มีแถว ก่อน INSERT" ที่สองทรานแซกชันแทรกกันได้ ต้องพึ่ง `ON CONFLICT DO NOTHING` แล้ววนกลับไปอ่านใหม่ |
| ไม่ต้อง retry | `Serializable` + `FOR UPDATE` ที่มีคนแย่งกัน 50 ทาง จะโยน `40001 serialization failure` ต้องเขียน retry loop เอง · ทางนี้ใช้ isolation ปริยาย (Read Committed) แล้วล็อกแถวโดยตรง คนที่มาทีหลังรอแล้วได้เลขถัดไป |
| ผลลัพธ์เข้มกว่าเดิม | `@@unique` ของ `Document` ยังเป็นด่านสุดท้ายเหมือนเดิม |

**ผลทดสอบ — `pnpm test:integration`** (เรียก service ตัวจริงบน Postgres จริง ไม่ mock อะไรเลย)

| เคส | ผล |
|---|---|
| ยิง 50 ครั้งพร้อมกัน | ✅ ได้ `seqValue` 1–50 ครบ ไม่ซ้ำ ไม่ข้าม · `docNo` ไม่ซ้ำ 50 ค่า |
| รูปแบบเลข | ✅ `510000/0001` … `510000/0050` · ทุกฉบับสถานะ `REGISTERED` และปีตรงกัน |
| ตัวนับในฐานข้อมูล | ✅ `lastValue = 50` พอดี — ไม่มีเลขถูกกินทิ้ง |
| timeline | ✅ ทุกฉบับมี `NUMBER_ISSUED` หนึ่งรายการ `PENDING_NUMBER → REGISTERED` |
| **audit hash chain** | ✅ `verifyAuditChain()` คืน `valid: true` หลังเขียนพร้อมกัน 50 รายการ — ยืนยันว่า advisory lock ต่อ tenant ยังทำงานถูกใต้ concurrency |
| ออกเลขซ้ำให้ฉบับเดิม | ✅ ถูกปฏิเสธที่ด่าน STATE |

รันซ้ำ 4 รอบผ่านทุกรอบ (ไม่ flaky)

**โครงสร้างเทสต์ที่เพิ่ม**

- `vitest.integration.config.mts` + `pnpm test:integration` — แยกจาก `pnpm test`
  เพราะชุดนี้ต้องมี Postgres จริงรันอยู่ · เครื่องที่ไม่มี Docker ยังรัน unit test ได้ปกติ
- `tests/stubs/server-only.ts` — โมดูลเปล่าแทน `server-only` ที่โยน error นอก React Server Component
  ทำให้เทสต์เรียก **service ตัวจริง** ได้ ไม่ต้องก๊อป logic มาไว้ในเทสต์
- เทสต์เก็บกวาดข้อมูลที่สร้างเองทั้งหมด ยกเว้น audit log ที่ลบไม่ได้ตามดีไซน์

**คำสั่งตรวจคุณภาพชุดใหม่**

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
pnpm test:integration     # ต้อง docker compose up -d + pnpm db:seed ก่อน
```

ผลล่าสุด: unit **68 เคส** · integration **6 เคส** · build ผ่าน

---

## 18. P2 — state machine + service ฝั่งเอกสาร (25 ส.ค. 2569)

ผู้ใช้ยืนยัน **A1: MVP ต้องมีโมดูลหนังสือรับ** (25 ส.ค. 2569) — ขั้นนี้จึงทำครบทั้งสามทิศทาง

### ตาราง transition ที่เดียว — `src/lib/documents/state-machine.ts`

ฟังก์ชันบริสุทธิ์ ไม่แตะฐานข้อมูล · ข้อบังคับเดียวกับ `can()`:
**ห้ามเขียนเงื่อนไขสถานะกระจายอยู่ใน service หรือ UI** ทุกการเปลี่ยนสถานะต้องผ่าน `nextStatus()`

| ฟังก์ชัน | ใช้ทำอะไร |
|---|---|
| `nextStatus(direction, transition, from)` | สถานะปลายทาง · `null` = ทำจากสถานะนี้ไม่ได้ |
| `allowedFromStatuses(direction, transition)` | ส่งเข้า `allowedStatuses` ของ `can()` — ด่าน STATE ของ §4.3 |
| `availableTransitions(direction, status)` | UI ใช้ตัดสินว่าจะโชว์ปุ่มอะไร |
| `isEditable` · `isNumbered` · `isTerminal` · `initialStatus` | กติกา §6.4 |

**สองจุดที่ต่างจากผังในสเปกโดยตั้งใจ**

1. §6.2 วาดว่า `RETURNED → DRAFT` แล้วค่อย submit ใหม่ · ที่นี่ให้ `RETURNED` submit ได้ตรง
   ผลลัพธ์เหมือนกันแต่ผู้ใช้กดน้อยกว่าหนึ่งครั้ง และ `RETURNED` ยังแก้ไขได้อยู่แล้ว
2. หนังสือรับออกเลขตอนลงทะเบียน (§6.3 *"สารบรรณลงทะเบียนรับ + ออกเลขรับ"*)
   `NUMBER_ISSUED` ของ `INCOMING` จึง**ไม่เปลี่ยนสถานะ** — อยู่ที่ `RECEIVED` เหมือนเดิม

### `src/server/services/document.service.ts`

ทุก transition เดินผ่าน `applyTransition()` ตัวเดียว เพื่อให้สามอย่างนี้เกิดครบเสมอ:
ตรวจสิทธิ์ด้วย `can()` + ด่าน STATE → เขียน `DocumentAction` (timeline ที่ผู้ใช้เห็น) →
เขียน `AuditLog` (ชั้นของผู้ตรวจสอบ — §6.4 ระบุว่าเป็นคนละชั้นกัน)

`createDocument` · `updateDocument` · `submitDocument` · `returnDocument` · `circulateDocument` ·
`acknowledgeDocument` · `markSentDocument` · `forwardDocument` · `closeDocument` · `cancelDocument` ·
`registerIncoming` (สร้าง + ออกเลขรับในทรานแซกชันเดียว)

- **รับทราบเป็นการกระทำระดับผู้รับ ไม่ใช่ระดับเอกสาร** — เอกสารปิดเรื่องเองเมื่อผู้รับชั้น `TO`
  ครบทุกรายรับทราบแล้ว (`CC`/`FYI` ไม่นับ เพราะเป็นแค่สำเนา)
- `issueNumber()` ถูกผ่าออกเป็น `issueNumberWithin(tx, …)` เพื่อให้การลงทะเบียนหนังสือรับ
  สร้างเอกสารและออกเลขจบในทรานแซกชันเดียว — ออกเลขพังแล้วเอกสารต้องไม่ค้างอยู่แบบไม่มีเลข

### ⚠️ กับดักที่เจอจริง — connection pool ตันเพราะอ่านค่าระบบผิดที่

ตอนย้าย `getSystemSettings()` เข้าไปอยู่ใน `issueNumberWithin` (ซึ่งอยู่ในทรานแซกชัน)
เทสต์ 50 ฉบับพร้อมกันเริ่มพังด้วย

```
PrismaClientKnownRequestError: Transaction API error:
Unable to start a transaction in the given time.
```

**สาเหตุ:** `getSystemSettings()` ใช้ `prisma` ตัวหลัก ไม่ใช่ `tx` → แต่ละทรานแซกชันจองไว้ใบหนึ่งแล้ว
ยังขอ connection ใบที่สองจาก pool เดียวกัน · pg pool ปริยายมี 10 ใบ พอ 10 ทรานแซกชันแรกจองครบ
ทุกตัวก็รอใบที่สองที่ไม่มีวันว่าง ส่วนอีก 40 ตัวก็เริ่มไม่ได้ — **deadlock ของ pool ทั้งก้อน**

**ทางแก้:** `getSystemSettings(tenantId, client)` รับ client ได้แล้ว · เรียกจากในทรานแซกชันให้ส่ง `tx`
เข้าไป จะได้ใช้ connection ใบเดิม · ใส่คอมเมนต์เตือนไว้ที่ตัวฟังก์ชันเพื่อไม่ให้พลาดซ้ำ

> อาการนี้จะไม่โผล่ตอนกดออกเลขทีละฉบับ แต่จะโผล่ตอน **bulk issue** ซึ่งอยู่ในขอบเขต P2 พอดี
> — เป็นเหตุผลที่ต้องมีเทสต์ยิงพร้อมกันจริง ๆ ไม่ใช่แค่ทดสอบทีละคำสั่ง

พร้อมกันนี้ตั้ง `maxWait: 15s` / `timeout: 30s` ให้ทรานแซกชันของ `issueNumber` เพราะการเข้าคิว
รอตัวนับเป็นเรื่องปกติของงานออกเลข ค่าปริยาย 2 วินาทีของ Prisma สั้นเกินไปสำหรับคิวหลายสิบฉบับ

### ผลทดสอบ

| ชุด | ผล |
|---|---|
| `state-machine.test.ts` (unit) | **16 เคส** — เดินครบทั้งสามเส้นทาง · กวาดทุกคู่ (สถานะ × transition) ว่าที่ไม่อยู่ในตารางต้องถูกปฏิเสธ |
| `document-flow.test.ts` (integration) | **10 เคส** บน Postgres จริง |
| `issue-number.test.ts` (integration) | 6 เคสเดิมยังผ่าน |

เคสสำคัญใน `document-flow`:

- บันทึกข้อความ: ร่าง → ส่ง → ออกเลข → เวียน → รับทราบ → **ปิดเรื่อง** · timeline เก็บครบ 5 ก้าวตามลำดับ
- ตีกลับ → แก้ไข → ส่งใหม่ได้
- หนังสือส่งภายนอก: ร่าง → ส่ง → ออกเลข → ส่งออก → ปิดเรื่อง · ใช้ทะเบียนคนละชุดกับบันทึกข้อความ
- **หนังสือรับ: ลงทะเบียนแล้วได้เลข `รับ 1/2569` ทันที → ส่งต่อ → รับทราบ → ปิดเรื่อง**
- สร้างหนังสือรับผ่าน `createDocument` ไม่ได้ — ต้องผ่านหน้าทะเบียนรับ
- ร่างออกเลขเองไม่ได้ · เอกสารที่ออกเลขแล้วแก้ไม่ได้ · ปิดเรื่องแล้วทำอะไรต่อไม่ได้
- **ยกเลิกหลังออกเลข: เลขเดิมยังติดอยู่กับฉบับที่ยกเลิก และฉบับถัดไปได้เลขใหม่ (ไม่นำกลับมาใช้ซ้ำ)**

รันซ้ำ 4 รอบผ่านทุกรอบ · ฐานข้อมูลสะอาดหลังเทสต์ (0 เอกสาร · 0 ทะเบียน · เหลือ 3 ประเภทหนังสือของจริง)

`lint · format · typecheck · unit 84 เคส · integration 16 เคส · build` ผ่านทั้งหมด

---

## 19. P2 — ไฟล์แนบ + StorageAdapter (25 ส.ค. 2569)

**ผู้ใช้ตัดสิน: ทำแบบไม่เข้ารหัสไปก่อน แล้วค่อยเพิ่มทีหลัง** → บันทึกเป็น **D18** ในสเปกแล้ว
พร้อมตาราง P2/P3 ใน §8.2 ว่าอะไรทำแล้วอะไรรอ

### สิ่งที่สร้าง

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/storage/local-fs.ts` | `LocalFsStorage` — เขียน/อ่าน/ลบไฟล์บนดิสก์ผ่าน `StorageAdapter` ที่วางไว้ตั้งแต่ P0 |
| `src/lib/storage/file-type.ts` | ตรวจชนิดไฟล์จาก **magic number** (§8.4) |
| `src/server/services/attachment.service.ts` | `uploadAttachment` · `listAttachments` · `openAttachment` · `deleteAttachment` |
| `src/app/api/files/[attachmentId]/route.ts` | ทางเดียวที่เข้าถึงไฟล์ได้ (§8.3) |

### เรื่องที่ตัดสินไว้ในโค้ด

- **ชื่อไฟล์บนดิสก์เป็น UUID ไม่ใช่ชื่อที่ผู้ใช้อัปโหลด** และ key ต้องผ่าน regex UUID เท่านั้น
  — กัน path traversal ออกนอกโฟลเดอร์ และกันชื่อไฟล์ภาษาไทย/อักขระพิเศษทำ path พัง
- **แตกโฟลเดอร์สองชั้นตามสองตัวอักษรแรกของ UUID** — กันโฟลเดอร์เดียวมีไฟล์เป็นแสนจนช้า
- **ตรวจ magic number ไม่ใช่แค่ Content-Type** — ทั้งนามสกุลและ Content-Type มาจากฝั่งผู้ใช้
  ปลอมได้ทั้งคู่ · docx/xlsx เป็น zip เหมือนกันจึงแยกด้วย magic ไม่ได้ ต้องเทียบกับ mime ที่แจ้งมาอีกชั้น
- **เขียนไฟล์ก่อนแล้วค่อยบันทึกฐานข้อมูล** ถ้าฐานข้อมูลพังต้องลบไฟล์กำพร้าทิ้งเอง (มี try/catch คุม)
- **ลบเป็น soft delete เท่านั้น ไฟล์บนดิสก์ยังอยู่** — ทะเบียนที่ออกเลขแล้วต้องตรวจย้อนหลังได้
  การลบไฟล์จริงต้องเป็นงานเก็บกวาดที่มีนโยบายกำกับ ไม่ใช่ผลข้างเคียงของปุ่มลบ
- **เขียน audit ทุกครั้งที่เปิดไฟล์** · เอกสารชั้นความลับ > 0 บันทึกที่ระดับ `NOTICE` ให้ผู้ตรวจสอบเห็นชัด
- ตอบ **401 ไม่ redirect** ที่ route handler เพราะผู้เรียกคือ `<iframe>`/`fetch` ไม่ใช่การกดลิงก์
- ชื่อไฟล์ภาษาไทยส่งกลับด้วย `filename*=UTF-8''…` (RFC 5987) ไม่งั้นเบราว์เซอร์อ่านเป็นตัวขยะ

### ⚠️ ข้อจำกัดที่ต้องรู้ระหว่างยังไม่เข้ารหัส

ใครที่เข้าถึงดิสก์ของเซิร์ฟเวอร์ได้ จะอ่านไฟล์แนบได้ทั้งหมดโดยไม่ผ่าน `can()` และไม่ทิ้งร่องรอยใน audit
— **ห้ามนำเอกสารชั้นความลับ 1–3 เข้าระบบจนกว่าจะปิดงาน P3** (เขียนเตือนไว้ใน spec §8.2 แล้ว)

### ที่เก็บไฟล์

- ค่าปริยาย `./storage/attachments` · ตั้งผ่าน `STORAGE_ROOT` ได้
- `docker-compose.yml` ผูก volume `file-storage` ที่ `/app/storage` ไว้ตั้งแต่ P0 อยู่แล้ว — ตรงกับค่าปริยายพอดี
- เพิ่ม `/storage` ใน `.gitignore` และ `storage` ใน `.dockerignore` — ไฟล์แนบเป็นข้อมูลจริงของหน่วยงาน
  ห้ามเข้า git และไม่ต้องเข้า image

### ผลทดสอบ

| ชุด | ผล |
|---|---|
| `file-type.test.ts` (unit) | **11 เคส** — รวมเคสไฟล์ zip และไฟล์ .exe ที่อ้างว่าเป็น PDF ต้องถูกปฏิเสธ |
| `attachment.test.ts` (integration) | **11 เคส** — เขียนไฟล์ลงดิสก์จริงแล้วอ่านกลับมาเทียบ byte ต่อ byte |

เคสสำคัญ: sha256 ตรง · เวอร์ชันเดินถูก · **ไฟล์ปลอมนามสกุลถูกปฏิเสธ** · ชนิดที่ไม่อนุญาตถูกปฏิเสธ ·
ไฟล์เกินขนาดที่ตั้งใน `/admin/settings` ถูกปฏิเสธ · เปิดไฟล์แล้ว audit เพิ่มจริง ·
soft delete แล้วเปิดไม่ได้แต่ไฟล์ยังอยู่บนดิสก์ · เอกสารที่ออกเลขแล้วยังแนบเวอร์ชันใหม่ได้ ·
เอกสารที่ปิดเรื่องแล้วแนบไม่ได้

`lint · format · typecheck · unit 95 เคส · integration 27 เคส · build` ผ่านทั้งหมด

---

## 20. P2 — UI ทั้งเฟส + บั๊กที่การรันจริงจับได้ (25 ส.ค. 2569)

ปิด P2 ครบทั้งเฟส · commit `cc8d4a1` → `882298a` (17 commit ขึ้น `origin/main` แล้ว)
ทุกหน้าใน §10.1 มีของจริงหมด ไม่เหลือ ComingSoon ในสายเอกสาร/ทะเบียน
(เหลือ `/search` กับ `/reports/register` ซึ่งเป็น P4)

### หน้าที่ส่งมอบ

| หน้า | สาระ |
|---|---|
| `/drafts` `/inbox` `/outbox` | ตารางเดียวสลับคอลัมน์ตามกล่อง · ค้นหา · กรอง · แบ่งหน้า |
| `/documents/new` · `/documents/[id]/edit` | ฟอร์มเดียวสามโหมด (สร้าง · แก้ไข · ลงทะเบียนหนังสือรับ) |
| `/documents/[id]` | รายละเอียด + timeline + ปุ่ม transition + แผงไฟล์แนบ + ผู้รับ |
| `/registry/outgoing` | คิวออกเลข ติ๊กหลายฉบับแล้วออกเลขทีเดียว |
| `/registry/sent` · `/registry/incoming` (+ `/new`) | ทะเบียนส่ง · ทะเบียนรับ + ลงทะเบียนหนังสือรับ |
| `/admin/numbering` | ตั้ง pattern ต่อประเภทหนังสือ และต่อทะเบียนรายหน่วยงาน |

### ⚠️ บั๊กสามตัวที่เทสต์เดิมไม่จับ — เจอตอนรันจริงกับเบราว์เซอร์

**1. ค้นหาแล้วด่านสิทธิ์หายทั้งด่าน** — `listDocuments()` ประกอบ `where` ด้วย spread
ทำให้คีย์ `OR` ของขอบเขตสิทธิ์ถูก `OR` ของคำค้นเขียนทับเงียบ ๆ ผู้ใช้ scope `OWN`
ที่พิมพ์ค้นหาจึงเห็นเอกสารทั้ง tenant · แก้ด้วยการต่อทุกเงื่อนไขเป็น `AND: [...]`
ซึ่งทำให้ตัวกรองของผู้ใช้ "ตัดกับ" นิยามของกล่อง แทนที่จะเขียนทับ

**2. ออกเลขซ้ำได้ เลขเดิมหายจากทะเบียน** — หนังสือรับอยู่ที่ `RECEIVED` ทั้งก่อนและ
หลังออกเลข (§6.3) ตาราง transition จึงยอมให้ `NUMBER_ISSUED` ซ้ำไม่รู้จบ · กดจริงแล้ว
`รับ 1/2569` กลายเป็น `รับ 2/2569` บนเอกสารฉบับเดิม เลข 1 หายไปโดยไม่มีเอกสารถือไว้
และตัวนับเดินฟรี — ตรงกับสิ่งที่ §6.4 เรียกว่าสัญญาณของการทุจริต

> แก้ด้วย `canIssueNumber(direction, status, docNo)` ใน state machine ที่เดียว
> แล้วให้ทั้ง `issueNumberWithin()` (ด่านจริง) และหน้ารายละเอียด (ซ่อนปุ่ม) ใช้ตัวเดียวกัน
> **บทเรียน: สถานะอย่างเดียวตอบไม่ได้ว่าออกเลขได้ไหม เมื่อ transition ไม่เปลี่ยนสถานะ**

**3. ผู้รับซ้ำจนปิดเรื่องเองไม่ได้ตลอดกาล** — ตั้งผู้รับตอนร่างแล้วเวียนถึงหน่วยเดิม
ได้ผู้รับสองแถว · การปิดเรื่องอัตโนมัติรอให้ผู้รับชั้น `TO` **ทุกแถว** รับทราบ
แถวที่ซ้ำมาค้างอยู่ที่ `PENDING` โดยไม่มีใครเห็นว่ามันมีอยู่ · `createRecipients()`
กันซ้ำสองชั้นแล้ว (ซ้ำในคำสั่งเดียว และซ้ำกับผู้รับเดิม → อัปเดตแถวเดิมแทนเพิ่มใหม่)

ทั้งสามตัวมีเทสต์คุมแล้ว และ **ยืนยันว่าเทสต์จับได้จริง** ด้วยการถอดโค้ดที่แก้ออก
ชั่วคราวแล้วรัน — เทสต์แดงตรงเคสที่ตั้งใจให้จับพอดี แล้วจึงคืนโค้ดกลับ

### เรื่องเล็กที่แก้ไปพร้อมกัน

- ปุ่ม "รับทราบ" เคยขึ้นกับคนที่ไม่ใช่ผู้รับ แล้วกดไม่ได้ · ตอนนี้กรองตอน render
- `updateDocument()` เขียน `documentTypeId` ดิบ ๆ สลับข้ามทิศทางได้ → ตรวจแล้ว
- ฟอร์มที่ไม่ส่งค่าช่องที่ตัวเองไม่ได้แสดง (`parentDocumentId` · `externalSenderName`)
  ทำให้ service เขียนทับเป็น `null` → ส่งคืนเป็น hidden input
- ตัวเลือกหน่วยงานผู้รับเคยเป็น `<select multiple>` 372 บรรทัด → เปลี่ยนเป็นช่องค้นหา
  พร้อมช่องติ๊ก **ที่ยัง render ครบทุกหน่วยแล้วซ่อนด้วย CSS** เพราะถ้าถอดออกจาก DOM
  ตามคำค้น ตัวที่ติ๊กไว้ก่อนหน้าจะหลุดจากฟอร์มทันที

### กับดักของ dev server

`prisma.document is undefined` ตอนเปิด `/drafts` — เกิดจาก dev server ที่รันค้างอยู่
ใช้ Prisma client รุ่นก่อน `prisma generate` · **ต้องรีสตาร์ท dev server ทุกครั้ง
หลัง generate** ไม่ใช่บั๊กของโค้ด แต่เสียเวลาไล่หาถ้าไม่รู้

### ผลทดสอบ

| ชุด | ผล |
|---|---|
| unit | **99 เคส** (เพิ่ม 4 เคสของ `canIssueNumber`) |
| integration | **38 เคส** (เพิ่ม `document-list.test.ts` 9 เคส + flow อีก 2) |
| ทดสอบด้วยมือบนเบราว์เซอร์ | ร่าง → แนบไฟล์ → แก้ไข → ส่ง → ออกเลข `510000/0001` → เวียน → ปิดเรื่อง · ลงทะเบียนหนังสือรับได้ `รับ 3/2569` · ตั้ง pattern ที่ `/admin/numbering` |

`lint · format · typecheck · build (30 routes)` ผ่านทั้งหมด

### ⏳ ต้องตัดสินก่อนไป P3

1. **§15 ข้อ 5** — เลขทะเบียนรีเซ็ตตามปีงบประมาณหรือปีปฏิทิน · ตอนนี้ `CALENDAR`
   **ต่างกันจริงเมื่อถึง 1 ต.ค. 2569** ถ้าต้องรีเซ็ตวันนั้นต้องเปลี่ยนก่อนถึงวันดังกล่าว
2. **ช่องว่าง §7.1** — สเปกอยากได้ pattern ต่อ (หน่วยงาน × ประเภท × ทิศทาง) แต่ schema
   มีแค่สองชั้น และ override รายหน่วยงานผูกกับ **ปี** จึงต้องตั้งใหม่ทุกปี ·
   ถ้าจะเอาตามสเปกเป๊ะต้องเพิ่มตาราง + migration + แก้ลำดับการอ่าน pattern
3. **D18** — ไฟล์แนบยังไม่เข้ารหัส · **ห้ามนำเอกสารชั้นความลับ 1–3 เข้าระบบจนกว่าจะปิด P3**

หน้าภาพรวมยังไม่มีสถิติหนังสือ (คิวออกเลข · ค้างรับทราบ) — แบนเนอร์บอกไว้ตรง ๆ แล้ว

---

## 21. P3 — Security & Confidential ทั้งเฟส (25 ส.ค. 2569)

ปิด P3 ครบทุกข้อ · เอกสารชั้นความลับใช้งานได้จริงตั้งแต่ต้นทางถึงปลายทางเป็นครั้งแรก

**สามคำถามที่เคลียร์ก่อนเริ่ม** — ผู้ใช้ตัดสินว่า (1) ยังตอบเรื่องนโยบายเอกสาร "ลับที่สุด" ไม่ได้
ให้ทำการเข้ารหัสไปก่อน (2) ฐานปีของเลขทะเบียนคง `CALENDAR` แล้วกลับมาตัดสินหลัง P3
(3) ช่องว่าง §7.1 คง pattern สองชั้นไว้ ยังไม่แก้ · ต่อมาเคาะเพิ่มว่าเข้ารหัส **เฉพาะชั้น 1–3**

### 21.1 สิ่งที่ส่งมอบ

| ส่วน | ของจริงที่ได้ |
|---|---|
| `src/lib/crypto/` | envelope encryption — DEK ต่อไฟล์ (AES-256-GCM) wrap ด้วย Master Key จาก env · รองรับกุญแจหลายรุ่นเพื่อหมุนกุญแจ · `KeyProvider` เผื่อต่อ Vault/HSM |
| `attachment.service` | เข้ารหัสตอนอัปโหลดเมื่อเอกสารเป็นชั้น 1–3 · ถอดแบบ stream ตอนเปิด · ไล่เข้ารหัสไฟล์เดิมเมื่อปรับชั้นขึ้น |
| `scripts/encrypt-attachments.ts` | `pnpm files:encrypt` backfill ไฟล์ P2 ที่ยัง plaintext (มี `--dry-run` · รันซ้ำได้) |
| `src/lib/pdf/` | ลายน้ำ ชื่อผู้เปิด + username + วันเวลา + IP ทับทุกหน้าแบบทแยง · ฝังฟอนต์สารบรรณ (Sarabun · OFL) |
| `acl.service` + `/documents/[id]` | ให้/ถอนสิทธิ์รายบุคคล พร้อมเหตุผลบังคับกรอกและวันหมดอายุ |
| `src/proxy.ts` | CSP แบบ nonce + security headers ครบตาม §8.4 |
| rate limit | เพิ่มให้หน้าสมัครและหน้าลืมรหัสผ่าน (เดิมมีแค่ตอนล็อกอิน) |

### 21.2 ⚠️ เส้นทางเอกสารลับใช้งานไม่ได้เลยตั้งแต่ P2 — เจอตอนเขียนเทสต์ของ P3

`can()` บังคับตาม §4.3 ข้อ 5 ว่าเอกสารลับต้องมี ACL ระบุตัวบุคคล ห้าม inherit จาก scope
แต่ **ไม่มีโค้ดตรงไหนสร้าง `DocumentAcl` เลยสักที่** ผลคือ

1. **สร้างเอกสารชั้นลับไม่ได้ 100%** — ด่านตอนสร้างไปตรวจหา ACL ของเอกสารที่ยังไม่เกิด
2. **ปรับชั้นขึ้นทีหลังแล้วล็อกตัวเองออก** — ด่านใช้ชั้น*เดิม*จึงผ่าน พอบันทึกเสร็จเจ้าของอ่านเอกสารตัวเองไม่ได้
3. **ผู้รับที่ถูกเวียนถึงอ่านไม่ได้** — ไม่มีใครออก ACL ให้

ไม่มีใครเจอใน P2 เพราะทดสอบด้วยเอกสารชั้น 0 ทั้งหมด · และงานเข้ารหัสที่เพิ่งทำจะไม่มีวันถูกเรียกใช้จริง
ถ้าไม่แก้ตรงนี้ · **บทเรียน: ด่านที่ไม่มีใครเดินผ่านได้เลย ไม่ต่างอะไรกับด่านที่ไม่มีอยู่จริง**

> แก้ด้วยการออก ACL อัตโนมัติ — ผู้สร้างได้ `MANAGE` · ผู้รับที่เวียนถึงได้ `DOWNLOAD` ·
> คนที่ปรับชั้นขึ้นได้ `MANAGE` ด้วย (เขาเข้าถึงได้อยู่แล้วก่อนปรับ) · ทุกใบมีแถวใน audit

### 21.3 บั๊กอื่นที่เจอระหว่างทาง

**`can()` ไม่เคยดูว่า ACL ให้สิทธิ์อะไรไว้** — ด่าน ACL สนใจแค่ "ตรงตัวบุคคลไหม" ทำให้ ACL
ที่ให้ไว้แค่ "ดูได้" กลายเป็นสิทธิ์แก้ไข-ลบ-ให้สิทธิ์ต่อทันที · เพิ่มตาราง `ACL_COVERAGE` ตาม §9.1
(VIEW → อ่าน · DOWNLOAD → +เปิดไฟล์ · EDIT → +แก้/แนบ/ส่ง · MANAGE → ทุกอย่าง)
ฝั่ง DENY **จงใจ**ไม่ดูชนิดสิทธิ์ เพราะห้ามคนหนึ่งจากเอกสารฉบับหนึ่งแล้วต้องห้ามทั้งฉบับ

**`issueNumber()` กับ `deleteAttachment()` ประกอบ authz resource เองโดยไม่ส่ง `acl`/`recipients`**
`can()` จึงตัดสินจากข้อมูลไม่ครบแล้วปฏิเสธเอกสารลับทุกฉบับ · รวมทุกจุดให้ใช้ `toAuthzResource()`
ตัวเดียว และบังคับให้ query ดึง `recipients` + `acls` มาด้วยเสมอ

**`createDecryptStream()` ทำทั้งโปรเซสตายได้** — `source.pipe()` ทำให้ข้อมูลเริ่มไหลทันทีที่สร้าง
stream แต่ `openAttachment()` แวะไปเขียน audit ก่อนส่งไฟล์ · ไฟล์เล็กที่ `authTag` ไม่ผ่านจะโยน error
ตอนที่ยังไม่มีใครแนบ error listener → **uncaught exception** · เปลี่ยนเป็น `Readable.from(generator)`
ที่เริ่มไหลเมื่อมีคนอ่านจริง · **บทเรียน: stream ที่คืนออกไปต้องไม่เริ่มทำงานก่อนถูกอ่าน**

**`next build` ก๊อปไฟล์แนบจริงเข้า Docker image** — ตัวไล่หาไฟล์ของ Next เห็น path ของ
`LocalFsStorage` แล้วลาก `storage/attachments/` เข้าไปใน `.next/standalone` ด้วย ·
ตอนรัน volume ทับก็จริง แต่ไฟล์นอนอยู่ใน layer ของ image ตลอดไป · แก้ด้วย
`outputFileTracingExcludes` + เพิ่ม `storage` ใน `.dockerignore`

**เวียนเอกสารลับถึงคนที่ชั้นความลับไม่ถึงได้เงียบ ๆ** — ระบบออก ACL ให้ครบ แต่ผู้รับเปิดไม่ได้
ผู้ส่งก็คิดว่าส่งแล้ว · ตอนนี้ปฏิเสธพร้อมบอกชื่อคนที่ชั้นไม่ถึง เช่นเดียวกับตอนให้สิทธิ์ด้วยมือ

### 21.4 เรื่องที่ตัดสินไว้ในโค้ด

- **DEK ต่อไฟล์ ไม่ใช่กุญแจเดียวทั้งระบบ** — กุญแจหลุดครั้งเดียวไม่เสียทุกไฟล์ และหมุนกุญแจ
  แค่ re-wrap DEK ก้อนเล็ก ไม่ต้องถอด-เข้ารหัสไฟล์ 50MB ใหม่ทั้งระบบ
- **รองรับกุญแจหลายรุ่นตั้งแต่วันแรก** `FILE_MASTER_KEY="2:<ใหม่>,1:<เดิม>"` — ถ้าไม่ทำตอนนี้
  วันที่ต้องหมุนกุญแจจริงจะหมุนไม่ได้เลย
- **เข้ารหัสเฉพาะชั้น 1–3** (ผู้ใช้เคาะ) — ผลคือไฟล์ชั้น 0 ยังอ่านตรงจากดิสก์ได้ **โดยตั้งใจ**
- **แปะลายน้ำไม่สำเร็จ = ไม่ส่งไฟล์** ไม่ใช่ fallback เป็นต้นฉบับ เพราะนั่นคือปล่อยเอกสารลับ
  ออกไปโดยไม่มีร่องรอยว่าใครเปิด
- **ให้สิทธิ์ได้เฉพาะรายบุคคล** ทั้งที่ schema รองรับ ORG_UNIT/ROLE — ACL แบบกลุ่มไม่ช่วยให้
  เอกสารลับเปิดได้ (§4.3 ข้อ 5 ดูเฉพาะ ACL ที่ระบุตัวคน) เปิดช่องให้เลือกมีแต่จะทำให้เข้าใจผิด
- **ถอนสิทธิ์เจ้าของเรื่องไม่ได้** — เอกสารลับที่ไม่เหลือ ACL คือเอกสารที่ไม่มีใครแตะได้อีกตลอดไป
- **CSP ใช้ nonce ไม่ใช่ `unsafe-inline`** — ต้นทุนปกติคือทุกหน้าต้อง render สดทุก request
  แต่แอปนี้ทุก route เป็น dynamic อยู่แล้วเพราะอ่านเซสชัน จึงไม่เสียอะไรเพิ่ม
- **`/api` ถูกยกเว้นจาก CSP** — `object-src 'none'` จะบล็อกตัวแสดง PDF ในตัวของเบราว์เซอร์

### 21.5 ⚠️ กับดักของ Next รุ่นนี้ — `middleware` ถูกเปลี่ยนชื่อเป็น `proxy`

ไฟล์ต้องชื่อ `src/proxy.ts` และ export ฟังก์ชันชื่อ `proxy` · ถ้าเขียนเป็น `middleware.ts`
ตามที่คุ้นเคย **ไฟล์จะไม่ถูกเรียกเลยและ CSP จะไม่มีผล โดยไม่มี error อะไรเตือน**
(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`)

### 21.6 ผลทดสอบ

| ชุด | ผล |
|---|---|
| unit | **147 เคส** (P2 จบที่ 99 · +21 crypto +6 ACL coverage +5 ลายน้ำ +8 CSP/header +8 rate limit) |
| integration | **67 เคส** (P2 จบที่ 38 · +11 การเข้ารหัส/ลายน้ำ +18 เอกสารลับและ ACL) |
| ทดสอบด้วยมือบน production build | header ครบ 6 ตัว · `<script>` ทุกแท็กมี nonce (0 แท็กที่ขาด) ใน `/login` `/dashboard` `/drafts` `/admin/audit` · `/admin/org-units` ที่มี `style=""` ยังแสดงถูก · `/api/files` ไม่มี CSP มาแทรก |
| ทดสอบด้วยมือบน dev | เปิดเอกสารลับเห็นแผงสิทธิ์ครบ (เจ้าของเรื่อง · ระบบออกให้ · ช่องค้นหา) · เอกสารชั้น 0 เห็นแผงว่างและไม่มีแถบเตือนลายน้ำ |

`lint · format · typecheck · build (27 routes + Proxy)` ผ่านทั้งหมด

ยืนยันว่าเทสต์จับบั๊กได้จริงด้วยการถอดโค้ดที่แก้ออกชั่วคราวแล้วรัน — ACL coverage แดง 4 เคสตรงจุด ·
`createDecryptStream` แบบเดิมทำให้ vitest รายงาน uncaught exception แล้วจึงคืนโค้ดกลับ

### 21.7 ⏳ ของที่ยังค้างหลังปิด P3

1. **§15 ข้อ 5 — ฐานปีของเลขทะเบียน** ผู้ใช้ขอกลับมาตัดสินหลัง P3 · ตอนนี้ `CALENDAR`
   **ต่างกันจริงเมื่อถึง 1 ต.ค. 2569** ถ้าจะใช้ปีงบประมาณต้องเปลี่ยนก่อนวันนั้น
2. **§15 ข้อ 6 — นโยบายเอกสาร "ลับที่สุด"** ยังไม่มีคำตอบว่าองค์กรอนุญาตให้เข้าระบบอิเล็กทรอนิกส์ไหม ·
   โค้ดรองรับครบทุกชั้นแล้ว ถ้าคำตอบคือไม่อนุญาต ต้องเพิ่มค่า setting ปิดชั้น 3
3. **ช่องว่าง §7.1** — pattern ต่อ (หน่วยงาน × ประเภท × ทิศทาง) ยังเป็นสองชั้นตามที่ผู้ใช้เคาะ
4. **ลายน้ำได้เฉพาะ PDF** — ไฟล์ลับที่เป็นรูปภาพ/Word/Excel เปิดได้แต่ไม่มีลายน้ำ
5. **rate limit เก็บใน memory ของ process เดียว** — ถ้าวันหลัง scale หลาย instance ต้องย้ายไป Redis
6. **ยังไม่มี CI · pre-commit hook · Playwright e2e** — ตามที่ผู้ใช้สั่งข้ามไว้ตั้งแต่ P0

**ถัดไปคือ P4 — Search & Reports** (ค้นหาขั้นสูงด้วย pg_trgm · Dashboard สถิติ ·
ทะเบียนหนังสือ + Export Excel/PDF) · หน้า `/search` กับ `/reports/register` ยังเป็นหน้ารอพัฒนาอยู่

---

## 22. P4 — Search & Reports ทั้งเฟส (26 ส.ค. 2569)

ปิด P4 ครบทุกข้อ · **ทุกหน้าในสเปกมีของจริงหมดแล้ว ไม่เหลือ `ComingSoon` สักหน้า**

### 22.1 สิ่งที่ส่งมอบ

| ส่วน | ของจริงที่ได้ |
|---|---|
| `/search` + `search.service` | ค้นหาขั้นสูง §10.1 · ILIKE วิ่งเข้า GIN + pg_trgm · ไม่ใส่เงื่อนไข = ไม่คืนอะไร |
| `document-visibility.ts` | ด่านขอบเขต **ที่เดียว** ของทั้งระบบ — กล่องเอกสาร · ค้นหา · ภาพรวม · ทะเบียน · export |
| หน้าภาพรวม | สถิติหนังสือ (คิวออกเลข · รอฉันรับทราบ · ร่าง/ตีกลับ · ออกเลขเดือนนี้) แทนแบนเนอร์ของ P2 |
| `ConfidentialRegistrar` + ACL `REGISTER` | นายทะเบียนหนังสือลับต่อหน่วยงาน — ตั้งได้หลายคน · ออกเลขได้แต่เปิดไฟล์แนบไม่ได้ |
| `/reports/register` + `report.service` | ทะเบียนหนังสือรับ/ส่งตามแบบระเบียบสารบรรณ |
| `src/lib/reports/` | Export Excel (`exceljs` · ฟอนต์ TH SarabunPSK) และ PDF (`pdf-lib` + Sarabun · A4 แนวนอน) |

### 22.2 ⚠️ ด่านชั้นความลับมีแค่ตอนเปิดเอกสาร ไม่เคยมีตอน list

`can()` + `assertClearance()` ทำงานตอนกดเปิดเอกสารรายฉบับเท่านั้น ส่วนทุกหน้าที่ **list**
เอกสารกรองแค่ขอบเขตหน่วยงาน ไม่เคยกรองชั้นความลับเลยตั้งแต่ P2 ผลคือ

1. **หน้าค้นหาคืนชื่อเรื่องของเอกสารลับ**ให้ทุกคนที่อยู่ในขอบเขตหน่วยงานเดียวกัน ·
   ชื่อเรื่องของหนังสือราชการลับคือตัวความลับเอง ("ผลการสอบสวนทางวินัยของ...")
2. **ค้นเข้าไปใน `summary` ได้** จึงเดาคำทีละคำจนยืนยันเนื้อหาได้โดยไม่ต้องเปิดไฟล์สักครั้ง
3. **กรองชั้นความลับตรง ๆ** แล้วกวาดรายชื่อเอกสารลับทั้งองค์กรออกมาได้ในคำสั่งเดียว

> แก้ที่ `confidentialWhere()` ใน `document-visibility.ts` ที่เดียว: ชั้น 0 ผ่านปกติ ·
> ชั้น 1–3 ต้อง clearance ถึง **และ** มี ACL รายบุคคลที่ยังไม่หมดอายุ · DENY ตัดออกทุกชั้น
> — เงื่อนไขสะท้อน `can()` ให้ตรง ไม่ใช่กฎชุดที่สองที่จะเพี้ยนออกจากกันวันหลัง

ด่านนี้ใช้กับ "ร่างของฉัน" และ "กล่องรับ" ด้วย ทั้งที่สองกล่องข้ามด่านหน่วยงานได้ —
เอกสารที่เราสร้างเองแล้วถูกคนอื่นปรับชั้นขึ้นและถอนสิทธิ์เราออก ต้องหายจากร่างของฉันด้วย

### 22.3 ⚠️ สารบรรณออกเลขเอกสารลับไม่ได้เลยตั้งแต่ P3 — และไม่มีใครเจอ

§4.3 ข้อ 5 บังคับว่าเอกสารชั้น ≥1 ต้องมี ACL ระบุตัวบุคคล แต่ ACL อัตโนมัติของ P3
ออกให้แค่ผู้สร้าง · ผู้รับ · คนปรับชั้น — **ไม่มีสารบรรณ** · เทสต์ทั้งหมดออกเลขด้วยเอกสาร
ชั้น 0 จึงไม่มีใครเดินผ่านเส้นทางนี้ · ซ้ำร้าย พอ §22.2 ทำให้เอกสารลับหายจากคิวไปด้วย
ปัญหาจะเปลี่ยนจาก "ค้างแบบเห็น ๆ" เป็น "ค้างแบบเงียบ"

> ทางออกไม่ใช่ผ่อนด่าน แต่คือเติมตำแหน่งที่ **ระเบียบว่าด้วยการรักษาความลับของทางราชการ
> 2544 มีอยู่แล้วแต่ระบบยังไม่มี** — นายทะเบียนหนังสือลับ ที่แต่งตั้งเป็นรายชื่อชัดเจน
> ต่อหน่วยงาน · ตั้งได้หลายคนเพราะของจริงต้องมีผู้ช่วยไว้ตอนคนหลักลา ไม่งั้นเอกสารลับ
> ทั้งหน่วยงานค้างคิวจนกว่าเขาจะกลับมา

**สิ่งที่ผู้ใช้เคาะ** (4 ข้อ): ตั้งได้หลายคนต่อหน่วยงาน · ให้แค่ออกเลข+เห็นชื่อเรื่อง
ไม่เปิดไฟล์แนบ · หน่วยงานที่ยังไม่ตั้งให้ปฏิเสธตั้งแต่ตอนกดส่ง · สิทธิ์อยู่ถาวร

ACL ชนิด `REGISTER` ครอบคลุมแค่ `document.read` + `document.number.issue` · ทางเลือก
เดียวที่มีอยู่เดิมคือ `MANAGE` ซึ่งเท่ากับให้แก้เอกสาร ลบไฟล์ และให้สิทธิ์คนอื่นต่อ

### 22.4 ⚠️ กับดัก: `migrate dev` สั่งลบ index ของ pg_trgm ทิ้ง

index ทั้งสาม (`documents_subject_trgm_idx` · `documents_docNo_trgm_idx` ·
`documents_searchVector_idx`) สร้างด้วย raw SQL ใน migration ของ P2 และไม่เคยถูกประกาศ
ใน `schema.prisma` · Prisma จึงเห็นเป็นส่วนเกินแล้วใส่ `DROP INDEX` มาให้ในทุก migration
ถัดจากนั้น · ลบไปแล้วการค้นยังทำงาน**ถูก** แต่กลายเป็น seq scan ทั้งตาราง ซึ่งเทสต์บน
ฐาน dev ที่มีข้อมูลน้อยจับไม่ได้เลย

> แก้ถาวรด้วยการประกาศทั้งสามใน schema (`@@index([subject(ops: raw("gin_trgm_ops"))],
> type: Gin)`) ไม่ใช่แค่ลบบรรทัดออกจากไฟล์ migration ซึ่งจะกลับมาใหม่ทุกครั้ง

**ถ้า `prisma migrate` ค้างที่ `pg_advisory_lock`** แปลว่ามี session ของ migrate เก่าค้างอยู่
(ครั้งนี้ค้างมา 21 ชั่วโมงจากคำสั่งที่ถูกตัดกลางคันตอนลบ shadow database) · ดูด้วย psql ที่
`pg_stat_activity` + `pg_locks` แล้ว `pg_terminate_backend(pid)`

### 22.5 เรื่องที่ตัดสินไว้ในโค้ด

- **หน้าค้นหาที่ไม่ใส่เงื่อนไขคืนศูนย์แถว** ไม่ใช่เทเอกสารทั้งองค์กรใส่หน้าจอ — หน้าที่เปิดมา
  แล้วโชว์ทุกอย่างคือการทำให้ข้อมูลรั่วโดยไม่มีใครตั้งใจค้น
- **`report.view` แยกจาก `report.export`** — ดูบนจอกับดึงไฟล์ออกไปไม่เท่ากัน ทุกครั้งที่ดึงไฟล์
  มีแถวใน audit พร้อมจำนวนเอกสารชั้นความลับที่ติดไปในไฟล์นั้น
- **เลขที่ยกเลิกยังอยู่ในทะเบียน** พร้อมหมายเหตุ ไม่ถูกกรองทิ้ง (§6.4)
- **นิยามคอลัมน์อยู่ที่เดียว** (`register-format.ts`) — หน้าเว็บ Excel PDF อ่านจากตัวเดียวกัน
- **Excel ตั้งฟอนต์ TH SarabunPSK ทุกเซลล์** ฟอนต์ปริยายของ Excel เรนเดอร์สระกับวรรณยุกต์
  ไทยลอยผิดตำแหน่ง · เลือก .xlsx ไม่ใช่ CSV เพราะ CSV คุมฟอนต์และหัวตารางไม่ได้เลย
- **PDF ตัดบรรทัดทีละอักขระ** เพราะภาษาไทยไม่มีเว้นวรรคระหว่างคำ ตัดตามช่องว่างอย่างเดียว
  จะได้บรรทัดยาวทะลุออกนอกกระดาษ
- **ถอนสิทธิ์นายทะเบียนจากหน้าเอกสารด้วยมือไม่ได้** สิทธิ์มาจากตำแหน่ง ต้องแก้ที่หน่วยงาน

### 22.6 ผลทดสอบ

| ชุด | ผล |
|---|---|
| unit | **151 เคส** (P3 จบที่ 147 · +4 ACL coverage ของ REGISTER) |
| integration | **117 เคส** (P3 จบที่ 67 · +18 ค้นหา/ภาพรวม +12 นายทะเบียนลับ +12 ทะเบียน +8 ด่านชั้นความลับของ list) |

ยืนยันว่าเทสต์จับได้จริงสองรอบ — เคสด่านชั้นความลับของ list แดง 7 เคสก่อนแก้ ·
เคสนายทะเบียนแดง 12 เคสก่อนแก้ · และถอด `documentVisibilityWhere` ออกจากทะเบียน
ชั่วคราวแล้วรัน แดงตรงเคสเอกสารลับเคสเดียวตามที่ควรเป็น แล้วจึงคืนโค้ดกลับ

`lint · format · typecheck · build (28 routes + Proxy)` ผ่านทั้งหมด

### 22.7 ⏳ ของที่ยังค้างหลังปิด P4

1. **§15 ข้อ 5 — ฐานปีของเลขทะเบียน** ยังเป็น `CALENDAR` · **ต่างกันจริงเมื่อถึง 1 ต.ค. 2569**
2. **§15 ข้อ 6 — นโยบายเอกสาร "ลับที่สุด"** ยังไม่มีคำตอบ
3. **ช่องว่าง §7.1** — pattern ยังเป็นสองชั้นตามที่ผู้ใช้เคาะ
4. **รูปแบบทะเบียนที่ส่ง สกอ./ผู้ตรวจภายใน** — ใช้แบบมาตรฐานของระเบียบไปก่อน ยังไม่ได้
   เทียบกับไฟล์จริงที่หน่วยงานใช้อยู่
5. **นายทะเบียนหนังสือลับตีกลับเอกสารไม่ได้** (`REGISTER` ไม่ครอบคลุม `document.return`)
   ถ้าติดตอนใช้จริง เพิ่มหนึ่งบรรทัดใน `ACL_COVERAGE` ที่ `src/lib/authz/can.ts`
6. **ลายน้ำได้เฉพาะ PDF · rate limit อยู่ใน memory · ยังไม่มี CI/pre-commit/Playwright**
7. **ยังไม่ได้ทดสอบหน้าจอด้วยมือ** — หน้า `/reports/register` กับแผงตั้งนายทะเบียนผ่านแต่
   เทสต์ฝั่ง service และ build เท่านั้น

**ถัดไปคือ P5 — Incoming & Hardening** (Notification in-app · Responsive polish ·
Playwright e2e · Backup script · คู่มือผู้ใช้ + UAT)

---

## 23. P5 — Incoming & Hardening (26 ส.ค. 2569 · ยังไม่ปิดเฟส)

เฟสนี้ยังทำอยู่ · บันทึกนี้ครอบสองก้อนแรกที่เสร็จแล้ว — **สคริปต์สำรองข้อมูล** และ **Playwright e2e**

### 23.1 สิ่งที่ส่งมอบแล้ว

| ส่วน | ของจริงที่ได้ |
|---|---|
| `scripts/backup.sh` · `scripts/restore.sh` | สำรอง/กู้คืนทั้งฐานและไฟล์แนบ · **รายละเอียดอยู่ที่ `docs/backup.md`** |
| `playwright.config.ts` | ชุด e2e ที่วิ่งบน **production build เท่านั้น** (เหตุผลที่ §23.2) |
| `tests/e2e/smoke.spec.ts` | 11 เคส — เปิด 10 หน้าหลักโดยไม่มี error ในคอนโซล + เมนูที่ไม่มีสิทธิ์ต้องไม่โผล่ |
| `tests/e2e/document-flow.spec.ts` | 2 เคส — ร่าง → ส่งให้สารบรรณ → ออกเลข → เห็นในทะเบียนส่ง · และ §6.4 ออกเลขแล้วห้ามแก้ |
| `tests/e2e/report-export.spec.ts` | 5 เคส — หัวทะเบียน · ตำแหน่ง banner · Excel/PDF ที่เปิดได้จริง · ค้นไทยกลางคำ |
| `tests/e2e/fixtures/` | บัญชี `e2e.runner` ของเทสต์เอง + teardown ลบเอกสารที่ขึ้นต้นด้วย `[e2e]` |
| `src/proxy.ts` | ถอด `'unsafe-inline'` ที่เป็นโค้ดตายออกจาก `style-src` (§23.3) |
| `src/lib/notification/` | `InAppNotificationAdapter` + ชนิดการแจ้งเตือน + ตัวประกอบลิงก์ (§23.8) |
| `notification.service.ts` | ใครควรรู้เรื่องอะไร · และด่านกรองตอนอ่าน (§23.9 · §23.10) |
| กระดิ่ง + `/notifications` | ปลดล็อกปุ่มที่ค้าง `disabled` มาตั้งแต่ P2 · หน้ารายการเต็ม |
| `/help` + `src/constants/help.ts` | คู่มือผู้ใช้ในระบบ 7 หมวด 26 ข้อ กรองตามสิทธิ์ (§23.13) |
| `docs/uat-script.md` | สคริปต์ให้ผู้ทดสอบจริงเดินตาม 5 ชุด 45 ข้อ (§23.13) |

**เคสที่ล็อกบั๊กเก่าไว้** — สองเคสใน `report-export.spec.ts` (หัวทะเบียนประกาศหน่วยงานผิดเมื่อ
"ไม่เลือกตัวกรอง" · ตำแหน่ง banner) คือบั๊กที่ **การทดสอบด้วยมือจับได้แต่เทสต์ 118 เคสไม่จับ**
ตามบันทึก §20 และ §22.7 — ตอนนี้มีตาข่ายกันไม่ให้กลับมาแล้ว

### 23.2 ⚠️ e2e ต้องวิ่งบน production build ไม่ใช่ `pnpm dev`

รอบแรกที่รันใส่ dev server **smoke แดง 10/10** ทั้งที่ทุกหน้าตอบ 200 และหัวข้อขึ้นครบ
ตกที่ด่าน `expect(errors).toEqual([])` ด้วยข้อความเดียวกันหน้าละ ~33 บรรทัด

```
Applying inline style violates the following Content Security Policy directive
'style-src 'self' 'nonce-…' 'unsafe-inline''.
```

สำรวจ DOM ทั้งสองฝั่งด้วยสคริปต์ชั่วคราว ได้ภาพเดียวกันทุกหน้า

```
<link rel=stylesheet>: 1  ·  <style>: 1  ·  [style=""]: 4
<style> ที่ไม่มี nonce: 1  →  @font-face{font-family:'__nextjs-Geist';…}  (1364 ตัวอักษร)
stylesheet ที่มี 0 rules (โดนบล็อก): 0 จาก 1
```

สามข้อที่อ่านได้:

1. **CSS ของแอปไม่เคยโดนบล็อก** — มาเป็น `<link rel=stylesheet>` ก้อนเดียวและมี rules ครบ
2. **ตัวการคือแผงเครื่องมือ dev ของ Next เอง** ที่แทรกฟอนต์ `__nextjs-Geist` โดยไม่มี nonce ·
   prod ไม่มีตัวนี้อยู่เลย
3. **`style-src-attr 'unsafe-inline'` ทำงานถูกต้อง** — `style=""` ทั้ง 4 จุดของแอปผ่านหมด

> ยืนยันด้วยของจริง: รันชุดเดิม ไฟล์เดิม ไม่แก้อะไรสักบรรทัด ใส่ production build →
> **12 passed · console error ศูนย์บรรทัดทุกหน้า**

**ทำไมไม่เลือกทางกรอง error ทิ้งแล้วรันบน dev ต่อ** — ด่าน `errors = []` มีค่าก็ต่อเมื่อ
baseline สะอาดสนิท พอเริ่มใส่ตัวกรองมันจะค่อย ๆ กลายเป็นตะแกรงรูโตที่บัง error จริงไปด้วย ·
ชุดนี้เป็นด่านก่อนปิดงาน ไม่ใช่ watch mode (`workers: 1` และยิงฐานจริงอยู่แล้ว)
รอ build อีกครึ่งนาทีจึงคุ้มกว่ามาก

### 23.3 ⚠️ โค้ดตายใน `src/proxy.ts` — `'unsafe-inline'` ที่ไม่เคยทำงาน

```ts
// เดิม — เงื่อนไข isDev ตรงนี้ไม่เคยมีผลเลยตั้งแต่ P3
`style-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-inline'" : ""}`
```

สเปก CSP สั่งให้เบราว์เซอร์ **เมิน `'unsafe-inline'` ทิ้งทันทีที่มี nonce อยู่ในลิสต์เดียวกัน**
การผ่อนให้ dev ตรงนี้จึงเป็นความเข้าใจผิดมาตลอด · เอกสารของ Next รุ่นนี้
(`02-guides/content-security-policy.md:53`) ก็เขียนเป็น `style-src 'self' 'nonce-…'` เฉย ๆ

ไม่ใช่ช่องโหว่ แต่เป็นคอมเมนต์ที่โกหกตัวเอง — ถอดออกแล้วเขียนกำกับไว้ว่าห้ามเติมกลับ ·
**คนละเรื่องกับ `'unsafe-eval'` ใน `script-src`** ซึ่งจำเป็นจริงใน dev และยังอยู่เหมือนเดิม

### 23.4 ⚠️ e2e กินเลขทะเบียนจริงรอบละสองเลข

teardown ลบเอกสารที่ขึ้นต้นด้วย `[e2e]` ได้ แต่ **คืนเลขทะเบียนไม่ได้** ตาม §6.4 ที่ตั้งใจให้
เลขที่ออกไปแล้วแก้ย้อนหลังไม่ได้ · หลังรันเต็มชุดหนึ่งรอบ

```
510000 · OUTGOING · 2569 · lastValue = 4     ← แต่ไม่เหลือเอกสาร OUTGOING สักฉบับ
```

510000/0003 กับ 510000/0004 กลายเป็นรูถาวรในทะเบียน

- บนฐาน dev ไม่เป็นไร แต่ต้องรู้ว่ารันบ่อย ๆ แล้วตัวเลขจะเดินหนีความจริงไปเรื่อย ๆ
- **ห้ามรันใส่ฐานจริงเด็ดขาด** — ทะเบียนจะมีรูที่อธิบายกับผู้ตรวจสอบไม่ได้
- ทางแก้ระยะยาวถ้าอยากรันถี่: ให้ e2e ใช้หน่วยงานของตัวเองหรือ tenant แยก

`fixtures/db-fixture.ts` **ไม่ลบตัวผู้ใช้** `e2e.runner` ด้วยเหตุผลเดียวกัน — audit อ้าง
`actorUserId` แบบ `onDelete: Restrict` และเป็นตาราง append-only ที่ลบแถวไม่ได้เลย (§8.5)

### 23.5 เรื่องที่ตัดสินไว้ในโค้ด

| เรื่อง | ที่เลือก | เหตุผล |
|---|---|---|
| พอร์ต | **3100** ไม่ใช่ 3000 | ถ้าใช้พอร์ตเดียวกับ `pnpm dev` แล้วมี dev server เปิดค้าง Playwright จะไปเกาะตัวนั้นเงียบ ๆ แล้วเราทดสอบผิดสภาพแวดล้อมโดยไม่รู้ตัว |
| `reuseExistingServer` | **false** เปิดด้วย `E2E_REUSE=1` | การเกาะเซิร์ฟเวอร์ที่รันค้าง = ทดสอบโค้ดเก่าแบบไม่มีอะไรเตือน ควรเป็นสิ่งที่ต้องขอ ไม่ใช่ได้มาฟรี |
| สัญญาณพร้อม | `/api/health` | `/` ตอบ 307 เด้งไปหน้าล็อกอิน ใช้เป็นสัญญาณไม่ได้ |
| ล็อกอิน | ครั้งเดียวที่ `auth.setup.ts` แล้วแชร์ `storageState` | หน้าล็อกอินมี rate limit ต่อ IP (§8.4) · แต่ละเคสล็อกอินเองจะโดนล็อกแล้วแดงยกชุดโดยโค้ดไม่ผิด |
| บัญชีของเทสต์ | `e2e.runner` (CENTRAL_REGISTRAR · clearance 3) | บัญชี seed ทุกตัวถูกบังคับเปลี่ยนรหัสตอนเข้าครั้งแรก จะเด้งไปหน้าเปลี่ยนรหัสไม่ถึงหน้าที่จะทดสอบ · และรหัสผ่านของคนจริงไม่ควรอยู่ในโค้ดที่ commit |
| fixture รันคนละโปรเซส | `tsx --conditions=react-server` | Playwright แปลงไฟล์เทสต์เป็น CommonJS แล้วโหลด Prisma client (ESM) ไม่ได้ |
| `retries` | 0 บนเครื่อง dev | เทสต์ที่ผ่านบ้างไม่ผ่านบ้างต้องรู้ทันที ไม่ใช่ซ่อนด้วย retry |

### 23.6 ⚠️ `next start` กับ `output: "standalone"`

`next.config.ts:6` ตั้ง `output: "standalone"` ไว้สำหรับ Docker ตอนรัน e2e จึงมี warning

```
⚠ "next start" does not work with "output: standalone" configuration.
```

**เทสต์ผ่านปกติและเสิร์ฟถูกทุกอย่าง** เพราะ `next start` อ่านจาก `.next` เต็มก้อนบนเครื่อง ·
เลือกทางนี้เพราะ `.next/standalone` ไม่มี `public/` กับ `.next/static` ติดมาให้
(Dockerfile บรรทัด 60–62 คัดเอง) ถ้าจะให้ e2e ใช้ standalone ต้องคัดไฟล์เองทุกรอบ —
ซับซ้อนขึ้นเพื่อความต่างที่ไม่กระทบสิ่งที่ชุดนี้ทดสอบ (proxy/CSP เป็นตัวเดียวกันทั้งสองทาง)

ถ้าวันหลังอยากให้ e2e ตรงกับ image ที่ deploy เป๊ะ ค่อยเพิ่มขั้นคัดไฟล์ทีหลังได้

### 23.7 ผลทดสอบ

| ชุด | ผล |
|---|---|
| e2e | **28 เคส เขียวหมด** (setup 1 · smoke 13 · document-flow 2 · help 3 · notification 4 · report-export 5) |
| unit | **159 เคส** (P4 จบที่ 151 · +8 ของ NotificationAdapter) |
| integration | **124 เคส** (P4 จบที่ 118 · +6 ของการแจ้งเตือน) |

`typecheck · lint` ผ่าน · เจ็ดเคสของ `document-flow` กับ `report-export` **ผ่านตั้งแต่รอบแรก
ไม่ต้องแก้โค้ดแอปเลยสักบรรทัด**

### 23.8 Notification in-app — ตาราง · adapter · จุดปล่อยเหตุการณ์

**ตาราง `Notification`** ตามสเปก §9.1 (`migration 20260826095658_add_notification`)
`type` เก็บเป็น String ไม่ใช่ enum ของ Postgres ตามแบบเดียวกับ `AuditLog.action` —
เพิ่มชนิดใหม่ทีหลังจะได้ไม่ต้องมี migration · ฝั่ง TS คุมด้วย `NOTIFICATION_TYPES`

**สัญญาข้อเดียวที่ห้ามพังของ adapter: `send()` ห้าม throw**

```ts
// src/lib/notification/in-app.ts — กลืน error ทุกกรณีโดยตั้งใจ
catch (error) {
  console.error("[notification] เขียนแจ้งเตือน in-app ไม่สำเร็จ", { ... })
}
```

เลขทะเบียนที่ออกไปแล้วถอนคืนไม่ได้ตาม §6.4 · การ rollback การออกเลขที่สำเร็จแล้ว
เพราะกระดิ่งไม่ดังคือความเสียหายที่แก้ไม่ได้ แลกกับความเสียหายที่แทบไม่มีอะไร
**แต่กลืนแล้วต้องเหลือร่องรอยใน log เสมอ** ว่าใครไม่ได้รับแจ้งเตือนและเพราะอะไร

**จุดปล่อยเหตุการณ์มีสามที่ ไม่ใช่ที่เดียว** — `applyTransition()` ครอบไม่หมด

| ที่ | เหตุการณ์ |
|---|---|
| `applyTransition()` | SUBMITTED · CIRCULATED · FORWARDED · RETURNED · CLOSED |
| `issueNumber()` ใน `numbering.service.ts` | NUMBER_ISSUED — การออกเลขมีทรานแซกชันของตัวเอง |
| `acknowledgeDocument()` | ปิดเรื่องอัตโนมัติเมื่อผู้รับชั้น TO รับทราบครบทุกคน |

⚠️ ทุกจุด **เรียกนอกทรานแซกชัน** และมีคอมเมนต์กำกับว่าห้ามย้ายเข้าไป
⚠️ `issueNumber()` ต้องส่ง `docNo` ที่เพิ่งได้เข้าไป ไม่ใช่ค่าจาก `document` ที่โหลดมาก่อนหน้า
ซึ่งยังเป็น `null` อยู่ตอนนั้น — มีเทสต์ล็อกไว้แล้ว

**แจ้งเฉพาะเหตุการณ์ที่ผู้รับต้องลงมือทำอะไรต่อ** ไม่ใช่ทุก transition ·
ไม่แจ้ง CREATED · UPDATED · ACKNOWLEDGED · MARKED_SENT · CANCELLED · ATTACHMENT_*
เพราะกระดิ่งที่ดังทุกเรื่องคือกระดิ่งที่ทุกคนเลิกกด แล้วเรื่องที่สำคัญจริงจะจมไปด้วย

**ตัดผู้ลงมือออกจากรายชื่อผู้รับเสมอ** — คนที่เพิ่งกดปุ่มรู้อยู่แล้วว่าเกิดอะไรขึ้น

### 23.9 ⚠️ ชื่อเรื่องของเอกสารลับต้องไม่ไหลออกทางกระดิ่ง

`safeSubject()` ใน `notification.service.ts` เป็นด่านเดียวที่ตัดสินเรื่องนี้

```ts
return document.confidentialityLevel > 0
  ? NOTIFICATION_TEXT.confidentialSubject   // "(หนังสือลับ — เปิดดูรายละเอียดในระบบ)"
  : document.subject
```

เหตุผลเดียวกับ §22.2 — **ชื่อเรื่องของหนังสือราชการลับคือตัวความลับเอง**
และแถวแจ้งเตือนถูกอ่านจากกระดิ่งโดย**ไม่ผ่านด่าน `can()` ของเอกสาร**
ถ้าปล่อย `subject` ลงมาตรง ๆ จะเปิดช่องเดิมที่ P4 เพิ่งปิดไปอีกรอบ ทางกระดิ่งแทน

**ใครออกเลขให้เอกสารลับได้** — `resolveNumberIssuers()` แยกสองทาง
ชั้น 1-3 ส่งให้**นายทะเบียนหนังสือลับ**ของหน่วยงานที่ชั้นถึงเท่านั้น (§22.3)
คนอื่นที่มีสิทธิ์ออกเลขก็เปิดเอกสารไม่ได้อยู่ดี แจ้งไปก็ได้แค่ความว่างเปล่า ·
บทบาทระดับทั้งองค์กร (`orgUnitId = null` เช่น SYSTEM_ADMIN) ไม่นับ ไม่งั้นผู้ดูแลระบบ
จะได้รับแจ้งทุกฉบับที่ทุกหน่วยงานส่งออกเลข

### 23.10 ⚠️ ฝั่งอ่าน — ห้ามอ่านตาราง `notifications` ตรง ๆ

`refId` เป็นข้อความธรรมดา **ไม่มี FK** และแถวแจ้งเตือนถูกเขียนไว้ ณ เวลาที่เกิดเหตุ
สิ่งที่เปลี่ยนได้ทีหลังโดยที่แถวเดิมไม่รู้ตัวเลยมีสามอย่าง

1. เอกสารถูกลบ (soft delete) — กระดิ่งจะพาไปหน้าที่เปิดไม่ได้
2. เอกสารถูก**ปรับชั้นความลับขึ้น** — คนที่เคยเห็นได้ตอนนั้น วันนี้ไม่ควรเห็นแล้ว
3. ACL รายบุคคลถูกถอน หรือหมดอายุ

`listNotifications()` และ `countUnreadNotifications()` จึงกรองผ่าน `documentVisibilityWhere()`
ทุกครั้ง — ด่านเดียวกับที่ทุกหน้าที่ list เอกสารใช้ · **ตัวเลขบนกระดิ่งนับจากรายการที่กรองแล้ว
ไม่ใช่ `count()` ตรง ๆ** ไม่งั้นตัวเลขจะไม่ตรงกับจำนวนที่เปิดออกมาแล้วเห็นจริง

ตรวจด้วยของจริงแล้ว — ใส่แจ้งเตือน 3 แถวโดยจงใจให้แถวหนึ่งชี้ไปยังเอกสารที่ไม่มีอยู่
กระดิ่งขึ้น **2 ไม่ใช่ 3** และเคส e2e ล็อกพฤติกรรมนี้ไว้แล้ว

**`markNotificationRead()` ใส่ `userId` ไว้ใน `where` ไม่ใช่ตรวจก่อนแล้วค่อยอัปเดต** —
ส่ง id ของแถวคนอื่นมาจะได้ `count 0` ไม่ใช่ทำงานสำเร็จ · และไม่มี action ไหน
รับ `userId` จากฝั่ง client เลย ใช้ `session.ctx.userId` เท่านั้น

### 23.11 เรื่องที่ตัดสินไว้ของฝั่งหน้าจอ

| เรื่อง | ที่เลือก | เหตุผล |
|---|---|---|
| อัปเดตตัวเลข | render ฝั่ง server ทุกครั้งที่โหลดหน้า | ทุกหน้าเป็น dynamic อยู่แล้วเพราะอ่านเซสชัน จึงไม่เสียอะไรเพิ่ม |
| **ไม่ทำ polling** | — | ระบบสารบรรณไม่ใช่แชท · ยิงทุก 30 วิ × ผู้ใช้ทั้งองค์กรคือภาระที่ได้ผลตอบแทนแทบศูนย์ |
| รายการในแผง | ดึงตอนกดเปิดเท่านั้น | ผู้ใช้ส่วนใหญ่ไม่กดกระดิ่งในการโหลดหน้าหนึ่งครั้ง ดึงมารอไว้ก็เปล่าประโยชน์ |
| `UNREAD_CAP` | 99 | เกินร้อยไม่มีความหมายกับผู้ใช้ และการนับให้ครบคือโหลดทั้งตารางทุกครั้งที่โหลดหน้า |
| ข้อความ | แยกไฟล์ `src/constants/notification.ts` | `NOTIFICATION_TEXT` ถูกเขียนลงฐาน ส่วน `NOTIFICATION_UI` render สด — คนละอายุการใช้งาน |
| `/notifications` ในเมนูข้าง | **ยังไม่ใส่** | เข้าทางกระดิ่ง → "ดูทั้งหมด" · เมนูข้างยาวอยู่แล้ว ถ้าอยากได้เพิ่มบรรทัดเดียวที่ `nav-config.ts` |

### 23.12 ⚠️ แถวแจ้งเตือนกำพร้าที่ integration test ทิ้งไว้

หลังต่อการแจ้งเตือนเสร็จ รัน integration ครบชุดแล้วเจอ **134 แถวค้างในฐาน dev**
ที่ชี้ไปยังเอกสารซึ่งถูกลบไปแล้ว — เพราะ `refId` ไม่มี FK ฐานข้อมูลจึงไม่ได้ห้ามอะไร

เติม `notification.deleteMany` เข้า teardown ของ integration ทั้ง 9 ชุด และของ e2e fixture ·
ใน `cleanupE2EDocuments()` ต้องวางไว้ **ก่อน** ด่าน "ไม่มีเอกสารก็จบ" เพราะแถวที่ fixture
ตั้งใจให้กำพร้าไม่มีเอกสารรองรับอยู่แล้ว ถ้าวางหลังด่านนั้นมันจะค้างฐานตลอดไป

### 23.13 คู่มือผู้ใช้ — หน้า `/help` ในระบบ

ผู้ใช้เลือกให้คู่มือเป็น **หน้าจริงในระบบ** ไม่ใช่ไฟล์ Markdown ใน `docs/`
ครอบคลุมบทบาทผู้ใช้ทั่วไปและสารบรรณ (ยังไม่รวมคู่มือผู้ดูแลระบบ)

**เขียนเป็น "งานที่ผู้ใช้อยากทำ" ไม่ใช่ "หน้าจอมีอะไรบ้าง"** — คนเปิดคู่มือเพราะติดอยู่
กลางงาน ไม่ได้เปิดเพราะอยากรู้จักระบบ · หัวข้อจึงขึ้นต้นด้วยคำกริยาเสมอ

| ส่วน | ที่อยู่ |
|---|---|
| เนื้อหาทั้งหมด | `src/constants/help.ts` — `HELP_SECTIONS` 7 หมวด 26 ข้อ |
| หน้าเว็บ | `src/app/(app)/help/page.tsx` |
| ทางเข้า | เมนูโปรไฟล์บนแถบด้านบน (ไม่ใช่เมนูข้าง) |

**Server Component ล้วน ไม่มี JS ฝั่ง client เลย** — สารบัญใช้ anchor link ธรรมดา ·
คู่มือคือหน้าที่ผู้ใช้เปิดตอนกำลังติดปัญหาอยู่ ถ้ามันพังไปด้วยก็ไม่เหลืออะไรให้พึ่ง
ยิ่งพึ่งพาน้อยยิ่งดี

**หมวดและข้อที่ผู้ใช้ไม่มีสิทธิ์ทำถูกซ่อน** ตามหลักเดียวกับเมนูข้าง (§10.2) —
`ออกเลขทะเบียน` ต้องมี `document.number.issue` · `หนังสือลับ` ต้องมี `confidential.access` ·
ข้อ "ดูและพิมพ์ทะเบียน" ต้องมี `report.view` · คู่มือที่สอนสิ่งที่กดไม่ได้ทำให้หา
เรื่องที่ต้องการเจอยากขึ้นเปล่า ๆ

**ข้อความอยู่ที่ `src/constants/help.ts` ไม่ใช่ `ui.ts`** — คนละหมวดกัน และแยกไว้
ตั้งแต่ต้นเพราะเนื้อหาคู่มือจะโตต่อไปเรื่อย ๆ ตามฟีเจอร์

⚠️ **กติกาของเนื้อหา: ต้องตรงกับสิ่งที่ระบบทำจริง ไม่ใช่สิ่งที่อยากให้เป็น**
(กติกาเดียวกับ `docs/information-banners.md`) · ทุกข้อที่แก้ย้อนหลังไม่ได้มีกล่องเตือน
สีส้มกำกับ ใช้ `Alert tone="warning"` ตัวเดียวกับทั้งระบบ ไม่ประกอบสีขึ้นมาเองซ้ำ

### สคริปต์ UAT — `docs/uat-script.md`

**ตัว UAT ทำแทนไม่ได้** สเปก §13 กำหนดว่าต้องผ่านกับผู้ใช้จริง ≥ 5 คนจาก 3 หน่วยงาน
สิ่งที่ทำให้ได้คือ**สคริปต์ที่ผู้ทดสอบเดินตามทีละข้อแล้วบันทึกผล** — คัดลอกหนึ่งชุด
ต่อผู้ทดสอบหนึ่งคน หรือพิมพ์ลงกระดาษ

ห้าชุด 45 ข้อ · A ผู้ใช้ทุกคน · B สารบรรณ · C ทะเบียนและ Export · D มือถือ · E หนังสือลับ
บันทึกผลเป็นสามระดับ — ผ่าน / ติดขัด / 🔴 ไม่ผ่าน · **ติดขัด ≥ 2 คนในข้อเดียวกันถือเป็น
ปัญหาการออกแบบหน้าจอ ไม่ใช่เรื่องผู้ใช้ไม่คุ้น**

⚠️ **สามข้อที่ §14 สั่งไว้ตรง ๆ ว่าต้องใช้ของจริง ติดดาว ⭐ ไว้ ข้ามไม่ได้**

| ข้อ | ต้องมีของจริงอะไร |
|---|---|
| B1 | สมุดทะเบียนกระดาษที่ใช้อยู่ มาเทียบเลขทีละฉบับครบ 20 ฉบับ |
| C4 | ไฟล์ทะเบียนที่หน่วยงานใช้ส่งจริง มาเทียบคอลัมน์กับ Export |
| D | เครื่องมือถือจริง ไม่ใช่ย่อหน้าต่างเบราว์เซอร์ |

⚠️ **เอกสารเตือนไว้ตั้งแต่ต้นว่าเลขที่ออกระหว่าง UAT กินเลขจริงถาวร** (§6.4) และให้เลือก
ฐานที่จะทดสอบก่อนเริ่ม — ฐานทดสอบแยก (แนะนำ) · หน่วยงานสมมติ · หรือฐานจริงแล้วบันทึก
ช่วงเลขที่ใช้ไปเพื่อชี้แจงภายหลัง

ข้อ B1c ให้ผู้ทดสอบยืนยันฐานปีของเลขทะเบียน — **ได้คำตอบแล้วก่อนเริ่ม UAT ด้วยซ้ำ**
(ดู §23.14) เหลือไว้ในสคริปต์เป็นข้อยืนยันซ้ำกับคนที่ใช้งานจริง ไม่ใช่คำถามเปิดอีกต่อไป

### 23.14 ⏳ ของที่ยังค้างใน P5

1. ~~**Notification in-app**~~ — เสร็จแล้ว (§23.8–23.12)
2. ~~**คู่มือผู้ใช้**~~ เสร็จแล้ว (`/help`) · ~~**สคริปต์ UAT**~~ เสร็จแล้ว (`docs/uat-script.md`)
   **แต่ยังไม่ได้ลงมือทำ UAT จริง** — ต้องมีผู้ใช้จริง ≥ 5 คนจาก 3 หน่วยงาน
   และของจริงสามอย่างมาเทียบ (สมุดทะเบียนกระดาษ · ไฟล์ทะเบียนที่ใช้ส่ง · มือถือจริง)
3. **Responsive polish** — ผู้ใช้บอกว่า "น่าจะเรียบร้อยแล้ว" จึงข้ามไปก่อน ยังไม่ได้ตรวจจริงหลายความกว้าง
4. **ข้อความ banner** — `docs/information-banners.md` ร่างครบทุกหน้าแล้ว **รอผู้ดูแลตรวจ**
   ยังไม่มีตัวไหนขึ้นหน้าเว็บ
5. ~~**ยังไม่มี CI · pre-commit hook**~~ — เสร็จแล้วทั้งคู่ (§23.15)
6. ของค้างจาก §22.7 — ข้อ 1 **ปิดแล้ว** (ดู §23.14) · ข้อ 2–5 ยังค้างเหมือนเดิม

### 23.14 ✅ ปิดคำถามค้าง — ฐานปีของเลขทะเบียนคือ **ปีปฏิทิน** (26 ส.ค. 2569)

หน่วยงานตอบกลับมาแล้วว่าใช้ **ปีปฏิทิน (1 ม.ค. – 31 ธ.ค.)** ไม่ใช่ปีงบประมาณ

**ตรงกับค่าที่ตั้งไว้อยู่แล้ว — ไม่ต้องแก้อะไรเลย** ตรวจยืนยันจากฐานจริงแล้ว

```
system_settings · numbering → {"yearMode": "CALENDAR"}
```

คำถามนี้ค้างมาตั้งแต่ spec §15 ข้อ 5 (ตั้งแต่ก่อน P2) ผ่านการเลื่อนตัดสินสองรอบ
(§20 "ต้องตัดสินก่อนไป P3" → §21.7 "ขอกลับมาตัดสินหลัง P3") · **เส้นตาย 1 ต.ค. 2569
ที่บันทึกไว้ทุกเฟสจึงไม่มีผลอีกต่อไป**

⚠️ **ค่านี้ยังแก้ได้จากหน้า `/admin/settings`** และการเปลี่ยนถูกบันทึก audit ระดับ
`CRITICAL` (`setting.service.ts`) — ถ้าใครเผลอสลับเป็น `FISCAL` หลัง 1 ต.ค.
เลขจะกระโดดไปปีถัดไปทันทีโดยที่เลขเก่ายังอยู่ปีเดิม ทำให้ทะเบียนมีสองฐานปีปนกัน
และแก้ย้อนหลังไม่ได้ตาม §6.4 · **ห้ามเปลี่ยนหลังจากออกเลขไปแล้วในปีนั้น**

### 23.15 ด่านอัตโนมัติ — pre-commit hook + CI บน GitHub Actions

ปิดข้อ 5 ของ §23.14 ครบทั้งสองครึ่งแล้ว

**ครึ่งแรก — `.githooks/pre-commit`** (commit `d1a1af9`) รันสี่ด่านตอน commit:
prettier (เฉพาะไฟล์ที่ stage) → eslint (เฉพาะไฟล์โค้ด) → typecheck ทั้งโปรเจกต์ → unit test
ติดตั้งเองตอน `pnpm install` ผ่านสคริปต์ `prepare` → `scripts/setup-hooks.mjs`
ที่ชี้ `core.hooksPath` มาที่โฟลเดอร์นี้ · ไม่ใช้ husky เพราะต้องการแค่ไฟล์เดียว

ไม่มีด่านตรวจ semicolon แยกต่างหาก — `@stylistic/semi: never` ใน eslint
กับ `semi: false` ใน prettier จับให้อยู่แล้ว hook แค่เรียกสองตัวนี้

⚠️ **ด่าน typecheck กับ unit test ตรวจ "ไฟล์ในเครื่อง" ไม่ใช่ "สิ่งที่ stage ไว้"** —
stage แค่บางส่วนของไฟล์แล้วผลที่ได้คือของทั้งไฟล์ · ยอมแลกเพราะทางเลือกคือ stash
ของที่ยังไม่ stage ออกไปก่อน ซึ่งเคยทำงานค้างหายมาแล้ว · ข้ามด้วย `--no-verify` ได้

**ครึ่งหลัง — `.github/workflows/ci.yml`** วิ่งตอน push ขึ้น `main` และตอนเปิด PR
แบ่งเป็นสามงานขนานกัน ไม่รวมเป็นงานเดียวเพราะ lint ที่พังไม่ควรถูกกลบอยู่หลัง
การรอฐานข้อมูลขึ้นสามนาที

| งาน | ทำอะไร | ต้องมีฐานข้อมูล |
| --- | --- | --- |
| `checks` | prettier · eslint · typecheck · unit test (159 เคส) | ไม่ |
| `integration` | migrate → seed → `pnpm test:integration` (118 เคส) | ใช่ |
| `e2e` | migrate → seed → `pnpm test:e2e` (19 เคส บน production build) | ใช่ |

**เรื่องที่ต้องรู้ถ้าจะแก้ไฟล์นี้:**

1. **ต้องเขียนไฟล์ `.env` จริงลงดิสก์ก่อน `pnpm install` ทุกงาน** ไม่ใช่ตั้งแค่ตัวแปร
   environment · เหตุผลสองชั้น: `postinstall` เรียก `prisma generate` ซึ่งอ่าน
   `DATABASE_URL` ผ่าน `prisma.config.ts` · และ `global-setup.ts` ของ Playwright
   เรียก `tsx --env-file=.env` ซึ่ง Node ล้มทันทีถ้าไม่มีไฟล์
   `AUTH_SECRET` กับ `FILE_MASTER_KEY` สร้างสดด้วย `openssl rand` ทุกรอบ —
   ไม่มีกุญแจปลอมค้างอยู่ใน repo ให้ใครหลงคัดลอกไปใช้จริง
2. **Postgres ของ service ต้องเป็น `postgres:16-alpine` + locale ICU `th-TH`**
   ให้ตรงกับ `docker-compose.yml` — รายงานทะเบียนเรียงลำดับภาษาไทยตาม collation ของฐาน
   ถ้าใช้ locale ปริยาย CI จะเขียวแต่ของจริงเรียงคนละแบบ
3. **ใช้ `db:deploy` (migrate deploy) ไม่ใช่ `migrate dev`** — schema ที่ไม่ตรงกับ
   migration ต้องแดงตรงนี้ ไม่ใช่ถูก CI สร้าง migration ใหม่ให้เงียบ ๆ
4. **e2e ยังกินเลขทะเบียนของหน่วย 510000 รอบละสองเลข** (§23.4) ที่นี่ไม่เป็นไร
   เพราะฐานเกิดใหม่ทุกรอบ · **ห้ามชี้ workflow นี้ไปฐานจริงเด็ดขาด**
5. **`webServer.timeout` ของ `playwright.config.ts` เป็น 600 วินาทีเมื่ออยู่บน CI**
   (เดิม 300 คงไว้สำหรับเครื่อง dev) — runner มีสองคอร์และไม่มี `.next/cache` มาก่อน
   `pnpm build` จึงนานกว่าเครื่องพัฒนาหลายเท่า
6. รายงานของ Playwright ถูกเก็บเป็น artifact **เฉพาะตอนล้ม** (เก็บ 7 วัน) —
   `reporter` ของ config เป็น `["github"], ["html"]` อยู่แล้วเมื่อเจอตัวแปร `CI`

**ยังไม่ได้ทำ:** ไม่มีด่าน `pnpm build` แยกในงาน `checks` เพราะงาน `e2e` build อยู่แล้ว ·
ถ้าวันหนึ่งตัด e2e ออกจาก CI ต้องเติม build กลับเข้าไปเอง ไม่งั้นจะไม่มีใครตรวจว่า build ผ่าน
