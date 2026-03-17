"use client";

import { useId } from "react";

import type { VectorizedGlyph } from "@/lib/types";

type BezierGlyphCardProps = {
  glyph: VectorizedGlyph;
  compact?: boolean;
  interactive?: boolean;
  selected?: boolean;
  onSelect?: () => void;
};

export function BezierGlyphCard({
  glyph,
  compact = false,
  interactive = false,
  selected = false,
  onSelect
}: BezierGlyphCardProps) {
  const outlineId = useId().replace(/:/g, "");
  const warmOutlineFilterId = `${outlineId}-warm-outline`;
  const electricOutlineFilterId = `${outlineId}-electric-outline`;
  const padding = 80;
  const viewBox = `${glyph.bounds.minX - padding} ${glyph.bounds.minY - padding} ${
    glyph.bounds.width + padding * 2
  } ${glyph.bounds.height + padding * 2}`;
  const shellClassName = compact
    ? `rounded-[1.6rem] border border-white/8 bg-white/[0.02] p-4 transition ${
        selected ? "border-cyan-300/40 shadow-[0_0_0_1px_rgba(108,231,248,0.18)]" : ""
      } ${interactive ? "hover:border-white/16 hover:bg-white/[0.03]" : ""}`
    : "panel-surface rounded-[2rem] p-5";
  const previewHeightClassName = compact ? "h-[14rem]" : "h-[26rem]";
  const previewSvg = (
    <svg
      viewBox={viewBox}
      className={`${previewHeightClassName} w-full overflow-visible`}
      role="img"
      aria-label={`Vectorized glyph ${glyph.char}`}
      shapeRendering="geometricPrecision"
    >
      <defs>
        <filter id={warmOutlineFilterId} x="-20%" y="-20%" width="140%" height="140%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="1.2" result="expanded" />
          <feComposite in="expanded" in2="SourceAlpha" operator="out" result="outline" />
          <feFlood floodColor="rgb(246 239 225)" floodOpacity="0.5" result="outlineColor" />
          <feComposite in="outlineColor" in2="outline" operator="in" />
        </filter>

        <filter id={electricOutlineFilterId} x="-24%" y="-24%" width="148%" height="148%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="2.2" result="expanded" />
          <feComposite in="expanded" in2="SourceAlpha" operator="out" result="outline" />
          <feFlood floodColor="rgb(108 231 248)" floodOpacity="0.95" result="outlineColor" />
          <feComposite in="outlineColor" in2="outline" operator="in" />
        </filter>
      </defs>

      <path
        d={glyph.originalPathData}
        fill="rgb(246 239 225)"
        fillRule="nonzero"
        filter={`url(#${warmOutlineFilterId})`}
      />
      <path
        d={glyph.originalPathData}
        fill="rgba(246,239,225,0.08)"
        fillRule="nonzero"
      />
      <path
        d={glyph.rebuiltPathData}
        fill="rgb(108 231 248)"
        fillRule="nonzero"
        filter={`url(#${electricOutlineFilterId})`}
      />
      <path d={glyph.rebuiltPathData} fill="rgba(108,231,248,0.12)" fillRule="nonzero" />
    </svg>
  );

  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="caps-label text-[0.68rem] text-white/46">Glyph</div>
          <h2
            className={`mt-2 font-semibold leading-none tracking-[-0.08em] text-white ${
              compact ? "text-[2.2rem]" : "text-[2.75rem]"
            }`}
          >
            {glyph.char}
          </h2>
        </div>
        <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-white/56">
          {glyph.contours.length} contours
        </div>
      </div>

      {compact ? (
        <div className="mt-5">{previewSvg}</div>
      ) : (
        <div className="mt-5 rounded-[1.6rem] border border-white/8 bg-black/20 p-4">
          {previewSvg}
        </div>
      )}

      {compact ? null : (
        <>
          <p className="mt-4 text-xs leading-5 text-white/46">
            Warm outline = Archivo Regular reference. Electric outline = current cubic blend after
            the selected Archivo weight and geometry controls.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="caps-label text-[0.62rem] text-white/40">Segments</div>
              <div className="mt-2 text-lg text-white">{glyph.segmentCount}</div>
            </div>
            <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="caps-label text-[0.62rem] text-white/40">Box</div>
              <div className="mt-2 text-lg text-white">
                {glyph.bounds.width.toFixed(1)} × {glyph.bounds.height.toFixed(1)}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[1.4rem] border border-white/8 bg-black/20 p-4">
            <div className="caps-label text-[0.68rem] text-white/40">Contour map</div>
            <div className="mt-4 grid gap-3">
              {glyph.contours.map((contour) => (
                <div
                  key={contour.id}
                  className="grid gap-3 rounded-[1.1rem] border border-white/8 bg-white/[0.03] p-3 sm:grid-cols-4"
                >
                  <div>
                    <div className="text-[0.68rem] uppercase tracking-[0.16em] text-white/34">
                      Contour
                    </div>
                    <div className="mt-2 text-sm text-white/82">
                      {contour.contourIndex} · {contour.isHole ? "hole" : "outer"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[0.68rem] uppercase tracking-[0.16em] text-white/34">
                      Direction
                    </div>
                    <div className="mt-2 text-sm text-white/82">{contour.direction}</div>
                  </div>
                  <div>
                    <div className="text-[0.68rem] uppercase tracking-[0.16em] text-white/34">
                      Nodes
                    </div>
                    <div className="mt-2 text-sm text-white/82">{contour.nodes.length}</div>
                  </div>
                  <div>
                    <div className="text-[0.68rem] uppercase tracking-[0.16em] text-white/34">
                      Area
                    </div>
                    <div className="mt-2 text-sm text-white/82">{contour.area.toFixed(1)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );

  if (interactive && onSelect) {
    return (
      <button
        type="button"
        className={`${shellClassName} w-full appearance-none text-left outline-none`}
        onClick={onSelect}
      >
        {content}
      </button>
    );
  }

  return <article className={shellClassName}>{content}</article>;
}
