import { it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { pathToFileURL } from 'url';

it('output.write writes JSON file', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vklass-out-'));
  try {
    const outMod = await import(pathToFileURL(path.join(process.cwd(), 'dist', 'output.js')).toString());
    const data = { a: 1, b: [1,2,3], c: { nested: true } };
    const res = outMod.write({ data, dir: tmp, filenamePrefix: 'test' });
    expect(fs.existsSync(res.jsonPath)).toBe(true);
    const json = JSON.parse(fs.readFileSync(res.jsonPath, 'utf8'));
    expect(json).toEqual(data);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
