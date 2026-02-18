// Module entrypoint for programmatic usage (ESM)
import { VklassClient } from './lib/client.js';
import * as auth from './commands/auth.js';
import * as news from './commands/news.js';
import * as calendar from './commands/calendar.js';

export { VklassClient };
export const commands = {
  auth: auth.run,
  news: news.run,
  calendar: calendar.run,
  // `fetchNews` kept for backward compatibility and points to the `news` command
  fetchNews: news.run
};
