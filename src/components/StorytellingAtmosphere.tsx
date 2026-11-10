import React, { forwardRef } from 'react';

interface StorytellingAtmosphereProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * StorytellingAtmosphere
 * 
 * Full-screen, fully responsive monochromatic background component based on structural reference:
 * - Outer soft off-white / archival bone framing (monochromatic #DFD9CE / #E6E1D8)
 * - Deep smoky monochrome central radial/linear gradient (#070707 -> #161616)
 * - Grounded heavy dark shadow monolithic base at the bottom
 * - Rendered entirely in pure modern CSS gradients (vector-crisp on all screen resolutions)
 */
export const StorytellingAtmosphere = forwardRef<HTMLDivElement, StorytellingAtmosphereProps>(
  ({ className = '', style }, ref) => {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={`storytelling-atmosphere absolute inset-0 z-5 pointer-events-none overflow-hidden select-none ${className}`}
        style={{
          ...style,
        }}
      >
        {/* Layer 1: Base Monochromatic Off-White Archival Framing Canvas */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, #EAE5DC 0%, #DFD9CE 45%, #D7D1C5 100%)',
          }}
        />

        {/* Layer 2: Ethereal Feathered Perimeter Vignette (Softening outer frame edges) */}
        <div 
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(90deg, 
                #DFD9CE 0%, 
                rgba(223, 217, 206, 0.95) clamp(10px, 2.5vw, 36px), 
                rgba(223, 217, 206, 0) clamp(28px, 6.5vw, 88px), 
                rgba(223, 217, 206, 0) calc(100% - clamp(28px, 6.5vw, 88px)), 
                rgba(223, 217, 206, 0.95) calc(100% - clamp(10px, 2.5vw, 36px)), 
                #DFD9CE 100%
              ),
              linear-gradient(180deg, 
                #E8E3DA 0%, 
                rgba(232, 227, 218, 0.96) clamp(12px, 3vh, 40px), 
                rgba(232, 227, 218, 0) clamp(32px, 8vh, 96px), 
                rgba(215, 209, 197, 0) calc(100% - clamp(32px, 7vh, 88px)), 
                rgba(215, 209, 197, 0.95) calc(100% - clamp(10px, 2.5vh, 32px)), 
                #D7D1C5 100%
              )
            `,
          }}
        />

        {/* Layer 3: Pure CSS Smoky Dark Monochrome Central Gradient */}
        {/* Creates a soft, continuous, smoky transition into the deep monochrome void with zero abrupt edges */}
        <div 
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(
                ellipse 78% 74% at 50% 50%,
                #070707 0%,
                #0A0A0A 28%,
                #101010 44%,
                #181716 56%,
                #242321 66%,
                #3A3734 75%,
                #5D5954 83%,
                #8E887E 89%,
                rgba(190, 183, 172, 0.82) 94%,
                rgba(223, 217, 206, 0.96) 98%,
                #DFD9CE 100%
              )
            `,
          }}
        />

        {/* Layer 4: Secondary Subtle Depth Falloff for continuous smoky ambience */}
        <div 
          className="absolute inset-0 mix-blend-multiply opacity-65 pointer-events-none"
          style={{
            background: `
              radial-gradient(
                ellipse 88% 82% at 50% 50%,
                rgba(0, 0, 0, 0.96) 0%,
                rgba(7, 7, 7, 0.88) 46%,
                rgba(18, 18, 18, 0.72) 64%,
                rgba(38, 36, 34, 0.45) 76%,
                rgba(95, 91, 84, 0.2) 88%,
                rgba(223, 217, 206, 0) 98%
              )
            `,
          }}
        />

        {/* Layer 5: Fine Archival Plate Grain for Tactile Luxury Finish */}
        <div className="plate-grain absolute inset-0 pointer-events-none opacity-25" />
      </div>
    );
  }
);

StorytellingAtmosphere.displayName = 'StorytellingAtmosphere';
