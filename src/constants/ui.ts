// ข้อความบนหน้าจอทั้งหมด (spec §12 — "แยกข้อความออกจาก component")
//
// กติกาของโปรเจกต์: **ห้ามเขียนข้อความไทยลง component ตรง ๆ** ให้อ้างจากที่นี่
// วันที่จะเพิ่มภาษา จะได้เปลี่ยนเป็น dictionary ต่อภาษาโดยไม่ต้องไล่แก้ทุกไฟล์
//
// จัดกลุ่มตามหน้าจอ ไม่ใช่ตามชนิดของคำ เพื่อให้หาเจอจากชื่อหน้าที่กำลังแก้อยู่

export const COMMON = {
  save: "บันทึก",
  saveChanges: "บันทึกการเปลี่ยนแปลง",
  cancel: "ยกเลิก",
  edit: "แก้ไข",
  add: "เพิ่ม",
  remove: "ลบออก",
  close: "ปิด",
  search: "ค้นหา",
  loading: "กำลังทำงาน...",
  confirm: "ยืนยัน",
  back: "ย้อนกลับ",
  none: "—",
  optional: "(ไม่บังคับ)",
  copy: "คัดลอก",
  copied: "คัดลอกแล้ว",
  showAll: "ดูทั้งหมด",
  active: "ใช้งานอยู่",
  inactive: "ปิดใช้งาน",
  archived: "เก็บถาวร",
  locked: "ถูกล็อก",
  yes: "ใช่",
  no: "ไม่ใช่",
} as const

export const BRAND = {
  name: "e-Saraban",
  tagline: "ระบบสารบรรณอิเล็กทรอนิกส์",
  organization: "มหาวิทยาลัยเกริก",
  copyright: "© 2569 มหาวิทยาลัยเกริก · e-Saraban v1.0",
  logoAlt: "ตราสัญลักษณ์มหาวิทยาลัยเกริก",
} as const

export const NAV = {
  groupMain: null,
  groupRegistry: "สารบรรณ",
  groupAdmin: "ผู้ดูแลระบบ",

  dashboard: "ภาพรวม",
  inbox: "กล่องรับเอกสาร",
  outbox: "กล่องส่งเอกสาร",
  drafts: "ร่างของฉัน",

  registry: "ทะเบียนหนังสือ",
  registryIncoming: "ทะเบียนรับ",
  registryOutgoing: "ออกเลขหนังสือ",
  registrySent: "ทะเบียนส่ง",
  search: "ค้นหาขั้นสูง",
  reports: "รายงานทะเบียน",

  orgStructure: "โครงสร้างองค์กร",
  orgUnits: "หน่วยงาน",
  users: "ผู้ใช้งาน",
  roles: "บทบาทและสิทธิ์",
  systemSettings: "ตั้งค่าระบบ",
  numbering: "รูปแบบเลขหนังสือ",
  generalSettings: "ค่าตั้งทั่วไป",
  audit: "ตรวจสอบ Audit",
} as const

export const HEADER = {
  workingAs: "กำลังทำงานในนาม",
  switchUnit: "สลับหน่วยงาน",
  searchPlaceholder: "ค้นหาเลขที่หนังสือ, เรื่อง, ชื่อผู้ส่ง...",
  notifications: "การแจ้งเตือน",
  toggleTheme: "สลับธีมสว่าง/มืด",
  openMenu: "เปิดเมนู",
  closeMenu: "ปิดเมนู",
  editProfile: "แก้ไขโปรไฟล์",
  changePassword: "เปลี่ยนรหัสผ่าน",
  logout: "ออกจากระบบ",
  singleAffiliation: "สังกัดเดียว",
} as const

export const LOGIN = {
  heroTitle: "จัดการหนังสือราชการได้ครบในที่เดียว",
  heroSubtitle:
    "ลดขั้นตอนงานสารบรรณ ออกเลขทะเบียนอัตโนมัติ ควบคุมชั้นความลับ และตรวจสอบย้อนหลังได้ทุกการกระทำ",
  features: [
    "ควบคุมชั้นความลับ 4 ระดับ พร้อมเข้ารหัสไฟล์แนบ",
    "ออกเลขทะเบียนอัตโนมัติ แยกตามหน่วยงานและปี",
    "ตรวจสอบย้อนหลังได้ทุกการกระทำ (audit log)",
  ],
  title: "เข้าสู่ระบบ",
  subtitle: "กรอกชื่อผู้ใช้และรหัสผ่านของหน่วยงานคุณ",
  username: "ชื่อผู้ใช้",
  usernamePlaceholder: "เช่น rattana.wong",
  password: "รหัสผ่าน",
  passwordPlaceholder: "กรอกรหัสผ่าน",
  forgot: "ลืมรหัสผ่าน?",
  remember: "จดจำการเข้าสู่ระบบไว้ 8 ชั่วโมง",
  submit: "เข้าสู่ระบบ",
  submitting: "กำลังตรวจสอบ...",
  noAccount: "ยังไม่มีบัญชีผู้ใช้งาน?",
  registerLink: "ลงทะเบียนใช้งาน",
  contactAdmin: "หรือติดต่อผู้ดูแลระบบหน่วยงานของคุณ",
  showPassword: "แสดงรหัสผ่าน",
  hidePassword: "ซ่อนรหัสผ่าน",
} as const

export const FORGOT_PASSWORD = {
  heroTitle: "กู้คืนการเข้าถึงบัญชีของคุณ",
  heroSubtitle:
    "MVP นี้ยังไม่มีการแจ้งเตือนทางอีเมล คำขอของคุณจะถูกส่งเข้าคิวให้ผู้ดูแลระบบตรวจสอบและรีเซ็ตรหัสผ่านให้โดยตรง",
  backToLogin: "กลับไปหน้าเข้าสู่ระบบ",
  title: "ลืมรหัสผ่าน?",
  subtitle: "กรอกอีเมลที่ลงทะเบียนไว้กับบัญชี ระบบจะส่งคำขอไปยังผู้ดูแลระบบให้รีเซ็ตรหัสผ่านให้",
  email: "อีเมลของหน่วยงาน",
  emailPlaceholder: "rattana.wong@krirk.ac.th",
  submit: "ส่งคำขอรีเซ็ตรหัสผ่าน",
  submitting: "กำลังส่งคำขอ...",
  sentTitle: "ส่งคำขอเรียบร้อยแล้ว",
  sentBody:
    "ผู้ดูแลระบบจะตรวจสอบและติดต่อกลับพร้อมรหัสผ่านชั่วคราว หากเร่งด่วนสามารถติดต่อผู้ดูแลระบบของหน่วยงานได้โดยตรง",
  notice:
    "ระบบตอบผลลัพธ์เหมือนกันทุกครั้ง ไม่ว่าอีเมลนั้นจะมีบัญชีในระบบหรือไม่ เพื่อไม่ให้หน้านี้ถูกใช้ตรวจสอบว่าอีเมลใดมีบัญชีอยู่",
} as const

export const REGISTER = {
  heroTitle: "ลงทะเบียนใช้งานสำหรับหน่วยงานของคุณ",
  heroSubtitle:
    "คำขอของคุณจะถูกส่งไปยังผู้ดูแลระบบเพื่อตรวจสอบและอนุมัติสิทธิ์การใช้งานก่อนเข้าสู่ระบบได้",
  backToLogin: "กลับไปหน้าเข้าสู่ระบบ",
  title: "ลงทะเบียนผู้ใช้ใหม่",
  subtitle:
    "กรอกข้อมูลของคุณให้ครบถ้วน ระบบจะส่งคำขอไปยังผู้ดูแลระบบเพื่อตรวจสอบก่อนเปิดใช้งานบัญชี",
  prefix: "คำนำหน้า",
  prefixPlaceholder: "เช่น นาย / นาง / ผศ.ดร.",
  firstName: "ชื่อ",
  lastName: "นามสกุล",
  email: "อีเมลของหน่วยงาน",
  emailPlaceholder: "rattana.wong@krirk.ac.th",
  username: "ชื่อผู้ใช้ที่ต้องการ",
  usernamePlaceholder: "เช่น rattana.wong",
  usernameHint: "ใช้ได้เฉพาะ a-z 0-9 จุด ขีดล่าง และขีดกลาง",
  orgUnit: "หน่วยงานที่สังกัด",
  orgUnitPlaceholder: "เลือกหน่วยงาน...",
  positionTitle: "ตำแหน่ง",
  positionPlaceholder: "เช่น เจ้าหน้าที่บริหารงานทั่วไป",
  password: "รหัสผ่าน",
  confirmPassword: "ยืนยันรหัสผ่าน",
  note: "หมายเหตุถึงผู้ดูแลระบบ",
  notePlaceholder: "ระบุเหตุผลหรือข้อมูลเพิ่มเติม (ถ้ามี)",
  submit: "ส่งคำขอลงทะเบียน",
  submitting: "กำลังส่งคำขอ...",
  successTitle: "ส่งคำขอเรียบร้อยแล้ว",
  successBody:
    "ผู้ดูแลระบบของหน่วยงานจะตรวจสอบคำขอของคุณ เมื่ออนุมัติแล้วคุณจะเข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่านที่ตั้งไว้ได้ทันที",
} as const

export const CHANGE_PASSWORD = {
  title: "เปลี่ยนรหัสผ่าน",
  firstTimeTitle: "ตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งาน",
  firstTimeBody:
    "บัญชีนี้ยังใช้รหัสผ่านชั่วคราวที่ผู้ดูแลระบบตั้งให้ กรุณาตั้งรหัสผ่านของคุณเองก่อนเข้าใช้งานระบบ",
  currentPassword: "รหัสผ่านปัจจุบัน",
  newPassword: "รหัสผ่านใหม่",
  confirmPassword: "ยืนยันรหัสผ่านใหม่",
  submit: "บันทึกรหัสผ่านใหม่",
  submitting: "กำลังบันทึก...",
  policyTitle: "ข้อกำหนดของรหัสผ่าน",
  policyItems: (minLength: number) => [
    `ยาวอย่างน้อย ${minLength} ตัวอักษร`,
    "มีอักขระอย่างน้อย 2 ประเภท (ตัวอักษร ตัวเลข หรือสัญลักษณ์)",
    "ต้องไม่เป็นรหัสผ่านที่พบบ่อย และไม่มีชื่อผู้ใช้อยู่ข้างใน",
  ],
} as const

export const DASHBOARD = {
  title: "ภาพรวม",
  newDocument: "สร้างหนังสือใหม่",
  statOrgUnits: "หน่วยงานที่ใช้งานอยู่",
  statUsers: "ผู้ใช้งานที่เปิดใช้งาน",
  statMyAffiliations: "สังกัดของฉัน",
  statPendingRegistrations: "คำขอสมัครรออนุมัติ",
  statPendingResets: "คำขอรีเซ็ตรหัสผ่าน",
  statAuditToday: "เหตุการณ์วันนี้",
  statDeniedToday: "การเข้าถึงที่ถูกปฏิเสธวันนี้",
  statLockedUsers: "บัญชีที่ถูกล็อกอยู่",
  recentActivity: "กิจกรรมล่าสุด",
  recentActivityEmpty: "ยังไม่มีกิจกรรมในระบบ",
  myAffiliations: "สังกัดและบทบาทของฉัน",
  phaseNoticeTitle: "โมดูลเอกสารยังอยู่ระหว่างพัฒนา (P2)",
  phaseNoticeBody:
    "เฟสปัจจุบันคือ P1 — Identity & Org ระบบจึงยังไม่มีสถิติหนังสือ กล่องรับ/ส่ง และคิวออกเลข หน้านี้แสดงสถิติฝั่งผู้ใช้และหน่วยงานแทน",
  primaryBadge: "สังกัดหลัก",
} as const

export const ORG_UNITS = {
  title: "โครงสร้างหน่วยงาน",
  description: "โครงสร้างลำดับชั้นไม่จำกัดระดับ · ย้ายหน่วยงานได้โดยเลือกหน่วยงานแม่ใหม่",
  addUnit: "เพิ่มหน่วยงาน",
  treeTitle: "ผังหน่วยงาน",
  detailTitle: "รายละเอียดหน่วยงาน",
  selectPrompt: "เลือกหน่วยงานจากผังทางซ้ายเพื่อดูรายละเอียด",
  nameTh: "ชื่อหน่วยงาน (เต็ม)",
  shortName: "ชื่อย่อ",
  code: "รหัสหนังสือ",
  type: "ประเภทหน่วยงาน",
  parent: "หน่วยงานแม่",
  rootOption: "— ไม่มี (เป็นหน่วยงานสูงสุด) —",
  head: "หัวหน้าหน่วยงาน",
  headNone: "ยังไม่ได้กำหนด",
  sortOrder: "ลำดับการแสดง",
  stats: "สถิติ",
  memberCount: "ผู้ใช้ในหน่วยงาน",
  childCount: "หน่วยงานลูก",
  archive: "เก็บถาวร",
  restore: "นำกลับมาใช้",
  move: "ย้ายหน่วยงาน",
  moveTo: "ย้ายไปอยู่ใต้",
  archiveNotice:
    "หน่วยงานที่มีเอกสารผูกอยู่ลบไม่ได้ — ใช้การเก็บถาวรแทนเพื่อรักษาทะเบียนย้อนหลัง (spec §5.1)",
  showArchived: "แสดงหน่วยงานที่เก็บถาวรแล้ว",
  createTitle: "เพิ่มหน่วยงานใหม่",
  codeHint: "รหัสหนังสือประจำหน่วยงาน เช่น ศธ 0512.1 — ใช้ประกอบเลขทะเบียนใน P2",
} as const

export const USERS = {
  title: "ผู้ใช้งาน",
  description: "จัดการบัญชี สังกัดหลายหน่วยงาน บทบาท และชั้นความลับที่เข้าถึงได้",
  addUser: "เพิ่มผู้ใช้งาน",
  searchPlaceholder: "ค้นหาชื่อ, ชื่อผู้ใช้, อีเมล...",
  listTitle: "รายชื่อผู้ใช้",
  detailTitle: "รายละเอียดผู้ใช้",
  selectPrompt: "เลือกผู้ใช้จากรายการทางซ้ายเพื่อดูรายละเอียด",
  emptyList: "ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข",
  affiliations: "สังกัด & บทบาท",
  addAffiliation: "เพิ่มสังกัด",
  removeAffiliation: "ถอดสังกัด",
  primary: "สังกัดหลัก",
  clearance: "ชั้นความลับที่เข้าถึงได้",
  resetPassword: "รีเซ็ตรหัสผ่าน",
  suspend: "ระงับบัญชี",
  activate: "เปิดใช้งาน",
  lastLogin: "เข้าใช้งานล่าสุด",
  neverLoggedIn: "ยังไม่เคยเข้าใช้งาน",
  mustChangePassword: "ต้องเปลี่ยนรหัสผ่าน",
  pendingReset: "มีคำขอรีเซ็ตรหัสผ่าน",
  showInactive: "แสดงบัญชีที่ถูกระงับ",
  temporaryPasswordTitle: "รหัสผ่านชั่วคราว — แสดงเพียงครั้งเดียว",
  temporaryPasswordBody:
    "MVP ยังไม่มีการแจ้งเตือนทางอีเมล (D10) กรุณาคัดลอกรหัสผ่านนี้แล้วแจ้งผู้ใช้ด้วยช่องทางที่ปลอดภัย ระบบจะบังคับให้เปลี่ยนทันทีที่เข้าสู่ระบบครั้งแรก",
  createTitle: "เพิ่มผู้ใช้งานใหม่",
  role: "บทบาทในหน่วยงานนี้",
  registrationQueue: "คำขอสมัครใช้งาน",
  registrationEmpty: "ไม่มีคำขอรออนุมัติ",
  approve: "อนุมัติ",
  reject: "ปฏิเสธ",
  rejectReason: "เหตุผลที่ปฏิเสธ",
  resetQueue: "คำขอรีเซ็ตรหัสผ่าน",
  resetQueueEmpty: "ไม่มีคำขอรีเซ็ตรหัสผ่าน",
  requestedAt: "ส่งคำขอเมื่อ",
} as const

export const ROLES = {
  title: "บทบาทและสิทธิ์",
  description: "Role ผูกกับคู่ (ผู้ใช้, หน่วยงาน) — คนหนึ่งมีหลายบทบาทในหลายหน่วยงานพร้อมกันได้",
  roleList: "บทบาททั้งหมด",
  matrixTitle: "สิทธิ์ของบทบาท",
  scopeLegend: "ขอบเขต:",
  userCount: (n: number) => `${n} การมอบหมาย`,
  systemRole: "บทบาทของระบบ",
  save: "บันทึกสิทธิ์",
  adminNotice:
    "ผู้ดูแลระบบไม่ได้รับสิทธิ์อ่านเอกสารโดยอัตโนมัติ เพื่อป้องกันการสอดส่องเอกสาร หากจำเป็นต้องใช้กลไก break-glass ซึ่งบันทึก audit ระดับ CRITICAL (spec §4.2)",
  changeWarning:
    "การเปลี่ยนสิทธิ์ของบทบาทมีผลกับผู้ใช้ทุกคนที่ถือบทบาทนี้ทันที และถูกบันทึก audit ระดับ CRITICAL",
} as const

export const AUDIT = {
  title: "ตรวจสอบ Audit Log",
  description: "บันทึกทุกการกระทำแบบ Append-only · เชื่อมโยงด้วย Hash Chain",
  verifyChain: "ตรวจสอบความสมบูรณ์ของ Hash Chain",
  verifying: "กำลังตรวจสอบ...",
  exportCsv: "Export CSV",
  colTime: "เวลา",
  colActor: "ผู้กระทำ",
  colAction: "การกระทำ",
  colEntity: "รายการอ้างอิง",
  colResult: "ผลลัพธ์",
  colIp: "IP Address",
  filterAll: "ทั้งหมด",
  filterDenied: "ถูกปฏิเสธ",
  filterCritical: "ระดับวิกฤต",
  filterLogin: "การเข้าสู่ระบบ",
  filterAdmin: "งานผู้ดูแลระบบ",
  empty: "ไม่พบรายการที่ตรงกับเงื่อนไข",
  appendOnlyNotice:
    "ตารางนี้แก้ไขและลบไม่ได้ทั้งจากโค้ดและจากฐานข้อมูล (บังคับด้วย trigger ระดับ PostgreSQL)",
  system: "ระบบ",
  page: "หน้า",
  of: "จาก",
  previous: "ก่อนหน้า",
  next: "ถัดไป",
  total: (n: number) => `ทั้งหมด ${n.toLocaleString("th-TH")} รายการ`,
} as const

export const SETTINGS = {
  title: "ตั้งค่าระบบ",
  description: "ค่าที่มีผลกับทั้งระบบ — เปลี่ยนแล้วบันทึก audit ทุกครั้ง",
  numberingTitle: "เลขทะเบียน",
  yearMode: "ปีที่ใช้รีเซ็ตเลขทะเบียน",
  yearModeHint:
    "⚠️ เปลี่ยนภายหลังทำให้เลขทะเบียนไม่ต่อเนื่อง — ต้องยืนยันกับสารบรรณกลางก่อนเปลี่ยน (spec §7.2)",
  languageTitle: "ภาษาที่ใช้งาน",
  languageValue: "ไทย",
  languageHint: "MVP รองรับภาษาไทยอย่างเดียว (spec §12)",
  fileTitle: "ไฟล์แนบ",
  maxSize: "ขนาดไฟล์สูงสุดต่อไฟล์",
  maxSizeUnit: "MB",
  maxSizeHint: "ตรวจ magic-number ไม่เชื่อนามสกุลไฟล์ (spec §8.4)",
  allowedTypes: "ประเภทไฟล์ที่อนุญาต",
  passwordTitle: "นโยบายรหัสผ่าน",
  minLength: "ความยาวขั้นต่ำ (Argon2id)",
  minLengthUnit: "ตัวอักษร",
  mustChange: "บังคับเปลี่ยนรหัสผ่านครั้งแรก",
  mustChangeHint: "สำหรับบัญชีที่สร้างใหม่โดยผู้ดูแลระบบ",
  checkCommon: "ตรวจสอบกับ Common Password List",
  checkCommonHint: "ปฏิเสธรหัสผ่านที่พบบ่อย",
  sessionTitle: "Session & Lockout",
  idleTimeout: "Idle timeout",
  idleUnit: "นาที",
  absoluteTimeout: "Absolute timeout",
  absoluteUnit: "ชั่วโมง",
  lockoutThreshold: "จำนวนครั้งที่ผิดก่อนล็อก",
  lockoutThresholdUnit: "ครั้ง",
  lockoutBase: "ระยะเวลาล็อกตั้งต้น",
  lockoutBaseUnit: "นาที",
  lockoutHint:
    "ล็อกแบบ exponential backoff — ผิดครบเกณฑ์รอบถัดไปจะถูกล็อกนานขึ้นเป็นสองเท่า พร้อม rate limit ต่อ IP",
} as const

export const COMING_SOON = {
  badge: "อยู่ระหว่างพัฒนา",
  title: "ฟีเจอร์นี้จะมาในเฟสถัดไป",
  body: (phase: string) =>
    `หน้านี้เป็นส่วนหนึ่งของ ${phase} ตามแผนใน spec §13 — เฟสปัจจุบันคือ P1 (Identity & Org) ซึ่งครอบคลุมการยืนยันตัวตน โครงสร้างหน่วยงาน ผู้ใช้ บทบาท และ audit`,
  backToDashboard: "กลับไปหน้าภาพรวม",
} as const
