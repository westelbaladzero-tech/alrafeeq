import './globals.css';
import type { Metadata } from 'next';
import AuthGate from '@/components/AuthGate';

export const metadata: Metadata = {
  title: 'الرفيق | الصديق الأمين',
  description: 'مساعدك الذكي لإدارة مصروفاتك ودخلك',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
