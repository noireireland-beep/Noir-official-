import React, { useId } from 'react';
import { LIQUID_GLASS_DISPLACEMENT_MAP } from '../utils/liquidGlassMap';

interface LiquidGlassBarProps {
  children: React.ReactNode;
  className?: string;
  frostOpacity?: number;
  saturation?: number;
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
  frostOpacity = 0.16,
  saturation = 1.25,
  as = 'div',
  type = 'button',
  onClick,
  tabIndex,
  ariaLabel,
  ariaHidden,
}) => {
  const rawId = useId();
  const filterId = `glass-filter-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const cssVars = {
    '--glass-frost': String(frostOpacity),
    '--glass-saturation': String(saturation),
    '--filter-id': `url(#${filterId})`,
  } as React.CSSProperties;

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
            in="SourceGraphic"
            in2="map"
            result="dispRed"
            scale="-20"
            xChannelSelector="R"
            yChannelSelector="G"
          />
          <feColorMatrix
            in="dispRed"
            type="matrix"
            values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"
            result="red"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            result="dispGreen"
            scale="-24"
            xChannelSelector="R"
            yChannelSelector="G"
          />
          <feColorMatrix
            in="dispGreen"
            type="matrix"
            values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0"
            result="green"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            result="dispBlue"
            scale="-28"
            xChannelSelector="R"
            yChannelSelector="G"
          />
          <feColorMatrix
            in="dispBlue"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0"
            result="blue"
          />
          <feBlend in="red" in2="green" mode="screen" result="rg" />
          <feBlend in="rg" in2="blue" mode="screen" result="output" />
          <feGaussianBlur in="output" stdDeviation="3" />
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
