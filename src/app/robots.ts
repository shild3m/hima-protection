import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/crm/', '/dealer/', '/api/', '/staff-login/'],
      },
    ],
    sitemap: 'https://www.himaprotection.com/sitemap.xml',
  }
}
