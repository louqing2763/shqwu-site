'use strict';
// 前台 HTML 產生器。伺服器即時渲染與靜態輸出共用同一份，確保兩邊長得一模一樣。

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// 只允許 http(s)、mailto、站內路徑，擋掉 javascript: 之類的連結。
function safeUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^(https?:|mailto:|tel:)/i.test(s) || s.startsWith('/') || s.startsWith('#')) return s;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return 'https://' + s;
  return '';
}

const isExternal = (u) => /^https?:/i.test(u);
const linkAttrs = (u) => (isExternal(u) ? ' target="_blank" rel="noopener"' : '');

// 純文字轉段落：空行分段，「- 」開頭成清單。
function formatText(text) {
  const blocks = String(text || '').replace(/\r/g, '').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks
    .map((b) => {
      const lines = b.split('\n');
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
        return '<ul>' + lines.map((l) => `<li>${esc(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('') + '</ul>';
      }
      return `<p>${lines.map(esc).join('<br>')}</p>`;
    })
    .join('\n');
}

const pad = (n) => String(n).padStart(2, '0');

function favicon(name) {
  const ch = esc((name || 'W').trim().charAt(0).toUpperCase() || 'W');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='black'/><text x='16' y='23' font-family='monospace' font-size='20' font-weight='700' fill='white' text-anchor='middle'>${ch}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function layout(data, { title, description, path, body, image }) {
  const { site, profile } = data;
  const base = (site.url || '').replace(/\/+$/, '');
  const canonical = base ? base + path : '';
  const ogImage = image && base && image.startsWith('/') ? base + image : image;
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ''}
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
<meta name="theme-color" content="#000000">
<link rel="icon" href="${favicon(profile.name)}">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
<header class="topbar">
  <a class="topbar__brand" href="/">${esc(profile.name || site.title || 'Portfolio')}</a>
  <nav class="topbar__nav">
    <a href="/#work">Work</a>
    ${data.awards.length ? '<a href="/#honors">Honors</a>' : ''}
    ${data.certifications.length ? '<a href="/#certs">Certs</a>' : ''}
    <a href="/#contact">Contact</a>
  </nav>
</header>
${body}
<footer class="footer">
  <span>© ${new Date().getFullYear()} ${esc(profile.name || site.title)}</span>
  <span class="footer__meta">Built from scratch · zero dependencies</span>
</footer>
<script src="/assets/site.js" defer></script>
</body>
</html>
`;
}

function tagList(tags, cls = 'tags') {
  if (!tags || !tags.length) return '';
  return `<ul class="${cls}">${tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
}

function projectTile(p, i, big) {
  const cover = p.cover
    ? `<div class="tile__media"><img src="${esc(p.cover)}" alt="${esc(p.title)}" loading="lazy"></div>`
    : '';
  return `<a class="tile tile--project ${big ? 'tile--2x2' : 'tile--wide'}${p.cover ? '' : ' tile--nomedia'}" href="/work/${esc(p.slug)}/">
    ${cover}
    <div class="tile__body">
      <div class="tile__label"><span>${pad(i + 1)} / ${esc(p.year || 'WORK')}</span><span class="arrow">↗</span></div>
      <h3 class="tile__title">${esc(p.title)}</h3>
      ${p.subtitle ? `<p class="tile__sub">${esc(p.subtitle)}</p>` : ''}
      ${p.summary ? `<p class="tile__text">${esc(p.summary)}</p>` : ''}
      ${tagList(p.tags.slice(0, 5))}
    </div>
  </a>`;
}

function renderHome(data) {
  const { site, profile, projects, awards, certifications } = data;
  const featured = projects.filter((p) => p.featured);
  const showcase = (featured.length ? featured : projects).slice(0, 5);
  const initial = (profile.name || 'W').trim().charAt(0).toUpperCase();

  const tiles = [];
  tiles.push(`<section class="tile tile--2x2 tile--invert tile--intro">
    <div class="tile__label"><span>// 00 — INDEX</span><span>${esc(profile.location)}</span></div>
    <div class="intro">
      <h1 class="intro__name">${esc(profile.name)}</h1>
      ${profile.title ? `<p class="intro__title">${esc(profile.title)}</p>` : ''}
      ${profile.tagline ? `<p class="intro__tagline">${esc(profile.tagline)}</p>` : ''}
    </div>
  </section>`);

  tiles.push(`<section class="tile tile--tall tile--avatar">
    ${profile.avatar ? `<img src="${esc(profile.avatar)}" alt="${esc(profile.name)}">` : `<span class="monogram">${esc(initial)}</span>`}
  </section>`);

  // 第一列：沒有狀態格時，時鐘拉成兩格高，避免網格出現空洞。
  tiles.push(`<section class="tile tile--clock${profile.status ? '' : ' tile--tall'}">
    <div class="tile__label"><span>LOCAL TIME</span><span>${esc((profile.timezone || '').split('/').pop().replace(/_/g, ' '))}</span></div>
    <div class="clock" data-tz="${esc(profile.timezone || 'Asia/Taipei')}">--:--</div>
  </section>`);

  if (profile.status) {
    tiles.push(`<section class="tile tile--status">
      <div class="tile__label"><span>STATUS</span><span class="dot" aria-hidden="true"></span></div>
      <p class="status">${esc(profile.status)}</p>
    </section>`);
  }

  // 第二列：自介與技術棧各半；只有其中一個時佔滿整列。
  const pair = [];
  if (profile.bio) {
    pair.push(`<section class="tile SIZE tile--about" id="about">
      <div class="tile__label"><span>// 01 — ABOUT</span></div>
      <div class="prose">${formatText(profile.bio)}</div>
    </section>`);
  }
  if (profile.skills.length) {
    pair.push(`<section class="tile SIZE tile--stack">
      <div class="tile__label"><span>// STACK</span><span>${pad(profile.skills.length)}</span></div>
      ${tagList(profile.skills, 'chips')}
    </section>`);
  }
  tiles.push(...pair.map((t) => t.replace('SIZE', pair.length === 1 ? 'tile--full' : 'tile--wide')));

  // 作品區：第一個精選作品 2x2，其餘作品、統計、聯絡都是寬卡，兩兩補滿；奇數時最後一張佔整列。
  if (showcase.length) tiles.push(projectTile(showcase[0], 0, true));
  const wides = showcase.slice(1).map((p, i) => projectTile(p, i + 1, false));

  const counters = [
    ['PROJECTS', projects.length, '#work'],
    ['HONORS', awards.length, '#honors'],
    ['CERTS', certifications.length, '#certs'],
  ].filter(([, n]) => n > 0);
  if (counters.length) {
    wides.push(`<section class="tile tile--wide tile--stats">
      ${counters
        .map(([label, n, href]) => `<a class="stat" href="${href}">
        <span class="tile__label"><span>${label}</span><span class="arrow">↓</span></span>
        <span class="counter">${pad(n)}</span>
      </a>`)
        .join('')}
    </section>`);
  }

  const contactLinks = profile.links
    .map((l) => ({ ...l, href: safeUrl(l.url) }))
    .filter((l) => l.href)
    .map((l) => `<li><a href="${esc(l.href)}"${linkAttrs(l.href)}>${esc(l.label || l.url)} <span class="arrow">↗</span></a></li>`)
    .join('');
  wides.push(`<section class="tile tile--wide tile--invert tile--contact" id="contact">
    <div class="tile__label"><span>// CONTACT</span></div>
    ${profile.email ? `<a class="contact__email" href="mailto:${esc(profile.email)}">${esc(profile.email)}</a>` : ''}
    ${contactLinks ? `<ul class="contact__links">${contactLinks}</ul>` : ''}
  </section>`);

  if (wides.length % 2 === 1) {
    wides[wides.length - 1] = wides[wides.length - 1].replace('tile--wide', 'tile--full');
  }
  tiles.push(...wides);

  const workRows = projects
    .map(
      (p, i) => `<li><a class="row" href="/work/${esc(p.slug)}/">
        <span class="row__num">${pad(i + 1)}</span>
        <span class="row__year">${esc(p.year)}</span>
        <span class="row__title">${esc(p.title)}${p.subtitle ? `<small>${esc(p.subtitle)}</small>` : ''}</span>
        <span class="row__tags">${esc(p.tags.slice(0, 3).join(' · '))}</span>
        <span class="row__arrow">→</span>
      </a></li>`
    )
    .join('');

  const awardRows = awards
    .map((a) => {
      const href = safeUrl(a.link);
      const inner = `<span class="row__year">${esc(a.date)}</span>
        <span class="row__title">${esc(a.title)}${a.event ? `<small>${esc(a.event)}</small>` : ''}${a.description ? `<em>${esc(a.description)}</em>` : ''}</span>
        <span class="row__badge">${esc(a.rank)}</span>
        <span class="row__arrow">${href ? '↗' : ''}</span>`;
      return `<li>${href ? `<a class="row row--award" href="${esc(href)}"${linkAttrs(href)}>${inner}</a>` : `<div class="row row--award">${inner}</div>`}</li>`;
    })
    .join('');

  const certRows = certifications
    .map((c) => {
      const href = safeUrl(c.url);
      const inner = `<span class="row__year">${esc(c.date)}</span>
        <span class="row__title">${esc(c.name)}${c.issuer ? `<small>${esc(c.issuer)}</small>` : ''}</span>
        <span class="row__badge">${esc(c.credentialId)}</span>
        <span class="row__arrow">${href ? '↗' : ''}</span>`;
      return `<li>${href ? `<a class="row row--award" href="${esc(href)}"${linkAttrs(href)}>${inner}</a>` : `<div class="row row--award">${inner}</div>`}</li>`;
    })
    .join('');

  const section = (id, num, title, count, rows) =>
    rows
      ? `<section class="section" id="${id}">
    <h2 class="section__head"><span>${num} — ${title}</span><span>${pad(count)}</span></h2>
    <ul class="rows">${rows}</ul>
  </section>`
      : '';

  const body = `<main class="page">
  <div class="bento">
    ${tiles.join('\n')}
  </div>
  ${section('work', '02', 'WORK INDEX', projects.length, workRows)}
  ${section('honors', '03', 'HONORS & AWARDS', awards.length, awardRows)}
  ${section('certs', '04', 'CERTIFICATIONS', certifications.length, certRows)}
</main>`;

  return layout(data, {
    title: site.title || profile.name || 'Portfolio',
    description: site.description || profile.tagline || '',
    path: '/',
    body,
    image: profile.avatar,
  });
}

function renderProject(data, slug) {
  const { site, profile, projects } = data;
  const idx = projects.findIndex((p) => p.slug === slug);
  if (idx < 0) return null;
  const p = projects[idx];
  const prev = projects[idx - 1];
  const next = projects[idx + 1];

  const links = p.links
    .map((l) => ({ ...l, href: safeUrl(l.url) }))
    .filter((l) => l.href)
    .map((l) => `<a class="btn" href="${esc(l.href)}"${linkAttrs(l.href)}>${esc(l.label || l.url)} ↗</a>`)
    .join('');

  const meta = [
    ['YEAR', esc(p.year)],
    ['ROLE', esc(p.role)],
    ['STACK', esc(p.tags.join(' · '))],
  ].filter(([, v]) => v);

  const body = `<main class="page page--project">
  <a class="back" href="/#work">← 全部作品</a>
  <header class="project__head">
    <div class="tile__label"><span>WORK / ${pad(idx + 1)}</span><span>${esc(p.year)}</span></div>
    <h1 class="project__title">${esc(p.title)}</h1>
    ${p.subtitle ? `<p class="project__sub">${esc(p.subtitle)}</p>` : ''}
    ${p.summary ? `<p class="project__summary">${esc(p.summary)}</p>` : ''}
  </header>
  ${meta.length || links ? `<dl class="meta">
    ${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
    ${links ? `<div class="meta__links"><dt>LINKS</dt><dd>${links}</dd></div>` : ''}
  </dl>` : ''}
  ${p.cover ? `<figure class="project__cover"><img src="${esc(p.cover)}" alt="${esc(p.title)}"></figure>` : ''}
  ${p.description ? `<article class="prose prose--lg">${formatText(p.description)}</article>` : ''}
  ${p.gallery.length ? `<div class="gallery">${p.gallery.map((g) => `<figure><img src="${esc(g)}" alt="" loading="lazy"></figure>`).join('')}</div>` : ''}
  <nav class="pager">
    ${prev ? `<a href="/work/${esc(prev.slug)}/"><small>← PREV</small>${esc(prev.title)}</a>` : '<span></span>'}
    ${next ? `<a class="pager__next" href="/work/${esc(next.slug)}/"><small>NEXT →</small>${esc(next.title)}</a>` : '<span></span>'}
  </nav>
</main>`;

  return layout(data, {
    title: `${p.title} — ${site.title || profile.name}`,
    description: p.summary || site.description || '',
    path: `/work/${p.slug}/`,
    body,
    image: p.cover,
  });
}

function render404(data) {
  return layout(data, {
    title: `404 — ${data.site.title || data.profile.name}`,
    description: '',
    path: '/404',
    body: `<main class="page page--404"><div class="tile tile--invert notfound"><div class="tile__label"><span>ERROR</span><span>404</span></div><h1>Page not found.</h1><a class="btn btn--light" href="/">← 回首頁</a></div></main>`,
  });
}

module.exports = { renderHome, renderProject, render404, esc, safeUrl, formatText };
