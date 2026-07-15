import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import gsap from 'gsap';

import { createGramophone } from './gramophone.js';
import { createShelf } from './shelf.js';
import { dustSprite, discFaceTexture } from './textures.js';
import { ChannelFeed, Jukebox } from './youtube.js';
import { cleanTitle, thumbUrl } from './data.js';

/* ------------------------------------------------ renderer / scene */
// phones get a lighter pipeline: no mirror floor, no RGB-shift pass, smaller
// shadows, fewer particles, capped pixel ratio — same look, playable speed
const MOBILE = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060607);
scene.fog = new THREE.FogExp2(0x060607, 0.05);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.25;

const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 60);

/* ------------------------------------------------ lights */
scene.add(new THREE.HemisphereLight(0x28303c, 0x0a0806, 0.5));

const key = new THREE.SpotLight(0xffd9a0, 320, 30, 0.42, 0.55, 1.6);
key.position.set(1.8, 7.2, 3.2);
key.castShadow = true;
key.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
key.shadow.bias = -0.0004;
key.shadow.radius = 6;
scene.add(key);

const rimL = new THREE.SpotLight(0x7fa0d8, 140, 30, 0.5, 0.7, 1.8);
rimL.position.set(-5.5, 4.2, -3.5);
scene.add(rimL);

const shelfLight = new THREE.SpotLight(0xffe6c0, 75, 20, 0.38, 0.8, 1.8);
shelfLight.position.set(3.6, 5.8, 3.6);
shelfLight.castShadow = true;
shelfLight.shadow.mapSize.set(MOBILE ? 512 : 1024, MOBILE ? 512 : 1024);
shelfLight.shadow.bias = -0.0004;
scene.add(shelfLight);

const hornGlow = new THREE.PointLight(0xd8a84e, 3, 4, 2);
hornGlow.position.set(-1.2, 2.0, 0.2);
scene.add(hornGlow);

/* ------------------------------------------------ floor: mirror + glaze */
if (!MOBILE) {
  const mirror = new Reflector(new THREE.CircleGeometry(30, 64), {
    textureWidth: Math.floor(window.innerWidth * 0.75),
    textureHeight: Math.floor(window.innerHeight * 0.75),
    color: 0x777777,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = -0.002;
  scene.add(mirror);
}

const glaze = new THREE.Mesh(
  new THREE.CircleGeometry(30, 64),
  new THREE.MeshStandardMaterial({
    color: 0x0d0d0f, roughness: 0.72, metalness: 0.08,
    transparent: !MOBILE, opacity: MOBILE ? 1 : 0.85,
  }),
);
glaze.rotation.x = -Math.PI / 2;
glaze.position.y = 0.001;
glaze.receiveShadow = true;
scene.add(glaze);

/* volumetric light cone */
const coneMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uOpacity: { value: 0.05 } },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    varying vec2 vUv;
    uniform float uOpacity;
    void main() {
      float vertical = smoothstep(0.0, 0.45, vUv.y) * (1.0 - smoothstep(0.7, 1.0, vUv.y));
      float side = sin(vUv.x * 3.14159);
      gl_FragColor = vec4(1.0, 0.85, 0.6, vertical * side * uOpacity);
    }`,
});
const lightCone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 6.2, 48, 1, true), coneMat);
lightCone.position.set(-1.3, 3.1, -0.1);
scene.add(lightCone);

/* dust */
const DUST_N = MOBILE ? 160 : 420;
const dustGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(DUST_N * 3);
  const seedArr = new Float32Array(DUST_N);
  for (let i = 0; i < DUST_N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 12;
    pos[i * 3 + 1] = Math.random() * 5.2;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 9;
    seedArr[i] = Math.random() * 100;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dustGeo.userData.seed = seedArr;
}
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  map: dustSprite(), size: 0.035, transparent: true, opacity: 0.5,
  blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
}));
scene.add(dust);

/* ------------------------------------------------ actors */
const gramophone = createGramophone();
gramophone.group.position.set(-1.5, 0, 0.1);
gramophone.group.rotation.y = 0.35;
gramophone.group.scale.setScalar(0.68);
scene.add(gramophone.group);

const shelf = createShelf();
shelf.group.position.set(1.95, 0.02, -0.2);
shelf.group.rotation.y = -0.38;
shelf.group.scale.setScalar(0.82);
scene.add(shelf.group);

/* flying discs (sleeve → platter, platter → sleeve) */
function makeFlyingDisc() {
  const mat = new THREE.MeshStandardMaterial({ map: discFaceTexture(null), roughness: 0.35, metalness: 0.2 });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.374, 0.374, 0.012, 64), [
    new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.4 }),
    mat,
    new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.5 }),
  ]);
  m.castShadow = true;
  m.visible = false;
  scene.add(m);
  return { mesh: m, mat };
}
const discIn = makeFlyingDisc();
const discOut = makeFlyingDisc();

/* ------------------------------------------------ post-processing */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight), MOBILE ? 0.22 : 0.3, 0.6, 0.9,
);
composer.addPass(bloom);
let rgbShift = null;
if (!MOBILE) {
  rgbShift = new ShaderPass(RGBShiftShader);
  rgbShift.uniforms.amount.value = 0;
  rgbShift.uniforms.angle.value = 0.6;
  composer.addPass(rgbShift);
}
composer.addPass(new OutputPass());

/* ------------------------------------------------ journey (infinite scroll) */
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const SECTIONS = [
  { label: 'ROOM',    pos: v3(0.15, 1.7, 7.4),  look: v3(0.15, 1.05, 0) },
  { label: 'HORN',    pos: v3(-0.1, 2.2, 3.4),  look: v3(-1.15, 1.7, 0.2) },
  { label: 'NEEDLE',  pos: v3(-0.7, 1.6, 2.4),  look: v3(-1.5, 0.62, 0.3) },
  { label: 'MOTOR',   pos: v3(0.45, 0.95, 2.3), look: v3(-0.72, 0.42, 0.05) },
  { label: 'LIBRARY', pos: v3(0.45, 1.4, 4.3), look: v3(1.8, 1.0, -0.25) },
];
const N = SECTIONS.length;
const posCurve = new THREE.CatmullRomCurve3(SECTIONS.map((s) => s.pos), true, 'centripetal');
const lookCurve = new THREE.CatmullRomCurve3(SECTIONS.map((s) => s.look), true, 'centripetal');

let scrollT = 0;          // continuous, unbounded — loops forever
let scrollTarget = 0;
const introOffset = { z: 3.2, y: 0.8 };
const curLook = SECTIONS[0].look.clone();

const wrap = (x) => ((x % N) + N) % N;
const wrapDist = (a, b) => {
  const d = Math.abs(wrap(a) - b);
  return Math.min(d, N - d);
};

window.addEventListener('wheel', (e) => {
  if (e.target.closest('.drawer, .nowplaying, .player-card')) return;
  scrollTarget += THREE.MathUtils.clamp(e.deltaY, -140, 140) * 0.0016;
}, { passive: true });

// touch drag → scroll
let touchY = null;
window.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
window.addEventListener('touchmove', (e) => {
  if (touchY === null || e.target.closest('.drawer')) return;
  scrollTarget += (touchY - e.touches[0].clientY) * 0.004;
  touchY = e.touches[0].clientY;
}, { passive: true });
window.addEventListener('touchend', () => { touchY = null; });

// arrow keys
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'PageDown') scrollTarget += 1;
  if (e.key === 'ArrowUp' || e.key === 'PageUp') scrollTarget -= 1;
});

/* captions + rail */
const caps = [...document.querySelectorAll('.jcap')];
const rail = document.getElementById('rail');
SECTIONS.forEach((s, i) => {
  const b = document.createElement('button');
  b.className = 'rail-dot';
  b.dataset.label = s.label;
  b.addEventListener('click', () => {
    const cur = wrap(scrollTarget);
    let d = i - cur;
    if (d > N / 2) d -= N;
    if (d < -N / 2) d += N;
    scrollTarget += d;
  });
  rail.appendChild(b);
});
const railDots = [...rail.children];

function updateJourneyUI() {
  const t = wrap(scrollT);
  caps.forEach((el, i) => {
    const d = wrapDist(t, i);
    const op = THREE.MathUtils.clamp(1 - d * 2.4, 0, 1);
    el.style.opacity = op;
    el.style.transform = `translateY(calc(-40% + ${d * 26}px))`;
  });
  const active = Math.round(t) % N;
  railDots.forEach((el, i) => el.classList.toggle('active', i === active));
  // shelf pager only makes sense while looking at the library
  document.getElementById('shelfNav').classList.toggle('visible', wrapDist(t, 4) < 0.55);
  // hero hint hides once you leave the first section (visibility beats the pulse animation)
  ui.hint.style.visibility = wrapDist(t, 0) > 0.4 ? 'hidden' : '';
}

/* ------------------------------------------------ data + playback */
const feed = new ChannelFeed();
const jukebox = new Jukebox();

const $ = (id) => document.getElementById(id);
const ui = {
  loader: $('loader'), loaderFill: $('loaderFill'), loaderPct: $('loaderPct'), loaderStage: $('loaderStage'),
  hint: $('hint'), nowPlaying: $('nowPlaying'), npTitle: $('npTitle'), npArt: $('npArt'),
  npEq: $('npEq'), btnPlay: $('btnPlay'), btnPrev: $('btnPrev'), btnNext: $('btnNext'),
  btnVideo: $('btnVideo'), icoPlay: $('icoPlay'), icoPause: $('icoPause'),
  playerCard: $('playerCard'), liveText: $('liveText'),
  shelfNav: $('shelfNav'), pagePrev: $('pagePrev'), pageNext: $('pageNext'), pageLabel: $('pageLabel'),
  banner: $('songBanner'), ghost: $('ghostType'),
  drawer: $('drawer'), drawerList: $('drawerList'), drawerCount: $('drawerCount'),
  drawerClose: $('drawerClose'), btnBrowse: $('btnBrowse'), browseCount: $('browseCount'),
};

shelf.setVideos(feed.getVideos());
refreshPager();
renderDrawer();

function refreshPager() {
  const { page, pages } = shelf.pageInfo();
  ui.pageLabel.textContent = `${page + 1} / ${pages}`;
  ui.shelfNav.classList.toggle('hidden', pages <= 1);
  ui.pagePrev.disabled = page === 0;
  ui.pageNext.disabled = page === pages - 1;
}
ui.pagePrev.addEventListener('click', () => { shelf.setPage(-1); refreshPager(); });
ui.pageNext.addEventListener('click', () => { shelf.setPage(1); refreshPager(); });

/* drawer */
function renderDrawer() {
  const vids = feed.getVideos();
  ui.drawerCount.textContent = `${vids.length} TRACKS`;
  ui.browseCount.textContent = vids.length;
  ui.drawerList.innerHTML = '';
  vids.forEach((v, i) => {
    const row = document.createElement('button');
    row.className = 'drow';
    row.dataset.id = v.id;
    row.innerHTML = `
      <span class="drow-thumb" style="background-image:url(${thumbUrl(v.id, 'mqdefault')})"></span>
      <span class="drow-meta">
        <span class="drow-title"></span>
        <span class="drow-sub">TRACK ${String(i + 1).padStart(2, '0')}</span>
      </span>
      <span class="drow-eq"><i style="height:5px"></i><i style="height:10px"></i><i style="height:7px"></i></span>`;
    row.querySelector('.drow-title').textContent = cleanTitle(v.title);
    row.addEventListener('click', () => playVideo(v));
    ui.drawerList.appendChild(row);
  });
  markDrawerActive();
}
function markDrawerActive() {
  const cur = jukebox.current?.id;
  [...ui.drawerList.children].forEach((row) => {
    row.classList.toggle('active', row.dataset.id === cur);
    row.classList.toggle('playing', row.dataset.id === cur && jukebox.playing);
  });
}
ui.btnBrowse.addEventListener('click', () => ui.drawer.classList.toggle('open'));
ui.drawerClose.addEventListener('click', () => ui.drawer.classList.remove('open'));

/* disc flight */
let dockedVideo = null;

function flyDiscToPlatter(video) {
  const target = gramophone.platterTarget();

  if (dockedVideo && dockedVideo.id !== video.id) {
    const back = shelf.sleeveWorld(dockedVideo.id);
    gramophone.hideRecord();
    const d = discOut.mesh;
    discOut.mat.map = discFaceTexture(dockedVideo);
    discOut.mat.needsUpdate = true;
    d.position.copy(target.pos);
    d.rotation.set(0, 0, 0);
    d.scale.setScalar(target.scale / 0.68);
    d.visible = true;
    shelf.releaseSleeve(dockedVideo.id);
    gsap.timeline({ onComplete: () => { d.visible = false; } })
      .to(d.position, { y: target.pos.y + 0.7, duration: 0.5, ease: 'power2.out' })
      .to(d.position, { x: back.pos.x, y: back.pos.y, z: back.pos.z, duration: 0.9, ease: 'power2.inOut' }, '>-0.1')
      .to(d.rotation, { x: Math.PI / 2, y: back.rotY, duration: 0.9, ease: 'power2.inOut' }, '<')
      .to(d.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.25, ease: 'power2.in' }, '>-0.15');
  }
  dockedVideo = video;
  shelf.pullSleeve(video.id);

  const from = shelf.sleeveWorld(video.id);
  const tex = discFaceTexture(video);
  discIn.mat.map = tex;
  discIn.mat.needsUpdate = true;
  const m = discIn.mesh;
  m.position.copy(from.pos);
  m.rotation.set(Math.PI / 2, from.rotY, 0);
  m.scale.setScalar(0.82);
  m.visible = true;

  const mid = {
    x: (from.pos.x + target.pos.x) / 2,
    y: Math.max(from.pos.y, target.pos.y) + 0.85,
    z: (from.pos.z + target.pos.z) / 2 + 0.6,
  };
  gsap.timeline({
    onComplete: () => { m.visible = false; gramophone.setRecord(tex); },
  })
    .to(m.position, { z: from.pos.z + 0.35, duration: 0.4, ease: 'power2.out' })
    .to(m.position, { x: mid.x, y: mid.y, z: mid.z, duration: 0.55, ease: 'power2.in' }, '>-0.05')
    .to(m.rotation, { x: 0, y: from.rotY + 2.5, duration: 1.1, ease: 'power2.inOut' }, '<')
    .to(m.scale, { x: target.scale / 0.68, y: target.scale / 0.68, z: target.scale / 0.68, duration: 1.0 }, '<')
    .to(m.position, { x: target.pos.x, y: target.pos.y + 0.25, z: target.pos.z, duration: 0.55, ease: 'power2.out' })
    .to(m.position, { y: target.pos.y, duration: 0.35, ease: 'power3.in' });
}

function showBanner(title) {
  ui.banner.textContent = title.toUpperCase();
  ui.banner.classList.remove('show');
  void ui.banner.offsetWidth;
  ui.banner.classList.add('show');
}

function playVideo(video) {
  jukebox.play(video);
  flyDiscToPlatter(video);
  ui.npTitle.textContent = cleanTitle(video.title);
  ui.npArt.style.backgroundImage = `url(${thumbUrl(video.id, 'mqdefault')})`;
  ui.nowPlaying.classList.add('show');
  ui.playerCard.classList.add('show');
  ui.hint.classList.remove('show');
  showBanner(cleanTitle(video.title));
  markDrawerActive();
}

function currentIndex() {
  return feed.getVideos().findIndex((v) => v.id === jukebox.current?.id);
}
function step(dir) {
  const vids = feed.getVideos();
  if (!vids.length) return;
  const next = vids[(currentIndex() + dir + vids.length) % vids.length];
  playVideo(next);
}

jukebox.onState = (s) => {
  const playing = s === 'playing';
  ui.icoPlay.style.display = playing ? 'none' : '';
  ui.icoPause.style.display = playing ? '' : 'none';
  ui.npEq.classList.toggle('on', playing);
  if (playing) gramophone.startPlaying();
  else if (s === 'paused') gramophone.stopPlaying();
  else if (s === 'ended') step(1);
  markDrawerActive();
};

ui.btnPlay.addEventListener('click', () => {
  if (jukebox.current) jukebox.toggle();
  else if (feed.getVideos().length) playVideo(feed.getVideos()[0]);
});
ui.btnPrev.addEventListener('click', () => step(-1));
ui.btnNext.addEventListener('click', () => step(1));
ui.btnVideo.addEventListener('click', () => {
  ui.playerCard.classList.toggle('min');
  ui.btnVideo.classList.toggle('active');
});

/* live updates */
feed.onUpdate = (videos, fresh) => {
  shelf.setVideos(videos);
  refreshPager();
  renderDrawer();
  ui.liveText.textContent = feed.source !== 'cache'
    ? 'LIVE · SYNCED WITH CHANNEL' : 'SYNCED WITH CHANNEL';
  if (fresh.length) toast(`<b>${fresh.length}</b> new upload${fresh.length > 1 ? 's' : ''} in the library`);
};
feed.start();

function toast(html) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = html;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 800); }, 4200);
}

/* ------------------------------------------------ interaction */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-2, -2);
const mouse = { x: 0, y: 0 };
let hoveredMesh = null;

window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  mouse.x = pointer.x;
  mouse.y = pointer.y;
  cursor.move(e.clientX, e.clientY);
});

window.addEventListener('click', (e) => {
  if (e.target.closest('.nowplaying, .player-card, .chrome, .yt-link, .shelf-nav, .drawer, .browse-btn, .rail')) return;
  const p = new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1,
  );
  raycaster.setFromCamera(p, camera);
  const hit = raycaster.intersectObjects(shelf.getMeshes(), false)[0]?.object;
  if (hit?.userData.video) playVideo(hit.userData.video);
});

function updateRaycast() {
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(shelf.getMeshes(), false)[0]?.object || null;
  if (hit !== hoveredMesh) {
    hoveredMesh = hit;
    shelf.setHover(hit);
    document.body.classList.toggle('cursor-hover', !!hit);
  }
}

/* custom cursor */
const cursor = (() => {
  const dot = $('cursorDot');
  const ring = $('cursorRing');
  const pos = { x: -100, y: -100 }, target = { x: -100, y: -100 };
  return {
    move(x, y) { target.x = x; target.y = y; dot.style.transform = `translate(${x - 2.5}px, ${y - 2.5}px)`; },
    tick() {
      pos.x += (target.x - pos.x) * 0.16;
      pos.y += (target.y - pos.y) * 0.16;
      ring.style.transform = `translate(${pos.x - 15}px, ${pos.y - 15}px)`;
    },
  };
})();

/* ------------------------------------------------ boot loader */
const STAGES = [
  [0.0, 'SCANNING CHANNEL'],
  [0.3, 'PRESSING VINYL'],
  [0.55, 'POLISHING BRASS'],
  [0.75, 'TUNING THE HORN'],
  [0.93, 'OPENING THE ROOM'],
];
let progress = 0;
const setProgress = (p) => {
  progress = Math.max(progress, p);
  ui.loaderFill.style.transform = `scaleX(${progress})`;
  ui.loaderPct.textContent = `${Math.round(progress * 100)}%`;
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (progress >= STAGES[i][0]) { ui.loaderStage.textContent = STAGES[i][1]; break; }
  }
};
// tick progress smoothly toward staged milestones
const bootTl = gsap.timeline();
const bootState = { p: 0 };
bootTl.to(bootState, {
  p: 0.86, duration: 2.2, ease: 'power1.inOut',
  onUpdate: () => setProgress(bootState.p),
});
renderer.compileAsync(scene, camera).catch(() => {}).finally(() => {
  gsap.to(bootState, {
    p: 1, duration: 0.7, ease: 'power2.out', delay: Math.max(0, 2.0 - bootTl.time()),
    onUpdate: () => setProgress(bootState.p),
    onComplete: reveal,
  });
});
// failsafe: never leave anyone stuck on the loader (slow phones, stalled compile)
setTimeout(() => { setProgress(1); reveal(); }, 9000);

// if the GPU resets (common after backgrounding on mobile), recover cleanly
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  location.reload();
});

let revealed = false;
function reveal() {
  if (revealed) return;
  revealed = true;
  ui.loader.classList.add('done');
  document.body.classList.add('ready');
  ui.hint.classList.add('show');
  gsap.to(introOffset, { z: 0, y: 0, duration: 2.8, ease: 'power3.out' });
  // the room assembles itself
  const gs = gramophone.group.scale.x, ss = shelf.group.scale.x;
  gramophone.group.scale.setScalar(0.001);
  shelf.group.scale.setScalar(0.001);
  gsap.to(gramophone.group.scale, { x: gs, y: gs, z: gs, duration: 1.6, ease: 'elastic.out(1, 0.65)', delay: 0.25 });
  gsap.to(shelf.group.scale, { x: ss, y: ss, z: ss, duration: 1.4, ease: 'elastic.out(1, 0.7)', delay: 0.5 });
}

/* ------------------------------------------------ resize */
let aspectPull = 1;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  aspectPull = camera.aspect < 1 ? 1.45 : camera.aspect < 1.5 ? 1.16 : 1;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
}
window.addEventListener('resize', resize);
resize();

/* ------------------------------------------------ music energy sim */
let energy = 0, energyTarget = 0, energyTimer = 0;
function updateEnergy(dt) {
  if (jukebox.playing) {
    energyTimer -= dt;
    if (energyTimer <= 0) {
      energyTarget = 0.35 + Math.random() * 0.65;
      energyTimer = 0.12 + Math.random() * 0.2;
    }
  } else energyTarget = 0;
  energy += (energyTarget - energy) * Math.min(1, dt * 8);
}

/* debug hook */
window.__ms = { shelf, camera, feed, playVideo, gramophone, scene, step, get scrollT() { return scrollT; }, setScroll: (v) => { scrollTarget = v; } };

/* ------------------------------------------------ loop */
const clock = new THREE.Clock();
const seedArr = dustGeo.userData.seed;
const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // journey scroll
  scrollT += (scrollTarget - scrollT) * Math.min(1, dt * 3.2);
  const u = wrap(scrollT) / N;
  posCurve.getPoint(u, tmpPos);
  lookCurve.getPoint(u, tmpLook);
  curLook.lerp(tmpLook, Math.min(1, dt * 4));

  // camera = path + parallax + intro + idle breath, pulled back on narrow screens
  const dir = tmpPos.clone().sub(curLook);
  const px = tmpPos.x + dir.length() * 0.045 * mouse.x + Math.sin(t * 0.12) * 0.05;
  const py = tmpPos.y + introOffset.y + dir.length() * 0.03 * mouse.y + Math.sin(t * 0.09) * 0.03;
  const pz = tmpPos.z + introOffset.z;
  camera.position.set(
    curLook.x + (px - curLook.x) * aspectPull,
    py,
    curLook.z + (pz - curLook.z) * aspectPull,
  );
  camera.lookAt(curLook);

  updateJourneyUI();

  // ghost typography parallax + fades away from hero
  const heroD = wrapDist(scrollT, 0);
  ui.ghost.style.opacity = document.body.classList.contains('ready')
    ? String(THREE.MathUtils.clamp(1 - heroD * 1.6, 0, 1)) : '0';
  ui.ghost.style.transform = `translate(${mouse.x * -18}px, ${mouse.y * 12}px)`;

  // dust
  const pos = dustGeo.attributes.position.array;
  const speed = 1 + energy * 1.4;
  for (let i = 0; i < DUST_N; i++) {
    pos[i * 3 + 1] += dt * 0.06 * speed;
    pos[i * 3] += Math.sin(t * 0.3 + seedArr[i]) * dt * 0.02;
    if (pos[i * 3 + 1] > 5.4) pos[i * 3 + 1] = 0;
  }
  dustGeo.attributes.position.needsUpdate = true;

  coneMat.uniforms.uOpacity.value = 0.028 + energy * 0.022 + Math.sin(t * 2.1) * 0.004;
  hornGlow.intensity = 2.2 + energy * 5;
  // chromatic aberration: subtle, and OFF anywhere near the library
  // so the cover text stays crisp and readable
  if (rgbShift) {
    const libFade = THREE.MathUtils.clamp((wrapDist(scrollT, 4) - 0.6) / 0.4, 0, 1);
    rgbShift.uniforms.amount.value = (0.0004 + energy * 0.0004) * libFade;
  }

  updateEnergy(dt);
  gramophone.update(dt, energy);
  updateRaycast();
  cursor.tick();

  composer.render();
}
animate();
