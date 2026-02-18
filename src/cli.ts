#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import * as config from './config.js';
import * as output from './output.js';

async function main(argv: string[]) {
  const cmd = argv[2] || 'help';
  const helpText = `vklass <command>

Usage:

vklass init       setup config file and directories (run once before other commands)
vklass auth       verify credentials, persist session and discover students
vklass news       fetch news items and attachments
vklass calendar   fetch calendar events
`;

  if (cmd === 'init') {
    config.ensure();
    console.log(JSON.stringify({ ok: true, configFile: config.configPath }, null, 2));
    process.exit(0);
  }

  if (cmd === 'auth') {
    const mod = await import('./commands/auth.js');
    const res = await mod.run(argv.slice(3));
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  }


  if (cmd === 'news') {
    const mod = await import('./commands/news.js');
    const res = await mod.run(argv.slice(3));
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  }

  if (cmd === 'calendar') {
    const mod = await import('./commands/calendar.js');
    const res = await mod.run(argv.slice(3));
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  }

  console.log(helpText);

  if (cmd === 'help' || cmd === '-h' || cmd === '--help' || cmd === '-l') {
    process.exit(0);
  }

  process.exit(1);
}

main(process.argv).catch(e=>{ console.error(e); process.exit(2); });
