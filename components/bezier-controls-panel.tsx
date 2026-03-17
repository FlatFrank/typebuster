"use client";

import { InfoTooltip } from "@/components/info-tooltip";
import { SliderControl } from "@/components/slider-control";
import type { WorkbenchFontKey, WorkbenchFontOption } from "@/lib/font/load-font";
import {
  clampChamfer,
  clampContrast,
  clampFacet,
  clampGlitch,
  clampLiquify,
  clampPixelSnap,
  clampRoundness,
  clampSlant,
  clampWeight,
  clampWobble
} from "@/lib/glyph/transform-vectorized-glyph";
import type { GlyphWorkbenchControls } from "@/lib/types";

type BezierControlsPanelProps = {
  controls: GlyphWorkbenchControls;
  fontOptions: WorkbenchFontOption[];
  selectedFontKey: WorkbenchFontKey;
  modificationPercent: number;
  downloadMinimumPercent: number;
  canDownloadSample: boolean;
  isDownloadingSample: boolean;
  downloadError: string | null;
  onFontChange: (key: WorkbenchFontKey) => void;
  onAxisChange: (axis: keyof GlyphWorkbenchControls, value: number) => void;
  onDownloadSample: () => void;
  onReset: () => void;
};

export function BezierControlsPanel({
  controls,
  fontOptions,
  selectedFontKey,
  modificationPercent,
  downloadMinimumPercent,
  canDownloadSample,
  isDownloadingSample,
  downloadError,
  onFontChange,
  onAxisChange,
  onDownloadSample,
  onReset
}: BezierControlsPanelProps) {
  const clampedWeight = clampWeight(controls.weight);
  const clampedContrast = clampContrast(controls.contrast);
  const clampedSlant = clampSlant(controls.slant);
  const clampedRoundness = clampRoundness(controls.roundness);
  const clampedChamfer = clampChamfer(controls.chamfer);
  const clampedFacet = clampFacet(controls.facet);
  const clampedPixelSnap = clampPixelSnap(controls.pixelSnap);
  const clampedWobble = clampWobble(controls.wobble);
  const clampedLiquify = clampLiquify(controls.liquify);
  const clampedGlitch = clampGlitch(controls.glitch);
  const unlockProgress = Math.min((modificationPercent / downloadMinimumPercent) * 100, 100);
  const remainingPercent = Math.max(downloadMinimumPercent - modificationPercent, 0);

  return (
    <aside className="lab-scroll relative z-30 flex h-full min-h-0 flex-col gap-4 overflow-x-visible overflow-y-auto pr-2">
      <section className="panel-surface rounded-[1.7rem] p-4">
        <div className="caps-label text-[0.7rem] text-white/48">Fonts</div>
        <div className="mt-4 grid gap-2">
          {fontOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`rounded-[1.1rem] border px-3 py-3 text-left text-sm transition ${
                option.key === selectedFontKey
                  ? "border-[#6ce7f8]/38 bg-[rgba(108,231,248,0.12)] text-white"
                  : "border-white/8 bg-white/[0.03] text-white/72 hover:border-white/14 hover:bg-white/[0.05]"
              }`}
              onClick={() => onFontChange(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel-surface rounded-[1.7rem] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="caps-label text-[0.7rem] text-white/48">Sample download</div>
            <InfoTooltip
              label="sample download"
              content={`Download unlocks after at least ${downloadMinimumPercent}% total modification across the non-weight axes. Width and height only contribute up to 20% combined. Weight still exports, but it does not count toward the threshold. Before packaging, the app asks you to name the sample font in a centered modal. The zip includes a renamed subsetted sample font with A-Z, a-z, 1-9, !?, plus space, alongside OFL.txt, DISCLAIMER.txt, and SETTINGS.json.`}
              maxWidth={320}
            />
          </div>
          <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-medium text-white/74">
            {modificationPercent}% / {downloadMinimumPercent}%
          </div>
        </div>

        <div className="mt-4 h-2 rounded-full bg-white/[0.05]">
          <div
            className="h-full rounded-full bg-[#6ce7f8]"
            style={{ width: `${unlockProgress}%` }}
          />
        </div>

        <button
          type="button"
          className={`mt-4 w-full rounded-[1.1rem] border px-4 py-3 text-sm font-medium transition ${
            canDownloadSample
              ? "border-[#6ce7f8]/40 bg-[rgba(108,231,248,0.12)] text-white hover:border-[#6ce7f8]/55 hover:bg-[rgba(108,231,248,0.18)]"
              : "cursor-not-allowed border-white/8 bg-white/[0.03] text-white/38"
          }`}
          disabled={!canDownloadSample || isDownloadingSample}
          onClick={onDownloadSample}
        >
          {isDownloadingSample
            ? "Packaging sample…"
            : canDownloadSample
              ? "Download sample font"
              : `Need ${remainingPercent}% more to unlock`}
        </button>

        {downloadError ? (
          <p className="mt-3 rounded-[1rem] border border-red-400/20 bg-red-400/[0.08] px-3 py-2 text-sm leading-6 text-red-100/88">
            {downloadError}
          </p>
        ) : null}
      </section>

      <section className="panel-surface rounded-[1.7rem] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="caps-label text-[0.7rem] text-white/48">Axes</div>
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/78 transition hover:bg-white/[0.08]"
            onClick={onReset}
          >
            Reset axes
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <SliderControl
            label="Width"
            description="Moves anchors and both handles on X around the glyph center, so the whole cubic skeleton widens or narrows coherently."
            min={-50}
            max={50}
            step={1}
            value={controls.width}
            onChange={(value) => onAxisChange("width", value)}
          />
          <SliderControl
            label="Height"
            description="Moves anchors and both handles on Y around the baseline, so the glyph grows upward or compresses downward without floating."
            min={-50}
            max={50}
            step={1}
            value={controls.height}
            onChange={(value) => onAxisChange("height", value)}
          />
          <SliderControl
            label="Weight"
            description="Blends three local masters for the selected family. Variable fonts use generated static instances; static families fall back to synthetic thin and black extremes."
            min={100}
            max={900}
            step={1}
            value={clampedWeight}
            onChange={(value) => onAxisChange("weight", value)}
          />
          <SliderControl
            label="Contrast"
            description="Blends the current weight with a heavier companion using a vertical split. Negative values thicken the upper half; positive values thicken the lower half."
            min={-100}
            max={100}
            step={1}
            value={clampedContrast}
            onChange={(value) => onAxisChange("contrast", value)}
          />
          <SliderControl
            label="Slant"
            description="Applies a true shear around the baseline, so the glyph leans without changing its node order."
            min={-20}
            max={20}
            step={1}
            value={clampedSlant}
            onChange={(value) => onAxisChange("slant", value)}
          />
          <SliderControl
            label="Roundness"
            description="Cuts back sharp corners and reconnects them with stronger cubic fillets, so edges round off without changing the letter skeleton."
            min={0}
            max={100}
            step={1}
            value={clampedRoundness}
            onChange={(value) => onAxisChange("roundness", value)}
          />
          <SliderControl
            label="Chamfer"
            description="Trims sharp corners back and reconnects them with flat cuts, so the glyph feels carved, industrial and less calligraphic than roundness."
            min={0}
            max={100}
            step={1}
            value={clampedChamfer}
            onChange={(value) => onAxisChange("chamfer", value)}
          />
          <SliderControl
            label="Facet"
            description="Breaks curves into straighter polygonal segments. Low values feel posterized; high values turn bowls and arcs into hard planes."
            min={0}
            max={100}
            step={1}
            value={clampedFacet}
            onChange={(value) => onAxisChange("facet", value)}
          />
          <SliderControl
            label="Pixel Snap"
            description="Samples the outline, snaps it to a grid and rebuilds it as stepped paths. Combined with facet, this is the fastest way to get convincingly pixel-like letters."
            min={0}
            max={100}
            step={1}
            value={clampedPixelSnap}
            onChange={(value) => onAxisChange("pixelSnap", value)}
          />
          <SliderControl
            label="Wobble"
            description="Adds a contour ripple along local edge normals, so the outline vibrates without collapsing the glyph skeleton."
            min={0}
            max={100}
            step={1}
            value={clampedWobble}
            onChange={(value) => onAxisChange("wobble", value)}
          />
          <SliderControl
            label="Liquify"
            description="Pushes the whole glyph through a smooth low-frequency flow field, like the curves were made of warm vinyl instead of rigid metal."
            min={0}
            max={100}
            step={1}
            value={clampedLiquify}
            onChange={(value) => onAxisChange("liquify", value)}
          />
          <SliderControl
            label="Glitch"
            description="Slices the glyph into deterministic horizontal bands and offsets each node bundle, so stepped discontinuities appear without losing the underlying contour graph."
            min={0}
            max={100}
            step={1}
            value={clampedGlitch}
            onChange={(value) => onAxisChange("glitch", value)}
          />
        </div>
      </section>
    </aside>
  );
}
