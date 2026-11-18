'use strict';
// 靜態輸出：把整個網站產生到 dist/，可以直接丟到 Cloudflare Pages。
const fs = require('node:fs');
const path = require('node:path');
const store = require('./store');
const { renderHome, renderProject, render404 } = require('./render');

const DIST = path.join(store.ROOT, 'dist');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let n = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) n += copyDir(s, d);
    else if (entry.isFile()) { fs.copyFileSync(s, d); n++; }
  }
  return n;
}

function exportSite() {
  const started = Date.now();
  const data = store.publicView(store.load());

  // 先輸出到暫存資料夾，成功後再換掉 dist/，輸出失敗不會留下半套網站。
  const tmp = DIST + '.tmp';
  fs.rmSync(tmp, { recursive: true, force: true });
  const realDist = DIST;
  const writeTo = (rel, content) => {
    const file = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };

  writeTo('index.html', renderHome(data));
  for (const p of data.projects) writeTo(`work/${p.slug}/index.html`, renderProject(data, p.slug));
  writeTo('404.html', render404(data));
  writeTo('content.json', JSON.stringify(data, null, 2));
  writeTo('robots.txt', `User-agent: *\nAllow: /\n${data.site.url ? `Sitemap: ${data.site.url.replace(/\/+$/, '')}/sitemap.xml\n` : ''}`);
  if (data.site.url) {
    const base = data.site.url.replace(/\/+$/, '');
    const urls = ['/', ...data.projects.map((p) => `/work/${p.slug}/`)];
    writeTo(
      'sitemap.xml',
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map((u) => `  <url><loc>${base}${u}</loc></url>`)
        .join('\n')}\n</urlset>\n`
    );
  }
  copyDir(path.join(store.ROOT, 'public'), tmp);
  const images = copyDir(path.join(store.ROOT, 'uploads'), path.join(tmp, 'uploads'));

  fs.rmSync(realDist, { recursive: true, force: true });
  fs.renameSync(tmp, realDist);

  return {
    ok: true,
    dir: 'dist',
    pages: 2 + data.projects.length,
    images,
    ms: Date.now() - started,
    exportedAt: new Date().toISOString(),
  };
}

module.exports = { exportSite, DIST };

if (require.main === module) {
  const r = exportSite();
  console.log(`✓ 已輸出 ${r.pages} 個頁面、${r.images} 張圖片到 ${r.dir}/（${r.ms} ms）`);
}
