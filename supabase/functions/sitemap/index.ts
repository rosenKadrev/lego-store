// sitemap.xml for search engines: the shop's pages plus every product that is for sale right now.
// Served at https://tuhlensvyat.com/sitemap.xml through a rewrite in render.yaml (and listed in robots.txt).
// Public, read-only (verify_jwt = false). Optional SITE_URL (default https://tuhlensvyat.com).

import { createClient } from 'npm:@supabase/supabase-js@2';

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://tuhlensvyat.com').replace(/\/$/, '');

/** Same as slugify() in src/app/core/models.ts — product URLs are /p/{id}-{slug} */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const STATIC_PAGES = [
  '/',
  '/catalog',
  '/catalog?condition=new&type=set',
  '/catalog?condition=used&type=set',
  '/catalog?type=minifig',
  '/catalog?type=part',
  '/catalog?type=magazine',
  '/themes',
  '/info/delivery',
  '/info/returns',
  '/info/terms',
  '/info/privacy',
];

Deno.serve(async () => {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const [{ data: products, error }, { data: stamps }] = await Promise.all([
    db.from('catalog_listings').select('id, name').eq('is_published', true).gt('stock', 0).order('id'),
    db.from('listings').select('id, updated_at').eq('is_published', true).gt('stock', 0),
  ]);
  if (error) return new Response(error.message, { status: 500 });

  const updated = new Map((stamps ?? []).map((s) => [s.id as number, (s.updated_at as string).slice(0, 10)]));
  const url = (loc: string, lastmod?: string) =>
    `  <url><loc>${esc(SITE_URL + loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...STATIC_PAGES.map((page) => url(page)),
    ...(products ?? []).map((p) => url(`/p/${p.id}-${slugify(p.name ?? '')}`, updated.get(p.id as number))),
    '</urlset>',
  ].join('\n');

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
});
