'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';

export interface ThreeDStaggerFlipProps {
  /** Text or words to animate with 3D Stagger Flip */
  text: string;
  /** Secondary text or highlight on flip. Defaults to the same text with accent color */
  secondaryText?: string;
  /** Delay between individual character flips (in seconds) */
  staggerDuration?: number;
  /** Animation duration per character flip */
  duration?: number;
  /** Flip axis: 'x' (vertical flip) or 'y' (horizontal flip) */
  axis?: 'x' | 'y';
  /** Additional container CSS classes */
  className?: string;
  /** Trigger mode: 'hover' on parent, 'inView' on scroll, or 'always' */
  trigger?: 'hover' | 'inView' | 'always';
}

export function ThreeDStaggerFlip({
  text,
  secondaryText,
  staggerDuration = 0.025,
  duration = 0.45,
  axis = 'x',
  className = '',
  trigger = 'hover',
}: ThreeDStaggerFlipProps) {
  const words = text.split(' ');
  const secondaryWords = (secondaryText || text).split(' ');

  const containerVariants: Variants = {
    initial: {},
    animate: {
      transition: {
        staggerChildren: staggerDuration,
      },
    },
    hover: {
      transition: {
        staggerChildren: staggerDuration,
      },
    },
  };

  const topFaceVariants: Variants = {
    initial: {
      rotateX: 0,
      rotateY: 0,
      y: 0,
      opacity: 1,
    },
    hover: {
      rotateX: axis === 'x' ? 90 : 0,
      rotateY: axis === 'y' ? -90 : 0,
      y: axis === 'x' ? '-100%' : 0,
      opacity: 0,
      transition: {
        duration,
        ease: [0.33, 1, 0.68, 1],
      },
    },
    animate: {
      rotateX: 0,
      rotateY: 0,
      y: 0,
      opacity: 1,
      transition: {
        duration,
        ease: [0.33, 1, 0.68, 1],
      },
    },
  };

  const bottomFaceVariants: Variants = {
    initial: {
      rotateX: axis === 'x' ? -90 : 0,
      rotateY: axis === 'y' ? 90 : 0,
      y: axis === 'x' ? '100%' : 0,
      opacity: 0,
    },
    hover: {
      rotateX: 0,
      rotateY: 0,
      y: 0,
      opacity: 1,
      transition: {
        duration,
        ease: [0.33, 1, 0.68, 1],
      },
    },
    animate: {
      rotateX: 0,
      rotateY: 0,
      y: 0,
      opacity: 1,
      transition: {
        duration,
        ease: [0.33, 1, 0.68, 1],
      },
    },
  };

  let charOffset = 0;

  return (
    <motion.span
      className={`inline-flex flex-wrap relative cursor-pointer select-none ${className}`}
      style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
      variants={containerVariants}
      initial="initial"
      whileHover={trigger === 'hover' ? 'hover' : undefined}
      whileInView={trigger === 'inView' ? 'animate' : undefined}
      viewport={{ once: true }}
      aria-label={text}
    >
      <span className="sr-only">{text}</span>
      <span className="inline-flex flex-wrap justify-center gap-x-2.5" aria-hidden="true">
        {words.map((word, wordIndex) => {
          const secWord = secondaryWords[wordIndex] || word;
          const wordChars = word.split('');
          const secWordChars = secWord.split('');

          return (
            <span key={wordIndex} className="inline-block whitespace-nowrap">
              {wordChars.map((char, cIndex) => {
                const altChar = secWordChars[cIndex] || char;
                const totalIndex = charOffset++;

                return (
                  <span
                    key={cIndex}
                    className="relative inline-block overflow-hidden"
                    style={{
                      perspective: '600px',
                      transformStyle: 'preserve-3d',
                    }}
                  >
                    {/* Primary Face */}
                    <motion.span
                      variants={topFaceVariants}
                      className="inline-block origin-bottom"
                      style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                      }}
                    >
                      {char}
                    </motion.span>

                    {/* Flipped Secondary Face */}
                    <motion.span
                      variants={bottomFaceVariants}
                      className="absolute inset-0 inline-block origin-top text-accent-light font-semibold"
                      style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                      }}
                    >
                      {altChar}
                    </motion.span>
                  </span>
                );
              })}
            </span>
          );
        })}
      </span>
    </motion.span>
  );
}

export default ThreeDStaggerFlip;
