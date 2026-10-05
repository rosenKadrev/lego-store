// Admin-only: looks up a set or minifig that is missing from our catalog in the Rebrickable API
// and adds it (with its theme chain and minifigs). The bulk catalog comes from the weekly CSV sync;
// this covers brand-new releases in between.
//
// POST { "type": "set" | "minifig", "num": "75192" }
// Secret: REBRICKABLE_API_KEY  (`supabase secrets set REBRICKABLE_API_KEY=...`)

import { createClient } from 'npm:@supabase/supabase-js@2';

const API = 'https://rebrickable.com/api/v3/lego';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type RbSet = { set_num: string; name: string; year: number; theme_id: number; num_parts: number; set_img_url: string | null };
type RbTheme = { id: number; parent_id: number | null; name: string };
type RbMinifig = { set_num: string; name: string; num_parts: number; set_img_url: string | null };
type RbSetMinifig = { set_num: string; set_name: string; quantity: number; set_img_url: string | null };

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function rebrickable<T>(path: string): Promise<T | null> {
  const key = Deno.env.get('REBRICKABLE_API_KEY');
  if (!key) throw new HttpError(500, 'REBRICKABLE_API_KEY не е настроен.');
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `key ${key}`, Accept: 'application/json' } });
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

    // The caller must be the shop admin
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: isAdmin } = await caller.rpc('is_admin');
    if (!isAdmin) return json({ error: 'Forbidden' }, 403);

    const { type, num } = (await req.json()) as { type?: string; num?: string };
    const term = (num ?? '').trim().toLowerCase();
    if ((type !== 'set' && type !== 'minifig') || !/^[\w.-]{2,40}$/.test(term)) {
      return json({ error: 'Невалиден номер.' }, 400);
    }

    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

    if (type === 'minifig') {
      const fig = await rebrickable<RbMinifig>(`/minifigs/${encodeURIComponent(term)}/`);
      if (!fig) return json({ error: 'Няма такава минифигурка в Rebrickable.' }, 404);
      const row = { fig_num: fig.set_num, name: fig.name, num_parts: fig.num_parts ?? 0, img_url: fig.set_img_url };
      const { error } = await db.from('minifigs').upsert(row, { onConflict: 'fig_num' });
      if (error) throw error;
      return json({ item: { type, num: row.fig_num, name: row.name, img_url: row.img_url, year: null, num_parts: row.num_parts, theme_name: null } });
    }

    // Sets: '75192' → '75192-1' (Rebrickable's variant suffix)
    const setNum = term.includes('-') ? term : `${term}-1`;
    const set = await rebrickable<RbSet>(`/sets/${encodeURIComponent(setNum)}/`);
    if (!set) return json({ error: `Няма сет ${setNum} в Rebrickable.` }, 404);

    // Theme chain, parents first (themes.parent_id is a foreign key)
    const chain: RbTheme[] = [];
    let themeId: number | null = set.theme_id;
    while (themeId != null) {
      const { data: existing } = await db.from('themes').select('id').eq('id', themeId).maybeSingle();
      if (existing) break;
      const theme: RbTheme | null = await rebrickable<RbTheme>(`/themes/${themeId}/`);
      if (!theme) break;
      chain.unshift(theme);
      themeId = theme.parent_id;
    }
    if (chain.length) {
      const { error } = await db.from('themes').upsert(chain.map(({ id, name, parent_id }) => ({ id, name, parent_id })));
      if (error) throw error;
    }

    const { error: setError } = await db.from('sets').upsert(
      { set_num: set.set_num, name: set.name, year: set.year, theme_id: set.theme_id, num_parts: set.num_parts ?? 0, img_url: set.set_img_url },
      { onConflict: 'set_num' },
    );
    if (setError) throw setError;

    // Minifigs in the set (num_parts isn't in this endpoint; the next CSV sync fills it in)
    const figs = await rebrickable<{ results: RbSetMinifig[] }>(`/sets/${encodeURIComponent(set.set_num)}/minifigs/?page_size=200`);
    const results = figs?.results ?? [];
    if (results.length) {
      const { error: figError } = await db.from('minifigs').upsert(
        results.map((f) => ({ fig_num: f.set_num, name: f.set_name, img_url: f.set_img_url })),
        { onConflict: 'fig_num', ignoreDuplicates: true },
      );
      if (figError) throw figError;
      const quantities = new Map<string, number>();
      for (const f of results) quantities.set(f.set_num, (quantities.get(f.set_num) ?? 0) + f.quantity);
      const { error: linkError } = await db.from('set_minifigs').upsert(
        [...quantities].map(([fig_num, quantity]) => ({ set_num: set.set_num, fig_num, quantity })),
        { onConflict: 'set_num,fig_num' },
      );
      if (linkError) throw linkError;
    }

    const { data: theme } = await db.from('themes').select('name').eq('id', set.theme_id).maybeSingle();
    return json({
      item: {
        type,
        num: set.set_num,
        name: set.name,
        img_url: set.set_img_url,
        year: set.year,
        num_parts: set.num_parts ?? 0,
        theme_name: theme?.name ?? null,
      },
      minifigs: results.length,
    });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
