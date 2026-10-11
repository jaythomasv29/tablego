'use client';
import React, { useRef } from 'react';
export default function MagneticButton({
  children,
  className,
  onClick,
  style,
  disabled = false,
  type = "button",
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void | Promise<void>;
  style?: React.CSSProperties;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const handleMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    el.style.transform = `translate(${x * 0.08}px, ${y * 0.08}px) scale(1.05)`;
  };

  const handleLeave = () => {
    const el = buttonRef.current;
    if (!el) return;
    el.style.transform = "translate(0px, 0px) scale(1)";
  };

  return (
    <button
      ref={buttonRef}
      type={type}
      onClick={onClick}
      style={style}
      disabled={disabled}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`relative overflow-hidden transition-transform duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${className || ""}`}
    >
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
      <span className="relative z-10">{children}</span>
    </button>
  );
}
