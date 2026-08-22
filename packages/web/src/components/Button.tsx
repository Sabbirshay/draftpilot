import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  href?: string;
};

export default function Button({ children, variant = 'primary', className = '', href, ...props }: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center rounded-full text-xs md:text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:pointer-events-none px-5 py-2.5 cursor-pointer";
  
  const variants = {
    primary: "bg-accent text-white hover:bg-accent-hover shadow-[0_0_20px_rgba(124,58,237,0.35)] hover:shadow-[0_0_30px_rgba(124,58,237,0.6)] hover:scale-[1.02] active:scale-[0.98]",
    secondary: "bg-elevated text-text border border-border hover:border-border-hover hover:bg-elevated/80",
    ghost: "bg-transparent text-text-muted hover:text-text hover:bg-white/5"
  };

  const combinedClassName = `${baseStyles} ${variants[variant]} ${className}`;

  if (href) {
    return (
      <a href={href} className={combinedClassName}>
        {children}
      </a>
    );
  }

  return (
    <button className={combinedClassName} {...props}>
      {children}
    </button>
  );
}
