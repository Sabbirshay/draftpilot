import React from 'react';

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export default function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-bg-card border border-border rounded-xl p-6 transition-colors hover:border-border-hover ${className}`}>
      {children}
    </div>
  );
}
