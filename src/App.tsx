/**
 * Atelier NOIRÉ — Archive Drop
 * Editorial Storefront & Interactive Hero Sequence
 */

import React, { useEffect, useState } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Navigation } from './components/Navigation';
import { HeroSequence } from './components/HeroSequence';
import { ProductVariants } from './components/ProductVariants';
import { RedemptionDrop } from './components/RedemptionDrop';
import { CartDrawer } from './components/CartDrawer';
import { Footer } from './components/Footer';
import { PolaroidSection } from './components/PolaroidSection';
import { ArchivePreloader } from './components/ArchivePreloader';
import { CustomerCareModal, CareModalTab } from './components/CustomerCareModal';

const AdminDashboard = React.lazy(() =>
  import('./components/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);

gsap.registerPlugin(ScrollTrigger);

interface CartItem {
  colorway: 'carbon' | 'blue-charcoal';
  size: string;
  quantity: number;
}

export default function App() {
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.location.pathname.startsWith('/admin') || window.location.hash === '#admin';
  });

  const [selectedColor, setSelectedColor] = useState<'carbon' | 'blue-charcoal'>('carbon');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCareModalOpen, setIsCareModalOpen] = useState<boolean>(false);
  const [careModalTab, setCareModalTab] = useState<CareModalTab>('returns');
  const [isArchiveReady, setIsArchiveReady] = useState<boolean>(false);
  const lenisRef = React.useRef<Lenis | null>(null);

  useEffect(() => {
    const handleLocationChange = () => {
      setIsAdminRoute(window.location.pathname.startsWith('/admin') || window.location.hash === '#admin');
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Hash listener for direct deep-linking to Customer Care & Policies
  useEffect(() => {
    const handleCareHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#returns' || hash === '#cancellation') {
        setCareModalTab('returns');
        setIsCareModalOpen(true);
      } else if (hash === '#shipping' || hash === '#delivery' || hash === '#cod') {
        setCareModalTab('shipping');
        setIsCareModalOpen(true);
      } else if (hash === '#size-guide' || hash === '#sizing' || hash === '#sizes') {
        setCareModalTab('sizing');
        setIsCareModalOpen(true);
      } else if (hash === '#care' || hash === '#garment-care') {
        setCareModalTab('care');
        setIsCareModalOpen(true);
      } else if (hash === '#privacy' || hash === '#gdpr') {
        setCareModalTab('privacy');
        setIsCareModalOpen(true);
      } else if (hash === '#contact' || hash === '#support' || hash === '#concierge') {
        setCareModalTab('contact');
        setIsCareModalOpen(true);
      }
    };

    window.addEventListener('hashchange', handleCareHash);
    handleCareHash();
    return () => window.removeEventListener('hashchange', handleCareHash);
  }, []);

  // Disable background scrolling while inside acquisition dossier or client care modal
  useEffect(() => {
    if (isCartOpen || isCareModalOpen) {
      lenisRef.current?.stop();
      document.body.style.overflow = 'hidden';
    } else if (isArchiveReady) {
      lenisRef.current?.start();
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
  }, [isCartOpen, isCareModalOpen, isArchiveReady]);

  useEffect(() => {
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReducedMotion || isAdminRoute) return;

    // Mobile & Touch Device Optimization:
    // ignoreMobileResize prevents aggressive pin recalibration on mobile URL bar collapse/expand
    ScrollTrigger.config({
      ignoreMobileResize: true,
      autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load,resize',
    });

    const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

    const lenis = new Lenis({
      duration: isTouch ? 0.9 : 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.1,
      syncTouch: false, // Ensures natural non-blocking touch scroll momentum on mobile
    });

    lenisRef.current = lenis;

    // Lock Lenis while archive preloader is active
    if (!isArchiveReady) {
      lenis.stop();
    }

    lenis.on('scroll', ScrollTrigger.update);

    const updateRaf = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(updateRaf);
    gsap.ticker.lagSmoothing(0);

    // High-latency mobile network resilience:
    // Ensure triggers recalculate once deferred webfonts & media assets resolve
    const handleDeferredRefresh = () => {
      ScrollTrigger.refresh();
    };

    window.addEventListener('load', handleDeferredRefresh);
    if (document.fonts) {
      document.fonts.ready.then(() => {
        ScrollTrigger.refresh();
      }).catch(() => null);
    }

    let orientationTimer: NodeJS.Timeout;
    const handleOrientation = () => {
      clearTimeout(orientationTimer);
      orientationTimer = setTimeout(() => {
        ScrollTrigger.refresh();
      }, 250);
    };
    window.addEventListener('orientationchange', handleOrientation);

    return () => {
      window.removeEventListener('load', handleDeferredRefresh);
      window.removeEventListener('orientationchange', handleOrientation);
      clearTimeout(orientationTimer);
      gsap.ticker.remove(updateRaf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const handleAddToCart = (colorway: 'carbon' | 'blue-charcoal', size: string) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.colorway === colorway && i.size === size);
      if (existing) {
        return prev.map((i) =>
          i.colorway === colorway && i.size === size ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { colorway, size, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const handleRemoveCartItem = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateQuantity = (index: number, quantity: number) => {
    setCartItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity } : item))
    );
  };

  const handlePreloaderComplete = () => {
    setIsArchiveReady(true);
    if (lenisRef.current) {
      lenisRef.current.start();
    }
    // Staggered multi-phase refresh passes guarantee pin accuracy even across high-latency networks
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      setTimeout(() => ScrollTrigger.refresh(), 200);
      setTimeout(() => ScrollTrigger.refresh(), 750);
    });
  };

  const handleOpenCareModal = (tab: CareModalTab = 'returns') => {
    setCareModalTab(tab);
    setIsCareModalOpen(true);
  };

  const handleCloseCareModal = () => {
    setIsCareModalOpen(false);
    const careHashes = [
      '#returns', '#cancellation', '#shipping', '#delivery', 
      '#cod', '#size-guide', '#sizing', '#sizes', '#care', 
      '#garment-care', '#privacy', '#gdpr', '#contact', '#support', '#concierge'
    ];
    if (careHashes.includes(window.location.hash.toLowerCase())) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  if (isAdminRoute) {
    return (
      <React.Suspense fallback={<div className="min-h-screen bg-[#161616]" />}>
        <AdminDashboard />
      </React.Suspense>
    );
  }

  return (
    <div id="top" className="min-h-screen bg-[#161616] text-[#D6CCBA] font-sans antialiased selection:bg-[#FF0800] selection:text-white">
      {/* Archive Preloader Gate: Guarantees 100% asset readiness & audio gesture unlock */}
      {!isArchiveReady && (
        <ArchivePreloader onComplete={handlePreloaderComplete} />
      )}

      {/* 3-Zone Luxury Architectural Navigation */}
      <Navigation 
        onOpenCart={() => setIsCartOpen(true)} 
        cartCount={totalCartCount} 
        activeColorway={selectedColor}
      />

      {/* Main Editorial Experience */}
      <main>
        {/* Core Animated Hero Sequence (Forma T1 interaction principle, Extenda rising typography, uncropped figure & 2-colourway horizontal slide) */}
        <HeroSequence 
          isReady={isArchiveReady} 
          activeColorway={selectedColor}
          onSelectColorway={setSelectedColor}
        />

        {/* Chapter 03: Editorial Garment Archive & Acquisition Catalogue (Layers A, B, C & Merged Fit Reference at bottom) */}
        <ProductVariants
          selectedColor={selectedColor}
          onSelectColor={setSelectedColor}
          onAddToCart={handleAddToCart}
          onOpenCareModal={handleOpenCareModal}
        />

        {/* Tactile Commemorative Polaroid Section — with zero external text below lookbook measurements note */}
        <PolaroidSection />

        {/* Confidential Locked Vault: Redemption Drop® (Stark white, permanently super blurry prototype, bold monochrome typography) */}
        <RedemptionDrop />
      </main>

      {/* Checkout / Reservation Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onRemoveItem={handleRemoveCartItem}
        onUpdateQuantity={handleUpdateQuantity}
        onAddToCart={handleAddToCart}
        onClearCart={() => setCartItems([])}
        onOpenCareModal={handleOpenCareModal}
      />

      {/* Footnote & Heritage Statement with accessible policy links */}
      <Footer onOpenCareModal={handleOpenCareModal} />

      {/* Dedicated Customer Care & Statutory Rights Dossier Modal */}
      <CustomerCareModal 
        isOpen={isCareModalOpen} 
        onClose={handleCloseCareModal} 
        initialTab={careModalTab} 
      />
    </div>
  );
}
