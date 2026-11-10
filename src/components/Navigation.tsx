import React, { useEffect, useState, useRef } from 'react';
import './Navigation.css';

declare global {
  interface Window {
    NoireHeader?: {
      setSelectionCount: (count: number) => void;
      openSelection: () => void;
      closeSelection: () => void;
    };
  }
}

interface NavigationProps {
  onOpenCart: () => void;
  cartCount: number;
  activeColorway?: 'carbon' | 'blue-charcoal';
}

export const Navigation: React.FC<NavigationProps> = ({ 
  onOpenCart, 
  cartCount,
  activeColorway = 'carbon'
}) => {
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const headerRef = useRef<HTMLElement>(null);
  const selectionTriggerRef = useRef<HTMLButtonElement>(null);

  // 1. Scroll Lock & "®" Reveal Handler
  useEffect(() => {
    const SCROLL_THRESHOLD = 24;
    let ticking = false;

    const syncScrollState = () => {
      const shouldLock = window.scrollY > SCROLL_THRESHOLD;
      setIsScrolled(shouldLock);
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(syncScrollState);
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    syncScrollState();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // 2. Expose Public API Hook on window.NoireHeader
  useEffect(() => {
    window.NoireHeader = {
      setSelectionCount: (_count: number) => {
        // Controlled by React cartCount prop
      },
      openSelection: () => onOpenCart(),
      closeSelection: () => {},
    };

    return () => {
      delete window.NoireHeader;
    };
  }, [onOpenCart]);

  const formattedCount = String(Math.max(0, cartCount || 0)).padStart(2, '0');

  return (
    <header 
      id="noire-header" 
      ref={headerRef}
      className="noire-header" 
      data-scrolled={isScrolled ? "true" : "false"} 
      data-selection-open="false"
      role="banner"
    >
      <div className="noire-header__grid">
        
        {/* ZONE 01: IDENTITY LOCKUP (Asymmetric Left Pole — 5 Columns) */}
        <div className="noire-header__zone noire-header__zone--identity">
          <a href="#top" className="noire-brand" aria-label="ATELIER NOIRÉ — Ireland Home">
            
            {/* Official Angular Emblem PNG (Supplied Mark) */}
            <span className="noire-brand__emblem-wrap" aria-hidden="true">
              <img 
                src="/assets/aistudio/edited-image-1793638399_e3642094.png" 
                alt="NOIRÉ emblem" 
                className="noire-brand__emblem object-contain"
                loading="eager"
              />
            </span>

            {/* Wordmark + Scroll-Revealed Registered Trademark (®) */}
            <span className="noire-brand__wordmark">
              <span className="noire-brand__atelier">ATELIER</span>
              <span className="noire-brand__noire">
                NOIRÉ<sup className="noire-brand__reg" aria-hidden="true">®</sup>
              </span>
            </span>
          </a>
        </div>

        {/* ZONE 02: IRISH PROVENANCE DATUM & PRESERVED ROUTES (Asymmetric Center-Right — 4 Columns) */}
        <div className="noire-header__zone noire-header__zone--datum" aria-label="Brand Origin and Edition">
          {/* Preserved editorial navigation routes */}
          <nav className="noire-routes" aria-label="Storefront primary navigation">
            <a href="#hero-stage" className="noire-route-link">Archive Drop</a>
            <a href="#ledger" className="noire-route-link">Garment Archive</a>
            <a href="#fit-reference" className="noire-route-link">Fit & Silhouette</a>
            <a href="#returns" className="noire-route-link">Care & Returns</a>
          </nav>

          {/* Irish Provenance Datum */}
          <div className="noire-datum">
            <span className="noire-datum__indicator" aria-hidden="true"></span>
            <span className="noire-datum__label">ORIGIN</span>
            <span className="noire-datum__divider" aria-hidden="true">/</span>
            <span className="noire-datum__value">IRELAND — IE (EUR €)</span>
          </div>
        </div>

        {/* ZONE 03: SELECTION UTILITY (Far Right Pole — 3 Columns) */}
        <div className="noire-header__zone noire-header__zone--utility">
          <button 
            type="button" 
            id="noire-selection-trigger"
            ref={selectionTriggerRef}
            className="noire-selection-btn" 
            aria-label={`View Acquisition Selection (${cartCount} items)`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenCart();
            }}
          >
            <span className="noire-selection-btn__text-track">
              <span className="noire-selection-btn__primary">SELECTION</span>
              <span className="noire-selection-btn__secondary" aria-hidden="true">ACQUISITION</span>
            </span>
            <span 
              className="noire-selection-btn__counter" 
              id="noire-selection-count" 
              data-count={cartCount}
            >
              [ {formattedCount} ]
            </span>
          </button>
        </div>

      </div>

      {/* MODERATELY THIN ARCHITECTURAL BOTTOM BAR */}
      <div className="noire-header__bottom-bar" aria-hidden="true">
        <span className="noire-header__bar-accent"></span>
      </div>
    </header>
  );
};
