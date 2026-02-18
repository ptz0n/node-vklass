import { it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';

it('cli init creates per-user config directory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vklass-cli-'));
  const env = { ...process.env, HOME: tmp };
  const node = process.execPath;
  const script = path.join(process.cwd(), 'dist', 'cli.js');
  const res = spawnSync(node, [script, 'init'], { env, encoding: 'utf8' });
  expect(res.status).toBe(0);
  const cfgDir = path.join(tmp, '.vklass');
  expect(fs.existsSync(cfgDir)).toBe(true);
  const cfgPath = path.join(cfgDir, 'config.json');
  expect(fs.existsSync(cfgPath)).toBe(true);
});

