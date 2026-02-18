import path from 'path';
import * as config from '../config.js';
import { VklassClient } from '../lib/client.js';
import * as output from '../output.js';

export async function run(args: string[] = []) {
  const cfg = (config as any).load();
  const client = new VklassClient();
  client.loadSession();
  if (!Object.keys((client as any).cookies || {}).length) await client.login();

  // students: prefer config, else auto-discover
  // `cfg.students` may be an array of ids or a mapping id->name
  let students: string[] = [];
  if (Array.isArray(cfg.students)) students = cfg.students.slice();
  else if (cfg.students && typeof cfg.students === 'object') students = Object.keys(cfg.students).slice();
  if (!students || students.length === 0) {
    const discovered = await client.autoDiscoverStudents();
    students = Object.keys(discovered || {});
  }
  if (!students || students.length === 0) throw new Error('No student IDs available');

  const startIso = new Date().toISOString();
  const endIso = new Date(Date.now() + 7*24*3600*1000).toISOString();

  const events = await client.getCalendarEvents(students, startIso, endIso);
  const dir = cfg.calendarDir || path.join((config as any).baseDir, 'calendar');
  const res = (output as any).write({ data: events, dir });
  return { output: res.jsonPath, count: events.length };
}
