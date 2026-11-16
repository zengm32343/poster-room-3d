import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import {
  gridSize,
  paperArea,
  placement,
  type PosterLayout,
} from './poster-geometry';
import {
  GALLERY_FRAME_MM,
  roomDimensions,
  roomPanels,
  roomTiles,
} from './poster-room-geometry';
import { posterWallFace, wallPaper } from './poster-room-paper';

function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export type RoomFrame = 'none' | 'oak' | 'black';

export async function createRoomScene(
  host: HTMLElement,
  url: string,
  ratio: number,
  layout: PosterLayout,
  onLost: () => void,
  onZoom: (zoom: number) => void,
  galleryFrames = false
) {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'low-power',
  });
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, coarse ? 1.15 : 1.55)
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#ded9cf');
  const camera = new THREE.PerspectiveCamera(43, 1, 0.06, 100);
  const textures: THREE.Texture[] = [];
  const mat = (color: string, roughness = 0.9) =>
    new THREE.MeshStandardMaterial({ color, roughness });
  const {
    width: w,
    height: h,
    centerY: cy,
    wallWidth,
    wallHeight,
  } = roomDimensions(layout);
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };
  const box = (
    x: number,
    y: number,
    z: number,
    a: number,
    b: number,
    c: number,
    material: THREE.Material
  ) =>
    add(
      new RoundedBoxGeometry(a, b, c, 2, Math.min(0.035, a / 8, b / 8, c / 8)),
      material,
      x,
      y,
      z
    );
  let seed = 49;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const plaster = canvasTexture(384, 384, (ctx) => {
    const stain = ctx.createImageData(384, 384);
    for (let y = 0; y < 384; y++)
      for (let x = 0; x < 384; x++) {
        const trowel =
          Math.sin(x * 0.051 + Math.sin(y * 0.067) * 2) * 1.35 +
          Math.sin((x + y * 2) * 0.085) * 0.65;
        const grain = trowel + (random() - 0.5) * 7;
        const i = (y * 384 + x) * 4;
        stain.data.set([222 + grain, 213 + grain, 199 + grain, 255], i);
      }
    ctx.putImageData(stain, 0, 0);
  });
  plaster.wrapS = plaster.wrapT = THREE.RepeatWrapping;
  plaster.repeat.set(wallWidth * 1.7, wallHeight * 1.7);
  textures.push(plaster);
  const wall = new THREE.MeshStandardMaterial({
    map: plaster,
    roughness: 0.94,
    bumpMap: plaster,
    bumpScale: 0.0007,
  });
  const trim = mat('#ece7dc', 0.7);
  box(
    0,
    wallHeight / 2,
    posterWallFace - 0.075,
    wallWidth,
    wallHeight,
    0.15,
    wall
  );
  box(
    0,
    wallHeight + 0.06,
    2.1,
    wallWidth,
    0.12,
    4.2,
    mat('#eee7d9')
  ).castShadow = false;

  const left = -wallWidth / 2;
  const roomDepth = 4.2;
  const sill = 0.75;
  const head = 2.42;
  const windowStart = 0.34;
  const windowEnd = 2.43;
  const windowSpan = windowEnd - windowStart;
  const windowZ = (windowStart + windowEnd) / 2;
  const windowY = (sill + head) / 2;
  box(left, sill / 2, roomDepth / 2, 0.14, sill, roomDepth, wall);
  box(
    left,
    (wallHeight + head) / 2,
    roomDepth / 2,
    0.14,
    wallHeight - head,
    roomDepth,
    wall
  );
  box(left, windowY, windowStart / 2, 0.14, head - sill, windowStart, wall);
  box(
    left,
    windowY,
    (windowEnd + roomDepth) / 2,
    0.14,
    head - sill,
    roomDepth - windowEnd,
    wall
  );
  for (const z of [windowStart, windowEnd])
    box(left + 0.095, windowY, z, 0.16, head - sill + 0.12, 0.08, trim);
  for (const y of [sill, head])
    box(left + 0.096, y, windowZ, 0.16, 0.08, windowSpan + 0.12, trim);
  box(left + 0.13, sill - 0.018, windowZ, 0.25, 0.047, windowSpan + 0.16, trim);

  const sash = mat('#797163', 0.74);
  box(left + 0.035, 1.52, windowZ, 0.07, 0.059, windowSpan, sash);
  for (const z of [windowZ, windowStart + 0.06, windowEnd - 0.06])
    box(left + 0.011, windowY, z, 0.041, head - sill, 0.038, sash);

  // A pale Roman shade, folded across the top, diffuses the window rather than reading as an empty opening.
  const blind = mat('#d3c4a8', 1);
  for (let i = 0; i < 5; i++)
    box(
      left + 0.066 + i * 0.006,
      head - 0.045 - 0.068 * i,
      windowZ,
      0.043,
      0.086,
      windowSpan - 0.12,
      blind
    ).castShadow = false;
  const outlook = canvasTexture(640, 420, (ctx) => {
    // A soft backdrop beyond the window leaves the jamb and sill at true depth.
    const sky = ctx.createLinearGradient(0, 0, 0, 420);
    sky.addColorStop(0, '#b9c7c9');
    sky.addColorStop(1, '#d9c3a0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 640, 420);
    ctx.filter = 'blur(3px)';
    for (let house = 0; house < 5; house++) {
      const x = house * 139 - 27;
      const y = 105 + random() * 110;
      ctx.fillStyle = ['#a88972', '#b79d88', '#c5b49b'][house % 3];
      ctx.fillRect(x, y, 126, 420 - y);
      ctx.fillStyle = '#6b6a61';
      ctx.fillRect(x, y, 126, 7);
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 3; col++) {
          ctx.fillStyle = '#6c706b';
          ctx.fillRect(x + 16 + col * 36, y + 23 + row * 64, 18, 29);
          ctx.fillStyle = '#dac9ac';
          ctx.fillRect(x + 14 + col * 36, y + 52 + row * 64, 23, 3);
        }
    }
    for (let i = 0; i < 430; i++) {
      const x = random() * 640,
        y = 100 + random() * 360,
        radius = 3 + random() * 15;
      ctx.fillStyle = ['#56645170', '#b097527a', '#d4bc6772', '#6d775875'][
        i % 4
      ];
      ctx.beginPath();
      ctx.ellipse(x, y, radius * 1.4, radius, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  textures.push(outlook);
  const viewOutside = new THREE.MeshBasicMaterial({
    map: outlook,
    toneMapped: false,
  });
  const outside = add(
    new THREE.PlaneGeometry(8, 5),
    viewOutside,
    left - 2.1,
    1.72,
    1.6
  );
  outside.rotation.y = Math.PI / 2;
  outside.castShadow = false;
  outside.receiveShadow = false;

  const heater = mat('#dfd9cd', 0.72);
  for (let i = 0; i < 13; i++)
    box(
      left + 0.15,
      0.34,
      windowZ - 0.54 + i * 0.09,
      0.105,
      0.47,
      0.055,
      heater
    );
  for (const y of [0.16, 0.52])
    box(left + 0.14, y, windowZ, 0.085, 0.045, 1.15, heater);
  for (const z of [windowZ - 0.48, windowZ + 0.48])
    box(left + 0.14, 0.075, z, 0.115, 0.15, 0.055, heater);

  // A cased opening beside the seating area and a glimpse into the dining nook.
  const right = wallWidth / 2;
  const doorStart = 2.6,
    doorEnd = 3.67,
    doorTop = 2.15;
  box(right, wallHeight / 2, doorStart / 2, 0.12, wallHeight, doorStart, wall);
  box(
    right,
    (wallHeight + doorTop) / 2,
    (doorStart + doorEnd) / 2,
    0.12,
    wallHeight - doorTop,
    doorEnd - doorStart,
    wall
  );
  box(
    right,
    wallHeight / 2,
    (doorEnd + roomDepth) / 2,
    0.12,
    wallHeight,
    roomDepth - doorEnd,
    wall
  );
  for (const z of [doorStart, doorEnd])
    box(right - 0.058, doorTop / 2, z, 0.065, doorTop, 0.073, trim);
  box(
    right - 0.058,
    doorTop,
    (doorStart + doorEnd) / 2,
    0.065,
    0.07,
    doorEnd - doorStart + 0.07,
    trim
  );
  box(right + 1, wallHeight / 2, 2.08, 2, wallHeight, 0.12, mat('#c9bba4'));
  box(right + 1.9, wallHeight / 2, 3.15, 0.13, wallHeight, 2.15, wall);

  const wood = canvasTexture(512, 256, (ctx) => {
    ctx.fillStyle = '#b48e65';
    ctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 1500; i++) {
      const y = random() * 256;
      ctx.strokeStyle = `rgba(${random() > 0.5 ? '66,38,21' : '248,223,180'},${0.025 + random() * 0.08})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        140,
        y - random() * 12,
        340,
        y + random() * 9,
        512,
        y + random() * 4
      );
      ctx.stroke();
    }
  });
  const floorTexture = canvasTexture(1024, 1024, (ctx) => {
    const plank = 39;
    for (let row = 0; row * plank < 1024; row++) {
      const y = row * plank;
      for (let x = -288 + (row % 3) * 96; x < 1024; x += 288) {
        const tone = 0.09 + random() * 0.14;
        ctx.drawImage(
          wood.image,
          0,
          Math.floor(random() * 170),
          512,
          70,
          x,
          y,
          288,
          plank
        );
        ctx.fillStyle = `rgba(211,171,123,${tone})`;
        ctx.fillRect(x, y, 288, plank);
        ctx.strokeStyle = '#63472f88';
        ctx.strokeRect(x + 0.45, y + 0.45, 287.1, plank - 0.9);
        ctx.fillStyle = '#f5d4a82e';
        ctx.fillRect(x + 1, y + 1, 286, 1);
      }
    }
  });
  floorTexture.anisotropy = Math.min(
    8,
    renderer.capabilities.getMaxAnisotropy()
  );
  textures.push(wood, floorTexture);
  const woodMat = new THREE.MeshStandardMaterial({
    map: wood,
    roughness: 0.59,
  });
  const floorMaterial = new THREE.MeshStandardMaterial({
    map: floorTexture,
    bumpMap: floorTexture,
    bumpScale: 0.0007,
    roughness: 0.63,
  });
  const floor = add(
    new THREE.PlaneGeometry(wallWidth + 0.12, roomDepth),
    floorMaterial,
    0,
    0,
    roomDepth / 2
  );
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;
  box(right + 1, -0.023, 3.16, 2, 0.045, 2.15, woodMat);
  box(right + 1.02, 0.758, 3.12, 1.12, 0.047, 0.7, woodMat);
  for (const x of [right + 0.62, right + 1.42])
    for (const z of [2.89, 3.35]) box(x, 0.38, z, 0.05, 0.73, 0.05, woodMat);
  box(0, 0.055, 0.024, wallWidth, 0.11, 0.035, trim);
  box(left + 0.059, 0.055, roomDepth / 2, 0.033, 0.11, roomDepth, trim);
  box(right - 0.059, 0.055, doorStart / 2, 0.033, 0.11, doorStart, trim);

  const ambient = new THREE.HemisphereLight('#e7efff', '#cab498', 1.58);
  scene.add(ambient);
  const bounce = new THREE.DirectionalLight('#f5dbc2', 0.34);
  bounce.position.set(1.8, 2.2, 4);
  scene.add(bounce);
  const sun = new THREE.DirectionalLight('#ffe4c0', 2.12);
  sun.position.set(-6, 3.05, 3.65);
  sun.target.position.set(0, 1.56, 0);
  sun.castShadow = true;
  const shadowSize = coarse ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, {
    left: -wallWidth * 0.68,
    right: wallWidth * 0.68,
    top: wallHeight * 0.87,
    bottom: -wallHeight * 0.87,
    near: 0.1,
    far: 26,
  });
  sun.shadow.normalBias = 0.004;
  sun.shadow.bias = -0.00019;
  sun.shadow.radius = coarse ? 5 : 10;
  scene.add(sun, sun.target);

  const fabricTexture = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#e0dbd0';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 3)
      for (let x = 0; x < 256; x += 3) {
        const lighter = random() > 0.49;
        ctx.fillStyle = lighter ? '#fff5df7a' : '#87786759';
        if ((x + y) % 2) ctx.fillRect(x, y, 2, 1);
        else ctx.fillRect(x, y, 1, 2);
      }
  });
  fabricTexture.wrapS = fabricTexture.wrapT = THREE.RepeatWrapping;
  fabricTexture.repeat.set(3, 3);
  fabricTexture.anisotropy = Math.min(
    8,
    renderer.capabilities.getMaxAnisotropy()
  );
  textures.push(fabricTexture);
  const rugTexture = canvasTexture(500, 400, (ctx) => {
    ctx.fillStyle = '#b6a183';
    ctx.fillRect(0, 0, 500, 400);
    for (let y = 0; y < 400; y += 2)
      for (let x = 0; x < 500; x += 4) {
        ctx.fillStyle = ['#d9c6a1', '#a59072', '#c7b28f', '#ac9a7c'][
          Math.floor(random() * 4)
        ];
        ctx.fillRect(x + (y % 3), y, 3, 1);
      }
    ctx.strokeStyle = '#aa9374';
    ctx.lineWidth = 7;
    ctx.strokeRect(9, 9, 482, 382);
    ctx.strokeStyle = '#dfccaa';
    ctx.lineWidth = 2;
    ctx.strokeRect(13, 13, 474, 374);
  });
  textures.push(rugTexture);
  const rug = add(
    new THREE.PlaneGeometry(2.58, 2.15),
    new THREE.MeshStandardMaterial({
      map: rugTexture,
      bumpMap: rugTexture,
      bumpScale: 0.002,
      roughness: 1,
    }),
    0,
    0.006,
    1.62
  );
  rug.rotation.x = -Math.PI / 2;
  rug.castShadow = false;
  const fabrics: THREE.MeshStandardMaterial[] = [];
  const dark = mat('#433d34');
  {
    // A superellipsoid gives each upholstered piece a continuous curved silhouette.
    const upholstered = (
      center: [number, number, number],
      size: [number, number, number],
      material: THREE.Material,
      shape = 0.42
    ) => {
      const geometry = new THREE.SphereGeometry(1, 48, 32);
      const positions = geometry.getAttribute('position');
      const signedPower = (value: number) =>
        Math.sign(value) * Math.abs(value) ** shape;
      for (let index = 0; index < positions.count; index++) {
        positions.setXYZ(
          index,
          (signedPower(positions.getX(index)) * size[0]) / 2,
          (signedPower(positions.getY(index)) * size[1]) / 2,
          (signedPower(positions.getZ(index)) * size[2]) / 2
        );
      }
      geometry.computeVertexNormals();
      return add(geometry, material, ...center);
    };
    const boucle = new THREE.MeshPhysicalMaterial({
      color: '#d5c6af',
      map: fabricTexture,
      bumpMap: fabricTexture,
      bumpScale: 0.00048,
      roughness: 0.88,
      sheen: 0.29,
      sheenColor: new THREE.Color('#e8cda4'),
      sheenRoughness: 0.75,
    });
    fabrics.push(boucle);
    box(0, 0.12, 0.57, 1.94, 0.2, 0.73, dark);
    upholstered([0, 0.26, 0.57], [2.14, 0.28, 0.89], boucle, 0.25);
    for (const x of [-0.96, 0.96]) {
      upholstered([x, 0.49, 0.58], [0.27, 0.48, 0.91], boucle, 0.35);
    }
    for (const x of [-0.55, 0, 0.55]) {
      upholstered([x, 0.43, 0.64], [0.57, 0.19, 0.72], boucle, 0.29);
      upholstered(
        [x, 0.68, 0.27],
        [0.575, 0.5, 0.32],
        boucle,
        0.32
      ).rotation.x = -0.1;
    }
    const rust = new THREE.MeshStandardMaterial({
      color: '#a25a37',
      map: fabricTexture,
      roughness: 0.92,
    });
    upholstered(
      [-0.67, 0.67, 0.51],
      [0.42, 0.42, 0.16],
      rust,
      0.5
    ).rotation.set(-0.36, -0.23, -0.24);
    upholstered(
      [0.67, 0.63, 0.55],
      [0.46, 0.35, 0.16],
      new THREE.MeshStandardMaterial({
        color: '#7c805c',
        map: fabricTexture,
        roughness: 0.92,
      }),
      0.52
    ).rotation.set(-0.33, 0.27, 0.24);

    // The folded throw rests on the table, clear of the sofa cushions.
    const walnut = new THREE.MeshStandardMaterial({
      color: '#bda38a',
      map: wood,
      roughness: 0.54,
    });
    const table = add(
      new THREE.CylinderGeometry(0.53, 0.51, 0.047, 64),
      walnut,
      -0.18,
      0.39,
      1.76
    );
    table.scale.z = 0.62;
    for (const x of [-0.53, 0.17]) {
      for (const z of [1.56, 1.96]) {
        const foot = add(
          new THREE.CylinderGeometry(0.022, 0.031, 0.37, 12),
          walnut,
          x,
          0.199,
          z
        );
        foot.rotation.z = x < -0.2 ? -0.095 : 0.095;
      }
      box(x, 0.13, 1.76, 0.019, 0.028, 0.42, walnut);
    }
    box(-0.18, 0.125, 1.76, 0.7, 0.028, 0.024, walnut);
    const throwMaterial = new THREE.MeshStandardMaterial({
      color: '#a25837',
      map: fabricTexture,
      bumpMap: fabricTexture,
      bumpScale: 0.003,
      roughness: 1,
    });
    upholstered(
      [-0.49, 0.433, 1.87],
      [0.23, 0.043, 0.17],
      throwMaterial,
      0.35
    ).rotation.y = -0.22;
    box(-0.35, 0.42, 1.77, 0.27, 0.025, 0.19, mat('#758479')).rotation.y =
      -0.12;
    box(-0.34, 0.436, 1.77, 0.26, 0.007, 0.18, mat('#ebe0cc')).rotation.y =
      -0.16;
    const ceramic = mat('#b56e4d', 0.5);
    add(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.05, 0),
          new THREE.Vector2(0.072, 0.015),
          new THREE.Vector2(0.084, 0.075),
          new THREE.Vector2(0.064, 0.118),
          new THREE.Vector2(0.045, 0.145),
          new THREE.Vector2(0.048, 0.158),
          new THREE.Vector2(0.043, 0.158),
          new THREE.Vector2(0.04, 0.145),
          new THREE.Vector2(0.047, 0.108),
          new THREE.Vector2(0.01, 0.022),
        ],
        48
      ),
      ceramic,
      0.11,
      0.407,
      1.72
    );

    const plantX = -1.55;
    const plantZ = 0.55;
    add(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.14, 0),
          new THREE.Vector2(0.16, 0.04),
          new THREE.Vector2(0.2, 0.29),
          new THREE.Vector2(0.2, 0.33),
          new THREE.Vector2(0.182, 0.33),
          new THREE.Vector2(0.175, 0.28),
          new THREE.Vector2(0, 0.28),
        ],
        48
      ),
      mat('#ad7251'),
      plantX,
      0,
      plantZ
    );
    add(
      new THREE.CylinderGeometry(0.175, 0.17, 0.015, 36),
      mat('#47352b'),
      plantX,
      0.29,
      plantZ
    );
    const bark = mat('#65503a');
    const leaves = ['#5d6a43', '#787e47', '#384f35'].map(
      (color) =>
        new THREE.MeshStandardMaterial({
          color,
          side: THREE.DoubleSide,
          roughness: 0.72,
        })
    );
    const leafGeometry = new THREE.PlaneGeometry(1, 1, 8, 6);
    const leafPositions = leafGeometry.getAttribute('position');
    for (let index = 0; index < leafPositions.count; index++) {
      const length = leafPositions.getY(index);
      const across = leafPositions.getX(index);
      const taper = Math.max(0.02, Math.cos(Math.PI * length));
      leafPositions.setXYZ(
        index,
        across * taper,
        length,
        taper * (0.13 - Math.abs(across) * 0.36) + length ** 2 * 0.22
      );
    }
    leafGeometry.computeVertexNormals();
    const trunk = new THREE.Vector3(plantX, 0.3, plantZ);
    for (let branch = 0; branch < 9; branch++) {
      const angle = branch * 2.4;
      const reach = 0.18 + random() * 0.3;
      const tip = new THREE.Vector3(
        plantX + Math.cos(angle) * reach,
        0.83 + random() * 0.57,
        plantZ + Math.sin(angle) * reach
      );
      const stem = new THREE.QuadraticBezierCurve3(
        trunk,
        new THREE.Vector3(plantX, 0.74, plantZ),
        tip
      );
      add(new THREE.TubeGeometry(stem, 18, 0.004, 6, false), bark, 0, 0, 0);
      for (let twig = 0; twig < 5; twig++) {
        const point = stem.getPoint(0.47 + twig * 0.13);
        const leaf = add(
          leafGeometry,
          leaves[(branch + twig) % leaves.length],
          point.x,
          point.y,
          point.z
        );
        leaf.scale.set(0.075 + random() * 0.035, 0.18 + random() * 0.1, 0.2);
        leaf.rotation.set(
          0.35 + random() * 0.55,
          angle,
          (twig % 2 ? 1 : -1) * (0.8 + random() * 0.55)
        );
        leaf.translateY(0.08);
      }
    }
  }
  // A practical floor lamp gives the evening preset a visible light source.
  const lampX = Math.min(wallWidth / 2 - 0.45, 1.7);
  add(
    new THREE.CylinderGeometry(0.18, 0.2, 0.035, 40),
    dark,
    lampX,
    0.03,
    0.65
  );
  add(
    new THREE.CylinderGeometry(0.012, 0.012, 1.55, 12),
    dark,
    lampX,
    0.8,
    0.65
  );
  const shadeMaterial = new THREE.MeshStandardMaterial({
    color: '#e6d6bd',
    map: fabricTexture,
    roughness: 1,
    side: THREE.DoubleSide,
    emissive: '#ffb759',
    emissiveIntensity: 0.12,
  });
  add(
    new THREE.CylinderGeometry(0.18, 0.23, 0.3, 48, 1, true),
    shadeMaterial,
    lampX,
    1.62,
    0.65
  ).castShadow = false;
  fabrics.push(shadeMaterial);
  const lamp = new THREE.PointLight('#ffbd76', 0, 6, 2);
  lamp.position.set(lampX, 1.5, 0.65);
  lamp.castShadow = false;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.normalBias = 0.015;
  scene.add(lamp);

  const scale = Math.min(2048 / layout.width, 2048 / layout.height);
  const artwork = canvasTexture(
    Math.max(1, Math.round(layout.width * scale)),
    Math.max(1, Math.round(layout.height * scale)),
    (ctx) => {
      ctx.scale(scale, scale);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, layout.width, layout.height);
      const p = placement(layout, ratio, 1);
      ctx.drawImage(image, p.x - p.offsetX, p.y - p.offsetY, p.width, p.height);
      const grid = gridSize(layout),
        area = paperArea(
          layout.paperWidth,
          layout.paperHeight,
          layout.margin,
          layout.paperEdges
        );
      ctx.fillStyle = '#fff';
      for (let c = 0; c < layout.columns; c++) {
        const x = c * grid.stepX - p.offsetX;
        if (layout.assembly === 'uncut') {
          ctx.fillRect(x, 0, area.left, layout.height);
          ctx.fillRect(
            x + layout.paperWidth - area.right,
            0,
            area.right,
            layout.height
          );
        } else if (c && layout.assembly === 'framed')
          ctx.fillRect(
            x - (layout.gap ?? 0) / 2,
            0,
            layout.gap ?? 0,
            layout.height
          );
      }
      for (let r = 0; r < layout.rows; r++) {
        const y = r * grid.stepY - p.offsetY;
        if (layout.assembly === 'uncut') {
          ctx.fillRect(0, y, layout.width, area.top);
          ctx.fillRect(
            0,
            y + layout.paperHeight - area.bottom,
            layout.width,
            area.bottom
          );
        } else if (r && layout.assembly === 'framed')
          ctx.fillRect(
            0,
            y - (layout.gap ?? 0) / 2,
            layout.width,
            layout.gap ?? 0
          );
      }
      if (p.border) {
        ctx.fillRect(0, 0, layout.width, p.border);
        ctx.fillRect(0, layout.height - p.border, layout.width, p.border);
        ctx.fillRect(0, 0, p.border, layout.height);
        ctx.fillRect(layout.width - p.border, 0, p.border, layout.height);
      }
    }
  );
  textures.push(artwork);
  artwork.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const paper = new THREE.MeshStandardMaterial({
    map: artwork,
    roughness: 0.94,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const frameMaterial = new THREE.MeshStandardMaterial({ roughness: 0.57 });
  const frameAround = (
    x: number,
    y: number,
    width: number,
    height: number,
    rail: number,
    depth: number
  ) => [
    ...[-1, 1].map((sign) =>
      box(
        x + (sign * (width + rail)) / 2,
        y,
        0.009,
        rail,
        height,
        depth,
        frameMaterial
      )
    ),
    ...[-1, 1].map((sign) =>
      box(
        x,
        y + (sign * (height + rail)) / 2,
        0.009,
        width + rail * 2,
        rail,
        depth,
        frameMaterial
      )
    ),
  ];
  const tiles = roomTiles(layout);
  const frameRails = galleryFrames
    ? roomPanels(layout, tiles).flatMap(({ x, y, width, height }) =>
        frameAround(
          (x + width / 2) / 1000 - w / 2,
          cy + h / 2 - (y + height / 2) / 1000,
          width / 1000,
          height / 1000,
          GALLERY_FRAME_MM / 1000,
          0.015
        )
      )
    : frameAround(0, cy, w, h, 0.02, 0.027);
  frameRails.forEach((mesh) => {
    mesh.visible = false;
  });
  const seamGroup = new THREE.Group();
  scene.add(seamGroup);
  const seamMaterial = new THREE.LineBasicMaterial({
    color: '#4b4238',
    transparent: true,
    opacity: 0.23,
  });
  const print = add(new THREE.PlaneGeometry(w, h), paper, 0, cy, 0.008);
  print.castShadow = false;
  const joins: number[] = [];
  const edgeHighlights: number[] = [];
  const seamZ = 0.009;
  for (const tile of tiles) {
    const x = tile.x / 1000 - w / 2;
    const y = cy + h / 2 - tile.y / 1000;
    if (tile.x > 0) {
      joins.push(x, y, seamZ, x, y - tile.height / 1000, seamZ);
      const edge = x + 0.00055;
      edgeHighlights.push(edge, y, seamZ, edge, y - tile.height / 1000, seamZ);
    }
    if (tile.y > 0) {
      joins.push(x, y, seamZ, x + tile.width / 1000, y, seamZ);
      const edge = y + 0.00055;
      edgeHighlights.push(x, edge, seamZ, x + tile.width / 1000, edge, seamZ);
    }
  }
  const seamGeometry = new THREE.BufferGeometry();
  seamGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(joins, 3)
  );
  seamGroup.add(new THREE.LineSegments(seamGeometry, seamMaterial));
  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(edgeHighlights, 3)
  );
  seamGroup.add(
    new THREE.LineSegments(
      edgeGeometry,
      new THREE.LineBasicMaterial({
        color: '#f5efe3',
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      })
    )
  );
  // Contact shadows remain legible even below the room shadow-map resolution.
  // A tiny texture is shared by every exposed, lightly curled corner.
  const liftShade = canvasTexture(64, 64, (ctx) => {
    const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    gradient.addColorStop(0, 'rgba(32,23,17,0.38)');
    gradient.addColorStop(0.35, 'rgba(34,24,18,0.23)');
    gradient.addColorStop(1, 'rgba(38,28,19,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  });
  textures.push(liftShade);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: liftShade,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: '#ede7d9',
    side: THREE.DoubleSide,
    roughness: 1,
  });
  const lipMaterial = new THREE.LineBasicMaterial({
    color: '#d6cdbb',
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const makeLoosePaper = () => {
    const group = new THREE.Group();
    const pieces = wallPaper(layout, cy);
    const faces = new THREE.Mesh(pieces.surface, paper);
    faces.receiveShadow = true;
    const rims = new THREE.Mesh(pieces.rim, edgeMaterial);
    rims.receiveShadow = true;
    group.add(faces, rims, new THREE.LineSegments(pieces.lip, lipMaterial));
    for (const corner of pieces.contact) {
      const spread = 0.009 + corner.lift * 0.003;
      const shade = new THREE.Mesh(
        new THREE.PlaneGeometry(spread * 1.2, spread),
        shadowMaterial
      );
      shade.position.set(
        corner.x / 1000 - w / 2 + corner.lift * 0.0009,
        cy + h / 2 - corner.y / 1000 - corner.lift * 0.0004,
        posterWallFace + 0.00018
      );
      group.add(shade);
    }
    group.visible = false;
    scene.add(group);
    return group;
  };
  const loosePaper = makeLoosePaper();
  let frameStyle: RoomFrame = 'none';
  let showSeams = true;
  const updatePaper = () => {
    loosePaper.visible =
      (galleryFrames ||
        (layout.assembly !== 'framed' && frameStyle === 'none' && showSeams));
    print.visible = !loosePaper.visible;
    seamGroup.visible =
      layout.assembly !== 'framed' &&
      frameStyle !== 'none' &&
      showSeams;
    for (const rail of frameRails)
      rail.visible = frameStyle !== 'none';
  };
  updatePaper();
  // Baked contact falloff gives small floor junctions depth with no extra light pass.
  const shadow = canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 12, 64, 64, 64);
    g.addColorStop(0, 'rgba(30,23,15,.22)');
    g.addColorStop(1, 'rgba(30,23,15,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
  textures.push(shadow);
  const contact = add(
    new THREE.PlaneGeometry(1.95, 0.9),
    new THREE.MeshBasicMaterial({
      map: shadow,
      transparent: true,
      depthWrite: false,
    }),
    0,
    0.004,
    0.36
  );
  contact.rotation.x = -Math.PI / 2;
  contact.castShadow = false;

  {
    const contactMaterial = contact.material;
    for (const [x, z, width, depth] of [
      [-0.18, 1.76, 1.17, 0.93],
      [-1.55, 0.55, 0.67, 0.67],
    ]) {
      const shade = add(
        new THREE.PlaneGeometry(width, depth),
        contactMaterial,
        x,
        0.009,
        z
      );
      shade.rotation.x = -Math.PI / 2;
      shade.castShadow = false;
    }
  }

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minAzimuthAngle = -0.73;
  controls.maxAzimuthAngle = 0.73;
  controls.minPolarAngle = Math.PI * 0.36;
  controls.maxPolarAngle = Math.PI * 0.515;
  controls.rotateSpeed = 0.84;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false;
  let animation = 0;
  let dragging = false;
  let settleUntil = 0;
  let lastFrame = 0;
  let updatingControls = false;
  let fitDistance = 0;
  let closeDistance = 0;
  let roomTargetY = 0;
  let requestedDistance: number | undefined;
  let requestedAngle: number | undefined;
  let requestedPolar: number | undefined;
  let renderedWidth = 0;
  let renderedHeight = 0;
  const offset = new THREE.Vector3();
  const spherical = new THREE.Spherical();

  const progressAt = (distance: number) =>
    THREE.MathUtils.clamp(
      Math.log(fitDistance / distance) / Math.log(fitDistance / closeDistance),
      0,
      1
    );
  const distanceAt = (progress: number) =>
    fitDistance * (closeDistance / fitDistance) ** progress;
  const publishZoom = () => {
    if (fitDistance)
      onZoom(
        Math.round(
          100 * progressAt(camera.position.distanceTo(controls.target))
        )
      );
  };
  const schedule = () => {
    if (disposed || animation || !host.clientWidth || !host.clientHeight)
      return;
    animation = requestAnimationFrame(draw);
  };
  function draw(now: number) {
    animation = 0;
    if (disposed || !host.clientWidth || !host.clientHeight) return;
    const dt = Math.min(50, (lastFrame && now - lastFrame) || 16.7);
    lastFrame = now;
    // Resolve wheel and drag input once per animation frame.
    const easing = reducedMotion.matches ? 1 : 1 - Math.exp(-dt / 46);
    controls.enableDamping =
      !reducedMotion.matches && (dragging || now < settleUntil);
    controls.dampingFactor = easing;
    updatingControls = true;
    controls.update();
    updatingControls = false;
    spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
    const movingCamera =
      requestedDistance !== undefined ||
      requestedAngle !== undefined ||
      requestedPolar !== undefined;
    if (requestedDistance !== undefined) {
      spherical.radius += (requestedDistance - spherical.radius) * easing;
      if (Math.abs(spherical.radius - requestedDistance) < 0.003) {
        spherical.radius = requestedDistance;
        requestedDistance = undefined;
      }
    }
    if (requestedAngle !== undefined) {
      spherical.theta += (requestedAngle - spherical.theta) * easing;
      if (Math.abs(spherical.theta - requestedAngle) < 0.002) {
        spherical.theta = requestedAngle;
        requestedAngle = undefined;
      }
    }
    if (requestedPolar !== undefined) {
      spherical.phi += (requestedPolar - spherical.phi) * easing;
      if (Math.abs(spherical.phi - requestedPolar) < 0.002) {
        spherical.phi = requestedPolar;
        requestedPolar = undefined;
      }
    }
    const posterFocus = THREE.MathUtils.smoothstep(
      progressAt(spherical.radius),
      0.18,
      0.82
    );
    controls.target.set(
      0,
      THREE.MathUtils.lerp(roomTargetY, cy, posterFocus),
      0.35 * (1 - posterFocus)
    );
    camera.position
      .copy(offset.setFromSpherical(spherical))
      .add(controls.target);
    camera.lookAt(controls.target);
    if (
      movingCamera &&
      requestedAngle === undefined &&
      requestedDistance === undefined &&
      requestedPolar === undefined
    )
      publishZoom();
    renderer.render(scene, camera);
    if (
      dragging ||
      now < settleUntil ||
      requestedDistance !== undefined ||
      requestedAngle !== undefined ||
      requestedPolar !== undefined
    )
      schedule();
  }
  const resizeFrame = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (disposed || !width || !height) return;
    if (width === renderedWidth && height === renderedHeight) {
      schedule();
      return;
    }
    renderer.setSize(width, height, false);
    renderedWidth = width;
    renderedHeight = height;
    camera.aspect = width / height;
    roomTargetY = Math.max(1.1, (cy + h / 2 + 0.15) / 2);
    const frameWidth = camera.aspect < 0.95 ? 3.15 : 4.55;
    const oldProgress = fitDistance
      ? progressAt(camera.position.distanceTo(controls.target))
      : 0;
    const initial = !fitDistance;
    fitDistance =
      Math.max(
        Math.max(2.6, cy + h / 2 + 0.4),
        Math.max(frameWidth, w + 0.94) / camera.aspect
      ) /
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    closeDistance = Math.min(
      fitDistance * 0.85,
      Math.max(0.56, Math.max(h, w / camera.aspect) / (2 * halfFov * 0.74))
    );
    controls.minDistance = closeDistance;
    controls.maxDistance = fitDistance;
    requestedDistance = undefined;
    if (!initial) {
      camera.position
        .sub(controls.target)
        .setLength(distanceAt(oldProgress))
        .add(controls.target);
    } else {
      controls.target.set(0, roomTargetY, 0.35);
      const angle = 0.36;
      camera.position.set(
        Math.sin(angle) * fitDistance,
        roomTargetY + 0.34,
        Math.cos(angle) * fitDistance + 0.35
      );
    }
    camera.updateProjectionMatrix();
    controls.update();
    schedule();
  };
  const beginOrbit = () => {
    dragging = true;
    settleUntil = 0;
    requestedDistance = undefined;
    requestedAngle = undefined;
    requestedPolar = undefined;
    controls.enableDamping = !reducedMotion.matches;
    schedule();
  };
  const endOrbit = () => {
    dragging = false;
    settleUntil = reducedMotion.matches ? 0 : performance.now() + 260;
    publishZoom();
    schedule();
  };
  const wheel = (event: WheelEvent) => {
    if (!fitDistance) return;
    event.stopImmediatePropagation();
    const pixels =
      event.deltaY *
      (event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? host.clientHeight
          : 1);
    const current =
      requestedDistance ?? camera.position.distanceTo(controls.target);
    const nextDistance = THREE.MathUtils.clamp(
      current * Math.exp(THREE.MathUtils.clamp(pixels, -150, 150) * 0.0022),
      controls.minDistance,
      controls.maxDistance
    );
    if (Math.abs(nextDistance - current) < 0.001) return;
    event.preventDefault();
    requestedDistance = nextDistance;
    schedule();
  };
  controls.addEventListener('start', beginOrbit);
  controls.addEventListener('end', endOrbit);
  controls.addEventListener('change', () => {
    if (!updatingControls) schedule();
  });
  renderer.domElement.addEventListener('wheel', wheel, {
    capture: true,
    passive: false,
  });
  const lost = (event: Event) => {
    event.preventDefault();
    onLost();
  };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  host.appendChild(renderer.domElement);
  const resize = new ResizeObserver(resizeFrame);
  resize.observe(host);
  resizeFrame();

  const loader = new THREE.TextureLoader();
  const applyScans = async (
    asset: string,
    materials: THREE.MeshStandardMaterial[],
    repeat: [number, number],
    normalDepth: number
  ) => {
    const results = await Promise.allSettled(
      ['color', 'normal'].map((channel) =>
        loader.loadAsync(`${import.meta.env.BASE_URL}paper/room-materials/${asset}-${channel}.webp`)
      )
    );
    for (const [index, result] of results.entries()) {
      if (result.status !== 'fulfilled') continue;
      const texture = result.value;
      if (disposed) {
        texture.dispose();
        continue;
      }
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(...repeat);
      texture.anisotropy = Math.min(
        8,
        renderer.capabilities.getMaxAnisotropy()
      );
      if (index === 0) texture.colorSpace = THREE.SRGBColorSpace;
      textures.push(texture);
      for (const material of materials) {
        if (index === 0) material.map = texture;
        else {
          material.bumpMap = null;
          material.normalMap = texture;
          material.normalScale.setScalar(normalDepth);
        }
        material.needsUpdate = true;
      }
    }
    schedule();
  };
  void applyScans(
    'oak',
    [floorMaterial],
    [wallWidth / 1.2, roomDepth / 1.2],
    0.39
  );
  void applyScans('linen', fabrics, [5, 5], 0.33);
  void applyScans('plaster', [wall], [3.2, 2.1], 0.075);
  return {
    viewpoint(angle: number) {
      requestedAngle = angle;
      schedule();
    },
    zoomTo(zoom: number) {
      requestedDistance = distanceAt(zoom / 100);
      schedule();
    },
    focusPoster(fromSide = false) {
      requestedDistance = closeDistance;
      requestedAngle = fromSide ? 0.68 : 0;
      requestedPolar = Math.PI / 2;
      schedule();
    },
    roomView() {
      requestedDistance = fitDistance;
      requestedAngle = 0.36;
      requestedPolar = THREE.MathUtils.clamp(
        Math.atan2(fitDistance, 0.34),
        controls.minPolarAngle,
        controls.maxPolarAngle
      );
      schedule();
    },
    frame(style: RoomFrame) {
      frameStyle = style;
      updatePaper();
      frameMaterial.color.set(style === 'oak' ? '#d4ba95' : '#272724');
      frameMaterial.map = style === 'oak' ? wood : null;
      frameMaterial.needsUpdate = true;
      renderer.shadowMap.needsUpdate = true;
      schedule();
    },
    seams(visible: boolean) {
      showSeams = visible;
      updatePaper();
      schedule();
    },
    lighting(evening: boolean) {
      ambient.intensity = evening ? 0.51 : 1.58;
      bounce.intensity = evening ? 0.075 : 0.34;
      sun.intensity = evening ? 0.1 : 2.12;
      lamp.intensity = evening ? 5.7 : 0.17;
      viewOutside.color.set(evening ? '#38475d' : '#ffffff');
      shadeMaterial.emissiveIntensity = evening ? 0.85 : 0.12;
      renderer.toneMappingExposure = evening ? 1.3 : 1.15;
      schedule();
    },
    dispose() {
      disposed = true;
      if (animation) cancelAnimationFrame(animation);
      renderer.domElement.removeEventListener('wheel', wheel, true);
      resize.disconnect();
      controls.dispose();
      lamp.shadow.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.LineSegments
        ) {
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            materials.add(material);
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      sun.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
