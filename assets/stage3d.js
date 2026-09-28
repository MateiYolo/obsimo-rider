// Stage plot 3D (three.js). Unités : mètres. x = gauche/droite vu du public, z = vers le public.
// Pour déplacer un élément, change ses coordonnées dans LAYOUT ci-dessous.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const LAYOUT = {
  flightcase1: { x: -0.95, z: 0, w: 1.1, h: 1.0, d: 0.6 },
  flightcase2: { x: 0.25, z: 0, w: 0.7, h: 1.0, d: 0.6 },
  musician: { x: 0.25, z: -0.65 },
  guitar: { x: 1.25, z: -0.25 },
  di: { x: -1.95, z: -0.1 },
  power: { x: -1.9, z: 0.2 },
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
  free: { pos: [3.2, 3.0, 5.2], target: [0, 0.6, 0.2] },
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
  const g = new THREE.Group();
  // Stand
  const legGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6);
  for (const a of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
    const leg = new THREE.Mesh(legGeo, M.gear);
    leg.position.set(Math.sin(a) * 0.1, 0.18, Math.cos(a) * 0.1 - 0.05);
    leg.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
    g.add(leg);
  }
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), M.gear);
  post.position.set(0, 0.6, -0.08);
  g.add(post);
  // Guitare (légèrement inclinée vers l'arrière)
  const gt = new THREE.Group();
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 28), M.sunburst);
  lower.rotation.x = Math.PI / 2;
  lower.position.y = 0.3;
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 28), M.sunburst);
  upper.rotation.x = Math.PI / 2;
  upper.position.y = 0.52;
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.052, 24), mat(0xf2efe8));
  guard.rotation.x = Math.PI / 2;
  guard.position.set(0.05, 0.36, 0.001);
  const neck = box(0.05, 0.62, 0.025, M.wood);
  neck.position.y = 0.95;
  const head = box(0.08, 0.17, 0.02, M.wood);
  head.position.y = 1.34;
  gt.add(lower, upper, guard, neck, head);
  gt.position.set(0, 0.05, 0);
  gt.rotation.x = -0.12;
  gt.traverse((o) => (o.castShadow = true));
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

  const place = (obj, { x, z }, text, y, cls) => {
    obj.position.set(x, 0, z);
    scene.add(obj);
    if (text) {
      const l = label(text, cls);
      l.position.set(x, y, z);
      scene.add(l);
    }
    return obj;
  };

  const fc1 = place(flightcase(LAYOUT.flightcase1), LAYOUT.flightcase1, T.fc1, 1.45);
  const fc2 = place(flightcase(LAYOUT.flightcase2), LAYOUT.flightcase2, T.fc2, 1.3);
  const lap = laptop();
  lap.position.set(-0.3, fc1.userData.top, -0.05);
  fc1.add(lap);
  const c1 = controller(0.5, 0.22);
  c1.position.set(0.22, fc1.userData.top, 0.08);
  c1.rotation.y = -0.15;
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
  place(diG, LAYOUT.di, T.di, 0.4);

  const pw = new THREE.Group();
  const strip = box(0.45, 0.045, 0.07, M.gear);
  strip.position.y = 0.023;
  pw.add(strip);
  for (let i = 0; i < 4; i++) {
    const s = box(0.06, 0.005, 0.045, M.rubber);
    s.position.set(-0.15 + i * 0.1, 0.048, 0);
    pw.add(s);
  }
  pw.rotation.y = 0.5;
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
