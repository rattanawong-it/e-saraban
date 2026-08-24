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
| F03 | [ ] | หนังสือภายใน (บันทึกข้อความ): ร่าง → ส่งออกเลข → ออกเลข → เวียน → รับทราบ → ปิดเรื่อง | P2 |
| F04 | [ ] | หนังสือส่งภายนอก: ร่าง → ส่งออกเลข → ออกเลข → ส่งออก → ปิดเรื่อง | P2 |
| F05 | [ ] | ลงทะเบียนหนังสือรับแบบเบา (ตาม A1) | P5 |
| F06 | [ ] | เลขทะเบียนอัตโนมัติ แยกตามหน่วยงาน/ประเภท/ปี พร้อม pattern ตั้งค่าได้ | P2 |
| F07 | [ ] | ไฟล์แนบหลายไฟล์/หลายเวอร์ชัน + PDF preview + watermark | P2/P3 |
| F08 | [~] | ชั้นความลับ 4 ระดับ + encryption at rest + ห้ามดาวน์โหลดสำหรับเอกสารลับ | P3 |
| F09 | [ ] | ค้นหาขั้นสูง + Dashboard สถิติ + Export ทะเบียน (Excel/PDF) | P4 |
| F10 | [x] | Audit log ครบทุก action + หน้าตรวจสอบสำหรับผู้ดูแล | P1 |
| F11 | [ ] | แจ้งเตือน In-app (กระดิ่ง + Inbox) | P5 |
| F12 | [x] | Responsive Web (Desktop-first, ใช้งานบนมือถือได้) | P1+ |

**หมายเหตุสถานะ (อัปเดต 24 ส.ค. 2569 — ปิด P1)**

- **F01 · F02** ครบแล้ว: ผัง tree ไม่จำกัดระดับ + materialized path + ย้ายหน่วยงาน + เก็บถาวร ·
  ผู้ใช้หลายสังกัด + บทบาทผูกกับคู่ (User, OrgUnit) + Context Switcher + `can()` ครบ 6 ด่านของ §4.3
- **F08 [~]** — โครงสร้างพร้อมแล้วบางส่วน: `clearanceLevel` ของผู้ใช้ · `confidentialityLevel` และ
  ด่าน CLEARANCE/ACL ใน `can()` · ป้ายสี 4 ระดับใน design token
  **ยังไม่มี**: envelope encryption · watermark · secure file route (ทั้งหมดเป็นงาน P3)
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

โครงสร้างต้นไม้ไม่จำกัดระดับ:

```
มหาวิทยาลัย
├── คณะ / สำนัก
│   ├── ภาควิชา / กอง
│   │   └── งาน / ศูนย์
```

**เทคนิคที่ใช้:** Adjacency List (`parentId`) + Materialized Path (`path`) คู่กัน

- `path` เก็บรูปแบบ `/1/5/23/` → query subtree ด้วย `path LIKE '/1/5/%'`
  เร็วกว่า recursive CTE มาก และสร้าง index ได้
- ต้องมีกลไกอัปเดต `path` ของลูกทั้งหมดเมื่อย้ายหน่วยงาน (ทำใน transaction เดียว)

**ฟิลด์สำคัญ:** `code` (รหัสหนังสือ เช่น `0512.1`), `nameTh`, `shortName`, `type`, `level`, `sortOrder`, `isActive`, `headUserId`

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

Pattern ตั้งค่าได้ต่อ (หน่วยงาน × ประเภทหนังสือ × ทิศทาง)

| ประเภท | Pattern | ตัวอย่าง |
|--------|---------|---------|
| หนังสือส่งภายนอก | `{unitCode}/{seq:4}` | `ศธ 0512.1/0451` |
| บันทึกข้อความภายใน | `{unitShort} {seq:4}/{year}` | `คว. 0128/2569` |
| หนังสือรับ | `รับ {seq}/{year}` | `รับ 1042/2569` |
| คำสั่ง / ประกาศ | `{docType} ที่ {seq}/{year}` | `คำสั่งที่ 55/2569` |

**Token ที่รองรับ:** `{unitCode}` `{unitShort}` `{seq}` `{seq:4}` (zero-pad) `{year}` `{yearShort}` `{docType}` `{bookCode}`

### 7.2 ปีที่ใช้รีเซ็ต

ตั้งค่าระดับระบบ: `FISCAL` (1 ต.ค. – 30 ก.ย.) หรือ `CALENDAR` (1 ม.ค. – 31 ธ.ค.)
ค่าเริ่มต้น: `CALENDAR` · แสดงผลเป็น พ.ศ. เสมอ

### 7.3 การออกเลขแบบปลอดภัย ⚠️ Critical

**ปัญหาที่ต้องกัน:** เลขซ้ำเมื่อเจ้าหน้าที่สารบรรณ 2 คนกดออกเลขพร้อมกัน — นี่คือบั๊กที่ทำลายความน่าเชื่อถือของระบบสารบรรณทั้งระบบ

```
ภายใน Prisma interactive transaction (isolation: Serializable):

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
4. ถอดรหัส (stream)
5. แปะ watermark (ถ้าเป็นเอกสารลับ)
6. เขียน audit log
7. ส่งกลับ
```

**Watermark** ฝัง **ชื่อผู้เปิด + username + วันเวลา + IP** ทับทุกหน้าแบบทแยง (ใช้ `pdf-lib`)
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

OrgUnit             id, tenantId, parentId, path, code, nameTh, shortName,
                    type, level, sortOrder, headUserId, isActive

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
| **P2 — Core Documents** | [ ] | DocumentType · สร้าง/แก้/ส่งร่าง · NumberSequence + ออกเลข (พร้อม concurrency test) · Attachment upload + PDF preview · Inbox/Outbox/Drafts · state machine + DocumentAction timeline · คิวออกเลข + bulk issue · ตีกลับแก้ไข | **3–4 สัปดาห์** | ทำ flow บันทึกข้อความและหนังสือส่งได้ครบตั้งแต่ร่างถึงปิดเรื่อง · **test เลขซ้ำผ่าน** |
| **P3 — Security & Confidential** | [ ] | ชั้นความลับ 4 ระดับ + clearance · envelope encryption · secure file route + watermark + view-only · DocumentAcl (grant/revoke) · Audit hash chain + `/admin/audit` · security headers + CSP + rate limit | **2 สัปดาห์** | เอกสารลับที่สุดเปิดดูได้แต่ดาวน์โหลดไม่ได้ · ไฟล์บนดิสก์เปิดตรงไม่ได้ · audit ครบทุก access |
| **P4 — Search & Reports** | [ ] | ค้นหาขั้นสูง (pg_trgm) · Dashboard สถิติ · ทะเบียนหนังสือ + Export Excel/PDF ตามรูปแบบราชการ | **2 สัปดาห์** | ค้นภาษาไทยเจอ · export เปิดใน Excel ได้ฟอนต์ไม่เพี้ยน |
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
| 2 | **รูปแบบเลขหนังสือจริง** — ขอตัวอย่างเลขที่ใช้อยู่จริง 3–5 แบบ (หนังสือส่งภายนอก / บันทึกข้อความ / คำสั่ง) | ⚠️ กระทบ default pattern — ถ้าผิดต้องแก้เอกสารที่ออกเลขไปแล้ว |
| 3 | **โครงสร้างหน่วยงานจริง** — ขอผังองค์กรพร้อมรหัสหนังสือแต่ละหน่วย | ใช้ทำ seed data — ไม่มีก็เริ่ม P1 ไม่ได้เต็มที่ |
| 4 | **รูปแบบทะเบียนที่ต้อง export** — ขอไฟล์ตัวอย่างที่ใช้ส่ง สกอ./ผู้ตรวจภายใน | กระทบ P4 |
| 5 | **ปีที่ใช้รีเซ็ตเลข** — ปีงบประมาณ หรือปีปฏิทิน (ปัจจุบัน default = ปีปฏิทิน) | ⚠️ เปลี่ยนภายหลังทำให้เลขทะเบียนไม่ต่อเนื่อง |
| 6 | **นโยบายเอกสารลับ** — ใครมีอำนาจกำหนด clearance level และเอกสาร "ลับที่สุด" อนุญาตให้เข้าระบบอิเล็กทรอนิกส์ได้หรือไม่ | บางองค์กรบังคับให้ใช้กระดาษเท่านั้น — กระทบขอบเขต P3 |
| 7 | **สเปกเซิร์ฟเวอร์ on-premise** — CPU/RAM/Disk · มี TLS certificate แล้วหรือยัง · backup ปัจจุบันทำอย่างไร | กระทบ P0 และแผน backup §12 |

---

*เอกสารฉบับนี้เป็น baseline สำหรับการพัฒนา — การเปลี่ยนแปลง requirement ให้บันทึกเพิ่มใน §2 Decisions Log เป็น D14, D15, … พร้อมวันที่และเหตุผล*
