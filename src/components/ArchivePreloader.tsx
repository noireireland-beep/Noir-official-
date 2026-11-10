import React, { useEffect, useState, useRef } from 'react';
import { gsap } from 'gsap';

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
  const [currentAsset, setCurrentAsset] = useState<string>('Preloading archive assets...');
  
  const containerRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const progressObj = useRef<{ value: number }>({ value: 0 });
  const hasCompletedRef = useRef<boolean>(false);
  const retainedElementsRef = useRef<(HTMLImageElement | HTMLVideoElement)[]>([]);

  useEffect(() => {
    let active = true;
    let completed = 0;
    const total = CRITICAL_ASSETS.length;
    const startTime = Date.now();
    const MIN_DISPLAY_DURATION = 1600;

    // 0. Bulletproof scroll locking during loading sequence
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
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'].includes(e.key)) {
        e.preventDefault();
      }
    };

    window.addEventListener('wheel', preventScrollAction, { passive: false });
    window.addEventListener('touchmove', preventScrollAction, { passive: false });
    window.addEventListener('keydown', blockKeyNavigation, { passive: false });

    const unlockScroll = () => {
      document.documentElement.style.overflow = origHtmlOverflow;
      document.body.style.overflow = origBodyOverflow;
      document.documentElement.style.height = origHtmlHeight;
      document.body.style.height = origBodyHeight;
      window.removeEventListener('wheel', preventScrollAction);
      window.removeEventListener('touchmove', preventScrollAction);
      window.removeEventListener('keydown', blockKeyNavigation);
    };

    const notifyAsset = (name: string) => {
      if (!active) return;
      completed += 1;
      const targetPercent = Math.min(99, Math.round((completed / total) * 98));

      // GSAP smooth numeric counter interpolation
      gsap.to(progressObj.current, {
        value: targetPercent,
        duration: 0.28,
        ease: 'power1.out',
        onUpdate: () => {
          if (active) {
            setProgress(Math.round(progressObj.current.value));
          }
        },
      });

      setCurrentAsset(name);

      if (completed >= total && !hasCompletedRef.current) {
        const elapsed = Date.now() - startTime;
        const delay = Math.max(0, MIN_DISPLAY_DURATION - elapsed);
        setTimeout(() => {
          if (active && !hasCompletedRef.current) {
            hasCompletedRef.current = true;
            triggerExit();
          }
        }, delay);
      }
    };

    const triggerExit = () => {
      // Ensure counter hits 100
      gsap.to(progressObj.current, {
        value: 100,
        duration: 0.25,
        onUpdate: () => {
          if (active) setProgress(Math.round(progressObj.current.value));
        },
      });
      setCurrentAsset('Archive calibration verified · Layout stable');

      // Double rAF ensures the main document underneath has performed layout and first paint
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!active) return;

          // High-fidelity GSAP exit transition
          const tl = gsap.timeline({
            onComplete: () => {
              unlockScroll();
              if (active) {
                onComplete();
              }
            },
          });

          if (cardRef.current && containerRef.current) {
            tl.to(cardRef.current, {
              opacity: 0,
              y: -24,
              scale: 0.98,
              duration: 0.38,
              ease: 'power2.in',
            })
            .to(containerRef.current, {
              yPercent: -100,
              duration: 0.72,
              ease: 'power3.inOut',
            }, '-=0.08');
          } else {
            unlockScroll();
            setTimeout(onComplete, 400);
          }
        });
      });
    };

    // 1. Genuine font readiness
    if (document.fonts) {
      Promise.all([
        document.fonts.load('16px Amoresa').catch(() => null),
        document.fonts.load('16px perandory-semi-condensed').catch(() => null),
        document.fonts.load('16px Caveat').catch(() => null),
        document.fonts.ready,
      ]).then(() => {
        notifyAsset('Editorial Fonts');
      }).catch(() => {
        notifyAsset('Editorial Fonts');
      });
    } else {
      notifyAsset('System Fonts');
    }

    // 2. Genuine image preloading and GPU decode
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

    // 3. Video buffering (with 4.5s per-video fallback for mobile Safari)
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

    // Safety timeout ensures entrance never hangs on stalled connections
    const safetyTimer = setTimeout(() => {
      if (active && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        triggerExit();
      }
    }, 15000);

    return () => {
      active = false;
      clearTimeout(safetyTimer);
      if (videoFallbackTimer) clearTimeout(videoFallbackTimer);
      retainedElementsRef.current = [];
    };
  }, [onComplete]);

  return (
    <aside
      ref={containerRef}
      aria-label="Atelier NOIRÉ Archive Preloader"
      className="fixed inset-0 w-screen h-screen min-h-screen z-[99999] flex flex-col justify-between p-6 sm:p-10 md:p-14 bg-[#161616] text-[#D6CCBA] select-none pointer-events-auto overflow-hidden will-change-transform"
    >
      {/* Background radial studio spotlight */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 50%, #2B2A28 0%, #1a1a19 55%, #161616 100%)',
        }}
      />
      <div className="plate-grain absolute inset-0 pointer-events-none opacity-25" />

      {/* Top Header Row */}
      <div className="relative z-10 flex items-center justify-between text-[11px] font-mono-archive tracking-[0.2em] text-[#D6CCBA]/60 uppercase border-b border-[#D6CCBA]/15 pb-4">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF0800]" />
          <span className="text-[#D6CCBA]">ATELIER NOIRÉ</span>
        </div>
        <span className="hidden sm:inline text-[#D6CCBA]/40">ARCHIVE DROP 01 · ASSET PRELOAD</span>
        <span>EDITION 01 / 88 SETS</span>
      </div>

      {/* Central Screen: Full-Screen Frame with Authentic Brand Logo & Insignia */}
      <div className="relative z-10 w-full max-w-md mx-auto my-auto flex flex-col items-center">
        
        <div ref={cardRef} className="relative w-full border border-[#D6CCBA]/25 bg-[#161616]/95 p-8 sm:p-10 backdrop-blur-md shadow-2xl flex flex-col items-center">
          
          {/* Subtle Grid Corner Accents */}
          <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#D6CCBA]/60" />
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#D6CCBA]/60" />
          <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#D6CCBA]/60" />
          <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#D6CCBA]/60" />

          {/* Top Frame Registry */}
          <div className="w-full flex items-center justify-between text-[10px] font-mono-archive text-[#D6CCBA]/50 tracking-[0.18em] uppercase mb-6 pb-2 border-b border-[#D6CCBA]/10">
            <span>OFFICIAL BRAND MARK</span>
            <span>DECODING PLATES</span>
          </div>

          {/* Genuine NOIRÉ Logo Header Display */}
          <div className="relative w-full flex flex-col items-center justify-center my-4 py-2">
            <img 
              src="/assets/aistudio/edited-image-1793305524_ccd04284.png" 
              alt="NOIRÉ"
              className="h-9 sm:h-11 w-auto object-contain filter drop-shadow-[0_4px_16px_rgba(255,255,255,0.12)]"
            />
            
            <p className="font-mono-archive text-[10px] text-[#D6CCBA]/60 tracking-[0.22em] uppercase mt-4">
              ARCHIVE DROP NO. 01
            </p>
          </div>

          {/* Precision Preloader Bar */}
          <div className="w-full mt-6">
            <div className="w-full h-[2px] bg-[#2B2A28] overflow-hidden relative border-y border-[#D6CCBA]/15">
              <div 
                className="h-full bg-gradient-to-r from-[#D6CCBA] via-white to-[#FF0800] transition-all duration-200 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono-archive text-[#D6CCBA]/60 tracking-wider">
              <span className="truncate max-w-[220px] uppercase text-[9px] text-[#D6CCBA]/50">
                {currentAsset}
              </span>
              <span className="font-mono font-medium text-[#D6CCBA]">
                {progress}%
              </span>
            </div>
          </div>

        </div>

        <p className="font-mono-archive text-[10px] text-[#D6CCBA]/40 tracking-[0.2em] uppercase mt-4 text-center">
          HIGH-RESOLUTION ARCHIVE ASSETS LOADED
        </p>

      </div>

      {/* Bottom Specification Footer */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between text-[10px] font-mono-archive tracking-[0.15em] text-[#D6CCBA]/40 border-t border-[#D6CCBA]/15 pt-4 gap-2">
        <span>390 GSM HOODED TOP · 280 GSM TROUSERS</span>
        <span>ONE DESIGN · TWO COLOURWAYS · NO REISSUE</span>
      </div>
    </aside>
  );
};
