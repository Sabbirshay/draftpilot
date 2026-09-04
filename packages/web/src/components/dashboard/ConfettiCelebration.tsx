'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

interface ConfettiCelebrationProps {
  isActive: boolean;
  title?: string;
  message?: string;
  badgeName?: string;
  badgeIcon?: string;
  durationMs?: number;
  onClose?: () => void;
}

const CONFETTI_COLORS = [
  '#7C3AED', // accent purple
  '#A78BFA', // accent light
  '#06B6D4', // cyan
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EC4899', // pink
  '#3B82F6', // blue
];

export default function ConfettiCelebration({
  isActive,
  title = '🎉 Milestone Achieved!',
  message = 'Congratulations! You generated your first AI draft reply.',
  badgeName = 'AI Copilot Ace',
  badgeIcon = '⚡',
  durationMs = 6000,
  onClose,
}: ConfettiCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isActive) {
      setIsOpen(true);
    }
  }, [isActive]);

  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Generate 120 confetti particles
    const particleCount = 120;
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: width * (0.3 + Math.random() * 0.4),
        y: height * 0.4,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 12 - 4,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }

    let animationFrameId: number;
    let startTime = Date.now();

    const render = () => {
      const elapsed = Date.now() - startTime;
      ctx.clearRect(0, 0, width, height);

      let aliveCount = 0;
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // gravity
        p.vx *= 0.98; // air resistance
        p.rotation += p.rotationSpeed;

        if (elapsed > durationMs - 1500) {
          p.opacity = Math.max(0, p.opacity - 0.02);
        }

        if (p.opacity > 0 && p.y < height + 20) {
          aliveCount++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.opacity;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });

      if (aliveCount > 0 && elapsed < durationMs) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    const timeout = setTimeout(() => {
      setIsOpen(false);
      onClose?.();
    }, durationMs);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      clearTimeout(timeout);
    };
  }, [isOpen, durationMs, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4">
      {/* Canvas Layer for full-screen particles */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Celebration Banner Card */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="pointer-events-auto relative w-full max-w-md rounded-3xl bg-bg-card/95 border-2 border-accent/60 p-6 sm:p-8 shadow-[0_0_60px_rgba(124,58,237,0.45)] backdrop-blur-xl text-center space-y-5"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onClose?.();
            }}
            className="absolute top-4 right-4 text-text-dim hover:text-text p-1 rounded-full bg-elevated border border-border cursor-pointer text-xs"
          >
            ✕
          </button>

          {/* Animated Badge Icon with glowing halo */}
          <div className="relative mx-auto w-20 h-20">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-accent via-purple-500 to-cyan flex items-center justify-center shadow-[0_0_30px_rgba(124,58,237,0.6)]"
            >
              <span className="text-4xl">{badgeIcon}</span>
            </motion.div>
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-accent to-cyan opacity-40 blur-lg -z-10 animate-pulse" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-accent-light text-[11px] font-bold uppercase tracking-wider mb-2">
              <span>🏆</span>
              <span>Badge Unlocked: {badgeName}</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-text tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-text-muted mt-2 leading-relaxed">
              {message}
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onClose?.();
              }}
              className="w-full py-3 px-6 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all cursor-pointer"
            >
              Awesome! Keep Going →
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
