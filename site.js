/* Southeast Restoration, Augusta: the immersive layer's script.
   Everything here is an enhancement: with scripts off, under reduced motion, or without WebGL the page is the same
   content, still and readable. No library; one scroll loop; canvases draw only while they are on screen. */

const doc = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------------ the curtain lifts once a session */
{
  let seen = false;
  try { seen = sessionStorage.getItem('im-seen') === '1'; sessionStorage.setItem('im-seen', '1'); } catch (e) { /* private mode */ }
  const lift = () => doc.classList.add('im-ready');
  if (seen || reduce) { const c = $('.im-curtain'); if (c) c.style.display = 'none'; lift(); }
  else setTimeout(lift, 650);
}

/* ------------------------------------------------------------------ the office clock: it is open 24 hours, so "open now" is always true */
{
  const el = $('[data-im-clock]');
  if (el) {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
    const tick = () => { el.textContent = `Open now · ${fmt.format(new Date())} in Evans`; };
    tick(); setInterval(tick, 15000);
  }
}

/* ------------------------------------------------------------------ the hero: rain on a window, wiped by the pointer (WebGL, our own shader) */
const MODES = {
  water: { tint: [0.52, 0.66, 0.90], rain: 0.62, fog: 1.0 },
  fire:  { tint: [0.95, 0.56, 0.30], rain: 0.12, fog: 0.9 },
  storm: { tint: [0.62, 0.68, 0.78], rain: 0.95, fog: 1.0 },
  mold:  { tint: [0.56, 0.74, 0.62], rain: 0.30, fog: 1.0 },
};
const glassState = { tint: [...MODES.water.tint], rain: MODES.water.rain, fog: 1, target: MODES.water };

function glass(hero) {
  const canvas = $('canvas', hero), still = $('.im-hero__media img', hero);
  if (!canvas || !still || reduce) return;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return;
  const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  const FS = `
precision highp float;
uniform sampler2D uSharp, uBlur, uMask;
uniform vec2 uRes, uImg, uFocus;
uniform float uTime, uRain, uFog;
uniform vec3 uTint;
float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 h2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
/* the photograph, covering the screen about its focus point */
vec2 cover(vec2 uv){
  float sa = uRes.x / uRes.y, ia = uImg.x / uImg.y;
  vec2 f = sa > ia ? vec2(1.0, ia / sa) : vec2(sa / ia, 1.0);
  vec2 c = clamp(uFocus, f * 0.5, 1.0 - f * 0.5);
  return c + (uv - 0.5) * f;
}
/* beads of condensation: one a cell, slowly born and gone */
vec3 beads(vec2 p, float scale, float seed){
  vec2 g = p * scale, id = floor(g), f = fract(g) - 0.5;
  vec2 r = h2(id + seed);
  float life = fract(r.x * 9.0 + uTime * (0.015 + r.y * 0.02));
  float grow = smoothstep(0.0, 0.12, life) * smoothstep(1.0, 0.72, life);
  float rad = mix(0.10, 0.28, h1(id * 1.73 + seed)) * (0.35 + 0.65 * grow);
  float show = step(h1(id * 2.31 + seed + 9.0), 0.58) * smoothstep(0.0, 0.06, grow);
  vec2 d = f - (r - 0.5) * 0.55;
  float m = smoothstep(rad, rad * 0.72, length(d)) * show;
  return vec3(d / rad * m, m);
}
/* drops that run down the pane, one lane each, leaving a clear trail behind them */
void runner(vec2 p, float lanes, float speed, float seed, out vec2 n, out float m, out float trail){
  float lx = p.x * lanes, id = floor(lx), fx = fract(lx) - 0.5;
  float r = h1(vec2(id, seed));
  float t = uTime * speed * mix(0.55, 1.35, r) + r * 17.0;
  float cyc = floor(t), ph = fract(t);
  float rr = h1(vec2(id + cyc * 13.0, seed + 3.0));
  float on = step(rr, uRain);
  float y = (ph + 0.03 * sin(ph * 37.0 + r * 6.283)) * 1.35 - 0.18;
  float x = (rr - 0.5) * 0.46 + 0.07 * sin(p.y * 8.0 + r * 6.283);
  vec2 d = vec2((fx - x) / lanes, (p.y - y) * 0.78);
  float rad = mix(0.009, 0.019, rr);
  m = smoothstep(rad, rad * 0.55, length(d)) * on;
  n = d / rad * m;
  float w = smoothstep(rad * 0.8, rad * 0.15, abs(d.x));
  trail = w * step(p.y, y) * smoothstep(y - 0.42, y, p.y) * on;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; uv.y = 1.0 - uv.y;
  vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y);
  float wiped = texture2D(uMask, uv).r;
  float keep = 1.0 - smoothstep(0.15, 0.6, wiped);
  vec3 a = beads(p, 30.0, 1.0), b = beads(p + 7.3, 52.0, 2.0), c = beads(p + 2.9, 84.0, 5.0);
  vec2 n = (a.xy * 0.55 + b.xy * 0.4 + c.xy * 0.25) * keep;
  float dm = max(a.z, max(b.z, c.z * 0.8)) * keep;
  vec2 rn; float rm; float rt; float clear = 0.0;
  runner(p, 7.0, 0.085, 11.0, rn, rm, rt); n += rn; dm = max(dm, rm); clear = max(clear, rt);
  runner(p + vec2(0.31, 0.0), 11.0, 0.12, 23.0, rn, rm, rt); n += rn; dm = max(dm, rm); clear = max(clear, rt);
  runner(p + vec2(0.63, 0.0), 16.0, 0.16, 37.0, rn, rm, rt); n += rn * 0.8; dm = max(dm, rm); clear = max(clear, rt * 0.8);
  float fog = uFog * (1.0 - max(smoothstep(0.05, 0.75, wiped), clear * 0.9)) * (1.0 - dm);
  fog *= mix(0.55, 1.0, smoothstep(0.06, 0.62, length((uv - vec2(0.57, 0.43)) * vec2(1.0, 1.35))));
  vec2 iuv = cover(uv);
  vec3 sharp = texture2D(uSharp, iuv - n * 0.022 * (0.35 + dm)).rgb;
  vec3 soft = texture2D(uBlur, iuv - n * 0.008).rgb;
  vec3 misted = mix(soft, uTint, 0.18) * 0.68;
  vec3 col = mix(sharp, misted, fog);
  col += dm * smoothstep(0.15, 0.95, -n.y) * 0.09;
  col *= 1.0 - 0.28 * smoothstep(0.35, 1.05, length((uv - 0.5) * vec2(1.0, 1.25)));
  gl_FragColor = vec4(col, 1.0);
}`;
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader'); return s; };
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
  } catch (e) { return; }
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(prog, n);
  const u = { res: U('uRes'), img: U('uImg'), focus: U('uFocus'), time: U('uTime'), rain: U('uRain'), fog: U('uFog'), tint: U('uTint') };
  const tex = (unit, name) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(U(name), unit); return t; };
  const tSharp = tex(0, 'uSharp'), tBlur = tex(1, 'uBlur'), tMask = tex(2, 'uMask');

  // the wipe: a small canvas the pointer paints on; it mists over again by itself
  const mask = document.createElement('canvas'), mx = mask.getContext('2d');
  let W = 0, H = 0, lastX = -1, lastY = -1, liftT = 0, touched = false;
  const size = () => {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.25 : 1.5);
    W = Math.max(2, Math.round(r.width * dpr)); H = Math.max(2, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H);
    mask.width = 256; mask.height = Math.max(64, Math.min(640, Math.round(256 * r.height / Math.max(1, r.width))));
    mx.fillStyle = '#000'; mx.fillRect(0, 0, mask.width, mask.height);
  };
  const stamp = (uu, vv, rad = 0.075, strength = 0.6) => {
    const x = uu * mask.width, y = vv * mask.height, R = rad * mask.width;
    const n = lastX < 0 ? 1 : Math.max(1, Math.ceil(Math.hypot(x - lastX, y - lastY) / (R * 0.35)));
    for (let i = 1; i <= n; i++) {
      const t = i / n, cx = lastX < 0 ? x : lerp(lastX, x, t), cy = lastY < 0 ? y : lerp(lastY, y, t);
      const g = mx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, `rgba(255,255,255,${strength})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      mx.fillStyle = g; mx.beginPath(); mx.arc(cx, cy, R, 0, 6.2832); mx.fill();
    }
    lastX = x; lastY = y; clearTimeout(liftT); liftT = setTimeout(() => { lastX = lastY = -1; }, 140);
  };
  let fx = 0.58, fy = 0.40, ftx = 0.58, fty = 0.40;
  hero.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    stamp((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    ftx = 0.58 + ((e.clientX - r.left) / r.width - 0.5) * 0.03; fty = 0.40 + ((e.clientY - r.top) / r.height - 0.5) * 0.03;
    if (!touched) { touched = true; hero.classList.remove('is-hinting'); }
  }, { passive: true });

  let ready = 0, visible = true, raf = 0, t0 = performance.now(), intro = -1;
  const upload = (texture, unit, source) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source); };
  const frame = now => {
    raf = 0; if (!visible) return;
    const t = (now - t0) / 1000, s = glassState, g = s.target;
    for (let i = 0; i < 3; i++) s.tint[i] = lerp(s.tint[i], g.tint[i], 0.04);
    s.rain = lerp(s.rain, g.rain, 0.03); s.fog = lerp(s.fog, g.fog, 0.03);
    // the first wipe draws itself, so the house shows before anyone moves
    if (intro >= 0 && !touched) {
      const k = clamp((now - intro) / 1900, 0, 1), e = 1 - Math.pow(1 - k, 3);
      stamp(lerp(0.93, 0.36, e), 0.36 + 0.16 * Math.sin(e * 3.1416) + 0.05 * Math.sin(e * 9.0), 0.11, 0.5);
      if (k >= 1) { intro = -1; hero.classList.add('is-hinting'); setTimeout(() => hero.classList.remove('is-hinting'), 6000); }
    } else if (!fine && !touched) {
      // a phone has no pointer to move: a slow hand keeps a part of the pane clear
      stamp(0.5 + 0.3 * Math.sin(t * 0.35), 0.42 + 0.1 * Math.sin(t * 0.52 + 1.0), 0.16, 0.12);
    }
    mx.fillStyle = 'rgba(0,0,0,0.007)'; mx.fillRect(0, 0, mask.width, mask.height);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tMask);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, mask);
    fx = lerp(fx, ftx, 0.05); fy = lerp(fy, fty, 0.05); gl.uniform2f(u.focus, fx, fy);
    gl.uniform2f(u.res, W, H); gl.uniform1f(u.time, t); gl.uniform1f(u.rain, s.rain); gl.uniform1f(u.fog, s.fog); gl.uniform3f(u.tint, s.tint[0], s.tint[1], s.tint[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf && visible && ready === 2) raf = requestAnimationFrame(frame); };
  const got = () => {
    if (++ready < 2) return;
    try {
      upload(tSharp, 0, still); upload(tBlur, 1, blur);
      gl.uniform2f(u.img, still.naturalWidth, still.naturalHeight);
      gl.uniform2f(u.focus, 0.58, 0.40);
      size(); hero.classList.add('is-gl'); intro = performance.now() + 900; start();
    } catch (e) { ready = -9; /* a tainted picture (opened from a file): the still photograph stays */ }
  };
  const blur = new Image(); blur.decoding = 'async'; blur.onload = got; blur.src = still.dataset.blur;
  if (still.complete && still.naturalWidth) got(); else still.addEventListener('load', got, { once: true });
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) start(); }, { threshold: 0.02 }).observe(hero);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden && hero.getBoundingClientRect().bottom > 0; if (visible) start(); });
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (ready === 2) size(); }, 150); });
}

/* ------------------------------------------------------------------ the triage's weather: rain, embers, wind or spores behind the panel */
function weather(section) {
  const cv = $('.im-weather', section);
  if (!cv || reduce) return { set() {} };
  const cx = cv.getContext('2d');
  let w = 0, h = 0, mode = 'water', parts = [], visible = false, raf = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const make = fresh => {
    const p = { x: rnd(0, w), y: fresh ? rnd(0, h) : 0, a: rnd(0.18, 0.5) };
    if (mode === 'water') Object.assign(p, { y: fresh ? rnd(0, h) : rnd(-80, 0), vx: 0.3, vy: rnd(7, 12), l: rnd(12, 26) });
    else if (mode === 'storm') Object.assign(p, { y: fresh ? rnd(0, h) : rnd(-120, 0), x: rnd(0, w * 1.3), vx: rnd(-8, -5), vy: rnd(14, 21), l: rnd(22, 44) });
    else if (mode === 'fire') Object.assign(p, { y: fresh ? rnd(0, h) : h + rnd(0, 80), vx: 0, vy: -rnd(0.5, 1.7), r: rnd(1.2, 3), ph: rnd(0, 6.28), life: rnd(0.4, 1) });
    else Object.assign(p, { vx: rnd(-0.25, 0.25), vy: rnd(-0.22, 0.22), r: rnd(1.2, 3), ph: rnd(0, 6.28) });
    return p;
  };
  const fill = () => { const n = Math.round(clamp(w / 10, 34, 150) * (mode === 'storm' ? 1.3 : mode === 'mold' ? 0.75 : 1)); parts = Array.from({ length: n }, () => make(true)); };
  const size = () => { const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 1.5); w = r.width; h = r.height; cv.width = Math.round(w * d); cv.height = Math.round(h * d); cx.setTransform(d, 0, 0, d, 0, 0); fill(); };
  const draw = now => {
    raf = 0; if (!visible) return;
    cx.clearRect(0, 0, w, h);
    const t = now / 1000;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (mode === 'water' || mode === 'storm') {
        p.x += p.vx; p.y += p.vy;
        cx.strokeStyle = mode === 'water' ? `rgba(127,180,255,${p.a})` : `rgba(194,206,226,${p.a})`;
        cx.lineWidth = 1; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x - p.vx / p.vy * p.l, p.y - p.l); cx.stroke();
        if (p.y - p.l > h || p.x < -40) parts[i] = make(false);
      } else if (mode === 'fire') {
        p.y += p.vy; p.x += Math.sin(t * 1.3 + p.ph) * 0.45; p.life -= 0.0026;
        cx.fillStyle = `rgba(255,${130 + Math.round(60 * p.life)},82,${clamp(p.life, 0, 1) * (0.5 + 0.5 * Math.sin(t * 6 + p.ph)) * 0.8})`;
        cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.2832); cx.fill();
        if (p.y < -10 || p.life <= 0) parts[i] = make(false);
      } else {
        p.x += p.vx + Math.sin(t * 0.6 + p.ph) * 0.12; p.y += p.vy + Math.cos(t * 0.5 + p.ph) * 0.12;
        cx.fillStyle = `rgba(142,207,159,${p.a * (0.6 + 0.4 * Math.sin(t + p.ph))})`;
        cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.2832); cx.fill();
        if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;
      }
    }
    raf = requestAnimationFrame(draw);
  };
  const start = () => { if (!raf && visible) raf = requestAnimationFrame(draw); };
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) start(); }, { threshold: 0.02 }).observe(section);
  let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(size, 150); });
  size();
  return { set(m) { mode = m; fill(); } };
}

/* ------------------------------------------------------------------ triage: four kinds of damage, a checklist each */
function triage(section) {
  const tabs = $$('[role="tab"]', section), panels = $$('[role="tabpanel"]', section), sky = weather(section);
  const select = (tab, focus) => {
    tabs.forEach(t => { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    panels.forEach(p => { p.hidden = p.id !== tab.getAttribute('aria-controls'); });
    const m = tab.dataset.mode; section.dataset.mode = m; sky.set(m); glassState.target = MODES[m] || MODES.water;
    if (focus) tab.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', e => {
      let j = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = tabs.length - 1;
      if (j >= 0) { e.preventDefault(); select(tabs[j], true); }
    });
  });
  $$('.im-check', section).forEach(list => {
    const tally = list.parentElement.querySelector('.im-tally');
    list.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
      const n = $$('button[aria-pressed="true"]', list).length;
      if (tally) { tally.style.setProperty('--done', n); const out = $('b', tally); if (out) out.textContent = n; }
    });
  });
}

/* ------------------------------------------------------------------ the repair, pinned: four steps, the sky going from night to morning */
/* ------------------------------------------------------------------ the house scene
   One drawing of one house, kept in a <template>. Each copy is set to a moment of the night
   (data-s 0..3) and gets its own gradient and clip ids, so copies can sit at different moments. */
const sceneTpl = document.getElementById('sc-tpl');
let sceneCount = 0;
function makeScene(state, o = {}) {
  if (!sceneTpl) return null;
  const n = ++sceneCount, box = document.createElement('div');
  box.innerHTML = sceneTpl.innerHTML.replace(/(id="|url\(#)sc-/g, '$1sc' + n + '-');
  const el = box.firstElementChild;
  if (!el) return null;
  el.dataset.s = String(state);
  if (o.v) el.dataset.v = o.v;
  if (o.vb) el.setAttribute('viewBox', o.vb);
  if (o.label) { el.removeAttribute('aria-hidden'); el.setAttribute('role', 'img'); el.setAttribute('aria-label', o.label); }
  return el;
}
const sceneSeen = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
  e.target.classList.toggle('is-run', e.isIntersecting && !reduce);
  if (e.isIntersecting) e.target.classList.add('is-in');
}), { threshold: 0.2 }) : null;
const watchScene = el => { if (sceneSeen) sceneSeen.observe(el); else el.classList.add('is-in'); };

/* the menu's four pictures are close-ups of the same house */
function menuScenes() {
  const item = $('.nav__menu .menu-card') && $('.nav__menu .menu-card').closest('.nav__item');
  if (!item || !sceneTpl) return;
  const shots = [
    { s: 0, vb: '216 250 330 175', label: 'Drawing: water coming through a ceiling into a kitchen at night' },
    { s: 0, v: 'fire', vb: '216 250 330 175', label: 'Drawing: a fire in a kitchen at night' },
    { s: 1, vb: '250 104 340 180', label: 'Drawing: a tarp tied over a damaged roof in the rain' },
    { s: 3, vb: '216 250 330 175', label: 'Drawing: a rebuilt kitchen in the morning' }
  ];
  let made = [];
  const build = () => {
    if (made.length) return;
    $$('.menu-card .panel', item).forEach((panel, i) => {
      const img = $('img', panel), el = shots[i] && makeScene(shots[i].s, shots[i]);
      if (!img || !el) return;
      el.classList.add('frame__img', 'sc--still', 'is-in');
      img.replaceWith(el); made.push(el);
    });
  };
  const run = on => made.forEach(el => el.classList.toggle('is-run', on && !reduce));
  item.addEventListener('pointerenter', () => { build(); run(true); });
  item.addEventListener('pointerleave', () => run(false));
  item.addEventListener('focusin', () => { build(); run(true); });
  item.addEventListener('focusout', () => { if (!item.matches(':hover')) run(false); });
  if (matchMedia('(min-width: 1024px)').matches) (window.requestIdleCallback || (f => setTimeout(f, 600)))(build);
}

function sequence(seq) {
  const steps = $$('.im-step', seq), frame = $('.im-seq__frame', seq), figs = steps.map(s => $('figure', s));
  if (!frame || figs.some(f => !f)) return () => {};
  const homes = figs.map(f => f.parentElement);
  let stage = null;
  /* off the pinned layout every step carries its own copy of the drawing, set to its moment */
  const dress = () => figs.forEach((f, n) => {
    if ($('.sc', f)) return;
    const s = makeScene(n);
    if (!s) return;
    s.classList.add('sc--still', 'is-in'); f.prepend(s); f.classList.add('has-scene'); watchScene(s);
  });
  steps.forEach(s => { const p = $('p', s); if (!p) return; const sp = document.createElement('span'); while (p.firstChild) sp.append(p.firstChild); p.append(sp); });
  const mq = matchMedia('(min-width: 1024px) and (min-height: 620px)');
  let live = false, k = -1;
  const show = i => { if (i === k) return; k = i; seq.dataset.step = String(i); if (stage) stage.dataset.s = String(i); steps.forEach((s, n) => s.classList.toggle('is-on', n === i)); figs.forEach((f, n) => f.classList.toggle('is-on', n === i)); };
  const onScroll = () => {
    if (!live) return;
    const r = seq.getBoundingClientRect(), total = Math.max(1, r.height - innerHeight), p = clamp(-r.top / total, 0, 1);
    show(Math.min(steps.length - 1, Math.floor(p * steps.length * 0.9999)));
    seq.style.setProperty('--sp', p.toFixed(4));
  };
  const sync = () => {
    const want = mq.matches && !reduce;
    if (want && !live) {
      live = true; seq.classList.add('is-live');
      if (!stage) {
        stage = makeScene(0);
        if (stage) {
          frame.prepend(stage); watchScene(stage);
          if (fine) {
            frame.addEventListener('pointermove', e => { const r = frame.getBoundingClientRect(); stage.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3)); stage.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3)); });
            frame.addEventListener('pointerleave', () => { stage.style.setProperty('--mx', '0'); stage.style.setProperty('--my', '0'); });
          }
        }
      }
      figs.forEach(f => frame.append(f)); k = -1; onScroll();
    }
    else if (!want && live) { live = false; seq.classList.remove('is-live'); figs.forEach((f, n) => { homes[n].append(f); f.classList.remove('is-on'); }); steps.forEach(s => s.classList.remove('is-on')); delete seq.dataset.step; k = -1; dress(); }
    else if (!want) dress();
  };
  mq.addEventListener('change', sync); sync();
  return onScroll;
}

/* ------------------------------------------------------------------ films: a tilt under the pointer, and a player that stays on the page */
function films() {
  const lb = $('.im-lightbox'); if (!lb) return;
  const box = $('.im-lightbox__frame', lb), close = $('.im-lightbox__close', lb);
  let back = null;
  const open = id => {
    back = document.activeElement;
    box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1" title="Film player" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    lb.hidden = false; doc.style.overflow = 'hidden'; close.focus();
  };
  const shut = () => { if (lb.hidden) return; lb.hidden = true; box.innerHTML = ''; doc.style.overflow = ''; if (back && back.focus) back.focus(); };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-film]');
    if (b) { e.preventDefault(); open(b.dataset.film); }
    else if (e.target === lb || e.target.closest('.im-lightbox__close')) shut();
  });
  addEventListener('keydown', e => { if (lb.hidden) return; if (e.key === 'Escape') shut(); else if (e.key === 'Tab') { e.preventDefault(); close.focus(); } });
  if (!fine || reduce) return;
  $$('.im-film').forEach(f => {
    const m = $('.im-film__media', f);
    f.addEventListener('pointermove', e => {
      const r = m.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      m.style.setProperty('--ry', ((x - 0.5) * 5).toFixed(2) + 'deg'); m.style.setProperty('--rx', ((0.5 - y) * 4).toFixed(2) + 'deg');
      m.style.setProperty('--gx', (x * 100).toFixed(1) + '%'); m.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
    }, { passive: true });
    f.addEventListener('pointerleave', () => { m.style.setProperty('--rx', '0deg'); m.style.setProperty('--ry', '0deg'); });
  });
}

/* ------------------------------------------------------------------ the five house rules: a fanned deck */
function deck() {
  const d = $('.im-deck'), note = $('.im-deck__note'); if (!d || !note) return;
  const base = note.textContent;
  const say = li => { note.textContent = li ? li.dataset.note : base; };
  $$('li', d).forEach(li => {
    li.addEventListener('pointerenter', () => say(li)); li.addEventListener('focus', () => say(li));
    li.addEventListener('click', () => { const up = !li.classList.contains('is-up'); $$('li', d).forEach(x => x.classList.remove('is-up')); li.classList.toggle('is-up', up); say(up ? li : null); });
    li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); } });
  });
  d.addEventListener('pointerleave', () => { const up = $('li.is-up', d); say(up); });
}

/* ------------------------------------------------------------------ is my town covered? (the five counties on the company's own service map) */
const TOWNS = {
  'Evans': 'Columbia County, Georgia', 'Martinez': 'Columbia County, Georgia', 'Grovetown': 'Columbia County, Georgia', 'Harlem': 'Columbia County, Georgia', 'Appling': 'Columbia County, Georgia',
  'Augusta': 'Richmond County, Georgia', 'Hephzibah': 'Richmond County, Georgia', 'Blythe': 'Richmond County, Georgia',
  'Thomson': 'McDuffie County, Georgia', 'Dearing': 'McDuffie County, Georgia',
  'Waynesboro': 'Burke County, Georgia', 'Sardis': 'Burke County, Georgia', 'Midville': 'Burke County, Georgia', 'Girard': 'Burke County, Georgia', 'Keysville': 'Burke County, Georgia',
  'Aiken': 'Aiken County, South Carolina', 'North Augusta': 'Aiken County, South Carolina', 'Graniteville': 'Aiken County, South Carolina', 'Belvedere': 'Aiken County, South Carolina',
  'Clearwater': 'Aiken County, South Carolina', 'Warrenville': 'Aiken County, South Carolina', 'Langley': 'Aiken County, South Carolina', 'Beech Island': 'Aiken County, South Carolina',
  'Jackson': 'Aiken County, South Carolina', 'New Ellenton': 'Aiken County, South Carolina', 'Wagener': 'Aiken County, South Carolina', 'Burnettown': 'Aiken County, South Carolina',
};
/* the redrawn map: a county lights under the pointer, the keyboard or the finder, and names its towns */
let mapApi = { pin() {} };
function serviceMap() {
  const map = $('.im-map'); if (!map) return;
  const legend = $('.im-map__legend', map), base = legend ? legend.innerHTML : '';
  const counties = $$('.im-county', map), overs = $$('.im-over', map), towns = $$('.im-town', map), byCounty = {};
  for (const [t, c] of Object.entries(TOWNS)) { const k = c.split(' County')[0]; (byCounty[k] = byCounty[k] || []).push(t); }
  let held = null;   // what the finder or a click chose: it comes back when the pointer leaves
  const show = (name, town) => {
    counties.forEach(c => c.classList.toggle('is-on', c.dataset.county === name));
    overs.forEach(c => c.classList.toggle('is-on', c.dataset.county === name));
    towns.forEach(t => t.classList.toggle('is-on', !!town && t.dataset.town === town));
    if (!legend) return;
    const c = counties.find(x => x.dataset.county === name);
    legend.innerHTML = c ? `<b>${c.getAttribute('aria-label')}</b><span>${byCounty[name].join(', ')}</span>` : base;
  };
  const rest = () => { if (held) show(held[0], held[1]); else show(null); };
  counties.forEach(c => {
    const on = () => show(c.dataset.county, held && held[0] === c.dataset.county ? held[1] : null);
    c.addEventListener('pointerenter', on); c.addEventListener('focus', on); c.addEventListener('blur', rest);
    c.addEventListener('click', () => { held = [c.dataset.county, null]; on(); });
    c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.click(); } });
  });
  map.addEventListener('pointerleave', rest);
  mapApi = { pin(county, town) { held = [county, town]; show(county, town); } };
}

function finder() {
  const root = $('.im-finder'); if (!root) return;
  const input = $('input', root), list = $('.im-finder__list', root), out = $('.im-finder__out', root);
  const names = Object.keys(TOWNS), first = ['Augusta', 'Evans', 'Martinez', 'Grovetown', 'Hephzibah', 'North Augusta', 'Aiken'];
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = name => {
    input.value = name;
    out.innerHTML = `<b>Yes.</b> ${esc(name)} is in ${TOWNS[name]}, inside the service area.`;
    mapApi.pin(TOWNS[name].split(' County')[0], name);
    $$('button', list).forEach(b => b.setAttribute('aria-pressed', String(b.textContent === name)));
  };
  const matches = q => { const s = q.trim().toLowerCase(); if (!s) return first; return names.filter(n => n.toLowerCase().startsWith(s)).concat(names.filter(n => !n.toLowerCase().startsWith(s) && n.toLowerCase().includes(s))).slice(0, 7); };
  const render = q => { list.innerHTML = matches(q).map(n => `<li><button type="button" aria-pressed="false">${esc(n)}</button></li>`).join(''); };
  input.addEventListener('input', () => { render(input.value); if (!input.value.trim()) out.textContent = ''; });
  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return; e.preventDefault();
    const q = input.value.trim(); if (!q) return;
    const m = matches(q), exact = names.find(n => n.toLowerCase() === q.toLowerCase());
    if (exact) pick(exact); else if (m.length === 1) pick(m[0]);
    else out.innerHTML = m.length ? 'Pick your town from the list.' : `We do not have “${esc(q)}” on the list. Call the office and ask.`;
  });
  list.addEventListener('click', e => { const b = e.target.closest('button'); if (b) pick(b.textContent); });
  render('');
}

/* ------------------------------------------------------------------ reveals, counts, the review bars */
function reveals() {
  const count = el => {
    const to = parseFloat(el.dataset.imCount), dec = Number(el.dataset.decimals || 0);
    if (reduce || !isFinite(to)) return;
    const t0 = performance.now(), dur = 1400;
    const step = now => { const t = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - t, 4); el.textContent = (to * e).toFixed(dec); if (t < 1) requestAnimationFrame(step); else el.textContent = to.toFixed(dec); };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
    if (e.target.matches('[data-im-count]')) count(e.target);
  }), { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
  $$('[data-reveal], .im-bars, [data-im-count]').forEach(el => io.observe(el));
  // a control reached by keyboard shows at once, wherever the scroll is
  document.addEventListener('focusin', e => { const r = e.target.closest && e.target.closest('[data-reveal]:not(.in)'); if (r) { r.style.transition = 'none'; r.classList.add('in'); } });
  const note = $('.im-bars__note');
  if (note) {
    const base = note.textContent;
    $$('.im-bars li').forEach(li => {
      const on = () => { note.textContent = li.dataset.note; }, off = () => { note.textContent = base; };
      li.addEventListener('pointerenter', on); li.addEventListener('pointerleave', off); li.addEventListener('focus', on); li.addEventListener('blur', off);
    });
  }
}

/* ------------------------------------------------------------------ small touches for a mouse: a magnetic button, a ring that follows */
function pointerTouches() {
  if (!fine || reduce) return;
  const mags = $$('.im-magnet');
  const ring = $('.im-cursor'), label = ring ? $('span', ring) : null;
  let tx = -100, ty = -100, x = -100, y = -100;
  addEventListener('pointermove', e => {
    tx = e.clientX; ty = e.clientY;
    for (const m of mags) {
      const r = m.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = e.clientX - cx, dy = e.clientY - cy;
      const near = Math.abs(dx) < r.width / 2 + 70 && Math.abs(dy) < r.height / 2 + 60;
      m.classList.toggle('is-near', near);
      m.style.setProperty('--mx', near ? (dx * 0.22).toFixed(1) + 'px' : '0px'); m.style.setProperty('--my', near ? (dy * 0.3).toFixed(1) + 'px' : '0px');
    }
    if (ring) {
      const lab = e.target.closest ? e.target.closest('[data-cursor]') : null;
      ring.classList.toggle('has-label', !!lab); if (label && lab) label.textContent = lab.dataset.cursor;
    }
  }, { passive: true });
  if (!ring) return;
  document.addEventListener('pointerleave', () => ring.classList.remove('has-label'));
  const loop = () => { x = lerp(x, tx, 0.24); y = lerp(y, ty, 0.24); ring.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}

/* ------------------------------------------------------------------ one scroll loop: the progress line, the nav's ground, the sequence, the towns, the last photograph */
function scrollLoop(onSeq) {
  const bar = $('.im-progress'), row = $('.im-marquee__row'), photo = $('.im-close__photo'), zones = $$('main > section, main > .im-marquee, footer.im-close');
  let half = 0;
  const measure = () => { half = row ? row.scrollWidth / 2 : 0; };
  const run = () => {
    ticking = false;
    const max = Math.max(1, doc.scrollHeight - innerHeight), y = scrollY;
    if (bar) bar.style.setProperty('--p', (y / max).toFixed(4));
    onSeq();
    // the nav stands on whatever is under it
    const probe = 36; let dark = false;
    for (const z of zones) {
      const r = z.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) { dark = z.classList.contains('im-dark') || (z.classList.contains('is-live') && (z.dataset.step === '0' || z.dataset.step === '1')); break; }
    }
    doc.dataset.nav = dark ? 'dark' : 'light';
    if (row && half && !reduce) row.style.setProperty('--x', (-((y * 0.45) % half)).toFixed(1) + 'px');
    if (photo && !reduce) { const r = photo.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) photo.firstElementChild.style.setProperty('--py', (((r.top + r.height / 2) - innerHeight / 2) * -0.08).toFixed(1) + 'px'); }
  };
  let ticking = false;
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } };
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', () => { measure(); req(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); req(); });
  measure(); run();
}

/* ------------------------------------------------------------------ a preview's form
   While the page is a preview the form does not send. It says so in its status line, after the kit's own
   check of the fields. At launch remove data-preview from the form and give it its address (data-endpoint). */
addEventListener('submit', e => {
  const f = e.target;
  if (!(f instanceof HTMLFormElement) || !f.dataset.preview || e.defaultPrevented) return;
  e.preventDefault();
  const out = $('[data-form-status]', f);
  if (out) out.textContent = f.dataset.preview;
});

/* ------------------------------------------------------------------ go */
const hero = $('.im-hero'); if (hero) glass(hero);
const tri = $('.im-triage'); if (tri) triage(tri);
const seq = $('.im-seq');
scrollLoop(seq ? sequence(seq) : () => {});
films(); deck(); serviceMap(); finder(); reveals(); pointerTouches(); menuScenes();
