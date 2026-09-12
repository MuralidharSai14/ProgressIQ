/**
 * PROGRESSIQ — Enterprise Brand & Logo Component
 * Highly relevant structural infrastructure + progress intelligence mark
 * with fully theme-aware dark/light contrast typography.
 */
import clsx from 'clsx'
import { useTheme } from '../hooks/useTheme'

interface ProgressIQLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  showSubtitle?: boolean
  className?: string
  layout?: 'horizontal' | 'vertical'
}

export function ProgressIQIcon({
  className = 'w-9 h-9',
}: {
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx("shrink-0 select-none", className)}
      aria-label="PROGRESSIQ Emblem"
    >
      <defs>
        <linearGradient id="piq-grad-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="60%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#4338ca" />
        </linearGradient>
        <linearGradient id="piq-grad-bar1" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#93c5fd" />
        </linearGradient>
        <linearGradient id="piq-grad-bar2" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#67e8f9" />
        </linearGradient>
        <linearGradient id="piq-grad-bar3" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>
        <linearGradient id="piq-grad-spark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>

      {/* Outer Rounded Foundation Shield with border glow */}
      <rect
        width="40"
        height="40"
        rx="10"
        fill="url(#piq-grad-bg)"
      />
      <rect
        x="0.75"
        y="0.75"
        width="38.5"
        height="38.5"
        rx="9.25"
        stroke="#ffffff"
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />

      {/* Structural Foundation Beam / Grade Level */}
      <rect
        x="6"
        y="32"
        width="28"
        height="2.5"
        rx="1.25"
        fill="#ffffff"
        fillOpacity="0.3"
      />

      {/* Stepped Infrastructure & Progress Pillars */}
      {/* 1. Planned Baseline (Blue) */}
      <rect
        x="8"
        y="22"
        width="5.5"
        height="9"
        rx="1.5"
        fill="url(#piq-grad-bar1)"
      />
      {/* 2. Field Execution (Cyan) */}
      <rect
        x="15"
        y="16"
        width="5.5"
        height="15"
        rx="1.5"
        fill="url(#piq-grad-bar2)"
      />
      {/* 3. Evidence-Backed Target (Emerald) */}
      <rect
        x="22"
        y="10"
        width="5.5"
        height="21"
        rx="1.5"
        fill="url(#piq-grad-bar3)"
      />

      {/* AI Vector Intelligence Arc */}
      <path
        d="M 9 20 C 14 15, 20 12, 29 8"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Intelligence Verification Apex Node */}
      <circle
        cx="30"
        cy="7.5"
        r="3.5"
        fill="url(#piq-grad-spark)"
      />
      <circle
        cx="30"
        cy="7.5"
        r="1.5"
        fill="#ffffff"
      />

      {/* Precision Structural Alignment Dots */}
      <circle cx="10.75" cy="24.5" r="0.75" fill="#ffffff" fillOpacity="0.9" />
      <circle cx="17.75" cy="18.5" r="0.75" fill="#ffffff" fillOpacity="0.9" />
      <circle cx="24.75" cy="12.5" r="0.75" fill="#ffffff" fillOpacity="0.9" />
    </svg>
  )
}

export default function ProgressIQLogo({
  size = 'md',
  showText = true,
  showSubtitle = true,
  className,
  layout = 'horizontal',
}: ProgressIQLogoProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const sizeMap = {
    sm: {
      icon: 'w-7 h-7',
      title: 'text-sm',
      sub: 'text-[8px]',
    },
    md: {
      icon: 'w-9 h-9',
      title: 'text-base',
      sub: 'text-[9px]',
    },
    lg: {
      icon: 'w-11 h-11',
      title: 'text-xl',
      sub: 'text-[11px]',
    },
    xl: {
      icon: 'w-14 h-14',
      title: 'text-3xl sm:text-4xl',
      sub: 'text-xs sm:text-sm',
    },
  }

  const currentSize = sizeMap[size]

  return (
    <div
      className={clsx(
        "flex items-center select-none",
        layout === 'vertical' ? "flex-col text-center gap-3" : "gap-3",
        className
      )}
    >
      {/* Logo Badge Icon */}
      <div className="shrink-0 drop-shadow-md">
        <ProgressIQIcon className={currentSize.icon} />
      </div>

      {/* Text Branding */}
      {showText && (
        <div className={clsx("min-w-0", layout === 'vertical' && "text-center")}>
          <div
            className={clsx(
              "font-black tracking-tight leading-none transition-colors",
              currentSize.title,
              isDark ? "text-white" : "text-slate-900"
            )}
          >
            <span>PROGRESS</span>
            <span className={clsx("transition-colors", isDark ? "text-blue-400" : "text-blue-600")}>
              IQ
            </span>
          </div>

          {showSubtitle && (
            <p
              className={clsx(
                "uppercase tracking-wider font-bold mt-1 truncate transition-colors",
                currentSize.sub,
                isDark ? "text-blue-400/90" : "text-blue-700"
              )}
            >
              Project Progress Intelligence
            </p>
          )}
        </div>
      )}
    </div>
  )
}
