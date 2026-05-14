import React from 'react';
import { ArrowLeft } from 'lucide-react';

const VARIANT_STYLES = {
  platform: {
    kicker: 'text-violet-600',
    badge: 'bg-violet-600',
    border: 'border-violet-200',
    bg: 'bg-violet-50',
    dot: 'bg-violet-500',
  },
  workspace: {
    kicker: 'text-emerald-600',
    badge: 'bg-emerald-600',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    dot: 'bg-emerald-500',
  },
  official: {
    kicker: 'text-blue-600',
    badge: 'bg-blue-600',
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    dot: 'bg-blue-500',
  },
};

export default function AdminLayout({ variant = 'platform', kicker, title, subtitle, onBack, breadcrumbs = [], children }) {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.platform;

  return (
    <div className="bg-white min-h-screen">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 h-14 flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition"
          >
            <ArrowLeft size={15} />
            Kembali
          </button>

          {breadcrumbs.length > 0 && (
            <>
              <span className="text-neutral-300">/</span>
              {breadcrumbs.map((crumb, i) => (
                <React.Fragment key={i}>
                  {crumb.onClick ? (
                    <button
                      onClick={crumb.onClick}
                      className="text-sm font-semibold text-neutral-500 hover:text-neutral-900 transition"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className="text-sm font-semibold text-neutral-900">{crumb.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 && <span className="text-neutral-300">/</span>}
                </React.Fragment>
              ))}
            </>
          )}

          <div className="ml-auto">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white ${styles.badge}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
              {variant.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Hero header */}
      <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-12 pb-10">
        <div className={`text-xs uppercase tracking-[0.22em] font-black mb-3 ${styles.kicker}`}>
          {kicker}
        </div>
        <h1
          className="font-display text-4xl lg:text-5xl text-neutral-900 leading-none mb-4"
          style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800 }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-base text-neutral-500 max-w-xl leading-relaxed">{subtitle}</p>
        )}
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-5 lg:px-8 pb-20">
        {children}
      </div>
    </div>
  );
}

/** Reusable stat card */
export function StatCard({ label, value, sub, icon: Icon, accent = 'neutral' }) {
  const accents = {
    neutral: 'bg-neutral-50 border-neutral-200 text-neutral-900',
    violet: 'bg-violet-50 border-violet-200 text-violet-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  };
  return (
    <div className={`rounded-3xl border p-5 ${accents[accent] || accents.neutral}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="text-xs uppercase tracking-[0.22em] font-black opacity-60">{label}</div>
        {Icon && <Icon size={16} className="opacity-50 mt-0.5 shrink-0" />}
      </div>
      <div className="text-3xl font-display leading-none">{value}</div>
      {sub && <div className="text-sm opacity-60 mt-1.5 leading-snug">{sub}</div>}
    </div>
  );
}

/** Reusable empty state */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-3xl bg-neutral-100 flex items-center justify-center mb-4">
          <Icon size={24} className="text-neutral-400" />
        </div>
      )}
      <div className="font-display text-xl text-neutral-700 mb-2">{title}</div>
      {description && <p className="text-sm text-neutral-500 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Reusable status badge */
export function StatusBadge({ status }) {
  const map = {
    active:    'bg-emerald-100 text-emerald-700 border-emerald-200',
    approved:  'bg-emerald-100 text-emerald-700 border-emerald-200',
    submitted: 'bg-blue-100 text-blue-700 border-blue-200',
    confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
    published: 'bg-blue-100 text-blue-700 border-blue-200',
    pending:   'bg-amber-100 text-amber-700 border-amber-200',
    draft:     'bg-neutral-100 text-neutral-600 border-neutral-200',
    assigned:  'bg-violet-100 text-violet-700 border-violet-200',
    inactive:  'bg-neutral-100 text-neutral-500 border-neutral-200',
    expired:   'bg-red-100 text-red-600 border-red-200',
    rejected:  'bg-red-100 text-red-600 border-red-200',
    dismissed: 'bg-neutral-100 text-neutral-500 border-neutral-200',
    resolved:  'bg-emerald-100 text-emerald-700 border-emerald-200',
    completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    cancelled: 'bg-red-100 text-red-600 border-red-200',
  };
  const cls = map[status?.toLowerCase()] || map.pending;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] border ${cls}`}>
      {status}
    </span>
  );
}

/** Reusable modal wrapper */
export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-3xl shadow-2xl w-full ${width} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div className="font-display text-xl text-neutral-900">{title}</div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-neutral-100 flex items-center justify-center text-neutral-500 transition">
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/** Reusable form field */
export function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-[0.18em] font-black text-neutral-500 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-neutral-400 mt-1">{hint}</p>}
    </div>
  );
}

export const inputCls = "w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:bg-white transition";
export const textareaCls = `${inputCls} resize-none`;
export const selectCls = `${inputCls} appearance-none cursor-pointer`;

/** Primary action button */
export function ActionButton({ onClick, loading, disabled, children, variant = 'primary', size = 'md' }) {
  const sizes = { sm: 'px-4 py-2 text-xs', md: 'px-5 py-2.5 text-sm', lg: 'px-6 py-3 text-base' };
  const variants = {
    primary: 'bg-neutral-900 text-white hover:bg-neutral-800',
    danger:  'bg-red-600 text-white hover:bg-red-700',
    outline: 'bg-white text-neutral-900 border border-neutral-300 hover:border-neutral-900',
    ghost:   'bg-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 rounded-2xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${variants[variant]}`}
    >
      {loading ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : null}
      {children}
    </button>
  );
}
