'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const GAP = 8;        // space between the trigger and the panel
const MARGIN = 8;     // minimum clearance from the viewport edges

type Coords = { top: number; left: number };

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  /** Clases del wrapper del trigger (es un inline-flex). */
  className?: string;
}

/**
 * Tooltip on hover/focus, rendered through a portal on document.body.
 *
 * The portal is what makes it usable inside the tables: those live in an `overflow-x-auto`
 * container, which clips any absolutely positioned panel rendered as a descendant. Positioning
 * is `fixed` off the trigger's viewport rect, so there is no scroll arithmetic to keep in sync.
 */
export function Tooltip({ content, children, className = '' }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // The portal needs no SSR guard: coords is only set from a mouse or focus handler, so by the
  // time there is anything to portal the component is already running on the client.
  const [coords, setCoords] = useState<Coords | null>(null);

  function open() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + GAP, left: rect.left });
  }

  // With the panel's real size measured, nudge it so it clears the right and bottom edges.
  // This runs after paint because the size is unknown until then.
  useEffect(() => {
    if (!coords || !panelRef.current) return;
    const panel = panelRef.current.getBoundingClientRect();
    const maxLeft = window.innerWidth - panel.width - MARGIN;
    const trigger = triggerRef.current?.getBoundingClientRect();
    const flipUp = trigger && coords.top + panel.height + MARGIN > window.innerHeight;
    const top = flipUp ? trigger.top - panel.height - GAP : coords.top;
    const left = Math.max(MARGIN, Math.min(coords.left, maxLeft));
    if (top !== coords.top || left !== coords.left) setCoords({ top, left });
  }, [coords]);

  return (
    <>
      <span
        ref={triggerRef}
        className={`inline-flex ${className}`}
        tabIndex={0}
        onMouseEnter={open}
        onMouseLeave={() => setCoords(null)}
        onFocus={open}
        onBlur={() => setCoords(null)}
      >
        {children}
      </span>
      {coords && createPortal(
        <div
          ref={panelRef}
          role="tooltip"
          className="fixed z-50 bg-[#1e2128] border border-gray-700 rounded-md shadow-xl px-3 py-2 pointer-events-none"
          style={{ top: coords.top, left: coords.left }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
}
