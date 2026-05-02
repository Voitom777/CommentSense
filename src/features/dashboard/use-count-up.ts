"use client";

import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const hasAnimated = useRef(false);
  const prevTarget = useRef(target);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Skip animation if target hasn't changed
    if (prevTarget.current === target && hasAnimated.current) return;
    prevTarget.current = target;
    hasAnimated.current = false;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          hasAnimated.current = true;
          const start = performance.now();
          const from = 0;

          function animate(now: number) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out quad
            const eased = 1 - (1 - progress) * (1 - progress);
            setCount(Math.round(from + (target - from) * eased));
            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          }

          requestAnimationFrame(animate);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(element);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);
  // `element` is intentionally omitted — its presence in the DOM
  // is stable because the ref is attached to a mounted component.

  return { count, ref };
}
