export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

export type Vec2 = {
  x: number;
  y: number;
};

export type PathCommand =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "Q"; x1: number; y1: number; x: number; y: number }
  | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "Z" };

export type CubicBezierNode = {
  id: string;
  contourIndex: number;
  nodeIndex: number;
  anchor: Vec2;
  inHandle: Vec2;
  outHandle: Vec2;
};

export type CubicBezierContour = {
  id: string;
  contourIndex: number;
  closed: boolean;
  direction: "cw" | "ccw";
  area: number;
  isHole: boolean;
  bounds: Bounds;
  nodes: CubicBezierNode[];
};

export type VectorizedGlyph = {
  char: string;
  bounds: Bounds;
  advanceWidth: number;
  originalPathData: string;
  rebuiltPathData: string;
  contours: CubicBezierContour[];
  nodeCount: number;
  segmentCount: number;
  holeCount: number;
};

export type GlyphWorkbenchControls = {
  width: number;
  height: number;
  weight: number;
  contrast: number;
  slant: number;
  roundness: number;
  chamfer: number;
  facet: number;
  pixelSnap: number;
  wobble: number;
  liquify: number;
  glitch: number;
};
