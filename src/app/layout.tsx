import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "الرفيق الأمين",
  description: "مساعدك الذكي لإدارة مصروفاتك ودخلك",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
