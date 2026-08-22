import React from 'react';

type SectionHeadingProps = {
  tag?: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  className?: string;
};

export default function SectionHeading({ 
  tag,
  title, 
  subtitle, 
  align = 'center', 
  className = '' 
}: SectionHeadingProps) {
  const alignClass = align === 'center' ? 'text-center items-center' : 'text-left items-start';
  
  return (
    <div className={`flex flex-col gap-3 mb-14 ${alignClass} ${className}`}>
      {tag && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-elevated border border-border text-[11px] font-semibold text-accent tracking-wide uppercase">
          <span>{tag}</span>
        </div>
      )}
      <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-text leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-base md:text-lg text-text-muted max-w-[650px] leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
