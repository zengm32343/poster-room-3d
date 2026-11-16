import * as THREE from 'three';

import type { PosterLayout } from './poster-geometry';
import { roomPanels, roomTiles } from './poster-room-geometry';

const paperThickness = 0.13;
export const posterWallFace = -0.005;

/** Build the millimetre-scale faces, cut edges and tabs as a few shared meshes. */
export function wallPaper(
  layout: PosterLayout,
  centerY: number,
  only?: number
) {
  const surfaces: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const edges: number[] = [];
  const lips: number[] = [];
  const contact: { x: number; y: number; lift: number }[] = [];
  const point = (x: number, y: number, z: number) => [
    (x - layout.width / 2) / 1000,
    centerY + (layout.height / 2 - y) / 1000,
    posterWallFace + z / 1000,
  ];

  const samples = (start: number, end: number) => {
    const size = end - start;
    const values = [0, 0.38, 1.3, 3.6, 8, 14, 23].filter(
      (value) => value < size / 2
    );
    return [
      ...values.map((v) => start + v),
      (start + end) / 2,
      ...values.reverse().map((v) => end - v),
    ];
  };

  const openGaps = layout.assembly === 'framed';
  const sheets = openGaps ? roomPanels(layout) : roomTiles(layout);
  for (const tile of sheets) {
    if (only !== undefined && tile.row * layout.columns + tile.column !== only)
      continue;
    const gap = openGaps || layout.overlap > 0 ? 0 : 0.12;
    const left = tile.x + (tile.column ? gap : 0);
    const top = tile.y + (tile.row ? gap : 0);
    const right =
      tile.x + tile.width - (tile.column < layout.columns - 1 ? gap : 0);
    const bottom =
      tile.y + tile.height - (tile.row < layout.rows - 1 ? gap : 0);
    if (right <= left || bottom <= top) continue;
    const xs = samples(left, right);
    const ys = samples(top, bottom);

    const corners = [
      { x: left, y: top, outer: !tile.column && !tile.row },
      {
        x: right,
        y: top,
        outer: tile.column === layout.columns - 1 && !tile.row,
      },
      {
        x: left,
        y: bottom,
        outer: !tile.column && tile.row === layout.rows - 1,
      },
      {
        x: right,
        y: bottom,
        outer:
          tile.column === layout.columns - 1 && tile.row === layout.rows - 1,
      },
    ].map((corner, index) => {
      const variance =
        ((tile.row * 13 + tile.column * 7 + index * 5 + 2) % 11) / 10;
      return {
        ...corner,
        lift: corner.outer ? 2.6 + 2.1 * variance : 0.17 + 0.72 * variance,
      };
    });

    for (const corner of corners) if (corner.outer) contact.push(corner);
    // Upper sheets sit beyond the buried tabs. The differences here are in millimetres.
    const heightAt = (x: number, y: number) => {
      const curl = corners.reduce((sum, corner) => {
        const falloff = Math.max(
          0,
          1 - Math.hypot(x - corner.x, y - corner.y) / 23
        );
        return sum + corner.lift * falloff ** 2;
      }, 0);
      const raisedLeadingEdge =
        !openGaps && layout.overlap > 0 && (tile.column > 0 || tile.row > 0)
          ? 0.16
          : 0;
      return 0.45 + paperThickness + raisedLeadingEdge + curl;
    };
    const surfaceVertex = (x: number, y: number, z = heightAt(x, y)) => {
      surfaces.push(...point(x, y, z));
      uvs.push(x / layout.width, 1 - y / layout.height);
    };
    const first = surfaces.length / 3;
    for (const y of ys) for (const x of xs) surfaceVertex(x, y);
    for (let row = 1; row < ys.length; row++) {
      for (let column = 1; column < xs.length; column++) {
        const a = first + (row - 1) * xs.length + column - 1;
        const b = a + 1;
        const c = a + xs.length;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const edge = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      showLip: boolean
    ) => {
      const z0 = heightAt(x0, y0),
        z1 = heightAt(x1, y1);
      const a = point(x0, y0, z0),
        b = point(x1, y1, z1);
      const c = point(x0, y0, z0 - paperThickness),
        d = point(x1, y1, z1 - paperThickness);
      edges.push(...a, ...c, ...b, ...b, ...c, ...d);
      if (showLip)
        lips.push(...point(x0, y0, z0 + 0.025), ...point(x1, y1, z1 + 0.025));
    };
    for (let i = 1; i < xs.length; i++) {
      edge(xs[i - 1], top, xs[i], top, tile.row > 0);
      edge(xs[i], bottom, xs[i - 1], bottom, tile.row === layout.rows - 1);
    }
    for (let i = 1; i < ys.length; i++) {
      edge(left, ys[i], left, ys[i - 1], tile.column > 0);
      edge(right, ys[i - 1], right, ys[i], tile.column === layout.columns - 1);
    }

    if (layout.assembly === 'seamless' && layout.overlap > 0) {
      const tab = (x0: number, y0: number, x1: number, y1: number) => {
        const z = 0.35;
        const a = surfaces.length / 3;
        surfaceVertex(x0, y0, z);
        surfaceVertex(x0, y1, z);
        surfaceVertex(x1, y0, z);
        surfaceVertex(x1, y1, z);
        indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      };
      // Front artwork still uses the exact same coordinates as the print preview.
      if (tile.column < layout.columns - 1)
        tab(right, top, Math.min(layout.width, right + layout.overlap), bottom);
      if (tile.row < layout.rows - 1)
        tab(
          left,
          bottom,
          right,
          Math.min(layout.height, bottom + layout.overlap)
        );
    }
  }

  const geometry = (positions: number[]) => {
    const mesh = new THREE.BufferGeometry();
    mesh.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    return mesh;
  };
  const surface = geometry(surfaces);
  surface.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  surface.setIndex(indices);
  surface.computeVertexNormals();
  const rim = geometry(edges);
  rim.computeVertexNormals();
  return { surface, rim, lip: geometry(lips), contact };
}
