import fs from 'fs';
import path from 'path';

export function write(opts: { data: any; dir?: string; filenamePrefix?: string }) {
  const dir = opts.dir || path.join(process.cwd(), '.');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // timestamp with minute precision (UTC) e.g. 2026-02-18T1624
  const now = new Date();
  const yyyy = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const ts = `${yyyy}T${hh}${mm}`;
  const base = ts; // no prefix, filename is timestamp only
  const jsonPath = path.join(dir, `${base}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(opts.data, null, 2), 'utf8');
  return { jsonPath };
}

export default { write };
