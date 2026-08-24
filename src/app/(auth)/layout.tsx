// เลย์เอาต์ของหน้าที่ยังไม่ได้ล็อกอิน (login / register / forgot-password)
// แผงซ้ายเป็นพื้นที่แบรนด์ · แผงขวาเป็นฟอร์ม — ตาม project-ui/Login.dc.html
// ชิ้นส่วนของแต่ละแผงอยู่ที่ src/components/auth/auth-shell.tsx

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <div className="flex min-h-screen flex-col lg:flex-row">{children}</div>
}
