'use client';

import { useEffect } from 'react';
import Lenis from '@/lib/lenis';

/**
 * Global Lenis smooth-scroll provider.
 * Wraps the page with butter-smooth inertial scrolling.
 * Preserves native scrollbar, anchors, and accessibility.
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 2,
      infinite: false,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
