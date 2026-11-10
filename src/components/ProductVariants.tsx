import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  COLORWAYS, 
  ARCHIVE_SPECS, 
  CATALOGUE_GALLERY, 
  CataloguePhoto, 
  ColorwayTheme, 
  recommendSize,
  FIT_MODELS,
  FitModel
} from '../utils/archive-data';
import { CareModalTab } from './CustomerCareModal';
import {
  WishlistItem,
  loadWishlist,
  saveWishlist,
  toggleWishlistVariant,
  removeWishlistVariant,
  isVariantWishlisted,
} from '../utils/wishlist';

interface ProductVariantsProps {
  selectedColor: 'carbon' | 'blue-charcoal';
  onSelectColor: (color: 'carbon' | 'blue-charcoal') => void;
  onAddToCart: (colorway: 'carbon' | 'blue-charcoal', size: string) => void;
  onOpenCareModal?: (tab: CareModalTab) => void;
}

export const ProductVariants: React.FC<ProductVariantsProps> = ({
  selectedColor,
  onSelectColor,
  onAddToCart,
  onOpenCareModal,
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const [selectedSize, setSelectedSize] = useState<string>('L');
  const [photoIndex, setPhotoIndex] = useState<number>(0);
  const [customChest, setCustomChest] = useState<number>(100);
  const [showSizeCalculator, setShowSizeCalculator] = useState<boolean>(false);

  // Persistent local wishlist state for saving specific garment variants
  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => loadWishlist());
  const [heartPulse, setHeartPulse] = useState<boolean>(false);
  const [showSavedPanel, setShowSavedPanel] = useState<boolean>(false);

  const isCurrentWishlisted = isVariantWishlisted(wishlist, selectedColor, selectedSize);

  const handleToggleWishlist = () => {
    const result = toggleWishlistVariant(wishlist, selectedColor, selectedSize);
    setWishlist(result.items);
    saveWishlist(result.items);
    if (result.saved) {
      setHeartPulse(true);
      window.setTimeout(() => setHeartPulse(false), 520);
    }
  };

  const handleRemoveWishlistItem = (id: string) => {
    const next = removeWishlistVariant(wishlist, id);
    setWishlist(next);
    saveWishlist(next);
    if (next.length === 0) {
      setShowSavedPanel(false);
    }
  };

  // Merged Fit & Silhouette reference state at bottom of archive box
  const [activeGender, setActiveGender] = useState<'male' | 'female'>('male');
  const maleData = FIT_MODELS.male;
  const femaleData = FIT_MODELS.female;

  const theme: ColorwayTheme = COLORWAYS[selectedColor];
  const isBlue = selectedColor === 'blue-charcoal';
  const photos: CataloguePhoto[] = CATALOGUE_GALLERY[selectedColor] || [];
  const currentPhoto: CataloguePhoto = photos[photoIndex] || photos[0];
  const currentFitModel = activeGender === 'male' ? maleData : femaleData;

  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];

  // Reset photo index when colorway changes if index is out of bounds
  useEffect(() => {
    if (photoIndex >= photos.length) {
      setPhotoIndex(0);
    }
  }, [selectedColor, photos.length, photoIndex]);

  const handleNextPhoto = useCallback(() => {
    setPhotoIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  const handlePrevPhoto = useCallback(() => {
    setPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  // Touch and drag gesture handling for horizontal sliding between perspectives
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    touchStartXRef.current = clientX;
    touchStartYRef.current = clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as React.MouseEvent).clientY;
    
    const diffX = clientX - touchStartXRef.current;
    const diffY = clientY - touchStartYRef.current;

    if (Math.abs(diffX) > 30 && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
      if (diffX < 0) {
        handleNextPhoto();
      } else {
        handlePrevPhoto();
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const handleApplyRecommendedSize = () => {
    const rec = recommendSize(customChest);
    setSelectedSize(rec);
    setShowSizeCalculator(false);
  };

  return (
    <section 
      id="ledger" 
      ref={sectionRef}
      className="relative py-8 sm:py-12 md:py-16 px-4 sm:px-6 md:px-10 lg:px-14 transition-colors duration-700 border-t scroll-mt-28 overflow-hidden"
      style={{
        backgroundColor: isBlue ? '#14191F' : '#161616',
        borderColor: isBlue ? '#465462' : 'rgba(214, 204, 186, 0.15)',
        color: isBlue ? '#F0F2F4' : '#D6CCBA',
      }}
    >
      {/* Anchor aliases for navigation links */}
      <div id="product-acquisition" className="absolute -top-16" />

      {/* Atmospheric Subtle Studio Gradient */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isBlue
            ? 'radial-gradient(ellipse 90% 70% at 50% 15%, rgba(38,52,67,0.45) 0%, rgba(20,25,31,0.95) 100%)'
            : 'radial-gradient(ellipse 90% 70% at 50% 15%, rgba(43,42,40,0.45) 0%, rgba(22,22,22,0.95) 100%)',
        }}
      />
      <div className="plate-grain absolute inset-0 pointer-events-none opacity-20" />

      <div className="relative z-10 max-w-7xl mx-auto">
        
        {/* ═══════════════════════════════════════════════════════════════
            LAYER A: EDITORIAL INTRODUCTION HEADER
            Guides the viewer's eye with confident hierarchy & generous whitespace
            ═══════════════════════════════════════════════════════════════ */}
        <header className="mb-6 sm:mb-8 md:mb-10 pb-4 sm:pb-5 border-b border-[#D6CCBA]/15 transition-colors duration-500">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-6">
            
            <div>
              {/* Micro Metadata Strip: pulled up, aligned to grid, dot on the right */}
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono-archive tracking-[0.22em] uppercase text-[#D6CCBA] -mt-1 mb-1.5">
                <span className="font-medium">ARCHIVE RUN 01 · 88 NUMBERED SETS</span>
                <span 
                  className="w-1.5 h-1.5 rounded-full inline-block shrink-0 shadow-[0_0_8px_currentColor]"
                  style={{ backgroundColor: isBlue ? '#8FA9C4' : '#FF0800' }}
                />
              </div>

              {/* Editorial Title */}
              <div className="flex items-baseline">
                <span className="font-amoresa text-3xl sm:text-4xl md:text-5xl text-[#D6CCBA] font-normal select-none leading-none mr-0.5">
                  G
                </span>
                <h2 className="font-perandory text-2xl sm:text-3xl md:text-4xl uppercase tracking-[0.14em] text-[#D6CCBA] font-light leading-none">
                  arment Archive
                </h2>
              </div>
            </div>

            {/* Sub-Headline: Clear, readable statement */}
            <div className="flex flex-col sm:items-end justify-end gap-1.5">
              <p className="font-serif-editorial italic text-base sm:text-lg md:text-xl text-[#D6CCBA] font-light tracking-tight leading-snug">
                88 sets. Two colourways. No reissue.
              </p>
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono-archive uppercase tracking-widest text-[#D6CCBA]/60">
                <span>DUBLIN STUDIO DESIGN</span>
                <span className="text-[#D6CCBA]/30">×</span>
                <span>TOTEBAG INCLUDED</span>
              </div>
            </div>

          </div>
        </header>

        {/* ═══════════════════════════════════════════════════════════════
            LAYER B: DUAL-COLOURWAY ARCHITECTURAL DIPTYCH
            BOTH COLOURWAYS FIT SIMULTANEOUSLY INSIDE ANY SCREEN!
            No inventory count shown; clean luxury presentation.
            ═══════════════════════════════════════════════════════════════ */}
        <div className="space-y-4 sm:space-y-6">
          
          {/* 2-Column Side-by-Side Colourway Pedestals */}
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:gap-8 items-stretch">
            
            {/* ────────────────── COLOURWAY 01: NOIR / CARBON ────────────────── */}
            <div 
              role="button"
              tabIndex={0}
              aria-pressed={selectedColor === 'carbon'}
              onClick={() => {
                onSelectColor('carbon');
                setPhotoIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectColor('carbon');
                  setPhotoIndex(0);
                }
              }}
              className={`group relative flex flex-col justify-between border p-3 sm:p-4 md:p-5 transition-all duration-300 cursor-pointer select-none overflow-hidden ${
                selectedColor === 'carbon'
                  ? 'border-[#D6CCBA] bg-[#2B2A28]/60 ring-1 ring-[#D6CCBA]/60 shadow-2xl'
                  : 'border-[#D6CCBA]/25 bg-[#161616]/90 hover:border-[#D6CCBA]/50 hover:bg-[#2B2A28]/40'
              }`}
            >
              {/* Top Badge Strip with High-Contrast Prominent Badges */}
              <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-mono-archive uppercase tracking-[0.16em] sm:tracking-[0.18em] text-[#D6CCBA] min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[#FF0800] shrink-0 shadow-[0_0_8px_rgba(255,8,0,0.6)]" />
                  <span className="font-semibold truncate">NOIR / CARBON</span>
                </div>
                
                {selectedColor === 'carbon' ? (
                  <span className="text-[10px] sm:text-xs font-mono-archive tracking-[0.18em] uppercase px-2.5 py-1 bg-[#D6CCBA] text-[#161616] font-bold shrink-0 shadow-lg">
                    ACTIVE
                  </span>
                ) : (
                  <span className="text-[10px] sm:text-xs font-mono-archive tracking-[0.18em] uppercase px-2.5 py-1 bg-[#242321] text-[#D6CCBA] border border-[#D6CCBA]/40 group-hover:bg-[#D6CCBA] group-hover:text-[#161616] font-semibold shrink-0 transition-colors shadow-md">
                    SELECT →
                  </span>
                )}
              </div>

              {/* Garment Image Stage: Permanent Iconic First Full-Set Picture */}
              <div 
                className="relative w-full aspect-[4/5] max-h-[380px] sm:max-h-[440px] flex items-center justify-center overflow-hidden border border-[#D6CCBA]/15 bg-[#191919] p-2.5 sm:p-3 transition-all duration-500 ease-out"
              >
                <div 
                  className="absolute inset-0 pointer-events-none opacity-45"
                  style={{
                    background: 'radial-gradient(ellipse 80% 65% at 50% 50%, #2B2A28 0%, #161616 100%)',
                  }}
                />
                <div className="plate-grain absolute inset-0 pointer-events-none opacity-20" />

                <img 
                  src="/assets/aistudio/lock_in_color_details_designs_and_stitches_from_the_second_picture_clothing_reference_only_lock_in_s_969fe8a9-6386-42e6-a2f5-55ec499a4390_ba8ec28b.png"
                  alt="Atelier NOIRÉ Archive Drop No. 01 — Heavyweight 390 GSM Loopback Cotton Fleece Tracksuit in Noir Carbon"
                  className="relative z-10 w-full h-full max-h-full filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)] group-hover:scale-[1.02] transition-transform duration-500 ease-out object-contain object-center"
                  loading="eager"
                />
              </div>

              {/* Bottom Spec Strip: Clean metadata without inventory counts */}
              <div className="mt-2 sm:mt-3 pt-2 border-t border-[#D6CCBA]/15 flex items-center justify-center sm:justify-start text-[10px] sm:text-xs font-mono-archive">
                <span className="text-[#D6CCBA] font-medium tracking-wider uppercase truncate">
                  Natural Botanical Black
                </span>
              </div>
            </div>

            {/* ────────────────── COLOURWAY 02: BLUE CHARCOAL ────────────────── */}
            <div 
              role="button"
              tabIndex={0}
              aria-pressed={selectedColor === 'blue-charcoal'}
              onClick={() => {
                onSelectColor('blue-charcoal');
                setPhotoIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectColor('blue-charcoal');
                  setPhotoIndex(0);
                }
              }}
              className={`group relative flex flex-col justify-between border p-3 sm:p-4 md:p-5 transition-all duration-300 cursor-pointer select-none overflow-hidden ${
                selectedColor === 'blue-charcoal'
                  ? 'border-[#8FA9C4] bg-[#263443]/60 ring-1 ring-[#8FA9C4]/60 shadow-2xl'
                  : 'border-[#465462]/45 bg-[#14191F]/90 hover:border-[#8FA9C4]/50 hover:bg-[#263443]/35'
              }`}
            >
              {/* Top Badge Strip with High-Contrast Prominent Badges */}
              <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-mono-archive uppercase tracking-[0.16em] sm:tracking-[0.18em] text-[#BBC6D0] min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[#8FA9C4] shrink-0 shadow-[0_0_8px_rgba(143,169,196,0.6)]" />
                  <span className="font-semibold truncate">BLUE CHARCOAL</span>
                </div>
                
                {selectedColor === 'blue-charcoal' ? (
                  <span className="text-[10px] sm:text-xs font-mono-archive tracking-[0.18em] uppercase px-2.5 py-1 bg-[#8FA9C4] text-[#111820] font-bold shrink-0 shadow-lg">
                    ACTIVE
                  </span>
                ) : (
                  <span className="text-[10px] sm:text-xs font-mono-archive tracking-[0.18em] uppercase px-2.5 py-1 bg-[#1A232E] text-[#BBC6D0] border border-[#8FA9C4]/40 group-hover:bg-[#8FA9C4] group-hover:text-[#111820] font-semibold shrink-0 transition-colors shadow-md">
                    SELECT →
                  </span>
                )}
              </div>

              {/* Garment Image Stage: Permanent Iconic First Full-Set Picture */}
              <div 
                className="relative w-full aspect-[4/5] max-h-[380px] sm:max-h-[440px] flex items-center justify-center overflow-hidden border border-[#465462]/40 bg-[#151c24] p-2.5 sm:p-3 transition-all duration-500 ease-out"
              >
                <div 
                  className="absolute inset-0 pointer-events-none opacity-40"
                  style={{
                    background: 'radial-gradient(ellipse 80% 65% at 50% 50%, #263443 0%, #14191F 100%)',
                  }}
                />
                <div className="plate-grain absolute inset-0 pointer-events-none opacity-20" />

                <img 
                  src="/assets/aistudio/2026-11-01_07_13_34.115_0600_bb8a7721.jpg"
                  alt="Atelier NOIRÉ Archive Drop No. 01 — Heavyweight 390 GSM Loopback Cotton Fleece Tracksuit in Blue Charcoal"
                  className="relative z-10 w-full h-full max-h-full filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)] group-hover:scale-[1.02] transition-transform duration-500 ease-out object-contain object-center"
                  loading="eager"
                />
              </div>

              {/* Bottom Spec Strip: Clean metadata without inventory counts */}
              <div className="mt-2 sm:mt-3 pt-2 border-t border-[#465462]/40 flex items-center justify-center sm:justify-start text-[10px] sm:text-xs font-mono-archive">
                <span className="text-[#8FA9C4] font-medium tracking-wider uppercase truncate">
                  Ethically Dyed Slate
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            DYNAMIC GRID & ASPECT-RATIO ADAPTIVE STAGE
            Showcases the selected colourway's 5 authentic perspectives
            Titles ONLY in dedicated box; uncropped photographic frame
            ═══════════════════════════════════════════════════════════════ */}
        <div className="mt-10 sm:mt-14 pt-8 sm:pt-10 border-t border-[#D6CCBA]/15">
          
          {/* Header & Perspective Selection Tabs */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono-archive tracking-[0.2em] uppercase text-[#D6CCBA]/65 mb-1.5">
                <span 
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: isBlue ? '#8FA9C4' : '#FF0800' }}
                />
                <span>PERSPECTIVE CALIBRATION</span>
                <span className="text-[#D6CCBA]/30">/</span>
                <span style={{ color: isBlue ? '#8FA9C4' : '#D6CCBA' }} className="font-semibold">
                  {theme.name} ONLY
                </span>
              </div>
              <h3 className="font-serif-editorial text-2xl sm:text-3xl text-[#D6CCBA] font-light tracking-tight">
                Adaptive Aspect Calibration
              </h3>
              <p className="font-mono-archive text-[10px] sm:text-[11px] text-[#D6CCBA]/65 tracking-wider mt-1">
                SELECT PERSPECTIVE TO INSPECT · FRAME MORPHS UNMODIFIED PROPORTIONS
              </p>
            </div>

            {/* Dynamic Perspective Tabs with clean aspect ratio labels */}
            <div className="flex flex-wrap items-center gap-2">
              {photos.map((photo, idx) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setPhotoIndex(idx)}
                  className={`px-3 py-1.5 text-xs font-mono-archive uppercase tracking-wider border transition-all duration-300 cursor-pointer ${
                    photoIndex === idx
                      ? isBlue
                        ? 'bg-[#8FA9C4] text-[#111820] border-[#8FA9C4] shadow-md font-bold'
                        : 'bg-[#D6CCBA] text-[#161616] border-[#D6CCBA] shadow-md font-bold'
                      : isBlue
                        ? 'border-[#465462]/60 text-[#BBC6D0] hover:border-[#8FA9C4] hover:text-[#F0F2F4] bg-[#14191F]/50'
                        : 'border-[#D6CCBA]/25 text-[#D6CCBA]/75 hover:border-[#D6CCBA] hover:text-white bg-[#161616]/50'
                  }`}
                >
                  <span>{idx + 1} · {photo.aspectLabel}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Fluid Morphing Dynamic Animated Frame (No Blur) */}
          <div 
            className="mx-auto transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              maxWidth: currentPhoto.maxWidth,
              width: '100%',
            }}
          >
            <div 
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleTouchStart}
              onMouseUp={handleTouchEnd}
              className="relative w-full overflow-hidden border shadow-2xl transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group cursor-grab active:cursor-grabbing select-none"
              style={{
                aspectRatio: currentPhoto.aspectRatio,
                maxHeight: '66vh',
                backgroundColor: isBlue ? '#101419' : '#141414',
                borderColor: isBlue ? '#465462' : 'rgba(214, 204, 186, 0.25)',
              }}
            >
              {/* Subtle background ambient lighting */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-40 transition-opacity duration-500"
                style={{
                  background: isBlue
                    ? 'radial-gradient(ellipse 80% 65% at 50% 50%, #263443 0%, #101419 100%)'
                    : 'radial-gradient(ellipse 80% 65% at 50% 50%, #2B2A28 0%, #141414 100%)',
                }}
              />
              <div className="plate-grain absolute inset-0 pointer-events-none opacity-20" />

              {/* The Garment Photo: 100% uncropped with object-contain */}
              <img 
                key={`${selectedColor}-${currentPhoto.id}`}
                src={currentPhoto.src}
                alt={`Atelier NOIRÉ ${theme.name} — ${currentPhoto.title} (${currentPhoto.notes})`}
                className="relative z-10 w-full h-full object-contain p-3 sm:p-5 transition-transform duration-700 ease-out group-hover:scale-[1.015]"
                loading="eager"
              />

              {/* Floating Aspect Ratio Badge (top-left) */}
              <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-2">
                <span className="px-2.5 py-1 bg-black/80 border border-[#D6CCBA]/25 text-[9px] sm:text-[10px] font-mono-archive uppercase tracking-[0.2em] text-[#D6CCBA]">
                  RATIO: {currentPhoto.aspectRatio} · {currentPhoto.aspectLabel}
                </span>
              </div>

              {/* Navigation arrows */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevPhoto();
                }}
                aria-label="Previous perspective"
                className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-black/80 hover:bg-black border border-[#D6CCBA]/30 hover:border-[#D6CCBA] text-[#D6CCBA] text-sm transition-all cursor-pointer opacity-75 group-hover:opacity-100"
              >
                ←
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextPhoto();
                }}
                aria-label="Next perspective"
                className="absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-black/80 hover:bg-black border border-[#D6CCBA]/30 hover:border-[#D6CCBA] text-[#D6CCBA] text-sm transition-all cursor-pointer opacity-75 group-hover:opacity-100"
              >
                →
              </button>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                DEDICATED TITLE BOX
                The title ONLY appears here, exactly as provided by user prompt!
                ═══════════════════════════════════════════════════════════════ */}
            <div className="mt-3 px-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left border-t border-[#D6CCBA]/15 pt-3">
              <div>
                <span 
                  className="text-xs sm:text-sm font-mono-archive uppercase tracking-[0.22em] font-semibold block" 
                  style={{ color: isBlue ? '#8FA9C4' : '#D6CCBA' }}
                >
                  {currentPhoto.title}
                </span>
                <p className="text-xs sm:text-sm font-sans leading-relaxed text-[#F0F2F4] sm:text-[#D6CCBA] font-normal mt-1 max-w-2xl">
                  {currentPhoto.notes}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] sm:text-xs font-mono-archive uppercase tracking-widest text-[#D6CCBA]/75">
                  {photoIndex + 1} OF {photos.length} PERSPECTIVES
                </span>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                SELECT SIZE & PURCHASING BOX
                Positioned right below product pictures and product descriptions
                Off-white in Noir; Contrasted rich slate blue in Blue Charcoal
                ═══════════════════════════════════════════════════════════════ */}
            <div 
              className="mt-6 border-2 p-5 sm:p-7 transition-colors duration-500 shadow-2xl relative"
              style={{
                backgroundColor: isBlue ? '#1B2A3A' : '#F5EFEB',
                borderColor: isBlue ? '#8FA9C4' : '#161616',
                color: isBlue ? '#F0F2F4' : '#161616',
                boxShadow: isBlue ? '0 25px 50px -12px rgba(10, 16, 24, 0.85)' : '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
              }}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 lg:gap-8">
                
                {/* Sizing Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                  <div className="flex items-center justify-between sm:justify-start gap-4">
                    <span 
                      className="text-xs font-mono-archive uppercase tracking-[0.2em] font-bold"
                      style={{ color: isBlue ? '#FFFFFF' : '#161616' }}
                    >
                      SELECT SIZE
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onOpenCareModal ? onOpenCareModal('sizing') : (window.location.hash = '#sizing')}
                        className="text-[11px] font-mono-archive underline underline-offset-4 cursor-pointer transition-colors font-bold"
                        style={{ color: isBlue ? '#8FA9C4' : '#161616' }}
                      >
                        SIZE CHART
                      </button>
                      <span className="opacity-40">&middot;</span>
                      <button
                        type="button"
                        onClick={() => setShowSizeCalculator(!showSizeCalculator)}
                        className="text-[11px] font-mono-archive underline underline-offset-4 cursor-pointer transition-colors font-bold"
                        style={{ color: isBlue ? '#8FA9C4' : '#161616' }}
                      >
                        {showSizeCalculator ? '✕ CLOSE CALCULATOR' : 'CALCULATOR'}
                      </button>
                    </div>
                  </div>

                  {/* Size Options */}
                  <div className="flex flex-wrap items-center gap-2">
                    {sizes.map((size) => {
                      const isClosed = size === 'S';
                      return (
                        <button
                          key={size}
                          type="button"
                          disabled={isClosed}
                          onClick={() => {
                            if (!isClosed) setSelectedSize(size);
                          }}
                          className={`h-9 px-3.5 sm:px-4 text-xs font-mono-archive font-bold tracking-wider transition-all border-2 ${
                            isClosed
                              ? isBlue
                                ? 'opacity-35 cursor-not-allowed border-[#465462]/40 text-[#BBC6D0]/40 line-through bg-[#14191F]/50'
                                : 'opacity-35 cursor-not-allowed border-[#161616]/25 text-[#161616]/40 line-through bg-black/5'
                              : selectedSize === size
                                ? isBlue
                                  ? 'bg-[#8FA9C4] text-[#111820] border-[#8FA9C4] shadow-[0_0_15px_rgba(143,169,196,0.5)] font-extrabold scale-[1.02]'
                                  : 'bg-[#161616] text-[#FFFFFF] border-[#161616] shadow-lg font-extrabold scale-[1.02]'
                                : isBlue
                                  ? 'border-[#465462] text-[#F0F2F4] hover:border-[#8FA9C4] hover:text-white bg-[#14191F]/80 cursor-pointer'
                                  : 'border-[#161616]/40 text-[#161616] hover:border-[#161616] hover:bg-white bg-white/70 cursor-pointer'
                          }`}
                          title={isClosed ? 'Size S: Archive Closed' : `Select size ${size}`}
                        >
                          {size} {isClosed && <span className="text-[9px] ml-1 uppercase font-normal tracking-normal not-italic no-underline">[ARCHIVE CLOSED]</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sizing Recommender Slideout if toggled */}
                {showSizeCalculator && (
                  <div 
                    className="p-3.5 border-2 text-xs font-sans space-y-2 animate-fadeIn w-full lg:w-auto shadow-md"
                    style={{
                      backgroundColor: isBlue ? '#141E28' : '#FFFFFF',
                      borderColor: isBlue ? '#8FA9C4' : '#161616',
                      color: isBlue ? '#F0F2F4' : '#161616',
                    }}
                  >
                    <div className="flex justify-between items-center font-mono-archive text-[11px]">
                      <span>Chest Measurement: {customChest} cm</span>
                      <span className="font-bold" style={{ color: isBlue ? '#8FA9C4' : '#161616' }}>
                        Recommended: {recommendSize(customChest) === 'S' ? 'M (S Closed)' : recommendSize(customChest)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="82"
                        max="126"
                        value={customChest}
                        onChange={(e) => setCustomChest(Number(e.target.value))}
                        className={`w-full ${isBlue ? 'accent-[#8FA9C4]' : 'accent-[#161616]'}`}
                      />
                      <button
                        type="button"
                        onClick={handleApplyRecommendedSize}
                        className="px-3.5 py-1.5 font-mono-archive uppercase text-[10px] tracking-wider border-2 cursor-pointer font-bold shrink-0 shadow-sm"
                        style={{
                          backgroundColor: isBlue ? '#8FA9C4' : '#161616',
                          color: isBlue ? '#111820' : '#FFFFFF',
                          borderColor: isBlue ? '#8FA9C4' : '#161616',
                        }}
                      >
                        Apply {recommendSize(customChest) === 'S' ? 'M' : recommendSize(customChest)}
                      </button>
                    </div>
                  </div>
                )}

                {/* Price, Wishlist Heart & Primary Acquisition CTA */}
                <div className="flex flex-col items-stretch sm:items-end gap-1.5">
                  <style>{`
                    @keyframes wishlistHeartPop {
                      0% { transform: scale(1); }
                      30% { transform: scale(1.36); }
                      60% { transform: scale(0.9); }
                      100% { transform: scale(1); }
                    }
                    @keyframes wishlistRingBurst {
                      0% { transform: scale(0.6); opacity: 0.75; }
                      100% { transform: scale(1.9); opacity: 0; }
                    }
                    .wishlist-heart-pop {
                      animation: wishlistHeartPop 0.48s cubic-bezier(0.22, 1, 0.36, 1) forwards;
                    }
                    .wishlist-ring-burst {
                      animation: wishlistRingBurst 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }
                    @media (prefers-reduced-motion: reduce) {
                      .wishlist-heart-pop,
                      .wishlist-ring-burst {
                        animation: none !important;
                      }
                    }
                  `}</style>
                  <div className="flex items-center gap-2.5 sm:gap-3 justify-between sm:justify-end w-full">
                    <div className="text-left sm:text-right hidden sm:block mr-1">
                      <span 
                        className="text-[10px] font-mono-archive uppercase tracking-widest block leading-none font-bold"
                        style={{ color: isBlue ? '#BBC6D0' : '#161616' }}
                      >
                        {theme.name} · SIZE {selectedSize}
                      </span>
                      <span 
                        className="text-xl sm:text-2xl font-serif-editorial font-bold leading-snug"
                        style={{ color: isBlue ? '#FFFFFF' : '#161616' }}
                      >
                        €{ARCHIVE_SPECS.priceEur}
                      </span>
                    </div>

                    {/* Wishlist Heart Toggle Button */}
                    <button
                      type="button"
                      onClick={handleToggleWishlist}
                      aria-pressed={isCurrentWishlisted}
                      aria-label={
                        isCurrentWishlisted
                          ? `Remove ${theme.name} Size ${selectedSize} from saved wishlist`
                          : `Save ${theme.name} Size ${selectedSize} to wishlist`
                      }
                      title={
                        isCurrentWishlisted
                          ? `Saved (${theme.name} · Size ${selectedSize})`
                          : `Save ${theme.name} · Size ${selectedSize}`
                      }
                      className={`relative px-3.5 py-3.5 border transition-all duration-300 cursor-pointer flex items-center justify-center rounded-lg ${
                        isBlue
                          ? isCurrentWishlisted
                            ? 'bg-[#263443] border-[#8FA9C4] text-[#8FA9C4]'
                            : 'bg-[#14191F] border-[#465462] text-[#BBC6D0] hover:border-[#8FA9C4]'
                          : isCurrentWishlisted
                            ? 'bg-[#161616] border-[#FF0800] text-[#FF0800]'
                            : 'bg-white border-[#161616]/25 text-[#161616] hover:border-[#161616]'
                      }`}
                    >
                      {heartPulse && (
                        <span
                          aria-hidden="true"
                          className="wishlist-ring-burst absolute inset-1 rounded-full border-2 pointer-events-none"
                          style={{ borderColor: isBlue ? '#8FA9C4' : '#FF0800' }}
                        />
                      )}
                      <svg
                        viewBox="0 0 24 24"
                        className={`w-4 h-4 sm:w-[18px] sm:h-[18px] transition-transform duration-200 ${
                          heartPulse ? 'wishlist-heart-pop' : ''
                        }`}
                        fill={isCurrentWishlisted ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth={isCurrentWishlisted ? 1.8 : 1.75}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => onAddToCart(selectedColor, selectedSize)}
                      className="flex-1 sm:flex-initial px-6 sm:px-8 py-3.5 text-xs sm:text-sm font-mono-archive uppercase tracking-[0.2em] font-bold transition-all duration-300 shadow-2xl flex items-center justify-center gap-3 cursor-pointer hover:brightness-110 active:scale-[0.99]"
                      style={{
                        backgroundColor: isBlue ? '#8FA9C4' : '#161616',
                        color: isBlue ? '#111820' : '#FFFFFF',
                      }}
                    >
                      <span>Acquire {isBlue ? 'Blue Set' : 'Noir Set'} — €{ARCHIVE_SPECS.priceEur}</span>
                      <span>→</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full">
                    {wishlist.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowSavedPanel((prev) => !prev)}
                        aria-expanded={showSavedPanel}
                        className="text-[10px] font-mono-archive uppercase tracking-[0.18em] font-bold underline underline-offset-4 cursor-pointer transition-opacity hover:opacity-80"
                        style={{ color: isBlue ? '#8FA9C4' : '#FF0800' }}
                      >
                        {showSavedPanel ? 'Hide Saved' : `Saved Variants (${wishlist.length})`}
                      </button>
                    )}
                    <p 
                      className="text-[10px] sm:text-[11px] font-mono-archive tracking-[0.16em] uppercase text-center sm:text-right font-semibold"
                      style={{ color: isBlue ? '#8FA9C4' : '#161616' }}
                    >
                      *Free delivery to all 26 counties of Ireland*
                    </p>
                  </div>

                  {/* Saved Variants Drawer/Panel */}
                  {showSavedPanel && wishlist.length > 0 && (
                    <div
                      className="w-full mt-2 p-3 sm:p-3.5 border rounded-lg text-left"
                      style={{
                        backgroundColor: isBlue ? 'rgba(20, 25, 31, 0.9)' : 'rgba(255, 255, 255, 0.92)',
                        borderColor: isBlue ? '#465462' : 'rgba(22, 22, 22, 0.16)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b" style={{ borderColor: isBlue ? 'rgba(70,84,98,0.4)' : 'rgba(22,22,22,0.1)' }}>
                        <span className="text-[10px] font-mono-archive uppercase tracking-[0.2em] font-bold" style={{ color: isBlue ? '#BBC6D0' : '#161616' }}>
                          Saved Archive Variants ({wishlist.length})
                        </span>
                      </div>
                      <ul className="space-y-1.5">
                        {wishlist.map((item) => {
                          const itemTheme = COLORWAYS[item.colorway];
                          return (
                            <li
                              key={item.id}
                              className="flex items-center justify-between gap-2 text-[11px] font-mono-archive"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectColor(item.colorway);
                                  setSelectedSize(item.size);
                                }}
                                className="text-left hover:underline cursor-pointer font-semibold"
                                style={{ color: isBlue ? '#F0F2F4' : '#161616' }}
                              >
                                {itemTheme.name} · SIZE {item.size}
                              </button>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => onAddToCart(item.colorway, item.size)}
                                  className="px-2 py-0.5 text-[10px] uppercase tracking-wider border rounded cursor-pointer"
                                  style={{
                                    borderColor: isBlue ? '#8FA9C4' : '#161616',
                                    color: isBlue ? '#8FA9C4' : '#161616',
                                  }}
                                >
                                  Add
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveWishlistItem(item.id)}
                                  aria-label={`Remove ${itemTheme.name} Size ${item.size} from saved`}
                                  className="px-1.5 py-0.5 text-[10px] opacity-65 hover:opacity-100 cursor-pointer"
                                  style={{ color: isBlue ? '#BBC6D0' : '#161616' }}
                                >
                                  ×
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>

              </div>

              {/* ═══════════════════════════════════════════════════════════════
                  SOPHISTICATED CLIENT CARE & POLICIES ACCESS DOCK
                  Only the buttons, styled with refined architectural luxury aesthetics
                  ═══════════════════════════════════════════════════════════════ */}
              <div 
                className="mt-6 pt-4 border-t flex flex-wrap items-center justify-between gap-3"
                style={{
                  borderColor: isBlue ? 'rgba(70, 84, 98, 0.45)' : 'rgba(22, 22, 22, 0.15)',
                }}
              >
                <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono-archive tracking-[0.2em] uppercase font-bold opacity-75">
                  <span 
                    className="w-1.5 h-1.5 rounded-full" 
                    style={{ backgroundColor: isBlue ? '#8FA9C4' : '#FF0800' }} 
                  />
                  <span>CLIENT CARE & POLICIES</span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onOpenCareModal ? onOpenCareModal('returns') : (window.location.hash = '#returns')}
                    className={`group px-3.5 py-2 text-[10px] sm:text-[11px] font-mono-archive uppercase tracking-[0.18em] font-bold border transition-all duration-300 cursor-pointer shadow-sm flex items-center gap-2 ${
                      isBlue
                        ? 'bg-[#14191F] text-[#F0F2F4] border-[#465462] hover:border-[#8FA9C4] hover:bg-[#8FA9C4] hover:text-[#111820]'
                        : 'bg-[#FFFFFF] text-[#161616] border-[#161616]/30 hover:border-[#161616] hover:bg-[#161616] hover:text-[#FFFFFF]'
                    }`}
                  >
                    <span>14-Day Returns & Care</span>
                    <span className="text-[10px] opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">→</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenCareModal ? onOpenCareModal('shipping') : (window.location.hash = '#shipping')}
                    className={`group px-3.5 py-2 text-[10px] sm:text-[11px] font-mono-archive uppercase tracking-[0.18em] font-bold border transition-all duration-300 cursor-pointer shadow-sm flex items-center gap-2 ${
                      isBlue
                        ? 'bg-[#14191F] text-[#F0F2F4] border-[#465462] hover:border-[#8FA9C4] hover:bg-[#8FA9C4] hover:text-[#111820]'
                        : 'bg-[#FFFFFF] text-[#161616] border-[#161616]/30 hover:border-[#161616] hover:bg-[#161616] hover:text-[#FFFFFF]'
                    }`}
                  >
                    <span>Delivery & COD</span>
                    <span className="text-[10px] opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">→</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenCareModal ? onOpenCareModal('sizing') : (window.location.hash = '#sizing')}
                    className={`group px-3.5 py-2 text-[10px] sm:text-[11px] font-mono-archive uppercase tracking-[0.18em] font-bold border transition-all duration-300 cursor-pointer shadow-sm flex items-center gap-2 ${
                      isBlue
                        ? 'bg-[#14191F] text-[#F0F2F4] border-[#465462] hover:border-[#8FA9C4] hover:bg-[#8FA9C4] hover:text-[#111820]'
                        : 'bg-[#FFFFFF] text-[#161616] border-[#161616]/30 hover:border-[#161616] hover:bg-[#161616] hover:text-[#FFFFFF]'
                    }`}
                  >
                    <span>Sizing Guide & Chart</span>
                    <span className="text-[10px] opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ═══════════════════════════════════════════════════════════════
            LAYER C: RESTRAINED ARCHIVE SPECIFICATION STRIP
            Unboxed editorial information strip with fine hairlines
            ═══════════════════════════════════════════════════════════════ */}
        <div className="mt-10 sm:mt-14 pt-8 sm:pt-10 border-t border-b border-[#D6CCBA]/15 pb-8 sm:pb-10 transition-colors duration-500">
          
          <div className="flex items-center justify-center text-[10px] sm:text-xs font-mono-archive uppercase tracking-[0.24em] text-[#D6CCBA]/80 mb-6">
            <span>STRICTLY NUMBERED</span>
          </div>

          {/* 6-Column Unboxed Specification Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 lg:gap-4 divide-y sm:divide-y-0 divide-[#D6CCBA]/10">
            
            {/* Spec 01: Top Garment */}
            <div className="pt-2 sm:pt-0 sm:pr-3 lg:border-r border-[#D6CCBA]/10">
              <span className="font-mono-archive text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-[#D6CCBA]/80 block mb-1">
                HOODIE
              </span>
              <p className="font-serif-editorial text-base sm:text-lg text-[#D6CCBA] font-medium leading-tight">
                390 GSM Fleece
              </p>
              <p className="font-sans text-xs text-[#D6CCBA] font-normal mt-1 leading-relaxed">
                Unbrushed loopback cotton with double-layer hood.
              </p>
            </div>

            {/* Spec 02: Bottom Garment */}
            <div className="pt-2 sm:pt-0 sm:pr-3 lg:border-r border-[#D6CCBA]/10">
              <span className="font-mono-archive text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-[#D6CCBA]/80 block mb-1">
                TROUSERS
              </span>
              <p className="font-serif-editorial text-base sm:text-lg text-[#D6CCBA] font-medium leading-tight">
                280 GSM Fleece
              </p>
              <p className="font-sans text-xs text-[#D6CCBA] font-normal mt-1 leading-relaxed">
                Relaxed straight drape with internal drawcord.
              </p>
            </div>

            {/* Spec 03: Allocation */}
            <div className="pt-2 sm:pt-0 sm:pr-3 lg:border-r border-[#D6CCBA]/10">
              <span className="font-mono-archive text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-[#D6CCBA]/80 block mb-1">
                TOTAL RUN
              </span>
              <p className="font-serif-editorial text-base sm:text-lg text-[#D6CCBA] font-medium leading-tight">
                88 Numbered Sets
              </p>
              <p className="font-sans text-xs text-[#D6CCBA] font-normal mt-1 leading-relaxed">
                44 Noir · 44 Blue worldwide. No reissue.
              </p>
            </div>

            {/* Spec 04: Provenance */}
            <div className="pt-2 sm:pt-0 sm:pr-3 lg:border-r border-[#D6CCBA]/10">
              <span className="font-mono-archive text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-[#D6CCBA]/80 block mb-1">
                ORIGIN
              </span>
              <p className="font-serif-editorial text-base sm:text-lg text-[#D6CCBA] font-medium leading-tight">
                Dublin × Dhaka
              </p>
              <p className="font-sans text-xs text-[#D6CCBA] font-normal mt-1 leading-relaxed">
                Patterned in Dublin, crafted in small atelier.
              </p>
            </div>

            {/* Spec 05: Presentation */}
            <div className="pt-2 sm:pt-0 sm:pr-3 lg:border-r border-[#D6CCBA]/10">
              <span className="font-mono-archive text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-[#D6CCBA]/80 block mb-1">
                PACKAGING
              </span>
              <p className="font-serif-editorial text-base sm:text-lg text-[#D6CCBA] font-medium leading-tight">
                Archival Cloth Box
              </p>
              <p className="font-sans text-xs text-[#D6CCBA] font-normal mt-1 leading-relaxed">
                Rigid black presentation box with certificate.
              </p>
            </div>

            {/* Spec 06: Inclusions */}
            <div className="pt-2 sm:pt-0">
              <span className="font-mono-archive text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-[#FF0800] block mb-1 font-semibold">
                INCLUSIONS
              </span>
              <p className="font-serif-editorial text-base sm:text-lg text-[#D6CCBA] font-medium leading-tight">
                Natural Totebag
              </p>
              <p className="font-sans text-xs text-[#D6CCBA] font-normal mt-1 leading-relaxed">
                100% natural fibre embroidered archive bag.
              </p>
            </div>

          </div>

          {/* Detailed Specifications & Statutory Care Link Bar */}
          <div className="mt-8 pt-5 border-t border-[#D6CCBA]/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-mono-archive">
            <div className="flex items-center gap-2 text-[#D6CCBA]/80">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
              <span>Full pattern measurements, fabric composition, 14-day statutory return rights & Irish courier details.</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenCareModal ? onOpenCareModal('sizing') : (window.location.hash = '#sizing')}
                className="px-3.5 py-1.5 border border-[#D6CCBA]/30 hover:border-[#D6CCBA] hover:bg-[#D6CCBA] hover:text-[#161616] text-[#D6CCBA] uppercase tracking-wider text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
              >
                Size Guide Table →
              </button>
              <button
                type="button"
                onClick={() => onOpenCareModal ? onOpenCareModal('returns') : (window.location.hash = '#returns')}
                className="px-3.5 py-1.5 border border-[#D6CCBA]/30 hover:border-[#D6CCBA] hover:bg-[#D6CCBA] hover:text-[#161616] text-[#D6CCBA] uppercase tracking-wider text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
              >
                Client Care Dossier →
              </button>
            </div>
          </div>

        </div>

        {/* ═══════════════════════════════════════════════════════════════
            LAYER D: MERGED FIT & SILHOUETTE REFERENCE (AT THE BOTTOM)
            Merged inside the garment archive box at the bottom
            ═══════════════════════════════════════════════════════════════ */}
        <div id="fit-reference" className="mt-10 sm:mt-14 pt-8 sm:pt-10 transition-colors duration-500">
          
          {/* Header & Controls */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono-archive tracking-[0.2em] uppercase text-[#D6CCBA]/65 mb-1.5">
                <span 
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: isBlue ? '#8FA9C4' : '#FF0800' }}
                />
                <span>PROPORTION & ARCHIVE PROFILE</span>
                <span className="text-[#D6CCBA]/30">/</span>
                <span className="text-[#D6CCBA]/80 uppercase">FIT REFERENCE</span>
              </div>
              <h3 className="font-serif-editorial text-2xl sm:text-3xl text-[#D6CCBA] font-light tracking-tight">
                Fit & Silhouette Reference
              </h3>
              <p className="font-mono-archive text-[10px] sm:text-[11px] text-[#D6CCBA]/65 tracking-wider mt-1">
                ACCURATE MEASUREMENTS FROM THE STUDIO LOOKBOOK RUN
              </p>
            </div>

            {/* Model Switcher & Measurement Edit Mode Toggle */}
            <div className="flex items-center gap-3">
              <div 
                className="flex items-center p-1 border rounded"
                style={{
                  backgroundColor: isBlue ? '#263443' : '#2B2A28',
                  borderColor: isBlue ? '#465462' : 'rgba(214, 204, 186, 0.25)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveGender('male')}
                  className={`px-3 sm:px-4 py-1.5 text-xs font-mono-archive uppercase tracking-wider rounded transition-colors cursor-pointer ${
                    activeGender === 'male'
                      ? isBlue
                        ? 'bg-[#14191F] text-[#F0F2F4] shadow-sm font-semibold'
                        : 'bg-[#161616] text-[#D6CCBA] shadow-sm font-semibold'
                      : 'text-[#D6CCBA]/60 hover:text-[#D6CCBA]'
                  }`}
                >
                  Male Model Fit
                </button>
                <button
                  type="button"
                  onClick={() => setActiveGender('female')}
                  className={`px-3 sm:px-4 py-1.5 text-xs font-mono-archive uppercase tracking-wider rounded transition-colors cursor-pointer ${
                    activeGender === 'female'
                      ? isBlue
                        ? 'bg-[#14191F] text-[#F0F2F4] shadow-sm font-semibold'
                        : 'bg-[#161616] text-[#D6CCBA] shadow-sm font-semibold'
                      : 'text-[#D6CCBA]/60 hover:text-[#D6CCBA]'
                  }`}
                >
                  Female Model Fit
                </button>
              </div>
            </div>
          </div>

          {/* Fit Stage Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left: Authoritative Model Fit Photograph */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="w-full flex items-center justify-between text-[10px] sm:text-[11px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/65 mb-2 pb-1 border-b border-[#D6CCBA]/15">
                <span>{currentFitModel.label}</span>
                <span className="font-semibold" style={{ color: isBlue ? '#8FA9C4' : '#D6CCBA' }}>
                  SIZE {currentFitModel.sizeWorn}
                </span>
              </div>

              <div 
                className="relative w-full aspect-[3/4] max-h-[540px] sm:max-h-[600px] border overflow-hidden flex items-center justify-center p-2 sm:p-3 shadow-2xl"
                style={{
                  backgroundColor: isBlue ? '#12171E' : '#1b1a18',
                  borderColor: isBlue ? '#465462' : 'rgba(214, 204, 186, 0.25)',
                }}
              >
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: isBlue
                      ? 'radial-gradient(ellipse 90% 70% at 50% 35%, #263443 0%, #14191F 100%)'
                      : 'radial-gradient(ellipse 90% 70% at 50% 35%, #2B2A28 0%, #161616 100%)',
                  }}
                />
                <div className="plate-grain absolute inset-0 pointer-events-none opacity-20" />

                <img 
                  key={currentFitModel.image}
                  src={currentFitModel.image} 
                  alt={`${currentFitModel.label} fit — ${currentFitModel.heightImperial} (${currentFitModel.heightCm} cm), ${currentFitModel.weightKg} kg wearing size ${currentFitModel.sizeWorn}`}
                  className="relative z-10 w-full h-full object-contain object-center filter contrast-[1.02] transition-opacity duration-500"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Right: Technical Measurements Ledger */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <span className="text-[10px] sm:text-[11px] font-mono-archive uppercase tracking-[0.2em] text-[#D6CCBA]/55 block mb-1.5">
                  AUTHENTIC MODEL SPECIFICATIONS
                </span>
                <h4 className="font-serif-editorial text-2xl sm:text-3xl font-normal text-[#D6CCBA]">
                  {currentFitModel.label}
                </h4>
                <p className="mt-2 text-xs sm:text-sm text-[#F0F2F4] sm:text-[#D6CCBA] font-normal leading-relaxed font-sans">
                  {currentFitModel.fitNotes}
                </p>
              </div>

              {/* Editable or Display Measurements Table */}
              <div 
                className="border p-5 sm:p-6 space-y-5 shadow-lg"
                style={{
                  backgroundColor: isBlue ? '#19222C' : '#222120',
                  borderColor: isBlue ? '#465462' : 'rgba(214, 204, 186, 0.2)',
                }}
              >
                {/* Row 1: Height & Weight */}
                <div className="grid grid-cols-2 gap-6 pb-4 border-b border-[#D6CCBA]/10">
                  <div>
                    <label className="text-xs font-mono-archive uppercase text-[#D6CCBA]/85 block mb-1">
                      Model Height
                    </label>
                    <span className="text-lg sm:text-xl font-serif-editorial text-[#D6CCBA]">
                      {currentFitModel.heightImperial} <span className="font-mono-archive text-xs text-[#D6CCBA]/85">({currentFitModel.heightCm} cm)</span>
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-mono-archive uppercase text-[#D6CCBA]/85 block mb-1">
                      Model Weight
                    </label>
                    <span className="text-lg sm:text-xl font-serif-editorial text-[#D6CCBA]">
                      {currentFitModel.weightKg} <span className="font-mono-archive text-xs text-[#D6CCBA]/85">kg ({currentFitModel.weightLbs} lbs)</span>
                    </span>
                  </div>
                </div>

                {/* Row 2: Chest/Bust & Waist */}
                <div className="grid grid-cols-2 gap-6 pb-4 border-b border-[#D6CCBA]/10">
                  <div>
                    <label className="text-xs font-mono-archive uppercase text-[#D6CCBA]/85 block mb-1">
                      {activeGender === 'male' ? 'Chest Circumference' : 'Bust Circumference'}
                    </label>
                    <span className="text-lg sm:text-xl font-serif-editorial text-[#D6CCBA]">
                      {currentFitModel.chestOrBustCm} <span className="font-mono-archive text-xs text-[#D6CCBA]/85">cm</span>
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-mono-archive uppercase text-[#D6CCBA]/85 block mb-1">
                      Waist Circumference
                    </label>
                    <span className="text-lg sm:text-xl font-serif-editorial text-[#D6CCBA]">
                      {currentFitModel.waistCm} <span className="font-mono-archive text-xs text-[#D6CCBA]/85">cm</span>
                    </span>
                  </div>
                </div>

                {/* Row 3: Garment Size Worn */}
                <div className="grid grid-cols-2 gap-6 items-center">
                  <div>
                    <label className="text-xs font-mono-archive uppercase text-[#D6CCBA]/85 block mb-1">
                      Garment Size Worn
                    </label>
                    <span className="text-lg sm:text-xl font-serif-editorial text-[#D6CCBA] font-bold">
                      Size {currentFitModel.sizeWorn}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs font-mono-archive text-[#D6CCBA]/85 block leading-relaxed">
                      Proportion: Architectural relaxed drape
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] font-mono-archive text-[#D6CCBA]/75 tracking-wider">
                Note: Unaltered measurements directly from the lookbook session. Never fabricated.
              </p>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
