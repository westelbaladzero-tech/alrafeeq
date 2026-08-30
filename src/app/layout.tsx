import "./globals.css";
import type { Metadata } from "next";

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1a6b4f',
};

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
