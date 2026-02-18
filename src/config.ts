import fs from 'fs';
import os from 'os';
import path from 'path';

const homedir = os.homedir();
export const baseDir = path.join(homedir, '.vklass');
export const configPath = path.join(baseDir, 'config.json');

export function defaultDirs() {
  return {
    calendarDir: path.join(baseDir, 'calendar'),
    attachmentsDir: path.join(baseDir, 'attachments'),
    newsDir: path.join(baseDir, 'news'),
    outputDir: path.join(baseDir, 'news')
  };
}

export function ensure(): void {
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
  const dirs = defaultDirs();
  // Ensure subdirectories exist
  Object.values(dirs).forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

  // Ensure config file exists; create scaffold only when missing or empty
  const scaffold = { username: '', password: '' };
  try {
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify(scaffold, null, 2), 'utf8');
    } else {
      const raw = fs.readFileSync(configPath, 'utf8').trim();
      if (!raw) fs.writeFileSync(configPath, JSON.stringify(scaffold, null, 2), 'utf8');
      // if raw JSON exists, leave it untouched (preserve students and other keys)
    }
  } catch (e) {
    try { fs.writeFileSync(configPath, JSON.stringify(scaffold, null, 2), 'utf8'); } catch (_) {}
  }
}

export function load(): any {
  ensure();
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    // Return runtime config: include hardcoded dirs plus editable credentials from file
    return Object.assign(defaultDirs(), {
      username: '',
      password: ''
    }, cfg);
  } catch (err) {
    return Object.assign(defaultDirs(), { username: '', password: '' });
  }
}

export function save(cfg: any): any {
  ensure();
  const toWrite: any = { username: cfg.username || '', password: cfg.password || '' };
  if (Array.isArray(cfg.students)) toWrite.students = cfg.students;
  else if (cfg.students && typeof cfg.students === 'object') toWrite.students = cfg.students;
  fs.writeFileSync(configPath, JSON.stringify(toWrite, null, 2), 'utf8');
  return Object.assign(defaultDirs(), { username: toWrite.username, password: toWrite.password, students: toWrite.students || [] });
}

export default {
  baseDir,
  configPath,
  defaultDirs,
  ensure,
  load,
  save
};
