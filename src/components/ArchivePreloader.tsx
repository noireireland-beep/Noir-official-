import React, { useEffect, useState, useRef } from 'react';
import { gsap } from 'gsap';
import { computePreloadPercent } from '../utils/archiveAccess';
// Passkey wall ('shrek0shamrock67' in ../utils/archiveAccess) is cleanly decoupled so visitors land directly on the storefront after loading.
// import { Eye, EyeOff, ArrowRight, Lock, Check } from 'lucide-react';
// import { validatePasskeyAttempt } from '../utils/archiveAccess';

interface ArchivePreloaderProps {
  onComplete: () => void;
}

interface AssetItem {
  name: string;
  type: 'font' | 'image' | 'video';
  url?: string;
}

const CRITICAL_ASSETS: AssetItem[] = [
  { name: 'Editorial Typography', type: 'font' },
  { name: 'Official Brand Logo', type: 'image', url: '/assets/aistudio/edited-image-1793305524_ccd04284.png' },
  { name: 'Insignia Crest Mark', type: 'image', url: '/assets/aistudio/1789932307313_2-removebg-preview_9526016f.png' },
  { name: 'Hero Figure · Carbon Noir', type: 'image', url: '/assets/aistudio/background-removed-background-removed-2026-10-24_00_30_49.918_0600-standard_4-standard_315b0c80.png' },
  { name: 'Hero Figure · Blue Charcoal', type: 'image', url: '/assets/aistudio/background-removed-_MG_5014-standard_3c5997f5.png' },
  // Authentic Storytelling Imagery
  { name: 'Archive Label · Ireland/Bangladesh', type: 'image', url: '/assets/aistudio/_MG_5274_8b478bc1.jpg' },
  { name: 'Archive Provenance · Cards & Tags', type: 'image', url: '/assets/aistudio/_MG_5275_04a313a8.jpg' },
  { name: 'Craftsmanship Atelier Studio', type: 'image', url: '/assets/aistudio/5b393e9daa0a854de1cc57b5af6d74bd_d11b779b.jpg' },
  { name: 'Archival Box Presentation', type: 'image', url: '/assets/aistudio/edited-image-1793638399_e3642094.png' },
  { name: 'Authentic Certificate of Origin', type: 'image', url: '/assets/aistudio/edited-image-1793723014_126eaedc.png' },
  // All 8 Noir / Carbon Catalogue Assets
  { name: 'Noir 01 · Top View Set', type: 'image', url: '/assets/aistudio/lock_in_color_details_designs_and_stitches_from_the_second_picture_clothing_reference_only_lock_in_s_969fe8a9-6386-42e6-a2f5-55ec499a4390_ba8ec28b.png' },
  { name: 'Noir 02 · Horizontal Crop', type: 'image', url: '/assets/aistudio/file_00000000522482118f9873bb62d7e5de_3_f98f2c97.jpg' },
  { name: 'Noir 03 · Back View M Hoodie', type: 'image', url: '/assets/aistudio/2026-11-01_07_20_57.782_0600_c236c75e.jpg' },
  { name: 'Noir 04 · Chest Embroidery 20k', type: 'image', url: '/assets/aistudio/_MG_5259_6af32076.jpg' },
  { name: 'Noir 05 · Virgin Cotton Close-Up', type: 'image', url: '/assets/aistudio/_MG_5259__1__5d8e7dd2.jpg' },
  { name: 'Noir 06 · Hood Apex Embroidery', type: 'image', url: '/assets/aistudio/_MG_5151_2_3c9b89ad.jpg' },
  { name: 'Noir 07 · Macro Satin Stitching', type: 'image', url: '/assets/aistudio/_MG_5262_01ad090f.jpg' },
  { name: 'Noir 08 · Handcrafted Totebag', type: 'image', url: '/assets/aistudio/_MG_5016_2_cd2ad39c.jpg' },
  // All 9 Blue Charcoal Catalogue Assets
  { name: 'Blue 01 · Front View Set', type: 'image', url: '/assets/aistudio/2026-11-01_07_13_34.115_0600_bb8a7721.jpg' },
  { name: 'Blue 02 · 1/3rd Perspective', type: 'image', url: '/assets/aistudio/file_00000000cf10821192d5b1152d2773e0_2_42d7355a.jpg' },
  { name: 'Blue 03 · Full Silhouette', type: 'image', url: '/assets/aistudio/2026-11-03_17_06_32.405_0600_6b9f05f3.jpg' },
  { name: 'Blue 04 · Rear Perspective Mannequin', type: 'image', url: '/assets/aistudio/file_000000007db88211a8e0b9aba7ad72ef_2817ac89.png' },
  { name: 'Blue 05 · Chest Slate Embroidery Relief', type: 'image', url: '/assets/aistudio/_MG_5101__1__e5a01ec8.jpg' },
  { name: 'Blue 06 · Ethical Dye Macro Weave', type: 'image', url: '/assets/aistudio/_MG_5099_844c6804.jpg' },
  { name: 'Blue 07 · Hood Overhead Monogram', type: 'image', url: '/assets/aistudio/_MG_5013_2_2c04bac4.jpg' },
  { name: 'Blue 08 · Thread Tension Macro', type: 'image', url: '/assets/aistudio/_MG_5103_9b0735a9.jpg' },
  { name: 'Blue 09 · Handcrafted Totebag', type: 'image', url: '/assets/aistudio/_MG_5020_07cb5c31.jpg' },
  // Additional Perspectives & Model References
  { name: 'Studio Male Model Lookbook', type: 'image', url: '/assets/aistudio/atelier_noire_detail_corrected_1920_e77bd4e1.jpg' },
  { name: 'Studio Female Model Lookbook', type: 'image', url: '/assets/aistudio/file_000000005c4082119e181008ed05ab16_58be1455.jpg' },
  { name: 'Edition Totebag Indigo', type: 'image', url: '/assets/aistudio/nobg-result__1__ee377718.png' },
  { name: 'Edition Totebag Noir', type: 'image', url: '/assets/aistudio/nobg-result_9467ad38.png' },
  { name: 'Commemorative Polaroid Front', type: 'image', url: '/assets/aistudio/edited_three_stripe_bicep_2_f6cf134a.jpg' },
  { name: 'Commemorative Polaroid Back', type: 'image', url: '/assets/aistudio/file_00000000cc9881f8b295d10f6ec9c43c__2__6d551629.jpg' },
  { name: 'Footer TikTok Mark', type: 'image', url: '/assets/aistudio/80cb644e10fd16f0da157bee10feb8a6_81c7539b.jpg' },
  { name: 'Footer WhatsApp Mark', type: 'image', url: '/assets/aistudio/02457c4b7b0f56db2b3e188d5d273509_7f78e4ff.jpg' },
  { name: 'Studio Video Poster', type: 'image', url: '/assets/img/measuring-poster-1600.webp' },
  { name: 'Artisan Video Buffer', type: 'video', url: '/noire-archive-drop/assets/video/measuring-small.mp4' },
];

export const ArchivePreloader: React.FC<ArchivePreloaderProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState<number>(0);
  const [currentAsset, setCurrentAsset] = useState<string>('Initializing archive assets...');
  const [assetsReady, setAssetsReady] = useState<boolean>(false);
  // Password gateway disabled so visitors enter directly upon loading
  const [isAuthorized] = useState<boolean>(true);
  const [logoFailed, setLogoFailed] = useState<boolean>(false);

  const containerRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const progressObj = useRef<{ value: number }>({ value: 0 });
  const hasExitedRef = useRef<boolean>(false);
  const unlockScrollRef = useRef<(() => void) | null>(null);
  const retainedElementsRef = useRef<(HTMLImageElement | HTMLVideoElement)[]>([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Immediate background asset preloading & scroll lock on mount
  useEffect(() => {
    let active = true;
    let completed = 0;
    let markedAllDone = false;
    const total = CRITICAL_ASSETS.length;

    const origHtmlOverflow = document.documentElement.style.overflow;
    const origBodyOverflow = document.body.style.overflow;
    const origHtmlHeight = document.documentElement.style.height;
    const origBodyHeight = document.body.style.height;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    window.scrollTo(0, 0);

    const preventScrollAction = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const blockKeyNavigation = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') {
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'].includes(e.key)) {
        e.preventDefault();
      }
    };

    window.addEventListener('wheel', preventScrollAction, { passive: false });
    window.addEventListener('touchmove', preventScrollAction, { passive: false });
    window.addEventListener('keydown', blockKeyNavigation, { passive: false });

    unlockScrollRef.current = () => {
      document.documentElement.style.overflow = origHtmlOverflow;
      document.body.style.overflow = origBodyOverflow;
      document.documentElement.style.height = origHtmlHeight;
      document.body.style.height = origBodyHeight;
      window.removeEventListener('wheel', preventScrollAction);
      window.removeEventListener('touchmove', preventScrollAction);
      window.removeEventListener('keydown', blockKeyNavigation);
    };

    const markAssetsComplete = () => {
      if (!active || markedAllDone) return;
      markedAllDone = true;
      gsap.to(progressObj.current, {
        value: 100,
        duration: 0.28,
        ease: 'power1.out',
        onUpdate: () => {
          if (active) setProgress(Math.round(progressObj.current.value));
        },
      });
      setCurrentAsset('Archive assets cached');
      setAssetsReady(true);
    };

    const notifyAsset = (name: string) => {
      if (!active || markedAllDone) return;
      completed += 1;
      const targetPercent = computePreloadPercent(completed, total, false);

      gsap.to(progressObj.current, {
        value: targetPercent,
        duration: 0.25,
        ease: 'power1.out',
        onUpdate: () => {
          if (active) {
            setProgress(Math.round(progressObj.current.value));
          }
        },
      });

      setCurrentAsset(name);

      if (completed >= total) {
        markAssetsComplete();
      }
    };

    // 1. Font readiness
    if (document.fonts) {
      Promise.all([
        document.fonts.load('16px Amoresa').catch(() => null),
        document.fonts.load('16px Perandory-SemiCondensed').catch(() => null),
        document.fonts.load('16px Caveat').catch(() => null),
        document.fonts.ready,
      ])
        .then(() => notifyAsset('Editorial Fonts'))
        .catch(() => notifyAsset('Editorial Fonts'));
    } else {
      notifyAsset('System Fonts');
    }

    // 2. Background image preloading & GPU decode
    const imageAssets = CRITICAL_ASSETS.filter((a) => a.type === 'image' && a.url);
    imageAssets.forEach((asset) => {
      const img = new Image();
      retainedElementsRef.current.push(img);
      img.src = asset.url!;

      if (img.decode) {
        img
          .decode()
          .then(() => notifyAsset(asset.name))
          .catch(() => notifyAsset(asset.name));
      } else {
        img.onload = () => notifyAsset(asset.name);
        img.onerror = () => notifyAsset(asset.name);
      }
    });

    // 3. Background studio video buffer (4.5s mobile Safari fallback)
    const videoAsset = CRITICAL_ASSETS.find((a) => a.type === 'video');
    let videoFallbackTimer: ReturnType<typeof setTimeout> | undefined;
    if (videoAsset && videoAsset.url) {
      const video = document.createElement('video');
      retainedElementsRef.current.push(video);
      video.src = videoAsset.url;
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;

      let videoDone = false;
      const handleCanPlay = () => {
        if (videoDone) return;
        videoDone = true;
        if (videoFallbackTimer) clearTimeout(videoFallbackTimer);
        notifyAsset('Artisan Studio Video');
        video.removeEventListener('canplaythrough', handleCanPlay);
        video.removeEventListener('error', handleCanPlay);
      };

      video.addEventListener('canplaythrough', handleCanPlay, { once: true });
      video.addEventListener('error', handleCanPlay, { once: true });
      videoFallbackTimer = setTimeout(handleCanPlay, 4500);
      video.load();
    }

    // Background safety completion timeout
    const safetyTimer = setTimeout(() => {
      markAssetsComplete();
    }, 8000);

    return () => {
      active = false;
      clearTimeout(safetyTimer);
      if (videoFallbackTimer) clearTimeout(videoFallbackTimer);
      unlockScrollRef.current?.();
      retainedElementsRef.current = [];
    };
  }, []);

  // Trigger architectural curtain reveal automatically once background preload completes
  useEffect(() => {
    if (!isAuthorized || !assetsReady || hasExitedRef.current) return;
    hasExitedRef.current = true;

    let cancelled = false;
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const pauseBeforeLift = setTimeout(() => {
      if (cancelled) return;

      if (isReducedMotion) {
        unlockScrollRef.current?.();
        onCompleteRef.current();
        return;
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;

          const tl = gsap.timeline({
            onComplete: () => {
              unlockScrollRef.current?.();
              if (!cancelled) {
                onCompleteRef.current();
              }
            },
          });

          if (cardRef.current && containerRef.current) {
            tl.to(cardRef.current, {
              opacity: 0,
              y: -24,
              scale: 0.98,
              duration: 0.36,
              ease: 'power2.in',
            }).to(
              containerRef.current,
              {
                yPercent: -100,
                duration: 0.68,
                ease: 'power3.inOut',
              },
              '-=0.08'
            );
          } else {
            unlockScrollRef.current?.();
            onCompleteRef.current();
          }
        });
      });
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(pauseBeforeLift);
    };
  }, [isAuthorized, assetsReady]);

  /*
   * Legacy passkey handler retained for future private drops:
   * const handleSubmit = (e: React.FormEvent) => {
   *   e.preventDefault();
   *   const result = validatePasskeyAttempt(passkey);
   *   if (result.valid) setIsAuthorized(true);
   * };
   */

  return (
    <aside
      ref={containerRef}
      aria-label="Atelier NOIRÉ Storefront Loading Overlay"
      className="fixed inset-0 w-screen h-dvh min-h-dvh z-[99999] flex flex-col justify-between p-5 sm:p-10 md:p-14 bg-[#161616] text-[#D6CCBA] pointer-events-auto overflow-y-auto overflow-x-hidden will-change-transform"
    >
      {/* Background radial studio spotlight */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 48%, #2B2A28 0%, #1B1A19 52%, #161616 100%)',
        }}
      />
      <div className="plate-grain fixed inset-0 pointer-events-none opacity-25" />

      {/* Top Metadata Bar */}
      <div className="relative z-10 flex items-center justify-between gap-4 text-[11px] font-mono-archive tracking-[0.2em] text-[#D6CCBA]/65 uppercase border-b border-[#D6CCBA]/15 pb-4 shrink-0">
        <span className="text-[#D6CCBA] whitespace-nowrap">ATELIER NOIRÉ</span>
        <span className="hidden sm:inline text-[#D6CCBA]/45 whitespace-nowrap">DUBLIN STUDIO ARCHIVE</span>
        <span className="whitespace-nowrap">EDITION 01 / 88 SETS</span>
      </div>

      {/* Central Architectural Loading Curtain Frame */}
      <div className="relative z-10 w-full max-w-[440px] mx-auto my-auto py-6 flex flex-col items-center">
        <div
          ref={cardRef}
          className="relative w-full border border-[#D6CCBA]/25 bg-[#161616]/95 p-7 sm:p-10 backdrop-blur-md shadow-2xl"
        >
          {/* Architectural Corner Brackets */}
          <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#D6CCBA]/60 pointer-events-none" />
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#D6CCBA]/60 pointer-events-none" />
          <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#D6CCBA]/60 pointer-events-none" />
          <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#D6CCBA]/60 pointer-events-none" />

          {/* Framing Header */}
          <div className="w-full flex items-center justify-between text-[10px] font-mono-archive text-[#D6CCBA]/55 tracking-[0.18em] uppercase pb-3 border-b border-[#D6CCBA]/12">
            <span>DUBLIN STUDIO</span>
            <span>ARCHIVE DROP 01</span>
          </div>

          {/* Genuine NOIRÉ Logo & Status */}
          <div className="w-full flex flex-col items-center text-center pt-7 pb-4">
            {!logoFailed ? (
              <img
                src="/assets/aistudio/edited-image-1793305524_ccd04284.png"
                alt="NOIRÉ"
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
                className="h-9 sm:h-11 w-auto object-contain filter drop-shadow-[0_4px_16px_rgba(255,255,255,0.12)]"
              />
            ) : (
              <span className="font-serif-editorial text-3xl tracking-[0.28em] text-[#FFFFFF]">
                NOIRÉ
              </span>
            )}

            <p className="font-serif-editorial text-xl sm:text-2xl text-[#FFFFFF] tracking-tight mt-6 text-balance leading-snug">
              {assetsReady ? 'Entering Archive Drop\u00A001' : 'Preparing Archive Storefront'}
            </p>

            <p className="text-xs sm:text-[13px] text-[#D6CCBA]/70 mt-2 leading-relaxed max-w-[44ch]">
              {assetsReady
                ? 'Lookbook photography, sizing instruments, and garment plates ready.'
                : 'Calibrating high-resolution lookbook photography & editorial typography.'}
            </p>
          </div>

          {/* Background Asset Preload Progress Track */}
          <div className="w-full mt-5 pt-5 border-t border-[#D6CCBA]/12">
            <div
              role="progressbar"
              aria-label="Storefront asset preload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="w-full h-[2px] bg-[#2B2A28] overflow-hidden relative"
            >
              <div
                className="h-full bg-gradient-to-r from-[#D6CCBA]/80 to-[#FFFFFF] transition-all duration-200 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-3 text-[10px] font-mono-archive text-[#D6CCBA]/60 tracking-[0.14em] tabular-nums">
              <span className="truncate max-w-[240px] uppercase text-[9px] text-[#D6CCBA]/55">
                {assetsReady ? 'Storefront ready' : `Loading · ${currentAsset}`}
              </span>
              <span className="font-medium text-[#D6CCBA] shrink-0">
                {progress}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Specification Footer */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between text-[10px] font-mono-archive tracking-[0.15em] text-[#D6CCBA]/45 border-t border-[#D6CCBA]/15 pt-4 gap-2 shrink-0 text-center">
        <span>390 GSM HOODIE · 280 GSM TAILORED TROUSERS</span>
        <span>ONE DESIGN · TWO COLOURWAYS · NO REISSUE</span>
      </div>
    </aside>
  );
};
