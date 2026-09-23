import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

import { LOGO_PATH } from "@/components/layout/logo-mark";

/**
 * The 3D scene behind the balance card (docs/DESIGN_SYSTEM.md §0.10).
 *
 * A pearl bank card carrying the extruded Finora mark and a gold chip,
 * a sky-blue card behind it, and a handful of gold coins drifting around
 * them. The group leans toward the pointer and breathes on its own.
 *
 * Plain three.js with no React in it: the component that owns the canvas
 * creates this once, feeds it pointer and size, and disposes it. The loop
 * only runs while the canvas is on screen and the tab is visible, and with
 * reduced motion there is no loop at all — one still frame. It draws every
 * frame only while it has something to show — the intro, or the pointer
 * moving — and drops to half rate for the slow idle breathing, which no one
 * can tell from full rate but a battery can.
 *
 * And it watches itself: if it cannot hold ~20 frames a second over its
 * first two seconds — software WebGL, a starved GPU — it settles on a still
 * frame and stops, rather than taking the rest of the page down with it.
 *
 * Colours are the brand primitives read from CSS, so the scene cannot drift
 * from the token layer; they are identical in both themes, which is why
 * nothing here listens for a theme change.
 */

export type BalanceScene = {
  resize: (width: number, height: number) => void;
  /** Pointer position in -1..1 on both axes, 0 at the centre. */
  point: (x: number, y: number) => void;
  setRunning: (running: boolean) => void;
  dispose: () => void;
};

type Palette = { primary: string; sky: string; sun: string; surface: string };

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string) => style.getPropertyValue(name).trim();

  return {
    primary: read("--brand-primary"),
    sky: read("--brand-sky"),
    sun: read("--brand-sun"),
    surface: read("--brand-surface"),
  };
}

function roundedRect(width: number, height: number, radius: number): THREE.Shape {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();

  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);

  return shape;
}

/** The logo path from the SVG mark, extruded, centred and sized in scene units. */
function logoGeometry(height: number): THREE.ExtrudeGeometry {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 637 715"><path d="${LOGO_PATH}"/></svg>`;
  const { paths } = new SVGLoader().parse(svg);
  const shapes = paths.flatMap((path) => path.toShapes());

  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: 40,
    bevelEnabled: true,
    bevelThickness: 8,
    bevelSize: 6,
    bevelSegments: 3,
    curveSegments: 12,
  });
  geometry.center();

  // SVG's y axis points down; the scene's points up. A half turn about x
  // flips it without mirroring the faces, which a negative scale would do —
  // that turns the mesh inside out and the front face culls away.
  geometry.rotateX(Math.PI);
  geometry.scale(height / 715, height / 715, height / 715);

  return geometry;
}

export function createBalanceScene(
  canvas: HTMLCanvasElement,
  { animate }: { animate: boolean },
): BalanceScene {
  const palette = readPalette();

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  // 1.5 rather than the display's 3: the card is soft-lit and glossy, and
  // the difference is invisible while the pixel count is not.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-3, 4, 6);
  scene.add(key);

  const disposables: { dispose: () => void }[] = [environment, pmrem];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const rig = new THREE.Group();
  scene.add(rig);

  /* Cards ------------------------------------------------------------- */
  const cardGeometry = track(
    new THREE.ExtrudeGeometry(roundedRect(3.4, 2.14, 0.26), {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 5,
      curveSegments: 24,
    }),
  );
  cardGeometry.center();

  const back = new THREE.Mesh(
    cardGeometry,
    track(
      new THREE.MeshPhysicalMaterial({
        color: palette.sky,
        metalness: 0.4,
        roughness: 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.2,
      }),
    ),
  );
  back.position.set(-0.42, 0.34, -0.42);
  back.rotation.z = 0.14;
  rig.add(back);

  const card = new THREE.Group();
  card.rotation.z = -0.05;
  rig.add(card);

  card.add(
    new THREE.Mesh(
      cardGeometry,
      track(
        new THREE.MeshPhysicalMaterial({
          color: palette.surface,
          metalness: 0.1,
          roughness: 0.18,
          clearcoat: 1,
          clearcoatRoughness: 0.06,
          // A thin-film sheen: the card shifts colour as it turns.
          iridescence: 0.7,
          iridescenceIOR: 1.35,
          iridescenceThicknessRange: [180, 520],
        }),
      ),
    ),
  );

  // The mark sits on the inline start — the right, in Persian.
  const logo = new THREE.Mesh(
    track(logoGeometry(0.62)),
    track(
      new THREE.MeshPhysicalMaterial({
        color: palette.primary,
        metalness: 0.3,
        roughness: 0.25,
        clearcoat: 1,
      }),
    ),
  );
  logo.position.set(1.12, 0.5, 0.07);
  card.add(logo);

  const gold = track(
    new THREE.MeshStandardMaterial({
      color: palette.sun,
      metalness: 1,
      roughness: 0.28,
    }),
  );

  const chip = new THREE.Mesh(
    track(
      new THREE.ExtrudeGeometry(roundedRect(0.5, 0.38, 0.07), {
        depth: 0.02,
        bevelEnabled: true,
        bevelThickness: 0.01,
        bevelSize: 0.01,
        bevelSegments: 2,
      }),
    ),
    gold,
  );
  chip.position.set(-1.05, 0.2, 0.06);
  card.add(chip);

  // "•••• •••• •••• ••••" along the bottom, as one instanced draw.
  const dotGeometry = track(new THREE.SphereGeometry(0.035, 12, 12));
  const dotMaterial = track(
    new THREE.MeshStandardMaterial({
      color: palette.primary,
      metalness: 0.2,
      roughness: 0.4,
    }),
  );
  const dots = new THREE.InstancedMesh(dotGeometry, dotMaterial, 16);
  const matrix = new THREE.Matrix4();
  for (let group = 0; group < 4; group += 1) {
    for (let index = 0; index < 4; index += 1) {
      matrix.setPosition(-1.2 + group * 0.72 + index * 0.12, -0.62, 0.07);
      dots.setMatrixAt(group * 4 + index, matrix);
    }
  }
  card.add(dots);
  disposables.push({ dispose: () => dots.dispose() });

  /* Coins -------------------------------------------------------------- */
  const coinGeometry = track(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 48));
  const rimGeometry = track(new THREE.TorusGeometry(0.27, 0.022, 10, 48));
  const coinSpots = [
    { x: 1.95, y: 1.15, z: 0.7, scale: 0.9 },
    { x: -2.05, y: -0.95, z: 0.9, scale: 1 },
    { x: 1.75, y: -1.25, z: 1.3, scale: 0.7 },
    { x: -1.7, y: 1.3, z: -0.8, scale: 0.75 },
    { x: 0.3, y: -1.55, z: -0.9, scale: 0.6 },
  ];
  const coins = coinSpots.map((spot, index) => {
    const coin = new THREE.Group();
    const body = new THREE.Mesh(coinGeometry, gold);
    body.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(rimGeometry, gold);
    rim.position.z = 0.045;
    coin.add(body, rim);
    coin.position.set(spot.x, spot.y, spot.z);
    coin.scale.setScalar(spot.scale);
    coin.rotation.set(0.4, index * 0.9, 0.2);
    rig.add(coin);
    return { coin, spot, phase: index * 1.3 };
  });

  /* Behaviour ---------------------------------------------------------- */
  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  let intro = animate ? 0 : 1;
  let running = false;
  let frame = 0;
  let last = performance.now();
  let lastDrawn = 0;
  let lastPointerMove = 0;
  // Self-measurement: frames seen since the loop first started.
  let sampleStart = 0;
  let sampleFrames = 0;
  let sampled = false;
  let degraded = false;

  function pose(time: number) {
    eased.x += (pointer.x - eased.x) * 0.06;
    eased.y += (pointer.y - eased.y) * 0.06;

    // The intro eases the group in from a tilt, expo-out.
    const settle = 1 - Math.pow(1 - intro, 4);
    const t = time / 1000;

    rig.rotation.y = eased.x * 0.42 + Math.sin(t * 0.45) * 0.07 + (1 - settle) * 0.9;
    rig.rotation.x = -eased.y * 0.28 + Math.cos(t * 0.5) * 0.04 + (1 - settle) * -0.4;
    rig.position.y = Math.sin(t * 0.9) * 0.06;
    rig.scale.setScalar(0.82 + settle * 0.18);

    for (const { coin, spot, phase } of coins) {
      coin.position.y = spot.y + Math.sin(t * 1.1 + phase) * 0.12;
      coin.rotation.y = phase + t * 0.8;
    }
  }

  function render(time: number) {
    const delta = Math.min(0.05, (time - last) / 1000);
    last = time;
    intro = Math.min(1, intro + delta / 1.4);

    if (!sampled) {
      if (sampleStart === 0) sampleStart = time;
      sampleFrames += 1;
      const elapsed = time - sampleStart;
      if (elapsed >= 2000) {
        sampled = true;
        if ((sampleFrames * 1000) / elapsed < 20) {
          degraded = true;
          running = false;
          renderStill();
          return;
        }
      }
    }

    const busy = intro < 1 || time - lastPointerMove < 1500;
    // Idle, draw at most ~30 times a second.
    if (busy || time - lastDrawn >= 32) {
      lastDrawn = time;
      pose(time);
      renderer.render(scene, camera);
    }

    if (running) frame = requestAnimationFrame(render);
  }

  /** One frame. Where the scene will not move again, it lands settled. */
  function renderStill() {
    if (!animate || degraded) intro = 1;
    pose(0);
    renderer.render(scene, camera);
  }

  return {
    resize(width, height) {
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // Frame the card and its coins: far enough back that they fit across
      // a narrow canvas and top to bottom on a wide one, and no further.
      const span = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      camera.position.z = Math.max(5.4 / (span * camera.aspect), 3.9 / span);
      camera.updateProjectionMatrix();
      if (!running) renderStill();
    },
    point(x, y) {
      if (!animate || (x === pointer.x && y === pointer.y)) return;
      pointer.x = x;
      pointer.y = y;
      lastPointerMove = performance.now();
    },
    setRunning(next) {
      if (!animate || degraded) {
        renderStill();
        return;
      }
      if (next === running) return;
      running = next;
      if (running) {
        last = performance.now();
        // Time spent paused (off screen, tab hidden) is not slowness.
        if (!sampled) {
          sampleStart = 0;
          sampleFrames = 0;
        }
        frame = requestAnimationFrame(render);
      } else {
        cancelAnimationFrame(frame);
      }
    },
    dispose() {
      running = false;
      cancelAnimationFrame(frame);
      for (const item of disposables) item.dispose();
      renderer.dispose();
    },
  };
}
