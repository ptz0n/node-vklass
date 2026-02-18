import { it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { pathToFileURL } from 'url';

it('config ensure/load/save uses HOME-controlled baseDir', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vklass-test-'));
  const originalHome = process.env.HOME;
  process.env.HOME = tmp;
  try {
    const cfgMod = await import(pathToFileURL(path.join(process.cwd(), 'dist', 'config.js')).toString());
    cfgMod.ensure();
    const cfgPath = cfgMod.configPath;
    expect(fs.existsSync(cfgPath)).toBe(true);
    const loaded = cfgMod.load();
    expect(loaded.newsDir).toBeDefined();

    // Only username/password are persisted to config.json; other runtime fields
    // (like dirs) are returned by `load()` but not written to disk.
    loaded.username = 'alice';
    cfgMod.save(loaded);
    const reloaded = cfgMod.load();
    expect(reloaded.username).toBe('alice');
    expect(reloaded.format).toBeUndefined();
  } finally {
    process.env.HOME = originalHome;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
