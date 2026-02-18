import fs from 'fs';
import path from 'path';
import { URL, URLSearchParams } from 'url';
import * as config from '../config.js';

export class VklassClient {
  uiLoginUrl: string;
  username?: string;
  password?: string;
  sessionFile: string;
  cookies: Record<string, string> = {};

  constructor(opts: any = {}) {
    this.uiLoginUrl = opts.uiLoginUrl || 'https://auth.vklass.se/credentials';
    const cfg = (config as any).load();
    this.username = opts.username || cfg.username;
    this.password = opts.password || cfg.password;
    this.sessionFile = opts.sessionFile || path.join((config as any).baseDir, 'session.json');
    this.cookies = this.loadSession() || {};
  }

  loadSession(): Record<string, string> | null {
    try {
      if (fs.existsSync(this.sessionFile)) {
        const data = fs.readFileSync(this.sessionFile, 'utf8');
        this.cookies = JSON.parse(data) || {};
        return this.cookies;
      }
    } catch (e) {}
    return null;
  }

  saveSession() {
    try { fs.writeFileSync(this.sessionFile, JSON.stringify(this.cookies, null, 2), 'utf8'); } catch (e) {}
  }

  updateCookiesFromResponse(res: Response) {
    const raw = res.headers && (res.headers as any).get ? (res.headers as any).get('set-cookie') : null;
    if (!raw) return;
    const parts = raw.split(/,(?=[^;=]+=)/);
    for (const part of parts) {
      const kv = part.split(';')[0];
      const [k, ...rest] = kv.split('=');
      const v = rest.join('=');
      if (k && v !== undefined) this.cookies[k.trim()] = v.trim();
    }
  }

  cookieHeader() { return Object.entries(this.cookies).map(([k,v])=>`${k}=${v}`).join('; '); }

  async fetchWithCookies(url: string, opts: any = {}) {
    opts.headers = opts.headers || {};
    const cookie = this.cookieHeader();
    if (cookie) opts.headers['Cookie'] = cookie;
    opts.redirect = 'manual';
    const res = await fetch(url, opts as any);
    try { this.updateCookiesFromResponse(res); } catch(e){}
    if (res.status >= 300 && res.status < 400) {
      const location = (res.headers as any).get('location');
      if (location) {
        const redirectUrl = new URL(location, url).toString();
        return this.fetchWithCookies(redirectUrl, { method: 'GET', headers: { ...opts.headers } });
      }
    }
    // Detect HTML login pages even when status is 200. If detected, attempt one auto-retry login and re-request.
    try {
      const ct = (res.headers && (res.headers as any).get ? (res.headers as any).get('content-type') : '') || '';
      const isHtml = /html/i.test(ct) || /text\//i.test(ct);
      const isLoginUrl = url && String(url).includes(this.uiLoginUrl);
      if (!opts._skipLoginDetect && !opts._retried && !isLoginUrl && isHtml) {
        const clone = res.clone();
        const preview = await clone.text().catch(()=>'');
        const looksLikeLogin = /login[^>]*form/i.test(preview) || /name=["']?username/i.test(preview) || /name=["']?password/i.test(preview) || /credentials/i.test(preview);
        if (looksLikeLogin) {
          // attempt login once
          try {
            await this.login();
            // persist session after successful automatic reauth
            try { if (Object.keys(this.cookies || {}).length > 0) this.saveSession(); } catch (e) {}
          } catch (e) {
            // login failed; return original response
            return res;
          }
          // retry original request with flags to avoid loops
          return this.fetchWithCookies(url, { ...opts, _retried: true, _skipLoginDetect: true });
        }
      }
    } catch (e) {}

    return res;
  }

  parseForm(html: string) {
    const formMatch = html.match(/<form[^>]*action=["']?([^"' >]+)["']?[^>]*>([\s\S]*?)<\/form>/i);
    if (!formMatch) return null;
    const action = formMatch[1];
    const inner = formMatch[2];
    const inputs: Record<string,string> = {};
    const inputRe = /<input[^>]*name=["']?([^"' >]+)["']?[^>]*value=["']?([^"' >]*)["']?[^>]*>/gi;
    let m: RegExpExecArray | null; while ((m = inputRe.exec(inner)) !== null) inputs[m[1]] = m[2] || '';
    const textareaRe = /<textarea[^>]*name=["']?([^"' >]+)["']?[^>]*>([\s\S]*?)<\/textarea>/gi;
    while ((m = textareaRe.exec(inner)) !== null) inputs[m[1]] = m[2] || '';
    return { action, method: (formMatch[0].match(/method=["']?([^"' >]+)/i) || [])[1] || 'GET', inputs };
  }

  async login() {
    if (!this.username || !this.password) throw new Error('Missing username/password in ~/.vklass/config.json');
    const res = await this.fetchWithCookies(this.uiLoginUrl, { method: 'GET' });
    const html = await res.text();
    const form = this.parseForm(html);
    if (!form) throw new Error('Login form not found');
    let pwd = Object.keys(form.inputs).find((n:any)=>/pass(word)?/i.test(n)) || 'password';
    let usr = Object.keys(form.inputs).find((n:any)=>/(user(name)?|email|login)/i.test(n)) || 'username';
    const params: any = { ...form.inputs };
    params[usr] = this.username; params[pwd] = this.password;
    const actionUrl = new URL(form.action, this.uiLoginUrl).toString();
    const body = new URLSearchParams(params).toString();
    const submitRes = await this.fetchWithCookies(actionUrl, { method: form.method.toUpperCase()==='GET'?'GET':'POST', headers:{'Content-Type':'application/x-www-form-urlencoded','Referer':this.uiLoginUrl}, body: form.method.toUpperCase()==='GET'?undefined:body });
    const hasCookies = Object.keys(this.cookies).length>0;
    if (!hasCookies) { const txt = await submitRes.text().catch(()=>'' as any); throw new Error('Login failed; no session cookie. Preview: '+String(txt).slice(0,200)); }
    // Do not persist session here; caller should verify and save the session when appropriate
    return true;
  }

  async getNewsFeed(pageToken: string | null = null) {
    const url = pageToken
      ? `https://custodian.vklass.se/Home/NewsArticles?pageToken=${pageToken}`
      : 'https://custodian.vklass.se/Home/NewsArticles';
    const res = await this.fetchWithCookies(url, {method:'GET'});
    const ct = (res.headers && (res.headers as any).get ? (res.headers as any).get('content-type') : '') || '';
    if (!res.ok) {
      const preview = await res.text().catch(()=>'');
      throw new Error(`News feed fetch failed (${res.status}). Preview: ${String(preview).slice(0,200)}`);
    }
    if (!/application\/json/i.test(ct)) {
      const preview = await res.text().catch(()=>'');
      throw new Error('Expected JSON response from news endpoint. Preview: '+String(preview).slice(0,200));
    }
    return res.json();
  }

  async getAllNews() {
    const allItems: any[] = [];
    let pageToken: string | null = null;
    do {
      const data = await this.getNewsFeed(pageToken);
      const items = data.items || [];
      allItems.push(...items);
      pageToken = data.nextPageToken;
    } while (pageToken);
    return allItems;
  }

  async getCalendarEvents(studentIds: string[], startIso: string, endIso: string) {
    const body = new URLSearchParams({ students: studentIds.join(','), start: startIso, end: endIso }).toString();
    const res = await this.fetchWithCookies('https://custodian.vklass.se/Events/FullCalendar', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    if (!res.ok) {
      const preview = await res.text().catch(()=> '');
      throw new Error(`Calendar fetch failed (${res.status}). Preview: ${String(preview).slice(0,200)}`);
    }
    return res.json();
  }

  async autoDiscoverStudentIds() {
    const res = await this.fetchWithCookies('https://custodian.vklass.se/Home/Welcome/');
    const html = await res.text();
    const ids = new Set<string>();
    const pattern = /studentIds?=([0-9,]+)/gi;
    for (const match of html.matchAll(pattern)) {
      match[1].split(',').map(id=>id.trim()).filter(id=>id.length>=6).forEach(id=>ids.add(id));
    }
    return Array.from(ids).sort();
  }

  async autoDiscoverStudents() {
    const res = await this.fetchWithCookies('https://custodian.vklass.se/Home/Welcome/');
    const html = await res.text();
    const map: Record<string,string> = {};

    // collect raw ids first
    const idSet = new Set<string>();
    const idPattern = /studentIds?=([0-9,]+)/gi;
    for (const match of html.matchAll(idPattern)) {
      match[1].split(',').map(id=>id.trim()).filter(id=>id.length>=6).forEach(id=>idSet.add(id));
    }

    // 1) try to find <option value="id">Name</option>
    const optionRe = /<option[^>]*value=["']?(\d+)["']?[^>]*>([^<]+)<\/option>/gi;
    let m: RegExpExecArray | null;
    while ((m = optionRe.exec(html)) !== null) {
      const id = m[1]; const name = (m[2] || '').trim(); if (id && name) { map[id] = name; idSet.add(id); }
    }

    // 2) try data-student-id attributes: <... data-student-id="id">Name</...
    const dataRe = /data-student-id=["']?(\d+)["']?[^>]*>([^<]+)</gi;
    while ((m = dataRe.exec(html)) !== null) {
      const id = m[1]; const name = (m[2] || '').trim(); if (id && name) { if (!map[id]) map[id] = name; idSet.add(id); }
    }

    // 1b) anchors with studentIds in href — map each id to nearest preceding <h2> text when possible
    try {
      const anchorRe = /<a[^>]+href=["'][^"']*studentIds=([0-9,]+)[^"']*["'][^>]*>[\s\S]*?<\/a>/gi;
      let am: RegExpExecArray | null;
      const h2Re = /<h2[^>]*>([^<]+)<\/h2>/gi;
      while ((am = anchorRe.exec(html)) !== null) {
        const idsStr = am[1] || '';
        const anchorIdx = am.index;
        // find last h2 before this anchor
        let lastH2: string | null = null;
        let h: RegExpExecArray | null;
        h2Re.lastIndex = 0;
        while ((h = h2Re.exec(html)) !== null) {
          if (h.index < anchorIdx) lastH2 = (h[1] || '').trim();
          else break;
        }
        for (const id of idsStr.split(',').map(s=>s.trim()).filter(Boolean)) {
          if (!map[id] && lastH2) map[id] = lastH2;
          idSet.add(id);
        }
      }
    } catch (e) {}

    // 3) for any remaining ids, try to find nearby text nodes
    for (const id of Array.from(idSet)) {
      if (map[id]) continue;
      // 3a) tag containing the id with inner text, e.g. <option value="id">Name</option>
      try {
        const tagRe = new RegExp(`<([a-zA-Z0-9]+)[^>]*?(?:value|data-student-id|data-id|href)=[\"']?[^\"'>]*${id}[^\"'>]*[\"']?[^>]*>([^<]{1,120})<\/\\1>`, 'i');
        const tagMatch = html.match(tagRe);
        if (tagMatch && tagMatch[2]) { map[id] = tagMatch[2].trim(); continue; }
      } catch (e) {}

      // 3b) anchor with href containing id
      try {
        const aRe = new RegExp(`<a[^>]+href=[\"'][^\"']*${id}[^\"']*[\"'][^>]*>([^<]{1,120})<\/a>`, 'i');
        const aMatch = html.match(aRe);
        if (aMatch && aMatch[1]) { map[id] = aMatch[1].trim(); continue; }
      } catch (e) {}

      // 3c) nearby text heuristic: find occurrence and take nearest text node
      try {
        const idx = html.indexOf(id);
        if (idx !== -1) {
          const windowStart = Math.max(0, idx - 120);
          const windowEnd = Math.min(html.length, idx + 120);
          const window = html.slice(windowStart, windowEnd);
          // find the nearest '>' before id and next '<' after id within window
          const relIdx = idx - windowStart;
          const before = window.lastIndexOf('>', relIdx);
          const after = window.indexOf('<', relIdx);
          if (before !== -1 && after !== -1 && after > before) {
            const txt = window.slice(before + 1, after).trim();
            if (txt && /[A-Za-zÅÄÖåäö]/.test(txt) && !/^\d+$/.test(txt) && txt.length < 120) { map[id] = txt; continue; }
          }
        }
      } catch (e) {}

      // 3d) title/alt attributes near the id
      try {
        const attrRe = new RegExp(id + "[\s\S]{0,100}?(?:alt|title)=[\"']([^\"']{1,80})[\"']", 'i');
        const r2 = html.match(attrRe);
        if (r2 && r2[1]) { map[id] = r2[1].trim(); continue; }
      } catch (e) {}
    }

    // fallback: ensure at least id->id mapping
    for (const id of Array.from(idSet)) {
      if (!map[id]) map[id] = id;
    }

    return map;
  }
}

export default VklassClient;
