# Crypto

envelope encryption ของไฟล์แนบ (spec §8.2)

- ทุกไฟล์ลับสุ่ม DEK แบบ AES-256-GCM แล้ว wrap DEK ด้วย Master Key (KEK)
- KEK อ่านจาก env `FILE_MASTER_KEY` — **ห้ามเก็บใน database หรือ git**
- เก็บใน DB เฉพาะ `encryptedDek` `iv` `authTag` `algo` `keyVersion` → รองรับ key rotation
- ต้องเผื่อ interface สำหรับต่อ HSM / HashiCorp Vault ในอนาคต

โมดูลนี้จัดการ**เฉพาะการเข้ารหัส** ส่วนการอ่าน-เขียนไฟล์เป็นของ `src/lib/storage/`

ขอบเขตของ **P3**
