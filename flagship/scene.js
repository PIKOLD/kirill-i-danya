// Сцена флагмана «МГЛА»: стеклянный флакон, собранный из простых фигур прямо в коде.
// Прокрутка ведёт по главам: герой → три аромата → разбор флакона → облако → покупка.
import * as THREE from 'three';

const PI = Math.PI, lerp = (a, b, x) => a + (b - a) * x, clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = x => x * x * (3 - 2 * x);
const SERIF = "'Cormorant Garamond', 'Times New Roman', serif";

/* три аромата: фон страницы, цвет жидкости, цвет текста */
export const SCENTS = [
  { id: 'night', name: 'Белая ночь', bg: '#C9CFE6', liquid: '#8F9EF0', fg: '#14162B', ink: '#1B1E3A' },
  { id: 'peat', name: 'Торф и мёд', bg: '#1C1009', liquid: '#E0861A', fg: '#F6EBDD', ink: '#FFF4E2' },
  { id: 'stone', name: 'Мокрый гранит', bg: '#232C29', liquid: '#7FAA9B', fg: '#E8F1EC', ink: '#F2FBF6' },
];

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const api = { t, redraw: (...a) => { draw(c.getContext('2d'), w, h, ...a); t.needsUpdate = true; } };
  return api;
}
/* призма со скруглёнными углами и фаской: ширина, высота, глубина, радиус, фаска */
function flask(w, h, d, r, bev) {
  const s = new THREE.Shape(), x = -w / 2 + bev, y = -h / 2 + bev, ww = w - bev * 2, hh = h - bev * 2;
  s.moveTo(x + r, y); s.lineTo(x + ww - r, y); s.quadraticCurveTo(x + ww, y, x + ww, y + r);
  s.lineTo(x + ww, y + hh - r); s.quadraticCurveTo(x + ww, y + hh, x + ww - r, y + hh);
  s.lineTo(x + r, y + hh); s.quadraticCurveTo(x, y + hh, x, y + hh - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 8, curveSegments: 24 });
  g.center(); return g;
}
function drawWord(ctx, w, h, text, color, italic) {
  ctx.clearRect(0, 0, w, h); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = h * .78; ctx.font = `${italic ? 'italic ' : ''}500 ${size}px ${SERIF}`;
  if (!italic) { try { ctx.letterSpacing = (size * .12) + 'px'; } catch (e) {} }
  const m = ctx.measureText(text).width; if (m > w * .94) { size *= w * .94 / m; ctx.font = `${italic ? 'italic ' : ''}500 ${size}px ${SERIF}`; if (!italic) { try { ctx.letterSpacing = (size * .12) + 'px'; } catch (e) {} } }
  ctx.fillText(text, w / 2, h / 2 + size * .04);
}
function drawLabel(ctx, w, h, name, ink) {
  ctx.clearRect(0, 0, w, h); ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `500 ${h * .2}px ${SERIF}`; try { ctx.letterSpacing = (h * .06) + 'px'; } catch (e) {}
  ctx.fillText('МГЛА', w / 2 + h * .03, h * .3);
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  ctx.globalAlpha = .7; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * .3, h * .48); ctx.lineTo(w * .7, h * .48); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.font = `italic 400 ${h * .13}px ${SERIF}`; ctx.fillText(name, w / 2, h * .63);
  ctx.font = `400 ${h * .065}px 'Inter', sans-serif`; ctx.globalAlpha = .8; ctx.fillText('eau de parfum  ·  50 ml', w / 2, h * .83); ctx.globalAlpha = 1;
}
function drawGranite(ctx, w, h) {
  ctx.fillStyle = '#34363a'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 5200; i++) { const v = Math.random(); ctx.fillStyle = v > .55 ? `rgba(215,218,222,${.1 + Math.random() * .4})` : `rgba(8,8,10,${.2 + Math.random() * .5})`; const s = Math.random() * 2.4 + .5; ctx.fillRect(Math.random() * w, Math.random() * h, s, s); }
}
function drawSoft(ctx, w, h, inner) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, inner); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.clearRect(0, 0, w, h); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

export function createFlagship(canvas, { reduce = false, onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, canvas.clientWidth < 820 ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, 1, .1, 60);
  const bg = new THREE.Color(SCENTS[0].bg), liq = new THREE.Color(SCENTS[0].liquid), fg = new THREE.Color(SCENTS[0].fg);
  scene.background = bg;

  /* студийный свет для отражений в стекле */
  (function () {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(30, 16, 8), new THREE.MeshBasicMaterial({ color: 0x15151a, side: THREE.BackSide })));
    const panel = (c, i, x, y, z, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
    panel('#ffffff', 6, 0, 13, 3, 12, 5); panel('#ffffff', 5, -13, 2, 5, 3, 12); panel('#ffffff', 5, 13, 3, 4, 3, 12); panel('#ffffff', 2, 0, 1, 15, 10, 3); panel('#ffffff', 1.4, 0, -9, 0, 14, 14);
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, .03).texture; pm.dispose();
  })();
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-3, 5, 6); scene.add(key);

  /* ── флакон ── */
  const bottle = new THREE.Group(); scene.add(bottle);
  const BW = 1.02, BH = 1.46, BD = .5;
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .03, metalness: 0, transmission: 1, thickness: .55, ior: 1.5, dispersion: 2, envMapIntensity: 1, specularIntensity: 1 });
  const glass = new THREE.Mesh(flask(BW, BH, BD, .13, .055), glassMat); bottle.add(glass);
  const liquidMat = new THREE.MeshPhysicalMaterial({ color: liq, roughness: .18, metalness: 0, clearcoat: .7, clearcoatRoughness: .1, emissive: liq, emissiveIntensity: .32 });
  const liquid = new THREE.Mesh(flask(BW - .15, BH - .42, BD - .17, .09, .03), liquidMat); liquid.position.y = -.13; bottle.add(liquid);
  const labelTex = canvasTex(768, 640, drawLabel);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(.66, .55), new THREE.MeshBasicMaterial({ map: labelTex.t, transparent: true, toneMapped: false, depthWrite: false }));
  label.position.set(0, -.1, BD / 2 + .004); label.renderOrder = 4; bottle.add(label);
  const metal = new THREE.MeshStandardMaterial({ color: 0xd9cdb6, metalness: 1, roughness: .2 });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(.21, .21, .1, 48), metal); collar.position.y = BH / 2 + .04; bottle.add(collar);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .17, 32), metal); stem.position.y = BH / 2 + .17; bottle.add(stem);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(.115, .115, .13, 40), metal); head.position.y = BH / 2 + .3; bottle.add(head);
  const granite = canvasTex(256, 256, drawGranite); granite.redraw(); granite.t.wrapS = granite.t.wrapT = THREE.RepeatWrapping;
  const capMat = new THREE.MeshStandardMaterial({ map: granite.t, roughness: .62, metalness: .08, transparent: true });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.275, .275, .56, 64), capMat); cap.position.y = BH / 2 + .36; bottle.add(cap);
  const REST = { cap: cap.position.y, head: head.position.y, stem: stem.position.y, collar: collar.position.y };

  /* тень и цветной отсвет под флаконом */
  const soft = canvasTex(256, 256, drawSoft); soft.redraw('rgba(0,0,0,.55)');
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5), new THREE.MeshBasicMaterial({ map: soft.t, transparent: true, depthWrite: false, toneMapped: false, opacity: .5 }));
  shadow.rotation.x = -PI / 2; scene.add(shadow);
  const softW = canvasTex(256, 256, drawSoft); softW.redraw('rgba(255,255,255,.9)');
  const caustic = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3), new THREE.MeshBasicMaterial({ map: softW.t, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, color: liq, opacity: .55 }));
  caustic.rotation.x = -PI / 2; scene.add(caustic);

  /* большое слово позади флакона — стекло его преломляет */
  const WORDS = ['МГЛА', ...SCENTS.map(s => s.name)];
  const wordA = canvasTex(2048, 640, drawWord), wordB = canvasTex(2048, 640, drawWord);
  const mkWord = t => { const m = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 3), new THREE.MeshBasicMaterial({ map: t.t, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 })); m.position.set(0, .25, -2.4); m.renderOrder = -2; scene.add(m); return m; };
  const wA = mkWord(wordA), wB = mkWord(wordB);
  let wordCur = -1, wordMix = 1, wordFront = wA, wordBack = wB, wordTexFront = wordA, wordTexBack = wordB;
  function setWord(i) {
    if (i === wordCur) return; wordCur = i;
    [wordFront, wordBack] = [wordBack, wordFront]; [wordTexFront, wordTexBack] = [wordTexBack, wordTexFront];
    wordTexFront.redraw(WORDS[i], '#' + tgt.fg.getHexString(), i > 0); wordMix = 0;
  }

  /* облако аромата */
  const N = 900, mpos = new Float32Array(N * 3), mseed = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { mseed[i * 4] = Math.random(); mseed[i * 4 + 1] = Math.random() * 2 - 1; mseed[i * 4 + 2] = Math.random() * 2 - 1; mseed[i * 4 + 3] = .5 + Math.random(); }
  const mgeo = new THREE.BufferGeometry(); mgeo.setAttribute('position', new THREE.BufferAttribute(mpos, 3));
  const mist = new THREE.Points(mgeo, new THREE.PointsMaterial({ map: softW.t, size: .95, transparent: true, depthWrite: false, opacity: 0, color: 0xffffff, sizeAttenuation: true, blending: THREE.NormalBlending }));
  mist.frustumCulled = false; mist.renderOrder = 6; scene.add(mist);

  /* ── главы: 0 герой, 1–3 ароматы, 4 разбор, 5 облако, 6 покупка ── */
  const K = {
    x: [0, 1.35, 1.35, 1.35, 0, -1.25, -1.5], y: [0, 0, 0, 0, -.62, -.1, 0], ry: [-.42, .45, .45 + PI * 2, .45 + PI * 4, PI * 6 - .35, PI * 6 + .8, PI * 6 + .45],
    z: [7.4, 6.6, 6.6, 6.6, 9.4, 7.4, 7.0], boom: [0, 0, 0, 0, 1, .5, 0], mist: [0, 0, 0, 0, 0, 1, 0], word: [1, 0, 0, 0, 0, 0, 0], wordX: [0, 1.7, 1.7, 1.7, 0, 0, 0],
  };
  const at = (arr, t) => { const i = Math.min(arr.length - 2, Math.floor(t)), f = smooth(clamp((t - i - .14) / .72)); return lerp(arr[i], arr[i + 1], f); };

  let T = 0, Ts = 0, pick = 2, scentCur = -1, mx = 0, my = 0, tx = 0, ty = 0, asp = 1, vis = true, intro = reduce ? 1 : 0, dragV = 0, drag = 0, dragging = false, lastX = 0, mistClock = 0, ready = false;
  const tgt = { bg: new THREE.Color(), liq: new THREE.Color(), fg: new THREE.Color() };
  function setScent(i) {
    if (i === scentCur) return; scentCur = i; const s = SCENTS[i];
    tgt.bg.set(s.bg); tgt.liq.set(s.liquid); tgt.fg.set(s.fg); labelTex.redraw(s.name, s.ink);
  }
  const size = () => { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); asp = w / h; cam.aspect = asp; cam.updateProjectionMatrix(); };
  new ResizeObserver(size).observe(canvas); size();
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; } if (dragging) { dragV = (e.clientX - lastX) * .012; drag += dragV; lastX = e.clientX; } }, { passive: true });
  canvas.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; canvas.classList.add('grab'); });
  addEventListener('pointerup', () => { dragging = false; canvas.classList.remove('grab'); });
  document.addEventListener('visibilitychange', () => { vis = !document.hidden; });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { ready = true; scentCur = -1; wordCur = -1; });

  const anchors = { cap: new THREE.Vector3(), head: new THREE.Vector3(), glass: new THREE.Vector3(), liquid: new THREE.Vector3() }, out = {};
  const t0 = performance.now(); let last = t0;
  function frame(now) {
    requestAnimationFrame(frame); if (!vis) return;
    const raw = Math.max(0, Math.min(.5, (now - last) / 1000)), dt = Math.min(.05, raw), t = reduce ? 0 : (now - t0) / 1000; last = now;
    Ts += (T - Ts) * (reduce ? 1 : Math.min(1, dt * 5)); mx += (tx - mx) * .05; my += (ty - my) * .05;
    if (ready) intro = Math.min(1, intro + raw / 2.2);
    const io = 1 - Math.pow(1 - intro, 3), tt = clamp(Ts, 0, 6), wide = asp >= 1.1, xk = wide ? 1 : 0;
    if (!dragging) { dragV *= .94; drag += dragV; }

    /* какой аромат сейчас: по главам, после третьей — выбранный в покупке */
    const si = tt < 1.5 ? 0 : tt < 2.5 ? 1 : tt < 3.5 ? 2 : pick;
    if (ready) { setScent(si); setWord(tt < .5 ? 0 : si + 1); }
    const ck = Math.min(1, dt * 4.5); bg.lerp(tgt.bg, ck); liq.lerp(tgt.liq, ck); fg.lerp(tgt.fg, ck);
    liquidMat.color.copy(liq); liquidMat.emissive.copy(liq); caustic.material.color.copy(liq);

    const boom = at(K.boom, tt), mistK = at(K.mist, tt);
    bottle.position.set(at(K.x, tt) * xk, at(K.y, tt) + (1 - io) * -2.6 + Math.sin(t * .8) * .025 + (wide ? 0 : .8), 0);
    bottle.rotation.set(my * .12 + Math.sin(t * .5) * .02, at(K.ry, tt) + drag + mx * .35 + t * .06 * (1 - clamp(tt)), Math.sin(t * .4) * .012);
    cap.position.y = REST.cap + boom * .86; cap.rotation.y = boom * 1.2;
    head.position.y = REST.head + boom * .5; stem.position.y = REST.stem + boom * .33; collar.position.y = REST.collar + boom * .15;
    capMat.opacity = 1 - clamp((mistK - .25) * 2.2); cap.visible = capMat.opacity > .02;
    label.position.z = BD / 2 + .004 + clamp(boom * 2 - mistK * 3) * .42;
    liquid.position.y = -.13 - clamp(boom * 2 - mistK * 3) * 0;

    const floorY = bottle.position.y - BH / 2 - .02;
    shadow.position.set(bottle.position.x + .15, floorY, .1); caustic.position.set(bottle.position.x - .1, floorY + .001, .25);
    shadow.material.opacity = .42 * io; caustic.material.opacity = .5 * io;

    /* слово позади: меняется с переходом через прозрачность */
    wordMix = Math.min(1, wordMix + dt * 2.2); const wo = at(K.word, tt) * io, wx = at(K.wordX, tt) * xk * .35;
    wordFront.material.opacity = wo * wordMix; wordBack.material.opacity = wo * (1 - wordMix);
    [wordFront, wordBack].forEach(m => { m.position.x = wx + mx * -.25; m.position.y = .25 + (wide ? 0 : 1.5); m.scale.setScalar(wide ? 1 : .62); });

    /* облако: частицы летят от распылителя вперёд и вверх */
    mist.material.opacity = mistK * .17; mist.visible = mistK > .01;
    if (mist.visible) {
      mistClock += raw; const p = mgeo.attributes.position, dir = bottle.rotation.y, hx = bottle.position.x, hy = bottle.position.y + head.position.y;
      const fx = Math.sin(dir), fz = Math.cos(dir);
      for (let i = 0; i < N; i++) {
        const life = (mseed[i * 4] + mistClock * .13 * mseed[i * 4 + 3]) % 1, sp = Math.pow(life, .7) * 2.1, wob = Math.sin(life * 6 + i) * .1;
        p.setXYZ(i, hx + fx * (.12 + sp * 1.05) + mseed[i * 4 + 1] * sp * .42 + wob, hy + sp * .12 + mseed[i * 4 + 2] * sp * .36, fz * (.12 + sp * 1.05) + mseed[i * 4 + 2] * sp * .3);
      }
      p.needsUpdate = true; mist.material.color.copy(liq).lerp(new THREE.Color(0xffffff), .72);
    }

    const zk = wide ? 1 : lerp(1.85, 1.2, clamp((asp - .45) / .65));
    cam.position.set(mx * .45, .15 + my * -.2, at(K.z, tt) * zk); cam.lookAt(0, wide ? .08 : .5, 0);
    renderer.render(scene, cam);

    /* точки для подписей в разборе и цвета для страницы */
    anchors.cap.set(0, cap.position.y, 0); anchors.head.set(0, head.position.y, 0); anchors.glass.set(BW / 2, .35, 0); anchors.liquid.set(-BW / 2 + .1, -.35, 0);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    for (const k in anchors) { const v = anchors[k].clone().applyMatrix4(bottle.matrixWorld).project(cam); out[k] = [(v.x * .5 + .5) * w, (-v.y * .5 + .5) * h]; }
    onFrame && onFrame({ T: tt, bg: '#' + bg.getHexString(), fg: '#' + fg.getHexString(), liquid: '#' + liq.getHexString(), scent: si, anchors: out, boom, intro: io });
  }
  requestAnimationFrame(frame);
  return { setProgress(v) { T = v; }, setPick(i) { pick = i; }, get pick() { return pick; } };
}
