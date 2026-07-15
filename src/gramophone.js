// Procedural gramophone: wooden plinth, platter that accepts per-song vinyl,
// tonearm, brass horn shown in profile so the flare reads clearly.
import * as THREE from 'three';
import gsap from 'gsap';
import { woodTexture, discFaceTexture } from './textures.js';

export function createGramophone() {
  const group = new THREE.Group();

  const wood = woodTexture();
  const woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55, metalness: 0.05 });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc9973f, metalness: 1.0, roughness: 0.24, envMapIntensity: 1.5,
  });
  const darkBrass = new THREE.MeshStandardMaterial({ color: 0x8a6428, metalness: 1.0, roughness: 0.4 });
  const blackMetal = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.8, roughness: 0.35 });

  /* plinth */
  const baseShape = new THREE.Shape();
  const bw = 1.05, bd = 1.05, r = 0.09;
  baseShape.moveTo(-bw + r, -bd);
  baseShape.lineTo(bw - r, -bd);
  baseShape.quadraticCurveTo(bw, -bd, bw, -bd + r);
  baseShape.lineTo(bw, bd - r);
  baseShape.quadraticCurveTo(bw, bd, bw - r, bd);
  baseShape.lineTo(-bw + r, bd);
  baseShape.quadraticCurveTo(-bw, bd, -bw, bd - r);
  baseShape.lineTo(-bw, -bd + r);
  baseShape.quadraticCurveTo(-bw, -bd, -bw + r, -bd);
  const baseGeo = new THREE.ExtrudeGeometry(baseShape, {
    depth: 0.42, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3,
  });
  baseGeo.rotateX(-Math.PI / 2);
  const base = new THREE.Mesh(baseGeo, woodMat);
  base.position.y = 0.42;
  base.castShadow = base.receiveShadow = true;
  group.add(base);

  const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.1, 2.26), woodMat);
  skirt.position.y = 0.05;
  skirt.castShadow = skirt.receiveShadow = true;
  group.add(skirt);
  const mid = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.34, 2.0), woodMat);
  mid.position.y = 0.24;
  mid.castShadow = mid.receiveShadow = true;
  group.add(mid);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.018, 2.14), brassMat);
  trim.position.y = 0.405;
  group.add(trim);

  const deckY = 0.42 + 0.42 + 0.035;

  /* platter (front-left of deck) + removable vinyl */
  const platterPos = new THREE.Vector3(-0.12, deckY, 0.28);
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.65, 0.05, 64), blackMetal);
  platter.position.copy(platterPos);
  platter.castShadow = platter.receiveShadow = true;
  group.add(platter);
  // felt mat
  const felt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.56, 0.008, 64),
    new THREE.MeshStandardMaterial({ color: 0x24201c, roughness: 0.95 }),
  );
  felt.position.copy(platterPos).add(new THREE.Vector3(0, 0.028, 0));
  group.add(felt);

  const recordMat = new THREE.MeshStandardMaterial({
    map: discFaceTexture(null), roughness: 0.35, metalness: 0.2,
  });
  const record = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.015, 64), [
    new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.4 }),
    recordMat,
    new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.5 }),
  ]);
  record.position.copy(platterPos).add(new THREE.Vector3(0, 0.042, 0));
  record.castShadow = true;
  record.visible = false; // platter starts empty — first pick installs a disc
  group.add(record);

  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 12), brassMat);
  spindle.position.copy(platterPos).add(new THREE.Vector3(0, 0.045, 0));
  group.add(spindle);

  /* tonearm (back-right) */
  const tonearm = new THREE.Group();
  tonearm.position.set(0.72, deckY, 0.72);
  const armPost = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.16, 24), brassMat);
  armPost.position.y = 0.08;
  tonearm.add(armPost);
  const armPivot = new THREE.Group();
  armPivot.position.y = 0.17;
  tonearm.add(armPivot);
  const armTube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.82, 12), brassMat);
  armTube.rotation.z = Math.PI / 2;
  armTube.position.x = -0.41;
  armPivot.add(armTube);
  const headshell = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.045), blackMetal);
  headshell.position.set(-0.82, -0.02, 0);
  headshell.rotation.z = 0.12;
  armPivot.add(headshell);
  const counterweight = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 20), darkBrass);
  counterweight.rotation.z = Math.PI / 2;
  counterweight.position.x = 0.09;
  armPivot.add(counterweight);
  armPivot.rotation.y = 0.42;   // rest: swung to the front edge, off the record
  armPivot.rotation.z = -0.06;  // raised
  tonearm.traverse((o) => { o.castShadow = true; });
  group.add(tonearm);

  /* crank */
  const crank = new THREE.Group();
  const crankShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 12), darkBrass);
  crankShaft.rotation.z = Math.PI / 2;
  crank.add(crankShaft);
  const crankElbow = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 12), darkBrass);
  crankElbow.position.set(0.15, -0.07, 0);
  crank.add(crankElbow);
  const crankKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.09, 12), woodMat);
  crankKnob.rotation.z = Math.PI / 2;
  crankKnob.position.set(0.19, -0.14, 0);
  crank.add(crankKnob);
  crank.position.set(1.1, 0.55, 0.3);
  crank.traverse((o) => { o.castShadow = true; });
  group.add(crank);

  /* horn — swan-neck pipe rising from the deck, blooming into a wide bell
     that faces forward over the platter (classic HMV silhouette) */
  const hornGroup = new THREE.Group();

  const neckPts = [
    new THREE.Vector3(0, 0.02, -0.06),
    new THREE.Vector3(0, 0.38, -0.18),
    new THREE.Vector3(0, 0.78, -0.22),
    new THREE.Vector3(0, 1.08, -0.04),
    new THREE.Vector3(0, 1.18, 0.24),
  ];
  const neckCurve = new THREE.CatmullRomCurve3(neckPts);
  const neck = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 56, 0.052, 20), brassMat);
  hornGroup.add(neck);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.115, 0.1, 24), darkBrass);
  foot.position.set(0, 0.04, -0.05);
  hornGroup.add(foot);
  // collar where neck meets bell
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.058, 0.1, 20), darkBrass);

  const bellLen = 1.3;
  const bellPts = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const r = 0.052 + Math.pow(t, 2.35) * 0.86 + Math.pow(t, 10) * 0.14;
    bellPts.push(new THREE.Vector2(r, t * bellLen));
  }
  const bellGeo = new THREE.LatheGeometry(bellPts, 88);
  const bell = new THREE.Mesh(bellGeo, brassMat);
  const bellInner = new THREE.Mesh(
    bellGeo.clone().scale(0.962, 0.995, 0.962),
    new THREE.MeshStandardMaterial({ color: 0x4a3818, metalness: 0.85, roughness: 0.55, side: THREE.BackSide }),
  );
  bell.add(bellInner);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.026, 12, 88), brassMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = bellLen;
  bell.add(rim);

  // aim the bell along the neck's end tangent (up-and-forward)
  const bellHolder = new THREE.Group();
  bellHolder.position.copy(neckPts[neckPts.length - 1]);
  bellHolder.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    neckCurve.getTangent(1).normalize(),
  );
  collar.position.y = 0.02;
  bellHolder.add(collar);
  bellHolder.add(bell);
  hornGroup.add(bellHolder);

  hornGroup.position.set(0.3, deckY, -0.6);
  hornGroup.rotation.y = -0.3;
  hornGroup.traverse((o) => { o.castShadow = true; });
  group.add(hornGroup);

  /* state + api */
  const state = { spinning: false, spinSpeed: 0 };

  function startPlaying() {
    state.spinning = true;
    gsap.to(state, { spinSpeed: 1, duration: 2.2, ease: 'power2.in' });
    gsap.to(armPivot.rotation, { y: -0.46, z: 0.0, duration: 1.6, ease: 'power2.inOut' });
  }

  function stopPlaying() {
    gsap.to(state, {
      spinSpeed: 0, duration: 2.8, ease: 'power2.out',
      onComplete: () => { state.spinning = false; },
    });
    gsap.to(armPivot.rotation, { y: 0.42, z: -0.06, duration: 1.4, ease: 'power2.inOut', delay: 0.2 });
  }

  /** Install a song's vinyl on the platter (called when the flying disc lands). */
  function setRecord(texture) {
    recordMat.map = texture;
    recordMat.needsUpdate = true;
    record.visible = true;
  }
  function hideRecord() { record.visible = false; }

  /** World-space point where a flying disc should land (record resting spot). */
  function platterTarget() {
    group.updateWorldMatrix(true, false);
    return {
      pos: group.localToWorld(record.position.clone()),
      scale: group.scale.x, // group is scaled uniformly
    };
  }

  let t = 0;
  function update(dt, energy = 0) {
    t += dt;
    record.rotation.y -= dt * 2.4 * state.spinSpeed;
    platter.rotation.y = record.rotation.y;
    const s = 1 + energy * 0.012 + Math.sin(t * 1.3) * 0.002;
    hornGroup.scale.setScalar(s);
    hornGroup.rotation.z = Math.sin(t * 0.4) * 0.006 * (1 + energy);
  }

  return { group, update, startPlaying, stopPlaying, setRecord, hideRecord, platterTarget, state };
}
