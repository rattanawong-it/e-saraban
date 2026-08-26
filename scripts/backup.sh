#!/usr/bin/env bash
#
# สำรองข้อมูล e-Saraban — ฐานข้อมูล + ไฟล์แนบ (spec §12)
#
# ⚠️ เอกสารที่ออกเลขทะเบียนไปแล้วออกซ้ำไม่ได้ (§6.4) ข้อมูลที่หายจึงกู้จากการทำงานใหม่ไม่ได้
# สคริปต์นี้จึงตั้งใจให้ "พังดังกว่าพังเงียบ" — ทุกขั้นที่ไม่สำเร็จจะหยุดทันทีและคืนสถานะไม่ศูนย์
# ไม่มีการเขียนสำเร็จครึ่งใบทิ้งไว้ให้เข้าใจผิดว่ามี backup
#
# สิ่งที่ได้ต่อหนึ่งรอบ (โฟลเดอร์เดียวจบ):
#   database.dump   — pg_dump รูปแบบ custom (บีบอัดในตัว · restore ทีละตารางได้)
#   attachments.tar.gz — ไฟล์แนบทั้งต้นไม้
#   manifest.txt    — เวลา · เวอร์ชัน migration ล่าสุด · จำนวนแถวสำคัญ · ขนาดไฟล์
#   SHA256SUMS      — checksum ของทั้งสองไฟล์ ไว้พิสูจน์ว่าไฟล์ไม่เน่าระหว่างเก็บ
#
# ⚠️ **กุญแจเข้ารหัสไฟล์แนบ (FILE_MASTER_KEY) ไม่ได้อยู่ใน backup โดยตั้งใจ**
# backup ที่มีทั้งไฟล์เข้ารหัสและกุญแจอยู่ด้วยกัน = ไฟล์ที่ใครขโมยไปก็เปิดอ่านได้ทันที
# แต่แปลว่า **ถ้าทำกุญแจหาย ไฟล์แนบชั้นความลับใน backup จะเปิดไม่ได้ตลอดกาล**
# เก็บกุญแจแยกไว้คนละที่กับ backup และทดสอบว่ายังใช้ได้ทุกไตรมาส (ดู docs/backup.md)
#
# วิธีใช้
#   ./scripts/backup.sh                    # เขียนลง ./backups/<วันเวลา>
#   BACKUP_DIR=/mnt/backup ./scripts/backup.sh
#   BACKUP_KEEP=30 ./scripts/backup.sh     # เก็บกี่ชุดย้อนหลัง (ค่าปริยาย 14)
#
# ตั้ง cron รายวันตี 2:  0 2 * * *  cd /srv/esaraban && ./scripts/backup.sh >> /var/log/esaraban-backup.log 2>&1

set -Eeuo pipefail

# ── ค่าตั้งต้น ───────────────────────────────────────────────────────
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/$STAMP"

# ชื่อ service ของ postgres ใน docker compose — ใช้เมื่อรันบนเครื่องที่ deploy ด้วย compose
COMPOSE_DB_SERVICE="${COMPOSE_DB_SERVICE:-postgres}"

log() { printf '%s  %s\n' "$(date +'%H:%M:%S')" "$*"; }
die() { printf '%s  ✗ %s\n' "$(date +'%H:%M:%S')" "$*" >&2; exit 1; }

# ลบโฟลเดอร์ที่ทำค้างไว้เมื่อพังกลางคัน — backup ครึ่งใบอันตรายกว่าไม่มี backup
# เพราะคนเห็นโฟลเดอร์แล้วเชื่อว่ามีของ
cleanup_on_fail() {
  local code=$?
  if [[ $code -ne 0 && -d "$TARGET" ]]; then
    printf '   ลบชุดที่ทำค้างไว้: %s\n' "$TARGET" >&2
    rm -rf "$TARGET"
  fi
  exit $code
}
trap cleanup_on_fail EXIT

# ── อ่านค่าจาก .env ถ้ามี ───────────────────────────────────────────
if [[ -f "$PROJECT_ROOT/.env" ]]; then
  # อ่านเฉพาะบรรทัด KEY=VALUE ไม่ eval ทั้งไฟล์ เพื่อไม่ให้ .env สั่งรันอะไรได้
  while IFS='=' read -r key value; do
    [[ $key =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
    [[ -n ${!key+x} ]] && continue          # ค่าที่ส่งมาทาง environment ชนะไฟล์เสมอ
    value="${value%\"}"; value="${value#\"}"
    export "$key=$value"
  done < <(grep -E '^[A-Z_][A-Z0-9_]*=' "$PROJECT_ROOT/.env" || true)
fi

DATABASE_URL="${DATABASE_URL:-}"
STORAGE_ROOT="${STORAGE_ROOT:-$PROJECT_ROOT/storage/attachments}"

# ── เลือกวิธีต่อฐานข้อมูล ────────────────────────────────────────────
#
# บนเซิร์ฟเวอร์จริงฐานอยู่ใน container จึงเรียก pg_dump ข้างในนั้น (เวอร์ชันตรงกับ server เสมอ)
# บนเครื่อง dev ที่ติดตั้ง Postgres ตรง ๆ ใช้ pg_dump ในเครื่องกับ DATABASE_URL
USE_DOCKER=0
if [[ "${BACKUP_USE_DOCKER:-auto}" == "1" ]]; then
  USE_DOCKER=1
elif [[ "${BACKUP_USE_DOCKER:-auto}" == "auto" ]]; then
  if command -v docker >/dev/null 2>&1 &&
     docker compose ps --status running --services 2>/dev/null | grep -qx "$COMPOSE_DB_SERVICE"; then
    USE_DOCKER=1
  fi
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

PG_DUMP="${PG_DUMP:-pg_dump}"
PG_RESTORE="${PG_RESTORE:-pg_restore}"

if [[ $USE_DOCKER -eq 0 ]]; then
  command -v "$PG_DUMP" >/dev/null 2>&1 ||
    die "ไม่พบ $PG_DUMP — ติดตั้ง postgresql-client หรือชี้ตัวแปร PG_DUMP ไปที่ไฟล์จริง"
  [[ -n "$DATABASE_URL" ]] ||
    die "ไม่มี DATABASE_URL (อ่านจาก .env หรือส่งมาทาง environment)"

  # ⚠️ ด่านที่สำคัญที่สุดในสคริปต์นี้ — pg_dump ที่ใหม่กว่า server เขียนไฟล์เป็นรูปแบบใหม่
  # ที่ pg_restore เวอร์ชันของ server เองอ่านไม่ออก ("unsupported version in file header")
  # backup จะดู "สำเร็จ" ทุกวันจนถึงวันที่ต้องกู้จริงแล้วเพิ่งรู้ว่าใช้ไม่ได้
  CLIENT_MAJOR="$("$PG_DUMP" --version | grep -oE '[0-9]+' | head -1)"
  SERVER_MAJOR="$(
    "${PSQL:-psql}" "$(libpq_url "$DATABASE_URL")" -tAc 'SHOW server_version' 2>/dev/null |
      grep -oE '^[0-9]+' || echo ""
  )"

  if [[ -n "$SERVER_MAJOR" && "$CLIENT_MAJOR" -gt "$SERVER_MAJOR" ]]; then
    die "pg_dump เป็นเวอร์ชัน $CLIENT_MAJOR แต่ server เป็น $SERVER_MAJOR — ไฟล์ที่ได้จะ restore กลับเข้า server ตัวเองไม่ได้
   ใช้ pg_dump เวอร์ชัน $SERVER_MAJOR (ชี้ด้วยตัวแปร PG_DUMP) หรือรันผ่าน container ด้วย BACKUP_USE_DOCKER=1"
  fi
fi

# ── เริ่มทำงาน ──────────────────────────────────────────────────────
mkdir -p "$TARGET"
log "เริ่มสำรองข้อมูล → $TARGET"
log "แหล่งฐานข้อมูล: $([[ $USE_DOCKER -eq 1 ]] && echo "docker compose service '$COMPOSE_DB_SERVICE'" || echo "pg_dump ในเครื่อง")"

# ── 1. ฐานข้อมูล ────────────────────────────────────────────────────
#
# -Fc (custom) ไม่ใช่ SQL ธรรมดา เพราะบีบอัดในตัวและ restore เลือกเฉพาะตารางได้
# --no-owner/--no-privileges ให้ restore ขึ้นเครื่องใหม่ที่ชื่อ role ไม่ตรงกันได้
log "1/4 dump ฐานข้อมูล..."
if [[ $USE_DOCKER -eq 1 ]]; then
  pg_in_container "$TARGET" pg_dump \
    -h 127.0.0.1 -U "${POSTGRES_USER:-esaraban}" -d "${POSTGRES_DB:-esaraban}" \
    --format=custom --no-owner --no-privileges -f /backup/database.dump
else
  "$PG_DUMP" "$(libpq_url "$DATABASE_URL")" --format=custom --no-owner --no-privileges \
    > "$TARGET/database.dump"
fi

[[ -s "$TARGET/database.dump" ]] || die "ไฟล์ dump ว่างเปล่า — ยกเลิกทั้งชุด"

# ── 2. ไฟล์แนบ ──────────────────────────────────────────────────────
#
# เก็บทั้งต้นไม้แบบ path สัมพัทธ์ เพื่อให้ restore ลงเครื่องที่ STORAGE_ROOT คนละที่ได้
log "2/4 บีบอัดไฟล์แนบจาก $STORAGE_ROOT ..."
if [[ -d "$STORAGE_ROOT" ]]; then
  tar "${TAR_OPTS[@]}" -czf "$TARGET/attachments.tar.gz" -C "$STORAGE_ROOT" .
  ATTACHMENT_COUNT="$(find "$STORAGE_ROOT" -type f | wc -l | tr -d ' ')"
else
  # ไม่ถือว่าพัง — ระบบที่ยังไม่มีใครแนบไฟล์ก็ยังต้องสำรองฐานข้อมูลได้
  log "   (ไม่พบโฟลเดอร์ไฟล์แนบ — ข้ามขั้นนี้)"
  ATTACHMENT_COUNT=0
fi

# ── 3. ตรวจว่าไฟล์ที่เพิ่งเขียนอ่านกลับได้จริง ──────────────────────
#
# ⚠️ ขั้นนี้คือหัวใจ · backup ที่ไม่เคยถูกอ่านกลับคือความอุ่นใจปลอม ๆ
# ที่นี่ตรวจแค่ว่า "อ่านสารบัญได้" ส่วนการ restore เต็มรูปแบบทำทุกไตรมาสตาม docs/backup.md
log "3/4 ตรวจไฟล์ที่เพิ่งเขียน..."
if [[ $USE_DOCKER -eq 1 ]]; then
  pg_in_container "$TARGET" pg_restore --list /backup/database.dump > /dev/null ||
    die "อ่านสารบัญของ database.dump ไม่ได้"
else
  command -v "$PG_RESTORE" >/dev/null 2>&1 &&
    { "$PG_RESTORE" --list "$TARGET/database.dump" > /dev/null || die "อ่านสารบัญของ database.dump ไม่ได้"; }
fi

if [[ -f "$TARGET/attachments.tar.gz" ]]; then
  tar "${TAR_OPTS[@]}" -tzf "$TARGET/attachments.tar.gz" > /dev/null || die "อ่าน attachments.tar.gz ไม่ได้"
fi

# ── 4. manifest + checksum ──────────────────────────────────────────
log "4/4 เขียน manifest และ checksum..."

MIGRATION="$(ls -1 "$PROJECT_ROOT/prisma/migrations" 2>/dev/null | grep -v migration_lock | tail -1 || echo 'ไม่ทราบ')"
GIT_COMMIT="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo 'ไม่ทราบ')"

{
  echo "e-Saraban backup"
  echo "เวลา                : $(date +'%Y-%m-%d %H:%M:%S %z')"
  echo "เครื่อง              : $(hostname)"
  echo "migration ล่าสุด     : $MIGRATION"
  echo "วิธี dump            : $([[ $USE_DOCKER -eq 1 ]] && echo "docker compose ($COMPOSE_DB_SERVICE)" || echo "pg_dump ในเครื่อง")"
  echo "pg_dump / server    : ${CLIENT_MAJOR:-ในคอนเทนเนอร์} / ${SERVER_MAJOR:-ในคอนเทนเนอร์}"
  echo "git commit          : $GIT_COMMIT"
  echo "จำนวนไฟล์แนบ         : $ATTACHMENT_COUNT"
  echo "ขนาด database.dump  : $(du -h "$TARGET/database.dump" | cut -f1)"
  [[ -f "$TARGET/attachments.tar.gz" ]] &&
    echo "ขนาดไฟล์แนบ (บีบแล้ว) : $(du -h "$TARGET/attachments.tar.gz" | cut -f1)"
  echo ""
  echo "⚠️ ชุดนี้ไม่มี FILE_MASTER_KEY อยู่ด้วย — ไฟล์แนบชั้นความลับ 1-3 ถอดรหัสไม่ได้"
  echo "   ถ้าไม่มีกุญแจตัวที่ใช้ตอนอัปโหลด · เก็บกุญแจแยกที่และตรวจว่ายังใช้ได้ทุกไตรมาส"
} > "$TARGET/manifest.txt"

( cd "$TARGET" && sha256sum database.dump attachments.tar.gz 2>/dev/null > SHA256SUMS || true )

# ── ลบชุดเก่าเกินจำนวนที่กำหนด ──────────────────────────────────────
#
# ลบหลังจากชุดใหม่สำเร็จแล้วเท่านั้น — ไม่มีจังหวะไหนที่ไม่เหลือ backup เลยสักชุด
if [[ "$BACKUP_KEEP" -gt 0 ]]; then
  mapfile -t OLD < <(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' | sort | head -n -"$BACKUP_KEEP")
  for dir in "${OLD[@]:-}"; do
    [[ -n "$dir" ]] || continue
    log "ลบชุดเก่า: $(basename "$dir")"
    rm -rf "$dir"
  done
fi

trap - EXIT
log "✓ สำเร็จ — $TARGET"
log "  ทดสอบ restore จริงทุกไตรมาสตาม docs/backup.md · backup ที่ไม่เคยกู้คืนยังไม่นับว่าใช้ได้"
