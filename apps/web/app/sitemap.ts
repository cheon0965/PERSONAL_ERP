import type { MetadataRoute } from 'next';
import { publicSiteUrl } from '@/shared/seo/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: publicSiteUrl,
      lastModified: new Date('2026-05-04T00:00:00.000Z'),
      changeFrequency: 'weekly',
      priority: 1
    }
  ];
}
