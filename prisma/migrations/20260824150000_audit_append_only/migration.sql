-- spec §8.5 — AuditLog เป็น append-only และต้อง "บังคับที่ระดับฐานข้อมูล"
--
-- ใช้ trigger ไม่ใช่ REVOKE เพราะ owner ของตาราง (ผู้ใช้ที่แอปเชื่อมต่อเข้ามา)
-- ข้าม GRANT ได้อยู่แล้ว — trigger จึงเป็นด่านเดียวที่กันได้จริงโดยไม่ต้อง
-- แยก database role เพิ่ม (ซึ่งจะทำให้ migrate/deploy ซับซ้อนขึ้นมาก)
--
-- ผลลัพธ์: ต่อให้โค้ดเผลอเรียก update/delete หรือมีคนเข้า psql มาแก้เอง
-- ฐานข้อมูลจะปฏิเสธทันที

CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs เป็นตารางแบบ append-only — ห้าม UPDATE หรือ DELETE (spec 8.5)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_no_update ON "audit_logs";
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON "audit_logs";
CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
