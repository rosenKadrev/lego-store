// Imports the Rebrickable catalog (themes, sets, minifigs, set ↔ minifig links) into Supabase.
// Idempotent: rows are upserted, so it can be re-run with newer CSV dumps.
//
//   node --env-file=.env.local scripts/import-rebrickable.mjs              # uses CSVs in REBRICKABLE_DIR
//   node --env-file=.env.local scripts/import-rebrickable.mjs --download   # fetches the latest dumps first
//
// Env: SUPABASE_URL, SUPABASE_SECRET_KEY, REBRICKABLE_DIR (default: data/rebrickable)
// CSVs from https://rebrickable.com/downloads/ (regenerated daily, public, no API key):
//   themes.csv, sets.csv, minifigs.csv, inventories.csv, inventory_minifigs.csv

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SECRET_KEY, REBRICKABLE_DIR = 'data/rebrickable' } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY');
  process.exit(1);
}

const FILES = ['themes', 'sets', 'minifigs', 'inventories', 'inventory_minifigs'];
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

console.log('Done.');
