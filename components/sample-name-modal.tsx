"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type SampleNameModalProps = {
  isOpen: boolean;
  value: string;
  isSaving: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

export function SampleNameModal({
  isOpen,
  value,
  isSaving,
  error,
  onChange,
  onCancel,
  onSave
}: SampleNameModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSaving, onCancel]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close sample naming modal"
        className="absolute inset-0 bg-[rgba(4,6,10,0.76)] backdrop-blur-[2px]"
        onClick={isSaving ? undefined : onCancel}
      />

      <div className="panel-surface relative z-[221] w-full max-w-[32rem] rounded-[2rem] p-5 sm:p-6">
        <h2 className="text-[1.65rem] font-semibold tracking-[-0.05em] text-white">
          Name your font before export
        </h2>

        <label className="mt-5 block">
          <span className="mb-2 block text-[0.72rem] uppercase tracking-[0.16em] text-white/42">
            Font name
          </span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            maxLength={80}
            className="w-full rounded-[1.2rem] border border-white/10 bg-black/25 px-4 py-3 text-base text-white outline-none transition placeholder:text-white/24 focus:border-[#6ce7f8]/40 focus:bg-black/35"
            placeholder="My Typebuster Font"
            onChange={(event) => onChange(event.currentTarget.value)}
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-[1rem] border border-red-400/20 bg-red-400/[0.08] px-3 py-2 text-sm leading-6 text-red-100/88">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/78 transition hover:bg-white/[0.08]"
            disabled={isSaving}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-full border border-[#6ce7f8]/40 bg-[rgba(108,231,248,0.12)] px-4 py-2 text-sm font-medium text-white transition hover:border-[#6ce7f8]/55 hover:bg-[rgba(108,231,248,0.18)] disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/[0.03] disabled:text-white/38"
            disabled={isSaving || value.trim().length < 2}
            onClick={onSave}
          >
            {isSaving ? "Saving sample…" : "Save sample"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
