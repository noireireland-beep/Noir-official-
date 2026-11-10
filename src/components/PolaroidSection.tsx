import React, { useState } from "react";

/**
 * Editorial Polaroid Film Component for Atelier NOIRÉ
 * Strictly contains NO external text on the section canvas.
 * - Front: Photo 1 in tactile, festive archival Polaroid frame with warm cardstock,
 *   delicate botanical holly/pine ink motif, crimson-gold wax seal accent,
 *   translucent archival tape, and handwritten "merry Christmas from NOIRÉ" on bottom chin.
 * - Back: Snappy 3D flip revealing Photo 2 with equal border (no extra bottom chin)
 *   and handwritten "Wear your roots, not someone else's uniform" inside the photo.
 */
export const PolaroidSection: React.FC = () => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleToggleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggleFlip();
    }
  };

  return (
    <section
      className="relative w-full py-20 sm:py-28 md:py-36 bg-[#161616] flex items-center justify-center overflow-hidden border-t border-white/[0.07]"
      aria-label="Atelier NOIRÉ Archive Commemorative Film"
    >
      {/* Subtle warm gallery backdrop glow — restrained, tactile, no neon */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 48%, rgba(122, 24, 24, 0.11) 0%, rgba(36, 48, 38, 0.06) 36%, rgba(22, 22, 22, 0) 70%)",
        }}
      />

      <style>{`
        .polaroid-perspective {
          perspective: 1800px;
        }
        .polaroid-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          transition: transform 0.72s cubic-bezier(0.2, 0.85, 0.32, 1.15);
        }
        .polaroid-card-inner.is-flipped {
          transform: rotateY(180deg);
        }
        .polaroid-face {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          box-sizing: border-box;
        }
        .polaroid-face-back {
          transform: rotateY(180deg);
        }
        .polaroid-paper {
          background-color: #F6F1E7;
          background-image:
            radial-gradient(at 18% 12%, rgba(255, 255, 255, 0.65) 0px, transparent 52%),
            radial-gradient(at 84% 88%, rgba(214, 200, 178, 0.38) 0px, transparent 58%),
            repeating-linear-gradient(
              0deg,
              rgba(120, 105, 85, 0.018) 0px,
              rgba(120, 105, 85, 0.018) 1px,
              transparent 1px,
              transparent 3px
            );
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.75),
            inset 0 -2px 8px rgba(130, 112, 88, 0.14);
        }
        .polaroid-window-recess {
          box-shadow:
            inset 0 2px 7px rgba(0, 0, 0, 0.48),
            inset 0 0 0 1px rgba(0, 0, 0, 0.18),
            0 1px 0 rgba(255, 255, 255, 0.85);
        }
        .polaroid-tape {
          background: linear-gradient(
            135deg,
            rgba(166, 44, 44, 0.78) 0%,
            rgba(138, 28, 28, 0.84) 50%,
            rgba(158, 38, 38, 0.76) 100%
          );
          box-shadow:
            0 2px 6px rgba(0, 0, 0, 0.32),
            inset 0 1px 0 rgba(255, 255, 255, 0.22);
          backdrop-filter: blur(1px);
        }
        .handwritten-ink {
          font-family: 'Caveat', cursive, system-ui;
          font-variant-ligatures: normal;
          -webkit-font-smoothing: subpixel-antialiased;
        }
      `}</style>

      {/* Interactive 3D Polaroid Card Container */}
      <div className="relative z-10 w-full max-w-[356px] sm:max-w-[420px] md:max-w-[460px] px-4">
        <div
          role="button"
          tabIndex={0}
          onClick={handleToggleFlip}
          onKeyDown={handleKeyDown}
          aria-pressed={isFlipped}
          aria-label={
            isFlipped
              ? "Polaroid back face: Wear your roots, not someone else's uniform. Click to flip back."
              : "Polaroid front face: merry Christmas from NOIRÉ. Click to flip film."
          }
          className="polaroid-perspective group relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#FF0800] rounded-[4px] select-none transition-transform duration-300 hover:scale-[1.016]"
        >
          {/* Tactile Crimson Archival Tape at top center */}
          <div
            aria-hidden="true"
            className="polaroid-tape pointer-events-none absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 w-24 sm:w-28 h-6 sm:h-7 -rotate-[1.8deg] rounded-[1px] opacity-90 transition-opacity duration-300"
            style={{
              maskImage:
                "linear-gradient(90deg, transparent 0%, black 4%, black 96%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(90deg, transparent 0%, black 4%, black 96%, transparent 100%)",
            }}
          >
            {/* Subtle gold foil hairline stripe inside archival tape */}
            <div className="w-full h-[1px] bg-[#D4AF37]/45 mt-[3px]" />
          </div>

          {/* Flipper Wrapper with 4:5.55 classic Polaroid aspect ratio */}
          <div
            className={`polaroid-card-inner aspect-[4/5.55] relative shadow-[0_28px_70px_rgba(0,0,0,0.88),0_10px_24px_rgba(0,0,0,0.55)] transition-shadow duration-500 group-hover:shadow-[0_36px_85px_rgba(0,0,0,0.96),0_12px_30px_rgba(0,0,0,0.68)] ${
              isFlipped ? "is-flipped" : ""
            }`}
          >
            {/* ================= FRONT FACE: FESTIVE ARCHIVAL POLAROID FILM ================= */}
            <div className="polaroid-face polaroid-paper rounded-[3px] p-3.5 sm:p-4.5 pb-4 sm:pb-5 flex flex-col justify-between border border-[#DFD5C5]">
              {/* Photo Frame Container — Picture itself is 100% unmodified */}
              <div className="polaroid-window-recess relative w-full flex-1 overflow-hidden bg-[#1E1E1E]">
                <img
                  src="/assets/aistudio/edited_three_stripe_bicep_2_f6cf134a.jpg"
                  alt="Atelier NOIRÉ lookbook archive session"
                  loading="lazy"
                  className="w-full h-full object-cover object-center select-none pointer-events-none"
                  draggable={false}
                />
              </div>

              {/* Generous, Sophisticated Christmas Chin */}
              <div className="relative pt-4 sm:pt-5 pb-2 sm:pb-2.5 flex flex-col items-center justify-center min-h-[78px] sm:min-h-[92px]">
                {/* Delicate fine-line botanical holly & pine sprig divider */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 180 22"
                  className="w-32 sm:w-36 h-4 sm:h-[18px] mb-1.5 opacity-85"
                  fill="none"
                >
                  {/* Fine antique-gold hairline stems */}
                  <path
                    d="M12 11 H66 M114 11 H168"
                    stroke="#A6894B"
                    strokeWidth="0.75"
                    strokeLinecap="round"
                  />
                  {/* Pine & holly leaves in deep forest green */}
                  <path
                    d="M74 11 C78 5, 84 4, 88 9 C83 12, 78 13, 74 11 Z"
                    stroke="#213D2F"
                    strokeWidth="1.15"
                    fill="#213D2F"
                    fillOpacity="0.14"
                  />
                  <path
                    d="M106 11 C102 5, 96 4, 92 9 C97 12, 102 13, 106 11 Z"
                    stroke="#213D2F"
                    strokeWidth="1.15"
                    fill="#213D2F"
                    fillOpacity="0.14"
                  />
                  <path
                    d="M84 14 C86 18, 94 18, 96 14"
                    stroke="#213D2F"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />
                  {/* Three crimson holly berries */}
                  <circle cx="90" cy="10.5" r="2.1" fill="#8E1919" />
                  <circle cx="86.5" cy="13" r="1.5" fill="#A62020" />
                  <circle cx="93.5" cy="13" r="1.5" fill="#A62020" />
                  {/* Subtle 4-point star accents */}
                  <path
                    d="M54 11 L55.5 8 L57 11 L55.5 14 Z M123 11 L124.5 8 L126 11 L124.5 14 Z"
                    fill="#A6894B"
                  />
                </svg>

                {/* Handwritten Inscription: "merry Christmas from NOIRÉ" */}
                <p
                  className="handwritten-ink text-[1.65rem] sm:text-[2.05rem] font-bold tracking-normal leading-none transform -rotate-[1.2deg] transition-transform duration-300 group-hover:-rotate-[0.5deg]"
                  style={{
                    color: "#221818",
                    textShadow: "0.35px 0.35px 0px rgba(0,0,0,0.2)",
                  }}
                >
                  merry{" "}
                  <span className="text-[#8B1616]">Christmas</span>{" "}
                  from{" "}
                  <span className="tracking-wide text-[#181818]">NOIRÉ</span>
                </p>

                {/* Embossed crimson wax/foil corner seal on bottom right of cardstock */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute right-1 sm:right-2 bottom-0.5 flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-[#8B1616]/45 bg-[#8B1616]/[0.06] rotate-[8deg]"
                >
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-dashed border-[#A6894B]/70 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-[#8B1616]/85" fill="currentColor">
                      <path d="M12 2L13.9 9.1L21 11L13.9 12.9L12 20L10.1 12.9L3 11L10.1 9.1L12 2Z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* ================= BACK FACE: EQUAL BORDER + INSIDE TEXT ================= */}
            <div className="polaroid-face polaroid-face-back polaroid-paper rounded-[3px] p-3.5 sm:p-4.5 flex flex-col border border-[#DFD5C5]">
              {/* Photo Frame: equal border all around, no extra bottom chin */}
              <div className="polaroid-window-recess relative w-full h-full overflow-hidden bg-[#1E1E1E] flex items-end">
                <img
                  src="/assets/aistudio/file_00000000cc9881f8b295d10f6ec9c43c__2__6d551629.jpg"
                  alt="Atelier NOIRÉ studio lookbook archive: Wear your roots, not someone else's uniform"
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover object-center select-none pointer-events-none"
                  draggable={false}
                />

                {/* Legibility contrast scrim for handwritten inscription inside the photo */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none"
                />

                {/* Inside Handwritten Text: "Wear your roots, not someone else's uniform" */}
                <div className="relative z-10 w-full p-4 sm:p-5 text-center">
                  <p
                    className="handwritten-ink text-white text-xl sm:text-2xl md:text-[1.75rem] font-bold leading-snug tracking-wide transform -rotate-[1deg]"
                    style={{
                      textShadow:
                        "0 2px 10px rgba(0,0,0,0.95), 0 0 20px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,1)",
                    }}
                  >
                    Wear your roots, not someone else&apos;s uniform
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PolaroidSection;
