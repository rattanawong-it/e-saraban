#!/usr/bin/env bash
#
# กู้คืนข้อมูล e-Saraban จากชุด backup หนึ่งชุด (คู่กับ scripts/backup.sh)
#
# ⚠️ คำสั่งนี้**เขียนทับฐานข้อมูลปลายทางทั้งหมด** ใช้ผิดเครื่องคือข้อมูลจริงหายทันที
# จึงบังคับให้พิมพ์ชื่อฐานข้อมูลปลายทางยืนยันด้วยมือ ไม่มีทางลัดให้กด Enter ผ่าน
#
# วิธีใช้
#   ./scripts/restore.sh backups/20260826-140000
#   RESTORE_SKIP_ATTACHMENTS=1 ./scripts/restore.sh <ชุด>   # กู้เฉพาะฐานข้อมูล
#
# ⚠️ ไฟล์แนบชั้นความลับ 1-3 ถอดรหัสได้ก็ต่อเมื่อ FILE_MASTER_KEY บนเครื่องปลายทาง
# มีกุญแจ**รุ่นเดียวกับตอนอัปโหลด** · กุญแจไม่ได้อยู่ใน backup โดยตั้งใจ (ดู docs/backup.md)

set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

SOURCE="${1:-}"
[[ -n "$SOURCE" ]] || { echo "ใช้: $0 <โฟลเดอร์ backup>" >&2; exit 1; }
[[ -d "$SOURCE" ]] || { echo "ไม่พบโฟลเดอร์: $SOURCE" >&2; exit 1; }
[[ -f "$SOURCE/database.dump" ]] || { echo "ไม่พบ database.dump ใน $SOURCE" >&2; exit 1; }

COMPOSE_DB_SERVICE="${COMPOSE_DB_SERVICE:-postgres}"
log() { printf '%s  %s\n' "$(date +'%H:%M:%S')" "$*"; }
die() { printf '%s  ✗ %s\n' "$(date +'%H:%M:%S')" "$*" >&2; exit 1; }

if [[ -f "$PROJECT_ROOT/.env" ]]; then
  while IFS='=' read -r key value; do
    [[ $key =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
    [[ -n ${!key+x} ]] && continue
    value="${value%\"}"; value="${value#\"}"
    export "$key=$value"
  done < <(grep -E '^[A-Z_][A-Z0-9_]*=' "$PROJECT_ROOT/.env" || true)
fi

# ⚠️ DATABASE_URL ของ Prisma มีพารามิเตอร์ที่ libpq ไม่รู้จักปนอยู่ (schema, connection_limit, ...)
# ส่งเข้า pg_dump ตรง ๆ จะได้ error "invalid URI query parameter" ทันที
# ตัดเฉพาะตัวที่เป็นของ Prisma ออก ที่เหลือ (sslmode ฯลฯ) ปล่อยผ่านตามเดิม
#
# การตัด schema ทิ้งไม่ทำให้ backup ขาด - pg_dump ที่ไม่ระบุ schema จะ dump ทุก schema
# ซึ่งกว้างกว่าเดิม ไม่ใช่แคบกว่า
libpq_url() {
  local url="$1"
  for param in schema connection_limit pool_timeout pgbouncer socket_timeout \
               statement_cache_size sslidentity sslpassword; do
    url="$(printf '%s' "$url" | sed -E "s/([?&])${param}=[^&]*(&|\$)/\1/g")"
  done
  url="$(printf '%s' "$url" | sed -E 's/[?&]+$//')"
  printf '%s' "$url"
}

# tar ของ GNU เห็น "C:/..." เป็นชื่อโฮสต์ระยะไกล (รูปแบบ host:path) แล้วพยายามต่อ ssh
# บนเซิร์ฟเวอร์ Linux ไม่เจอปัญหานี้ แต่การซ้อมกู้คืนอาจทำบนเครื่อง dev ที่เป็น Windows
TAR_OPTS=()
if tar --force-local --version >/dev/null 2>&1; then TAR_OPTS+=(--force-local); fi

# ⚠️ ทำไมไม่ใช้ `docker compose exec -T ... < ไฟล์`
# การส่ง stdin จากโฮสต์เข้า container ใช้ไม่ได้บน Git Bash/Windows (ไฟล์ที่ได้เสียหายเงียบ ๆ)
# และการซ้อมกู้คืนบางครั้งทำบนเครื่อง dev จึงใช้ container ชั่วคราวที่ mount โฟลเดอร์
# backup เข้าไปแทน แล้วให้ pg_dump เขียนไฟล์เองตรง ๆ ไม่ผ่าน pipe เลย
#
# ⚠️ ใช้ image เดียวกับ server ที่รันอยู่เสมอ เวอร์ชัน client จึงตรงกับ server แน่นอน
db_image() { docker inspect -f '{{.Config.Image}}' "$(docker compose ps -q "$COMPOSE_DB_SERVICE")"; }
db_container() { docker compose ps -q "$COMPOSE_DB_SERVICE"; }

# รันคำสั่งของ postgres ใน container ชั่วคราว แชร์เน็ตเวิร์กกับ server (ต่อ 127.0.0.1 ได้)
# และ mount โฟลเดอร์ที่ส่งมาเป็นอาร์กิวเมนต์แรกไว้ที่ /backup
# แปลงพาธของ Git Bash (/c/Users/...) ให้เป็นรูปที่ Docker Desktop เข้าใจ (C:/Users/...)
# บน Linux ไม่มี cygpath จึงคืนค่าเดิม — ไม่กระทบเซิร์ฟเวอร์จริง
host_path() {
  if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf %s "$1"; fi
}
pg_in_container() {
  local mount="$1"; shift
  # Git Bash แปลงพาธที่ขึ้นต้นด้วย / ให้เป็นพาธ Windows อัตโนมัติ ทำให้ /backup ในคำสั่ง
  # กลายเป็น C:/Program Files/Git/backup — ปิดการแปลงเฉพาะคำสั่งนี้ (ตัวแปรนี้ไม่มีผลบน Linux)
  MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' \
  docker run --rm \
    --network "container:$(db_container)" \
    -e PGPASSWORD="${POSTGRES_PASSWORD:-esaraban_dev_password}" \
    -v "$(host_path "$mount"):/backup" \
    "$(db_image)" "$@"
}

DATABASE_URL="${DATABASE_URL:-}"
STORAGE_ROOT="${STORAGE_ROOT:-$PROJECT_ROOT/storage/attachments}"
TARGET_DB="${POSTGRES_DB:-esaraban}"

# ── ตรวจ checksum ก่อนแตะอะไรทั้งสิ้น ────────────────────────────────
if [[ -f "$SOURCE/SHA256SUMS" ]]; then
  log "ตรวจ checksum..."
  ( cd "$SOURCE" && sha256sum -c SHA256SUMS ) || die "checksum ไม่ตรง — ไฟล์เสียหายระหว่างเก็บ ห้ามใช้ชุดนี้"
else
  log "⚠️ ชุดนี้ไม่มี SHA256SUMS — ข้ามการตรวจความสมบูรณ์"
fi

echo
cat "$SOURCE/manifest.txt" 2>/dev/null || true
echo
echo "───────────────────────────────────────────────────────────"
echo "⚠️ กำลังจะเขียนทับฐานข้อมูล \"$TARGET_DB\" ด้วยชุด $(basename "$SOURCE")"
echo "   ข้อมูลปัจจุบันในฐานนี้จะหายทั้งหมดและกู้กลับไม่ได้"
echo "───────────────────────────────────────────────────────────"
read -r -p "พิมพ์ชื่อฐานข้อมูลเพื่อยืนยัน ($TARGET_DB): " CONFIRM
[[ "$CONFIRM" == "$TARGET_DB" ]] || die "ชื่อไม่ตรง — ยกเลิก"

# ⚠️ ต้องเลือกทางเดียวกับตอน backup - ถ้า dump ด้วย client ในเครื่องแต่มา restore ผ่าน
# container (หรือกลับกัน) เวอร์ชันจะไม่ตรงแล้วอ่านไฟล์ไม่ออก - ใช้ตัวแปรชื่อเดียวกับ backup.sh
USE_DOCKER=0
if [[ "${BACKUP_USE_DOCKER:-auto}" == "1" ]]; then
  USE_DOCKER=1
elif [[ "${BACKUP_USE_DOCKER:-auto}" == "auto" ]]; then
  if command -v docker >/dev/null 2>&1 &&
     docker compose ps --status running --services 2>/dev/null | grep -qx "$COMPOSE_DB_SERVICE"; then
    USE_DOCKER=1
  fi
fi

if grep -q 'วิธี dump' "$SOURCE/manifest.txt" 2>/dev/null; then
  log "ชุดนี้ทำด้วย: $(grep 'วิธี dump' "$SOURCE/manifest.txt" | cut -d: -f2- | xargs)"
fi

# ── กู้ฐานข้อมูล ────────────────────────────────────────────────────
#
# --clean --if-exists ลบของเดิมก่อนสร้างใหม่ · ไม่ใช้ --create เพราะฐานถูกสร้างไว้แล้ว
# โดย docker-compose พร้อม locale ภาษาไทย (ICU th-TH) ซึ่งเปลี่ยนทีหลังไม่ได้
log "กู้ฐานข้อมูล..."
if [[ $USE_DOCKER -eq 1 ]]; then
  pg_in_container "$(cd "$SOURCE" && pwd)" pg_restore \
    -h 127.0.0.1 -U "${POSTGRES_USER:-esaraban}" -d "$TARGET_DB" \
    --clean --if-exists --no-owner --no-privileges /backup/database.dump
else
  [[ -n "$DATABASE_URL" ]] || die "ไม่มี DATABASE_URL"
  "${PG_RESTORE:-pg_restore}" -d "$(libpq_url "$DATABASE_URL")" \
    --clean --if-exists --no-owner --no-privileges "$SOURCE/database.dump"
fi

# ── กู้ไฟล์แนบ ──────────────────────────────────────────────────────
if [[ "${RESTORE_SKIP_ATTACHMENTS:-0}" != "1" && -f "$SOURCE/attachments.tar.gz" ]]; then
  log "กู้ไฟล์แนบไปที่ $STORAGE_ROOT ..."
  mkdir -p "$STORAGE_ROOT"
  tar "${TAR_OPTS[@]}" -xzf "$SOURCE/attachments.tar.gz" -C "$STORAGE_ROOT"
fi

log "✓ กู้คืนเสร็จ"
echo
echo "ตรวจต่อด้วยมือก่อนเปิดให้ผู้ใช้เข้า:"
echo "  1. เปิดหน้าทะเบียนแล้วเทียบเลขล่าสุดกับที่ควรจะเป็น"
echo "  2. เปิดไฟล์แนบของเอกสารชั้นความลับสักฉบับ — ถ้าเปิดไม่ได้แปลว่า FILE_MASTER_KEY ไม่ตรง"
echo "  3. รัน pnpm db:deploy เผื่อชุด backup เก่ากว่า migration ล่าสุดในโค้ด"
