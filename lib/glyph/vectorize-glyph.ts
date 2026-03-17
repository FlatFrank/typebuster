import type { Font, Glyph as OpenTypeGlyph, Command as OpenTypeCommand } from "opentype.js";

import type {
  Bounds,
  CubicBezierContour,
  CubicBezierNode,
  PathCommand,
  Vec2,
  VectorizedGlyph
} from "@/lib/types";
import { computeBounds, commandsToPathData } from "@/lib/glyph/path-utils";

export const GLYPH_FONT_SIZE = 420;
export const GLYPH_BASELINE = 340;

type MutableContour = {
  id: string;
  contourIndex: number;
  closed: boolean;
  nodes: CubicBezierNode[];
};

const EPSILON = 0.001;

function clonePoint(point: Vec2) {
  return { x: point.x, y: point.y };
}

function samePoint(a: Vec2, b: Vec2) {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}

function lerpPoint(a: Vec2, b: Vec2, t: number): Vec2 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  };
}

function quadraticToCubic(start: Vec2, control: Vec2, end: Vec2) {
  return {
    c1: {
      x: start.x + ((control.x - start.x) * 2) / 3,
      y: start.y + ((control.y - start.y) * 2) / 3
    },
    c2: {
      x: end.x + ((control.x - end.x) * 2) / 3,
      y: end.y + ((control.y - end.y) * 2) / 3
    }
  };
}

function createNode(contourIndex: number, nodeIndex: number, anchor: Vec2): CubicBezierNode {
  return {
    id: `${contourIndex}-${nodeIndex}`,
    contourIndex,
    nodeIndex,
    anchor: clonePoint(anchor),
    inHandle: clonePoint(anchor),
    outHandle: clonePoint(anchor)
  };
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

function pointInPolygon(point: Vec2, polygon: Vec2[]) {
  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index];
    const b = polygon[previous];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1) + a.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function boundsFromNodes(nodes: CubicBezierNode[]): Bounds {
  const commands = nodes.reduce<PathCommand[]>((allCommands, node, index) => {
    if (index === 0) {
      allCommands.push({ type: "M", x: node.anchor.x, y: node.anchor.y });
      return allCommands;
    }

    allCommands.push({
      type: "C",
      x1: nodes[index - 1].outHandle.x,
      y1: nodes[index - 1].outHandle.y,
      x2: node.inHandle.x,
      y2: node.inHandle.y,
      x: node.anchor.x,
      y: node.anchor.y
    });

    return allCommands;
  }, []);

  return computeBounds(commands);
}

function reindexContour(contour: MutableContour) {
  contour.nodes = contour.nodes.map((node, nodeIndex) => ({
    ...node,
    id: `${contour.contourIndex}-${nodeIndex}`,
    contourIndex: contour.contourIndex,
    nodeIndex
  }));

  return contour;
}

function buildContours(commands: OpenTypeCommand[]) {
  const contours: MutableContour[] = [];
  let currentContour: MutableContour | null = null;
  let currentPoint: Vec2 | null = null;
  let nodeIndex = 0;

  commands.forEach((command) => {
    if (command.type === "M" && typeof command.x === "number" && typeof command.y === "number") {
      currentContour = {
        id: `contour-${contours.length}`,
        contourIndex: contours.length,
        closed: false,
        nodes: [createNode(contours.length, 0, { x: command.x, y: command.y })]
      };
      contours.push(currentContour);
      currentPoint = { x: command.x, y: command.y };
      nodeIndex = 1;
      return;
    }

    if (!currentContour || !currentPoint) {
      return;
    }

    const previousNode = currentContour.nodes[currentContour.nodes.length - 1];

    if (command.type === "L" && typeof command.x === "number" && typeof command.y === "number") {
      const nextAnchor = { x: command.x, y: command.y };
      previousNode.outHandle = lerpPoint(previousNode.anchor, nextAnchor, 1 / 3);
      const nextNode = createNode(currentContour.contourIndex, nodeIndex, nextAnchor);
      nextNode.inHandle = lerpPoint(previousNode.anchor, nextAnchor, 2 / 3);
      currentContour.nodes.push(nextNode);
      currentPoint = nextAnchor;
      nodeIndex += 1;
      return;
    }

    if (
      command.type === "Q" &&
      typeof command.x1 === "number" &&
      typeof command.y1 === "number" &&
      typeof command.x === "number" &&
      typeof command.y === "number"
    ) {
      const nextAnchor = { x: command.x, y: command.y };
      const cubic = quadraticToCubic(currentPoint, { x: command.x1, y: command.y1 }, nextAnchor);
      previousNode.outHandle = cubic.c1;
      const nextNode = createNode(currentContour.contourIndex, nodeIndex, nextAnchor);
      nextNode.inHandle = cubic.c2;
      currentContour.nodes.push(nextNode);
      currentPoint = nextAnchor;
      nodeIndex += 1;
      return;
    }

    if (
      command.type === "C" &&
      typeof command.x1 === "number" &&
      typeof command.y1 === "number" &&
      typeof command.x2 === "number" &&
      typeof command.y2 === "number" &&
      typeof command.x === "number" &&
      typeof command.y === "number"
    ) {
      const nextAnchor = { x: command.x, y: command.y };
      previousNode.outHandle = { x: command.x1, y: command.y1 };
      const nextNode = createNode(currentContour.contourIndex, nodeIndex, nextAnchor);
      nextNode.inHandle = { x: command.x2, y: command.y2 };
      currentContour.nodes.push(nextNode);
      currentPoint = nextAnchor;
      nodeIndex += 1;
      return;
    }

    if (command.type === "Z") {
      currentContour.closed = true;

      if (currentContour.nodes.length > 1) {
        const firstNode = currentContour.nodes[0];
        const lastNode = currentContour.nodes[currentContour.nodes.length - 1];

        if (!samePoint(lastNode.anchor, firstNode.anchor)) {
          lastNode.outHandle = lerpPoint(lastNode.anchor, firstNode.anchor, 1 / 3);
          firstNode.inHandle = lerpPoint(lastNode.anchor, firstNode.anchor, 2 / 3);
        } else {
          lastNode.outHandle = clonePoint(lastNode.anchor);
          firstNode.inHandle = clonePoint(firstNode.anchor);
          currentContour.nodes.pop();
        }
      }

      currentContour = null;
      currentPoint = null;
    }
  });

  return contours.map((contour) => reindexContour(contour));
}

function contourToCommands(contour: CubicBezierContour | MutableContour): PathCommand[] {
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

function finalizeContours(contours: MutableContour[]) {
  const preliminary = contours.map((contour) => {
    const area = contour.nodes.length >= 3 ? polygonArea(contour.nodes.map((node) => node.anchor)) : 0;
    const bounds = boundsFromNodes(contour.nodes);

    return {
      contourIndex: contour.contourIndex,
      points: contour.nodes.map((node) => node.anchor),
      area,
      bounds,
      contour
    };
  });

  return preliminary.map<CubicBezierContour>((entry) => {
    const depth = preliminary.reduce((count, other) => {
      if (other.contourIndex === entry.contourIndex || other.points.length < 3) {
        return count;
      }

      if (pointInPolygon(entry.bounds.centerX !== undefined ? { x: entry.bounds.centerX, y: entry.bounds.centerY } : entry.points[0], other.points)) {
        return count + 1;
      }

      return count;
    }, 0);

    return {
      ...entry.contour,
      direction: entry.area < 0 ? "cw" : "ccw",
      area: entry.area,
      isHole: depth % 2 === 1,
      bounds: entry.bounds
    };
  });
}

function originalCommandsFromPath(path: { commands: OpenTypeCommand[] }) {
  const commands: PathCommand[] = [];

  path.commands.forEach((command) => {
    if (command.type === "M" || command.type === "L") {
      if (typeof command.x === "number" && typeof command.y === "number") {
        commands.push({ type: command.type, x: command.x, y: command.y });
      }
      return;
    }

    if (command.type === "Q") {
      if (
        typeof command.x1 === "number" &&
        typeof command.y1 === "number" &&
        typeof command.x === "number" &&
        typeof command.y === "number"
      ) {
        commands.push({
          type: "Q",
          x1: command.x1,
          y1: command.y1,
          x: command.x,
          y: command.y
        });
      }
      return;
    }

    if (command.type === "C") {
      if (
        typeof command.x1 === "number" &&
        typeof command.y1 === "number" &&
        typeof command.x2 === "number" &&
        typeof command.y2 === "number" &&
        typeof command.x === "number" &&
        typeof command.y === "number"
      ) {
        commands.push({
          type: "C",
          x1: command.x1,
          y1: command.y1,
          x2: command.x2,
          y2: command.y2,
          x: command.x,
          y: command.y
        });
      }
      return;
    }

    if (command.type === "Z") {
      commands.push({ type: "Z" });
    }
  });

  return commands;
}

function isSupportedGlyph(glyph: OpenTypeGlyph, character: string) {
  const codePoint = character.codePointAt(0);
  return typeof codePoint === "number" && glyph.unicode === codePoint && glyph.index !== 0;
}

export function vectorizeGlyph(font: Font, character: string): VectorizedGlyph {
  const glyph = font.charToGlyph(character);
  const scale = GLYPH_FONT_SIZE / font.unitsPerEm;
  const advanceWidth = glyph.advanceWidth * scale;

  if (!isSupportedGlyph(glyph, character)) {
    return {
      char: character,
      bounds: {
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        width: 0,
        height: 0,
        centerX: 0,
        centerY: 0
      },
      advanceWidth,
      originalPathData: "",
      rebuiltPathData: "",
      contours: [],
      nodeCount: 0,
      segmentCount: 0,
      holeCount: 0
    };
  }

  const path = glyph.getPath(0, GLYPH_BASELINE, GLYPH_FONT_SIZE);
  const originalCommands = originalCommandsFromPath(path);
  const contours = finalizeContours(buildContours(path.commands));
  const rebuiltCommands = contours.flatMap((contour) => contourToCommands(contour));
  const bounds = computeBounds(rebuiltCommands);

  return {
    char: character,
    bounds,
    advanceWidth,
    originalPathData: commandsToPathData(originalCommands),
    rebuiltPathData: commandsToPathData(rebuiltCommands),
    contours,
    nodeCount: contours.reduce((count, contour) => count + contour.nodes.length, 0),
    segmentCount: contours.reduce(
      (count, contour) => count + contour.nodes.length,
      0
    ),
    holeCount: contours.filter((contour) => contour.isHole).length
  };
}

export function vectorizeDefaultGlyphSet(font: Font) {
  return ["A", "a"].map((character) => vectorizeGlyph(font, character));
}
