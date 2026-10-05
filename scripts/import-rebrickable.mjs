// Imports the Rebrickable catalog into Supabase:
//   themes, sets, minifigs, set ↔ minifig links, and the standalone parts catalog
//   (part categories, colours, parts, elements, part ↔ colour combinations with photos).
// Idempotent: rows are upserted, so it can be re-run with newer CSV dumps.
//
//   node --env-file=.env.local scripts/import-rebrickable.mjs              # uses CSVs in REBRICKABLE_DIR
//   node --env-file=.env.local scripts/import-rebrickable.mjs --download   # fetches the latest dumps first
//
// Env: SUPABASE_URL, SUPABASE_SECRET_KEY, REBRICKABLE_DIR (default: data/rebrickable)
// CSVs from https://rebrickable.com/downloads/ (regenerated daily, public, no API key):
//   themes, sets, minifigs, inventories, inventory_minifigs,
//   part_categories, colors, parts, elements, inventory_parts (≈130 MB, streamed)

import { createReadStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parse as parseStream } from 'csv-parse';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SECRET_KEY, REBRICKABLE_DIR = 'data/rebrickable' } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY');
  process.exit(1);
}

const FILES = [
  'themes', 'sets', 'minifigs', 'inventories', 'inventory_minifigs',
  'part_categories', 'colors', 'parts', 'elements', 'inventory_parts',
];
const DOWNLOAD_BASE = 'https://cdn.rebrickable.com/media/downloads';

if (process.argv.includes('--download')) {
  mkdirSync(REBRICKABLE_DIR, { recursive: true });
  for (const name of FILES) {
    const res = await fetch(`${DOWNLOAD_BASE}/${name}.csv.gz`);
    if (!res.ok) throw new Error(`Download ${name}: HTTP ${res.status}`);
    const csv = gunzipSync(Buffer.from(await res.arrayBuffer()));
    writeFileSync(join(REBRICKABLE_DIR, `${name}.csv`), csv);
    console.log(`downloaded ${name}.csv (${(csv.length / 1024).toFixed(0)} KB, ${res.headers.get('last-modified')})`);
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const BATCH_SIZE = 1000;

function readCsv(name) {
  return parse(readFileSync(join(REBRICKABLE_DIR, `${name}.csv`)), {
    columns: true,
    skip_empty_lines: true,
  });
}

const toInt = (v) => (v === '' || v == null ? null : Number.parseInt(v, 10));

async function upsert(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`${table} [${i}..${i + batch.length}]: ${error.message}`);
    process.stdout.write(`\r${table}: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }
  process.stdout.write('\n');
}

// Parents first, so the self-referencing FK is satisfied in every batch
function sortThemesParentFirst(themes) {
  const byId = new Map(themes.map((t) => [t.id, t]));
  const depth = (t) => (t.parent_id == null ? 0 : 1 + depth(byId.get(t.parent_id)));
  return [...themes].sort((a, b) => depth(a) - depth(b));
}

const themes = sortThemesParentFirst(
  readCsv('themes').map((r) => ({ id: toInt(r.id), name: r.name, parent_id: toInt(r.parent_id) })),
);

const sets = readCsv('sets').map((r) => ({
  set_num: r.set_num,
  name: r.name,
  year: toInt(r.year),
  theme_id: toInt(r.theme_id),
  num_parts: toInt(r.num_parts) ?? 0,
  img_url: r.img_url || null,
}));

const minifigs = readCsv('minifigs').map((r) => ({
  fig_num: r.fig_num,
  name: r.name,
  num_parts: toInt(r.num_parts) ?? 0,
  img_url: r.img_url || null,
}));

// Latest inventory version per set → its minifigs
const setNums = new Set(sets.map((s) => s.set_num));
const figNums = new Set(minifigs.map((m) => m.fig_num));
const latestInventory = new Map(); // set_num -> { id, version }
for (const r of readCsv('inventories')) {
  if (!setNums.has(r.set_num)) continue; // inventories also exist for minifigs themselves
  const version = toInt(r.version);
  const current = latestInventory.get(r.set_num);
  if (!current || version > current.version) {
    latestInventory.set(r.set_num, { id: toInt(r.id), version });
  }
}
const inventoryToSet = new Map([...latestInventory].map(([setNum, inv]) => [inv.id, setNum]));

const setMinifigs = new Map(); // `${set_num}|${fig_num}` -> row
for (const r of readCsv('inventory_minifigs')) {
  const setNum = inventoryToSet.get(toInt(r.inventory_id));
  if (!setNum || !figNums.has(r.fig_num)) continue;
  const key = `${setNum}|${r.fig_num}`;
  const row = setMinifigs.get(key) ?? { set_num: setNum, fig_num: r.fig_num, quantity: 0 };
  row.quantity += toInt(r.quantity);
  setMinifigs.set(key, row);
}

await upsert('themes', themes, 'id');
await upsert('sets', sets, 'set_num');
await upsert('minifigs', minifigs, 'fig_num');
await upsert('set_minifigs', [...setMinifigs.values()], 'set_num,fig_num');

// ---------------------------------------------------------------------
// Parts catalog
// ---------------------------------------------------------------------

const partCategories = readCsv('part_categories').map((r) => ({ id: toInt(r.id), name: r.name }));
const colors = readCsv('colors').map((r) => ({
  id: toInt(r.id),
  name: r.name,
  rgb: r.rgb,
  is_trans: r.is_trans === 'True' || r.is_trans === 't',
}));
const colorIds = new Set(colors.map((c) => c.id));

// Distinct part + colour from every set inventory, keeping the first photo found.
// inventory_parts is ~1.5M rows, so it is streamed instead of loaded at once.
const partColors = new Map(); // `${part_num}|${color_id}` -> row
const inventoryParts = createReadStream(join(REBRICKABLE_DIR, 'inventory_parts.csv')).pipe(
  parseStream({ columns: true, skip_empty_lines: true }),
);
for await (const r of inventoryParts) {
  const colorId = toInt(r.color_id);
  if (!colorIds.has(colorId)) continue;
  const key = `${r.part_num}|${colorId}`;
  const existing = partColors.get(key);
  if (!existing) partColors.set(key, { part_num: r.part_num, color_id: colorId, img_url: r.img_url || null });
  else if (!existing.img_url && r.img_url) existing.img_url = r.img_url;
}

const partImage = new Map(); // representative photo per part (any colour)
for (const pc of partColors.values()) {
  if (pc.img_url && !partImage.has(pc.part_num)) partImage.set(pc.part_num, pc.img_url);
}

const parts = readCsv('parts').map((r) => ({
  part_num: r.part_num,
  name: r.name,
  part_cat_id: toInt(r.part_cat_id),
  img_url: partImage.get(r.part_num) ?? null,
}));
const partNums = new Set(parts.map((p) => p.part_num));

const elements = readCsv('elements')
  .filter((r) => partNums.has(r.part_num))
  .map((r) => ({ element_id: r.element_id, part_num: r.part_num, color_id: toInt(r.color_id) }));

await upsert('part_categories', partCategories, 'id');
await upsert('colors', colors, 'id');
await upsert('parts', parts, 'part_num');
await upsert('part_colors', [...partColors.values()].filter((pc) => partNums.has(pc.part_num)), 'part_num,color_id');
await upsert('elements', elements, 'element_id');

console.log('Done.');
