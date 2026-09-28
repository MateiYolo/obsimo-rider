// Stage plot 3D (three.js). Unités : mètres. x = gauche/droite vu du public, z = vers le public.
// Pour déplacer un élément, change ses coordonnées dans LAYOUT ci-dessous.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// rot = rotation en radians (Math.PI / 2 = quart de tour).
// Les 2 flightcases forment un L : le n°2 face au public, le n°1 en coude sur le côté du musicien.
const LAYOUT = {
  flightcase1: { x: -0.4, z: -0.25, rot: Math.PI / 2, w: 1.1, h: 1.0, d: 0.6, labelDx: -0.35, labelDz: -0.35 },
  flightcase2: { x: 0.25, z: 0, w: 0.7, h: 1.0, d: 0.6 },
  musician: { x: 0.2, z: -0.72 },
  guitar: { x: 1.2, z: -0.45, rot: -0.35 },
  di: { x: -1.3, z: -0.6 },
  power: { x: -1.2, z: -0.05, rot: Math.PI / 2 },
  wedge1: { x: -1.2, z: 1.35 },
  wedge2: { x: 1.55, z: 1.25 },
};

const LABELS = {
  fr: {
    fc1: 'Flightcase 1<small>≈ 100–120 × 90–110 cm (L × H)</small>',
    fc2: 'Flightcase 2<small>≈ 60–80 × 90–110 cm (L × H)</small>',
    musician: 'Musicien (Andreï)',
    guitar: 'Guitare',
    di: 'DI stéréo<br>+ 4 prises 230V',
    wedge1: 'Retour 1',
    wedge2: 'Retour 2',
    audience: 'Public',
    front: 'Face',
    top: 'Dessus',
    free: '3D',
    hint: 'Glisse pour tourner autour du plateau',
  },
  en: {
    fc1: 'Flightcase 1<small>≈ 100–120 × 90–110 cm (W × H)</small>',
    fc2: 'Flightcase 2<small>≈ 60–80 × 90–110 cm (W × H)</small>',
    musician: 'Musician (Andreï)',
    guitar: 'Guitar',
    di: 'Stereo DI<br>+ 4 × 230V outlets',
    wedge1: 'Monitor 1',
    wedge2: 'Monitor 2',
    audience: 'Audience',
    front: 'Front',
    top: 'Top',
    free: '3D',
    hint: 'Drag to orbit around the stage',
  },
};

const VIEWS = {
  free: { pos: [2.6, 4.5, 5.3], target: [-0.1, 0.4, 0.3] },
  front: { pos: [0, 1.5, 6.2], target: [0, 0.8, 0.2] },
  top: { pos: [0, 7.2, 0.35], target: [0, 0, 0.3] },
};

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, ...opts });
const M = {
  floor: mat(0x1c1c1e, { roughness: 0.95 }),
  case: mat(0x151515, { roughness: 0.5 }),
  alu: mat(0xb9bcc2, { metalness: 0.8, roughness: 0.35 }),
  body: mat(0x0b0b0b, { roughness: 0.9 }),
  gear: mat(0x2a2a2e, { roughness: 0.4 }),
  screen: mat(0xcfd3d8, { metalness: 0.6, roughness: 0.3 }),
  di: mat(0x3e6f7a, { metalness: 0.4, roughness: 0.4 }),
  sunburst: mat(0xb5561c, { roughness: 0.35 }),
  wood: mat(0xe8d9b5, { roughness: 0.5 }),
  rubber: mat(0x0e0e0e, { roughness: 0.95 }),
  led: mat(0xff5a2a, { emissive: 0xff5a2a, emissiveIntensity: 1.2 }),
};

function box(w, h, d, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function label(html, cls = '') {
  const el = document.createElement('div');
  el.className = `s3-label ${cls}`;
  el.innerHTML = html;
  return new CSS2DObject(el);
}

function flightcase({ w, h, d }) {
  const g = new THREE.Group();
  const wheel = 0.1;
  const body = box(w, h - wheel, d, M.case);
  body.position.y = wheel + (h - wheel) / 2;
  g.add(body);
  // Cornières alu
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(body.geometry),
    new THREE.LineBasicMaterial({ color: 0xc9ccd2 }),
  );
  edges.position.copy(body.position);
  g.add(edges);
  // Bandes alu horizontales + poignées sur la face avant
  for (const y of [wheel + 0.02, h - 0.02, wheel + (h - wheel) * 0.62]) {
    const strip = box(w + 0.01, 0.025, d + 0.01, M.alu);
    strip.position.y = y;
    g.add(strip);
  }
  for (const sx of [-1, 1]) {
    const handle = box(0.14, 0.05, 0.02, M.alu);
    handle.position.set(sx * w * 0.3, wheel + (h - wheel) * 0.4, d / 2 + 0.01);
    g.add(handle);
  }
  // Roulettes
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 16), M.rubber);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(sx * (w / 2 - 0.08), 0.045, sz * (d / 2 - 0.08));
    g.add(wh);
  }
  g.userData.top = h;
  return g;
}

function musician() {
  const g = new THREE.Group();
  const add = (geo, x, y, z, rz = 0, rx = 0) => {
    const m = new THREE.Mesh(geo, M.body);
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, rz);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  for (const s of [-1, 1]) add(new THREE.CapsuleGeometry(0.07, 0.72, 4, 10), s * 0.1, 0.45, 0); // jambes
  add(new THREE.CapsuleGeometry(0.17, 0.42, 4, 12), 0, 1.13, 0); // torse
  add(new THREE.SphereGeometry(0.12, 16, 12), 0, 1.6, 0); // tête
  for (const s of [-1, 1]) add(new THREE.CapsuleGeometry(0.055, 0.62, 4, 8), s * 0.36, 1.62, 0, -s * 0.55); // bras levés
  return g;
}

function guitar() {
  // Guitare électrique type Strat sur stand
  const g = new THREE.Group();
  const stand = mat(0x1a1a1a, { roughness: 0.6 });
  const legGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.34, 6);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, stand); // pieds avant
    leg.position.set(s * 0.1, 0.15, 0.06);
    leg.rotation.set(0.35, 0, s * 0.35);
    g.add(leg);
  }
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.85, 6), stand);
  back.position.set(0, 0.42, -0.12);
  back.rotation.x = -0.12;
  g.add(back);
  const cradle = box(0.26, 0.02, 0.08, stand);
  cradle.position.set(0, 0.28, 0.02);
  g.add(cradle);

  const gt = new THREE.Group();
  const extrude = (shape, depth, material) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 16 });
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true;
    return m;
  };
  // Corps double pan coupé
  const b = new THREE.Shape();
  b.moveTo(0, -0.22);
  b.bezierCurveTo(0.1, -0.23, 0.17, -0.18, 0.165, -0.08);
  b.bezierCurveTo(0.16, 0.0, 0.12, 0.0, 0.12, 0.03);
  b.bezierCurveTo(0.12, 0.08, 0.15, 0.15, 0.13, 0.2);
  b.bezierCurveTo(0.11, 0.23, 0.06, 0.16, 0.035, 0.12);
  b.lineTo(-0.035, 0.12);
  b.bezierCurveTo(-0.06, 0.2, -0.08, 0.27, -0.11, 0.26);
  b.bezierCurveTo(-0.14, 0.25, -0.13, 0.1, -0.12, 0.05);
  b.bezierCurveTo(-0.11, 0.0, -0.17, -0.02, -0.165, -0.08);
  b.bezierCurveTo(-0.17, -0.18, -0.1, -0.23, 0, -0.22);
  const body = extrude(b, 0.04, M.sunburst);
  body.position.z = -0.02;
  gt.add(body);
  // Pickguard blanc
  const pg = new THREE.Shape();
  pg.moveTo(-0.03, 0.13);
  pg.bezierCurveTo(-0.09, 0.12, -0.12, 0.02, -0.09, -0.06);
  pg.bezierCurveTo(-0.06, -0.14, 0.0, -0.13, 0.03, -0.1);
  pg.bezierCurveTo(0.08, -0.05, 0.09, 0.02, 0.06, 0.06);
  pg.lineTo(0.03, 0.13);
  pg.lineTo(-0.03, 0.13);
  const guard = extrude(pg, 0.003, mat(0xf4f1ea, { roughness: 0.4 }));
  guard.position.z = 0.026;
  gt.add(guard);
  // 3 micros simple bobinage + chevalet
  for (const [y, r] of [[0.07, 0], [0.0, 0], [-0.06, 0.15]]) {
    const pu = box(0.075, 0.018, 0.01, mat(0xf4f1ea, { roughness: 0.3 }));
    pu.position.set(0, y, 0.034);
    pu.rotation.z = r;
    gt.add(pu);
  }
  const bridge = box(0.075, 0.03, 0.008, M.alu);
  bridge.position.set(0, -0.12, 0.03);
  gt.add(bridge);
  for (const [x, y] of [[0.075, -0.12], [0.09, -0.16]]) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.015, 12), mat(0xf4f1ea));
    knob.rotation.x = Math.PI / 2;
    knob.position.set(x, y, 0.035);
    gt.add(knob);
  }
  // Manche, touche, tête
  const neck = box(0.048, 0.56, 0.022, M.wood);
  neck.position.set(0, 0.39, 0.012);
  const board = box(0.046, 0.56, 0.004, mat(0x3b2416));
  board.position.set(0, 0.39, 0.025);
  const head = new THREE.Shape();
  head.moveTo(-0.024, 0);
  head.lineTo(0.024, 0);
  head.bezierCurveTo(0.03, 0.08, 0.05, 0.14, 0.04, 0.19);
  head.bezierCurveTo(0.02, 0.2, -0.01, 0.2, -0.024, 0.17);
  head.lineTo(-0.024, 0);
  const hs = extrude(head, 0.012, M.wood);
  hs.position.set(0, 0.67, 0.002);
  gt.add(neck, board, hs);
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 8), M.alu);
    t.rotation.x = Math.PI / 2;
    t.position.set(-0.014 + i * 0.006, 0.7 + i * 0.025, 0.02);
    gt.add(t);
  }
  // Posée dans le stand, légèrement inclinée vers l'arrière
  gt.position.set(0, 0.5, 0.03);
  gt.rotation.x = -0.12;
  g.add(gt);
  return g;
}

function wedge() {
  // Profil vu de côté : dos vertical, face HP inclinée. Extrudé sur la largeur du retour.
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0.45, 0);
  s.lineTo(0.45, 0.12);
  s.lineTo(0.1, 0.38);
  s.lineTo(0, 0.38);
  s.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.58, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 });
  geo.translate(-0.225, 0, -0.29);
  const m = new THREE.Mesh(geo, M.gear);
  m.castShadow = m.receiveShadow = true;
  m.rotation.y = Math.PI / 2; // la face HP regarde vers l'arrière-scène (le musicien)
  const g = new THREE.Group();
  g.add(m);
  return g;
}

function laptop() {
  const g = new THREE.Group();
  const base = box(0.34, 0.018, 0.24, M.screen);
  base.position.y = 0.009;
  const lid = box(0.34, 0.24, 0.012, M.screen);
  lid.position.set(0, 0.12, -0.12);
  lid.rotation.x = -0.25;
  g.add(base, lid);
  return g;
}

function controller(w, d) {
  const g = new THREE.Group();
  const b = box(w, 0.05, d, M.gear);
  b.position.y = 0.025;
  g.add(b);
  const knobGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.02, 10);
  for (let i = 0; i < 8; i++) {
    const k = new THREE.Mesh(knobGeo, i % 3 ? M.alu : M.led);
    k.position.set(-w / 2 + 0.05 + (i * (w - 0.1)) / 7, 0.06, -d / 4);
    g.add(k);
  }
  return g;
}

function init(root) {
  const lang = LABELS[root.dataset.lang] ? root.dataset.lang : 'fr';
  const T = LABELS[lang];

  root.innerHTML = `
    <div class="s3-views" role="group">
      <button type="button" data-view="free" aria-pressed="true">${T.free}</button>
      <button type="button" data-view="front">${T.front}</button>
      <button type="button" data-view="top">${T.top}</button>
    </div>
    <p class="s3-hint">${T.hint}</p>`;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0d0f);
  scene.fog = new THREE.Fog(0x0d0d0f, 9, 16);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  root.prepend(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = 's3-labels';
  root.appendChild(labels.domElement);

  // Lumières : contre-jour chaud (comme le live) + un peu d'ambiance pour lire le plan
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.1));
  const back = new THREE.SpotLight(0xffc98a, 60, 14, Math.PI / 5, 0.5);
  back.position.set(0, 5, -4);
  back.target.position.set(0, 0, 0.3);
  back.castShadow = true;
  back.shadow.mapSize.set(1024, 1024);
  scene.add(back, back.target);
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(3, 6, 4);
  scene.add(key);

  // Plateau
  const floor = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.1, 3.8), M.floor);
  floor.position.set(0, -0.05, 0.35);
  floor.receiveShadow = true;
  scene.add(floor);
  const nose = box(5.2, 0.02, 0.04, mat(0xffffff, { emissive: 0x666666 }));
  nose.position.set(0, 0.001, 2.23);
  scene.add(nose);
  const aud = label(`↓ ${T.audience} ↓`, 's3-audience');
  aud.position.set(0, 0, 2.45);
  scene.add(aud);

  const place = (obj, { x, z, rot = 0, labelDx = 0, labelDz = 0 }, text, y, cls) => {
    obj.position.set(x, 0, z);
    obj.rotation.y = rot;
    scene.add(obj);
    if (text) {
      const l = label(text, cls);
      l.position.set(x + labelDx, y, z + labelDz);
      scene.add(l);
    }
    return obj;
  };

  const fc1 = place(flightcase(LAYOUT.flightcase1), LAYOUT.flightcase1, T.fc1, 1.3);
  const fc2 = place(flightcase(LAYOUT.flightcase2), LAYOUT.flightcase2, T.fc2, 1.3);
  const lap = laptop();
  lap.position.set(0.25, fc1.userData.top, 0); // bout du flightcase côté musicien
  fc1.add(lap);
  const c1 = controller(0.5, 0.22);
  c1.position.set(-0.22, fc1.userData.top, 0.02);
  fc1.add(c1);
  const c2 = controller(0.44, 0.26);
  c2.position.set(0, fc2.userData.top, 0.05);
  fc2.add(c2);

  place(musician(), LAYOUT.musician, T.musician, 2.25, 's3-strong');
  place(guitar(), LAYOUT.guitar, T.guitar, 1.6);

  const di = box(0.22, 0.07, 0.12, M.di);
  di.position.y = 0.035;
  const diG = new THREE.Group();
  diG.add(di);
  place(diG, LAYOUT.di, T.di, 0.3);

  const pw = new THREE.Group();
  const strip = box(0.45, 0.045, 0.07, M.gear);
  strip.position.y = 0.023;
  pw.add(strip);
  for (let i = 0; i < 4; i++) {
    const s = box(0.06, 0.005, 0.045, M.rubber);
    s.position.set(-0.15 + i * 0.1, 0.048, 0);
    pw.add(s);
  }
  place(pw, LAYOUT.power); // étiquette commune avec la DI

  // Les deux retours sont légèrement tournés vers le musicien
  place(wedge(), LAYOUT.wedge1, T.wedge1, 0.55).rotation.y = -0.3;
  place(wedge(), LAYOUT.wedge2, T.wedge2, 0.55).rotation.y = 0.35;

  // Caméra + contrôles
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 11;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;

  let anim = null;
  function goTo(name, instant = false) {
    const v = VIEWS[name];
    const from = { pos: camera.position.clone(), target: controls.target.clone() };
    const to = { pos: new THREE.Vector3(...v.pos), target: new THREE.Vector3(...v.target) };
    root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === name));
    if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      camera.position.copy(to.pos);
      controls.target.copy(to.target);
      controls.update();
      return;
    }
    anim = { from, to, t0: performance.now() };
  }
  root.querySelector('.s3-views').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (b) goTo(b.dataset.view);
  });
  controls.addEventListener('start', () => {
    anim = null;
    root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === 'free'));
  });

  function resize() {
    const w = root.clientWidth;
    const h = root.clientHeight;
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 58 : 38; // écran en portrait : champ plus large pour tout voir
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(root);
  resize();
  goTo('free', true);

  // Ne dessine que quand le plan est visible à l'écran
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(root);

  renderer.setAnimationLoop(() => {
    if (!visible) return;
    if (anim) {
      const k = Math.min((performance.now() - anim.t0) / 700, 1);
      const e = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(anim.from.pos, anim.to.pos, e);
      controls.target.lerpVectors(anim.from.target, anim.to.target, e);
      if (k === 1) anim = null;
    }
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  });

  root.closest('.stage')?.classList.add('has3d');
}

const root = document.querySelector('.stage3d');
if (root && hasWebGL()) {
  root.hidden = false;
  try {
    init(root);
  } catch (err) {
    console.error(err);
    root.hidden = true;
  }
}
