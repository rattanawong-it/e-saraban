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
- **CSP strict + security headers ครบ** — อยู่ใน P3 · ตอนนี้ nginx ใส่ให้บางส่วนแล้ว

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
