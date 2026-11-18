'use strict';
// 後台 CMS：純原生 JS，不需要任何框架或建置步驟。

// ---------- 欄位定義 ----------
const SCHEMAS = {
  profile: {
    title: '個人資料',
    hint: '首頁 Bento Grid 的內容。',
    fields: [
      { k: 'name', label: '名字 / 品牌名', type: 'text' },
      { k: 'title', label: '職稱', type: 'text', placeholder: 'Software Engineer · Student' },
      { k: 'tagline', label: '一句話介紹', type: 'textarea', rows: 2 },
      { k: 'bio', label: '自我介紹', type: 'textarea', rows: 7, hint: '空一行 = 新段落；「- 」開頭 = 清單' },
      { k: 'avatar', label: '大頭照', type: 'image' },
      { k: 'status', label: '目前狀態', type: 'text', placeholder: 'Open to internships', hint: '留空就不顯示狀態格' },
      { k: 'location', label: '所在地', type: 'text', half: true },
      { k: 'timezone', label: '時區（時鐘用）', type: 'text', placeholder: 'Asia/Taipei', half: true },
      { k: 'email', label: 'Email', type: 'text' },
      { k: 'skills', label: '技術棧', type: 'tags' },
      { k: 'links', label: '社群連結', type: 'links' },
    ],
  },
  site: {
    title: '網站設定',
    hint: 'SEO 與分享預覽用。',
    fields: [
      { k: 'title', label: '網站標題', type: 'text' },
      { k: 'description', label: '網站描述', type: 'textarea', rows: 3 },
      { k: 'url', label: '正式網址', type: 'text', placeholder: 'https://shqwu.com', hint: '用來產生 sitemap.xml 與分享連結' },
    ],
  },
  projects: {
    title: '作品集',
    one: '作品',
    rowTitle: (x) => x.title || '（未命名作品）',
    rowSub: (x) => [x.year, x.tags.slice(0, 3).join(' · ')].filter(Boolean).join('　'),
    thumb: (x) => x.cover,
    flags: [['featured', '精選'], ['visible', '公開']],
    fields: [
      { k: 'title', label: '標題', type: 'text', required: true },
      { k: 'subtitle', label: '英文標題 / 副標', type: 'text' },
      { k: 'year', label: '年份', type: 'text', half: true },
      { k: 'role', label: '角色', type: 'text', half: true },
      { k: 'slug', label: '網址代稱', type: 'text', hint: '作品頁網址 /work/代稱/，留空自動用英文標題產生', mono: true },
      { k: 'summary', label: '一句話摘要', type: 'textarea', rows: 2 },
      { k: 'description', label: '內文', type: 'textarea', rows: 12, hint: '空一行 = 新段落；「- 」開頭 = 清單' },
      { k: 'tags', label: '技術標籤', type: 'tags' },
      { k: 'cover', label: '封面圖', type: 'image' },
      { k: 'gallery', label: '圖庫', type: 'images' },
      { k: 'links', label: '連結（GitHub、Demo…）', type: 'links' },
      { k: 'featured', label: '放在首頁精選格', type: 'bool', half: true },
      { k: 'visible', label: '公開顯示', type: 'bool', half: true },
    ],
  },
  awards: {
    title: '競賽榮譽',
    one: '獎項',
    rowTitle: (x) => x.title || '（未命名獎項）',
    rowSub: (x) => [x.date, x.rank, x.event].filter(Boolean).join('　'),
    thumb: (x) => x.image,
    flags: [['visible', '公開']],
    fields: [
      { k: 'title', label: '競賽名稱', type: 'text', required: true },
      { k: 'event', label: '主辦 / 組別', type: 'text' },
      { k: 'rank', label: '名次', type: 'text', half: true },
      { k: 'date', label: '日期', type: 'text', placeholder: '2026.05', half: true },
      { k: 'description', label: '描述', type: 'textarea', rows: 3 },
      { k: 'link', label: '相關連結', type: 'text' },
      { k: 'image', label: '照片 / 獎狀', type: 'image' },
      { k: 'visible', label: '公開顯示', type: 'bool' },
    ],
  },
  certifications: {
    title: '證照',
    one: '證照',
    rowTitle: (x) => x.name || '（未命名證照）',
    rowSub: (x) => [x.date, x.issuer].filter(Boolean).join('　'),
    thumb: (x) => x.image,
    flags: [['visible', '公開']],
    fields: [
      { k: 'name', label: '證照名稱', type: 'text', required: true },
      { k: 'issuer', label: '發證單位', type: 'text' },
      { k: 'date', label: '取得日期', type: 'text', placeholder: '2026.05', half: true },
      { k: 'credentialId', label: '證號', type: 'text', half: true },
      { k: 'url', label: '驗證連結', type: 'text' },
      { k: 'image', label: '證照圖片', type: 'image' },
      { k: 'visible', label: '公開顯示', type: 'bool' },
    ],
  },
};
const COLLECTIONS = ['projects', 'awards', 'certifications'];

// ---------- 小工具 ----------
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(c));
  return el;
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function toast(msg, kind = 'ok') {
  const el = h('div', { class: `toast toast--${kind}` }, msg);
  document.getElementById('toasts').append(el);
  setTimeout(() => el.classList.add('toast--out'), 2600);
  setTimeout(() => el.remove(), 3000);
}

// 大圖在瀏覽器先縮到 2000px、轉 WebP，網站會快很多。
async function shrink(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const max = 2000;
  if (bmp.width <= max && bmp.height <= max && file.size < 1.2e6) return file;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.86));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
}

async function upload(file) {
  const f = await shrink(file);
  const res = await fetch('/api/uploads', {
    method: 'POST',
    headers: { 'X-Filename': encodeURIComponent(f.name), 'Content-Type': f.type || 'application/octet-stream' },
    body: f,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `上傳失敗 (${res.status})`);
  return data.url;
}

const imageFiles = (list) => [...(list || [])].filter((f) => f.type.startsWith('image/'));

// 拖曳 / 點擊上傳區
function dropzone({ multiple, label, onFiles }) {
  const input = h('input', { type: 'file', accept: 'image/*', multiple, hidden: true });
  const zone = h('div', { class: 'drop', tabindex: 0, role: 'button' },
    h('span', { class: 'drop__icon' }, '↑'),
    h('span', {}, label || '拖曳圖片到這裡，或點擊選擇'),
    input);
  const busy = (on) => zone.classList.toggle('drop--busy', on);
  const take = async (files) => {
    files = imageFiles(files);
    if (!files.length) return;
    busy(true);
    try { await onFiles(files); } catch (e) { toast(e.message, 'err'); } finally { busy(false); }
  };
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', () => { take(input.files); input.value = ''; });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drop--over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drop--over'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drop--over'); take(e.dataTransfer.files); });
  return zone;
}

// ---------- 欄位元件：每個回傳 { el, get } ----------
const FIELD = {
  text(f, v, dirty) {
    const el = h('input', { type: 'text', value: v || '', placeholder: f.placeholder || '', class: f.mono ? 'mono' : '', oninput: dirty });
    return { el, get: () => el.value.trim() };
  },
  textarea(f, v, dirty) {
    const el = h('textarea', { rows: f.rows || 4, placeholder: f.placeholder || '', oninput: dirty });
    el.value = v || '';
    return { el, get: () => el.value.replace(/\s+$/, '') };
  },
  bool(f, v, dirty) {
    const input = h('input', { type: 'checkbox', checked: Boolean(v), onchange: dirty });
    const el = h('label', { class: 'switch' }, input, h('span', { class: 'switch__track' }), h('span', {}, input.checked ? '是' : '否'));
    input.addEventListener('change', () => { el.lastChild.textContent = input.checked ? '是' : '否'; });
    return { el, get: () => input.checked };
  },
  tags(f, v, dirty) {
    let tags = [...(v || [])];
    const list = h('div', { class: 'chips' });
    const input = h('input', { type: 'text', placeholder: '輸入後按 Enter 或逗號新增' });
    const draw = () => {
      list.replaceChildren(...tags.map((t, i) => h('span', { class: 'chip' }, t,
        h('button', { type: 'button', title: '移除', onclick: () => { tags.splice(i, 1); draw(); dirty(); } }, '×'))));
    };
    const add = () => {
      const parts = input.value.split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
      if (!parts.length) return;
      tags.push(...parts.filter((p) => !tags.includes(p)));
      input.value = '';
      draw(); dirty();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
      else if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); draw(); dirty(); }
    });
    input.addEventListener('blur', add);
    draw();
    return { el: h('div', { class: 'tagsfield' }, list, input), get: () => (add(), tags) };
  },
  image(f, v, dirty) {
    let url = v || '';
    const wrap = h('div', { class: 'imagefield' });
    const draw = () => {
      wrap.replaceChildren(
        url
          ? h('div', { class: 'preview' },
              h('img', { src: url, alt: '' }),
              h('div', { class: 'preview__bar' },
                h('code', {}, url),
                h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => { url = ''; draw(); dirty(); } }, '移除')))
          : null,
        dropzone({ label: url ? '拖曳新圖片取代' : undefined, onFiles: async ([file]) => { url = await upload(file); draw(); dirty(); toast('圖片已上傳'); } })
      );
    };
    draw();
    return { el: wrap, get: () => url };
  },
  images(f, v, dirty) {
    let urls = [...(v || [])];
    const wrap = h('div', { class: 'imagesfield' });
    const draw = () => {
      wrap.replaceChildren(
        urls.length
          ? h('div', { class: 'thumbs' }, urls.map((u, i) => h('figure', { class: 'thumb' },
              h('img', { src: u, alt: '' }),
              h('div', { class: 'thumb__bar' },
                h('button', { type: 'button', title: '往前', disabled: i === 0, onclick: () => { [urls[i - 1], urls[i]] = [urls[i], urls[i - 1]]; draw(); dirty(); } }, '←'),
                h('button', { type: 'button', title: '往後', disabled: i === urls.length - 1, onclick: () => { [urls[i + 1], urls[i]] = [urls[i], urls[i + 1]]; draw(); dirty(); } }, '→'),
                h('button', { type: 'button', title: '移除', onclick: () => { urls.splice(i, 1); draw(); dirty(); } }, '×')))))
          : null,
        dropzone({ multiple: true, label: '拖曳多張圖片到這裡，或點擊選擇', onFiles: async (files) => {
          for (const file of files) urls.push(await upload(file));
          draw(); dirty(); toast(`已上傳 ${files.length} 張圖片`);
        } })
      );
    };
    draw();
    return { el: wrap, get: () => urls };
  },
  links(f, v, dirty) {
    let rows = (v || []).map((l) => ({ ...l }));
    const wrap = h('div', { class: 'linksfield' });
    const draw = () => {
      wrap.replaceChildren(
        ...rows.map((r, i) => h('div', { class: 'linkrow' },
          h('input', { type: 'text', value: r.label, placeholder: '名稱（GitHub）', oninput: (e) => { r.label = e.target.value; dirty(); } }),
          h('input', { type: 'text', value: r.url, placeholder: 'https://…', class: 'mono', oninput: (e) => { r.url = e.target.value; dirty(); } }),
          h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => { rows.splice(i, 1); draw(); dirty(); } }, '×'))),
        h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => { rows.push({ label: '', url: '' }); draw(); } }, '＋ 新增連結')
      );
    };
    draw();
    return { el: wrap, get: () => rows.map((r) => ({ label: r.label.trim(), url: r.url.trim() })).filter((r) => r.label || r.url) };
  },
};

function buildForm(schema, values, onDirty) {
  const getters = {};
  const grid = h('div', { class: 'form' });
  for (const f of schema.fields) {
    const { el, get } = FIELD[f.type](f, values[f.k], onDirty);
    getters[f.k] = get;
    grid.append(h('div', { class: `field${f.half ? ' field--half' : ''}` },
      h('label', { class: 'field__label' }, f.label, f.required ? h('span', { class: 'req' }, ' *') : null),
      el,
      f.hint ? h('p', { class: 'field__hint' }, f.hint) : null));
  }
  const read = () => Object.fromEntries(Object.entries(getters).map(([k, g]) => [k, g()]));
  return { el: grid, read };
}

// ---------- 狀態與畫面 ----------
const state = { content: null, view: 'profile', editing: null, dirty: false };
const main = document.getElementById('main');

function setDirty(v) {
  state.dirty = v;
  document.body.classList.toggle('is-dirty', v);
}
window.addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });

function confirmLeave() {
  return !state.dirty || confirm('有尚未儲存的修改，確定要離開？');
}

function go(view, editing = null) {
  if (!confirmLeave()) return;
  state.view = view;
  state.editing = editing;
  setDirty(false);
  location.hash = editing ? `${view}/${editing === 'new' ? 'new' : editing}` : view;
  render();
}

function render() {
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
  main.scrollTop = 0;
  if (state.view === 'profile' || state.view === 'site') return renderSingle(state.view);
  if (state.editing) return renderEditor(state.view, state.editing);
  return renderList(state.view);
}

function header(title, hint, ...actions) {
  return h('header', { class: 'head' },
    h('div', {}, h('h1', {}, title), hint ? h('p', { class: 'head__hint' }, hint) : null),
    h('div', { class: 'head__actions' }, ...actions));
}

function renderSingle(key) {
  const schema = SCHEMAS[key];
  const form = buildForm(schema, state.content[key], () => setDirty(true));
  const save = h('button', { class: 'btn', onclick: async () => {
    save.disabled = true;
    try {
      state.content[key] = await api('PUT', `/api/${key}`, form.read());
      setDirty(false);
      toast('已儲存');
      refreshStatus();
    } catch (e) { toast(e.message, 'err'); } finally { save.disabled = false; }
  } }, '儲存');
  main.replaceChildren(header(schema.title, schema.hint, save), h('div', { class: 'card' }, form.el));
}

function renderList(col) {
  const schema = SCHEMAS[col];
  const items = state.content[col];

  const persistOrder = async () => {
    try {
      state.content[col] = await api('POST', `/api/${col}/reorder`, { ids: items.map((x) => x.id) });
      refreshStatus();
    } catch (e) { toast(e.message, 'err'); }
    renderList(col);
  };
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    persistOrder();
  };

  let dragFrom = null;
  const rows = items.map((x, i) =>
    h('li', {
      class: `item${x.visible ? '' : ' item--hidden'}`, draggable: true,
      ondragstart: (e) => { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('item--drag'); },
      ondragend: (e) => e.currentTarget.classList.remove('item--drag'),
      ondragover: (e) => { if (dragFrom != null) { e.preventDefault(); e.currentTarget.classList.add('item--target'); } },
      ondragleave: (e) => e.currentTarget.classList.remove('item--target'),
      ondrop: (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('item--target');
        if (dragFrom == null || dragFrom === i) return;
        const [moved] = items.splice(dragFrom, 1);
        items.splice(i, 0, moved);
        dragFrom = null;
        persistOrder();
      },
    },
      h('span', { class: 'item__grip', title: '拖曳排序' }, '⋮⋮'),
      h('div', { class: 'item__thumb' }, schema.thumb(x) ? h('img', { src: schema.thumb(x), alt: '' }) : h('span', {}, String(i + 1).padStart(2, '0'))),
      h('button', { class: 'item__main', onclick: () => go(col, x.id) },
        h('strong', {}, schema.rowTitle(x)),
        h('span', {}, schema.rowSub(x) || '—')),
      h('div', { class: 'item__flags' }, schema.flags.map(([k, label]) =>
        h('button', {
          class: `flag${x[k] ? ' flag--on' : ''}`, title: `切換「${label}」`,
          onclick: async () => {
            try {
              const updated = await api('PATCH', `/api/${col}/${x.id}`, { [k]: !x[k] });
              Object.assign(x, updated);
              renderList(col);
              refreshStatus();
            } catch (e) { toast(e.message, 'err'); }
          },
        }, label))),
      h('div', { class: 'item__order' },
        h('button', { title: '上移', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
        h('button', { title: '下移', disabled: i === items.length - 1, onclick: () => move(i, 1) }, '↓'))));

  main.replaceChildren(
    header(schema.title, `${items.length} 筆 · 拖曳或用箭頭排序，順序就是網站上的順序`,
      h('button', { class: 'btn', onclick: () => go(col, 'new') }, `＋ 新增${schema.one}`)),
    items.length ? h('ul', { class: 'list' }, rows) : h('div', { class: 'empty' }, `還沒有${schema.one}，按右上角新增第一筆。`)
  );
}

function renderEditor(col, id) {
  const schema = SCHEMAS[col];
  const isNew = id === 'new';
  const item = isNew ? { visible: true } : state.content[col].find((x) => x.id === id);
  if (!item) { state.editing = null; return renderList(col); }

  const form = buildForm(schema, item, () => setDirty(true));
  const required = schema.fields.filter((f) => f.required).map((f) => f.k);

  const save = h('button', { class: 'btn', onclick: async () => {
    const body = form.read();
    const missing = required.filter((k) => !body[k]);
    if (missing.length) return toast('請填寫標題', 'err');
    save.disabled = true;
    try {
      if (isNew) {
        const created = await api('POST', `/api/${col}`, body);
        state.content[col].unshift(created);
      } else {
        const updated = await api('PUT', `/api/${col}/${id}`, body);
        Object.assign(item, updated);
      }
      setDirty(false);
      toast(isNew ? '已新增' : '已儲存');
      refreshStatus();
      go(col);
    } catch (e) { toast(e.message, 'err'); save.disabled = false; }
  } }, '儲存');

  const del = isNew ? null : h('button', { class: 'btn btn--danger', onclick: async () => {
    if (!confirm(`確定刪除「${schema.rowTitle(item)}」？`)) return;
    try {
      await api('DELETE', `/api/${col}/${id}`);
      state.content[col] = state.content[col].filter((x) => x.id !== id);
      setDirty(false);
      toast('已刪除');
      refreshStatus();
      go(col);
    } catch (e) { toast(e.message, 'err'); }
  } }, '刪除');

  const view = !isNew && col === 'projects' && item.visible
    ? h('a', { class: 'btn btn--ghost', href: `/work/${item.slug}/`, target: '_blank', rel: 'noopener' }, '預覽 ↗')
    : null;

  main.replaceChildren(
    h('button', { class: 'crumb', onclick: () => go(col) }, `← ${schema.title}`),
    header(isNew ? `新增${schema.one}` : schema.rowTitle(item), null, del, view,
      h('button', { class: 'btn btn--ghost', onclick: () => go(col) }, '取消'), save),
    h('div', { class: 'card' }, form.el)
  );
}

// ---------- 輸出狀態 ----------
const statusEl = document.getElementById('exportStatus');
function showStatus(s) {
  if (!s || !s.lastExport) { statusEl.textContent = s && s.autoExport ? '儲存後會自動輸出到 dist/' : '尚未輸出'; return; }
  const t = new Date(s.lastExport.exportedAt);
  statusEl.textContent = `dist/ 已同步 · ${t.toLocaleTimeString('zh-TW', { hour12: false })}\n${s.lastExport.pages} 頁 · ${s.lastExport.images} 張圖`;
}
let statusTimer;
function refreshStatus() {
  clearTimeout(statusTimer);
  statusTimer = setTimeout(async () => { try { showStatus(await api('GET', '/api/status')); } catch {} }, 900);
}
document.getElementById('exportBtn').addEventListener('click', async (e) => {
  e.target.disabled = true;
  try {
    const r = await api('POST', '/api/export');
    showStatus({ lastExport: r });
    toast(`已輸出 ${r.pages} 頁到 dist/`);
  } catch (err) { toast(err.message, 'err'); } finally { e.target.disabled = false; }
});

// ---------- 啟動 ----------
document.getElementById('nav').addEventListener('click', (e) => {
  const v = e.target.closest('button')?.dataset.view;
  if (v) go(v);
});
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    [...main.querySelectorAll('.head__actions .btn')].find((b) => b.textContent === '儲存')?.click();
  }
});

(async () => {
  try {
    state.content = await api('GET', '/api/content');
  } catch (e) {
    main.replaceChildren(h('div', { class: 'empty' }, `無法連到伺服器：${e.message}`));
    return;
  }
  const [view, id] = location.hash.slice(1).split('/');
  if (SCHEMAS[view]) { state.view = view; state.editing = COLLECTIONS.includes(view) && id ? id : null; }
  render();
  try { showStatus(await api('GET', '/api/status')); } catch {}
})();
