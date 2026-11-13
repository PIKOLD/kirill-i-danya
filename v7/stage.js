/* v7 — 3D-дисплей на первом экране.
   Тонкий алюминиевый дисплей висит в темноте и показывает живые видео наших сайтов.
   Прокрутка: герой → дисплей уезжает вправо и листает 6 сайтов → разворачивается спиной со знаком «К&Д».
   Прогресс прокрутки и номер видео приходят из основной страницы через window.V7. */
import * as THREE from 'three';

const V = window.V7;
const canvas = document.getElementById('stageCanvas');
const box = canvas.parentElement;

function fail() { document.documentElement.classList.add('flat'); V.flat = true; }

let renderer;
if (document.documentElement.classList.contains('flat')) { /* «уменьшить движение» или 3D не успело — обычная страница */ }
else try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw new Error('no gl');
} catch (e) { fail(); }

if (renderer) start();

function start() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  cam.position.set(0, 0, 9);

  /* ── Окружение: «студия» из светящихся панелей, чтобы металл и стекло ловили холодные блики ── */
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: 0x16181e, side: THREE.BackSide })));
  const panel = (w, h, hex, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(pos[0], pos[1], pos[2]); m.lookAt(0, 0, 0); env.add(m);
  };
  panel(14, 4, 0xffffff, 3.2, [0, 8, 3]);
  panel(6, 10, 0xdfe8ff, 1.6, [-6, 1, 7]);
  panel(3, 9, 0x2b5bff, 3.0, [-9, 0, 2]);
  panel(3, 9, 0x6b4bff, 2.2, [9, 1, -1]);
  panel(9, 2, 0xeaf2ff, 1.4, [0, -5, 7]);
  panel(2, 2, 0x9cc4ff, 4.0, [4, 3, 8]);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.035).texture;
  pm.dispose();

  /* ── Геометрия ── */
  const W = 3.2, H = 2.0, D = 0.08, BV = 0.03;
  function rr(w, h, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }
  function flatUV(g) {
    g.computeBoundingBox();
    const b = g.boundingBox, p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - b.min.x) / (b.max.x - b.min.x), (p.getY(i) - b.min.y) / (b.max.y - b.min.y));
    uv.needsUpdate = true; return g;
  }

  const dev = new THREE.Group();
  scene.add(dev);

  const bodyGeo = new THREE.ExtrudeGeometry(rr(W, H, 0.15), { depth: D, bevelEnabled: true, bevelThickness: BV, bevelSize: BV, bevelSegments: 6, curveSegments: 16 });
  bodyGeo.center();
  const metal = new THREE.MeshPhysicalMaterial({ color: 0x8d939c, metalness: 1, roughness: 0.34, clearcoat: 0.3, clearcoatRoughness: 0.25 });
  dev.add(new THREE.Mesh(bodyGeo, metal));
  const front = D / 2 + BV;

  const glass = new THREE.Mesh(new THREE.ShapeGeometry(rr(W + 0.03, H + 0.03, 0.165), 16),
    new THREE.MeshPhysicalMaterial({ color: 0x030304, metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04 }));
  glass.position.z = front + 0.002; dev.add(glass);

  const SW = W - 0.14, SH = SW / 1.6;
  const screenGeo = flatUV(new THREE.ShapeGeometry(rr(SW, SH, 0.07), 12));
  const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.z = front + 0.004; dev.add(screen);

  /* блик по стеклу: полоса, которая скользит при повороте */
  const gloss = new THREE.Mesh(screenGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uShift: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uShift;
      void main(){ float d = vUv.x*0.75 + vUv.y*0.55 + uShift;
        float band = smoothstep(0.55,0.75,d) * (1.0 - smoothstep(0.75,1.05,d));
        gl_FragColor = vec4(vec3(0.85,0.92,1.0), band*0.09 + vUv.y*0.025); }`,
  }));
  gloss.position.z = front + 0.006; dev.add(gloss);

  /* спина: знак «К&Д» */
  const lc = document.createElement('canvas'); lc.width = 1024; lc.height = 640;
  const g2 = lc.getContext('2d');
  g2.fillStyle = '#fff'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
  g2.font = '700 250px Inter, -apple-system, Arial, sans-serif'; g2.fillText('К&Д', 512, 285);
  g2.font = '500 54px Inter, -apple-system, Arial, sans-serif'; g2.globalAlpha = 0.75; g2.fillText('Кирилл и Даня', 512, 470);
  const logoTex = new THREE.CanvasTexture(lc); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 4;
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.94),
    new THREE.MeshBasicMaterial({ color: 0xdfe8ff, map: logoTex, transparent: true, opacity: 0.94, toneMapped: false }));
  logo.position.z = -(front + 0.003); logo.rotation.y = Math.PI; dev.add(logo);
  /* шрифт мог подгрузиться позже — перерисуем знак */
  document.fonts && document.fonts.ready.then(() => {
    g2.clearRect(0, 0, 1024, 640); g2.globalAlpha = 1;
    g2.font = '700 250px Inter, -apple-system, Arial, sans-serif'; g2.fillText('К&Д', 512, 285);
    g2.font = '500 54px Inter, -apple-system, Arial, sans-serif'; g2.globalAlpha = 0.75; g2.fillText('Кирилл и Даня', 512, 470);
    logoTex.needsUpdate = true;
  });

  /* мягкое сияние позади */
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uK: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uK;
      void main(){ vec2 p = (vUv - 0.5) * vec2(1.6, 1.0);
        float a = exp(-dot(p - vec2(-0.12, 0.02), p - vec2(-0.12, 0.02)) * 16.0);
        float b = exp(-dot(p - vec2(0.16, -0.04), p - vec2(0.16, -0.04)) * 18.0);
        vec3 c = vec3(0.10,0.24,0.85) * a + vec3(0.30,0.20,0.85) * b;
        gl_FragColor = vec4(c * 0.2 * uK, 1.0); }`,
  }));
  halo.position.z = -3; scene.add(halo);

  /* ── Видео ── */
  const list = V.videos;
  const posters = list.map(v => { const t = new THREE.TextureLoader().load(v.poster); t.colorSpace = THREE.SRGBColorSpace; return t; });
  function mkVideo() {
    const el = document.createElement('video');
    el.muted = true; el.loop = true; el.playsInline = true; el.setAttribute('playsinline', ''); el.preload = 'auto';
    const tex = new THREE.VideoTexture(el); tex.colorSpace = THREE.SRGBColorSpace;
    return { el, tex };
  }
  const slots = [mkVideo(), mkVideo()];
  let frontSlot = 0, cur = -1, running = false;
  screenMat.map = posters[0];
  function show(i) {
    if (i === cur) return; cur = i;
    screenMat.map = posters[i]; screenMat.needsUpdate = true;
    if (V.still) return;
    const nx = slots[1 - frontSlot];
    nx.el.onplaying = () => {
      if (cur !== i) return;
      screenMat.map = nx.tex; screenMat.needsUpdate = true;
      slots[frontSlot].el.pause(); frontSlot = 1 - frontSlot;
    };
    nx.el.src = list[i].src;
    if (running) nx.el.play().catch(() => {});
  }
  show(0);

  /* ── Позы по прокрутке ── */
  const DH = H + 2 * BV + 0.06, DW = W + 0.1;
  function view() { const hv = 2 * cam.position.z * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)); return [hv * cam.aspect, hv]; }
  function poses() {
    const [wv, hv] = view(), mob = cam.aspect < 0.9;
    /* на компьютере дисплей крупный и уходит за нижний край, как товар на странице Apple */
    const top = Math.min(0.78, V.heroBottom || 0.5), bot = mob ? 0.97 : 1.2, avail = (bot - top) * hv;
    const sH = Math.max(0.35, Math.min(1.3, avail / DH, wv * (mob ? 0.9 : 0.62) / DW));
    const hero = { x: 0, y: (0.5 - top) * hv - DH * sH / 2, s: sH, ry: 0 };
    let live;
    if (mob) { const s = Math.min(wv * 0.9 / DW, hv * 0.36 / DH); live = { x: 0, y: (0.5 - 0.42) * hv, s, ry: -0.1 }; }
    else { const s = Math.min(1.45, wv * 0.54 / DW, hv * 0.72 / DH); live = { x: wv * 0.5 - wv * 0.06 - DW * s / 2, y: -hv * 0.02, s, ry: -0.14 }; }
    const sb = Math.min(1.1, wv * 0.8 / DW, hv * 0.46 / DH);
    const back = { x: 0, y: -hv * (mob ? 0.1 : 0.12), s: sb, ry: Math.PI + 0.32 };
    return [[0, hero], [0.17, hero], [0.27, live], [0.7, live], [0.82, back], [1, back]];
  }
  const ease = t => t * t * (3 - 2 * t);
  function poseAt(p) {
    const K = poses();
    for (let i = 0; i < K.length - 1; i++) {
      const [p0, a] = K[i], [p1, b] = K[i + 1];
      if (p <= p1) { const t = ease(Math.min(1, Math.max(0, (p - p0) / (p1 - p0 || 1)))); return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, s: a.s + (b.s - a.s) * t, ry: a.ry + (b.ry - a.ry) * t }; }
    }
    return K[K.length - 1][1];
  }

  /* мышь */
  let mx = 0, my = 0, tmx = 0, tmy = 0;
  addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; tmx = e.clientX / innerWidth * 2 - 1; tmy = e.clientY / innerHeight * 2 - 1; }, { passive: true });

  function resize() {
    const w = box.clientWidth, h = box.clientHeight;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  resize(); addEventListener('resize', resize);

  const st = { x: 0, y: 0, s: 1, ry: 0 }; let first = true;
  const born = performance.now(); let last = performance.now();
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (V.vid !== cur) show(V.vid);
    const tg = poseAt(V.p || 0);
    if (first) { Object.assign(st, tg); first = false; }
    const k = 1 - Math.exp(-dt * 6);
    st.x += (tg.x - st.x) * k; st.y += (tg.y - st.y) * k; st.s += (tg.s - st.s) * k; st.ry += (tg.ry - st.ry) * k;
    mx += (tmx - mx) * k * 0.6; my += (tmy - my) * k * 0.6;
    const intro = V.still ? 1 : Math.min(1, (now - born) / 1700), io = 1 - Math.pow(1 - intro, 3);
    const t = now / 1000;
    dev.position.set(st.x, st.y + (V.still ? 0 : Math.sin(t * 0.7) * 0.025), 0);
    dev.scale.setScalar(st.s * (0.88 + 0.12 * io));
    dev.rotation.y = st.ry + mx * 0.16 - (1 - io) * 0.8;
    dev.rotation.x = my * 0.07 + (1 - io) * 0.18;
    gloss.material.uniforms.uShift.value = dev.rotation.y * 0.5 + mx * 0.08;
    halo.position.x = st.x * 0.7; halo.position.y = st.y * 0.6;
    renderer.render(scene, cam);
  }

  function run(on) {
    if (on === running) return; running = on;
    const v = slots[frontSlot].el;
    if (on) { last = performance.now(); if (!V.still) { slots.forEach(s => s.el.src && s === slots[frontSlot] && s.el.play().catch(() => {})); } requestAnimationFrame(frame); }
    else slots.forEach(s => s.el.pause());
    void v;
  }
  new IntersectionObserver(es => run(es[0].isIntersecting), { rootMargin: '100px' }).observe(box.parentElement);
  document.addEventListener('visibilitychange', () => { if (document.hidden) run(false); else { const r = box.parentElement.getBoundingClientRect(); run(r.bottom > 0 && r.top < innerHeight); } });
  V.ready = true;
  document.documentElement.classList.add('gl');
}
