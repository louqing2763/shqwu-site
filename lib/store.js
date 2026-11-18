'use strict';
// 內容儲存：data/content.json，原子寫入（先寫暫存檔再 rename），避免寫到一半斷電把檔案弄壞。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'content.json');
const COLLECTIONS = ['projects', 'awards', 'certifications'];

const DEFAULTS = {
  site: { title: '', description: '', url: '' },
  profile: {
    name: '', title: '', tagline: '', bio: '', location: '', timezone: 'Asia/Taipei',
    status: '', email: '', avatar: '', skills: [], links: [],
  },
  projects: [],
  awards: [],
  certifications: [],
};

const ITEM_DEFAULTS = {
  projects: {
    title: '', subtitle: '', slug: '', year: '', role: '', summary: '', description: '',
    tags: [], cover: '', gallery: [], links: [], featured: false, visible: true,
  },
  awards: { title: '', event: '', rank: '', date: '', description: '', image: '', link: '', visible: true },
  certifications: { name: '', issuer: '', date: '', credentialId: '', url: '', image: '', visible: true },
};

function uid() {
  return Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// 只保留已知欄位、型別正確，避免後台送來奇怪的東西寫進檔案。
function clean(schema, input) {
  const out = {};
  for (const [k, def] of Object.entries(schema)) {
    const v = input == null ? undefined : input[k];
    if (Array.isArray(def)) {
      if (!Array.isArray(v)) { out[k] = []; continue; }
      if (k === 'links') {
        out[k] = v
          .filter((l) => l && (l.label || l.url))
          .map((l) => ({ label: String(l.label || '').trim(), url: String(l.url || '').trim() }));
      } else {
        out[k] = v.map((x) => String(x).trim()).filter(Boolean);
      }
    } else if (typeof def === 'boolean') {
      out[k] = v === undefined ? def : Boolean(v);
    } else {
      out[k] = v == null ? def : String(v);
    }
  }
  return out;
}

function normalize(data) {
  const d = data && typeof data === 'object' ? data : {};
  const out = {
    site: clean(DEFAULTS.site, d.site),
    profile: clean(DEFAULTS.profile, d.profile),
  };
  for (const c of COLLECTIONS) {
    out[c] = (Array.isArray(d[c]) ? d[c] : []).map((item) => ({
      id: item && item.id ? String(item.id) : uid(),
      ...clean(ITEM_DEFAULTS[c], item),
    }));
  }
  ensureSlugs(out.projects);
  return out;
}

function ensureSlugs(projects) {
  const seen = new Set();
  for (const p of projects) {
    let base = slugify(p.slug) || slugify(p.subtitle) || slugify(p.title) || p.id;
    let s = base;
    let n = 2;
    while (seen.has(s)) s = `${base}-${n++}`;
    p.slug = s;
    seen.add(s);
  }
}

let cache = null;

function load() {
  if (cache) return cache;
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw new Error(`data/content.json 讀取失敗：${e.message}`);
  }
  cache = normalize(raw);
  return cache;
}

function save(data) {
  const normalized = normalize(data);
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(normalized, null, 2) + '\n');
  fs.renameSync(tmp, DATA_FILE);
  cache = normalized;
  return normalized;
}

// 公開版：拿掉隱藏的項目，給前台與 dist/content.json 用。
function publicView(data) {
  const d = data || load();
  return {
    site: d.site,
    profile: d.profile,
    projects: d.projects.filter((p) => p.visible),
    awards: d.awards.filter((a) => a.visible),
    certifications: d.certifications.filter((c) => c.visible),
  };
}

module.exports = { ROOT, DATA_FILE, COLLECTIONS, ITEM_DEFAULTS, load, save, normalize, publicView, uid, slugify };
