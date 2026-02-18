import * as config from '../config.js';
import { VklassClient } from '../lib/client.js';

export async function run(args: string[] = []) {
  const cfg = (config as any).load();
  const client = new VklassClient();
  try {
    // Prime the client by fetching the root; client will auto-retry login internally if needed
    await client.fetchWithCookies('https://custodian.vklass.se/');
  } catch (err) {
    return { ok: false, error: String(err) };
  }

  let students: any = [];
  // Try to auto-discover students first — presence of student IDs implies a valid session
  try { students = await client.autoDiscoverStudents(); } catch (e) { students = []; }

  // verify authenticated session by fetching a known page (fallback)
  let loggedIn = false;
  let checkStatus: number | null = null;
  let checkPreview: string | null = null;
  try {
    const check = await client.fetchWithCookies('https://custodian.vklass.se/');
    checkStatus = check.status;
    const txt = await check.text().catch(()=>'');
    checkPreview = String(txt).slice(0, 600);
    if (check.status === 200 && !/login[^>]*form/i.test(txt)) loggedIn = true;
  } catch (e) {}

  // If we discovered students (array or mapping), treat that as authenticated
  if ((Array.isArray(students) && students.length > 0) || (students && typeof students === 'object' && Object.keys(students).length > 0)) loggedIn = true;

  try {
    const cfg2 = (config as any).load();
    // Persist discovered students (mapping or array)
    cfg2.students = students;
    (config as any).save(cfg2);
    // Persist session only if login verification succeeded
    if (loggedIn) {
      try { client.saveSession(); } catch (e) {}
    }
  } catch (e) {}

  if (!loggedIn) {
    return { ok: false, error: 'Not authenticated (login failed or session invalid)', students } as any;
  }
  return { ok: true, students };
}
