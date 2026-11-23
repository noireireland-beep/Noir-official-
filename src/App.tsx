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
import {
  CartDrawer,
  type CompletedOrderData,
  type StripeReturnState,
} from './components/CartDrawer';
import { Footer } from './components/Footer';
import { PolaroidSection } from './components/PolaroidSection';
import { ArchivePreloader } from './components/ArchivePreloader';
import { CustomerCareModal, CareModalTab } from './components/CustomerCareModal';
import {
  computeArchiveTargetScrollY,
  computeStoryReplayScrollY,
} from './utils/mobileStoryNavigation';
import {
  ArchiveGuardState,
  INITIAL_ARCHIVE_GUARD_STATE,
  computeArchiveLandmarks,
  evaluateArchiveScrollGuard,
} from './utils/archiveScrollGuard';

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
  const [isCartOpen, setIsCartOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const s = new URLSearchParams(window.location.search).get('stripe_status');
    return s === 'success' || s === 'cancelled';
  });
  const [isCareModalOpen, setIsCareModalOpen] = useState<boolean>(false);
  const [careModalTab, setCareModalTab] = useState<CareModalTab>('returns');
  const [isArchiveReady, setIsArchiveReady] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const s = new URLSearchParams(window.location.search).get('stripe_status');
    return s === 'success' || s === 'cancelled';
  });
  const [stripeReturnState, setStripeReturnState] = useState<StripeReturnState | null>(null);
  const [transitionLabel, setTransitionLabel] = useState<string>('ENTERING ARCHIVE');
  const isArchiveReadyRef = React.useRef<boolean>(isArchiveReady);
  const lenisRef = React.useRef<Lenis | null>(null);
  const transitionCurtainRef = React.useRef<HTMLDivElement | null>(null);
  const isStoryTransitioningRef = React.useRef<boolean>(false);
  const archiveGuardStateRef = React.useRef<ArchiveGuardState>({ ...INITIAL_ARCHIVE_GUARD_STATE });
  const prevScrollYRef = React.useRef<number>(0);
  const lastNativeScrollTimeRef = React.useRef<number>(0);
  const isGuardSettlingRef = React.useRef<boolean>(false);
  const guardUnlockTimerRef = React.useRef<number | null>(null);
  const isModalOpenRef = React.useRef<boolean>(false);

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

  // Verify or release pending Stripe Checkout returns (?stripe_status=success|cancelled)
  useEffect(() => {
    if (typeof window === 'undefined' || isAdminRoute) return;

    const params = new URLSearchParams(window.location.search);
    const stripeStatus = params.get('stripe_status');
    if (stripeStatus !== 'success' && stripeStatus !== 'cancelled') return;

    const sessionId = (params.get('session_id') || '').trim();
    const orderRef = (params.get('order_ref') || '').trim();

    let cancelled = false;
    setIsCartOpen(true);

    const cleanStripeQueryParams = () => {
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.delete('stripe_status');
      nextParams.delete('session_id');
      nextParams.delete('order_ref');
      const nextSearch = nextParams.toString();
      const cleanUrl =
        window.location.pathname +
        (nextSearch ? `?${nextSearch}` : '') +
        window.location.hash;
      window.history.replaceState(null, '', cleanUrl);
    };

    const PENDING_STORAGE_KEY = 'noire_pending_stripe_checkout';

    const run = async () => {
      if (stripeStatus === 'success') {
        if (!sessionId) {
          if (!cancelled) {
            setStripeReturnState({
              status: 'error',
              message:
                'Stripe session identifier was missing on return. Please contact concierge@noireofficial.ie with your reference if a payment was completed.',
            });
            cleanStripeQueryParams();
          }
          return;
        }

        setStripeReturnState({ status: 'verifying' });
        try {
          const res = await fetch('/api/stripe/verify-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              orderReference: orderRef || undefined,
            }),
          });
          const data = (await res.json()) as {
            success?: boolean;
            paid?: boolean;
            order?: CompletedOrderData;
            error?: string;
          };

          if (cancelled) return;

          if (res.ok && data.success && data.paid && data.order) {
            try {
              window.sessionStorage.removeItem(PENDING_STORAGE_KEY);
            } catch {
              // Ignore storage restrictions
            }
            setCartItems([]);
            setStripeReturnState({ status: 'paid', order: data.order });
          } else {
            setStripeReturnState({
              status: 'error',
              message:
                data.error ||
                'Payment verification could not be confirmed yet. If you closed checkout before paying, zero charge was taken.',
            });
          }
        } catch {
          if (!cancelled) {
            setStripeReturnState({
              status: 'error',
              message:
                'Unable to reach the Atelier NOIRÉ registry to verify your Stripe session. Please refresh or contact concierge@noireofficial.ie.',
            });
          }
        } finally {
          if (!cancelled) {
            cleanStripeQueryParams();
          }
        }
        return;
      }

      // stripeStatus === 'cancelled'
      let fallbackSessionId = sessionId;
      let fallbackOrderRef = orderRef;

      try {
        const rawPending = window.sessionStorage.getItem(PENDING_STORAGE_KEY);
        if (rawPending) {
          const parsed = JSON.parse(rawPending) as {
            orderReference?: string;
            stripeSessionId?: string;
            items?: CartItem[];
          };
          if (!fallbackOrderRef && parsed.orderReference) {
            fallbackOrderRef = parsed.orderReference;
          }
          if (!fallbackSessionId && parsed.stripeSessionId) {
            fallbackSessionId = parsed.stripeSessionId;
          }
          if (Array.isArray(parsed.items) && parsed.items.length > 0) {
            setCartItems((prev) => (prev.length === 0 ? parsed.items! : prev));
          }
          window.sessionStorage.removeItem(PENDING_STORAGE_KEY);
        }
      } catch {
        // Ignore storage errors
      }

      try {
        if (fallbackSessionId || fallbackOrderRef) {
          const res = await fetch('/api/stripe/cancel-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: fallbackSessionId || undefined,
              orderReference: fallbackOrderRef || undefined,
            }),
          });
          const data = (await res.json()) as {
            alreadyPaid?: boolean;
            order?: CompletedOrderData;
          };

          if (cancelled) return;

          if (res.status === 409 && data.alreadyPaid && data.order) {
            setCartItems([]);
            setStripeReturnState({ status: 'paid', order: data.order });
            return;
          }
        }

        if (!cancelled) {
          setStripeReturnState({
            status: 'cancelled',
            message:
              'Stripe Checkout was cancelled — zero charge was taken and your inventory reservation has been released. You may retry Card / Express Pay or select Cash on Delivery below.',
          });
        }
      } catch {
        if (!cancelled) {
          setStripeReturnState({
            status: 'cancelled',
            message:
              'Stripe Checkout was cancelled before payment. You may retry Card / Express Pay or select Cash on Delivery below.',
          });
        }
      } finally {
        if (!cancelled) {
          cleanStripeQueryParams();
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isAdminRoute]);

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
    isModalOpenRef.current = isCartOpen || isCareModalOpen;
    if (isAdminRoute) return;

    if (isCartOpen || isCareModalOpen) {
      lenisRef.current?.stop();
      document.body.style.overflow = 'hidden';
    } else if (isArchiveReady) {
      lenisRef.current?.start();
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
  }, [isAdminRoute, isCartOpen, isCareModalOpen, isArchiveReady]);

  useEffect(() => {
    if (isAdminRoute) {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      return;
    }

    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReducedMotion) return;

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
      virtualScroll: () => !isGuardSettlingRef.current,
    });

    lenisRef.current = lenis;

    // Lock Lenis while archive preloader is active
    if (!isArchiveReadyRef.current) {
      lenis.stop();
    } else {
      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
      });
    }

    const getLiveArchiveLandmarks = () => {
      const ledgerEl = document.getElementById('ledger');
      const purchasingEl = document.getElementById('purchasing-box') || ledgerEl;
      if (!ledgerEl || !purchasingEl) return null;
      const headerEl = document.getElementById('noire-header');
      const headerHeight = headerEl ? Math.round(headerEl.getBoundingClientRect().height) : 76;
      const ledgerRect = ledgerEl.getBoundingClientRect();
      const purchasingRect = purchasingEl.getBoundingClientRect();

      return computeArchiveLandmarks({
        ledgerTopRect: ledgerRect.top,
        purchasingTopRect: purchasingRect.top,
        purchasingBottomRect: purchasingRect.bottom,
        currentScrollY: window.scrollY,
        viewportHeight: window.innerHeight,
        headerHeight,
      });
    };

    const settleScrollToLandmark = (targetY: number) => {
      isGuardSettlingRef.current = true;
      prevScrollYRef.current = targetY;

      if (guardUnlockTimerRef.current !== null) {
        window.clearTimeout(guardUnlockTimerRef.current);
      }

      const shouldArrestMobileMomentum = isTouch && window.innerWidth < 768;
      if (shouldArrestMobileMomentum) {
        document.body.style.overflow = 'hidden';
      }

      const releaseGuard = () => {
        if (guardUnlockTimerRef.current !== null) {
          window.clearTimeout(guardUnlockTimerRef.current);
          guardUnlockTimerRef.current = null;
        }
        if (shouldArrestMobileMomentum && !isModalOpenRef.current) {
          document.body.style.overflow = '';
        }
        prevScrollYRef.current = window.scrollY;
        isGuardSettlingRef.current = false;
      };

      guardUnlockTimerRef.current = window.setTimeout(releaseGuard, 580);

      lenis.scrollTo(targetY, {
        duration: 0.46,
        lock: true,
        force: true,
        userData: { archiveGuard: true },
        onComplete: () => {
          window.setTimeout(releaseGuard, 90);
        },
      });
    };

    prevScrollYRef.current = window.scrollY;
    lastNativeScrollTimeRef.current = performance.now();

    lenis.on('scroll', (instance) => {
      ScrollTrigger.update();

      if (
        !isArchiveReadyRef.current ||
        isModalOpenRef.current ||
        isStoryTransitioningRef.current
      ) {
        prevScrollYRef.current = instance.animatedScroll;
        lastNativeScrollTimeRef.current = performance.now();
        return;
      }

      if (isGuardSettlingRef.current) {
        prevScrollYRef.current = instance.animatedScroll;
        lastNativeScrollTimeRef.current = performance.now();
        return;
      }

      const now = performance.now();
      const dtFrames = Math.max(1, (now - lastNativeScrollTimeRef.current) / 16.67);
      lastNativeScrollTimeRef.current = now;

      const landmarks = getLiveArchiveLandmarks();
      if (!landmarks) {
        prevScrollYRef.current = instance.animatedScroll;
        return;
      }

      const rawStep = instance.animatedScroll - prevScrollYRef.current;
      const effectiveVelocity =
        Math.abs(instance.velocity) >= Math.abs(rawStep / dtFrames)
          ? instance.velocity
          : rawStep / dtFrames;

      const decision = evaluateArchiveScrollGuard({
        prevY: prevScrollYRef.current,
        currentY: instance.animatedScroll,
        projectedTargetY: instance.targetScroll,
        velocityPx: effectiveVelocity,
        landmarks,
        state: archiveGuardStateRef.current,
      });

      archiveGuardStateRef.current = decision.nextState;
      prevScrollYRef.current = instance.animatedScroll;

      if (decision.shouldCatch) {
        settleScrollToLandmark(decision.targetY);
      }
    });

    const handleHashLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      const id = href.slice(1);
      const destEl = document.getElementById(id);
      if (!destEl) return;

      e.preventDefault();
      isGuardSettlingRef.current = true;
      if (guardUnlockTimerRef.current !== null) {
        window.clearTimeout(guardUnlockTimerRef.current);
      }
      if (id === 'ledger' || id === 'product-acquisition') {
        archiveGuardStateRef.current.caughtEntry = true;
      } else if (id === 'fit-reference') {
        archiveGuardStateRef.current.caughtEntry = true;
        archiveGuardStateRef.current.caughtPurchasing = true;
      } else if (id === 'hero-stage' || id === 'top') {
        archiveGuardStateRef.current = { ...INITIAL_ARCHIVE_GUARD_STATE };
      }

      const headerEl = document.getElementById('noire-header');
      const headerHeight = headerEl ? Math.round(headerEl.getBoundingClientRect().height) : 76;
      const destY = id === 'top' || id === 'hero-stage'
        ? 0
        : Math.max(0, Math.round(destEl.getBoundingClientRect().top + window.scrollY - headerHeight));

      lenis.scrollTo(destY, {
        duration: 0.65,
        lock: true,
        force: true,
        userData: { archiveGuard: true },
        onComplete: () => {
          prevScrollYRef.current = window.scrollY;
          isGuardSettlingRef.current = false;
        },
      });
      guardUnlockTimerRef.current = window.setTimeout(() => {
        prevScrollYRef.current = window.scrollY;
        isGuardSettlingRef.current = false;
      }, 750);
    };
    document.addEventListener('click', handleHashLinkClick);

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

    let orientationTimer: ReturnType<typeof setTimeout>;
    const handleOrientation = () => {
      clearTimeout(orientationTimer);
      orientationTimer = setTimeout(() => {
        ScrollTrigger.refresh();
      }, 250);
    };
    window.addEventListener('orientationchange', handleOrientation);

    return () => {
      document.removeEventListener('click', handleHashLinkClick);
      window.removeEventListener('load', handleDeferredRefresh);
      window.removeEventListener('orientationchange', handleOrientation);
      clearTimeout(orientationTimer);
      if (guardUnlockTimerRef.current !== null) {
        window.clearTimeout(guardUnlockTimerRef.current);
        guardUnlockTimerRef.current = null;
      }
      gsap.ticker.remove(updateRaf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [isAdminRoute]);

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const handleAddToCart = (colorway: 'carbon' | 'blue-charcoal', size: string) => {
    if (size === 'S') return;
    setCartItems((prev) => {
      const existing = prev.find((i) => i.colorway === colorway && i.size === size);
      if (existing) {
        return prev.map((i) =>
          i.colorway === colorway && i.size === size
            ? { ...i, quantity: Math.min(5, i.quantity + 1) }
            : i
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
    const clamped = Math.max(1, Math.min(5, quantity));
    setCartItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity: clamped } : item))
    );
  };

  const handlePreloaderComplete = React.useCallback(() => {
    isArchiveReadyRef.current = true;
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
  }, []);

  const runAnimatedSectionJump = React.useCallback((mode: 'to-archive' | 'to-story') => {
    if (isStoryTransitioningRef.current) return;

    const resolveTargetY = (): number => {
      if (mode === 'to-archive') {
        const ledgerEl = document.getElementById('ledger');
        if (!ledgerEl) return window.scrollY;
        const headerEl = document.getElementById('noire-header');
        const headerHeight = headerEl ? Math.round(headerEl.getBoundingClientRect().height) : 72;
        return computeArchiveTargetScrollY({
          ledgerTop: ledgerEl.getBoundingClientRect().top,
          currentScrollY: window.scrollY,
          headerHeight,
        });
      }

      const heroTrigger = ScrollTrigger.getById('hero-story');
      return computeStoryReplayScrollY({
        storyStart: heroTrigger?.start ?? 0,
        storyEnd: heroTrigger?.end ?? 0,
      });
    };

    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const curtain = transitionCurtainRef.current;

    if (isReducedMotion || !curtain) {
      window.dispatchEvent(new CustomEvent(mode === 'to-archive' ? 'noire:skip-story' : 'noire:replay-story'));
      const targetY = resolveTargetY();
      window.scrollTo(0, targetY);
      lenisRef.current?.scrollTo(targetY, { immediate: true, force: true });
      ScrollTrigger.update();
      return;
    }

    isStoryTransitioningRef.current = true;
    setTransitionLabel(mode === 'to-archive' ? 'GARMENT ARCHIVE' : 'ARCHIVE STORYTELLING');
    lenisRef.current?.stop();

    gsap.killTweensOf(curtain);
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(curtain, { display: 'none' });
        lenisRef.current?.start();
        isStoryTransitioningRef.current = false;
      },
    });

    tl.set(curtain, { display: 'flex', yPercent: 100, opacity: 1 })
      .to(curtain, {
        yPercent: 0,
        duration: 0.34,
        ease: 'power3.inOut',
      })
      .add(() => {
        window.dispatchEvent(new CustomEvent(mode === 'to-archive' ? 'noire:skip-story' : 'noire:replay-story'));
        const targetY = resolveTargetY();
        window.scrollTo(0, targetY);
        lenisRef.current?.scrollTo(targetY, { immediate: true, force: true });
        ScrollTrigger.refresh();
        ScrollTrigger.update();
      })
      .to(curtain, {
        yPercent: -100,
        duration: 0.44,
        delay: 0.08,
        ease: 'power3.out',
      });
  }, []);

  const handleSkipStory = React.useCallback(() => {
    archiveGuardStateRef.current.caughtEntry = true;
    runAnimatedSectionJump('to-archive');
  }, [runAnimatedSectionJump]);

  const handleReplayStory = React.useCallback(() => {
    archiveGuardStateRef.current = { ...INITIAL_ARCHIVE_GUARD_STATE };
    runAnimatedSectionJump('to-story');
  }, [runAnimatedSectionJump]);

  const handleFastExitToArchive = React.useCallback(() => {
    const ledgerEl = document.getElementById('ledger');
    if (!ledgerEl) return;
    const headerEl = document.getElementById('noire-header');
    const headerHeight = headerEl ? Math.round(headerEl.getBoundingClientRect().height) : 76;
    const targetY = computeArchiveTargetScrollY({
      ledgerTop: ledgerEl.getBoundingClientRect().top,
      currentScrollY: window.scrollY,
      headerHeight,
    });

    archiveGuardStateRef.current.caughtEntry = true;
    isGuardSettlingRef.current = true;
    prevScrollYRef.current = targetY;

    if (guardUnlockTimerRef.current !== null) {
      window.clearTimeout(guardUnlockTimerRef.current);
    }

    if (lenisRef.current) {
      lenisRef.current.scrollTo(targetY, {
        duration: 0.48,
        lock: true,
        force: true,
        userData: { archiveGuard: true },
        onComplete: () => {
          prevScrollYRef.current = window.scrollY;
          isGuardSettlingRef.current = false;
        },
      });
    } else {
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    }

    guardUnlockTimerRef.current = window.setTimeout(() => {
      prevScrollYRef.current = window.scrollY;
      isGuardSettlingRef.current = false;
    }, 580);
  }, []);

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

      {/* Animated Mobile Story Skip / Replay Editorial Curtain */}
      <div
        ref={transitionCurtainRef}
        aria-hidden="true"
        className="fixed inset-0 z-[75] hidden flex-col items-center justify-center bg-[#161616] px-6 text-center pointer-events-none select-none will-change-transform"
        style={{ display: 'none' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 45%, #2B2A28 0%, #161616 78%)',
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-2.5">
          <span className="text-[10px] font-mono-archive tracking-[0.28em] uppercase text-[#D6CCBA]/60">
            ATELIER NOIRÉ
          </span>
          <span className="font-serif-editorial text-2xl tracking-[0.06em] text-[#FFFFFF]">
            {transitionLabel}
          </span>
          <span className="w-12 h-px bg-[#D6CCBA]/45 mt-1" />
        </div>
      </div>

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
          onSkipStory={handleSkipStory}
          onFastExitToArchive={handleFastExitToArchive}
        />

        {/* Chapter 03: Editorial Garment Archive & Acquisition Catalogue (Layers A, B, C & Merged Fit Reference at bottom) */}
        <ProductVariants
          selectedColor={selectedColor}
          onSelectColor={setSelectedColor}
          onAddToCart={handleAddToCart}
          onOpenCareModal={handleOpenCareModal}
          onReplayStory={handleReplayStory}
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
        stripeReturnState={stripeReturnState}
        onDismissStripeReturn={() => setStripeReturnState(null)}
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
