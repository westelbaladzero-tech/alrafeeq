import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'الرفيق',
    short_name: 'الرفيق',
    description: 'الصديق الأمين لإدارة أموالك',
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
