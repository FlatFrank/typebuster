import JSZip from "jszip";
import opentype from "opentype.js";

import type { LoadedWorkbenchFontFamily } from "@/lib/font/load-font";
import { clampWeight } from "@/lib/glyph/transform-vectorized-glyph";
import { GLYPH_BASELINE, GLYPH_FONT_SIZE } from "@/lib/glyph/vectorize-glyph";
import type { GlyphWorkbenchControls, VectorizedGlyph, Vec2 } from "@/lib/types";

export const SAMPLE_FONT_CHARACTERS = Array.from(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789!?"
);
export const SAMPLE_FONT_MIN_MODIFICATION_PERCENT = 25;

const DEFAULT_LICENSE_URL = "https://software.sil.org/oflt/";
const OPEN_TYPE_RUNTIME = opentype as typeof opentype & {
  Font: new (options: Record<string, unknown>) => {
    toArrayBuffer: () => ArrayBuffer;
  };
  Glyph: new (options: Record<string, unknown>) => unknown;
  Path: new () => {
    moveTo: (x: number, y: number) => void;
    lineTo: (x: number, y: number) => void;
    curveTo: (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x: number,
      y: number
    ) => void;
    close: () => void;
  };
};

type AxisScoreConfig = {
  key: Exclude<keyof GlyphWorkbenchControls, "weight">;
  maxDelta: number;
};

type FontMetadata = {
  names?: Partial<
    Record<
      "copyright" | "designer" | "manufacturer" | "licenseURL" | "version" | "trademark",
      { en?: string }
    >
  >;
  tables?: {
    os2?: {
      sTypoAscender?: number;
      sTypoDescender?: number;
      usWinAscent?: number;
      usWinDescent?: number;
      sxHeight?: number;
      sCapHeight?: number;
    };
  };
};

type FontRuntimeMetrics = {
  ascender: number;
  descender: number;
  unitsPerEm: number;
};

type OpenTypePoint = {
  x: number;
  y: number;
};

type SourceGlyphMetrics = {
  leftSideBearing?: number;
  advanceWidth?: number;
};

const AXIS_SCORE_CONFIG: Array<AxisScoreConfig & { weight: number }> = [
  { key: "width", maxDelta: 50, weight: 10 },
  { key: "height", maxDelta: 50, weight: 10 },
  { key: "contrast", maxDelta: 100, weight: 80 / 9 },
  { key: "slant", maxDelta: 20, weight: 80 / 9 },
  { key: "roundness", maxDelta: 100, weight: 80 / 9 },
  { key: "chamfer", maxDelta: 100, weight: 80 / 9 },
  { key: "facet", maxDelta: 100, weight: 80 / 9 },
  { key: "pixelSnap", maxDelta: 100, weight: 80 / 9 },
  { key: "wobble", maxDelta: 100, weight: 80 / 9 },
  { key: "liquify", maxDelta: 100, weight: 80 / 9 },
  { key: "glitch", maxDelta: 100, weight: 80 / 9 }
];

type DownloadSamplePackageOptions = {
  fontFamily: LoadedWorkbenchFontFamily;
  controls: GlyphWorkbenchControls;
  modificationPercent: number;
  glyphs: VectorizedGlyph[];
  sampleName: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getFontNameRecord(
  font: LoadedWorkbenchFontFamily["regular"],
  key:
    | "copyright"
    | "designer"
    | "manufacturer"
    | "licenseURL"
    | "version"
    | "trademark"
) {
  const metadata = font as LoadedWorkbenchFontFamily["regular"] & FontMetadata;
  const record = metadata.names?.[key];
  return record?.en?.trim() || "";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function getSuggestedSampleFontName(sourceLabel: string) {
  return `${sourceLabel} Typebuster Sample`;
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

function createNotdefGlyph(unitsPerEm: number) {
  const path = new OPEN_TYPE_RUNTIME.Path();
  const width = Math.round(unitsPerEm * 0.62);
  const height = Math.round(unitsPerEm * 0.9);
  const inset = Math.round(unitsPerEm * 0.11);

  path.moveTo(0, 0);
  path.lineTo(width, 0);
  path.lineTo(width, height);
  path.lineTo(0, height);
  path.close();

  path.moveTo(inset, inset);
  path.lineTo(inset, height - inset);
  path.lineTo(width - inset, height - inset);
  path.lineTo(width - inset, inset);
  path.close();

  return new OPEN_TYPE_RUNTIME.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: width + inset,
    path
  });
}

function fetchTextFile(path: string) {
  return fetch(path).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Unable to fetch ${path} (${response.status})`);
    }

    return response.text();
  });
}

function previewPointToFontUnits(point: Vec2, unitsPerEm: number): OpenTypePoint {
  const scale = GLYPH_FONT_SIZE / unitsPerEm;

  return {
    x: point.x / scale,
    y: (GLYPH_BASELINE - point.y) / scale
  };
}

function pointListFromGlyph(glyph: VectorizedGlyph, unitsPerEm: number) {
  return glyph.contours.flatMap((contour) =>
    contour.nodes.flatMap((node) => [
      previewPointToFontUnits(node.anchor, unitsPerEm),
      previewPointToFontUnits(node.inHandle, unitsPerEm),
      previewPointToFontUnits(node.outHandle, unitsPerEm)
    ])
  );
}

function getGlyphName(character: string) {
  const codePoint = character.codePointAt(0);

  if (typeof codePoint !== "number") {
    return "glyph";
  }

  return `u${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

function createOpenTypeGlyph(
  sourceFont: LoadedWorkbenchFontFamily["regular"],
  glyph: VectorizedGlyph
) {
  const path = new OPEN_TYPE_RUNTIME.Path();
  const sourceGlyph = sourceFont.charToGlyph(glyph.char) as ReturnType<
    LoadedWorkbenchFontFamily["regular"]["charToGlyph"]
  > &
    SourceGlyphMetrics;
  const sideBearing = Math.max(
    16,
    sourceGlyph.leftSideBearing ?? Math.round(sourceFont.unitsPerEm * 0.04)
  );
  const points = pointListFromGlyph(glyph, sourceFont.unitsPerEm);
  const minX = points.length ? Math.min(...points.map((point) => point.x)) : 0;
  const maxX = points.length ? Math.max(...points.map((point) => point.x)) : 0;
  const shiftX = sideBearing - minX;

  glyph.contours.forEach((contour) => {
    if (!contour.nodes.length) {
      return;
    }

    const firstNode = contour.nodes[0];
    const firstAnchor = previewPointToFontUnits(firstNode.anchor, sourceFont.unitsPerEm);
    const firstInHandle = previewPointToFontUnits(firstNode.inHandle, sourceFont.unitsPerEm);
    const firstOutHandle = previewPointToFontUnits(firstNode.outHandle, sourceFont.unitsPerEm);

    path.moveTo(firstAnchor.x + shiftX, firstAnchor.y);

    for (let index = 1; index < contour.nodes.length; index += 1) {
      const previousNode = contour.nodes[index - 1];
      const node = contour.nodes[index];
      const previousOut = previewPointToFontUnits(previousNode.outHandle, sourceFont.unitsPerEm);
      const currentIn = previewPointToFontUnits(node.inHandle, sourceFont.unitsPerEm);
      const currentAnchor = previewPointToFontUnits(node.anchor, sourceFont.unitsPerEm);

      path.curveTo(
        previousOut.x + shiftX,
        previousOut.y,
        currentIn.x + shiftX,
        currentIn.y,
        currentAnchor.x + shiftX,
        currentAnchor.y
      );
    }

    if (contour.closed && contour.nodes.length > 1) {
      const lastNode = contour.nodes[contour.nodes.length - 1];
      const lastOut = previewPointToFontUnits(lastNode.outHandle, sourceFont.unitsPerEm);

      path.curveTo(
        lastOut.x + shiftX,
        lastOut.y,
        firstInHandle.x + shiftX,
        firstInHandle.y,
        firstAnchor.x + shiftX,
        firstAnchor.y
      );
      path.close();
    } else if (firstOutHandle.x !== firstAnchor.x || firstOutHandle.y !== firstAnchor.y) {
      path.lineTo(firstAnchor.x + shiftX, firstAnchor.y);
    }
  });

  const baseAdvanceWidth = glyph.advanceWidth * (sourceFont.unitsPerEm / GLYPH_FONT_SIZE);
  const advanceWidth = Math.max(
    Math.round(baseAdvanceWidth + shiftX),
    Math.round(maxX + shiftX + sideBearing)
  );

  return new OPEN_TYPE_RUNTIME.Glyph({
    name: getGlyphName(glyph.char),
    unicode: glyph.char.codePointAt(0),
    advanceWidth,
    path
  });
}

function createSpaceGlyph(sourceFont: LoadedWorkbenchFontFamily["regular"]) {
  const path = new OPEN_TYPE_RUNTIME.Path();
  const sourceSpace = sourceFont.charToGlyph(" ") as ReturnType<
    LoadedWorkbenchFontFamily["regular"]["charToGlyph"]
  > &
    SourceGlyphMetrics;
  const advanceWidth = Math.max(
    Math.round(sourceSpace.advanceWidth || sourceFont.unitsPerEm * 0.32),
    120
  );

  return new OPEN_TYPE_RUNTIME.Glyph({
    name: "space",
    unicode: 32,
    advanceWidth,
    path
  });
}

function buildDisclaimer(
  fontFamily: LoadedWorkbenchFontFamily,
  controls: GlyphWorkbenchControls,
  modificationPercent: number,
  includedCharacters: string[],
  sampleName: string
) {
  const sourceFont = fontFamily.regular;
  const copyright = getFontNameRecord(sourceFont, "copyright");
  const designer = getFontNameRecord(sourceFont, "designer");
  const manufacturer = getFontNameRecord(sourceFont, "manufacturer");
  const trademark = getFontNameRecord(sourceFont, "trademark");
  const version = getFontNameRecord(sourceFont, "version");
  const characterSetLabel = [...includedCharacters, "space"].join("");

  return [
    "TYPEBUSTER SAMPLE FONT DISCLAIMER",
    "",
    "This archive contains a renamed, subsetted sample font generated by Typebuster.",
    `Exported font name: ${sampleName}`,
    `Source family: ${fontFamily.label}`,
    `Included characters: ${characterSetLabel}`,
    `Modification score (weight excluded): ${modificationPercent}%`,
    "",
    "This export is a modified sample and is not an official release of the source typeface.",
    "It is renamed to avoid conflicts with Reserved Font Name policies and original family naming.",
    "The package includes the original SIL Open Font License text supplied with the source font.",
    "Typebuster is not affiliated with, endorsed by, or representing the original type designers or publishers.",
    "",
    "Source font metadata:",
    `Designer: ${designer || "Unknown"}`,
    `Manufacturer: ${manufacturer || "Unknown"}`,
    `Version: ${version || "Unknown"}`,
    `Trademark: ${trademark || "Not listed"}`,
    `Copyright: ${copyright || "See bundled OFL.txt"}`,
    "",
    "Current axis settings:",
    JSON.stringify(controls, null, 2)
  ].join("\n");
}

export function getWorkbenchModificationPercent(controls: GlyphWorkbenchControls) {
  const totalScore = AXIS_SCORE_CONFIG.reduce((sum, axis) => {
    const value = controls[axis.key];
    return sum + clamp(Math.abs(value) / axis.maxDelta, 0, 1) * axis.weight;
  }, 0);

  return Math.round(clamp(totalScore, 0, 100));
}

export async function downloadSampleFontPackage({
  fontFamily,
  controls,
  modificationPercent,
  glyphs,
  sampleName
}: DownloadSamplePackageOptions) {
  if (modificationPercent < SAMPLE_FONT_MIN_MODIFICATION_PERCENT) {
    throw new Error(
      `Reach ${SAMPLE_FONT_MIN_MODIFICATION_PERCENT}% non-weight modification before downloading a sample font.`
    );
  }

  const sourceFont = fontFamily.regular;
  const usableGlyphs = glyphs.filter((glyph) => glyph.contours.length > 0);

  if (!usableGlyphs.length) {
    throw new Error("No sample glyphs are available for export.");
  }

  const [licenseText] = await Promise.all([fetchTextFile(fontFamily.licensePath)]);
  const packageSlug = sampleName.trim() || `typebuster-sample-${slugify(fontFamily.key)}`;
  const glyphSet = [
    createNotdefGlyph(sourceFont.unitsPerEm),
    createSpaceGlyph(sourceFont),
    ...usableGlyphs.map((glyph) => createOpenTypeGlyph(sourceFont, glyph))
  ];
  const description = [
    "Renamed subset sample generated by Typebuster.",
    `Derived from modified outlines sourced from ${fontFamily.label}.`,
    "See DISCLAIMER.txt and OFL.txt in this archive."
  ].join(" ");
  const sourceMetadata = sourceFont as LoadedWorkbenchFontFamily["regular"] &
    FontMetadata &
    FontRuntimeMetrics;
  const cleanSampleName = sampleName.trim();
  const font = new OPEN_TYPE_RUNTIME.Font({
    familyName: cleanSampleName,
    styleName: "Regular",
    fullName: cleanSampleName,
    postScriptName: slugify(cleanSampleName).replace(/-/g, "") || "TypebusterSample",
    designer: "Typebuster",
    manufacturer: "Typebuster",
    description,
    copyright:
      getFontNameRecord(sourceFont, "copyright") ||
      "See bundled OFL.txt for the original source-font copyright notice.",
    trademark: "Typebuster sample export",
    license: "Bundled with OFL.txt and DISCLAIMER.txt inside this archive.",
    licenseURL: getFontNameRecord(sourceFont, "licenseURL") || DEFAULT_LICENSE_URL,
    version: "Version 0.1",
    unitsPerEm: sourceMetadata.unitsPerEm,
    ascender: sourceMetadata.ascender,
    descender: sourceMetadata.descender,
    weightClass: clampWeight(controls.weight),
    glyphs: glyphSet,
    tables: {
      os2: {
        sTypoAscender: sourceMetadata.tables?.os2?.sTypoAscender ?? sourceMetadata.ascender,
        sTypoDescender: sourceMetadata.tables?.os2?.sTypoDescender ?? sourceMetadata.descender,
        usWinAscent: sourceMetadata.tables?.os2?.usWinAscent ?? sourceMetadata.ascender,
        usWinDescent:
          sourceMetadata.tables?.os2?.usWinDescent ?? Math.abs(sourceMetadata.descender),
        sxHeight: sourceMetadata.tables?.os2?.sxHeight,
        sCapHeight: sourceMetadata.tables?.os2?.sCapHeight
      }
    }
  });
  const zip = new JSZip();

  zip.file(`${packageSlug}.otf`, font.toArrayBuffer());
  zip.file("OFL.txt", licenseText);
  zip.file(
    "DISCLAIMER.txt",
    buildDisclaimer(
      fontFamily,
      controls,
      modificationPercent,
      usableGlyphs.map((glyph) => glyph.char),
      cleanSampleName
    )
  );
  zip.file(
    "SETTINGS.json",
    JSON.stringify(
      {
        sampleName: cleanSampleName,
        sourceFont: {
          key: fontFamily.key,
          label: fontFamily.label
        },
        exportedCharacters: `${SAMPLE_FONT_CHARACTERS.join("")} `,
        modificationPercent,
        controls
      },
      null,
      2
    )
  );

  const archive = await zip.generateAsync({ type: "blob" });
  triggerBrowserDownload(archive, `${packageSlug}.zip`);
}
