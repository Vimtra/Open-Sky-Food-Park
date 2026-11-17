"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "./ui";

interface Props {
  title: string;
  /** Link or note shown beside the title. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  gapClass?: string;
}

/** Horizontally scrolling row. Swipes on touch; shows arrow buttons on desktop when it overflows. */
export function Rail({ title, aside, children, className, gapClass = "gap-3 md:gap-4" }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft > 4, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [measure, children]);

  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    el?.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const arrow = "hit-44 relative hidden size-9 items-center justify-center rounded-full bg-surface-2 text-ink-900 transition-colors duration-150 hover:bg-line disabled:text-ink-300 disabled:hover:bg-surface-2 md:flex";

  return (
    <section className={className} aria-label={title}>
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-heading md:text-title">{title}</h2>
        <div className="flex shrink-0 items-center gap-2">
          {aside}
          {(edges.start || edges.end) && (
            <>
              <button type="button" className={arrow} onClick={() => page(-1)} disabled={!edges.start} aria-label={`Scroll ${title} back`}>
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <button type="button" className={arrow} onClick={() => page(1)} disabled={!edges.end} aria-label={`Scroll ${title} forward`}>
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </>
          )}
        </div>
      </div>
      <div
        ref={scroller}
        onScroll={measure}
        data-start={edges.start || undefined}
        data-end={edges.end || undefined}
        className={cn("rail rail-fade -mx-4 mt-4 scroll-px-4 px-4 pb-1 md:mx-0 md:scroll-px-0 md:px-0", gapClass)}>
        {children}
      </div>
    </section>
  );
}
