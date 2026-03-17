import { clamp, commandsToPathData, computeBounds, lerp } from "@/lib/glyph/path-utils";
import { GLYPH_BASELINE } from "@/lib/glyph/vectorize-glyph";
import type {
  Bounds,
  CubicBezierContour,
  CubicBezierNode,
  GlyphWorkbenchControls,
  PathCommand,
  Vec2,
  VectorizedGlyph
} from "@/lib/types";

const EPSILON = 0.0001;

type CubicSegment = {
  p0: Vec2;
  p1: Vec2;
  p2: Vec2;
  p3: Vec2;
};

type RoundedCornerSpec = {
  incomingTrim: number;
  outgoingTrim: number;
  arc: CubicSegment;
};

type ChamferCornerSpec = {
  incomingTrim: number;
  outgoingTrim: number;
  bridge: CubicSegment;
};

function clonePoint(point: Vec2): Vec2 {
  return { x: point.x, y: point.y };
}

function cloneNode(node: CubicBezierNode): CubicBezierNode {
  return {
    ...node,
    anchor: clonePoint(node.anchor),
    inHandle: clonePoint(node.inHandle),
    outHandle: clonePoint(node.outHandle)
  };
}

function cloneContour(contour: CubicBezierContour): CubicBezierContour {
  return {
    ...contour,
    bounds: { ...contour.bounds },
    nodes: contour.nodes.map(cloneNode)
  };
}

function mapNodePoints(
  node: CubicBezierNode,
  mapper: (point: Vec2) => Vec2
): CubicBezierNode {
  return {
    ...node,
    anchor: mapper(node.anchor),
    inHandle: mapper(node.inHandle),
    outHandle: mapper(node.outHandle)
  };
}

function mapContourPoints(
  contour: CubicBezierContour,
  mapper: (point: Vec2) => Vec2
): CubicBezierContour {
  return {
    ...contour,
    nodes: contour.nodes.map((node) => mapNodePoints(node, mapper))
  };
}

function scalePoint(point: Vec2, origin: Vec2, scaleX: number, scaleY: number): Vec2 {
  return {
    x: origin.x + (point.x - origin.x) * scaleX,
    y: origin.y + (point.y - origin.y) * scaleY
  };
}

function addPoint(a: Vec2, b: Vec2): Vec2 {
  return {
    x: a.x + b.x,
    y: a.y + b.y
  };
}

function subtractPoint(a: Vec2, b: Vec2): Vec2 {
  return {
    x: a.x - b.x,
    y: a.y - b.y
  };
}

function multiplyPoint(point: Vec2, scalar: number): Vec2 {
  return {
    x: point.x * scalar,
    y: point.y * scalar
  };
}

function pointLength(point: Vec2) {
  return Math.hypot(point.x, point.y);
}

function normalizePoint(point: Vec2): Vec2 {
  const length = pointLength(point);

  if (length < EPSILON) {
    return { x: 0, y: 0 };
  }

  return {
    x: point.x / length,
    y: point.y / length
  };
}

function dotPoint(a: Vec2, b: Vec2) {
  return a.x * b.x + a.y * b.y;
}

function lerpPoint(a: Vec2, b: Vec2, alpha: number): Vec2 {
  return {
    x: a.x + (b.x - a.x) * alpha,
    y: a.y + (b.y - a.y) * alpha
  };
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / (edge1 - edge0 || 1), 0, 1);
  return t * t * (3 - 2 * t);
}

function polygonArea(points: Vec2[]) {
  let area = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }

  return area / 2;
}

function contourToCommands(contour: CubicBezierContour): PathCommand[] {
  if (!contour.nodes.length) {
    return [];
  }

  const commands: PathCommand[] = [
    {
      type: "M",
      x: contour.nodes[0].anchor.x,
      y: contour.nodes[0].anchor.y
    }
  ];

  for (let index = 1; index < contour.nodes.length; index += 1) {
    const previousNode = contour.nodes[index - 1];
    const node = contour.nodes[index];

    commands.push({
      type: "C",
      x1: previousNode.outHandle.x,
      y1: previousNode.outHandle.y,
      x2: node.inHandle.x,
      y2: node.inHandle.y,
      x: node.anchor.x,
      y: node.anchor.y
    });
  }

  if (contour.closed && contour.nodes.length > 1) {
    const lastNode = contour.nodes[contour.nodes.length - 1];
    const firstNode = contour.nodes[0];

    commands.push({
      type: "C",
      x1: lastNode.outHandle.x,
      y1: lastNode.outHandle.y,
      x2: firstNode.inHandle.x,
      y2: firstNode.inHandle.y,
      x: firstNode.anchor.x,
      y: firstNode.anchor.y
    });
    commands.push({ type: "Z" });
  }

  return commands;
}

function finalizeContour(contour: CubicBezierContour): CubicBezierContour {
  const commands = contourToCommands(contour);
  const area = contour.nodes.length >= 3 ? polygonArea(contour.nodes.map((node) => node.anchor)) : 0;

  return {
    ...contour,
    area,
    direction: area < 0 ? "cw" : "ccw",
    bounds: computeBounds(commands)
  };
}

function rebuildGlyph(
  sourceGlyph: VectorizedGlyph,
  contours: CubicBezierContour[]
): VectorizedGlyph {
  const finalizedContours = contours.map(finalizeContour);
  const rebuiltCommands = finalizedContours.flatMap((contour) => contourToCommands(contour));
  const nodeCount = finalizedContours.reduce((count, contour) => count + contour.nodes.length, 0);

  return {
    ...sourceGlyph,
    bounds: computeBounds(rebuiltCommands),
    rebuiltPathData: commandsToPathData(rebuiltCommands),
    contours: finalizedContours,
    nodeCount,
    segmentCount: nodeCount,
    holeCount: finalizedContours.filter((contour) => contour.isHole).length
  };
}

export function getWidthScale(width: number) {
  return clamp(1 + width / 100, 0.5, 1.5);
}

export function getHeightScale(height: number) {
  return clamp(1 + height / 100, 0.5, 1.5);
}

export function clampSlant(slant: number) {
  return clamp(slant, -20, 20);
}

export function getSlantShear(slant: number) {
  return Math.tan((clampSlant(slant) * Math.PI) / 180);
}

export function clampRoundness(roundness: number) {
  return clamp(roundness, 0, 100);
}

export function getRoundnessStrength(roundness: number) {
  return Math.pow(clampRoundness(roundness) / 100, 0.6);
}

export function clampChamfer(chamfer: number) {
  return clamp(chamfer, 0, 100);
}

export function getChamferStrength(chamfer: number) {
  return Math.pow(clampChamfer(chamfer) / 100, 0.74);
}

export function clampFacet(facet: number) {
  return clamp(facet, 0, 100);
}

export function getFacetStrength(facet: number) {
  return Math.pow(clampFacet(facet) / 100, 0.78);
}

export function clampPixelSnap(pixelSnap: number) {
  return clamp(pixelSnap, 0, 100);
}

export function getPixelSnapStrength(pixelSnap: number) {
  return clampPixelSnap(pixelSnap) / 100;
}

export function clampContrast(contrast: number) {
  return clamp(contrast, -100, 100);
}

export function getContrastStrength(contrast: number) {
  return clampContrast(contrast) / 100;
}

export function clampWobble(wobble: number) {
  return clamp(wobble, 0, 100);
}

export function getWobbleStrength(wobble: number) {
  return clampWobble(wobble) / 100;
}

export function clampLiquify(liquify: number) {
  return clamp(liquify, 0, 100);
}

export function getLiquifyStrength(liquify: number) {
  return clampLiquify(liquify) / 100;
}

export function clampGlitch(glitch: number) {
  return clamp(glitch, 0, 100);
}

export function getGlitchStrength(glitch: number) {
  return clampGlitch(glitch) / 100;
}

export function clampWeight(weight: number) {
  return clamp(weight, 100, 900);
}

export function getWeightBlend(weight: number) {
  const clampedWeight = clampWeight(weight);

  if (clampedWeight <= 400) {
    return {
      fromLabel: "Thin 100",
      toLabel: "Regular 400",
      fromWeight: 100,
      toWeight: 400,
      amount: clamp((clampedWeight - 100) / 300, 0, 1)
    };
  }

  return {
    fromLabel: "Regular 400",
    toLabel: "Black 900",
    fromWeight: 400,
    toWeight: 900,
    amount: clamp((clampedWeight - 400) / 500, 0, 1)
  };
}

function areGlyphsCompatible(a: VectorizedGlyph, b: VectorizedGlyph) {
  if (a.contours.length !== b.contours.length) {
    return false;
  }

  return a.contours.every(
    (contour, contourIndex) => contour.nodes.length === b.contours[contourIndex]?.nodes.length
  );
}

function interpolateNode(a: CubicBezierNode, b: CubicBezierNode, amount: number): CubicBezierNode {
  return {
    ...a,
    anchor: lerpPoint(a.anchor, b.anchor, amount),
    inHandle: lerpPoint(a.inHandle, b.inHandle, amount),
    outHandle: lerpPoint(a.outHandle, b.outHandle, amount)
  };
}

function interpolateContour(
  a: CubicBezierContour,
  b: CubicBezierContour,
  amount: number
): CubicBezierContour {
  return {
    ...a,
    nodes: a.nodes.map((node, nodeIndex) => interpolateNode(node, b.nodes[nodeIndex], amount))
  };
}

export function interpolateWeightGlyph(
  thinGlyph: VectorizedGlyph,
  regularGlyph: VectorizedGlyph,
  blackGlyph: VectorizedGlyph,
  weight: number
) {
  const blend = getWeightBlend(weight);

  const fromGlyph = blend.fromWeight === 100 ? thinGlyph : regularGlyph;
  const toGlyph = blend.toWeight === 400 ? regularGlyph : blackGlyph;

  if (!areGlyphsCompatible(fromGlyph, toGlyph)) {
    return regularGlyph;
  }

  const interpolatedContours = fromGlyph.contours.map((contour, contourIndex) =>
    interpolateContour(contour, toGlyph.contours[contourIndex], blend.amount)
  );

  return rebuildGlyph(
    {
      ...regularGlyph,
      advanceWidth: lerp(fromGlyph.advanceWidth, toGlyph.advanceWidth, blend.amount)
    },
    interpolatedContours
  );
}

export function synthesizeWeightGlyph(sourceGlyph: VectorizedGlyph, amount: number) {
  const clampedAmount = clamp(amount, -1, 1);

  if (Math.abs(clampedAmount) < EPSILON) {
    return sourceGlyph;
  }

  const offsetDistance =
    Math.min(sourceGlyph.bounds.width, sourceGlyph.bounds.height) *
    (0.014 + Math.abs(clampedAmount) * 0.042);
  const offsetStrength = Math.sign(clampedAmount) * Math.pow(Math.abs(clampedAmount), 0.9);

  return rebuildGlyph(
    sourceGlyph,
    sourceGlyph.contours.map((contour) => ({
      ...contour,
      nodes: contour.nodes.map((node, nodeIndex) => {
        const { tangent } = getNodeTravel(contour, nodeIndex);
        const normal = getOutwardNormal(contour, tangent);
        const contourDirection = contour.isHole ? -1 : 1;
        const offset = multiplyPoint(normal, offsetDistance * offsetStrength * contourDirection);

        return {
          ...node,
          anchor: addPoint(node.anchor, offset),
          inHandle: addPoint(node.inHandle, offset),
          outHandle: addPoint(node.outHandle, offset)
        };
      })
    }))
  );
}

function resolveDirection(primary: Vec2, fallback: Vec2) {
  return normalizePoint(pointLength(primary) > EPSILON ? primary : fallback);
}

function rotateClockwise(point: Vec2): Vec2 {
  return {
    x: point.y,
    y: -point.x
  };
}

function getNodeTravel(contour: CubicBezierContour, nodeIndex: number) {
  const previousIndex = (nodeIndex - 1 + contour.nodes.length) % contour.nodes.length;
  const node = contour.nodes[nodeIndex];
  const previousNode = contour.nodes[previousIndex];
  const nextNode = contour.nodes[(nodeIndex + 1) % contour.nodes.length];

  const incomingTravel = resolveDirection(
    subtractPoint(node.anchor, node.inHandle),
    subtractPoint(node.anchor, previousNode.anchor)
  );
  const outgoingTravel = resolveDirection(
    subtractPoint(node.outHandle, node.anchor),
    subtractPoint(nextNode.anchor, node.anchor)
  );

  return {
    incomingTravel,
    outgoingTravel,
    tangent: resolveDirection(addPoint(incomingTravel, outgoingTravel), outgoingTravel)
  };
}

function getOutwardNormal(contour: CubicBezierContour, tangent: Vec2) {
  const unitTangent = normalizePoint(tangent);

  if (pointLength(unitTangent) < EPSILON) {
    return { x: 0, y: 0 };
  }

  return contour.direction === "ccw"
    ? normalizePoint(rotateClockwise(unitTangent))
    : normalizePoint(multiplyPoint(rotateClockwise(unitTangent), -1));
}

function buildLineSegment(start: Vec2, end: Vec2): CubicSegment {
  return {
    p0: clonePoint(start),
    p1: lerpPoint(start, end, 1 / 3),
    p2: lerpPoint(start, end, 2 / 3),
    p3: clonePoint(end)
  };
}

function segmentFromContour(contour: CubicBezierContour, nodeIndex: number): CubicSegment {
  const node = contour.nodes[nodeIndex];
  const nextNode = contour.nodes[(nodeIndex + 1) % contour.nodes.length];

  return {
    p0: clonePoint(node.anchor),
    p1: clonePoint(node.outHandle),
    p2: clonePoint(nextNode.inHandle),
    p3: clonePoint(nextNode.anchor)
  };
}

function splitCubic(segment: CubicSegment, t: number) {
  const a = lerpPoint(segment.p0, segment.p1, t);
  const b = lerpPoint(segment.p1, segment.p2, t);
  const c = lerpPoint(segment.p2, segment.p3, t);
  const d = lerpPoint(a, b, t);
  const e = lerpPoint(b, c, t);
  const f = lerpPoint(d, e, t);

  return {
    left: {
      p0: segment.p0,
      p1: a,
      p2: d,
      p3: f
    },
    right: {
      p0: f,
      p1: e,
      p2: c,
      p3: segment.p3
    }
  };
}

function extractSubsegment(segment: CubicSegment, startT: number, endT: number) {
  if (startT <= EPSILON && endT >= 1 - EPSILON) {
    return segment;
  }

  if (startT <= EPSILON) {
    return splitCubic(segment, endT).left;
  }

  if (endT >= 1 - EPSILON) {
    return splitCubic(segment, startT).right;
  }

  const firstSplit = splitCubic(segment, startT);
  const localT = (endT - startT) / (1 - startT);
  return splitCubic(firstSplit.right, localT).left;
}

function pointOnCubic(segment: CubicSegment, t: number) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return {
    x:
      segment.p0.x * mt2 * mt +
      3 * segment.p1.x * mt2 * t +
      3 * segment.p2.x * mt * t2 +
      segment.p3.x * t2 * t,
    y:
      segment.p0.y * mt2 * mt +
      3 * segment.p1.y * mt2 * t +
      3 * segment.p2.y * mt * t2 +
      segment.p3.y * t2 * t
  };
}

function contourFromSegments(
  sourceContour: CubicBezierContour,
  segments: CubicSegment[]
): CubicBezierContour {
  if (!segments.length) {
    return sourceContour;
  }

  return {
    ...sourceContour,
    nodes: segments.map((segment, nodeIndex) => ({
      id: `${sourceContour.contourIndex}-${nodeIndex}`,
      contourIndex: sourceContour.contourIndex,
      nodeIndex,
      anchor: clonePoint(segment.p0),
      inHandle: clonePoint(
        segments[(nodeIndex - 1 + segments.length) % segments.length].p2
      ),
      outHandle: clonePoint(segment.p1)
    }))
  };
}

function contourFromLinearPoints(
  sourceContour: CubicBezierContour,
  points: Vec2[]
): CubicBezierContour {
  if (points.length < 2) {
    return sourceContour;
  }

  const dedupedPoints = points.filter((point, index) => {
    if (index === 0) {
      return true;
    }

    return pointLength(subtractPoint(point, points[index - 1])) > EPSILON;
  });

  if (dedupedPoints.length < 2) {
    return sourceContour;
  }

  const segments = dedupedPoints.map((point, index) =>
    buildLineSegment(point, dedupedPoints[(index + 1) % dedupedPoints.length])
  );

  return contourFromSegments(sourceContour, segments);
}

function buildRoundedCornerSpec(
  contour: CubicBezierContour,
  nodeIndex: number,
  roundness: number
): RoundedCornerSpec | null {
  const strength = getRoundnessStrength(roundness);

  if (strength === 0 || contour.nodes.length < 3) {
    return null;
  }

  const previousIndex = (nodeIndex - 1 + contour.nodes.length) % contour.nodes.length;
  const node = contour.nodes[nodeIndex];
  const previousNode = contour.nodes[previousIndex];
  const nextNode = contour.nodes[(nodeIndex + 1) % contour.nodes.length];
  const previousLength = pointLength(subtractPoint(node.anchor, previousNode.anchor));
  const nextLength = pointLength(subtractPoint(nextNode.anchor, node.anchor));

  if (previousLength < EPSILON || nextLength < EPSILON) {
    return null;
  }

  const { incomingTravel, outgoingTravel } = getNodeTravel(contour, nodeIndex);
  const alignment = clamp(dotPoint(incomingTravel, outgoingTravel), -1, 1);
  const sharpness = clamp((1 - alignment) / 2, 0, 1);

  if (sharpness < 0.008) {
    return null;
  }

  const effect = (0.34 + strength * 1.42) * Math.pow(sharpness, 0.42);
  const inset = Math.min(previousLength, nextLength) * 0.72 * effect;

  if (inset < 0.28) {
    return null;
  }

  const incomingTrim = clamp(1 - inset / previousLength, 0.001, 0.999);
  const outgoingTrim = clamp(inset / nextLength, 0.001, 0.999);
  const entryPoint = splitCubic(segmentFromContour(contour, previousIndex), incomingTrim).left.p3;
  const exitPoint = splitCubic(segmentFromContour(contour, nodeIndex), outgoingTrim).right.p0;
  const turnAngle = Math.acos(clamp(alignment, -0.9999, 0.9999));
  const handleScale = (4 / 3) * Math.tan(turnAngle / 4);
  const handleLength = clamp(inset * handleScale * 1.28, inset * 0.36, inset * 1.22);

  return {
    incomingTrim,
    outgoingTrim,
    arc: {
      p0: entryPoint,
      p1: addPoint(entryPoint, multiplyPoint(incomingTravel, handleLength)),
      p2: subtractPoint(exitPoint, multiplyPoint(outgoingTravel, handleLength)),
      p3: exitPoint
    }
  };
}

function applyContourRoundness(contour: CubicBezierContour, roundness: number): CubicBezierContour {
  if (getRoundnessStrength(roundness) === 0 || contour.nodes.length < 3) {
    return contour;
  }

  const specs = contour.nodes.map((_, nodeIndex) => buildRoundedCornerSpec(contour, nodeIndex, roundness));
  const segments: CubicSegment[] = [];

  for (let nodeIndex = 0; nodeIndex < contour.nodes.length; nodeIndex += 1) {
    const nextIndex = (nodeIndex + 1) % contour.nodes.length;
    const baseSegment = segmentFromContour(contour, nodeIndex);
    const startT = specs[nodeIndex]?.outgoingTrim ?? 0;
    const endT = specs[nextIndex]?.incomingTrim ?? 1;

    segments.push(extractSubsegment(baseSegment, startT, endT));

    if (specs[nextIndex]) {
      segments.push(specs[nextIndex].arc);
    }
  }

  return contourFromSegments(contour, segments);
}

function applyGlyphContrast(
  baseGlyph: VectorizedGlyph,
  companionGlyph: VectorizedGlyph | null,
  contrast: number
) {
  const strength = getContrastStrength(contrast);

  if (strength === 0 || !companionGlyph || !areGlyphsCompatible(baseGlyph, companionGlyph)) {
    return baseGlyph;
  }

  const bottomWeighted = strength > 0;
  const contrastAmount = Math.pow(Math.abs(strength), 0.5);
  const feather = 0.035;

  return rebuildGlyph(
    baseGlyph,
    baseGlyph.contours.map((contour, contourIndex) => {
      const companionContour = companionGlyph.contours[contourIndex];

      return {
        ...contour,
        nodes: contour.nodes.map((node, nodeIndex) => {
          const companionNode = companionContour.nodes[nodeIndex];
          const normalizedY = clamp(
            (node.anchor.y - baseGlyph.bounds.minY) / Math.max(baseGlyph.bounds.height, 1),
            0,
            1
          );
          const region = bottomWeighted ? normalizedY : 1 - normalizedY;
          const splitMix = Math.pow(
            smoothstep(0.5 - feather, 0.5 + feather, region),
            0.58
          );
          const localMix = clamp(contrastAmount * (0.32 + splitMix * 1.24), 0, 1.28);

          return {
            ...node,
            anchor: lerpPoint(node.anchor, companionNode.anchor, localMix),
            inHandle: lerpPoint(node.inHandle, companionNode.inHandle, localMix),
            outHandle: lerpPoint(node.outHandle, companionNode.outHandle, localMix)
          };
        })
      };
    })
  );
}

function getCornerSharpness(contour: CubicBezierContour, nodeIndex: number) {
  const { incomingTravel, outgoingTravel } = getNodeTravel(contour, nodeIndex);
  const alignment = clamp(dotPoint(incomingTravel, outgoingTravel), -1, 1);
  return clamp((1 - alignment) / 2, 0, 1);
}

function buildChamferCornerSpec(
  contour: CubicBezierContour,
  nodeIndex: number,
  chamfer: number
): ChamferCornerSpec | null {
  const strength = getChamferStrength(chamfer);

  if (strength === 0 || contour.nodes.length < 3) {
    return null;
  }

  const previousIndex = (nodeIndex - 1 + contour.nodes.length) % contour.nodes.length;
  const node = contour.nodes[nodeIndex];
  const previousNode = contour.nodes[previousIndex];
  const nextNode = contour.nodes[(nodeIndex + 1) % contour.nodes.length];
  const previousLength = pointLength(subtractPoint(node.anchor, previousNode.anchor));
  const nextLength = pointLength(subtractPoint(nextNode.anchor, node.anchor));

  if (previousLength < EPSILON || nextLength < EPSILON) {
    return null;
  }

  const sharpness = getCornerSharpness(contour, nodeIndex);

  if (sharpness < 0.025) {
    return null;
  }

  const cutDistance =
    Math.min(previousLength, nextLength) *
    (0.1 + strength * 0.34) *
    Math.pow(sharpness, 0.68);

  if (cutDistance < 0.7) {
    return null;
  }

  const incomingTrim = clamp(1 - cutDistance / previousLength, 0.001, 0.999);
  const outgoingTrim = clamp(cutDistance / nextLength, 0.001, 0.999);
  const entryPoint = splitCubic(segmentFromContour(contour, previousIndex), incomingTrim).left.p3;
  const exitPoint = splitCubic(segmentFromContour(contour, nodeIndex), outgoingTrim).right.p0;

  return {
    incomingTrim,
    outgoingTrim,
    bridge: buildLineSegment(entryPoint, exitPoint)
  };
}

function applyContourChamfer(contour: CubicBezierContour, chamfer: number): CubicBezierContour {
  if (getChamferStrength(chamfer) === 0 || contour.nodes.length < 3) {
    return contour;
  }

  const specs = contour.nodes.map((_, nodeIndex) => buildChamferCornerSpec(contour, nodeIndex, chamfer));
  const segments: CubicSegment[] = [];

  for (let nodeIndex = 0; nodeIndex < contour.nodes.length; nodeIndex += 1) {
    const nextIndex = (nodeIndex + 1) % contour.nodes.length;
    const baseSegment = segmentFromContour(contour, nodeIndex);
    const startT = specs[nodeIndex]?.outgoingTrim ?? 0;
    const endT = specs[nextIndex]?.incomingTrim ?? 1;

    segments.push(extractSubsegment(baseSegment, startT, endT));

    if (specs[nextIndex]) {
      segments.push(specs[nextIndex].bridge);
    }
  }

  return contourFromSegments(contour, segments);
}

function getSegmentDeviation(segment: CubicSegment) {
  const chord = subtractPoint(segment.p3, segment.p0);
  const chordLength = Math.max(pointLength(chord), EPSILON);
  const chordNormal = normalizePoint({ x: -chord.y, y: chord.x });
  const deviation1 = Math.abs(dotPoint(subtractPoint(segment.p1, segment.p0), chordNormal));
  const deviation2 = Math.abs(dotPoint(subtractPoint(segment.p2, segment.p0), chordNormal));

  return (deviation1 + deviation2) / chordLength;
}

function getFacetPointCount(segment: CubicSegment, bounds: Bounds, facet: number) {
  const strength = getFacetStrength(facet);

  if (strength === 0) {
    return 1;
  }

  const lengthEstimate =
    pointLength(subtractPoint(segment.p1, segment.p0)) +
    pointLength(subtractPoint(segment.p2, segment.p1)) +
    pointLength(subtractPoint(segment.p3, segment.p2));
  const normalizedLength =
    lengthEstimate / Math.max(Math.min(bounds.width, bounds.height), 1);
  const deviation = getSegmentDeviation(segment);
  const curvedComplexity =
    1.2 + normalizedLength * (1.6 + (1 - strength) * 2.2) + deviation * (4.8 - strength * 2.8);

  return Math.max(
    1,
    Math.round(
      curvedComplexity * (1.08 - strength * 0.82)
    )
  );
}

function applyContourFacet(
  contour: CubicBezierContour,
  glyphBounds: Bounds,
  facet: number
): CubicBezierContour {
  const strength = getFacetStrength(facet);

  if (strength === 0 || contour.nodes.length < 2) {
    return contour;
  }

  const points: Vec2[] = [];

  for (let nodeIndex = 0; nodeIndex < contour.nodes.length; nodeIndex += 1) {
    const segment = segmentFromContour(contour, nodeIndex);
    const pointCount = getFacetPointCount(segment, glyphBounds, facet);

    for (let step = 0; step < pointCount; step += 1) {
      const t = step / pointCount;
      const point = pointOnCubic(segment, t);

      if (!points.length || pointLength(subtractPoint(point, points[points.length - 1])) > EPSILON) {
        points.push(point);
      }
    }
  }

  return contourFromLinearPoints(contour, points);
}

function snapScalarToGrid(value: number, origin: number, gridSize: number) {
  return origin + Math.round((value - origin) / gridSize) * gridSize;
}

function bresenhamPath(start: Vec2, end: Vec2, origin: Vec2, gridSize: number) {
  let x0 = Math.round((start.x - origin.x) / gridSize);
  let y0 = Math.round((start.y - origin.y) / gridSize);
  const x1 = Math.round((end.x - origin.x) / gridSize);
  const y1 = Math.round((end.y - origin.y) / gridSize);
  const points: Vec2[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let error = dx - dy;

  while (true) {
    points.push({
      x: origin.x + x0 * gridSize,
      y: origin.y + y0 * gridSize
    });

    if (x0 === x1 && y0 === y1) {
      break;
    }

    const doubled = error * 2;

    if (doubled > -dy) {
      error -= dy;
      x0 += sx;
    }

    if (doubled < dx) {
      error += dx;
      y0 += sy;
    }
  }

  return points;
}

function applyContourPixelSnap(
  contour: CubicBezierContour,
  glyphBounds: Bounds,
  pixelSnap: number
): CubicBezierContour {
  const strength = getPixelSnapStrength(pixelSnap);

  if (strength === 0 || contour.nodes.length < 2) {
    return contour;
  }

  const gridSize = Math.max(
    4,
    Math.min(glyphBounds.width, glyphBounds.height) * (0.012 + strength * 0.06)
  );
  const sampleCount = Math.max(2, Math.round(2 + strength * 6));
  const origin = { x: glyphBounds.minX, y: glyphBounds.minY };
  const steppedPoints: Vec2[] = [];

  for (let nodeIndex = 0; nodeIndex < contour.nodes.length; nodeIndex += 1) {
    const segment = segmentFromContour(contour, nodeIndex);
    const sampledPoints = Array.from({ length: sampleCount + 1 }, (_, step) =>
      pointOnCubic(segment, step / sampleCount)
    ).map((point) => ({
      x: snapScalarToGrid(point.x, origin.x, gridSize),
      y: snapScalarToGrid(point.y, origin.y, gridSize)
    }));

    for (let pointIndex = 0; pointIndex < sampledPoints.length - 1; pointIndex += 1) {
      const stairPoints = bresenhamPath(
        sampledPoints[pointIndex],
        sampledPoints[pointIndex + 1],
        origin,
        gridSize
      );

      stairPoints.forEach((point, stairIndex) => {
        if (
          (steppedPoints.length && stairIndex === 0) ||
          (steppedPoints.length &&
            pointLength(subtractPoint(point, steppedPoints[steppedPoints.length - 1])) <= EPSILON)
        ) {
          return;
        }

        steppedPoints.push(point);
      });
    }
  }

  return contourFromLinearPoints(contour, steppedPoints);
}

function applyContourWobble(
  contour: CubicBezierContour,
  glyphBounds: Bounds,
  char: string,
  wobble: number
): CubicBezierContour {
  const strength = getWobbleStrength(wobble);

  if (strength === 0) {
    return contour;
  }

  const amplitude = Math.min(glyphBounds.width, glyphBounds.height) * (0.004 + strength * 0.02);
  const frequency = lerp(1.4, 4.8, strength);
  const glyphSeed = char.charCodeAt(0) * 0.071 + contour.contourIndex * 0.63;

  return {
    ...contour,
    nodes: contour.nodes.map((node, nodeIndex) => {
      const { tangent } = getNodeTravel(contour, nodeIndex);
      const normal = getOutwardNormal(contour, tangent);
      const nx = (node.anchor.x - glyphBounds.minX) / Math.max(glyphBounds.width, 1);
      const ny = (node.anchor.y - glyphBounds.minY) / Math.max(glyphBounds.height, 1);
      const wave =
        Math.sin(nx * Math.PI * frequency + ny * Math.PI * (frequency * 0.7) + glyphSeed) +
        0.45 * Math.sin(ny * Math.PI * (frequency * 1.6) + glyphSeed * 1.7);
      const offset = multiplyPoint(normal, wave * amplitude);

      return {
        ...node,
        anchor: addPoint(node.anchor, offset),
        inHandle: addPoint(node.inHandle, offset),
        outHandle: addPoint(node.outHandle, offset)
      };
    })
  };
}

function getLiquifyOffset(
  anchor: Vec2,
  glyphBounds: Bounds,
  char: string,
  contourIndex: number,
  liquify: number
) {
  const strength = getLiquifyStrength(liquify);

  if (strength === 0) {
    return { x: 0, y: 0 };
  }

  const nx = (anchor.x - glyphBounds.centerX) / Math.max(glyphBounds.width, 1);
  const ny = (anchor.y - glyphBounds.centerY) / Math.max(glyphBounds.height, 1);
  const glyphSeed = char.charCodeAt(0) * 0.053 + contourIndex * 0.41;
  const amplitude =
    Math.min(glyphBounds.width, glyphBounds.height) *
    (0.012 + Math.pow(strength, 1.12) * 0.095);
  const radialFocus = 0.72 + Math.hypot(nx, ny) * 0.78;
  const flowX =
    Math.sin(ny * 3.2 + glyphSeed) + 0.62 * Math.cos(nx * 2.1 - glyphSeed * 1.4);
  const flowY =
    Math.cos(nx * 3.1 - glyphSeed * 0.85) + 0.58 * Math.sin(ny * 2.3 + glyphSeed * 1.2);

  return {
    x: flowX * amplitude * 0.78 * radialFocus,
    y: flowY * amplitude * 0.56 * radialFocus
  };
}

function applyContourLiquify(
  contour: CubicBezierContour,
  glyphBounds: Bounds,
  char: string,
  liquify: number
): CubicBezierContour {
  if (getLiquifyStrength(liquify) === 0) {
    return contour;
  }

  return {
    ...contour,
    nodes: contour.nodes.map((node) => {
      const offset = getLiquifyOffset(node.anchor, glyphBounds, char, contour.contourIndex, liquify);
      const handleOffset = multiplyPoint(offset, 0.94);

      return {
        ...node,
        anchor: addPoint(node.anchor, offset),
        inHandle: addPoint(node.inHandle, handleOffset),
        outHandle: addPoint(node.outHandle, handleOffset)
      };
    })
  };
}

function hashNoise(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return value - Math.floor(value);
}

function getGlitchOffset(
  anchor: Vec2,
  glyphBounds: Bounds,
  char: string,
  contourIndex: number,
  nodeIndex: number,
  glitch: number
) {
  const strength = getGlitchStrength(glitch);

  if (strength === 0) {
    return { x: 0, y: 0 };
  }

  const glyphSeed = char.charCodeAt(0);
  const bandCount = Math.round(lerp(3, 12, strength));
  const bandHeight = Math.max(glyphBounds.height / bandCount, 1);
  const bandIndex = Math.floor((anchor.y - glyphBounds.minY) / bandHeight);
  const baseSeed = glyphSeed * 17 + contourIndex * 101 + bandIndex * 37;
  const amplitudeX = glyphBounds.width * (0.01 + strength * 0.055);
  const amplitudeY = glyphBounds.height * (0.002 + strength * 0.014);
  const stepUnit = Math.max(glyphBounds.width * 0.015, 3);
  const bandShift = (hashNoise(baseSeed) - 0.5) * 2;
  const bandLift = (hashNoise(baseSeed + 13) - 0.5) * 2;
  const nodeJitter = (hashNoise(baseSeed + nodeIndex * 11 + 7) - 0.5) * stepUnit * 0.4 * strength;
  const steppedX = Math.round((bandShift * amplitudeX) / stepUnit) * stepUnit;

  return {
    x: steppedX + nodeJitter,
    y: bandLift * amplitudeY
  };
}

function applyContourGlitch(
  contour: CubicBezierContour,
  glyphBounds: Bounds,
  char: string,
  glitch: number
): CubicBezierContour {
  if (getGlitchStrength(glitch) === 0) {
    return contour;
  }

  return {
    ...contour,
    nodes: contour.nodes.map((node, nodeIndex) => {
      const offset = getGlitchOffset(
        node.anchor,
        glyphBounds,
        char,
        contour.contourIndex,
        nodeIndex,
        glitch
      );
      const handleOffset = multiplyPoint(offset, 0.92);

      return {
        ...node,
        anchor: addPoint(node.anchor, offset),
        inHandle: addPoint(node.inHandle, handleOffset),
        outHandle: addPoint(node.outHandle, handleOffset)
      };
    })
  };
}

function applyBaseGeometry(
  sourceGlyph: VectorizedGlyph,
  controls: GlyphWorkbenchControls
) {
  if (!sourceGlyph.contours.length) {
    return sourceGlyph;
  }

  const widthScale = getWidthScale(controls.width);
  const heightScale = getHeightScale(controls.height);
  const slantShear = getSlantShear(controls.slant);
  const centerX = sourceGlyph.bounds.centerX;

  const transformedContours = sourceGlyph.contours.map((sourceContour) =>
    mapContourPoints(cloneContour(sourceContour), (point) => {
      const scaledPoint = scalePoint(point, { x: centerX, y: GLYPH_BASELINE }, widthScale, heightScale);

      return {
        x: scaledPoint.x + (GLYPH_BASELINE - scaledPoint.y) * slantShear,
        y: scaledPoint.y
      };
    })
  );
  return rebuildGlyph(sourceGlyph, transformedContours.map(finalizeContour));
}

export function applyWorkbenchGeometry(
  sourceGlyph: VectorizedGlyph,
  controls: GlyphWorkbenchControls,
  contrastGlyph: VectorizedGlyph | null = null
) {
  if (!sourceGlyph.contours.length) {
    return sourceGlyph;
  }

  const geometryGlyph = applyBaseGeometry(sourceGlyph, controls);
  const companionGeometryGlyph = contrastGlyph ? applyBaseGeometry(contrastGlyph, controls) : null;
  const contrastedGlyph = applyGlyphContrast(geometryGlyph, companionGeometryGlyph, controls.contrast);
  const chamferGlyph = rebuildGlyph(
    contrastedGlyph,
    contrastedGlyph.contours.map((contour) => applyContourChamfer(contour, controls.chamfer))
  );
  const roundnessGlyph = rebuildGlyph(
    chamferGlyph,
    chamferGlyph.contours.map((contour) => applyContourRoundness(contour, controls.roundness))
  );
  const wobbleGlyph = rebuildGlyph(
    roundnessGlyph,
    roundnessGlyph.contours.map((contour) =>
      applyContourWobble(contour, roundnessGlyph.bounds, roundnessGlyph.char, controls.wobble)
    )
  );
  const liquifyGlyph = rebuildGlyph(
    wobbleGlyph,
    wobbleGlyph.contours.map((contour) =>
      applyContourLiquify(contour, wobbleGlyph.bounds, wobbleGlyph.char, controls.liquify)
    )
  );
  const glitchedGlyph = rebuildGlyph(
    liquifyGlyph,
    liquifyGlyph.contours.map((contour) =>
      applyContourGlitch(contour, liquifyGlyph.bounds, liquifyGlyph.char, controls.glitch)
    )
  );
  const facetedGlyph = rebuildGlyph(
    glitchedGlyph,
    glitchedGlyph.contours.map((contour) =>
      applyContourFacet(contour, glitchedGlyph.bounds, controls.facet)
    )
  );

  return rebuildGlyph(
    facetedGlyph,
    facetedGlyph.contours.map((contour) =>
      applyContourPixelSnap(contour, facetedGlyph.bounds, controls.pixelSnap)
    )
  );
}
