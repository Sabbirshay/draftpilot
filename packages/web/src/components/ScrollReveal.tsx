'use client';

import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

type RevealVariant = 'fade-up' | 'fade-left' | 'fade-right' | 'fade-scale';

type ScrollRevealProps = {
  children: React.ReactNode;
  variant?: RevealVariant;
  delay?: number;
  duration?: number;
  once?: boolean;
  threshold?: number;
  margin?: string;
  className?: string;
};

const variantMap: Record<RevealVariant, { hidden: Record<string, any>; visible: Record<string, any> }> = {
  'fade-up': {
    hidden: { opacity: 0, y: 60 },
    visible: { opacity: 1, y: 0 },
  },
  'fade-left': {
    hidden: { opacity: 0, x: -60 },
    visible: { opacity: 1, x: 0 },
  },
  'fade-right': {
    hidden: { opacity: 0, x: 60 },
    visible: { opacity: 1, x: 0 },
  },
  'fade-scale': {
    hidden: { opacity: 0, scale: 0.9, y: 40 },
    visible: { opacity: 1, scale: 1, y: 0 },
  },
};

/**
 * Wraps children with a scroll-triggered reveal animation.
 * Uses framer-motion's useInView for intersection detection.
 */
export default function ScrollReveal({
  children,
  variant = 'fade-up',
  delay = 0,
  duration = 0.8,
  once = true,
  threshold = 0.1,
  margin = '-60px 0px -60px 0px',
  className = '',
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { 
    once, 
    margin: margin as any,
  });

  const { hidden, visible } = variantMap[variant];

  return (
    <motion.div
      ref={ref}
      initial={hidden}
      animate={isInView ? visible : hidden}
      transition={{
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1], // Smooth cubic ease-out
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
