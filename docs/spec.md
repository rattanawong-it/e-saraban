# e-Saraban — Software Requirements Specification (SRS)

**ระบบสารบรรณอิเล็กทรอนิกส์ สำหรับสถาบันการศึกษา**

| | |
|---|---|
| เวอร์ชัน | 1.0 (Draft for Approval) |
| วันที่ | 21 สิงหาคม 2569 · อัปเดตสถานะ 24 สิงหาคม 2569 |
| ผู้จัดทำ | rattana.wong@krirk.ac.th |
| สถานะ | **P0 · P1 ปิดแล้ว** · รอยืนยันคำถามค้าง §15 ก่อนเริ่ม P2 |
| ที่มา | สรุปจากการสัมภาษณ์เก็บ requirements |

---

## สารบัญ

1. [ภาพรวมและที่มา](#1-ภาพรวมและที่มา)
2. [Decisions Log](#2-decisions-log)
3. [ขอบเขตระบบ](#3-ขอบเขตระบบ)
4. [ผู้ใช้งานและสิทธิ์ (RBAC)](#4-ผู้ใช้งานและสิทธิ์-rbac)
5. [โครงสร้างหน่วยงานและผู้ใช้หลายสังกัด](#5-โครงสร้างหน่วยงานและผู้ใช้หลายสังกัด)
6. [วงจรชีวิตเอกสาร](#6-วงจรชีวิตเอกสาร-state-machine)
7. [ระบบเลขทะเบียน](#7-ระบบเลขทะเบียน)
8. [ความปลอดภัยและชั้นความลับ](#8-ความปลอดภัยและชั้นความลับ)
9. [แบบจำลองข้อมูล](#9-แบบจำลองข้อมูล-data-model)
10. [การออกแบบ UX/UI](#10-การออกแบบ-uxui)
11. [สถาปัตยกรรมทางเทคนิค](#11-สถาปัตยกรรมทางเทคนิค)
12. [ความต้องการเชิงคุณภาพ](#12-ความต้องการเชิงคุณภาพ-non-functional)
13. [แผนการพัฒนา](#13-แผนการพัฒนา-roadmap)
14. [แผนการทดสอบ](#14-แผนการทดสอบ-verification)
15. [คำถามที่ยังค้าง](#15-คำถามที่ยังค้าง)
16. [ภาคผนวก ก — ผังหน่วยงานจริงและรหัสงานสารบรรณ](#16-ภาคผนวก-ก--ผังหน่วยงานจริงและรหัสงานสารบรรณ)

---

## 1. ภาพรวมและที่มา

### 1.1 ปัญหาปัจจุบัน

สถาบันการศึกษาใช้กระบวนการสารบรรณแบบกระดาษผสมไฟล์กระจัดกระจาย ทำให้:

- การเดินเอกสารระหว่างหน่วยงาน (คณะ / สำนัก / กอง / ศูนย์) ใช้เวลานาน
- ทะเบียนหนังสืออยู่ในสมุด/Excel แยกกันแต่ละหน่วยงาน ค้นย้อนหลังยาก
- ไม่มีการควบคุมสิทธิ์การเข้าถึงเอกสารอย่างเป็นระบบ โดยเฉพาะเอกสารชั้นความลับ
- ตรวจสอบไม่ได้ว่าใครเปิดดู แก้ไข หรือส่งต่อเอกสารเมื่อใด

### 1.2 วัตถุประสงค์

พัฒนาระบบสารบรรณอิเล็กทรอนิกส์บนเว็บที่:

1. **ใช้งานง่าย** — เจ้าหน้าที่ที่ไม่ถนัดเทคโนโลยีใช้ได้โดยไม่ต้องอบรมนาน
2. **ลดขั้นตอนงานเอกสาร** — ลดการเดินเอกสารกระดาษและการคีย์ข้อมูลซ้ำ
3. **รองรับหลายหน่วยงาน** — โครงสร้างลำดับชั้นไม่จำกัดระดับ
4. **รองรับผู้ใช้หลายสังกัด** — คนหนึ่งทำงานหลายหน่วยงานพร้อมกันได้
5. **รองรับเอกสารทั่วไปและเอกสารลับ** — 4 ชั้นความลับตามระเบียบราชการ
6. **ปลอดภัย** — RBAC + Permission-based Access Control + เข้ารหัสไฟล์
7. **ตรวจสอบย้อนหลังได้** — audit trail ครบทุกการกระทำ แก้ไขย้อนหลังไม่ได้
8. **ขยายได้** — เพิ่มลายเซ็นดิจิทัล / SSO / multi-tenant ได้โดยไม่รื้อระบบ

### 1.3 บริบทองค์กร

| ด้าน | ค่าที่ใช้ออกแบบ |
|---|---|
| ประเภท | สถาบันการศึกษา 1 แห่ง (single-tenant) |
| จำนวนหน่วยงาน | ~30–80 หน่วย |
| จำนวนผู้ใช้ | ~500–3,000 คน |
| ปริมาณเอกสาร | ~50,000 ฉบับ/ปี |
| สภาพแวดล้อม | On-premise (Docker) |
| ภาษา UI | ไทยอย่างเดียว |

---

## 2. Decisions Log

ข้อสรุปที่ตกลงจากการสัมภาษณ์ ใช้เป็น baseline — การเปลี่ยนแปลงต้องบันทึกเพิ่มเป็น D14, D15, …

| # | หัวข้อ | ข้อสรุป |
|---|--------|---------|
| **D1** | องค์กร | สถาบันการศึกษา 1 แห่ง — single-tenant แต่ใส่ `tenantId` เผื่อขยายเป็น multi-tenant |
| **D2** | ขอบเขต MVP | **หนังสือส่ง** (องค์กร→ภายนอก) + **หนังสือภายใน** (บันทึกข้อความ) |
| **D3** | เลขทะเบียน | แยกตามหน่วยงาน + รีเซ็ตตามปี (ปีงบ/ปีปฏิทิน เลือกได้) |
| **D4** | ชั้นความลับ | 4 ชั้นตามระเบียบราชการ + เข้ารหัสไฟล์แนบ + watermark/ห้ามดาวน์โหลด + audit เข้มข้น |
| **D5** | Authentication | Username/Password ในระบบเอง (ไม่มี SSO/2FA ใน MVP) |
| **D6** | ลงนาม/อนุมัติ | **ไม่มีขั้นตอนอนุมัติใน MVP** — ผู้ใช้ร่าง → ส่งให้สารบรรณออกเลข |
| **D7** | ผู้ใช้หลายสังกัด | Context Switcher **และ** โหมด "ดูรวมทุกสังกัด" (ทำทั้งสองแบบ) |
| **D8** | ไฟล์แนบ | Local Filesystem (ผ่าน StorageAdapter) + PDF preview ในเบราว์เซอร์ |
| **D9** | Roles | System Admin, สารบรรณกลาง, ธุรการหน่วยงาน, ผู้บริหาร, ผู้ใช้ทั่วไป |
| **D10** | แจ้งเตือน | In-app เท่านั้นใน MVP (กระดิ่ง + Inbox) ผ่าน Notification Adapter |
| **D11** | การร่างเอกสาร | อัปโหลดไฟล์ PDF/Word ที่ทำเอง + กรอก metadata (ไม่มี template generator) |
| **D12** | รายงาน | ทะเบียนหนังสือส่ง/รับ (Export Excel/PDF), ค้นหาขั้นสูง, Dashboard สถิติ |
| **D13** | Deploy / ภาษา | On-premise ด้วย Docker · UI ภาษาไทยอย่างเดียว |
| **D14** | ผังหน่วยงานจริง *(25 ส.ค. 2569)* | ใช้ **รหัสงานสารบรรณ 6 หลัก** ของมหาวิทยาลัยเกริก (สรุป ณ 21 ส.ค. 2569) — 371 หน่วย 3 ระดับ · แทนผังตัวอย่าง `ศธ 0512.x` ที่ใช้ชั่วคราวใน P1 · รายการเต็มอยู่ที่ §16 และ `prisma/org-units.csv` |
| **D15** | หน่วยงานที่ออกเลขได้ *(25 ส.ค. 2569)* | **ระดับ 1** (คณะ/วิทยาลัย/สำนัก/สถาบัน/ศูนย์) และ **ระดับ 2** (ฝ่าย/สาขา/ศูนย์ย่อย/สำนักงานเลขานุการ) ออกเลขได้ · **หน่วยระดับ "งาน" ออกเลขไม่ได้** ไม่ว่าอยู่ระดับใด · หลักสูตร (ระดับ 3) ออกเลขไม่ได้ |
| **D18** | การเข้ารหัสไฟล์แนบ *(25 ส.ค. 2569 · ปิดใน P3)* | **เข้ารหัสเฉพาะไฟล์ของเอกสารชั้นความลับ 1–3** ตาม §8.2 · ชั้น 0 เก็บเป็นไฟล์ธรรมดาเพราะเป็นหนังสือทั่วไปที่ไม่ต้องการความลับ และการเข้ารหัสทุกไฟล์ทำให้กู้ระบบยากขึ้นโดยไม่จำเป็น · ปรับชั้นความลับขึ้นทีหลังจะไล่เข้ารหัสไฟล์เดิมให้อัตโนมัติก่อนบันทึก · ไฟล์เก่าจาก P2 ใช้ `pnpm files:encrypt` · ฟิลด์กุญแจของ `Attachment` มีอยู่ตั้งแต่ migration แรกจึงเปิดใช้ได้โดยไม่ต้อง migrate |
| **D17** | ตัวระบุตัวตนตอนล็อกอิน *(25 ส.ค. 2569)* | ล็อกอินได้ทั้ง **ชื่อผู้ใช้และอีเมล** — ตั้งแต่หน้า `/register` เลิกถามชื่อผู้ใช้ (§6.16) ผู้ใช้จำอีเมลของตัวเองแม่นกว่าชื่อผู้ใช้ที่ระบบสร้างให้ · `User.username` ยังเป็นคีย์ระบุตัวตนหลักเหมือนเดิม |
| **D16** | รูปแบบเลขหนังสือ *(25 ส.ค. 2569)* | `{unitCode}/{seq:4}` — รหัสหน่วยงาน 6 หลัก ทับ ลำดับที่ของหน่วยงานนั้น · ลำดับเดินแยกต่อหน่วยงาน รีเซ็ตทุกปี · ปีปัจจุบันคือ **พ.ศ. 2569** |

### สมมติฐานที่ตั้งไว้ (ต้องยืนยันก่อนเริ่ม P2)

**A1 — โมดูลหนังสือรับ**
D2 ไม่รวมหนังสือรับ แต่ D12 ขอรายงาน "ทะเบียนหนังสือส่ง/**รับ**" จึงกำหนดให้ MVP มี *โมดูลลงทะเบียนรับแบบเบา* (ออกเลขรับ + แนบไฟล์ + ค้นหา + ส่งต่อหน่วยงาน) แต่ **ยังไม่มี** workflow สั่งการ/มอบหมาย/ติดตามงานเต็มรูปแบบ — เลื่อนไป P5

**A2 — ไม่มีขั้นอนุมัติ**
เมื่อไม่มีขั้นอนุมัติ ความถูกต้องของเนื้อหาขึ้นกับสารบรรณกลางตอนออกเลขเพียงจุดเดียว ระบบจึงต้องมีปุ่ม **"ตีกลับให้แก้ไข" (Return for revision)** เพื่อไม่ให้เอกสารผิดหลุดออกนอกองค์กร — ถือเป็น control ทดแทนขั้นอนุมัติ

**A3 — ชั้นความลับ**
ตามระเบียบว่าด้วยการรักษาความลับของทางราชการ พ.ศ. 2544 เอกสาร "ลับมาก/ลับที่สุด" ต้องแยกทะเบียนและควบคุมเป็นพิเศษ ระบบรองรับเชิงเทคนิค (แยก sequence + เข้ารหัส + ACL) แต่ **การอนุญาตให้เอกสารลับที่สุดเข้าระบบอิเล็กทรอนิกส์ต้องผ่านการอนุมัตินโยบายจากผู้บริหาร**

---

## 3. ขอบเขตระบบ

### 3.1 In Scope — MVP

`[x]` = ทำเสร็จและตรวจแล้ว · `[~]` = ทำบางส่วน (ดูหมายเหตุ) · `[ ]` = ยังไม่เริ่ม

| # | สถานะ | ความสามารถ | เฟส |
|---|:---:|---|:---:|
| F01 | [x] | จัดการโครงสร้างหน่วยงานแบบลำดับชั้นไม่จำกัดระดับ | P1 |
| F02 | [x] | จัดการผู้ใช้ + สังกัดหลายหน่วยงาน + RBAC/Permission | P1 |
| F03 | [x] | หนังสือภายใน (บันทึกข้อความ): ร่าง → ส่งออกเลข → ออกเลข → เวียน → รับทราบ → ปิดเรื่อง | P2 |
| F04 | [x] | หนังสือส่งภายนอก: ร่าง → ส่งออกเลข → ออกเลข → ส่งออก → ปิดเรื่อง | P2 |
| F05 | [x] | ลงทะเบียนหนังสือรับแบบเบา (ตาม A1) | P2 (เดิมวางไว้ P5) |
| F06 | [x] | เลขทะเบียนอัตโนมัติ แยกตามหน่วยงาน/ประเภท/ปี พร้อม pattern ตั้งค่าได้ | P2 |
| F07 | [~] | ไฟล์แนบหลายไฟล์/หลายเวอร์ชัน + PDF preview + watermark | P2/P3 |
| F08 | [x] | ชั้นความลับ 4 ระดับ + encryption at rest + ห้ามดาวน์โหลดสำหรับเอกสารลับ | P3 |
| F09 | [x] | ค้นหาขั้นสูง + Dashboard สถิติ + Export ทะเบียน (Excel/PDF) | P4 |
| F10 | [x] | Audit log ครบทุก action + หน้าตรวจสอบสำหรับผู้ดูแล | P1 |
| F11 | [ ] | แจ้งเตือน In-app (กระดิ่ง + Inbox) | P5 |
| F12 | [x] | Responsive Web (Desktop-first, ใช้งานบนมือถือได้) | P1+ |

**หมายเหตุสถานะ (อัปเดต 24 ส.ค. 2569 — ปิด P1)**

- **F01 · F02** ครบแล้ว: ผัง tree ไม่จำกัดระดับ + materialized path + ย้ายหน่วยงาน + เก็บถาวร ·
  ผู้ใช้หลายสังกัด + บทบาทผูกกับคู่ (User, OrgUnit) + Context Switcher + `can()` ครบ 6 ด่านของ §4.3
- **F08 [x]** *(ปิดใน P3 · 25 ส.ค. 2569)* — ครบแล้ว: envelope encryption ของไฟล์เอกสารลับ ·
  secure file route + ถอดรหัสแบบ stream · ลายน้ำชื่อผู้เปิดทับทุกหน้าของ PDF · เปิดดูอย่างเดียว ·
  `DocumentAcl` ให้/ถอนสิทธิ์รายบุคคล พร้อม audit ทุกใบ
- **F07 [~]** — ไฟล์แนบหลายเวอร์ชันและลายน้ำครบแล้ว · ที่ยังไม่มีคือ **viewer ในหน้าเว็บ**
  ตอนนี้กดแล้วเปิดไฟล์ในแท็บใหม่ให้เบราว์เซอร์แสดงเอง (เอกสารลับบังคับ `inline`)
- **F10** ครบแล้ว: audit hash chain + append-only บังคับด้วย trigger ระดับ PostgreSQL +
  หน้า `/admin/audit` พร้อม filter · export CSV · ปุ่มตรวจ hash chain
- **F12** โครงสร้าง responsive ครบทุกหน้าที่มีในเฟสนี้ — sidebar ยุบเป็น drawer ที่ `< 1024px`
  ส่วนตารางที่ต้องยุบเป็น card จะมาพร้อมหน้ารายการเอกสารใน P2

### 3.2 Out of Scope — MVP

เตรียมโครงสร้างรองรับไว้ แต่ไม่ทำในเฟสแรก:

- Digital Signature / PKI (พ.ร.บ.ธุรกรรมทางอิเล็กทรอนิกส์)
- Approval Workflow Engine หลายลำดับชั้น
- SSO (LDAP/AD/Google Workspace/M365), 2FA
- แจ้งเตือนทาง Email / LINE
- OCR + full-text search ในเนื้อไฟล์
- Template generator สร้าง PDF จากฟอร์ม
- เชื่อมต่อระบบสารบรรณภายนอก (e-CMS / สพร.)
- Mobile native application
- Multi-tenant จริง (schema เตรียม `tenantId` ไว้แล้ว)

---

## 4. ผู้ใช้งานและสิทธิ์ (RBAC)

### 4.1 Personas & Roles

| Role | Persona | ขอบเขตข้อมูล | หน้าที่หลัก |
|------|---------|--------------|------------|
| `SYSTEM_ADMIN` | เจ้าหน้าที่ IT | ทั้งองค์กร | จัดการผู้ใช้/หน่วยงาน/บทบาท/ค่าระบบ, ดู audit log **(ไม่เห็นเนื้อหาเอกสารโดยอัตโนมัติ — ต้อง grant แยก)** |
| `CENTRAL_REGISTRAR` | สารบรรณกลาง | ทั้งองค์กร | ออกเลขหนังสือส่งขององค์กร, ลงทะเบียนหนังสือรับ, ส่งออกภายนอก, ตีกลับแก้ไข, ออกรายงานทะเบียน |
| `DEPT_OFFICER` | ธุรการหน่วยงาน | หน่วยงานตน + หน่วยงานลูก | ออกเลขหนังสือภายในของหน่วยงาน, สร้าง/แก้ไข/เวียนหนังสือของหน่วยงาน, ดูทะเบียนหน่วยงาน |
| `EXECUTIVE` | ผู้บริหาร (อธิการบดี/คณบดี/ผอ.) | สายบังคับบัญชาของตน (subtree) | เห็นหนังสือทุกฉบับในหน่วยงานใต้บังคับบัญชา, Dashboard, บันทึกความเห็น/สั่งการ |
| `USER` | อาจารย์/เจ้าหน้าที่ทั่วไป | เฉพาะที่เกี่ยวข้องกับตน | ร่างหนังสือ, ดูหนังสือที่ตนสร้าง/ถูกส่งถึง/ถูก grant สิทธิ์ |

> **หลักการสำคัญ:** Role ผูกกับคู่ **(User, OrgUnit)** ไม่ใช่กับ User เดี่ยว
> → คนหนึ่งเป็น `DEPT_OFFICER` ของคณะ A และเป็น `USER` ธรรมดาในสำนัก B ได้พร้อมกัน

### 4.2 Permission Matrix

Permission เป็น string code รูปแบบ `<resource>.<action>` และมี **scope** กำกับ:
`OWN` (ของตนเอง) · `UNIT` (หน่วยงานปัจจุบัน) · `SUBTREE` (หน่วยงานตนและลูกหลาน) · `ORG` (ทั้งองค์กร)

| Permission | ADMIN | REGISTRAR | DEPT_OFFICER | EXECUTIVE | USER |
|-----------|:-----:|:---------:|:------------:|:---------:|:----:|
| `document.create` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `document.read` | — | ORG | SUBTREE | SUBTREE | OWN |
| `document.update` | — | ORG | UNIT | — | OWN¹ |
| `document.delete` (soft) | — | ORG | UNIT¹ | — | OWN¹ |
| `document.submit` | — | ✓ | ✓ | ✓ | ✓ |
| `document.number.issue` | — | ORG | UNIT | — | — |
| `document.return` | — | ORG | UNIT | — | — |
| `document.send.external` | — | ✓ | — | — | — |
| `document.circulate` | — | ✓ | ✓ | ✓ | — |
| `document.acknowledge` | — | ✓ | ✓ | ✓ | ✓ |
| `document.close` | — | ORG | UNIT | SUBTREE | — |
| `attachment.upload` | — | ✓ | ✓ | ✓ | OWN |
| `attachment.download` | — | ORG | UNIT | SUBTREE | OWN |
| `attachment.grant` | — | ORG | UNIT | SUBTREE | OWN |
| `confidential.access` | — | ตาม clearance | ตาม clearance | ตาม clearance | ตาม clearance |
| `report.view` / `report.export` | ✓ | ORG | UNIT | SUBTREE | — |
| `orgunit.manage` | ✓ | — | — | — | — |
| `user.manage` | ✓ | — | — | — | — |
| `role.manage` | ✓ | — | — | — | — |
| `audit.read` | ORG | ORG | UNIT | SUBTREE | — |
| `setting.manage` | ✓ | — | — | — | — |

¹ เฉพาะสถานะ `DRAFT` / `RETURNED`
`—` = ไม่มีสิทธิ์ · `✓` = มีสิทธิ์ (ไม่ผูก scope)

> **หมายเหตุด้านความปลอดภัย:** `SYSTEM_ADMIN` **ไม่ได้รับ** `document.read` โดยอัตโนมัติ เพื่อป้องกันไม่ให้ผู้ดูแลระบบสอดส่องเอกสาร หากจำเป็นต้องใช้กลไก **break-glass** — กดขอสิทธิ์ชั่วคราวพร้อมระบุเหตุผล และถูกบันทึก audit ระดับ `CRITICAL`

### 4.3 อัลกอริทึมตัดสินสิทธิ์

ผู้ใช้ `U` (ใน context หน่วยงาน `C`) เข้าถึงเอกสาร `D` ด้วย permission `P` ได้ก็ต่อเมื่อ **ผ่านทุกด่านตามลำดับ**:

```
1. AUTHENTICATED   session ยัง valid และ user.isActive = true

2. ROLE GRANT      ∃ role ของ U ใน C (หรือ global role) ที่มี permission P

3. SCOPE MATCH     ตาม scope ของ grant นั้น
                     OWN     → D.createdById = U.id
                     UNIT    → D.ownerUnitId = C.id หรือ C อยู่ใน D.recipients
                     SUBTREE → D.ownerUnitId อยู่ใต้ C  (materialized path LIKE 'C.path%')
                     ORG     → ผ่านเสมอ (ภายใน tenant เดียวกัน)

4. EXPLICIT ACL    ถ้ามี DocumentAcl effect = DENY  → ปฏิเสธทันที (deny ชนะเสมอ)
                   ถ้าไม่ผ่านข้อ 3 แต่มี ACL ALLOW ที่ยังไม่หมดอายุ → ผ่าน

5. CLEARANCE       U.clearanceLevel >= D.confidentialityLevel
                   เอกสารระดับลับขึ้นไป ต้องมี ACL ระบุตัวบุคคลเสมอ
                   ห้าม inherit สิทธิ์จาก scope เพียงอย่างเดียว

6. STATE           action ที่ขอทำต้องถูกต้องตาม state machine ของ D.status

→ ทุกผลลัพธ์ (ALLOW/DENY) ของเอกสารลับ ต้องเขียน AuditLog เสมอ
```

**ข้อบังคับ implementation:** รวมไว้ใน helper เดียว `can(ctx, permission, resource)` ที่ `src/lib/authz/`
**ห้าม** เขียน logic ตัดสินสิทธิ์กระจายอยู่ในหน้า UI หรือ component

---

## 5. โครงสร้างหน่วยงานและผู้ใช้หลายสังกัด

### 5.1 Hierarchy

โครงสร้างต้นไม้ไม่จำกัดระดับในเชิงเทคนิค แต่ผังจริงของมหาวิทยาลัยมี **3 ระดับ**
และเข้ารหัสไว้ในรหัสงานสารบรรณ 6 หลักอยู่แล้ว (D14 · รายการเต็มใน §16)

```
รหัส 6 หลัก = XX YY ZZ

XX 00 00   ระดับ 1  คณะ · วิทยาลัย · สำนัก · สถาบัน · ศูนย์            (38 หน่วย)
XX YY 00   ระดับ 2  ฝ่าย · สาขาวิชา · ศูนย์ย่อย · สำนักงานเลขานุการ   (161 หน่วย)
XX YY ZZ   ระดับ 3  งาน · หลักสูตร                                     (172 หน่วย)
```

```
010000 สำนักอธิการบดี                       ← ระดับ 1 · ออกเลขได้
├── 010100 ฝ่ายบริหารทั่วไป                 ← ระดับ 2 · ออกเลขได้
│   ├── 010102 งานเลขานุการ                 ← ระดับ 3 · ออกเลขไม่ได้
│   └── 010103 งานสารบรรณ                   ← ระดับ 3 · ออกเลขไม่ได้
└── 010200 ฝ่ายอาคารสถานที่                 ← ระดับ 2 · ออกเลขได้
```

**หน่วยงานที่ออกเลขหนังสือได้ (D15)** — เก็บเป็นฟิลด์ `canIssueNumber` บน `OrgUnit`
ไม่คำนวณจากระดับตอน runtime เพราะมีข้อยกเว้นที่ต้องแก้ด้วยมือ (ดู §16)

| ระดับ | ตัวอย่าง | ออกเลข |
|:--:|---|:--:|
| 1 | คณะบริหารธุรกิจ · สำนักหอสมุด · สถาบันภาษา · ศูนย์เทคโนโลยีสารสนเทศ | ✓ |
| 2 | ฝ่ายบริหารทั่วไป · สาขาวิชาบัญชี · สำนักงานเลขานุการคณะฯ · ศูนย์ศิลปวัฒนธรรม | ✓ |
| 2 | หน่วยที่ชื่อขึ้นต้นด้วย **"งาน"** | ✗ |
| 3 | งานสารบรรณ · หลักสูตรบริหารธุรกิจบัณฑิต | ✗ |

รวมหน่วยที่ออกเลขได้ **190 หน่วย** จากทั้งหมด 371 หน่วย

**เทคนิคที่ใช้:** Adjacency List (`parentId`) + Materialized Path (`path`) คู่กัน

- `path` เก็บรูปแบบ `/1/5/23/` → query subtree ด้วย `path LIKE '/1/5/%'`
  เร็วกว่า recursive CTE มาก และสร้าง index ได้
- ต้องมีกลไกอัปเดต `path` ของลูกทั้งหมดเมื่อย้ายหน่วยงาน (ทำใน transaction เดียว)

**ฟิลด์สำคัญ:** `code` (รหัสงานสารบรรณ 6 หลัก เช่น `510200`), `nameTh`, `shortName`, `type`, `level`, `sortOrder`, `isActive`, `canIssueNumber`, `headUserId`

> **ห้ามลบหน่วยงานที่มีเอกสารผูกอยู่** → ใช้ `isActive = false` (archive) เท่านั้น
> เพื่อรักษา referential integrity ของทะเบียนย้อนหลัง

### 5.2 ผู้ใช้หลายสังกัด (Multi-Affiliation)

ตาราง `UserOrgUnit` (userId, orgUnitId, positionTitle, isPrimary, startDate, endDate)

**Context Switcher** — บน header เลือกหน่วยงานที่กำลังทำงานอยู่ เก็บใน session (`activeOrgUnitId`)

- เอกสารที่สร้างใหม่จะได้ `ownerUnitId = activeOrgUnitId` เสมอ
- เลขทะเบียนที่ออกใช้ sequence ของหน่วยงานนั้น
- ถ้าผู้ใช้มีสังกัดเดียว → ซ่อน switcher ทั้งหมด (ลด noise)

**โหมด "ดูรวมทุกสังกัด"** — toggle บนหน้า Inbox / Outbox / ค้นหา

- Query แบบ `ownerUnitId IN (ทุกสังกัดที่ผู้ใช้มีสิทธิ์)` พร้อม badge สีบอกหน่วยงานต้นทางในแต่ละแถว
- โหมดนี้เป็น **read-only view** — การกระทำใด ๆ (ออกเลข/เวียน/ปิดเรื่อง) ต้องสลับ context ก่อน
  เพื่อไม่ให้เกิดความกำกวมว่าทำในนามหน่วยงานใด

---

## 6. วงจรชีวิตเอกสาร (State Machine)

### 6.1 หนังสือภายใน — บันทึกข้อความ (INTERNAL)

```
DRAFT ──submit──► PENDING_NUMBER ──issueNumber──► REGISTERED ──circulate──► CIRCULATING
  ▲                     │                                                        │
  │                  return                                          acknowledge │
  │                     ▼                                                        ▼
  └──────────────── RETURNED ──แก้ไข──► (submit อีกครั้ง)                      CLOSED

DRAFT / PENDING_NUMBER ──cancel──► CANCELLED
```

### 6.2 หนังสือส่งภายนอก (OUTGOING)

```
DRAFT ──submit──► PENDING_NUMBER ──issueNumber──► REGISTERED ──markSent──► SENT ──► CLOSED
                        │
                     return
                        ▼
                    RETURNED ──แก้ไข──► DRAFT
```

### 6.3 หนังสือรับ (INCOMING — โมดูลเบาตาม A1)

```
RECEIVED ──forward──► FORWARDED ──acknowledge──► CLOSED
(สารบรรณลงทะเบียนรับ + ออกเลขรับ)
```

### 6.4 กติกาที่บังคับในระดับ Service Layer

| กติกา | เหตุผล |
|---|---|
| แก้ไข metadata / ไฟล์แนบได้เฉพาะสถานะ `DRAFT` และ `RETURNED` | รักษาความน่าเชื่อถือของทะเบียน |
| **เมื่อออกเลขแล้ว (`REGISTERED` ขึ้นไป) ห้ามลบ ห้ามแก้เลขที่/วันที่/ชื่อเรื่อง** | เลขทะเบียนคือหลักฐานทางราชการ · แก้ได้เฉพาะเพิ่มไฟล์แนบเวอร์ชันใหม่พร้อมบันทึกเหตุผล |
| ยกเลิกหลังออกเลข → `CANCELLED` แต่**เลขถูกจอง (burn) ไม่นำกลับมาใช้ซ้ำ** | เลขที่หายไปจากทะเบียนคือสัญญาณของการทุจริต · ยังปรากฏในทะเบียนพร้อมหมายเหตุ "ยกเลิก" |
| ทุก transition เขียน `DocumentAction` | เป็น timeline ที่ผู้ใช้เห็นในหน้ารายละเอียด |
| `AuditLog` เป็นคนละชั้นกับ `DocumentAction` | audit ละเอียดกว่า append-only สำหรับผู้ตรวจสอบ ไม่ใช่สำหรับผู้ใช้ทั่วไป |

---

## 7. ระบบเลขทะเบียน

### 7.1 รูปแบบเลข

**รูปแบบที่ใช้จริง (D16)** — `{unitCode}/{seq:4}`
คือ **รหัสหน่วยงาน 6 หลัก** ทับ **ลำดับที่ของหน่วยงานนั้น**

| ประเภท | Pattern | ตัวอย่าง |
|--------|---------|---------|
| หนังสือส่งภายนอก | `{unitCode}/{seq:4}` | `510000/0451` (คณะบริหารธุรกิจ ฉบับที่ 451) |
| บันทึกข้อความภายใน | `{unitCode}/{seq:4}` | `010100/0128` (ฝ่ายบริหารทั่วไป ฉบับที่ 128) |
| หนังสือรับ | `รับ {seq}/{year}` | `รับ 1042/2569` |
| คำสั่ง / ประกาศ | `{docType} ที่ {seq}/{year}` | `คำสั่งที่ 55/2569` |

**กติกาของลำดับเลข**

- ลำดับ **เดินแยกต่อหน่วยงาน** — คณะบริหารธุรกิจกับสำนักหอสมุดต่างมีลำดับของตัวเอง
- **รีเซ็ตเป็น 1 ทุกต้นปี** ตาม §7.2 · ปีปัจจุบันคือ **พ.ศ. 2569**
- ปีไม่ปรากฏในตัวเลขที่พิมพ์ออกมา แต่ **เป็นส่วนหนึ่งของคีย์** `NumberSequence` เสมอ
  ไม่งั้นเลขปีถัดไปจะชนกับปีนี้
- ออกเลขได้เฉพาะหน่วยงานที่ `canIssueNumber = true` (D15) — ผู้ใช้ที่สังกัดหน่วยระดับ "งาน"
  ต้องสลับ context ไปยังหน่วยงานแม่ที่ออกเลขได้ก่อน (§5.2)

**Token ที่รองรับ:** `{unitCode}` `{unitShort}` `{seq}` `{seq:4}` (zero-pad) `{year}` `{yearShort}` `{docType}` `{bookCode}`

> Pattern ยังตั้งค่าได้ต่อ (หน่วยงาน × ประเภทหนังสือ × ทิศทาง) ที่ `/admin/numbering`
> ค่าปริยายของทุกหน่วยคือ `{unitCode}/{seq:4}`

### 7.2 ปีที่ใช้รีเซ็ต

ตั้งค่าระดับระบบ: `FISCAL` (1 ต.ค. – 30 ก.ย.) หรือ `CALENDAR` (1 ม.ค. – 31 ธ.ค.)
ค่าที่ใช้: **`CALENDAR`** · แสดงผลเป็น พ.ศ. เสมอ · **ปีปัจจุบัน พ.ศ. 2569**

> ⚠️ ผู้ใช้ระบุ "ให้เป็นปี 2569" ซึ่งตรงกันทั้งสองแบบในช่วงเวลานี้
> (ปีงบ 2569 = ต.ค. 2568 – ก.ย. 2569 · ปีปฏิทิน 2569 = ม.ค. – ธ.ค. 2569)
> จึงคงค่า `CALENDAR` ตามค่าปริยายเดิมไว้ · **ต่างกันจริงเมื่อถึง 1 ต.ค. 2569**
> — ถ้าสารบรรณต้องรีเซ็ตเลขวันนั้น ให้เปลี่ยนเป็น `FISCAL` ที่ `/admin/settings` ก่อนถึงวันดังกล่าว

### 7.3 การออกเลขแบบปลอดภัย ⚠️ Critical

**ปัญหาที่ต้องกัน:** เลขซ้ำเมื่อเจ้าหน้าที่สารบรรณ 2 คนกดออกเลขพร้อมกัน — นี่คือบั๊กที่ทำลายความน่าเชื่อถือของระบบสารบรรณทั้งระบบ

```
ภายใน Prisma interactive transaction (isolation: Serializable):

  0. ตรวจว่า orgUnit.canIssueNumber = true ไม่งั้นปฏิเสธตั้งแต่ต้น (D15)

  1. SELECT * FROM "NumberSequence"
       WHERE tenantId=? AND orgUnitId=? AND direction=? AND bookCode=? AND year=?
       FOR UPDATE                          ← row-level lock

  2. ถ้าไม่พบ row → INSERT (lastValue = 0) แบบ ON CONFLICT DO NOTHING
                    แล้ววนกลับไปข้อ 1

  3. UPDATE SET lastValue = lastValue + 1 RETURNING lastValue

  4. render pattern → docNo

  5. INSERT Document
       พร้อม UNIQUE (tenantId, orgUnitId, direction, bookCode, year, seqValue)
```

**มาตรการป้องกันซ้อน:**

- **UNIQUE constraint คือด่านสุดท้าย** — ต่อให้ application logic ผิดพลาด ฐานข้อมูลจะไม่ยอมให้เลขซ้ำ
- ต้องมี **integration test ยิง 50 requests พร้อมกัน** ยืนยันว่าได้เลข 1–50 ครบ ไม่ซ้ำ ไม่ข้าม (เป็น acceptance criteria ของ P2)
- **เอกสารลับ/ลับมาก/ลับที่สุด ใช้ `bookCode` แยกจากหนังสือปกติ** (แยกทะเบียนตามระเบียบ)
- รองรับ "จองเลขล่วงหน้า" (reserve) สำหรับกรณีเร่งด่วน → สถานะ `RESERVED` มี TTL
  ถ้าไม่ใช้ภายใน N วัน จะถูก mark เป็น "เลขว่าง (ยกเลิก)" และ **ไม่นำกลับมาใช้ซ้ำ**

---

## 8. ความปลอดภัยและชั้นความลับ

### 8.1 ระดับชั้นความลับ

| Level | ชื่อ | สี UI | Encryption | Watermark | Download | Audit |
|:---:|------|-------|:---:|:---:|---|---|
| 0 | ปกติ | เทา | — | — | ได้ | ปกติ |
| 1 | ลับ | เหลือง | ✓ | ✓ | ต้อง grant | เข้ม |
| 2 | ลับมาก | ส้ม | ✓ | ✓ | ต้อง grant + ระบุเหตุผล | เข้ม |
| 3 | ลับที่สุด | แดง | ✓ | ✓ | **ห้าม** (view-only) | เข้มสุด + alert |

ผู้ใช้แต่ละคนมี `clearanceLevel` (0–3) — เข้าถึงเอกสารได้เมื่อ `clearanceLevel >= confidentialityLevel` **และ** มี ACL ระบุตัวบุคคล (สำหรับ level ≥ 1)

### 8.2 การเข้ารหัสไฟล์แนบ (Encryption at Rest)

> **สถานะการทำ (D18 · ปิดใน P3 · 25 ส.ค. 2569)** — ทำครบตามหัวข้อนี้แล้ว
> โดยเข้ารหัสเฉพาะไฟล์ของเอกสาร **ชั้นความลับ 1–3** ส่วนชั้น 0 เก็บเป็นไฟล์ธรรมดา
>
> | | สถานะ |
> |---|---|
> | ที่เก็บ | `LocalFsStorage` · ไฟล์ตั้งชื่อด้วย UUID เก็บนอก `public/` · เปลี่ยน adapter ได้โดยไม่แตะ business logic |
> | เนื้อไฟล์ | AES-256-GCM · DEK ต่อไฟล์ wrap ด้วย Master Key จาก env · รองรับหลายรุ่นเพื่อหมุนกุญแจ |
> | ฟิลด์ใน `Attachment` | เติมค่าจริงแล้วสำหรับเอกสารลับ (`isEncrypted` `encAlgo` `encryptedDek` `iv` `authTag` `keyVersion`) |
> | การส่งไฟล์ | `/api/files/[id]` + ตรวจสิทธิ์ + ถอดรหัสแบบ stream + แปะลายน้ำ + audit |
>
> ⚠️ **ข้อจำกัดที่ยังเหลือ:** ไฟล์ของเอกสาร **ชั้น 0** ยังอ่านได้ตรงจากดิสก์โดยไม่ผ่าน `can()`
> ซึ่งเป็นผลของการตัดสินใจข้างต้น ไม่ใช่ของที่ลืมทำ · ส่วนเอกสารชั้น 1–3 คนที่เข้าถึงดิสก์ได้
> จะเห็นแต่ ciphertext เพราะกุญแจอยู่ใน env ไม่ได้อยู่ในฐานข้อมูล

**Envelope Encryption:**

1. ทุกไฟล์ลับสุ่ม DEK (Data Encryption Key) แบบ AES-256-GCM
2. เข้ารหัสไฟล์ด้วย DEK
3. DEK ถูก wrap ด้วย Master Key (KEK)

**กติกาการจัดการกุญแจ:**

- Master Key เก็บใน environment variable / ไฟล์นอก webroot
  **ห้ามเก็บใน database หรือ git เด็ดขาด**
- เตรียม interface สำหรับต่อ HSM / HashiCorp Vault ในอนาคต
- เก็บใน DB เฉพาะ: `encryptedDek`, `iv`, `authTag`, `algo`, `keyVersion` → รองรับ key rotation
- ไฟล์บนดิสก์ตั้งชื่อด้วย UUID (ไม่ใช้ชื่อไฟล์จริง) และเก็บ**นอก** `public/` เสมอ
- เก็บ `sha256` ของไฟล์ต้นฉบับ → ตรวจ integrity + ตรวจจับการอัปโหลดซ้ำ

### 8.3 Secure File Delivery

**ไม่มี URL ตรงถึงไฟล์** — ทุกการเข้าถึงผ่าน Route Handler `/api/files/[attachmentId]`:

```
1. ตรวจ session
2. can(ctx, 'attachment.download' | 'attachment.view', document)
3. ตรวจ clearance level
4. ถอดรหัส (stream)                    ← P3 (D18)
5. แปะ watermark (ถ้าเป็นเอกสารลับ)      ← P3
6. เขียน audit log
7. ส่งกลับ
```

ครบทั้งเจ็ดข้อแล้วตั้งแต่ P3 (ข้อ 4–5 คือส่วนที่เพิ่มเข้ามาในเฟสนั้น)

**Watermark** ฝัง **ชื่อผู้เปิด + username + วันเวลา + IP** ทับทุกหน้าแบบทแยง (ใช้ `pdf-lib`) ·
**PDF เท่านั้น** — ไฟล์ลับชนิดอื่น (รูปภาพ · Word · Excel) ส่งแบบ inline และเขียน audit ตามปกติ แต่ไม่มีลายน้ำ
→ หากมีภาพหน้าจอรั่วออกไป จะสาวกลับถึงตัวผู้ทำได้

**เอกสารลับที่สุด:** ส่ง header `Content-Disposition: inline`, ปิดปุ่ม download/print ใน viewer, `Cache-Control: no-store`

> ⚠️ **ข้อจำกัดที่ต้องสื่อสารกับผู้บริหาร**
> การป้องกันดาวน์โหลดฝั่ง client **ไม่ใช่การป้องกันเชิงเทคนิคที่สมบูรณ์** — ผู้ใช้ที่เห็นเอกสารบนหน้าจอย่อมถ่ายภาพได้เสมอ
> Watermark + Audit จึงเป็น **มาตรการเชิงป้องปรามและสืบสวน** ไม่ใช่การปิดกั้น
> ต้องให้ผู้บริหารเข้าใจข้อจำกัดนี้ก่อนอนุมัติให้เอกสารชั้นสูงเข้าระบบ

### 8.4 Application Security Baseline

| ด้าน | มาตรการ |
|------|---------|
| รหัสผ่าน | Argon2id · ความยาว ≥ 10 · ตรวจกับ common-password list · บังคับเปลี่ยนครั้งแรก |
| Brute force | นับ `failedLoginCount` → lock ชั่วคราวแบบ exponential backoff + rate limit ต่อ IP |
| Session | JWT ลงนามด้วย `jose` ใน cookie (httpOnly + Secure + SameSite=Lax) **+ ตาราง `Session`** เพื่อให้ revoke ได้จริง · idle timeout 30 นาที · absolute 8 ชม. |
| CSRF | Server Actions ของ Next.js มี origin check ในตัว + double-submit token สำหรับ route handler ที่ mutate |
| Upload | whitelist MIME + magic-number check (ไม่เชื่อ extension) · จำกัดขนาด 50MB · ตัด path traversal · เตรียม hook สำหรับ ClamAV |
| Injection | Prisma parameterized เท่านั้น · raw SQL ต้องใช้ `$queryRaw` แบบ tagged template |
| XSS | ไม่ใช้ `dangerouslySetInnerHTML` · CSP strict (`default-src 'self'` ห้าม inline script) |
| Headers | HSTS · X-Frame-Options: DENY · X-Content-Type-Options: nosniff · Referrer-Policy |
| PDPA | เก็บ personal data เท่าที่จำเป็น · หน้านโยบายความเป็นส่วนตัว · retention policy ของ audit log |

### 8.5 Audit Log

**Append-only** — ไม่มีคำสั่ง UPDATE/DELETE ในโค้ด และ**บังคับที่ระดับฐานข้อมูล** (app user ไม่มี grant ให้ลบ/แก้ตาราง audit)

**ฟิลด์ที่บันทึก:**
`at` · `actorUserId` · `actorOrgUnitId` · `action` · `entityType` · `entityId` · `result` (ALLOW/DENY) · `ip` · `userAgent` · `sessionId` · `severity` · `metadata` (JSONB)

**Hash Chain:** แต่ละแถวเก็บ `prevHash` + `hash = SHA256(prevHash + payload)`
→ ตรวจจับการแก้ไขย้อนหลังได้ แม้ผู้แก้จะมีสิทธิ์ระดับ DB

**เหตุการณ์ที่ต้องบันทึกเสมอ:**

- Login สำเร็จ / ล้มเหลว
- ดู / ดาวน์โหลดเอกสาร (**ทุกฉบับ** ไม่ใช่เฉพาะเอกสารลับ)
- ออกเลขทะเบียน
- เปลี่ยนสถานะเอกสาร
- Grant / Revoke สิทธิ์
- แก้ไขผู้ใช้ / หน่วยงาน / บทบาท
- **การเข้าถึงที่ถูกปฏิเสธ (DENY)** — สำคัญที่สุดสำหรับตรวจจับการพยายามบุกรุก

**หน้า `/admin/audit`:** filter ตามผู้ใช้/เอกสาร/ช่วงเวลา/ประเภท + export CSV + ปุ่มตรวจสอบความสมบูรณ์ของ hash chain

---

## 9. แบบจำลองข้อมูล (Data Model)

### 9.1 Entities

```
Tenant              เผื่ออนาคต — MVP มีแถวเดียว

OrgUnit             id, tenantId, parentId, path, code(รหัส 6 หลัก), nameTh,
                    shortName, type, level, sortOrder, headUserId, isActive,
                    canIssueNumber          ← D15 · ระดับ "งาน" เป็น false

User                id, tenantId, username(unique), passwordHash, email,
                    prefix, firstName, lastName, clearanceLevel(0-3),
                    isActive, mustChangePassword, failedLoginCount,
                    lockedUntil, lastLoginAt

UserOrgUnit         id, userId, orgUnitId, positionTitle, isPrimary,
                    startDate, endDate        @@unique([userId, orgUnitId])

Role                id, code(unique), nameTh, isSystem, description
Permission          code(PK), group, nameTh
RolePermission      roleId, permissionCode, scope(OWN|UNIT|SUBTREE|ORG)
UserRole            id, userId, roleId, orgUnitId(nullable → global),
                    grantedById, grantedAt, expiresAt

DocumentType        id, code, nameTh, direction, defaultBookCode,
                    numberPattern, isActive

Document            id, tenantId, docNo, seqValue, bookCode, year,
                    documentTypeId, direction, subject, summary,
                    docDate, receivedDate, dueDate,
                    confidentialityLevel(0-3), urgencyLevel(0-3), status,
                    ownerUnitId, createdById, createdByUnitId,
                    externalSenderName, externalRecipientName,
                    refDocNo, parentDocumentId, searchVector(tsvector),
                    createdAt, updatedAt, deletedAt
                    @@unique([tenantId, ownerUnitId, direction, bookCode, year, seqValue])

NumberSequence      id, tenantId, orgUnitId, direction, bookCode, year,
                    lastValue, patternOverride
                    @@unique([tenantId, orgUnitId, direction, bookCode, year])

Attachment          id, documentId, version, fileName, mimeType, sizeBytes,
                    sha256, storageKey, isEncrypted, encAlgo, encryptedDek,
                    iv, authTag, keyVersion, uploadedById, uploadedAt, deletedAt

DocumentRecipient   id, documentId, orgUnitId?, userId?, kind(TO|CC|FYI),
                    sentAt, readAt, acknowledgedAt, status

DocumentAction      id, documentId, actorUserId, actorUnitId, actionType,
                    fromStatus, toStatus, note, createdAt

DocumentAcl         id, documentId, principalType(USER|ORG_UNIT|ROLE),
                    principalId, permission(VIEW|DOWNLOAD|EDIT|MANAGE),
                    effect(ALLOW|DENY), grantedById, grantedAt, expiresAt, reason

AuditLog            id, tenantId, at, actorUserId, actorOrgUnitId, action,
                    entityType, entityId, result, ip, userAgent, sessionId,
                    severity, metadata(Jsonb), prevHash, hash

Notification        id, userId, type, title, body, refType, refId, readAt, createdAt

Session             id, userId, activeOrgUnitId, ip, userAgent,
                    createdAt, lastSeenAt, expiresAt, revokedAt

SystemSetting       key(PK), value(Jsonb), updatedById, updatedAt
```

### 9.2 Index ที่ต้องมี

| Index | เหตุผล |
|---|---|
| `OrgUnit(path)` — B-tree | subtree query ด้วย `LIKE 'path%'` |
| `Document(tenantId, ownerUnitId, status, docDate DESC)` | หน้า list หลัก |
| `Document(subject)` — **GIN + pg_trgm** | ⚠️ **สำคัญ:** ภาษาไทยไม่มีเว้นวรรค tsvector มาตรฐานจึงตัดคำไม่ได้ → **ต้องใช้ `pg_trgm` เป็นกลไกค้นหาหลัก** |
| `Document(searchVector)` — GIN | เสริมสำหรับเลขที่หนังสือ / ตัวเลข / คำอังกฤษ |
| `AuditLog(at DESC)`, `(actorUserId, at DESC)`, `(entityType, entityId)` | หน้าตรวจสอบ |
| `DocumentRecipient(orgUnitId, status)` / `(userId, readAt)` | หน้า Inbox |
| Partition `AuditLog` ตามเดือน | เตรียมไว้ ทำเมื่อข้อมูลโต (ไม่ทำใน MVP) |

### 9.3 กติกา Data Integrity

- ทุกการลบเป็น **soft delete** (`deletedAt`) — เอกสารที่ออกเลขแล้วห้ามลบเด็ดขาด
- FK ทั้งหมดใช้ `onDelete: Restrict` (ไม่ cascade) เพื่อกันข้อมูลทะเบียนหายเป็นลูกโซ่
- ตัวเลขใช้ `Int` / `Decimal` ไม่ใช้ float
- เวลาเก็บเป็น `timestamptz` (UTC) แปลงเป็น Asia/Bangkok ที่ชั้น presentation เท่านั้น

---

## 10. การออกแบบ UX/UI

### 10.1 Information Architecture

```
/login

/dashboard              สรุปสถิติ + งานค้าง + เอกสารล่าสุด
/inbox                  หนังสือที่ส่งถึงฉัน/หน่วยงานฉัน  [toggle: หน่วยงานนี้ | ทุกสังกัด]
/outbox                 หนังสือที่ฉัน/หน่วยงานฉันส่งออก
/drafts                 ร่างของฉัน + ที่ถูกตีกลับ

/documents/new          สร้างหนังสือ
/documents/[id]         รายละเอียด + ไฟล์แนบ + timeline + ปุ่ม action ตามสิทธิ์

/registry/outgoing      คิวรอออกเลข (สารบรรณ) — รองรับ bulk issue
/registry/incoming      ลงทะเบียนหนังสือรับ

/search                 ค้นหาขั้นสูง
/reports/register       ทะเบียนหนังสือ + export Excel/PDF

/admin/org-units        จัดการโครงสร้างหน่วยงาน (tree view, drag-to-move)
/admin/users            จัดการผู้ใช้ + สังกัด + บทบาท + clearance
/admin/roles            จัดการบทบาท/สิทธิ์
/admin/numbering        ตั้งค่า pattern เลขทะเบียนต่อหน่วยงาน
/admin/audit            ตรวจสอบ audit log
/admin/settings         ค่าระบบ (ปีงบ/ปฏิทิน, ขนาดไฟล์, นโยบายรหัสผ่าน)
```

### 10.2 หลักการออกแบบ

สอดคล้องกับเป้าหมาย "ใช้งานง่าย + ลดขั้นตอนงานเอกสาร":

| หลักการ | รายละเอียด |
|---|---|
| **สร้างหนังสือให้จบใน 1 หน้า** | form เดียว ไม่ใช่ wizard หลายสเต็ป: ประเภท → เรื่อง → ผู้รับ → ชั้นความลับ/ชั้นความเร็ว → drag-drop ไฟล์ → ปุ่ม "บันทึกร่าง" / "ส่งออกเลข" |
| **สารบรรณออกเลขแบบ bulk** | เลือกหลายรายการในคิว → กด "ออกเลขทั้งหมด" ทีเดียว — **นี่คือจุดที่ลดเวลาทำงานได้มากที่สุด** |
| **Badge สื่อสารสถานะชัด** | สีชั้นความลับ (§8.1) + ชั้นความเร็ว (ด่วน/ด่วนมาก/ด่วนที่สุด) มองเห็นได้จากหน้า list ไม่ต้องเปิดเข้าไปดู |
| **Timeline แนวตั้ง** | ในหน้ารายละเอียด — ใครทำอะไรเมื่อไร อ่านเข้าใจได้โดยไม่ต้องอธิบาย |
| **Context Switcher เด่นชัดตลอด** | อยู่บน header เสมอ แสดงหน่วยงานปัจจุบันชัดเจน — เพราะการทำงานผิดหน่วยงานคือความผิดพลาดที่แก้ยากที่สุด |
| **ปุ่ม action ซ่อนตามสิทธิ์จริง** | ซ่อน ไม่ใช่ disable เพื่อลดความสับสน — แต่ **ยังต้องตรวจสิทธิ์ที่ server เสมอ** |
| **Responsive** | Desktop-first (งานสารบรรณทำบน PC) แต่มือถือต้องอ่านเอกสาร/รับทราบ/ค้นหาได้ครบ — table ยุบเป็น card ที่ `< 768px` |
| **ฟอนต์และรูปแบบไทย** | IBM Plex Sans Thai หรือ Sarabun (self-host ไม่พึ่ง CDN เพราะ deploy on-premise) · แสดง พ.ศ. เสมอ |
| **Accessibility** | WCAG 2.1 AA — contrast, keyboard navigation, focus ring, aria-label ภาษาไทย |

---

## 11. สถาปัตยกรรมทางเทคนิค

### 11.1 Technology Stack

| ชั้น | เทคโนโลยี |
|------|-----------|
| Framework | **Next.js 16** (App Router, Server Components, Server Actions) |
| Language | **TypeScript** strict mode · `noUncheckedIndexedAccess: true` |
| ORM / DB | **Prisma 7** + **PostgreSQL 16** (extensions: `pg_trgm`, `unaccent`) |
| UI | **Tailwind CSS v4** + **shadcn/ui** + lucide-react |
| Form / Validate | react-hook-form + **Zod** (schema เดียวใช้ทั้ง client & server) |
| Auth | Custom credentials + `jose` (JWT) + Session table + `argon2` |
| Files | `pdf-lib` (watermark) · `node:crypto` (AES-256-GCM) |
| Export | `exceljs` (Excel) · `pdf-lib` / `@react-pdf/renderer` (PDF) |
| Test | Vitest (unit/integration) + Playwright (e2e) |
| Package Manager | **pnpm เท่านั้น** (ห้ามใช้ npm หรือ yarn) |
| Deploy | Docker Compose: `app` + `postgres` + `nginx` (reverse proxy + TLS) |

### 11.2 โครงสร้างโปรเจกต์

```
src/
├── app/
│   ├── (auth)/login/
│   ├── (app)/                              ← layout ที่มี sidebar + context switcher
│   │   ├── dashboard/  inbox/  outbox/  drafts/
│   │   ├── documents/[id]/  documents/new/
│   │   ├── registry/  search/  reports/
│   │   └── admin/
│   └── api/files/[attachmentId]/route.ts   ← secure file delivery เท่านั้น
│
├── server/
│   ├── actions/          Server Actions (บาง — เรียก service)
│   ├── services/         business logic ทั้งหมด (document, numbering, attachment, …)
│   └── repositories/     Prisma queries
│
├── lib/
│   ├── authz/            can(), scope resolver, permission constants
│   ├── auth/             session, password, rate-limit
│   ├── crypto/           envelope encryption
│   ├── storage/          StorageAdapter (LocalFs | S3 ในอนาคต)
│   ├── audit/            audit writer + hash chain
│   ├── notification/     NotificationAdapter (InApp | Email | LINE ในอนาคต)
│   └── thai/             พ.ศ., เลขไทย, จัดรูปแบบเลขหนังสือ
│
├── components/ui/        shadcn components
└── schemas/              Zod schemas (แชร์ client/server)

prisma/
├── schema.prisma
├── migrations/
└── seed.ts               permissions, roles, org tree ตัวอย่าง, admin คนแรก

docs/
└── spec.md               เอกสารนี้
```

### 11.3 หลักสถาปัตยกรรมที่ต้องยึด

1. **Server Action บาง — Service หนา**
   Action ทำแค่: ตรวจ auth → validate ด้วย Zod → เรียก service → revalidate
   **ห้ามมี business logic ใน action**

2. **Authorization ที่ Service Layer เสมอ ไม่ใช่ที่ UI**
   ทุก service method รับ `ctx: { userId, activeOrgUnitId, permissions }` เป็น argument แรก

3. **StorageAdapter / NotificationAdapter เป็น interface ตั้งแต่วันแรก**
   → เปลี่ยนเป็น S3 หรือเพิ่ม Email/LINE ได้โดยไม่แตะ business logic (ตอบโจทย์ "ขยายระบบในอนาคต")

4. **`tenantId` ในทุกตารางหลักตั้งแต่วันแรก** + ใส่ใน where clause เสมอ
   → เปิด multi-tenant ภายหลังได้โดยไม่ต้อง migrate ใหญ่

5. **Audit เขียนใน transaction เดียวกับ business operation**
   → ไม่มีทางที่ action สำเร็จแต่ audit หาย

---

## 12. ความต้องการเชิงคุณภาพ (Non-Functional)

| ด้าน | เป้าหมาย |
|------|---------|
| **Performance** | หน้า list < 1.5s (p95) ที่ 1,000 concurrent users · ค้นหา < 2s บนฐานเอกสาร 500,000 ฉบับ |
| **ปริมาณข้อมูล** | ~50,000 เอกสาร/ปี · ไฟล์แนบเฉลี่ย 2MB → **~100GB/ปี** ต้องวางแผน disk + archive ล่วงหน้า |
| **Availability** | 99% ในเวลาราชการ · maintenance นอกเวลาทำการ |
| **Backup** | `pg_dump` รายวัน + WAL archiving · ไฟล์แนบ rsync รายวัน · **ทดสอบ restore ทุกไตรมาส** |
| **Retention** | เอกสาร: เก็บถาวรตามระเบียบ · Audit log: ≥ 3 ปี online แล้ว archive ต่อ |
| **Browser** | Chrome / Edge / Firefox / Safari 2 เวอร์ชันล่าสุด |
| **Accessibility** | WCAG 2.1 AA |
| **i18n** | ไทยอย่างเดียว แต่**แยกข้อความออกจาก component** (constants file) เผื่อเพิ่มภาษาภายหลัง |

---

## 13. แผนการพัฒนา (Roadmap)

| Phase | สถานะ | ขอบเขต | ประมาณการ | Definition of Done |
|-------|:---:|--------|-----------|-------------------|
| **P0 — Foundation** | [x] | `pnpm create next-app` (Next 16 + TS strict) · Tailwind v4 + shadcn · Prisma 7 + Postgres · Docker Compose · ESLint/Prettier · โครงโฟลเดอร์ §11.2 · CI (typecheck/lint/test) | **1 สัปดาห์** | `pnpm dev` + `pnpm build` ผ่าน · migrate + seed สำเร็จ |
| **P1 — Identity & Org** | [x] | Auth (login/logout/เปลี่ยนรหัส/lockout) · Session table · OrgUnit CRUD + tree UI + materialized path · User CRUD + multi-affiliation · Role/Permission + `can()` · Context Switcher · Audit เบื้องต้น | **2–3 สัปดาห์** | Admin สร้างโครงสร้าง 3 ระดับ + ผู้ใช้ 2 สังกัด แล้วสลับ context ได้ · unit test ของ `can()` ครอบทุก scope |
| **P2 — Core Documents** | [x] | DocumentType · สร้าง/แก้/ส่งร่าง · NumberSequence + ออกเลข (พร้อม concurrency test) · Attachment upload + PDF preview · Inbox/Outbox/Drafts · state machine + DocumentAction timeline · คิวออกเลข + bulk issue · ตีกลับแก้ไข | **3–4 สัปดาห์** | ทำ flow บันทึกข้อความและหนังสือส่งได้ครบตั้งแต่ร่างถึงปิดเรื่อง · **test เลขซ้ำผ่าน** |
| **P3 — Security & Confidential** | [x] | ชั้นความลับ 4 ระดับ + clearance · envelope encryption · secure file route + watermark + view-only · DocumentAcl (grant/revoke) · Audit hash chain + `/admin/audit` · security headers + CSP + rate limit | **2 สัปดาห์** | เอกสารลับที่สุดเปิดดูได้แต่ดาวน์โหลดไม่ได้ · ไฟล์บนดิสก์เปิดตรงไม่ได้ · audit ครบทุก access |
| **P4 — Search & Reports** | [x] | ค้นหาขั้นสูง (pg_trgm) · Dashboard สถิติ · ทะเบียนหนังสือ + Export Excel/PDF ตามรูปแบบราชการ | **2 สัปดาห์** | ค้นภาษาไทยเจอ · export เปิดใน Excel ได้ฟอนต์ไม่เพี้ยน |
| **P5 — Incoming & Hardening** | [ ] | โมดูลลงทะเบียนหนังสือรับ (A1) · Notification in-app · Responsive polish · Playwright e2e · Backup script · คู่มือผู้ใช้ + UAT | **2–3 สัปดาห์** | UAT ผ่านกับผู้ใช้จริง ≥ 5 คนจาก 3 หน่วยงาน |

**รวมประมาณ 12–15 สัปดาห์** สำหรับ MVP ที่ใช้งานจริงได้

### ผลการปิดเฟส

| Phase | ปิดเมื่อ | Definition of Done ผ่านครบไหม |
|---|---|---|
| **P0** | 22 ส.ค. 2569 | ✅ ผ่าน — ยกเว้นข้อ CI ที่ผู้ใช้สั่งข้าม (ดู `docs/progress.md` §6.12) |
| **P1** | 24 ส.ค. 2569 | ✅ ผ่านครบ — Admin สร้างผัง 3 ระดับได้ · `rattana.wong` มี 2 สังกัดและสลับ context ได้ · unit test ของ `can()` ครอบทุก scope (OWN/UNIT/SUBTREE/ORG) รวม 33 เคส |

รายละเอียดของแต่ละเฟสอยู่ใน [progress.md](./progress.md)

### Post-MVP

Approval workflow engine → Digital signature (PKI) → SSO (AD/Google) → Email/LINE notification → OCR + full-text ในไฟล์ → Template generator → Mobile PWA → Multi-tenant

---

## 14. แผนการทดสอบ (Verification)

| ระดับ | วิธีทดสอบ |
|-------|----------|
| **Unit** (Vitest) | `can()` ทุกชุดค่าผสม role × scope × confidentiality · pattern renderer ของเลขทะเบียน · envelope encrypt/decrypt round-trip · materialized path update เมื่อย้ายหน่วยงาน |
| **Integration** | ⚠️ **Concurrency: ยิง `issueNumber` 50 ครั้งพร้อมกัน → ต้องได้เลข 1–50 ครบ ไม่ซ้ำ ไม่ข้าม** · state machine ปฏิเสธ transition ที่ผิด · soft delete ไม่หลุดมาใน query |
| **Security** | ผู้ใช้ต่างหน่วยงานเรียก `/api/files/[id]` ตรง → ต้อง 403 + มี audit DENY · เปิดไฟล์บนดิสก์ตรง → ต้องเป็น ciphertext · SQL injection ผ่าน search box · IDOR (เปลี่ยน `documentId` ใน URL) |
| **E2E** (Playwright) | flow เต็ม: ผู้ใช้ร่าง → ส่ง → สารบรรณออกเลข → เวียน → ผู้รับรับทราบ → ปิดเรื่อง → ค้นเจอในทะเบียน · flow สลับ context 2 สังกัด · flow เอกสารลับ (ดูได้ / ดาวน์โหลดไม่ได้ / watermark ปรากฏ) |
| **Manual / UAT** | สารบรรณจริงลองออกเลข 20 ฉบับเทียบกับสมุดทะเบียนกระดาษ · ทดสอบบนมือถือจริง · ตรวจ export Excel เทียบกับรูปแบบทะเบียนที่ใช้อยู่ |
| **Performance** | seed 500,000 เอกสาร → วัดเวลาหน้า list และ search เทียบเป้าใน §12 |

**คำสั่งหลัก**

```bash
pnpm dev                  # รัน dev server
pnpm typecheck            # ตรวจ TypeScript
pnpm lint                 # ESLint
pnpm test                 # Vitest
pnpm test:e2e             # Playwright
pnpm prisma migrate dev   # migrate database
pnpm prisma db seed       # seed ข้อมูลตั้งต้น
docker compose up -d      # รันทั้ง stack
```

---

## 15. คำถามที่ยังค้าง

ต้องเคลียร์ก่อนเริ่ม **P2 — Core Documents**

| # | คำถาม | ผลกระทบถ้าไม่ตอบ |
|---|-------|------------------|
| 1 | **ยืนยัน A1** — MVP ต้องมีโมดูลหนังสือรับแบบเบาจริงไหม หรือตัดออกแล้วทำรายงานทะเบียนเฉพาะฝั่งส่ง | กระทบขอบเขต P5 และรูปแบบรายงาน |
| 2 | ~~**รูปแบบเลขหนังสือจริง**~~ | ✅ **ตอบแล้ว 25 ส.ค. 2569** — `{unitCode}/{seq:4}` ดู D16 และ §7.1 |
| 3 | ~~**โครงสร้างหน่วยงานจริง**~~ | ✅ **ตอบแล้ว 25 ส.ค. 2569** — รหัส 6 หลัก 371 หน่วย ดู D14 · §5.1 · §16 |
| 4 | **รูปแบบทะเบียนที่ต้อง export** — ขอไฟล์ตัวอย่างที่ใช้ส่ง สกอ./ผู้ตรวจภายใน | กระทบ P4 |
| 5 | **ปีที่ใช้รีเซ็ตเลข** — ปีงบประมาณ หรือปีปฏิทิน | 🟡 **ตอบบางส่วน 25 ส.ค. 2569** — ยืนยันว่าใช้ปี **2569** · ยังไม่ระบุว่านับแบบปีงบหรือปีปฏิทิน ซึ่งต่างกันจริงเมื่อถึง 1 ต.ค. 2569 · ตอนนี้ตั้ง `CALENDAR` ไว้ (§7.2) |
| 6 | **นโยบายเอกสารลับ** — ใครมีอำนาจกำหนด clearance level และเอกสาร "ลับที่สุด" อนุญาตให้เข้าระบบอิเล็กทรอนิกส์ได้หรือไม่ | บางองค์กรบังคับให้ใช้กระดาษเท่านั้น — กระทบขอบเขต P3 |
| 7 | **สเปกเซิร์ฟเวอร์ on-premise** — CPU/RAM/Disk · มี TLS certificate แล้วหรือยัง · backup ปัจจุบันทำอย่างไร | กระทบ P0 และแผน backup §12 |

---

## 16. ภาคผนวก ก — ผังหน่วยงานจริงและรหัสงานสารบรรณ

ที่มา: *"รหัสงานสารบรรณ (สรุป ณ วันที่ 21 สิงหาคม 2569)"* ที่ผู้ใช้ส่งมา 25 ส.ค. 2569 (D14)
ไฟล์ต้นทาง: `docs/ผังหน่วยงานจริง + รหัสหนังสือของแต่ละหน่วย.docx`
**ฉบับที่เครื่องอ่านได้: `prisma/org-units.csv`** — `prisma/seed.ts` อ่านไฟล์นี้ตอน seed
(คอลัมน์ `code, level, parentCode, nameTh, canIssueNumber, isActive, note`)
แก้ผังหน่วยงานให้แก้ที่ CSV แล้ว seed ใหม่ · **ห้าม hardcode ผังลงในโค้ด**

> อยู่ใต้ `prisma/` ไม่ใช่ `docs/` เพราะ `.dockerignore` ตัด `docs/` ออกจาก build context
> ทำให้ service `migrate` ในคอนเทนเนอร์อ่านไฟล์ไม่เจอ

**สรุปตัวเลข**

| รายการ | จำนวน |
|---|--:|
| หน่วยงานทั้งหมด | 371 |
| ระดับ 1 — คณะ/วิทยาลัย/สำนัก/สถาบัน/ศูนย์ | 38 |
| ระดับ 2 — ฝ่าย/สาขา/ศูนย์ย่อย/สำนักงานเลขานุการ | 161 |
| ระดับ 3 — งาน/หลักสูตร | 172 |
| **ออกเลขหนังสือได้** | **190** |
| ปิดใช้งาน (`isActive = false`) | 12 |

**ข้อยกเว้นที่ตัดสินไว้ — ต้องให้ผู้ใช้ยืนยัน**

| รหัส | หน่วยงาน | ปัญหา | ที่ตัดสินไว้ |
|---|---|---|---|
| `720100` `720200` | งานพัฒนาระบบสารสนเทศและประมวลผล · งานเครือข่ายและซ่อมบำรุง | อยู่ **ระดับ 2** แต่ชื่อขึ้นต้นด้วย "งาน" | **ออกเลขไม่ได้** — ยึดตามกติกา "ระดับงานออกหนังสือไม่ได้" มากกว่ายึดตามหลักของรหัส |
| `010101` | สำนักงานเลขานุการสภามหาวิทยาลัยเกริก | อยู่ **ระดับ 3** แต่เป็นสำนักงาน ไม่ใช่งาน | **ออกเลขไม่ได้** — ยึดตามระดับ · ถ้าจริง ๆ ต้องออกหนังสือเองได้ ให้เปิด `canIssueNumber` เฉพาะแถวนี้ |
| `150000` | สถาบันบริหารธุรกิจหนานหยางกรุงเทพ *(ระงับการใช้งาน)* | ต้นทางระบุว่าระงับ | ปิดใช้งานทั้งสายรวมลูก 8 หน่วย |
| `620000` | คณะการจัดการสิ่งแวดล้อมและภัยพิบัติ *(ไม่ใช้)* | ต้นทางระบุว่าไม่ใช้ | ปิดใช้งานทั้งสายรวมลูก 4 หน่วย |
| `560000` | วิทยาลัยนานชาติจีนศึกษาและเทคโนโลยี | ต้นทางระบุว่าเปลี่ยนชื่อ 8 พ.ค. 69 (ชื่อเดิม *วิทยาลัยนานาชาติภาษาและวัฒนธรรมจีน*) | ใช้ชื่อใหม่ · ชื่อเดิมเก็บไว้ในคอลัมน์ `note` |

> ⚠️ ชื่อในเอกสารต้นทางมีคำสะกดผิดอยู่หลายจุด (เช่น `010200` "ฝ่ายอาคารถานที่" ·
> `630000` "คณะนวัฒกรรมวิทยาศาสตร์และวิศวกรรม" · `620221` "หลักสูตรวิทยาศาตรมหาบัณฑิต")
> **คงไว้ตามต้นฉบับ** ไม่แก้เอง เพราะชื่อหน่วยงานเป็นข้อมูลทางการ — ถ้าจะแก้ต้องให้ผู้ใช้ยืนยันทีละรายการ

### รายการเต็ม

ระดับ 1 = คณะ/วิทยาลัย/สำนัก/สถาบัน/ศูนย์ · ระดับ 2 = ฝ่าย/สาขา/ศูนย์ย่อย · ระดับ 3 = งาน/หลักสูตร
คอลัมน์ "ออกเลข" คือค่า `canIssueNumber`

| รหัส | ระดับ | หน่วยงาน | ออกเลข |
|---|:--:|---|:--:|
| `010000` | 1 | สำนักอธิการบดี | ✓ |
| `010100` | 2 | ฝ่ายบริหารทั่วไป | ✓ |
| `010101` | 3 | สำนักงานเลขานุการสภามหาวิทยาลัยเกริก | ✗ |
| `010102` | 3 | งานเลขานุการ | ✗ |
| `010103` | 3 | งานสารบรรณ | ✗ |
| `010104` | 3 | งานบริการจัดเลี้ยงศูนย์อาหารและรับรอง | ✗ |
| `010200` | 2 | ฝ่ายอาคารถานที่ | ✓ |
| `010201` | 3 | งานอาคารสถานที่ | ✗ |
| `010202` | 3 | งานยานพาหนะและรักษาความปลอดภัย | ✗ |
| `010203` | 3 | งานโสตทัศนูปกรณ์ | ✗ |
| `020000` | 1 | สำนักวิชาการ | ✓ |
| `020100` | 2 | ฝ่ายบริการวิชาการและมาตรฐานการศึกษา | ✓ |
| `020200` | 2 | ฝ่ายทะเบียนและวัดผลการศึกษา | ✓ |
| `020201` | 3 | งานทะเบียนประวัตินักศึกษา | ✗ |
| `020202` | 3 | งานวัดผลการศึกษาและผลิตเอกสารทางวิชาการ | ✗ |
| `030000` | 1 | สำนักหอสมุด | ✓ |
| `030100` | 2 | ไม่ระบุฝ่าย | ✓ |
| `030101` | 3 | งานพัฒนาและบริการสารสนเทศ | ✗ |
| `030102` | 3 | งานวารสาร | ✗ |
| `040000` | 1 | สำนักกิจการนักศึกษา | ✓ |
| `040100` | 2 | ฝ่ายส่งเสริมกิจกรรมและบริการสวัสดิการนักศึกษา | ✓ |
| `040101` | 3 | งานหอพักนักศึกษา | ✗ |
| `040102` | 3 | งานกองทุนกู้ยืมเพื่อการศึกษา | ✗ |
| `040103` | 3 | งานวินัยและบริการสวัสดิการนักศึกษา | ✗ |
| `040104` | 3 | งานกิจกรรมนักศึกษาและการกีฬา | ✗ |
| `040200` | 2 | ศูนย์ศิลปวัฒนธรรม | ✓ |
| `040300` | 2 | ศูนย์แนะแนวอาชีพและจัดหางาน | ✓ |
| `050000` | 1 | สำนักพัฒนาหลักสูตรและประกันคุณภาพการศึกษา | ✓ |
| `050100` | 2 | ฝ่ายประกันคุณภาพการศึกษา | ✓ |
| `050101` | 3 | งานประมวลผลข้อมูลและวางแผนพัฒนา | ✗ |
| `050200` | 2 | ฝ่ายพัฒนาหลักสูตร | ✓ |
| `050201` | 3 | งานพัฒนาหลักสูตร | ✗ |
| `050300` | 2 | ศูนย์ยกระดับ QS | ✓ |
| `050301` | 3 | งานยกระดับ QS | ✗ |
| `060000` | 1 | สำนักสื่อสารองค์กร | ✓ |
| `060100` | 2 | ฝ่ายสื่อสารองค์กร | ✓ |
| `060101` | 3 | งานสื่อสารองค์กรและศิษย์เก่าสัมพันธ์ | ✗ |
| `060102` | 3 | งานผลิตสื่อ Digital และ Social Media | ✗ |
| `070000` | 1 | สำนักงานการต่างประเทศ | ✓ |
| `070100` | 2 | ศูนย์แนะแนวการต่างประเทศ | ✓ |
| `070200` | 2 | ศูนย์ความร่วมมือทางวิชาการต่างประเทศ | ✓ |
| `080000` | 1 | สำนักทรัพย์สิน | ✓ |
| `080100` | 2 | ฝ่ายการเงินและงบประมาณ | ✓ |
| `080200` | 2 | ฝ่ายบัญชี | ✓ |
| `080300` | 2 | ฝ่ายทรัพยากรมนุษย์ | ✓ |
| `080400` | 2 | ฝ่ายจัดซื้อ และพัสดุ | ✓ |
| `090000` | 1 | สำนักงานบริหารการศึกษาออนไลน์ | ✓ |
| `090100` | 2 | ฝ่ายวิชาการหลักสูตรออนไลน์ | ✓ |
| `090200` | 2 | ฝ่ายการตลาดหลักสูตรออนไลน์ | ✓ |
| `090300` | 2 | ฝ่ายพัฒนาสื่อบทเรียนอิเล็กทรอนิกส์ | ✓ |
| `100000` | 1 | สถาบันภาษา | ✓ |
| `100100` | 2 | สำนักงานธุรการและประสานงาน | ✓ |
| `110000` | 1 | สถาบันพัฒนาภาวะผู้นำ | ✓ |
| `110100` | 2 | สำนักงานธุรการและประสานงาน | ✓ |
| `120000` | 1 | สถาบันวิจัย ไทย จีน อาเซียน | ✓ |
| `120100` | 2 | สำนักงานธุรการและประสานงาน | ✓ |
| `130000` | 1 | สถาบันการจัดการความปลอดภัยแห่งมหาวิทยาลัยเกริก | ✓ |
| `130100` | 2 | สำนักงานธุรการและประสานงาน | ✓ |
| `140000` | 1 | สถาบันวิจัยและนวัตกรรม | ✓ |
| `140100` | 2 | ศูนย์วิจัยและพัฒนา | ✓ |
| `140101` | 3 | งานส่งเสริมวิจัย ตำราและวารสาร | ✗ |
| `140102` | 3 | งานวิจัยเพื่อท้องถิ่น | ✗ |
| `140200` | 2 | ฝ่ายตำราและวารสารวิชาการ | ✓ |
| `140300` | 2 | ฝ่ายส่งเสริมและพัฒนาวิจัย | ✓ |
| `140400` | 2 | ฝ่ายทะเบียนงานทั่วไป | ✓ |
| `140500` | 2 | ฝ่ายระบบสารสนเทศงานวิจัย | ✓ |
| `150000` | 1 | สถาบันบริหารธุรกิจหนานหยางกรุงเทพ (ระงับการใช้งานเนื่องจากบอกชื่อหน่วยงานผิด) · *ปิดใช้งาน* | ✗ |
| `150100` | 2 | สำนักงานธุรการและประสานงาน · *ปิดใช้งาน* | ✗ |
| `150200` | 2 | ไม่ระบุสาขาวิชา · *ปิดใช้งาน* | ✗ |
| `150211` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต (หลักสูตรภาษาจีน) · *ปิดใช้งาน* | ✗ |
| `150221` | 3 | หลักสูตรบริหารธุรกิจมหาบัณฑิต (หลักสูตรภาษาจีน) · *ปิดใช้งาน* | ✗ |
| `150231` | 3 | หลักสูตรบริหารธุรกิจดุษฎีบัณฑิต (หลักสูตรภาษาจีน) · *ปิดใช้งาน* | ✗ |
| `150300` | 2 | สาขาวิชาธุรกิจและการจัดการ · *ปิดใช้งาน* | ✗ |
| `150331` | 3 | หลักสูตรปรัชญาดุษฎีบัณฑิต (หลักสูตรภาษาจีน) · *ปิดใช้งาน* | ✗ |
| `160000` | 1 | สำนักงานส่งเสริมตำแหน่งทางวิชาการ | ✓ |
| `160100` | 2 | สำนักงานธุรการและประสานงาน | ✓ |
| `170000` | 1 | สำนักงานมหาวิทยาลัยภาษาและวัฒนธรรมปังกิ่งกรุงเทพ | ✓ |
| `170100` | 2 | สำนักงานธุรการและประสานงาน | ✓ |
| `180000` | 1 | สำนักการศึกษาพิเศษ | ✓ |
| `180100` | 2 | สำนักงานธุรการและประสานงาน | ✓ |
| `190000` | 1 | สำนักการตลาด | ✓ |
| `190100` | 2 | ฝ่ายพัฒนาระบบสารสนเทศการตลาด | ✓ |
| `190200` | 2 | ศูนย์แนะแนวการศึกษา | ✓ |
| `190300` | 2 | ศูนย์พัฒนาภาพลักษณ์และการตลาดออนไลน์ | ✓ |
| `190400` | 2 | ศูนย์ความร่วมมือทางวิชาการการศึกษา | ✓ |
| `200000` | 1 | สำนักความร่วมมือและการแลกเปลี่ยนประเทศจีน | ✓ |
| `200100` | 2 | สำนักงานธุรการและประสานงาน | ✓ |
| `510000` | 1 | คณะบริหารธุรกิจ | ✓ |
| `510100` | 2 | สำนักงานเลขานุการคณะบริหารธุรกิจ | ✓ |
| `510200` | 2 | สาขาวิชานวัตกรรมการตลาด | ✓ |
| `510211` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต สาขาวิชานวัตกรรมการตลาด | ✗ |
| `510212` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต สาขาวิชานวัตกรรมการตลาด (ระบบการศึกษาทางไกล) | ✗ |
| `510300` | 2 | สาขาวิชาการจัดการทรัพยากรมนุษย์ | ✓ |
| `510311` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต สาขาวิชาการจัดการทรัพยากรมนุษย์ | ✗ |
| `510312` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต สาขาวิชาการจัดการทรัพยากรมนุษย์สมัยใหม่ (ระบบการศึกษาทางไกล) | ✗ |
| `510400` | 2 | สาขาวิชาบัญชี | ✓ |
| `510411` | 3 | หลักสูตรบัญชีบัณฑิต | ✗ |
| `510412` | 3 | หลักสูตรบัญชีบัณฑิต (ระบบการศึกษาทางไกล) | ✗ |
| `510500` | 2 | สาขาวิชาเทคโนโลยีสารสนเทศและการจัดการ | ✓ |
| `510511` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต สาขาวิชาเทคโนโลยีสารสนเทศและการจัดการ | ✗ |
| `510600` | 2 | สาขาวิชาการจัดการโลจิสติกส์และซัพพลายเชนระหว่างประเทศ | ✓ |
| `510611` | 3 | หลักสูตรบริหารธุรกิจ สาขาวิชาการจัดการโลจิสติกส์และซัพพลายเชนระหว่างประเทศ | ✗ |
| `510612` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต สาขาวิชาการจัดการโลจิสติกส์และซัพพลายเชน ระหว่างประเทศ (ระบบการศึกษาทางไกล) | ✗ |
| `510621` | 3 | หลักสูตรบริหารธุรกิจมหาบัณฑิต สาขาวิชาอุตสาหกรรมโลจิสติกและซัพพลายเชน ระหว่างประเทศ | ✗ |
| `510700` | 2 | สาขาวิชาการจัดการธุรกิจการบิน | ✓ |
| `510711` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต สาขาวิชาการจัดการธุรกิจการบิน | ✗ |
| `510721` | 3 | หลักสูตรบริหารธุรกิจมหาบัณฑิต สาขาวิชาการจัดการการบิน | ✗ |
| `510800` | 2 | สาขาวิชาการจัดการนวัตกรรม | ✓ |
| `510811` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต สาขาวิชาการจัดการนวัตกรรม | ✗ |
| `510812` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต สาขาวิชาการจัดการนวัตกรรม (ระบบการศึกษาทางไกล) | ✗ |
| `510900` | 2 | สาขาวิชาการบริหารธุรกิจค้าปลีกสมัยใหม่ | ✓ |
| `510911` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต สาขาวิชาการบริหารธุรกิจค้าปลีกสมัยใหม่ | ✗ |
| `511000` | 2 | ไม่ระบุสาขา | ✓ |
| `511021` | 3 | หลักสูตรบริหารธุรกิจมหาบัณฑิต (MBA.) | ✗ |
| `511031` | 3 | หลักสูตรบริหารธุรกิจดุษฎีบัณฑิต (DBA.) | ✗ |
| `511100` | 2 | สาขาวิชานวัตกรรมไทย จีน อาเซียน | ✓ |
| `511121` | 3 | หลักสูตรบริหารธุรกิจมหาบัณฑิต สาขาวิชานวัตกรรมไทย จีน อาเซียน (ระบบการศึกษาทางไกล) | ✗ |
| `511200` | 2 | สาขาวิชาการตลาดดิจิทัลและนวัตกรรมปัญญาประดิษฐ์ | ✓ |
| `511221` | 3 | หลักสูตรบริหารธุรกิจมหาบัณฑิต สาขาวิชาการตลาดดิจิทัลและนวัตกรรมปัญญาประดิษฐ์ | ✗ |
| `511300` | 2 | สาขาวิชาธุรกิจระหว่างประเทศ | ✓ |
| `511311` | 3 | หลักสูตรบริการธุรกิจบัณฑิต สาขาวิชาธุรกิจระหว่างประเทศ | ✗ |
| `511400` | 2 | สาขาวิชาการจัดการโลจิสติกส์และนวัตกรรมผู้ประกอบการ | ✓ |
| `511421` | 3 | หลักสูตรบริหารธุรกิจมหาบัณฑิต สาขาวิชาการจัดการโลจิสติกส์และ นวัตกรรมผู้ประกอบการ | ✗ |
| `520000` | 1 | คณะศิลปศาสตร์ | ✓ |
| `520100` | 2 | สำนักงานเลขานุการคณะศิลปศาสตร์ | ✓ |
| `520200` | 2 | สาขาวิชาภาษาอังกฤษ | ✓ |
| `520211` | 3 | หลักสูตรศิลปศาสตรบัณฑิต สาขาวิชาภาษาอังกฤษ | ✗ |
| `520300` | 2 | สาขาวิชาการจัดการ | ✓ |
| `520311` | 3 | หลักสูตรศิลปศาสตรบัณฑิต สาขาวิชาการจัดการ | ✗ |
| `520400` | 2 | สาขาวิชาสาธารณสุขศาสตร์ | ✓ |
| `520411` | 3 | หลักสูตรสาธารณสุขศาสตรบัณฑิต สาขาวิชาสาธารณสุขศาสตร์ | ✗ |
| `520421` | 3 | หลักสูตรสาธารณสุขศาสตรมหาบัณฑิต สาขาวิชาสาธารณสุขศาสตร์ | ✗ |
| `520431` | 3 | หลักสูตรสาธารณสุขศาสตรดุษฎีบัณฑิต สาขาวิชาการส่งเสริมสุขภาพ | ✗ |
| `520441` | 3 | หลักสูตรประกาศนียบัตรพนักงานผู้ช่วยทางการพยาบาลและผู้ดูแลผู้สูงอายุ | ✗ |
| `520500` | 2 | สาขาวิชานิเทศศาสตร์ | ✓ |
| `520511` | 3 | หลักสูตรนิเทศศาสตรบัณฑิต สาขาวิชานิเทศศาสตร์และดิจิทัลมีเดีย | ✗ |
| `520600` | 2 | สาขาวิชานวัตกรรมการสื่อสารสืบสวนสอบสวน | ✓ |
| `520611` | 3 | หลักสูตรนิเทศศาสตรบัณฑิต สาขาวิชานวัตกรรมการสื่อสารสืบสวนสอบสวน | ✗ |
| `520700` | 2 | สาขาวิชาการจัดการองค์การยุคใหม่ | ✓ |
| `520721` | 3 | หลักสูตรศิลปศาสตรมหาบัณฑิต สาขาวิชาการจัดการองค์การยุคใหม่ | ✗ |
| `520731` | 3 | หลักสูตรปรัชญาดุษฏีบัณฑิต สาขาวิชาการจัดการองค์การยุคใหม่ | ✗ |
| `520800` | 2 | สาขาวิชาการบริหารการศึกษา | ✓ |
| `520821` | 3 | หลักสูตรศึกษาศาสตรมหาบัณฑิต สาขาวิชาการบริหารการศึกษา | ✗ |
| `520831` | 3 | หลักสูตรศึกษาศาสตรดุษฎีบัณฑิต สาขาวิชาการบริหารการศึกษา | ✗ |
| `520900` | 2 | สาขาวิชานวัตกรรมการสื่อสาร | ✓ |
| `520921` | 3 | หลักสูตรนิเทศศาสตรมหาบัณฑิต สาขาวิชานิเทศศาสตร์เชิงกลยุทธ์ | ✗ |
| `520931` | 3 | หลักสูตรปรัชญาดุษฎีบัณฑิต สาขาวิชานิเทศศาสตร์เชิงกลยุทธ์ | ✗ |
| `521000` | 2 | สาขาวิชารัฐประศาสนศาสตร์ | ✓ |
| `521021` | 3 | หลักสูตรรัฐประศาสนศาสตรมหาบัณฑิต สาขาวิชารัฐประศาสนศาสตร์ | ✗ |
| `521031` | 3 | หลักสูตรรัฐประศาสนศาสตรดุษฎีบัณฑิต สาขาวิชารัฐประศาสนศาสตร์ | ✗ |
| `521100` | 2 | สาขาวิชาการจัดการภาครัฐและเอกชน | ✓ |
| `521131` | 3 | หลักสูตรปรัชญาดุษฎีบัณฑิต สาขาวิชาการจัดการภาครัฐและเอกชน | ✗ |
| `521200` | 2 | สาขาวิชาภาษาไทยเพื่อการสื่อสาร | ✓ |
| `521211` | 3 | หลักสูตรศิลปศาสตรบัณฑิต สาขาวิชาภาษาไทยเพื่อการสื่อสาร | ✗ |
| `521241` | 3 | หลักสูตรประกาศนียบัตรภาษาไทยสำหรับชาวต่างชาติ (หลักสูตรระยะสั้น) | ✗ |
| `521300` | 2 | สาขาวิชานวัตกรรมการจัดการธุรกิจท่องเที่ยวและบันเทิง | ✓ |
| `521311` | 3 | หลักสูตรศิลปศาสตรบัณฑิต สาขาวิชานวัตกรรมการจัดการธุรกิจท่องเที่ยวและบันเทิง | ✗ |
| `521400` | 2 | สาขาวิชาการบริหารการค้าและการเมืองอย่างยั่งยืนในโลกยุคใหม่ | ✓ |
| `521421` | 3 | หลักสูตรศิลปศาสตรมหาบัณฑิต สาขาวิชาการบริหารการค้าและการเมืองอย่างยั่งยืนในโลกยุคใหม่ | ✗ |
| `521431` | 3 | หลักสูตรปรัชญาดุษฎีบัณฑิต สาขาวิชาการบริหารการค้าและการเมืองอย่างยั่งยืนในโลกยุคใหม่ | ✗ |
| `521500` | 2 | สาขาวิชาผู้นำทางการเมืองและการปกครอง | ✓ |
| `521511` | 3 | หลักสูตรรัฐศาสตรบัณฑิต สาขาวิชาผู้นำทางการเมืองและการปกครอง | ✗ |
| `521512` | 3 | หลักสูตรรัฐศาสตรบัณฑิต (ระบบการศึกษาทางไกล) | ✗ |
| `521600` | 2 | ภาควิชาศึกษาทั่วไป | ✓ |
| `521700` | 2 | หลักสูตรประกาศนียบัตรบัณฑิตวิชาชีพครู | ✓ |
| `521800` | 2 | สาขาวิชาผู้ประกอบการธุรกิจเชิงสร้างสรรค์และนวัตกรรม | ✓ |
| `521821` | 3 | หลักสูตรศิลปศาสตรมหาบัณฑิต สาขาวิชาผู้ประกอบการธุรกิจเชิงสร้างสรรค์และนวัตกรรม | ✗ |
| `521900` | 2 | สาขาวิชาดิจิทัลอาร์ตและดีไซน์ | ✓ |
| `521911` | 3 | หลักสูตรนิเทศศาสตรบัณฑิต สาขาวิชาดิจิทัลอาร์ตและดีไซน์ | ✗ |
| `522000` | 2 | สาขาวิชาการจัดการความมั่นคงและสันติภาพ | ✓ |
| `522021` | 3 | หลักสูตรรัฐศาสตร์มหาบัณฑิต สาขาวิชาการจัดการความมั่นคงและสันติภาพ | ✗ |
| `522100` | 2 | สาขาวิชาศิลปะการแสดง | ✓ |
| `522111` | 3 | หลักสูตรศิลปศาสตรบัณฑิต สาขาวิชาศิลปะการแสดง | ✗ |
| `530000` | 1 | คณะนิติศาสตร์ | ✓ |
| `530100` | 2 | สำนักงานเลขานุการคณะนิติศาสตร์ | ✓ |
| `530200` | 2 | สาขานิติศาสตร์ | ✓ |
| `530211` | 3 | หลักสูตรนิติศาสตรบัณฑิต สาขานิติศาสตร์ | ✗ |
| `530212` | 3 | หลักสูตรนิติศาสตรบัณฑิต สาขานิติศาสตร์ (ระบบการศึกษาทางไกล) | ✗ |
| `530221` | 3 | หลักสูตรนิติศาสตรมหาบัณฑิต สาขานิติศาสตร์ | ✗ |
| `530231` | 3 | หลักสูตรนิติศาสตรดุษฎีบัณฑิต สาขานิติศาสตร์ | ✗ |
| `530300` | 2 | สาขาวิชากฎหมายกับการบริหาร | ✓ |
| `530331` | 3 | หลักสูตรปรัชญาดุษฏีบัณฑิต สาขาวิชากฎหมายกับการบริหาร | ✗ |
| `540000` | 1 | วิทยาลัยสื่อสารการเมือง | ✓ |
| `540100` | 2 | สำนักงานเลขานุการวิทยาลัยสื่อสารการเมือง | ✓ |
| `540200` | 2 | สาขาวิชาสื่อสารการเมือง | ✓ |
| `540221` | 3 | หลักสูตรรัฐศาสตรมหาบัณฑิต สาขาวิชาสื่อสารการเมือง | ✗ |
| `540231` | 3 | หลักสูตรปรัชญาดุษฎีบัณฑิต สาขาวิชาสื่อสารการเมือง | ✗ |
| `540300` | 2 | สาชาวิชาสื่อสารการเมืองและการปกครองดิจิทัล (ระบบการศึกษาทางไกล) | ✓ |
| `540321` | 3 | หลักสูตรรัฐศาสตรมหาบัณฑิต สาชาวิชาสื่อสารการเมืองและการปกครองดิจิทัล (ระบบการศึกษาทางไกล) | ✗ |
| `540331` | 3 | หลักสูตรปรัชญาดุษฎีบัณฑิต สาชาวิชาสื่อสารการเมืองและการปกครองดิจิทัล (ระบบการศึกษาทางไกล) | ✗ |
| `550000` | 1 | วิทยาลัยนานาชาติ | ✓ |
| `550100` | 2 | สำนักงานเลขานุการวิทยาลัยนานาชาติ | ✓ |
| `550200` | 2 | ไม่ระบุสาขา | ✓ |
| `550211` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต (หลักสูตรภาษาจีน) | ✗ |
| `550221` | 3 | หลักสูตรบริหารธุรกิจมหาบัณฑิต (หลักสูตรภาษาจีน) | ✗ |
| `550231` | 3 | หลักสูตรบริหารธุรกิจดุษฎีบัณฑิต (หลักสูตรภาษาจีน) | ✗ |
| `550300` | 2 | สาขาวิชาการศึกษาปฐมวัย | ✓ |
| `550311` | 3 | หลักสูตรศึกษาศาสตรบัณฑิต สาขาการศึกษาปฐมวัย (หลักสูตรภาษาจีน) | ✗ |
| `550400` | 2 | สาขาวิชาวิทยุกระจายเสียงและวิทยุโทรทัศน์ | ✓ |
| `550411` | 3 | หลักสูตรนิเทศศาสตรบัณฑิต สาขาวิชาวิทยุกระจายเสียงและวิทยุโทรทัศน์ (หลักสูตรภาษาจีน) | ✗ |
| `550500` | 2 | สาขาวิชาการส่งเสริมสุขภาพองค์รวมข้อมูลขนาดใหญ่ทางการแพทย์ | ✓ |
| `550511` | 3 | หลักสูตรสาธารณสุขศาสตรบัณฑิต สาขาวิชาการส่งเสริมสุขภาพองค์รวมและข้อมูล ขนาดใหญ่ทางการแพทย์ (หลักสูตรภาษาจีน) | ✗ |
| `550521` | 3 | หลักสูตรสาธารณสุขศาสตรมหาบัณฑิต สาขาวิชาการส่งเสริมสุขภาพองค์รวมและ ข้อมูลขนาดใหญ่ทางการแพทย์ (หลักสูตรภาษาจีน) | ✗ |
| `550531` | 3 | หลักสูตรสาธารณสุขศาสตรดุษฎีบัณฑิต สาขาวิชาการส่งเสริมสุขภาพองค์รวมและ ข้อมูลขนาดใหญ่ทางการแพทย์ (หลักสูตรภาษาจีน) | ✗ |
| `550600` | 2 | สาขาวิชาศิลปะการออกแบบและสื่อดิจิทัล | ✓ |
| `550611` | 3 | หลักสูตรศิลปบัณฑิต สาขาวิชาศิลปะการออกแบบและสื่อดิจิทัล (หลักสูตรภาษาจีน) | ✗ |
| `550700` | 2 | สาขาวิชาการบริหารการศึกษา | ✓ |
| `550721` | 3 | หลักสูตรศึกษาศาสตรมหาบัณฑิต สาขาวิชาการบริหารการศึกษา (หลักสูตรภาษาจีน) | ✗ |
| `550731` | 3 | หลักสูตรศึกษาศาสตรดุษฎีบัณฑิต สาขาวิชาการบริหารการศึกษา (หลักสูตรภาษาจีน) | ✗ |
| `550800` | 2 | สาขาวิชาดนตรีวิทยา | ✓ |
| `550821` | 3 | หลักสูตรศิลปมหาบัณฑิต สาขาวิชาดนตรีวิทยา (หลักสูตรภาษาจีน) | ✗ |
| `550831` | 3 | หลักสูตรศิลปดุษฎีบัณฑิต สาขาวิชาดนตรีวิทยา (หลักสูตรภาษาจีน) | ✗ |
| `550900` | 2 | สาขาวิชาศิลปะ | ✓ |
| `550921` | 3 | หลักสูตรศิลปมหาบัณฑิต สาขาวิชาศิลปะ (หลักสูตรภาษาจีน) | ✗ |
| `550931` | 3 | หลักสูตรศิลปดุษฎีบัณฑิต สาขาวิชาศิลปะ (หลักสูตรภาษาจีน) | ✗ |
| `551000` | 2 | สาขาวิชาพลศึกษา | ✓ |
| `551011` | 3 | หลักสูตรศึกษาศาสตรบัณฑิต สาขาวิชาพลศึกษา (หลักสูตรภาษาจีน) | ✗ |
| `551021` | 3 | หลักสูตรศึกษาศาสตรมหาบัณฑิต สาขาวิชาพลศึกษา (หลักสูตรภาษาจีน) | ✗ |
| `551031` | 3 | หลักสูตรศึกษาศาสตรดุษฎีบัณฑิต สาขาวิชาพลศึกษา (หลักสูตรภาษาจีน) | ✗ |
| `551100` | 2 | สาขาวิชาการจัดการเทคโนโลยีวิศวกรรม | ✓ |
| `551121` | 3 | หลักสูตรวิศวกรรมศาสตรมหาบัณฑิต สาขาวิชาการจัดการเทคโนโลยีวิศวกรรม (หลักสูตรภาษาจีน) | ✗ |
| `551131` | 3 | หลักสูตรวิศวกรรมศาสตรดุษฎีบัณฑิต สาขาวิชาการจัดการเทคโนโลยีวิศวกรรม (หลักสูตรภาษาจีน) | ✗ |
| `551200` | 2 | สาขาศิลปบัณฑิต | ✓ |
| `551221` | 3 | หลักสูตรศิลปมหาบัณฑิต (หลักสูตรภาษาจีน) | ✗ |
| `551222` | 3 | หลักสูตรนิติศาสตรมหาบัณฑิต (หลักสูตรภาษาจีน) | ✗ |
| `551231` | 3 | หลักสูตรศิลปดุษฎีบัณฑิต (หลักสูตรภาษาจีน) | ✗ |
| `551300` | 2 | สาขาวิชาศิลปะการเขียนพู่กันจีน (หลักสูตรภาษาจีน) | ✓ |
| `551321` | 3 | หลักสูตรศิลปมหาบัณฑิต สาขาวิชาศิลปะการเขียนพู่กันจีน (หลักสูตรภาษาจีน) | ✗ |
| `551400` | 2 | สาขาวิชานวัตกรรมการศึกษาขั้นสูง | ✓ |
| `551421` | 3 | หลักสูตรศึกษาศาสตรมหาบัณฑิต สาขาวิชานวัตกรรมการศึกษาขั้นสูง (หลักสูตรภาษาจีน) | ✗ |
| `551431` | 3 | หลักสูตรศึกษาศาสตรดุษฎีบัณฑิต สาขาวิชานวัตกรรมการศึกษาขั้นสูง (หลักสูตรภาษาจีน) | ✗ |
| `551500` | 2 | สาขาวิชาปัญญาประดิษฐ์ | ✓ |
| `551531` | 3 | หลักสูตรวิศวกรรมศาสตรดุษฎีบัณฑิต สาขาวิชาปัญญาประดิษฐ์ (หลักสูตรภาษาจีน) | ✗ |
| `551600` | 2 | สาขาวิชาเทคโนโลยีสารสนเทศและการสื่อสาร | ✓ |
| `551611` | 3 | หลักสูตรเทคโนโลยีบัณฑิต สาขาวิชาเทคโนโลยีสารสนเทศและการสื่อสาร (หลักสูตรภาษาอังกฤษ) | ✗ |
| `551700` | 2 | สาขาวิชาวิศวกรรมศาสตร์ | ✓ |
| `551711` | 3 | หลักสูตรวิศวกรรมศาสตรบัณฑิต สาขาวิชาวิศวกรรมศาสตร์ (หลักสูตรภาษาจีน) | ✗ |
| `551800` | 2 | สาขาวิชาการระบาดวิทยา | ✓ |
| `551821` | 3 | หลักสูตรสาธารณสุขศาสตรมหาบัณฑิต สาขาวิชาการระบาดวิทยา (หลักสูตรภาษาจีน) | ✗ |
| `551831` | 3 | หลักสูตรสาธารณสุขศาสตรดุษฎีบัณฑิต สาขาวิชาการระบาดวิทยา (หลักสูตรภาษาจีน) | ✗ |
| `551900` | 2 | สาขาวิชานิติศาสตร์ | ✓ |
| `551911` | 3 | หลักสูตรนิติศาสตรบัณฑิต สาขาวิชานิติศาสตร์ (หลักสูตรภาษาจีน) | ✗ |
| `552000` | 2 | สาขาวิชากฎหมายกับการบริหาร | ✓ |
| `552031` | 3 | หลักสูตรปรัชญาดุษฎีบัณฑิต สาขาวิชากฎหมายกับการบริหาร (หลักสูตรภาษาจีน) | ✗ |
| `552100` | 2 | สาขาวิชาธุรกิจและการจัดการ | ✓ |
| `552131` | 3 | หลักสูตรปรัชญาดุษฎีบัณฑิต สาขาวิชาธุรกิจและการจัดการ (หลักสูตรภาษาจีน) | ✗ |
| `552132` | 3 | หลักสูตรปรัชญาดุษฎีบัณฑิต สาขาวิชาธุรกิจและการจัดการ (หลักสูตรภาษาอังกฤษ) | ✗ |
| `552200` | 2 | สาขาวิชาพยาบาลผู้เชี่ยวชาญทางคลินิก (หลักสูตรภาษาจีน) | ✓ |
| `552231` | 3 | หลักสูตรพยาบาลศาสตรดุษฎีบัณฑิต สาขาวิชาพยายาลผู้เชี่ยวชาญทางคลีนิค (หลักสูตรภาษาจีน) | ✗ |
| `552300` | 2 | ไม่มีสาขาวิชา | ✓ |
| `552321` | 3 | หลักสูตรพยาบาลศาสตรมหาบัณฑิต (หลักสูตรภาษาจีน) | ✗ |
| `552400` | 2 | ไม่มีสาขาวิชา | ✓ |
| `552421` | 3 | หลักสูตรวิทยาศาสตรมหาบัณฑิต (หลักสูตรภาษาจีน) | ✗ |
| `552431` | 3 | หลักสูตรวิทยาศาสตรดุษฎีบัณฑิต (หลักสูตรภาษาจีน) | ✗ |
| `552500` | 2 | สาขาวิชาการจัดการท่องเที่ยวและบริการ (หลักสูตรภาษาอังกฤษ) | ✓ |
| `552511` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต สาขาวิชาการจัดการท่องเที่ยวและบริการ (หลักสูตรภาษาอังกฤษ) | ✗ |
| `552600` | 2 | ไม่มีสาขาวิชา | ✓ |
| `552611` | 3 | หลักสูตรศิลปบัณฑิต (หลักสูตรภาษาอังกฤษ) | ✗ |
| `552700` | 2 | สาขาวิชาวิศวกรรมอัจฉริยะและระบบยืดหยุ่น (หลักสูตรภาษาจีน) | ✓ |
| `552721` | 3 | หลักสูตรวิศวกรรมศาสตรมหาบัณฑิต สาขาวิชาวิศวกรรมอัจฉริยะและระบบยืดหยุ่น (หลักสูตรภาษาจีน) | ✗ |
| `552800` | 2 | สาขาวิชาวิทยาศาสตร์การแพทย์และสุขภาพ (หลักสูตรภาษาจีน) | ✓ |
| `552821` | 3 | หลักสูตรวิทยาศาสตรมหาบัณฑิต สาขาวิชาวิทยาศาสตร์การแพทย์และสุขภาพ (หลักสูตรภาษาจีน) | ✗ |
| `552831` | 3 | หลักสูตรวิทยาศาสตรดุษฎีบัณฑิต สาขาวิชาวิทยาศาสตร์การแพทย์และสุขภาพ (หลักสูตรภาษาจีน) | ✗ |
| `552900` | 2 | สาขาวิชานวัตกรรมการจัดการศึกษา | ✓ |
| `552911` | 3 | หลักสูตรศึกษาศาสตรบัณฑิต สาขาวิชานวัตกรรมการจัดการศึกษา (หลักสูตรภาษาจีน) | ✗ |
| `560000` | 1 | วิทยาลัยนานชาติจีนศึกษาและเทคโนโลยี (เปลี่ยนชื่อ 8 พ.ค. 69) สภาอนุมัติ (ชื่อเดิมวิทยาลัยนานาชาติภาษาและวัฒนธรรมจีน) | ✓ |
| `560100` | 2 | สำนักงานเลขานุการวิทยาลัยนานาชาติภาษาและวัฒนธรรมจีน | ✓ |
| `560200` | 2 | สาขาวิชาภาษาจีนธุรกิจ | ✓ |
| `560211` | 3 | ศิลปศาสตรบัณฑิต สาขาวิชาภาษาจีนธุรกิจ | ✗ |
| `560212` | 3 | ศิลปศาสตรบัณฑิต สาขาวิชาภาษาจีนธุรกิจ (ระบบการศึกษาทางไกล) | ✗ |
| `560300` | 2 | สาขาวิชาการสอนภาษาจีนสำหรับผู้พูดภาษาอื่น | ✓ |
| `560311` | 3 | หลักสูตรศิลปศาสตรบัณฑิต สาขาวิชาการสอนภาษาจีนสำหรับผู้พูดภาษาอื่น | ✗ |
| `560321` | 3 | หลักสูตรศิลปศาสตรมหาบัณฑิต สาขาวิชาการสอนภาษาจีนสำหรับผู้พูดภาษาอื่น (หลักสูตรภาษาจีน) | ✗ |
| `560331` | 3 | หลักสูตรปรัชญาดุษฎีบัณฑิต สาขาวิชาการสอนภาษาจีนสำหรับผู้พูดภาษาอื่น (หลักสูตรภาษาจีน) | ✗ |
| `560400` | 2 | สาขาวิชาภาษาจีนเพื่อธุรกิจไทยจีนอาเซียน | ✓ |
| `560421` | 3 | หลักสูตรศิลปศาสตรมหาบัณฑิต สาขาวิชาภาษาจีนเพื่อธุรกิจไทยจีนอาเซียน | ✗ |
| `560500` | 2 | ศูนย์วิจัยการศึกษาภาษาจีนนานาชาติ จีน - อาเซียน | ✓ |
| `560600` | 2 | วารสารการสอนภาษาจีนนานาชาติ | ✓ |
| `560700` | 2 | สาขาวิชาการประยุกต์เทคโนโลยีอุตสาหกรรมไทย - จีน | ✓ |
| `560711` | 3 | หลักสูตรเทคโนโลยีบัณฑิต สาขาวิชาการประยุกต์เทคโนโลยีอุตสาหกรรมไทย - จีน | ✗ |
| `560800` | 2 | สาขาวิชาจีนศึกษา (เพิ่ม 2 ก.ค. 69) | ✓ |
| `560821` | 3 | หลักสูตรศิลปศาสตรมหาบัณฑิต (หลักสูตรใหม่ พ.ศ. 2569) | ✗ |
| `560831` | 3 | หลักสูตรปรัชญาดุษฎีบัณฑิต (หลักสูตรใหม่ พ.ศ. 2569) | ✗ |
| `570000` | 1 | วิทยาลัยนานาชาติอิสลามกรุงเทพ | ✓ |
| `570100` | 2 | สำนักงานเลขานุการวิทยาลัยนานาชาติอิสลามกรุงเทพ | ✓ |
| `570200` | 2 | สาขาวิชาบริหารธุรกิจอิสลาม | ✓ |
| `570211` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต สาขาวิชาบริหารธุรกิจอิสลาม | ✗ |
| `570221` | 3 | หลักสูตรบริหารธุรกิจมหาบัณฑิต สาขาวิชาบริหารธุรกิจอิสลาม | ✗ |
| `570231` | 3 | หลักสูตรปรัชญาดุษฎีบัณฑิต สาขาวิชาบริหารธุรกิจอิสลาม | ✗ |
| `570300` | 2 | สาขาวิชาการบริหารการศึกษาอิสลาม | ✓ |
| `570321` | 3 | หลักสูตรศึกษาศาสตรมหาบัณฑิต สาขาวิชาการบริหารการศึกษาอิสลาม | ✗ |
| `570400` | 2 | ศูนย์ภาษาอาหรับกรุงเทพ | ✓ |
| `570500` | 2 | ศูนย์พัฒนาธุรกิจฮาลาลไทย มหาวิทยาลัยเกริก | ✓ |
| `570600` | 2 | ศูนย์ความร่วมมือไทย-ทูร์เคีย มหาวิทยาลัยเกริก | ✓ |
| `570700` | 2 | สาขาวิชาภาษาอาหรับเพื่อธุรกิจบริการสุขภาพและการท่องเที่ยว | ✓ |
| `570711` | 3 | หลักสูตรศิลปศาสตรบัณฑิต สาขาวิชาภาษาอาหรับเพื่อธุรกิจบริการสุขภาพและการท่องเที่ยว | ✗ |
| `570800` | 2 | สาขาวิชาบริหารธุรกิจอิสลาม (ระบบการศึกษาทางไกล) | ✓ |
| `570811` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต สาขาวิชาบริหารธุรกิจอิสลาม (ระบบการศึกษาทางไกล) | ✗ |
| `570900` | 2 | สาขาวิชาอิสลามศึกษาและตะวันออกกลาง | ✓ |
| `570921` | 3 | หลักสูตรศิลปศาสตรมหาบัณฑิต สาขาวิชาอิสลามศึกษาและตะวันออกกลาง | ✗ |
| `580000` | 1 | วิทยาลัยนานาชาติศิลปะ | ✓ |
| `580100` | 2 | สำนักงานเลขานุการวิทยาลัยนานาชาติศิลปะ | ✓ |
| `580200` | 2 | สาขาวิชาศิลปะสร้างสรรค์ | ✓ |
| `580211` | 3 | หลักสูตรศิลปบัณฑิต สาขาวิชาศิลปะสร้างสรรค์ (หลักสูตรภาษาจีน) | ✗ |
| `580221` | 3 | หลักสูตรศิลปมหาบัณฑิต สาขาวิชาศิลปะสร้างสรรค์ (หลักสูตรภาษาจีน) | ✗ |
| `580231` | 3 | หลักสูตรศิลปดุษฎีบัณฑิต สาขาวิชาศิลปะสร้างสรรค์ (หลักสูตรภาษาจีน) | ✗ |
| `580300` | 2 | สาขาวิชาดนตรีวิทยา | ✓ |
| `580321` | 3 | หลักสูตรศิลปมหาบัณฑิต สาขาวิชาดนตรีวิทยา (หลักสูตรภาษาจีน) | ✗ |
| `580331` | 3 | หลักสูตรศิลปดุษฎีบัณฑิต สาขาวิชาดนตรีวิทยา (หลักสูตรภาษาจีน) | ✗ |
| `580400` | 2 | สาขาวิชาศิลปะ | ✓ |
| `580421` | 3 | หลักสูตรศิลปมหาบัณฑิต สาขาวิชาศิลปะ (หลักสูตรภาษาจีน) | ✗ |
| `580431` | 3 | หลักสูตรศิลปดุษฎีบัณฑิต สาขาวิชาศิลปะ (หลักสูตรภาษาจีน) | ✗ |
| `590000` | 1 | วิทยาลัยนานาชาติการบินและอวกาศ | ✓ |
| `590100` | 2 | สำนักงานเลขานุการวิทยาลัยนานาชาติการบินและอวกาศ | ✓ |
| `590200` | 2 | สาขาวิชาการจัดการธุรกิจการบิน | ✓ |
| `590211` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต | ✗ |
| `590300` | 2 | สาขาวิชาการจัดการธุรกิจค้าปลีกและเทคโนโลยี (จะย้ายไปอยู่คณะบริหารธุรกิจ) | ✓ |
| `590311` | 3 | หลักสูตรเทคโนโลยีบัณฑิต | ✗ |
| `590400` | 2 | สาขาวิชาการจัดการการบิน | ✓ |
| `590421` | 3 | หลักสูตรบริหารธุรกิจมหาบัณฑิต สาขาวิชาการจัดการการบิน | ✗ |
| `590500` | 2 | สาขาวิชาผู้บริหารการบินและโลจิสติกส์ | ✓ |
| `590531` | 3 | หลักสูตรปรัชญาดุษฎีบัณฑิต สาขาวิชาผู้บริหารการบินและโลจิสติกส์ | ✗ |
| `590600` | 2 | สาขาวิชาอุตสาหกรรมการบิน (หลักสูตรภาษาอังกฤษ) | ✓ |
| `590611` | 3 | หลักสูตรเทคโนโลยีบัณฑิต สาขาวิชาอุตสาหกรรมการบิน (หลักสูตรภาษาอังกฤษ) | ✗ |
| `590700` | 2 | สาขาวิชาเทคโนโลยีอุตสาหกรรม (ระบบการศึกษาทางไกล) | ✓ |
| `590711` | 3 | หลักสูตรเทคโนโลยีบัณฑิต สาชาวิชาเทคโนโลยีอุตสาหกรรม (ระบบการศึกษาทางไกล) | ✗ |
| `590800` | 2 | สาขาวิชาเทคโนโลยีอุตสาหกรรมและการนำเข้า – ส่งออกทางอากาศ | ✓ |
| `590821` | 3 | หลักสูตรการจัดการมหาบัณฑิต สาชาวิชาเทคโนโลยีอุตสาหกรรมและ การนำเข้า - ส่งออกทางอากาศ (เปลี่ยน 19 ส.ค. 69) | ✗ |
| `600000` | 1 | วิทยาลัยนานาชาติบริทิช | ✓ |
| `600100` | 2 | สำนักงานเลขานุการวิทยาลัยนานาชาติบริทิช | ✓ |
| `600200` | 2 | สาขาวิชาเทคโนโลยีสารสนเทศและการสื่อสาร (หลักสูตรภาษาอังกฤษ) | ✓ |
| `600211` | 3 | หลักสูตรเทคโนโลยีบัณฑิต สาขาวิชาเทคโนโลยีสารสนเทศและการสื่อสาร (หลักสูตรภาษาอังกฤษ) | ✗ |
| `600300` | 2 | สาขาวิชาการจัดการท่องเที่ยวและบริการ (หลักสูตรภาษาอังกฤษ) | ✓ |
| `600311` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต สาขาวิชาการจัดการท่องเที่ยวและบริการ (หลักสูตรภาษาอังกฤษ) | ✗ |
| `600400` | 2 | ไม่ระบุสาขา | ✓ |
| `600411` | 3 | หลักสูตรศิลปบัณฑิต (หลักสูตรภาษาอังกฤษ) | ✗ |
| `600500` | 2 | สาขาวิชาธุรกิจและการจัดการ (หลักสูตรภาษาอังกฤษ) | ✓ |
| `600531` | 3 | หลักสูตรปรัชญาดุษฎีบัณฑิต สาขาวิชาธุรกิจและการจัดการ (หลักสูตรภาษาอังกฤษ) | ✗ |
| `600600` | 2 | สาขาวิชาธุรกิจและการจัดการ | ✓ |
| `600621` | 3 | หลักสูตรบริหารธุรกิจมหาบัณฑิต (หลักสูตรภาษาอังกฤษ) | ✗ |
| `600700` | 2 | สาขาวิชาการประมวลผลทางธุรกิจ | ✓ |
| `600711` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต สาขาวิชาการประมวลผลทางธุรกิจ (หลักสูตรภาษาอังกฤษ) | ✗ |
| `610000` | 1 | วิทยาลัยบริหารธุรกิจหนานหยางกรุงเทพ | ✓ |
| `610100` | 2 | สำนักงานเลขานุการวิทยาลัยบริหารธุรกิจหนานหยางกรุงเทพ | ✓ |
| `610200` | 2 | ไม่ระบุสาขาวิชา | ✓ |
| `610211` | 3 | หลักสูตรบริหารธุรกิจบัณฑิต (หลักสูตรภาษาจีน) | ✗ |
| `610221` | 3 | หลักสูตรบริหารธุรกิจมหาบัณฑิต (หลักสูตรภาษาจีน) | ✗ |
| `610231` | 3 | หลักสูตรบริหารธุรกิจดุษฎีบัณฑิต (หลักสูตรภาษาจีน) | ✗ |
| `610300` | 2 | สาขาวิชาธุรกิจและการจัดการ (หลักสูตรภาษาจีน) | ✓ |
| `610331` | 3 | หลักสูตรปรัชญาดุษฎีบัณฑิต สาขาวิชาธุรกิจและการจัดการ (หลักสูตรภาษาจีน) | ✗ |
| `620000` | 1 | คณะการจัดการสิ่งแวดล้อมและภัยพิบัติ (ไม่ใช้) · *ปิดใช้งาน* | ✗ |
| `620100` | 2 | สำนักงานเลขานุการคณะการจัดการสิ่งแวดล้อมและภัยพิบัติ · *ปิดใช้งาน* | ✗ |
| `620200` | 2 | สาขาวิชานวัตกรรมการจัดการสิ่งแวดล้อมและความปลอดภัย · *ปิดใช้งาน* | ✗ |
| `620221` | 3 | หลักสูตรวิทยาศาตรมหาบัณฑิต สาขาวิชานวัตกรรมการจัดการสิ่งแวดล้อมและความปลอดภัย · *ปิดใช้งาน* | ✗ |
| `630000` | 1 | คณะนวัฒกรรมวิทยาศาสตร์และวิศวกรรม | ✓ |
| `630100` | 2 | สำนักงานบริหารคณะวิชา | ✓ |
| `630200` | 2 | สาขาวิชาปัญญาประดิษฐ์และนวัตกรรมธุรกิจ | ✓ |
| `630211` | 3 | หลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาปัญญาประดิษฐ์และนวัตกรรมธุรกิจ | ✗ |
| `630300` | 2 | สาขาวิชานวัตกรรมการจัดการสิ่งแวดล้อมและภัยพิบัติ (ย้ายจากสิ่งแวดล้อม) | ✓ |
| `630321` | 3 | หลักสูตรวิทยาศาสตรมหาบัณฑิต สาขาวิชานวัตกรรมการจัดการสิ่งแวดล้อม และภัยพิบัติ | ✗ |
| `710000` | 1 | ศูนย์ส่งเสริมและบริการวิชาการแก่สังคม | ✓ |
| `710100` | 2 | สำนักงานธุรการและประสานงาน | ✓ |
| `720000` | 1 | ศูนย์เทคโนโลยีสารสนเทศ | ✓ |
| `720100` | 2 | งานพัฒนาระบบสารสนเทศและประมวลผล | ✗ |
| `720200` | 2 | งานเครือข่ายและซ่อมบำรุง | ✗ |
| `730000` | 1 | ศูนย์พัฒนาภาพลักษณ์และการตลาดออนไลน์ | ✓ |
| `730100` | 2 | สำนักงานธุรการและประสานงาน | ✓ |
| `740000` | 1 | ศูนย์บริการนักศึกษานานาชาติ (วีซ่า) | ✓ |
| `740100` | 2 | สำนักงานธุรการและประสานงาน | ✓ |
| `750000` | 1 | ศูนย์แนะแนวและงานความร่วมมือทางวิชาการการศึกษา | ✓ |
| `750100` | 2 | สำนักงานธุรการและประสานงาน | ✓ |

---

*เอกสารฉบับนี้เป็น baseline สำหรับการพัฒนา — การเปลี่ยนแปลง requirement ให้บันทึกเพิ่มใน §2 Decisions Log เป็น D19, D20, … พร้อมวันที่และเหตุผล*
