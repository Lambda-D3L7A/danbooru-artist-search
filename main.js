const { app, BrowserWindow, ipcMain, shell, clipboard, protocol } = require('electron');
const path = require('path');
const fs = require('fs');

const BASE = 'https://danbooru.donmai.us';
const VERSION = '0.1';

// Cloudflare on cdn.donmai.us blocks browser-UA requests from the renderer,
// so images are proxied through this scheme and fetched in the main process.
protocol.registerSchemesAsPrivileged([
  { scheme: 'dimg', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true } },
]);

// Danbooru allows 10 read req/s; stay under it with a global scheduler.
const MIN_INTERVAL_MS = 130; // ~7.7 req/s
let nextSlot = 0;
function rateGate() {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + MIN_INTERVAL_MS;
  const wait = slot - now;
  return wait > 0 ? new Promise((r) => setTimeout(r, wait)) : Promise.resolve();
}

function userAgent() {
  const s = readJson('settings.json', {});
  const who = s.login ? s.login : 'anonymous';
  return `DanbooruArtistSearch/${VERSION} (${who})`;
}

// ---------- local persistence ----------
function storeFile(name) {
  return path.join(app.getPath('userData'), name);
}
function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(storeFile(name), 'utf8'));
  } catch {
    return fallback;
  }
}
function writeJson(name, data) {
  fs.writeFileSync(storeFile(name), JSON.stringify(data, null, 2), 'utf8');
}

// ---------- Danbooru fetch helpers ----------
function authParams() {
  const s = readJson('settings.json', {});
  const p = new URLSearchParams();
  if (s.login && s.apiKey) {
    p.set('login', s.login);
    p.set('api_key', s.apiKey);
  }
  return p;
}

async function dGet(pathname, params, attempt = 0) {
  const qs = new URLSearchParams(params);
  const auth = authParams();
  for (const [k, v] of auth) qs.set(k, v);
  const url = `${BASE}${pathname}?${qs.toString()}`;
  await rateGate();
  const res = await fetch(url, { headers: { 'User-Agent': userAgent() } });
  if (res.status === 429 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    return dGet(pathname, params, attempt + 1);
  }
  if (res.status === 410) {
    throw new Error('已到分页上限（Danbooru 限制深度翻页），请换排序或缩小范围');
  }
  if (res.status === 401) {
    throw new Error('API 凭证无效（401）：请在 ⚙ 设置中改用用户名（非 UID）并填正确 Key，或清空后匿名使用');
  }
  if (!res.ok) {
    throw new Error(`Danbooru ${res.status} ${res.statusText} for ${pathname}`);
  }
  return res.json();
}

// run async tasks with bounded concurrency
async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let i = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        out[idx] = await worker(items[idx], idx);
      } catch (e) {
        out[idx] = { error: String(e) };
      }
    }
  });
  await Promise.all(runners);
  return out;
}

function postTags(post) {
  const f = (s) => (s || '').split(' ').filter(Boolean);
  return {
    rating: post.rating,
    tagsGeneral: f(post.tag_string_general),
    tagsCharacter: f(post.tag_string_character),
    tagsCopyright: f(post.tag_string_copyright),
    tagsArtist: f(post.tag_string_artist),
    tagsMeta: f(post.tag_string_meta),
  };
}

function pickThumb(post) {
  if (post.preview_file_url) return { thumb: post.preview_file_url };
  const variants = post.media_asset && post.media_asset.variants;
  if (Array.isArray(variants)) {
    const v = variants.find((x) => x.type === '360x360') || variants.find((x) => x.type === '180x180');
    if (v) return { thumb: v.url };
  }
  if (post.large_file_url) return { thumb: post.large_file_url };
  return null;
}

async function fetchSamples(artistName, count) {
  // grab a few extra so we can skip posts without a usable thumbnail
  const data = await dGet('/posts.json', {
    tags: `${artistName} order:score`,
    limit: String(count + 6),
  });
  const samples = [];
  for (const post of data) {
    const t = pickThumb(post);
    if (!t) continue;
    samples.push({
      thumb: t.thumb,
      large: post.large_file_url || post.file_url || t.thumb,
      postId: post.id,
      pageUrl: `${BASE}/posts/${post.id}`,
      score: post.score,
      ...postTags(post),
    });
    if (samples.length >= count) break;
  }
  return samples;
}

// ---------- artist list sources ----------
async function listArtistTags({ sort, query, page, perPage }) {
  const params = {
    'search[category]': '1',
    'search[is_deprecated]': 'false',
    'search[order]': sort || 'count',
    limit: String(perPage),
    page: String(page),
  };
  if (query && query.trim()) {
    params['search[name_matches]'] = `*${query.trim().replace(/\s+/g, '_')}*`;
  }
  const tags = await dGet('/tags.json', params);
  return tags.map((t) => ({ name: t.name, postCount: t.post_count }));
}

async function listRandomArtistTags({ perPage }) {
  const randomPage = 1 + Math.floor(Math.random() * 60);
  const tags = await dGet('/tags.json', {
    'search[category]': '1',
    'search[is_deprecated]': 'false',
    'search[order]': 'count',
    limit: String(perPage),
    page: String(randomPage),
  });
  return tags.map((t) => ({ name: t.name, postCount: t.post_count }));
}

async function listRecentArtists({ page }) {
  // scan newest posts; deeper pages reach further back in time
  const posts = await dGet('/posts.json', { limit: '50', page: String(page || 1) });
  const set = new Set();
  const order = [];
  for (const p of posts) {
    for (const a of (p.tag_string_artist || '').split(' ').filter(Boolean)) {
      if (!set.has(a)) {
        set.add(a);
        order.push(a);
      }
    }
  }
  return order.map((name) => ({ name }));
}

async function listArtistsByTheme({ query, page, perPage }) {
  if (!query || !query.trim()) return [];
  const posts = await dGet('/posts.json', {
    tags: query.trim().replace(/\s+/g, '_'),
    limit: '200',
  });
  const counts = new Map();
  for (const p of posts) {
    const artists = (p.tag_string_artist || '').split(' ').filter(Boolean);
    for (const a of artists) counts.set(a, (counts.get(a) || 0) + 1);
  }
  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, themeCount]) => ({ name, themeCount }));
  const start = (page - 1) * perPage;
  return sorted.slice(start, start + perPage);
}

function listImported({ query, page, perPage }) {
  const names = (query || '')
    .split(/[\n,]+/)
    .map((s) => s.trim().replace(/^@/, '').replace(/\s+/g, '_'))
    .filter(Boolean);
  const start = (page - 1) * perPage;
  return names.slice(start, start + perPage).map((name) => ({ name }));
}

async function getAutocomplete(q) {
  if (!q || !q.trim()) return [];
  const data = await dGet('/autocomplete.json', {
    'search[query]': q.trim(),
    'search[type]': 'artist',
    limit: '10',
  });
  return data.map((d) => ({ name: d.value, label: d.label }));
}

async function getArtistPosts({ name, page, limit }) {
  const data = await dGet('/posts.json', {
    tags: name,
    limit: String(limit || 40),
    page: String(page || 1),
  });
  return data.map((post) => {
    const t = pickThumb(post);
    return {
      thumb: t ? t.thumb : null,
      large: post.large_file_url || post.file_url || (t && t.thumb) || null,
      postId: post.id,
      pageUrl: `${BASE}/posts/${post.id}`,
      score: post.score,
      ...postTags(post),
    };
  });
}

async function getArtists(opts) {
  const perPage = opts.perPage || 20;
  const page = opts.page || 1;
  const sampleCount = opts.sampleCount || 4;
  let base;
  switch (opts.source) {
    case 'recent':
      base = await listRecentArtists({ page });
      break;
    case 'random':
      base = await listRandomArtistTags({ perPage });
      break;
    case 'theme':
      base = await listArtistsByTheme({ query: opts.query, page, perPage });
      break;
    case 'import':
      base = listImported({ query: opts.query, page, perPage });
      break;
    case 'search':
    default:
      base = await listArtistTags({ sort: opts.sort, query: opts.query, page, perPage });
      break;
  }
  const withSamples = await pool(base, 5, async (artist) => {
    const samples = await fetchSamples(artist.name, sampleCount);
    return { ...artist, samples };
  });
  return withSamples;
}

async function testAuth(creds) {
  try {
    let login = ((creds && creds.login) || '').trim();
    const apiKey = ((creds && creds.apiKey) || '').trim();
    if (!login || !apiKey) return { ok: false, error: '请先填写用户名和 API Key' };

    // Danbooru's login param is the username, not the numeric UID. Resolve it.
    let resolvedLogin = login;
    let resolvedNote = '';
    if (/^\d+$/.test(login)) {
      await rateGate();
      const ur = await fetch(`${BASE}/users/${login}.json`, { headers: { 'User-Agent': userAgent() } });
      if (ur.ok) {
        const u = await ur.json();
        if (u && u.name) {
          resolvedLogin = u.name;
          resolvedNote = `（UID ${login} → 用户名 ${u.name}）`;
        }
      }
    }

    const qs = new URLSearchParams({ login: resolvedLogin, api_key: apiKey });
    await rateGate();
    const res = await fetch(`${BASE}/profile.json?${qs.toString()}`, { headers: { 'User-Agent': userAgent() } });
    if (res.status === 401) {
      return { ok: false, resolvedLogin, error: `API Key 无效或已失效${resolvedNote}，请到 Danbooru 个人资料页「Generate API key」重新生成` };
    }
    if (!res.ok) return { ok: false, resolvedLogin, error: `HTTP ${res.status} ${res.statusText}` };
    const data = await res.json();
    if (!data.id || data.name === 'Anonymous') {
      return { ok: false, resolvedLogin, error: '未识别为登录用户，请检查用户名/Key' };
    }
    return { ok: true, resolvedLogin: data.name, name: data.name, level: data.level_string || String(data.level), note: resolvedNote };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

// ---------- IPC ----------
ipcMain.handle('danbooru:getArtists', (_e, opts) => getArtists(opts));
ipcMain.handle('danbooru:getArtistPosts', (_e, opts) => getArtistPosts(opts));
ipcMain.handle('danbooru:autocomplete', (_e, q) => getAutocomplete(q));
ipcMain.handle('danbooru:testAuth', (_e, creds) => testAuth(creds));
ipcMain.handle('store:get', (_e, key, fallback) => readJson(`${key}.json`, fallback));
ipcMain.handle('store:set', (_e, key, value) => {
  writeJson(`${key}.json`, value);
  return true;
});
ipcMain.handle('app:openExternal', (_e, url) => shell.openExternal(url));
ipcMain.handle('app:copy', (_e, text) => {
  clipboard.writeText(text);
  return true;
});

// ---------- window ----------
function createWindow() {
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    backgroundColor: '#16181c',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  protocol.handle('dimg', async (req) => {
    try {
      const target = new URL(req.url).searchParams.get('u');
      if (!target) return new Response('missing url', { status: 400 });
      const res = await fetch(target, { headers: { 'User-Agent': userAgent() } });
      return new Response(res.body, {
        status: res.status,
        headers: { 'content-type': res.headers.get('content-type') || 'image/jpeg' },
      });
    } catch (e) {
      return new Response(String(e), { status: 502 });
    }
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
