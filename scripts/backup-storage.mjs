// Downloads every file of the listing-images bucket (the listings' own photos) for the weekly backup.
//   SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/backup-storage.mjs <outDir>
// Used by .github/workflows/backup.yml; the database dump doesn't contain the files themselves.

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const BUCKET = 'listing-images';
const outDir = process.argv[2];
const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!outDir || !SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Usage: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/backup-storage.mjs <outDir>');
  process.exit(1);
}

const storage = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } }).storage.from(BUCKET);

/** All file paths under `prefix`; folders (one per listing) have no id */
async function listFiles(prefix = '') {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) files.push(full);
      else files.push(...(await listFiles(full)));
    }
    if (data.length < 1000) return files;
  }
}

const files = await listFiles();
let bytes = 0;
for (const file of files) {
  const { data, error } = await storage.download(file);
  if (error) throw new Error(`${file}: ${error.message}`);
  const buffer = Buffer.from(await data.arrayBuffer());
  const target = path.join(outDir, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buffer);
  bytes += buffer.length;
}
console.log(`${files.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
