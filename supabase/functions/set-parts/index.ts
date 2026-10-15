// Admin-only: the inventory of a set from the Rebrickable API, for selling a set as loose parts.
// Parts, colours and minifigs our catalog doesn't have yet (brand-new ones) are added to it, so listings
// can reference them. Minifigs aren't split into parts — they become minifig listings.
//
// POST { "num": "10362" }  →  { set: { num, name },
//   parts: [{ part_num, name, color_id, color_name, color_rgb, color_trans, img_url, category, element_id, quantity, spare_quantity }],
//   minifigs: [{ fig_num, name, img_url, quantity }] }
// Secret: REBRICKABLE_API_KEY

import { createClient } from 'npm:@supabase/supabase-js@2';

const API = 'https://rebrickable.com/api/v3/lego';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RbInventoryPart = {
  part: { part_num: string; name: string; part_cat_id: number | null; part_img_url: string | null };
  color: { id: number; name: string; rgb: string; is_trans: boolean };
  quantity: number;
  is_spare: boolean;
  /** LEGO element ID of this part in this set (as printed in the instructions) */
  element_id: string | null;
};
type RbSetMinifig = { set_num: string; set_name: string; quantity: number; set_img_url: string | null };
type RbPage<T> = { next: string | null; results: T[] };

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function rebrickable<T>(url: string): Promise<T | null> {
  const key = Deno.env.get('REBRICKABLE_API_KEY');
  if (!key) throw new HttpError(500, 'REBRICKABLE_API_KEY не е настроен.');
  const res = await fetch(url, { headers: { Authorization: `key ${key}`, Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (res.status === 429) throw new HttpError(429, 'Rebrickable ограничи заявките. Опитайте след минута.');
  if (res.status === 401 || res.status === 403) throw new HttpError(500, 'Невалиден Rebrickable API ключ.');
  if (!res.ok) throw new HttpError(502, `Rebrickable върна грешка ${res.status}.`);
  return (await res.json()) as T;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: isAdmin } = await caller.rpc('is_admin');
    if (!isAdmin) return json({ error: 'Forbidden' }, 403);

    const { num } = (await req.json()) as { num?: string };
    const term = (num ?? '').trim();
    if (!/^\d{3,7}(-\d+)?$/.test(term)) return json({ error: 'Невалиден номер на сет.' }, 400);
    const setNum = term.includes('-') ? term : `${term}-1`;

    const set = await rebrickable<{ set_num: string; name: string }>(`${API}/sets/${encodeURIComponent(setNum)}/`);
    if (!set) return json({ error: `Няма сет ${setNum} в Rebrickable.` }, 404);

    const inventory: RbInventoryPart[] = [];
    let next: string | null = `${API}/sets/${encodeURIComponent(setNum)}/parts/?page_size=1000`;
    while (next) {
      const page: RbPage<RbInventoryPart> | null = await rebrickable<RbPage<RbInventoryPart>>(next);
      inventory.push(...(page?.results ?? []));
      next = page?.next ?? null;
    }
    const figPage = await rebrickable<RbPage<RbSetMinifig>>(`${API}/sets/${encodeURIComponent(setNum)}/minifigs/?page_size=200`);
    const figs = figPage?.results ?? [];
    if (!inventory.length && !figs.length) return json({ error: `Rebrickable няма инвентар за ${setNum}.` }, 404);

    // Add what the catalog lacks; existing rows are left alone
    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: categories } = await db.from('part_categories').select('id, name');
    const categoryName = new Map((categories ?? []).map((c) => [c.id as number, c.name as string]));
    const unique = <T>(rows: T[], key: (row: T) => string) => [...new Map(rows.map((r) => [key(r), r])).values()];

    const colors = unique(inventory.map((i) => i.color), (c) => String(c.id));
    const { error: colorError } = await db
      .from('colors')
      .upsert(colors.map(({ id, name, rgb, is_trans }) => ({ id, name, rgb, is_trans })), { onConflict: 'id', ignoreDuplicates: true });
    if (colorError) throw colorError;

    const parts = unique(inventory.map((i) => i.part), (p) => p.part_num);
    const { error: partError } = await db.from('parts').upsert(
      parts.map((p) => ({
        part_num: p.part_num,
        name: p.name,
        part_cat_id: p.part_cat_id != null && categoryName.has(p.part_cat_id) ? p.part_cat_id : null,
        img_url: p.part_img_url,
      })),
      { onConflict: 'part_num', ignoreDuplicates: true },
    );
    if (partError) throw partError;

    const { error: pcError } = await db.from('part_colors').upsert(
      unique(inventory, (i) => `${i.part.part_num}|${i.color.id}`).map((i) => ({
        part_num: i.part.part_num,
        color_id: i.color.id,
        img_url: i.part.part_img_url,
      })),
      { onConflict: 'part_num,color_id', ignoreDuplicates: true },
    );
    if (pcError) throw pcError;

    if (figs.length) {
      // num_parts isn't in this endpoint; the weekly CSV sync fills it in
      const { error: figError } = await db.from('minifigs').upsert(
        unique(figs, (f) => f.set_num).map((f) => ({ fig_num: f.set_num, name: f.set_name, img_url: f.set_img_url })),
        { onConflict: 'fig_num', ignoreDuplicates: true },
      );
      if (figError) throw figError;
    }
    const minifigs = new Map<string, { fig_num: string; name: string; img_url: string | null; quantity: number }>();
    for (const f of figs) {
      const fig = minifigs.get(f.set_num) ?? { fig_num: f.set_num, name: f.set_name, img_url: f.set_img_url, quantity: 0 };
      fig.quantity += f.quantity;
      minifigs.set(f.set_num, fig);
    }

    // One row per part + colour; spares counted separately so they can be left out
    const rows = new Map<string, Record<string, unknown> & { quantity: number; spare_quantity: number }>();
    for (const i of inventory) {
      const key = `${i.part.part_num}|${i.color.id}`;
      const row = rows.get(key) ?? {
        part_num: i.part.part_num,
        name: i.part.name,
        color_id: i.color.id,
        color_name: i.color.name,
        color_rgb: i.color.rgb,
        color_trans: i.color.is_trans,
        img_url: i.part.part_img_url,
        category: i.part.part_cat_id != null ? (categoryName.get(i.part.part_cat_id) ?? null) : null,
        element_id: i.element_id,
        quantity: 0,
        spare_quantity: 0,
      };
      row.element_id ??= i.element_id;
      if (i.is_spare) row.spare_quantity += i.quantity;
      else row.quantity += i.quantity;
      rows.set(key, row);
    }

    return json({ set: { num: set.set_num, name: set.name }, parts: [...rows.values()], minifigs: [...minifigs.values()] });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
