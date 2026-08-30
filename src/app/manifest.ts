import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'الرفيق الأمين',
    short_name: 'الرفيق الأمين',
    description: 'رفيقك في كل مالك',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f8fa',
    theme_color: '#1d7a5a',
    lang: 'ar',
    dir: 'rtl',
    icons: [
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
