import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StudyPortal',
    short_name: 'StudyPortal',
    description: 'Track your study abroad journey',
    start_url: '/home',
    display: 'standalone',
    background_color: '#f0f4ff',
    theme_color: '#2563eb',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
