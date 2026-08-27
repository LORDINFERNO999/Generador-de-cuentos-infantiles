// ============================================================
// Componentes UI reutilizables con estilo infantil.
// ============================================================

import { Loader2 } from 'lucide-react';
import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-rose-400 to-orange-400 text-white hover:from-rose-500 hover:to-orange-500 shadow-lg shadow-rose-200',
  secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
  danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm',
  success: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm',
};

export function Button({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
        variantClasses[variant]
      } ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading && <Loader2 className="h-5 w-5 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl bg-white p-6 shadow-xl shadow-slate-200/50 ${className}`}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  color = 'amber',
}: {
  children: React.ReactNode;
  color?: 'amber' | 'green' | 'red' | 'blue' | 'slate';
}) {
  const colors: Record<string, string> = {
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${colors[color]}`}>
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-slate-500">
      <Loader2 className="h-8 w-8 animate-spin text-rose-400" />
      {label && <p className="text-sm font-medium">{label}</p>}
    </div>
  );
}

export function SectionTitle({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="flex items-center gap-2 font-['Fredoka',sans-serif] text-2xl font-bold text-slate-800">
        <span>{emoji}</span>
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}
