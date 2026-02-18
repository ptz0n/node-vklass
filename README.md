# vklass-cli

I've tried asking nicely for API docs for and was told; there is none. So here it is—a small CLI that fetches news and calendar data from a Vklass installation. It automates retrieval of student news, attachments, and calendar events for local processing, backups or integrations.

## Prerequisites

- Node.js >= 18 (uses the global `fetch` implementation)

## Install & run (recommended)

Install the published CLI globally and run it directly:

```bash
npm install -g vklass

# now run the installed binary
vklass init
vklass auth
vklass news
vklass calendar
```

## Developer (from source)

If you're running from the repository, you must build before running the CLI:

```bash
npm install
npm run build

# run the built CLI
node dist/cli.js init
```

## Configuration

Run `vklass init` to create `~/.vklass` and a scaffold `config.json`. Edit `~/.vklass/config.json` to add your `username` and `password` (BankID is not supported). After a successful `vklass auth`, discovered students persisted into `~/.vklass/config.json` as well.

Example `config.json`:

```json
{
  "username": "ERIK1337P",
  "password": "t0ps3cre7"
}
```

## Storage locations

- Config: `~/.vklass/config.json`
- Session: `~/.vklass/session.json` (saved after successful `auth`)
- News: `~/.vklass/news` (per-item JSON files named `YYYY-MM-DD-<id>.json`)
- Attachments: `~/.vklass/attachments`
- Calendar outputs: `~/.vklass/calendar` (timestamped filenames)

## Commands

### init

Create per-user config and directories.

```json
{
  "ok": true,
  "configFile": "/Users/you/.vklass/config.json"
}
```

### auth

Authenticate (scrapes the login form, captures cookies), saves the session to `~/.vklass/session.json`, and discovers students which are persisted into `~/.vklass/config.json`.

```json
{
  "ok": true,
  "students": {
    "1337": "Eva",
    "1338": "Adam"
  }
}
```

### news

Fetch news articles and download attachments. News items are stored as individual JSON files in `~/.vklass/news`.

```json
{
  "ok": true,
  "newsDir": "/Users/you/.vklass/news",
  "written": 3,
  "updated": 1,
  "writtenFiles": ["/Users/you/.vklass/news/2026-01-10-133337.json"],
  "updatedFiles": ["/Users/you/.vklass/news/2026-01-05-123456.json"],
  "count": 4,
  "attachmentsDownloaded": 2
}
```

### calendar

Fetch calendar events for discovered/stored students; saves JSON in `~/.vklass/calendar`.

```json
{
  "output": "/Users/you/.vklass/calendar/2026T1624.json",
  "count": 12
}
```
