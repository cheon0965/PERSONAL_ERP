import type { MetadataRoute } from 'next';
import { publicSiteUrl } from '@/shared/seo/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/']
    },
    sitemap: `${publicSiteUrl}/sitemap.xml`,
    host: publicSiteUrl
  };
}
