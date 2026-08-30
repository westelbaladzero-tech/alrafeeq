import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'الرفيق الأمين',
    short_name: 'الرفيق',
    description: 'رفيقك في كل مالك',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#faf9f6',
    theme_color: '#1a6b4f',
    lang: 'ar',
    dir: 'rtl',
    icons: [
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
