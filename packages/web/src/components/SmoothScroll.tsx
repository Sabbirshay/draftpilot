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
      orientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.1,
      touchMultiplier: 1.5,
      infinite: false,
      autoRaf: true,
    });

    // Make lenis globally available for anchor scrolling
    (window as any).lenis = lenis;

    return () => {
      lenis.destroy();
      delete (window as any).lenis;
    };
  }, []);

  return <>{children}</>;
}
