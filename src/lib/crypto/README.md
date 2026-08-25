# Crypto

envelope encryption ของไฟล์แนบ (spec §8.2) — **ทำแล้วใน P3**

- ทุกไฟล์ลับสุ่ม DEK แบบ AES-256-GCM แล้ว wrap DEK ด้วย Master Key (KEK)
- KEK อ่านจาก env `FILE_MASTER_KEY` — **ห้ามเก็บใน database หรือ git**
- เก็บใน DB เฉพาะ `encryptedDek` `iv` `authTag` `encAlgo` `keyVersion` → รองรับ key rotation
- ต่อ HSM / HashiCorp Vault ทีหลังได้โดยเขียน `KeyProvider` ตัวใหม่ตัวเดียว

| ไฟล์ | หน้าที่ |
|---|---|
| `types.ts` | สัญญา `KeyProvider` + `EnvelopeMetadata` ที่ตรงกับคอลัมน์ใน `Attachment` |
| `key-provider.ts` | `EnvKeyProvider` — อ่านกุญแจจาก env · wrap/unwrap DEK · รองรับหลายรุ่นพร้อมกัน |
| `envelope.ts` | เข้ารหัสเนื้อไฟล์ · `encryptBytes` ตอนอัปโหลด · `createDecryptStream` ตอนส่งไฟล์ |

โมดูลนี้จัดการ**เฉพาะการเข้ารหัส** ส่วนการอ่าน-เขียนไฟล์เป็นของ `src/lib/storage/`
ตัว `StorageAdapter` รับ-ส่งเฉพาะ byte ที่เข้ารหัสแล้ว จึงไม่รู้จักกุญแจเลย

> ⚠️ GCM ตรวจ `authTag` ได้ตอน**จบ** stream เท่านั้น ไฟล์ที่ถูกแก้บนดิสก์จะพังกลางคัน
> หลังผู้ใช้ได้ byte ต้น ๆ ไปแล้ว · การยืนยันความครบถ้วนแบบสมบูรณ์ใช้ `sha256` ที่เก็บไว้

## หมุนกุญแจ

ตั้ง `FILE_MASTER_KEY="2:<ใหม่>,1:<เดิม>"` → ของใหม่ใช้รุ่น 2 ทันที ของเก่ายังถอดได้ด้วยรุ่น 1
ถอดรุ่น 1 ออกจาก env ได้ก็ต่อเมื่อ re-wrap `encryptedDek` ของไฟล์เก่าครบแล้วเท่านั้น
