import React, { useEffect, useId, useRef } from 'react';
import { LIQUID_GLASS_DISPLACEMENT_MAP } from '../utils/liquidGlassMap';
import { computeLiquidGlassMetrics } from '../utils/liquidGlassScroll';

interface LiquidGlassBarProps {
  children: React.ReactNode;
  className?: string;
  frostOpacity?: number;
  saturation?: number;
  scrollProgress?: number;
  as?: 'div' | 'button';
  type?: 'button' | 'submit' | 'reset';
  onClick?: React.MouseEventHandler<HTMLElement>;
  tabIndex?: number;
  ariaLabel?: string;
  ariaHidden?: boolean;
}

export const LiquidGlassBar: React.FC<LiquidGlassBarProps> = ({
  children,
  className = '',
  frostOpacity = 0.12,
  saturation = 1.12,
  scrollProgress,
  as = 'div',
  type = 'button',
  onClick,
  tabIndex,
  ariaLabel,
  ariaHidden,
}) => {
  const rawId = useId();
  const filterId = `glass-filter-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const containerRef = useRef<HTMLElement | null>(null);
  const displacementRef = useRef<SVGFEDisplacementMapElement | null>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement | null>(null);

  const initialMetrics = computeLiquidGlassMetrics({
    scrollY: 0,
    maxScroll: 1,
    externalProgress: scrollProgress,
    baseFrost: frostOpacity,
    baseSaturation: saturation,
  });

  useEffect(() => {
    let rafId: number | null = null;

    const applyScrollMetrics = () => {
      rafId = null;
      const docEl = document.documentElement;
      const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
      const maxScroll = Math.max(1, docEl.scrollHeight - window.innerHeight);

      const metrics = computeLiquidGlassMetrics({
        scrollY,
        maxScroll,
        externalProgress: scrollProgress,
        baseFrost: frostOpacity,
        baseSaturation: saturation,
      });

      const el = containerRef.current;
      if (el) {
        el.style.setProperty('--glass-blur', `${metrics.blurPx}px`);
        el.style.setProperty('--glass-scale', String(metrics.transformScale));
        el.style.setProperty('--glass-frost', String(metrics.frostOpacity));
        el.style.setProperty('--glass-saturation', String(metrics.saturation));
      }

      if (displacementRef.current) {
        displacementRef.current.setAttribute('scale', String(metrics.displacementScale));
      }
      if (blurRef.current) {
        blurRef.current.setAttribute('stdDeviation', String(metrics.stdDeviation));
      }
    };

    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(applyScrollMetrics);
    };

    applyScrollMetrics();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [scrollProgress, frostOpacity, saturation]);

  const cssVars = {
    '--glass-frost': String(initialMetrics.frostOpacity),
    '--glass-saturation': String(initialMetrics.saturation),
    '--glass-blur': `${initialMetrics.blurPx}px`,
    '--glass-scale': String(initialMetrics.transformScale),
    '--filter-id': `url(#${filterId})`,
  } as React.CSSProperties;

  // Clear single-channel optical displacement without chromatic blue/RGB fringing
  const filterSvg = (
    <svg
      className="noire-liquid-glass__filter"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <filter
          id={filterId}
          colorInterpolationFilters="sRGB"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
        >
          <feImage
            x="0"
            y="0"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            result="map"
            href={LIQUID_GLASS_DISPLACEMENT_MAP}
          />
          <feDisplacementMap
            ref={displacementRef}
            in="SourceGraphic"
            in2="map"
            result="refracted"
            scale={initialMetrics.displacementScale}
            xChannelSelector="R"
            yChannelSelector="G"
          />
          <feGaussianBlur
            ref={blurRef}
            in="refracted"
            stdDeviation={initialMetrics.stdDeviation}
          />
        </filter>
      </defs>
    </svg>
  );

  const innerGlint = (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-4 sm:inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent z-0"
    />
  );

  if (as === 'button') {
    return (
      <button
        ref={(node) => {
          containerRef.current = node;
        }}
        type={type}
        onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
        tabIndex={tabIndex}
        aria-label={ariaLabel}
        aria-hidden={ariaHidden}
        className={`noire-liquid-glass overflow-hidden ${className}`}
        style={cssVars}
      >
        {filterSvg}
        {innerGlint}
        <span className="relative z-10 flex items-center justify-center gap-1.5 w-full">
          {children}
        </span>
      </button>
    );
  }

  return (
    <div
      ref={(node) => {
        containerRef.current = node;
      }}
      onClick={onClick as React.MouseEventHandler<HTMLDivElement>}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
      className={`noire-liquid-glass overflow-hidden ${className}`}
      style={cssVars}
    >
      {filterSvg}
      {innerGlint}
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
};
