import fs from 'fs';
import { VklassClient } from '../lib/client.js';
import * as config from '../config.js';
import path from 'path';
import crypto from 'crypto';

export async function run(args: string[] = []) {
  const cfg = (config as any).load();
  const client = new VklassClient();
  client.loadSession();
  if (!Object.keys(client.cookies || {}).length) await client.login();

  let items = [];
  try {
    items = await client.getAllNews();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
  const newsDir = cfg.newsDir || path.join((config as any).baseDir, 'news');
  const attachmentsDir = cfg.attachmentsDir || path.join((config as any).baseDir, 'attachments');
  if (!fs.existsSync(attachmentsDir)) fs.mkdirSync(attachmentsDir, { recursive: true });
  if (!fs.existsSync(newsDir)) fs.mkdirSync(newsDir, { recursive: true });

  // Helper: sanitize id to safe filename
  function sanitizeId(id: string) {
    return String(id).replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 64);
  }

  function shortHash(obj: any) {
    const h = crypto.createHash('sha1');
    h.update(JSON.stringify(obj));
    return h.digest('hex').slice(0, 12);
  }

  // Download attachments (skip if already present)
  let downloaded = 0;
  for (const item of items) {
    const files = item.files || item.attachments || [];
    for (const f of files) {
      try {
        const url = f.url || f.fileUrl || f.path;
        if (!url) continue;
        // Prefer `fileName` (globally unique in Vklass infra), fall back to other fields
        const name = f.fileName || f.nameWithExtension || f.name || (f.id ? `${f.id}${f.extension?'.'+f.extension:''}` : null) || path.basename(new URL(url).pathname);
        if (!name) continue;
        const target = path.join(attachmentsDir, name);
        if (fs.existsSync(target)) continue;
        const resp = await client.fetchWithCookies(url, { method: 'GET' });
        if (!resp.ok) continue;
        const ab = await resp.arrayBuffer();
        const buf = Buffer.from(ab);
        fs.writeFileSync(target, buf);
        downloaded++;
      } catch (e) {
        // ignore individual download errors
      }
    }
  }

  // Persist each news item as a separate file: YYYY-MM-DD-<id>.json
  let written = 0;
  let updated = 0;
  const writtenFiles: string[] = [];
  const updatedFiles: string[] = [];
  for (const item of items) {
    // determine id
    const id = item.fileName || item.id || item.articleId || item.guid || item.uuid || shortHash(item);
    // determine publish date
    const dateStrRaw = item.publishDate || item.publishedAt || item.createdAt || item.date || item.publish_date || null;
    let d: Date;
    if (dateStrRaw) {
      d = new Date(dateStrRaw);
      if (isNaN(d.getTime())) d = new Date();
    } else {
      d = new Date();
    }
    const dateStr = d.toISOString().slice(0,10);
    const safeId = sanitizeId(id || shortHash(item));
    const filename = `${dateStr}-${safeId}.json`;
    const target = path.join(newsDir, filename);

    const content = JSON.stringify(item, null, 2);
    if (fs.existsSync(target)) {
      try {
        const existing = fs.readFileSync(target, 'utf8');
        if (existing === content) continue; // unchanged
        // write updated content atomically
        const tmp = target + `.tmp-${process.pid}`;
        fs.writeFileSync(tmp, content, 'utf8');
        fs.renameSync(tmp, target);
        updated++;
        updatedFiles.push(path.resolve(target));
      } catch (e) {
        // ignore individual write errors
      }
    } else {
      try {
        const tmp = target + `.tmp-${process.pid}`;
        fs.writeFileSync(tmp, content, 'utf8');
        fs.renameSync(tmp, target);
        written++;
        writtenFiles.push(path.resolve(target));
      } catch (e) {
        // ignore individual write errors
      }
    }
  }

  return { ok: true, newsDir: path.resolve(newsDir), written, updated, writtenFiles, updatedFiles, count: items.length, attachmentsDownloaded: downloaded };
}
