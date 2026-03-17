"use client";

import { useEffect, useMemo, useState } from "react";

import { BezierControlsPanel } from "@/components/bezier-controls-panel";
import { BezierGlyphCard } from "@/components/bezier-glyph-card";
import { SampleNameModal } from "@/components/sample-name-modal";
import {
  SAMPLE_FONT_CHARACTERS,
  SAMPLE_FONT_MIN_MODIFICATION_PERCENT,
  downloadSampleFontPackage,
  getSuggestedSampleFontName,
  getWorkbenchModificationPercent
} from "@/lib/font/export-sample";
import {
  WORKBENCH_FONT_OPTIONS,
  loadWorkbenchFontFamily,
  type LoadedWorkbenchFontFamily,
  type WorkbenchFontKey
} from "@/lib/font/load-font";
import {
  applyWorkbenchGeometry,
  interpolateWeightGlyph,
  synthesizeWeightGlyph
} from "@/lib/glyph/transform-vectorized-glyph";
import { vectorizeGlyph } from "@/lib/glyph/vectorize-glyph";
import type { GlyphWorkbenchControls, VectorizedGlyph } from "@/lib/types";

const SPECIMEN_CHARACTERS = Array.from(
  "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789!?"
);
const GLYPH_CHARACTER_SET = Array.from(
  new Set<string>([...SPECIMEN_CHARACTERS, ...SAMPLE_FONT_CHARACTERS, " "])
);
const DEFAULT_CONTROLS: GlyphWorkbenchControls = {
  width: 0,
  height: 0,
  weight: 400,
  contrast: 0,
  slant: 0,
  roundness: 0,
  chamfer: 0,
  facet: 0,
  pixelSnap: 0,
  wobble: 0,
  liquify: 0,
  glitch: 0
};

type SourceGlyphFamily = {
  regular: VectorizedGlyph;
  thin: VectorizedGlyph;
  black: VectorizedGlyph;
};

export function BezierWorkbench() {
  const [selectedFontKey, setSelectedFontKey] = useState<WorkbenchFontKey>("archivo");
  const [fontFamily, setFontFamily] = useState<LoadedWorkbenchFontFamily | null>(null);
  const [fontError, setFontError] = useState<string | null>(null);
  const [isLoadingFont, setIsLoadingFont] = useState(true);
  const [controls, setControls] = useState<GlyphWorkbenchControls>(DEFAULT_CONTROLS);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloadingSample, setIsDownloadingSample] = useState(false);
  const [isSampleNameModalOpen, setIsSampleNameModalOpen] = useState(false);
  const [sampleNameDraft, setSampleNameDraft] = useState("");

  useEffect(() => {
    let isMounted = true;

    setIsLoadingFont(true);

    loadWorkbenchFontFamily(selectedFontKey)
      .then((loadedFamily) => {
        if (!isMounted) {
          return;
        }

        setFontFamily(loadedFamily);
        setFontError(null);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setFontError(
          error instanceof Error
            ? error.message
            : "Unknown font loading error. Check /public/fonts."
        );
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingFont(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedFontKey]);

  useEffect(() => {
    setDownloadError(null);
  }, [controls, selectedFontKey]);

  const sourceGlyphs = useMemo(() => {
    if (!fontFamily) {
      return new Map<string, SourceGlyphFamily>();
    }

    return new Map(
      GLYPH_CHARACTER_SET.map((character) => {
        const regular = vectorizeGlyph(fontFamily.regular, character);
        const thin = fontFamily.thin ? vectorizeGlyph(fontFamily.thin, character) : null;
        const black = fontFamily.black ? vectorizeGlyph(fontFamily.black, character) : null;

        return [
          character,
          {
            regular,
            thin: thin ?? synthesizeWeightGlyph(regular, -0.72),
            black: black ?? synthesizeWeightGlyph(regular, 0.9)
          }
        ] satisfies [string, SourceGlyphFamily];
      })
    );
  }, [fontFamily]);

  const glyphMap = useMemo(() => {
    return new Map(
      Array.from(sourceGlyphs.entries()).map(([character, glyph]) => {
        const baseGlyph = interpolateWeightGlyph(
          glyph.thin,
          glyph.regular,
          glyph.black,
          controls.weight
        );
        const contrastGlyph = (() => {
          if (controls.contrast === 0) {
            return null;
          }

          const contrastIntensity = Math.abs(controls.contrast) / 100;
          const heavierGlyph = interpolateWeightGlyph(
            glyph.thin,
            glyph.regular,
            glyph.black,
            900
          );

          return synthesizeWeightGlyph(
            heavierGlyph,
            0.18 + contrastIntensity * 0.54
          );
        })();

        return [
          character,
          applyWorkbenchGeometry(baseGlyph, controls, contrastGlyph)
        ] satisfies [string, VectorizedGlyph];
      })
    );
  }, [controls, sourceGlyphs]);

  const glyphs = useMemo(
    () =>
      SPECIMEN_CHARACTERS.map((character) => glyphMap.get(character)).filter(
        (glyph): glyph is VectorizedGlyph => Boolean(glyph)
      ),
    [glyphMap]
  );

  const downloadGlyphs = useMemo(
    () =>
      SAMPLE_FONT_CHARACTERS.map((character) => glyphMap.get(character)).filter(
        (glyph): glyph is VectorizedGlyph => Boolean(glyph)
      ),
    [glyphMap]
  );

  const modificationPercent = useMemo(
    () => getWorkbenchModificationPercent(controls),
    [controls]
  );
  const canDownloadSample =
    Boolean(fontFamily) &&
    !isLoadingFont &&
    !fontError &&
    modificationPercent >= SAMPLE_FONT_MIN_MODIFICATION_PERCENT &&
    downloadGlyphs.length > 0;

  async function handleDownloadSample() {
    if (!fontFamily) {
      setDownloadError("Load a font before exporting a sample.");
      return;
    }

    setDownloadError(null);
    setSampleNameDraft((current) => current || getSuggestedSampleFontName(fontFamily.label));
    setIsSampleNameModalOpen(true);
  }

  function handleCancelSampleName() {
    if (isDownloadingSample) {
      return;
    }

    setIsSampleNameModalOpen(false);
    setDownloadError(null);
  }

  async function handleConfirmSampleDownload() {
    if (!fontFamily) {
      setDownloadError("Load a font before exporting a sample.");
      return;
    }

    const sampleName = sampleNameDraft.trim();

    if (sampleName.length < 2) {
      setDownloadError("Choose a font name with at least 2 characters.");
      return;
    }

    setDownloadError(null);
    setIsDownloadingSample(true);

    try {
      await downloadSampleFontPackage({
        fontFamily,
        controls,
        modificationPercent,
        glyphs: downloadGlyphs,
        sampleName
      });
      setIsSampleNameModalOpen(false);
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : "Unable to package the sample font."
      );
    } finally {
      setIsDownloadingSample(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 lg:px-8 lg:py-6 xl:h-screen xl:overflow-hidden">
      <div className="mx-auto max-w-[1680px] xl:grid xl:h-full xl:grid-cols-[360px_minmax(0,1fr)] xl:gap-4">
        <div className="relative z-20 xl:min-h-0">
          <BezierControlsPanel
            controls={controls}
            fontOptions={WORKBENCH_FONT_OPTIONS}
            selectedFontKey={selectedFontKey}
            onFontChange={setSelectedFontKey}
            onAxisChange={(axis, value) =>
              setControls((current) => ({
                ...current,
                [axis]: value
              }))
            }
            modificationPercent={modificationPercent}
            downloadMinimumPercent={SAMPLE_FONT_MIN_MODIFICATION_PERCENT}
            canDownloadSample={canDownloadSample}
            isDownloadingSample={isDownloadingSample}
            downloadError={downloadError}
            onDownloadSample={handleDownloadSample}
            onReset={() => setControls(DEFAULT_CONTROLS)}
          />
        </div>

        <section className="panel-surface relative z-0 mt-4 min-h-[42rem] rounded-[2.2rem] p-4 sm:p-5 xl:mt-0 xl:min-h-0">
          <div className="lab-scroll h-full min-h-0 overflow-y-auto pr-1 xl:pr-3">
            <div className="grid gap-4">
              {isLoadingFont ? (
                <section className="rounded-[2rem] border border-white/8 bg-black/20 p-6 text-sm text-white/60">
                  Loading {fontFamily?.label ?? WORKBENCH_FONT_OPTIONS.find((font) => font.key === selectedFontKey)?.label} and rebuilding the cubic contours…
                </section>
              ) : fontError ? (
                <section className="rounded-[2rem] border border-red-400/20 bg-red-400/8 p-6 text-sm text-red-100/88">
                  {fontError}
                </section>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {glyphs.map((glyph) => (
                    <BezierGlyphCard key={glyph.char} glyph={glyph} compact />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <SampleNameModal
        isOpen={isSampleNameModalOpen}
        value={sampleNameDraft}
        isSaving={isDownloadingSample}
        error={downloadError}
        onChange={(value) => {
          setSampleNameDraft(value);
          if (downloadError) {
            setDownloadError(null);
          }
        }}
        onCancel={handleCancelSampleName}
        onSave={handleConfirmSampleDownload}
      />
    </main>
  );
}
