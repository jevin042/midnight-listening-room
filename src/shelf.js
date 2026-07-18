// Record shelf: album sleeves (one per upload), pageable so every song on
// the channel is reachable. Picking a sleeve pulls it forward; main.js flies
// the disc out of it onto the gramophone.
import * as THREE from 'three';
import gsap from 'gsap';
import { woodTexture, sleeveTexture, spineTexture } from './textures.js';

const SLV = 0.58, SLV_D = 0.045;
const COLS = 4, ROWS = 3, PAGE = COLS * ROWS;
const GAP_X = 0.13, GAP_Y = 0.15;

export function createShelf() {
  const group = new THREE.Group();

  const wood = woodTexture(512, 512, '#241811');
  const woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.62, metalness: 0.04 });

  const innerW = COLS * SLV + (COLS - 1) * GAP_X + 0.28;
  const rowH = SLV + GAP_Y;
  const totalH = ROWS * rowH + 0.14;

  /* fixed frame (always 3 rows) */
  const sideGeo = new THREE.BoxGeometry(0.09, totalH, 0.42);
  for (const sx of [-innerW / 2 - 0.045, innerW / 2 + 0.045]) {
    const side = new THREE.Mesh(sideGeo, woodMat);
    side.position.set(sx, totalH / 2, 0);
    side.castShadow = side.receiveShadow = true;
    group.add(side);
  }
  const backPanel = new THREE.Mesh(
    new THREE.BoxGeometry(innerW + 0.18, totalH, 0.03),
    new THREE.MeshStandardMaterial({ map: wood, roughness: 0.8, color: 0x8a8078 }),
  );
  backPanel.position.set(0, totalH / 2, -0.19);
  backPanel.receiveShadow = true;
  group.add(backPanel);
  const boardGeo = new THREE.BoxGeometry(innerW, 0.055, 0.4);
  for (let r = 0; r <= ROWS; r++) {
    const board = new THREE.Mesh(boardGeo, woodMat);
    board.position.set(0, r * rowH + 0.03, 0);
    board.castShadow = board.receiveShadow = true;
    group.add(board);
  }

  const sleeveGeo = new THREE.BoxGeometry(SLV, SLV, SLV_D);

  const state = {
    videos: [],
    page: 0,
    sleeves: [],     // { video, mesh, home, out }
    building: false,
  };

  const pages = () => Math.max(1, Math.ceil(state.videos.length / PAGE));

  function slotPosition(i) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = (col - (COLS - 1) / 2) * (SLV + GAP_X);
    const y = (ROWS - 1 - row) * rowH + 0.0575 + SLV / 2;
    return { x, y, z: 0.03 };
  }

  function makeSleeve(video, globalIndex) {
    const cover = sleeveTexture(video, globalIndex);
    const spine = spineTexture(globalIndex);
    // matte cardboard — no specular glare under the shelf spotlight
    const card = new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.92 });
    const mats = [
      new THREE.MeshStandardMaterial({ map: spine, roughness: 0.92 }), // +x (right edge)
      card, card.clone(), card.clone(),                                // -x +y -y
      new THREE.MeshStandardMaterial({
        // Fully self-lit poster: the artwork's own emission carries it, tuned
        // to sit just under the bloom threshold so it can never blow out.
        // roughness 1 + no env reflection = zero specular glare.
        map: cover, roughness: 1, metalness: 0, envMapIntensity: 0,
        emissive: 0xffffff, emissiveMap: cover, emissiveIntensity: 0.78,
      }), // +z front
      card.clone(),                                                    // -z
    ];
    const mesh = new THREE.Mesh(sleeveGeo, mats);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.video = video;
    mesh.userData.globalIndex = globalIndex;
    return mesh;
  }

  /** Render current page. dir: -1 slide left, +1 slide right, 0 pop-in. */
  function renderPage(dir = 0) {
    state.building = true;
    const old = state.sleeves;
    for (const s of old) {
      gsap.to(s.mesh.position, {
        x: s.home.x - dir * 2.6, duration: 0.5, ease: 'power2.in', delay: Math.random() * 0.08,
      });
      gsap.to(s.mesh.scale, {
        x: 0.01, y: 0.01, z: 0.01, duration: 0.45, ease: 'power2.in', delay: 0.1,
        onComplete: () => group.remove(s.mesh),
      });
    }

    const start = state.page * PAGE;
    const items = state.videos.slice(start, start + PAGE);
    state.sleeves = items.map((video, i) => {
      const slot = slotPosition(i);
      const mesh = makeSleeve(video, start + i);
      mesh.position.set(slot.x + dir * 2.6, slot.y, slot.z + 0.3);
      mesh.scale.setScalar(0.01);
      group.add(mesh);
      const d = 0.05 * i + (dir ? 0.25 : 0);
      gsap.to(mesh.position, { ...slot, duration: 0.8, ease: 'power3.out', delay: d });
      gsap.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(1.5)', delay: d });
      return { video, mesh, home: slot, out: false };
    });
    gsap.delayedCall(0.9, () => { state.building = false; });
  }

  /** Update the full catalogue; keeps the current page if possible. */
  function setVideos(videos) {
    const prevIds = new Set(state.videos.map((v) => v.id));
    const fresh = videos.filter((v) => !prevIds.has(v.id));
    const hadAny = state.videos.length > 0;
    state.videos = videos;
    if (state.page >= pages()) state.page = pages() - 1;
    renderPage(0);
    return hadAny ? fresh : [];
  }

  function setPage(delta) {
    const p = THREE.MathUtils.clamp(state.page + delta, 0, pages() - 1);
    if (p === state.page || state.building) return state.page;
    const dir = p > state.page ? 1 : -1;
    state.page = p;
    renderPage(dir);
    return p;
  }

  /* hover */
  let hovered = null;
  function setHover(mesh) {
    if (hovered === mesh) return;
    if (hovered) {
      const s = state.sleeves.find((x) => x.mesh === hovered);
      if (s && !s.out) {
        gsap.to(hovered.position, { z: s.home.z, duration: 0.5, ease: 'power3.out' });
        gsap.to(hovered.rotation, { x: 0, duration: 0.5, ease: 'power3.out' });
      }
    }
    hovered = mesh;
    if (mesh) {
      const s = state.sleeves.find((x) => x.mesh === mesh);
      if (s && !s.out) {
        gsap.to(mesh.position, { z: s.home.z + 0.14, duration: 0.45, ease: 'power3.out' });
        gsap.to(mesh.rotation, { x: -0.05, duration: 0.45, ease: 'power3.out' });
      }
    }
  }

  /** Pull the picked sleeve forward and hold it out; release any other. */
  function pullSleeve(id) {
    for (const s of state.sleeves) {
      if (s.video.id === id) {
        s.out = true;
        gsap.to(s.mesh.position, { z: s.home.z + 0.22, duration: 0.5, ease: 'power3.out' });
        gsap.to(s.mesh.rotation, { x: -0.1, duration: 0.5, ease: 'power3.out' });
      } else if (s.out) {
        s.out = false;
        gsap.to(s.mesh.position, { ...s.home, duration: 0.6, ease: 'power3.inOut' });
        gsap.to(s.mesh.rotation, { x: 0, duration: 0.6, ease: 'power3.inOut' });
      }
    }
  }
  function releaseSleeve(id) {
    const s = state.sleeves.find((x) => x.video.id === id);
    if (!s) return;
    s.out = false;
    gsap.to(s.mesh.position, { ...s.home, duration: 0.6, ease: 'power3.inOut' });
    gsap.to(s.mesh.rotation, { x: 0, duration: 0.6, ease: 'power3.inOut' });
  }

  /** World position just in front of a sleeve (disc extraction point).
      Falls back to the shelf center if the sleeve isn't on this page. */
  function sleeveWorld(id) {
    group.updateWorldMatrix(true, false);
    const s = state.sleeves.find((x) => x.video.id === id);
    const local = s
      ? new THREE.Vector3(s.home.x, s.home.y, s.home.z + 0.3)
      : new THREE.Vector3(0, totalH / 2, 0.5);
    return { pos: group.localToWorld(local), rotY: group.rotation.y, scale: group.scale.x };
  }

  const getMeshes = () => state.sleeves.map((s) => s.mesh);
  const pageInfo = () => ({ page: state.page, pages: pages() });

  return {
    group, setVideos, setPage, setHover, pullSleeve, releaseSleeve,
    sleeveWorld, getMeshes, pageInfo, state,
  };
}
