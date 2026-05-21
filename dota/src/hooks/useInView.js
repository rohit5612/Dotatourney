import { useEffect, useRef, useState } from "react";

/**
 * Observes when an element enters the viewport. Defaults to firing once with prefetch margin.
 * @param {{ rootMargin?: string; threshold?: number; once?: boolean }} [options]
 */
export function useInView(options = {}) {
  const { rootMargin = "240px 0px", threshold = 0.02, once = true } = options;
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold, once]);

  return { ref, inView };
}
