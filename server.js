'use strict';
// 作品集網站 + 後台 CMS 伺服器。只用 Node.js 內建模組，不需要 npm install。
//
//   node server.js                 → http://localhost:3000（前台）與 /admin（後台）
//   PORT=8080 node server.js       → 換 port
//   ADMIN_PASSWORD=xxx node server.js → 後台與寫入 API 需要登入（帳號任意，密碼為此值）
//   HOST=0.0.0.0 node server.js    → 讓區網其他裝置連得到（預設只有本機）

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const store = require('./lib/store');
const { renderHome, renderProject, render404 } = require('./lib/render');
const { exportSite } = require('./lib/export');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const PASSWORD = process.env.ADMIN_PASSWORD || '';
const AUTO_EXPORT = process.env.AUTO_EXPORT !== '0';

const DIRS = {
  assets: path.join(store.ROOT, 'public', 'assets'),
  uploads: path.join(store.ROOT, 'uploads'),
  admin: path.join(store.ROOT, 'admin'),
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);
const MAX_UPLOAD = 15 * 1024 * 1024;
const MAX_JSON = 2 * 1024 * 1024;

// ---------- 小工具 ----------

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function send(res, status, body, type = 'text/html; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra });
  res.end(body);
}

const json = (res, status, obj) => send(res, status, JSON.stringify(obj), MIME['.json']);

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, '檔案太大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buf = await readBody(req, MAX_JSON);
  try { return JSON.parse(buf.toString('utf8') || '{}'); } catch { throw new HttpError(400, 'JSON 格式錯誤'); }
}

function serveFile(res, root, rel) {
  const file = path.resolve(root, '.' + path.posix.normalize('/' + rel));
  if (!file.startsWith(root + path.sep)) return false; // 擋 ../ 路徑穿越
  let stat;
  try { stat = fs.statSync(file); } catch { return false; }
  if (!stat.isFile()) return false;
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

function authorized(req) {
  if (!PASSWORD) return true;
  const m = /^Basic (.+)$/.exec(req.headers.authorization || '');
  if (!m) return false;
  const pass = Buffer.from(m[1], 'base64').toString().split(':').slice(1).join(':');
  const a = crypto.createHash('sha256').update(pass).digest();
  const b = crypto.createHash('sha256').update(PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

// ---------- 自動輸出（每次修改後延遲 400ms 合併執行） ----------

let exportTimer = null;
let lastExport = null;
function scheduleExport() {
  if (!AUTO_EXPORT) return;
  clearTimeout(exportTimer);
  exportTimer = setTimeout(() => {
    try { lastExport = exportSite(); } catch (e) { console.error('自動輸出失敗：', e); }
  }, 400);
}

function commit(data) {
  const saved = store.save(data);
  scheduleExport();
  return saved;
}

// ---------- REST API ----------

async function api(req, res, parts) {
  const method = req.method;
  const [resource, id, action] = parts;

  if (method !== 'GET' && !authorized(req)) throw new HttpError(401, '需要登入');

  if (resource === 'content' && method === 'GET') return json(res, 200, store.load());

  if (resource === 'status' && method === 'GET') {
    return json(res, 200, { lastExport, autoExport: AUTO_EXPORT, auth: Boolean(PASSWORD) });
  }

  if (resource === 'site' || resource === 'profile') {
    if (method === 'GET') return json(res, 200, store.load()[resource]);
    if (method === 'PUT' || method === 'PATCH') {
      const body = await readJson(req);
      const data = store.load();
      const next = { ...data, [resource]: method === 'PUT' ? body : { ...data[resource], ...body } };
      return json(res, 200, commit(next)[resource]);
    }
  }

  if (store.COLLECTIONS.includes(resource)) {
    const data = store.load();
    const list = data[resource];

    if (!id) {
      if (method === 'GET') return json(res, 200, list);
      if (method === 'POST') {
        const body = await readJson(req);
        const item = { ...body, id: store.uid() };
        const saved = commit({ ...data, [resource]: [item, ...list] });
        return json(res, 201, saved[resource].find((x) => x.id === item.id));
      }
    }

    if (id === 'reorder' && method === 'POST') {
      const { ids } = await readJson(req);
      if (!Array.isArray(ids)) throw new HttpError(400, '需要 ids 陣列');
      const rank = new Map(ids.map((x, i) => [String(x), i]));
      const sorted = [...list].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
      return json(res, 200, commit({ ...data, [resource]: sorted })[resource]);
    }

    if (id && !action) {
      const idx = list.findIndex((x) => x.id === id);
      if (idx < 0) throw new HttpError(404, '找不到這筆資料');
      if (method === 'GET') return json(res, 200, list[idx]);
      if (method === 'PUT' || method === 'PATCH') {
        const body = await readJson(req);
        const merged = method === 'PUT' ? { ...body, id } : { ...list[idx], ...body, id };
        const nextList = list.map((x, i) => (i === idx ? merged : x));
        return json(res, 200, commit({ ...data, [resource]: nextList })[resource][idx]);
      }
      if (method === 'DELETE') {
        commit({ ...data, [resource]: list.filter((x) => x.id !== id) });
        return json(res, 200, { ok: true });
      }
    }
  }

  if (resource === 'uploads' && method === 'POST') {
    const original = decodeURIComponent(String(req.headers['x-filename'] || 'image'));
    const ext = path.extname(original).toLowerCase();
    if (!IMAGE_EXT.has(ext)) throw new HttpError(415, '只接受 png / jpg / webp / gif / avif');
    const buf = await readBody(req, MAX_UPLOAD);
    if (!buf.length) throw new HttpError(400, '空檔案');
    const base = store.slugify(path.basename(original, path.extname(original))) || 'image';
    const name = `${Date.now().toString(36)}-${base}${ext === '.jpeg' ? '.jpg' : ext}`;
    fs.mkdirSync(DIRS.uploads, { recursive: true });
    fs.writeFileSync(path.join(DIRS.uploads, name), buf);
    scheduleExport();
    return json(res, 201, { url: `/uploads/${name}`, bytes: buf.length });
  }

  if (resource === 'export' && method === 'POST') {
    clearTimeout(exportTimer);
    lastExport = exportSite();
    return json(res, 200, lastExport);
  }

  throw new HttpError(404, 'API 不存在');
}

// ---------- 路由 ----------

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { pathname = url.pathname; }

  if (pathname.startsWith('/api/')) {
    return api(req, res, pathname.slice(5).split('/').filter(Boolean));
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!authorized(req)) {
      return send(res, 401, '需要登入', 'text/plain; charset=utf-8', { 'WWW-Authenticate': 'Basic realm="admin"' });
    }
    if (pathname === '/admin') return send(res, 302, '', 'text/plain', { Location: '/admin/' });
    const rel = pathname.slice('/admin/'.length) || 'index.html';
    if (serveFile(res, DIRS.admin, rel)) return;
    return send(res, 404, 'Not found', 'text/plain');
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain');

  const pub = store.publicView(store.load());

  if (pathname === '/' || pathname === '/index.html') return send(res, 200, renderHome(pub));
  if (pathname === '/content.json') return json(res, 200, pub);

  const work = /^\/work\/([^/]+)\/?$/.exec(pathname);
  if (work) {
    if (!pathname.endsWith('/')) return send(res, 301, '', 'text/plain', { Location: pathname + '/' });
    const html = renderProject(pub, work[1]);
    if (html) return send(res, 200, html);
  }

  if (pathname.startsWith('/assets/') && serveFile(res, DIRS.assets, pathname.slice(8))) return;
  if (pathname.startsWith('/uploads/') && serveFile(res, DIRS.uploads, pathname.slice(9))) return;

  return send(res, 404, render404(pub));
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    if (res.headersSent) return res.end();
    const extra = status === 401 ? { 'WWW-Authenticate': 'Basic realm="admin"' } : {};
    send(res, status, JSON.stringify({ error: err.message }), MIME['.json'], extra);
  });
});

if (require.main === module) {
  store.load();
  server.listen(PORT, HOST, () => {
    const host = HOST === '0.0.0.0' ? 'localhost' : HOST;
    console.log(`\n  前台  http://${host}:${PORT}/`);
    console.log(`  後台  http://${host}:${PORT}/admin/`);
    console.log(`  ${PASSWORD ? '後台已設密碼' : '後台未設密碼（只在本機使用沒問題）'} · 自動輸出 ${AUTO_EXPORT ? '開啟' : '關閉'}\n`);
  });
}

module.exports = server;
