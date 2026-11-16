import { gridSize, placement, type PosterLayout } from './poster-geometry';

// Trim duplicate overlap before assembling; the final row/column can be smaller.
export function roomTiles(layout: PosterLayout) {
  const grid = gridSize(layout);
  const { offsetX, offsetY } = placement(layout, 1, 1);
  const tiles = [];
  for (let row = 0; row < layout.rows; row++) {
    for (let column = 0; column < layout.columns; column++) {
      const x = Math.max(0, column * grid.stepX - offsetX);
      const y = Math.max(0, row * grid.stepY - offsetY);
      const right =
        column === layout.columns - 1
          ? layout.width
          : Math.min(layout.width, (column + 1) * grid.stepX - offsetX);
      const bottom =
        row === layout.rows - 1
          ? layout.height
          : Math.min(layout.height, (row + 1) * grid.stepY - offsetY);
      if (right > x && bottom > y)
        tiles.push({ x, y, width: right - x, height: bottom - y, row, column });
    }
  }
  return tiles;
}

export const GALLERY_FRAME_MM = 4;

// Panel gaps are between the sheets. The printed outer border stays inside the frames.
export function roomPanels(layout: PosterLayout, tiles = roomTiles(layout)) {
  const inset = (layout.gap ?? 0) / 2;
  return tiles.flatMap((tile) => {
    const x = tile.x + (tile.column ? inset : 0);
    const y = tile.y + (tile.row ? inset : 0);
    const right =
      tile.x + tile.width - (tile.column < layout.columns - 1 ? inset : 0);
    const bottom =
      tile.y + tile.height - (tile.row < layout.rows - 1 ? inset : 0);
    return right > x && bottom > y
      ? [{ ...tile, x, y, width: right - x, height: bottom - y }]
      : [];
  });
}

export function roomDimensions(layout: PosterLayout) {
  const width = layout.width / 1000,
    height = layout.height / 1000;
  const centerY = Math.max(1.65, 1.03 + height / 2);
  return {
    width,
    height,
    centerY,
    wallWidth: Math.max(4.8, width + 1.4),
    wallHeight: Math.max(2.8, centerY + height / 2 + 0.45),
  };
}
