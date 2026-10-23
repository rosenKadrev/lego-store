// After `ng build`: one HTML file per product for sale, dist/.../browser/p/{id}-{slug}/index.html.
// Render serves it at /p/{id}-{slug} (before the SPA rewrite), so search engines and link previews
// (Facebook, Viber) get the product's own title, description, canonical, image and schema.org data
// without running JavaScript. The app then starts as usual and takes over the page.
// Products added after the build fall back to the plain index.html until the next deploy.
// A failure here never fails the build — the shop works without these files.

import { mkdir, readFile, writeFile } from 'node:fs/promises';

const SITE_URL = 'https://tuhlensvyat.com';
const SHOP_NAME = 'ТухленСвят';
const DIST = new URL('../dist/lego-store/browser/', import.meta.url);
const BUCKET = 'listing-images';

// --- copies of src/app/core/models.ts (keep in sync) ---
const CONDITION_LABEL = { new: 'Ново', used: 'Употребявано' };
const BOX_DAMAGED_LABEL = 'Ударена кутия';

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/(?<=[a-z])\p{M}+/gu, '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const isCustomFigNum = (n) => (n ?? '').startsWith('custom-');
const displayItemNum = (n) => (n ?? '').replace(/-1$/, '');

function esc(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

/** The production Supabase URL and publishable key, from src/environments/environment.ts */
async function supabaseConfig() {
  const src = await readFile(new URL('../src/environments/environment.ts', import.meta.url), 'utf8');
  return { url: src.match(/supabaseUrl:\s*'([^']+)'/)[1], key: src.match(/supabaseKey:\s*'([^']+)'/)[1] };
}

async function fetchProducts({ url, key }) {
  const columns = 'id,name,item_num,bl_num,item_type,condition,price,stock,description,color_name,box_damaged,cover_path,catalog_img_url';
  const products = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${url}/rest/v1/catalog_listings?select=${columns}&is_published=eq.true&stock=gt.0&order=id`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
    });
    if (!res.ok) throw new Error(`catalog_listings: ${res.status} ${await res.text()}`);
    const page = await res.json();
    products.push(...page);
    if (page.length < 1000) return products;
  }
}

/** Same title / description / JSON-LD as the product page (src/app/pages/product.ts) */
function productHead(p, imageBase) {
  const url = `${SITE_URL}/p/${p.id}-${slugify(p.name ?? '')}`;
  const num = p.item_type === 'magazine' || isCustomFigNum(p.item_num) ? '' : p.bl_num || displayItemNum(p.item_num);
  const color = p.color_name ? `, ${p.color_name}` : p.box_damaged ? `, ${BOX_DAMAGED_LABEL.toLowerCase()}` : '';
  const condition = CONDITION_LABEL[p.condition];
  const title = `${p.name}${color}${num ? ` (${num})` : ''} — ${condition} | ${SHOP_NAME}`;
  const description = `${p.name}${num ? ` ${num}` : ''} — ${condition.toLowerCase()}, ${p.price} €. Наложен платеж.`;
  const images = [p.cover_path ? `${imageBase}/${p.cover_path}` : null, p.catalog_img_url].filter(Boolean);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    ...(num ? { sku: num, mpn: num } : {}),
    ...(p.item_type !== 'magazine' ? { brand: { '@type': 'Brand', name: 'LEGO' } } : {}),
    image: images,
    description: p.description || `${p.name}${num ? ` ${num}` : ''} — ${condition.toLowerCase()}.`,
    offers: {
      '@type': 'Offer',
      url,
      price: p.price,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      itemCondition: p.condition === 'used' ? 'https://schema.org/UsedCondition' : 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: SHOP_NAME },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'BG',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 14,
        returnMethod: ['https://schema.org/ReturnByMail', 'https://schema.org/ReturnInStore'],
        returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
      },
    },
  };
  return { url, title, description, image: images[0], jsonLd };
}

function render(template, head) {
  const meta = (attr, name, content) => `<meta ${attr}="${name}" content="${esc(content)}">`;
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(head.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, meta('name', 'description', head.description))
    .replace(/<meta property="og:type"[^>]*>/, meta('property', 'og:type', 'product'))
    .replace(/<meta property="og:url"[^>]*>/, meta('property', 'og:url', head.url))
    .replace(/<meta property="og:title"[^>]*>/, meta('property', 'og:title', head.title))
    .replace(/<meta property="og:description"[^>]*>/, meta('property', 'og:description', head.description));
  if (head.image) {
    html = html
      .replace(/<meta property="og:image"[^>]*>/, meta('property', 'og:image', head.image))
      // The product photo isn't the 1200×630 card, so drop its size and alt text
      .replace(/<meta property="og:image:(width|height|alt)"[^>]*>\s*/g, '');
  }
  // Same ids/tags the app's Seo service and Title/Meta update, so nothing is duplicated once it starts
  const ld = JSON.stringify(head.jsonLd).replace(/</g, '\\u003c');
  return html.replace(
    '</head>',
    `<link rel="canonical" href="${esc(head.url)}"><script id="product-jsonld" type="application/ld+json">${ld}</script></head>`,
  );
}

try {
  const config = await supabaseConfig();
  const [template, products] = await Promise.all([readFile(new URL('index.html', DIST), 'utf8'), fetchProducts(config)]);
  const imageBase = `${config.url}/storage/v1/object/public/${BUCKET}`;
  for (const p of products) {
    const head = productHead(p, imageBase);
    const dir = new URL(`p/${p.id}-${slugify(p.name ?? '')}/`, DIST);
    await mkdir(dir, { recursive: true });
    await writeFile(new URL('index.html', dir), render(template, head));
  }
  console.log(`Prerendered ${products.length} product pages.`);
} catch (error) {
  console.warn('Product prerender skipped:', error.message);
}
