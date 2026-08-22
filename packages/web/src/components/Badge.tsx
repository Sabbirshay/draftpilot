import React from 'react';

type BadgeProps = {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'accent' | 'success';
};

export default function Badge({ children, className = '', variant = 'default' }: BadgeProps) {
  const baseStyles = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2";
  
  const variants = {
    default: "bg-bg-elevated text-text-muted border border-border",
    accent: "bg-accent/10 text-accent border border-accent/20",
    success: "bg-green-500/10 text-green-400 border border-green-500/20"
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
