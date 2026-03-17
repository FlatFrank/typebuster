"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type InfoTooltipProps = {
  label: string;
  content: string;
  maxWidth?: number;
};

type TooltipPosition = {
  top: number;
  left: number;
};

const VIEWPORT_PADDING = 16;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function InfoTooltip({
  label,
  content,
  maxWidth = 288
}: InfoTooltipProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0 });

  const tooltipWidth = useMemo(() => Math.min(maxWidth, 320), [maxWidth]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const left = clamp(
        rect.left,
        VIEWPORT_PADDING,
        window.innerWidth - tooltipWidth - VIEWPORT_PADDING
      );

      setPosition({
        top: rect.bottom + 10,
        left
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, tooltipWidth]);

  return (
    <span className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        className="flex h-5 w-5 items-center justify-center text-[#6ce7f8] transition hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-[#6ce7f8]/40 opacity-80"
        aria-label={`About ${label}`}
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="10" cy="10" r="7.1" />
          <path d="M10 8.2v4.5" />
          <path d="M10 5.8h.01" />
        </svg>
      </button>

      {isOpen
        ? createPortal(
            <div
              id={tooltipId}
              role="tooltip"
              className="pointer-events-none fixed z-[300] rounded-[1rem] border border-white/14 bg-[#080b12] px-3 py-2 text-[0.72rem] leading-5 text-white/88 ring-1 ring-black/55 shadow-[0_24px_56px_rgba(0,0,0,0.62)]"
              style={{
                top: position.top,
                left: position.left,
                width: `${tooltipWidth}px`,
                maxWidth: `calc(100vw - ${VIEWPORT_PADDING * 2}px)`
              }}
            >
              {content}
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
