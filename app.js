/* Portfolio deck engine: scaling, slide/flip transitions, navigation, video, interactives. */
(() => {
  const root = document.documentElement;
  const stage = document.getElementById('stage');
  const slides = [...document.querySelectorAll('.slide')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cur = -1, busy = false;

  /* ---------- scale the 16:9 (or 9:16) stage to the window ---------- */
  function fit() {
    const w = innerWidth, h = innerHeight;
    const portrait = w / h < 0.82;
    root.classList.toggle('portrait', portrait);
    const W = portrait ? 1080 : 1920, H = portrait ? 1920 : 1080;
    const s = Math.min(w / W, h / H);
    stage.style.transform = `translate(${-W * s / 2}px, ${-H * s / 2}px) scale(${s})`;
  }
  addEventListener('resize', fit); fit();

  /* ---------- chrome ---------- */
  const countEl = document.getElementById('count');
  const progEl = document.querySelector('#progress i');
  const chapterEl = document.getElementById('chapter');
  const prevBtn = document.getElementById('prev'), nextBtn = document.getElementById('next');
  const menu = document.getElementById('menu');

  // build the menu from the slides themselves
  const groups = {};
  slides.forEach((s, i) => { const g = s.dataset.chapter || 'Portfolio'; (groups[g] ||= []).push([i, s]); });
  menu.insertAdjacentHTML('beforeend', Object.entries(groups).map(([g, items]) =>
    `<div class="grp"><h4>${g}</h4>${items.map(([i, s]) =>
      `<a href="#${s.id.replace('s-', '')}" data-go="${i}"><span>${String(i + 1).padStart(2, '0')}</span>${s.dataset.title}</a>`).join('')}</div>`).join(''));
  const menuLinks = [...menu.querySelectorAll('a')];
  const openMenu = (o) => { menu.classList.toggle('open', o); menu.setAttribute('aria-hidden', String(!o)); if (o) menu.querySelector('a.cur, a')?.focus(); };
  document.getElementById('menuBtn').onclick = () => openMenu(true);
  document.getElementById('menuClose').onclick = () => openMenu(false);
  menu.addEventListener('click', e => { const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); openMenu(false); go(+a.dataset.go); } });
  document.addEventListener('click', e => { const a = e.target.closest('a[href^="#"]:not([data-go])'); if (!a) return; const i = slides.findIndex(s => s.id === 's-' + a.getAttribute('href').slice(1)); if (i >= 0) { e.preventDefault(); go(i); } });

  /* ---------- transitions ---------- */
  function go(n, instant) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    if (n === cur || busy) return;
    const dir = n > cur ? 1 : -1;
    const from = slides[cur], to = slides[n];
    const vertical = root.classList.contains('portrait');
    busy = true;
    to.classList.add('is-active'); to.setAttribute('aria-hidden', 'false');
    if (from) { from.classList.remove('is-active'); from.classList.add('is-leaving'); from.setAttribute('aria-hidden', 'true'); leave(from); }
    const ax = vertical ? 'Y' : 'X';
    const done = () => { if (from) from.classList.remove('is-leaving'); busy = false; };
    if (!from || instant) { done(); }
    else if (reduce) {
      to.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'linear' });
      from.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'linear' }).onfinish = done;
    } else {
      const ease = 'cubic-bezier(.77,0,.18,1)', dur = 900;
      to.animate([{ transform: `translate${ax}(${dir * 100}%)`, filter: 'brightness(1.4)' }, { transform: 'none', filter: 'none' }], { duration: dur, easing: ease });
      from.animate([{ transform: 'none', opacity: 1 }, { transform: `translate${ax}(${-dir * 32}%) scale(.94)`, opacity: .25 }], { duration: dur, easing: ease }).onfinish = done;
    }
    cur = n;
    enter(to);
    countEl.innerHTML = `<b>${String(n + 1).padStart(2, '0')}</b> / ${String(slides.length).padStart(2, '0')}`;
    progEl.style.width = ((n + 1) / slides.length * 100) + '%';
    chapterEl.textContent = to.dataset.chapter || '';
    prevBtn.disabled = n === 0; nextBtn.disabled = n === slides.length - 1;
    menuLinks.forEach((a, i) => a.classList.toggle('cur', i === n));
    root.style.setProperty('--accent', getComputedStyle(to).getPropertyValue('--accent'));
    const h = '#' + to.id.replace('s-', '');
    if (location.hash !== h) history.replaceState(null, '', h);
    document.title = (n ? to.dataset.title + ' · ' : '') + 'Omolola Joseph';
    preload(n);
  }
  const next = () => go(cur + 1), prev = () => go(cur - 1);
  prevBtn.onclick = prev; nextBtn.onclick = next;

  /* ---------- per-slide enter / leave ---------- */
  function enter(s) {
    s.querySelectorAll('video').forEach(v => { v.preload = 'auto'; const p = v.play(); if (p) p.catch(() => {}); });
    s.querySelectorAll('[data-count]').forEach(countUp);
    s.dispatchEvent(new CustomEvent('enter'));
  }
  function leave(s) {
    s.querySelectorAll('video').forEach(v => v.pause());
    s.querySelectorAll('.flip.flipped, .pcard.flipped').forEach(f => f.classList.remove('flipped'));
    s.dispatchEvent(new CustomEvent('leave'));
  }
  function preload(n) { [n + 1, n - 1].forEach(i => slides[i]?.querySelectorAll('video').forEach(v => { if (v.preload === 'none') v.preload = 'metadata'; })); }

  /* ---------- input ---------- */
  addEventListener('keydown', e => {
    if (e.target.closest('input, select, textarea')) return;
    if (menu.classList.contains('open')) { if (e.key === 'Escape' || e.key.toLowerCase() === 'm') openMenu(false); return; }
    const k = e.key;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(k)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(k)) { e.preventDefault(); prev(); }
    else if (k === 'Home') go(0); else if (k === 'End') go(slides.length - 1);
    else if (k.toLowerCase() === 'm') openMenu(true);
    else if (k.toLowerCase() === 'f') { const f = slides[cur].querySelector('.flip'); if (f) toggleFlip(f); }
  });
  let wheelLock = 0, acc = 0;
  addEventListener('wheel', e => {
    if (menu.classList.contains('open')) return;
    e.preventDefault();
    const now = Date.now(); if (now < wheelLock) return;
    acc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(acc) > 60) { acc > 0 ? next() : prev(); acc = 0; wheelLock = now + 1000; }
  }, { passive: false });
  let tx = 0, ty = 0, tt = 0;
  addEventListener('touchstart', e => { const t = e.touches[0]; tx = t.clientX; ty = t.clientY; tt = Date.now(); }, { passive: true });
  addEventListener('touchend', e => {
    if (menu.classList.contains('open') || e.target.closest('input, select, .calc')) return;
    const t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
    const vertical = root.classList.contains('portrait');
    const d = vertical && Math.abs(dy) > Math.abs(dx) ? dy : dx;
    if (Math.abs(d) > 50 && Date.now() - tt < 800) d < 0 ? next() : prev();
  }, { passive: true });
  addEventListener('hashchange', () => { const i = slides.findIndex(s => '#' + s.id.replace('s-', '') === location.hash); if (i >= 0) go(i); });

  /* ---------- flips ---------- */
  function toggleFlip(f) {
    const on = f.classList.toggle('flipped');
    f.querySelector('.front').setAttribute('aria-hidden', String(on));
    f.querySelector('.back').setAttribute('aria-hidden', String(!on));
    const v = f.querySelector('video'); if (v) on ? v.pause() : v.play().catch(() => {});
    const b = document.querySelector(`[data-flip="${f.id}"]`); if (b) b.setAttribute('aria-pressed', String(on));
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-flip]'); if (b) { toggleFlip(document.getElementById(b.dataset.flip)); return; }
    const c = e.target.closest('.pcard'); if (c) { c.classList.toggle('flipped'); c.setAttribute('aria-pressed', String(c.classList.contains('flipped'))); }
  });

  /* ---------- video controls ---------- */
  const ICON = {
    muted: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6M17 9l6 6"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
    replay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>'
  };
  document.querySelectorAll('.face.front').forEach(face => {
    const v = face.querySelector('video'); if (!v) return;
    face.insertAdjacentHTML('beforeend', `<div class="vctl"><button class="replay" aria-label="Replay video">${ICON.replay}</button><button class="mute" aria-label="Turn sound on">${ICON.muted}</button></div>`);
    const mb = face.querySelector('.mute');
    mb.onclick = () => { v.muted = !v.muted; mb.innerHTML = v.muted ? ICON.muted : ICON.sound; mb.setAttribute('aria-label', v.muted ? 'Turn sound on' : 'Mute'); if (!v.muted) v.play(); };
    face.querySelector('.replay').onclick = () => { v.currentTime = 0; v.play(); };
  });

  /* ---------- count-up ---------- */
  function countUp(el) {
    const end = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), pre = el.dataset.pre || '', suf = el.dataset.suf || '';
    const fmt = x => pre + x.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
    if (reduce) { el.textContent = fmt(end); return; }
    const t0 = performance.now(), dur = 1400 + (+el.dataset.delay || 0);
    const step = t => { const p = Math.min(1, Math.max(0, (t - t0 - (+el.dataset.delay || 0)) / 1400)); const e = 1 - Math.pow(1 - p, 4); el.textContent = fmt(end * e); if (p < 1) requestAnimationFrame(step); };
    el.textContent = fmt(0); requestAnimationFrame(step);
  }

  /* ---------- tabs: one call, three reports ---------- */
  document.querySelectorAll('.tabs').forEach(tl => {
    const panel = document.getElementById(tl.dataset.panel);
    tl.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      tl.querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
      panel.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'ease-out' });
      panel.textContent = b.dataset.text;
    });
  });

  /* ---------- match-score calculator (real formula from the Review Dashboard) ---------- */
  const calc = document.getElementById('matchcalc');
  if (calc) {
    const st = { role: 50, skills: 2, req: 3, exp: 10, ai: 15 };
    const set = () => {
      const skillPts = st.skills * 5, total = st.role + skillPts + st.exp + st.ai;
      const rows = [['Role fit', st.role, 50], ['Required skills (' + st.skills + ' of ' + st.req + ')', skillPts, st.req * 5], ['Experience', st.exp, 10], ['AI resume score', st.ai, 15]];
      calc.querySelector('.bars .rows').innerHTML = rows.map(r => `<div class="row"><span>${r[0]}</span><span class="tr"><b style="width:${r[2] ? r[1] / r[2] * 100 : 0}%"></b></span><span class="p">${r[1]}</span></div>`).join('');
      calc.querySelector('#mtotal').textContent = total;
      calc.querySelector('#aiv').textContent = st.ai + ' / 15';
      calc.querySelector('#skv').textContent = st.skills + ' of ' + st.req;
    };
    calc.querySelectorAll('[data-role]').forEach(b => b.onclick = () => { st.role = +b.dataset.role; calc.querySelectorAll('[data-role]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); set(); });
    calc.querySelectorAll('[data-exp]').forEach(b => b.onclick = () => { st.exp = +b.dataset.exp; calc.querySelectorAll('[data-exp]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); set(); });
    calc.querySelector('#sk').oninput = e => { st.skills = +e.target.value; set(); };
    calc.querySelector('#ai').oninput = e => { st.ai = +e.target.value; set(); };
    set();
  }

  /* ---------- GreyBarn pipeline stepper ---------- */
  const pipe = document.getElementById('gbpipe');
  if (pipe) {
    const btns = [...pipe.querySelectorAll('button')], cards = [...document.querySelectorAll('#gbcards > div')], fill = pipe.querySelector('.fill');
    let k = 0, timer;
    const show = i => {
      k = i;
      btns.forEach((b, j) => { b.classList.toggle('on', j === i); b.classList.toggle('done', j < i); b.setAttribute('aria-selected', String(j === i)); });
      cards.forEach((c, j) => { c.hidden = j !== i; if (j === i && !reduce) c.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.16,1,.3,1)' }); });
      fill.style.width = (i / (btns.length - 1) * 92) + '%';
    };
    btns.forEach((b, i) => b.onclick = () => { clearInterval(timer); show(i); });
    const s = pipe.closest('.slide');
    s.addEventListener('enter', () => { show(0); clearInterval(timer); if (!reduce) timer = setInterval(() => show((k + 1) % btns.length), 4200); });
    s.addEventListener('leave', () => clearInterval(timer));
  }

  /* ---------- automation flow lights ---------- */
  const flow = document.getElementById('autoflow');
  if (flow) {
    const nodes = [...flow.querySelectorAll('.node')]; let t2, j = 0;
    const s = flow.closest('.slide');
    s.addEventListener('enter', () => { clearInterval(t2); j = 0; t2 = setInterval(() => { nodes.forEach((n, i) => n.classList.toggle('lit', i === j)); j = (j + 1) % nodes.length; }, 700); });
    s.addEventListener('leave', () => clearInterval(t2));
  }

  /* ---------- start ---------- */
  const start = slides.findIndex(s => '#' + s.id.replace('s-', '') === location.hash);
  go(start >= 0 ? start : 0, true);
})();
