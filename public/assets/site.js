// 首頁的即時時鐘（依後台設定的時區）
(() => {
  const el = document.querySelector('.clock');
  if (!el) return;
  const tz = el.dataset.tz || 'Asia/Taipei';
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch {
    fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }
  const tick = () => {
    const [h, m, s] = fmt.format(new Date()).split(':');
    el.innerHTML = `${h}:${m}<span class="sec">${s}</span>`;
  };
  tick();
  setInterval(tick, 1000);
})();
