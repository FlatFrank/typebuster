"use client";

import { startTransition } from "react";

import { InfoTooltip } from "@/components/info-tooltip";

type SliderControlProps = {
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
};

export function SliderControl({
  label,
  description,
  min,
  max,
  step,
  value,
  onChange
}: SliderControlProps) {
  return (
    <label className="flex flex-col gap-3 rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium tracking-[0.12em] text-white/92 uppercase">
            {label}
          </div>
          <InfoTooltip label={label} content={description} maxWidth={288} />
        </div>
        <div className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs font-medium text-white/78">
          {value}
        </div>
      </div>

      <input
        type="range"
        className="slider-track"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const nextValue = Number(event.currentTarget.value);
          startTransition(() => {
            onChange(nextValue);
          });
        }}
      />
    </label>
  );
}
