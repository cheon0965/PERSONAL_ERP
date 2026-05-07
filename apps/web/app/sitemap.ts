import type { MetadataRoute } from 'next';
import { publicSiteUrl } from '@/shared/seo/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${publicSiteUrl}/`,
      lastModified: '2026-05-07',
      changeFrequency: 'weekly',
      priority: 1
    }
  ];
}
