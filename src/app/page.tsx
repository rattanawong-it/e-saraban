import { Button } from "@/components/ui/button"

// หน้าชั่วคราวสำหรับตรวจ P0 — จะถูกแทนที่ด้วย /login และ /dashboard ใน P1
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">ระบบสารบรรณอิเล็กทรอนิกส์</h1>
        <p className="text-muted-foreground">
          โครงร่างเริ่มต้น (P0 — Foundation) · ทดสอบฟอนต์ IBM Plex Sans Thai
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">ตัวอย่างน้ำหนักฟอนต์</p>
        <p className="font-normal">ปกติ 400 — หนังสือภายใน บันทึกข้อความ ๑๒๓๔๕๖๗๘๙๐</p>
        <p className="font-medium">ปานกลาง 500 — ทะเบียนหนังสือส่ง ศธ 0512.1/0451</p>
        <p className="font-semibold">กึ่งหนา 600 — คำสั่งที่ 55/2569</p>
        <p className="font-bold">หนา 700 — ลับที่สุด</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button>สร้างหนังสือ</Button>
        <Button variant="secondary">บันทึกร่าง</Button>
        <Button variant="outline">ตีกลับให้แก้ไข</Button>
        <Button variant="destructive">ยกเลิก</Button>
      </div>
    </main>
  )
}
