import type { Bounds, PathCommand } from "@/lib/types";

export const EPSILON = 0.0001;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(start: number, end: number, alpha: number) {
  return start + (end - start) * alpha;
}

function createEmptyBounds(): Bounds {
  return {
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
    width: 0,
    height: 0,
    centerX: 0,
    centerY: 0
  };
}

export function computeBounds(commands: PathCommand[]): Bounds {
  if (!commands.length) {
    return createEmptyBounds();
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  commands.forEach((command) => {
    if ("x" in command) {
      minX = Math.min(minX, command.x);
      maxX = Math.max(maxX, command.x);
    }

    if ("y" in command) {
      minY = Math.min(minY, command.y);
      maxY = Math.max(maxY, command.y);
    }

    if ("x1" in command) {
      minX = Math.min(minX, command.x1);
      maxX = Math.max(maxX, command.x1);
    }

    if ("y1" in command) {
      minY = Math.min(minY, command.y1);
      maxY = Math.max(maxY, command.y1);
    }

    if ("x2" in command) {
      minX = Math.min(minX, command.x2);
      maxX = Math.max(maxX, command.x2);
    }

    if ("y2" in command) {
      minY = Math.min(minY, command.y2);
      maxY = Math.max(maxY, command.y2);
    }
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return createEmptyBounds();
  }

  const width = maxX - minX;
  const height = maxY - minY;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2
  };
}

function formatNumber(value: number) {
  return Number.parseFloat(value.toFixed(4));
}

export function commandsToPathData(commands: PathCommand[]) {
  return commands
    .map((command) => {
      if (command.type === "M" || command.type === "L") {
        return `${command.type}${formatNumber(command.x)} ${formatNumber(command.y)}`;
      }

      if (command.type === "Q") {
        return `Q${formatNumber(command.x1)} ${formatNumber(command.y1)} ${formatNumber(
          command.x
        )} ${formatNumber(command.y)}`;
      }

      if (command.type === "C") {
        return `C${formatNumber(command.x1)} ${formatNumber(command.y1)} ${formatNumber(
          command.x2
        )} ${formatNumber(command.y2)} ${formatNumber(command.x)} ${formatNumber(command.y)}`;
      }

      return "Z";
    })
    .join(" ");
}
