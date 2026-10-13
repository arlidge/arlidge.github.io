// 3D models in the product cards. Any element with data-stl="stl/file.stl"
// shows that model facing front and slowly turning a little either way at
// random, never all the way round.
//
// Two-colour prints: faces in the top half of the model's height (the raised
// extrusion, including its side walls) use data-color-top; everything below
// uses data-color. data-turn="180" flips it if the wrong face points forward.
// data-fit="1.3" shows it smaller in its card (0.8 = bigger).
//
// One shared WebGL renderer draws every visible card in turn and copies the
// frame into that card's own canvas. This keeps it to a single WebGL context
// however many cards (and loop clones from product-strip.js) there are.
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

// works in homepage product cards (.product-img) and shop cards (.print-img)
const slots = Array.from(document.querySelectorAll('[data-stl]'));
if (slots.length) {
  const MAX_TURN = 35 * Math.PI / 180; // furthest it turns from facing front
  const MAX_TILT = 8 * Math.PI / 180;  // slight up/down nod
  const EASE = 0.7;                    // lower = slower, lazier turns
  const FIT = 1.2;                     // space around the model; bigger = smaller model
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  // key light from directly above, soft front fill, rim lights from behind,
  // and a dim ambient so nothing goes fully black. Kept low so the two print
  // colours read as colours instead of washing out.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(0, 5, 0);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(0, 1, 5);
  scene.add(fill);
  const rimL = new THREE.DirectionalLight(0xffffff, 0.4);
  rimL.position.set(-4, 2, -3);
  scene.add(rimL);
  const rimR = new THREE.DirectionalLight(0xffffff, 0.4);
  rimR.position.set(4, 2, -3);
  scene.add(rimR);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 4.2);

  const mesh = new THREE.Mesh();
  scene.add(mesh);

  // Sort triangles into two material groups by height (model Z, the print's
  // build direction): group 0 = lower layer, group 1 = raised top layer.
  function splitLayers(geo) {
    const src = geo.attributes.position.array;
    const tris = src.length / 9;
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 2; i < src.length; i += 3) {
      if (src[i] < minZ) minZ = src[i];
      if (src[i] > maxZ) maxZ = src[i];
    }
    const cut = minZ + (maxZ - minZ) * 0.5 + (maxZ - minZ) * 0.001;
    const lower = [], upper = [];
    for (let t = 0; t < tris; t++) {
      const o = t * 9;
      const cz = (src[o + 2] + src[o + 5] + src[o + 8]) / 3;
      (cz > cut ? upper : lower).push(t);
    }
    const out = new Float32Array(src.length);
    let w = 0;
    for (const t of lower.concat(upper)) {
      out.set(src.subarray(t * 9, t * 9 + 9), w);
      w += 9;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(out, 3));
    g.addGroup(0, lower.length * 3, 0);
    g.addGroup(lower.length * 3, upper.length * 3, 1);
    return g;
  }

  // load each file once, however many cards use it
  const loader = new STLLoader();
  const geometries = new Map();
  function loadGeometry(url) {
    if (!geometries.has(url)) {
      geometries.set(url, new Promise((resolve, reject) => {
        loader.load(url, (raw) => {
          const geo = splitLayers(raw);
          geo.computeVertexNormals();
          geo.center();
          geo.computeBoundingSphere();
          const s = 1 / geo.boundingSphere.radius; // fit every model to the same size
          geo.scale(s, s, s);
          resolve(geo);
        }, undefined, reject);
      }));
    }
    return geometries.get(url);
  }

  const cards = slots.map((el, i) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'product-stl';
    const card = {
      el,
      canvas,
      ctx: canvas.getContext('2d'),
      geo: null,
      material: [
        new THREE.MeshStandardMaterial({ color: el.dataset.color || '#d9d9d9', metalness: 0.1, roughness: 0.6 }),
        new THREE.MeshStandardMaterial({ color: el.dataset.colorTop || el.dataset.color || '#d9d9d9', metalness: 0.1, roughness: 0.6 }),
      ],
      base: (parseFloat(el.dataset.turn) || 0) * Math.PI / 180,
      fit: parseFloat(el.dataset.fit) || 1, // per-card size tweak: 1.3 = smaller, 0.8 = bigger
      yaw: 0, pitch: 0,       // current angles
      toYaw: 0, toPitch: 0,   // where it's heading
      hold: Math.random() * 2, // seconds to wait before picking a new target
      visible: false,
    };
    loadGeometry(el.dataset.stl).then((geo) => {
      card.geo = geo;
      el.classList.remove('product-img--placeholder', 'print-img--placeholder');
      el.classList.add('stl-slot');
      el.replaceChildren(canvas);
      if (still) draw(card);
    }).catch(() => {
      const label = el.querySelector('span');
      if (label) label.textContent = 'Model missing';
    });
    return card;
  });

  // drift towards a random angle, pause, pick another
  function wander(card, dt) {
    const k = 1 - Math.exp(-dt * EASE);
    card.yaw += (card.toYaw - card.yaw) * k;
    card.pitch += (card.toPitch - card.pitch) * k;
    if (Math.abs(card.toYaw - card.yaw) < 0.02) {
      card.hold -= dt;
      if (card.hold <= 0) {
        card.toYaw = (Math.random() * 2 - 1) * MAX_TURN;
        card.toPitch = (Math.random() * 2 - 1) * MAX_TILT;
        card.hold = 0.5 + Math.random() * 2.5;
      }
    }
  }

  function draw(card) {
    const w = card.el.clientWidth;
    const h = card.el.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (card.canvas.width !== pw || card.canvas.height !== ph) {
      card.canvas.width = pw;
      card.canvas.height = ph;
    }
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // back the camera off until the model (radius 1) fits the narrower side
    // with a margin; tall shop cards are narrower than the square homepage ones
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    camera.position.z = (FIT * card.fit) / (Math.tan(halfFov) * Math.min(1, camera.aspect));

    mesh.geometry = card.geo;
    mesh.material = card.material;
    mesh.rotation.set(card.pitch, card.base + card.yaw, 0);
    renderer.render(scene, camera);

    card.ctx.clearRect(0, 0, pw, ph);
    card.ctx.drawImage(renderer.domElement, 0, 0, pw, ph);
  }

  // only animate cards that are on screen
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const card = cards.find((c) => c.el === e.target);
      if (card) card.visible = e.isIntersecting;
    });
  }, { rootMargin: '100px' });
  cards.forEach((c) => io.observe(c.el));

  if (!still) {
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.1);
      cards.forEach((c) => {
        if (!c.geo) return;
        wander(c, dt);
        if (c.visible) draw(c);
      });
    });
  } else {
    window.addEventListener('resize', () => cards.forEach((c) => c.geo && draw(c)));
  }
}
