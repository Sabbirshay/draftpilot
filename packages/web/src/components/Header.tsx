import React from 'react';
import Link from 'next/link';
import Button from './Button';
import { ThreeDStaggerFlip } from './ThreeDStaggerFlip';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full pt-4 px-4">
      <div className="max-w-6xl mx-auto backdrop-blur-xl bg-bg/85 border border-border rounded-full px-5 py-2.5 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-accent-light flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.5)]">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <ThreeDStaggerFlip text="DraftPilot" className="text-lg font-bold tracking-tight text-text" />
        </div>

        {/* Center Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-elevated/60 p-1 rounded-full border border-border/60">
          <a href="#how-it-works" className="px-3.5 py-1.5 text-xs font-medium text-text-muted hover:text-text rounded-full hover:bg-white/5 transition-all">How it works</a>
          <a href="#features" className="px-3.5 py-1.5 text-xs font-medium text-text-muted hover:text-text rounded-full hover:bg-white/5 transition-all">Features</a>
          <a href="#comparison" className="px-3.5 py-1.5 text-xs font-medium text-text-muted hover:text-text rounded-full hover:bg-white/5 transition-all">Compare</a>
          <a href="#pricing" className="px-3.5 py-1.5 text-xs font-medium text-text-muted hover:text-text rounded-full hover:bg-white/5 transition-all">Pricing</a>
        </nav>

        {/* Right CTAs */}
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-xs font-medium text-text-muted hover:text-text transition-colors px-2 py-1">
            Log in
          </Link>
          <Button variant="primary" href="/join" className="text-xs px-4 py-2 rounded-full font-semibold shadow-[0_0_20px_rgba(124,58,237,0.4)]">
            Add to Chrome — Free
          </Button>
        </div>
      </div>
    </header>
  );
}
