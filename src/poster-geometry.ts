export type Assembly = 'seamless' | 'framed' | 'uncut';
export type FitMode = 'contain' | 'cover' | 'stretch';
export type PaperEdges = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};
export type LayoutOptions = {
  assembly?: Assembly;
  gap?: number;
  border?: number;
  fit?: FitMode;
  center?: boolean;
  overlapInMargins?: boolean;
  paperEdges?: PaperEdges;
  order?: 'rows' | 'columns';
};
export type PosterLayout = LayoutOptions & {
  width: number;
  height: number;
  columns: number;
  rows: number;
  paperWidth: number;
  paperHeight: number;
  margin: number;
  overlap: number;
};
export function paperArea(
  paperWidth: number,
  paperHeight: number,
  margin: number,
  edges?: PaperEdges
) {
  const { top, right, bottom, left } = edges ?? {
    top: margin,
    right: margin,
    bottom: margin,
    left: margin,
  };
  return {
    top,
    right,
    bottom,
    left,
    width: paperWidth - left - right,
    height: paperHeight - top - bottom,
  };
}

export function makeLayout(
  width: number,
  height: number,
  paperWidth: number,
  paperHeight: number,
  margin: number,
  overlap: number,
  saving = false,
  options: LayoutOptions = {}
): PosterLayout {
  const assembly = options.assembly ?? 'seamless';
  const area = paperArea(paperWidth, paperHeight, margin, options.paperEdges);
  const { width: usableWidth, height: usableHeight } = area;
  const bleed = assembly === 'seamless' ? overlap : 0;
  const internalBleed = options.overlapInMargins ? 0 : bleed;
  const stepX = assembly === 'uncut' ? paperWidth : usableWidth - internalBleed;
  const stepY =
    assembly === 'uncut' ? paperHeight : usableHeight - internalBleed;
  if (
    ![
      width,
      height,
      paperWidth,
      paperHeight,
      margin,
      overlap,
      options.gap ?? 0,
      options.border ?? 0,
      area.left,
      area.right,
      area.top,
      area.bottom,
    ].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    margin < 0 ||
    overlap < 0 ||
    Math.min(area.left, area.right, area.top, area.bottom) < 0 ||
    usableWidth <= 0 ||
    usableHeight <= 0 ||
    stepX <= 0 ||
    stepY <= 0 ||
    (options.gap ?? 0) < 0 ||
    (options.border ?? 0) < 0
  )
    throw new Error('Invalid poster dimensions');
  if (saving && assembly !== 'uncut') {
    const columns = Math.max(1, Math.floor((width - internalBleed) / stepX));
    const rows = Math.max(1, Math.floor((height - internalBleed) / stepY));
    const scale = Math.min(
      1,
      (columns * stepX + internalBleed) / width,
      (rows * stepY + internalBleed) / height
    );
    width *= scale;
    height *= scale;
  }
  const columns = Math.max(
    1,
    Math.ceil((width - internalBleed) / stepX - 1e-9)
  );
  const rows = Math.max(1, Math.ceil((height - internalBleed) / stepY - 1e-9));
  if (assembly === 'uncut') {
    width = columns * paperWidth;
    height = rows * paperHeight;
  }
  return {
    width,
    height,
    columns,
    rows,
    paperWidth,
    paperHeight,
    margin,
    overlap: bleed,
    ...options,
    assembly,
  };
}

export function gridSize(layout: PosterLayout) {
  const uncut = layout.assembly === 'uncut';
  const internalBleed = layout.overlapInMargins ? 0 : layout.overlap;
  const area = paperArea(
    layout.paperWidth,
    layout.paperHeight,
    layout.margin,
    layout.paperEdges
  );
  const stepX = uncut ? layout.paperWidth : area.width - internalBleed;
  const stepY = uncut ? layout.paperHeight : area.height - internalBleed;
  return {
    stepX,
    stepY,
    width: layout.columns * stepX + internalBleed,
    height: layout.rows * stepY + internalBleed,
  };
}
export function placement(
  layout: PosterLayout,
  sourceWidth: number,
  sourceHeight: number
) {
  const grid = gridSize(layout);
  const offsetX = layout.center ? (grid.width - layout.width) / 2 : 0;
  const offsetY = layout.center ? (grid.height - layout.height) / 2 : 0;
  const border = Math.min(
    layout.border ?? 0,
    layout.width / 3,
    layout.height / 3
  );
  const boxWidth = layout.width - 2 * border,
    boxHeight = layout.height - 2 * border;
  const scale =
    (layout.fit ?? 'contain') === 'cover'
      ? Math.max(boxWidth / sourceWidth, boxHeight / sourceHeight)
      : Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  const width = layout.fit === 'stretch' ? boxWidth : sourceWidth * scale;
  const height = layout.fit === 'stretch' ? boxHeight : sourceHeight * scale;
  return {
    x: offsetX + border + (boxWidth - width) / 2,
    y: offsetY + border + (boxHeight - height) / 2,
    width,
    height,
    offsetX,
    offsetY,
    border,
  };
}
