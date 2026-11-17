"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "../ui";

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
/** True when the visitor asked for less motion. False on the server, so the first render matches. */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCE).matches,
    () => false,
  );
}

/**
 * A muted, looping clip that only plays while it is on screen and pauses when it leaves.
 * It sits on top of a still image the parent renders underneath, and fades in once frames
 * are actually playing, so there is never a blank or a jump. With reduced motion it renders
 * nothing and the still stays.
 *
 * `eager` starts loading at once (the hero); otherwise nothing downloads until the clip is
 * about one screen away.
 */
export function ScrollVideo({ src, poster, eager = false, className }: { src: string; poster?: string; eager?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || reduced) return;
    // Load when about a screen away; play only while at least a quarter is visible.
    // load() cancels a pending play(), so after loading, play again if it is already in view.
    let visible = false;
    const near = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && v.preload !== "auto") {
          v.preload = "auto";
          v.load();
          if (visible) v.play().catch(() => {});
        }
      },
      { rootMargin: "100% 0px" },
    );
    const seen = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.25 },
    );
    near.observe(v);
    seen.observe(v);
    return () => {
      near.disconnect();
      seen.disconnect();
    };
  }, [reduced]);

  if (reduced) return null;
  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload={eager ? "auto" : "none"}
      aria-hidden
      tabIndex={-1}
      onPlaying={() => setPlaying(true)}
      className={cn("object-cover transition-opacity duration-500 ease-enter", playing ? "opacity-100" : "opacity-0", className)}
    />
  );
}
