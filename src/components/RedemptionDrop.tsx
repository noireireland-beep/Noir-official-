import React, { useState } from 'react';

export const RedemptionDrop: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isLockShaking, setIsLockShaking] = useState<boolean>(false);
  const [showDeniedPrompt, setShowDeniedPrompt] = useState<boolean>(false);

  const triggerLockShake = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLockShaking(true);
    setShowDeniedPrompt(true);
    setTimeout(() => setIsLockShaking(false), 520);
    setTimeout(() => setShowDeniedPrompt(false), 2600);
  };

  return (
    <section 
      id="redemption-drop"
      aria-label="Redemption Drop Confidential Vault"
      className="relative bg-[#D6CCBA] text-[#161616] border-t border-[#161616]/20 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden select-none"
    >
      <style>{`
        @keyframes lockRattle {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          18% { transform: translateX(-6px) rotate(-7deg); }
          36% { transform: translateX(6px) rotate(7deg); }
          54% { transform: translateX(-4px) rotate(-4deg); }
          72% { transform: translateX(4px) rotate(4deg); }
          88% { transform: translateX(-2px) rotate(-1deg); }
        }
        .animate-lock-shake {
          animation: lockRattle 0.5s ease-in-out;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 md:px-12 lg:px-16 py-8 sm:py-12 md:py-16">
        
        {/* Subtle Top Metadata Bar */}
        <div className="w-full flex items-center justify-between border-b border-[#161616]/15 pb-4 mb-6 sm:mb-8 text-[11px] font-mono-archive uppercase tracking-[0.25em] text-[#161616]/65 font-bold">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#161616] inline-block animate-pulse" />
            <span className="text-[#161616]">CONFIDENTIAL RELEASE</span>
          </div>
          <div className="flex items-center gap-4 text-[#161616]/75">
            <span className="text-[#161616] font-black">67 SETS</span>
            <span className="text-[#161616]/30">·</span>
            <span>LAUNCH DATE — FEBRUARY - MARCH</span>
          </div>
        </div>

        {/* FOLDED STATE: Compact Overview with a Few Essential Texts, Picture Box & See More Action */}
        {!isExpanded ? (
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8 bg-[#161616]/5 border border-[#161616]/15 p-5 sm:p-7 md:p-8 transition-all duration-500">
            
            {/* Left: Essential Texts */}
            <div className="flex-1 space-y-3 text-left w-full">
              <span className="font-mono-archive text-[10px] sm:text-xs font-bold uppercase tracking-[0.32em] text-[#161616]/60 block">
                CLASSIFIED DROP · EDITION 02
              </span>
              <h2 className="font-extenda uppercase text-4xl sm:text-5xl md:text-6xl font-black text-[#161616] tracking-tight leading-none">
                REDEMPTION DROP®
              </h2>
              <div className="flex items-center gap-3 pt-1">
                <span className="font-perandory uppercase text-lg sm:text-xl font-bold tracking-[0.16em] text-[#161616]">
                  FOR THE FEW
                </span>
                <span className="text-[#161616]/30">/</span>
                <span className="font-mono-archive text-xs font-bold uppercase tracking-wider text-[#161616]/70">
                  67 SETS WORLDWIDE
                </span>
              </div>
            </div>

            {/* Center / Right: Compact Picture Box with Clickable Shaking Lock */}
            <div className="flex items-center gap-5 sm:gap-7 w-full md:w-auto justify-between md:justify-end">
              
              <div 
                onClick={triggerLockShake}
                className="relative w-28 sm:w-36 aspect-[3/4] bg-[#161616]/10 border border-[#161616]/20 overflow-hidden shadow-md flex items-center justify-center cursor-pointer group shrink-0"
                title="Vault Locked — Click to attempt unlock"
              >
                {/* Completely Blurred Prototype Image */}
                <img 
                  src="/assets/aistudio/5b393e9daa0a854de1cc57b5af6d74bd_d11b779b.jpg" 
                  alt="Confidential Redemption Drop prototype garment preview"
                  className="absolute inset-0 w-full h-full object-cover object-center filter grayscale contrast-[1.4] blur-xl sm:blur-2xl scale-125 pointer-events-none"
                  loading="eager"
                />
                
                {/* Frosted Bone Film */}
                <div className="absolute inset-0 bg-[#D6CCBA]/45 backdrop-blur-[2px] pointer-events-none" />

                {/* Minimalist Clickable Padlock */}
                <div className={`relative z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#161616] text-[#D6CCBA] flex items-center justify-center shadow-lg transition-transform ${
                  isLockShaking ? 'animate-lock-shake' : 'group-hover:scale-110'
                }`}>
                  <svg 
                    className="w-4 h-4 sm:w-5 sm:h-5" 
                    viewBox="0 0 24 24" 
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3A5.25 5.25 0 0012 1.5zm3.25 5.25v3h-6.5v-3a3.25 3.25 0 016.5 0zM12 14.25a1.5 1.5 0 011.5 1.5v2.25a1.5 1.5 0 01-3 0v-2.25a1.5 1.5 0 011.5-1.5z" clipRule="evenodd" />
                  </svg>
                </div>

                {/* Lock rattle warning toast */}
                {showDeniedPrompt && (
                  <div className="absolute inset-x-1 bottom-1.5 z-20 bg-[#161616] text-[#FF0800] text-[8px] font-mono-archive uppercase font-bold tracking-widest text-center py-0.5 px-1 animate-pulse">
                    LOCKED
                  </div>
                )}
              </div>

              {/* "See More" Button */}
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="px-5 sm:px-7 py-3.5 sm:py-4 bg-[#161616] text-[#D6CCBA] hover:bg-[#2B2A28] font-mono-archive text-[11px] sm:text-xs font-bold uppercase tracking-[0.24em] transition-all duration-300 shadow-md flex items-center gap-2.5 cursor-pointer active:scale-98"
                aria-expanded={false}
              >
                <span>SEE MORE</span>
                <span className="text-sm">↓</span>
              </button>

            </div>

          </div>
        ) : (
          /* EXPANDED STATE: Full Architectural Layout with Simple Smooth Reveal */
          <div className="space-y-8 animate-fadeIn">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center pt-2 pb-6">
              
              {/* Left Column: Bold Editorial Typography & Urgent Acquisition Hook (7 cols) */}
              <div className="lg:col-span-7 flex flex-col justify-center space-y-6 sm:space-y-8">
                
                <div className="space-y-3">
                  <span className="font-mono-archive text-xs font-bold uppercase tracking-[0.32em] text-[#161616]/60 block">
                    CLASSIFIED DROP · EDITION 02
                  </span>
                  
                  <h2 className="font-extenda uppercase text-5xl sm:text-7xl md:text-8xl tracking-tight font-black text-[#161616] leading-[0.88]">
                    REDEMPTION DROP®
                  </h2>
                  
                  <p className="font-perandory uppercase text-2xl sm:text-3xl md:text-4xl tracking-[0.2em] font-black text-[#161616] pt-1">
                    FOR THE FEW
                  </p>
                </div>

                {/* Essential Metrics Line */}
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 py-4 border-y border-[#161616]/15 font-mono-archive text-xs sm:text-sm font-bold uppercase tracking-wider text-[#161616]">
                  <div className="flex items-center gap-2">
                    <span className="text-[#161616]/60">ALLOCATION:</span>
                    <span className="bg-[#161616] text-[#D6CCBA] px-2.5 py-0.5 font-black">67 SETS</span>
                  </div>
                  <span className="text-[#161616]/30">/</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#161616]/60">WINDOW:</span>
                    <span>FEBRUARY - MARCH</span>
                  </div>
                </div>

                {/* Psychological Urge Copy */}
                <div className="space-y-3 max-w-xl">
                  <p className="font-sans text-sm sm:text-base font-bold text-[#161616]/90 leading-relaxed">
                    The Redemption Drop® archive remains permanently locked to the public. 
                    Allocation rights are exclusively generated upon securing an <span className="text-[#161616] underline underline-offset-4 decoration-2">Archive Drop 01</span> tracksuit.
                  </p>
                  <p className="font-mono-archive text-[11px] uppercase tracking-wider text-[#161616]/65 font-bold">
                    0 / 67 CLAIMS REGISTERED · ACCESS RESTRICTED TO PATRONS
                  </p>
                </div>

                {/* Acquisition CTA & Action Strip */}
                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <a 
                    href="#ledger"
                    className="inline-flex items-center justify-between gap-6 px-8 py-5 bg-[#161616] hover:bg-[#2B2A28] text-[#D6CCBA] font-mono-archive text-xs sm:text-sm font-bold uppercase tracking-[0.22em] transition-all duration-300 shadow-xl group cursor-pointer active:scale-[0.98]"
                  >
                    <span>Acquire Archive Drop 01 To Unlock</span>
                    <span className="text-base transition-transform duration-300 group-hover:translate-x-1.5">→</span>
                  </a>

                  {/* Collapse / See Less Toggle */}
                  <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="px-6 py-5 border border-[#161616]/30 hover:border-[#161616] text-[#161616] font-mono-archive text-xs font-bold uppercase tracking-[0.2em] transition-colors cursor-pointer"
                    aria-expanded={true}
                  >
                    <span>SEE LESS ↑</span>
                  </button>
                </div>

              </div>

              {/* Right Column: The Completely Blurred Confidential Subject (5 cols) */}
              <div className="lg:col-span-5 flex justify-center lg:justify-end">
                <div 
                  onClick={triggerLockShake}
                  className="relative w-full max-w-md aspect-[3/4] bg-[#161616]/10 border border-[#161616]/20 overflow-hidden shadow-2xl flex items-center justify-center cursor-pointer group"
                  title="Vault Locked — Click to test lock"
                >
                  
                  {/* Corner Architectural Badges */}
                  <div className="absolute top-3 left-3 z-20 font-mono-archive text-[10px] font-bold uppercase tracking-widest text-[#161616] bg-[#D6CCBA]/95 px-2.5 py-1 border border-[#161616]/20">
                    PROTOTYPE #067
                  </div>
                  <div className="absolute top-3 right-3 z-20 font-mono-archive text-[10px] font-bold uppercase tracking-widest text-[#161616]/75 bg-[#D6CCBA]/95 px-2 py-1 border border-[#161616]/20">
                    LOCKED
                  </div>

                  {/* The Provided Subject: Completely Blurred */}
                  <div 
                    aria-hidden="true" 
                    className="absolute inset-0 overflow-hidden pointer-events-none select-none"
                  >
                    <img 
                      src="/assets/aistudio/5b393e9daa0a854de1cc57b5af6d74bd_d11b779b.jpg" 
                      alt="Confidential Redemption Drop prototype garment"
                      className="w-full h-full object-cover object-center filter grayscale contrast-[1.5] brightness-90 blur-2xl sm:blur-3xl md:blur-[48px] scale-120 transform-gpu"
                      loading="eager"
                    />
                  </div>

                  {/* Extra Soft Frosted Film on Bone */}
                  <div className="absolute inset-0 bg-[#D6CCBA]/40 backdrop-blur-sm pointer-events-none" />

                  {/* Minimalist Locked Icon & Status Centerpiece */}
                  <div className="relative z-10 flex flex-col items-center text-center p-6 bg-[#D6CCBA]/95 border border-[#161616] shadow-[0_15px_40px_rgba(0,0,0,0.15)] max-w-[280px]">
                    
                    {/* Minimalist Padlock Icon with Shake Animation */}
                    <button 
                      type="button"
                      onClick={triggerLockShake}
                      aria-label="Locked prototype icon. Click to test security."
                      className={`w-12 h-12 rounded-full bg-[#161616] text-[#D6CCBA] flex items-center justify-center mb-3 shadow-md transition-transform cursor-pointer ${
                        isLockShaking ? 'animate-lock-shake' : 'group-hover:scale-105'
                      }`}
                    >
                      <svg 
                        className="w-6 h-6" 
                        viewBox="0 0 24 24" 
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3A5.25 5.25 0 0012 1.5zm3.25 5.25v3h-6.5v-3a3.25 3.25 0 016.5 0zM12 14.25a1.5 1.5 0 011.5 1.5v2.25a1.5 1.5 0 01-3 0v-2.25a1.5 1.5 0 011.5-1.5z" clipRule="evenodd" />
                      </svg>
                    </button>

                    <span className="font-mono-archive text-[10px] font-black uppercase tracking-[0.22em] text-[#161616]">
                      ENCRYPTED SUBJECT
                    </span>
                    <span className="font-serif-editorial text-lg font-bold text-[#161616] mt-0.5">
                      Locked Prototype
                    </span>

                    {/* Shake Notification Tooltip */}
                    {showDeniedPrompt && (
                      <div className="mt-2 text-[9px] font-mono-archive font-bold uppercase tracking-wider text-[#FF0800] bg-[#161616] px-2 py-0.5">
                        ACCESS DENIED · PATRONS ONLY
                      </div>
                    )}
                  </div>

                  {/* Bottom Hairline Metadata inside frame */}
                  <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between text-[10px] font-mono-archive uppercase tracking-wider font-bold text-[#161616]/80 bg-[#D6CCBA]/95 px-3 py-1.5 border border-[#161616]/20">
                    <span>LAUNCH: FEB - MAR</span>
                    <span>FOR THE FEW · 67 SETS</span>
                  </div>

                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </section>
  );
};
