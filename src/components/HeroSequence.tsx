import React, { useEffect, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { StorytellingAtmosphere } from './StorytellingAtmosphere';
import { LiquidGlassBar } from './LiquidGlassBar';
import {
  STORY_CHAPTERS,
  STORY_REPLAY_SLIDE_INDEX,
  TOTAL_STORY_CHAPTERS,
  getStoryChapterForProgress,
  getStoryProgressStateForSlide,
  stepStorySlide,
  evaluateWheelStoryStep,
  StoryProgressState,
} from '../utils/mobileStoryNavigation';

gsap.registerPlugin(ScrollTrigger);

interface HeroSequenceProps {
  isReady?: boolean;
  activeColorway?: 'carbon' | 'blue-charcoal';
  onSelectColorway?: (color: 'carbon' | 'blue-charcoal') => void;
  onSkipStory?: () => void;
  onFastExitToArchive?: () => void;
}

export const HeroSequence: React.FC<HeroSequenceProps> = ({ 
  isReady = true,
  activeColorway = 'carbon',
  onSelectColorway,
  onSkipStory,
  onFastExitToArchive,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  
  // Layer refs
  const heroFigureContainerRef = useRef<HTMLDivElement>(null);
  const redWordmarkRef = useRef<HTMLDivElement>(null);
  const heroHeadRef = useRef<HTMLDivElement>(null);
  const heroFootRef = useRef<HTMLDivElement>(null);
  const topMetaRef = useRef<HTMLDivElement>(null);
  const colorwayControlsRef = useRef<HTMLDivElement>(null);
  
  // Storytelling Atmosphere ref (smoky dark monochrome gradient + off-white framing + heavy shadow base)
  const storytellingAtmosphereRef = useRef<HTMLDivElement>(null);

  // Storytelling Stage refs (Frameless, independent image adaptation + blank space typography)
  const chapter1StageRef = useRef<HTMLDivElement>(null); // Studio Video + "The default didn't make the cut"
  const videoRef = useRef<HTMLVideoElement>(null);
  const chapter2StageRef = useRef<HTMLDivElement>(null); // Woven Label Photo (frameless) + "5months of patience, 88 piece"
  const chapter3aStageRef = useRef<HTMLDivElement>(null); // Provenance Cards Photo (frameless) + "All for 88€ \n luxury ≠ expensive."
  
  // Chapter 3B Fullscreen Text-Only Brutalist Manifesto
  const manifestoStageRef = useRef<HTMLDivElement>(null);
  const manifestoText1Ref = useRef<HTMLDivElement>(null); // "This isn't your ordinary tracksuit"
  const manifestoText2Ref = useRef<HTMLDivElement>(null); // "This is ownership on something that only 88/8billion people can have"

  // Totebag and Finale
  const totebagStageRef = useRef<HTMLDivElement>(null);
  const totebagTextRef = useRef<HTMLDivElement>(null);
  const ownDifferenceRef = useRef<HTMLDivElement>(null);

  // Colourway slide state: 0 = Carbon Noir (2026-10-24), 1 = Blue Charcoal (_MG_5014)
  const [activeSlide, setActiveSlide] = useState<number>(activeColorway === 'blue-charcoal' ? 1 : 0);
  const videoDurationRef = useRef<number>(4.546);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  const [storyState, setStoryState] = useState<StoryProgressState>(() =>
    getStoryChapterForProgress(0)
  );
  const mobileStepRef = useRef<number>(0);
  const lastWheelStepTimeRef = useRef<number>(0);
  const lastWheelDeltaAbsRef = useRef<number>(0);
  const lastWheelDirRef = useRef<1 | -1 | 0>(0);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const syncViewport = () => setIsMobileViewport(mq.matches);
    syncViewport();
    mq.addEventListener('change', syncViewport);
    return () => mq.removeEventListener('change', syncViewport);
  }, []);

  // Sync internal slide with external colourway prop
  useEffect(() => {
    setActiveSlide(activeColorway === 'blue-charcoal' ? 1 : 0);
  }, [activeColorway]);

  const handleSlideChange = useCallback((index: number) => {
    const nextIndex = Math.max(0, Math.min(1, index));
    setActiveSlide(nextIndex);
    if (onSelectColorway) {
      onSelectColorway(nextIndex === 0 ? 'carbon' : 'blue-charcoal');
    }
  }, [onSelectColorway]);

  // Touch and drag swipe detection for horizontal sliding
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    touchStartXRef.current = clientX;
    touchStartYRef.current = clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as React.MouseEvent).clientY;
    
    const diffX = clientX - touchStartXRef.current;
    const diffY = clientY - touchStartYRef.current;

    // Only trigger if horizontal swipe was significantly larger than vertical scroll
    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.3) {
      if (diffX < 0) {
        handleSlideChange(1);
      } else {
        handleSlideChange(0);
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  useEffect(() => {
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      if (isReducedMotion) {
        gsap.set(heroFigureContainerRef.current, { y: 0, opacity: 1 });
        gsap.set(redWordmarkRef.current, { y: 0, opacity: 1 });
        gsap.set([heroHeadRef.current, heroFootRef.current, topMetaRef.current, colorwayControlsRef.current], { y: 0, opacity: 1 });
        gsap.set([totebagStageRef.current, ownDifferenceRef.current], { opacity: 1, filter: 'none', y: 0 });
        return;
      }

      // Initial resting state
      gsap.set(heroFigureContainerRef.current, { y: 0, opacity: 1, transformOrigin: '50% 68%' });
      gsap.set(redWordmarkRef.current, { y: 0, opacity: 0.95, scale: 1 });
      gsap.set([heroHeadRef.current, heroFootRef.current], { y: 0, opacity: 1 });
      gsap.set(topMetaRef.current, { opacity: 1, y: 0 });
      gsap.set(colorwayControlsRef.current, { opacity: 1, y: 0 });

      // Storytelling atmosphere initially hidden
      gsap.set(storytellingAtmosphereRef.current, { opacity: 0 });

      // Storytelling stages initially hidden (revealed on user scroll)
      gsap.set([chapter1StageRef.current, chapter2StageRef.current, chapter3aStageRef.current], { opacity: 0, pointerEvents: 'none' });

      gsap.set(manifestoStageRef.current, { opacity: 0, pointerEvents: 'none' });
      gsap.set(manifestoText1Ref.current, { opacity: 0, scale: 0.98, pointerEvents: 'none' });
      gsap.set(manifestoText2Ref.current, { opacity: 0, scale: 0.98, pointerEvents: 'none' });

      gsap.set(totebagStageRef.current, { opacity: 0, y: 35, pointerEvents: 'none' });
      gsap.set(totebagTextRef.current, { opacity: 0, y: 30, pointerEvents: 'none' });
      gsap.set(ownDifferenceRef.current, { opacity: 0, y: 28, scale: 0.96, pointerEvents: 'none' });

      // ──────────────── STORYTELLING TIMELINE (DESKTOP SCRUB vs MOBILE DISCRETE SLIDES) ────────────────
      if (stageRef.current) {
        const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
        const useDiscreteMobile = isMobileViewport;

        const scrubTl = gsap.timeline(
          useDiscreteMobile
            ? { paused: true }
            : {
                scrollTrigger: {
                  id: 'hero-story',
                  trigger: stageRef.current,
                  start: 'top top',
                  end: '+=840%',
                  pin: true,
                  scrub: isTouch ? 0.45 : 0.75,
                  anticipatePin: 1,
                  fastScrollEnd: true,
                  invalidateOnRefresh: true,
                  onUpdate: (self) => {
                    const next = getStoryChapterForProgress(self.progress);
                    setStoryState((prev) => {
                      if (
                        prev.chapter.index === next.chapter.index &&
                        prev.isStoryActive === next.isStoryActive &&
                        prev.percent === next.percent
                      ) {
                        return prev;
                      }
                      return next;
                    });
                  },
                },
              }
        );

        // ── Phase 0 (0.0 -> 0.6): Opening hero elements fade out cleanly ──
        scrubTl.fromTo([heroHeadRef.current, heroFootRef.current], 
          { y: 0, opacity: 1 },
          {
            y: -50,
            opacity: 0,
            duration: 0.6,
            ease: 'power2.inOut',
            immediateRender: false,
          }, 
          0
        );

        if (topMetaRef.current) {
          scrubTl.fromTo(topMetaRef.current,
            { opacity: 1, y: 0 },
            {
              opacity: 0,
              y: -20,
              duration: 0.5,
              ease: 'power2.inOut',
              immediateRender: false,
            },
            0
          );
        }

        if (colorwayControlsRef.current) {
          scrubTl.fromTo(colorwayControlsRef.current,
            { opacity: 1, y: 0 },
            {
              opacity: 0,
              y: 20,
              duration: 0.5,
              ease: 'power2.inOut',
              immediateRender: false,
            },
            0
          );
        }

        // Bold red text fades completely out before any storytelling text appears
        scrubTl.fromTo(redWordmarkRef.current,
          { scale: 1, opacity: 0.95, y: 0 },
          {
            scale: 1.08,
            opacity: 0,
            y: -30,
            duration: 0.6,
            ease: 'power2.inOut',
            immediateRender: false,
          },
          0
        );

        // Hero figure fades out completely before Chapter 01
        scrubTl.fromTo(heroFigureContainerRef.current,
          { scale: 1, x: 0, y: 0, opacity: 1 },
          {
            scale: 1.35,
            x: -30,
            y: '8vh',
            opacity: 0,
            duration: 0.65,
            ease: 'power2.inOut',
            immediateRender: false,
          },
          0.05
        );

        // ── Phase 1 (0.55 -> 2.05): Chapter 01 & Storytelling Atmosphere Entrance ──
        if (storytellingAtmosphereRef.current) {
          scrubTl.fromTo(storytellingAtmosphereRef.current,
            { opacity: 0 },
            { opacity: 1, duration: 0.6, ease: 'power2.inOut', immediateRender: false },
            0.55
          );
        }

        scrubTl.fromTo(chapter1StageRef.current,
          { opacity: 0, y: 25 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', immediateRender: false },
          0.6
        );

        // Scrub video playback smoothly
        const videoProxy = { time: 0 };
        scrubTl.to(videoProxy, {
          time: videoDurationRef.current || 4.546,
          duration: 1.15,
          ease: 'none',
          immediateRender: false,
          onUpdate: () => {
            if (videoRef.current && isFinite(videoRef.current.duration) && videoRef.current.duration > 0) {
              const targetDuration = videoRef.current.duration;
              const normalized = videoProxy.time / (videoDurationRef.current || 4.546);
              const boundedTime = Math.min(targetDuration, Math.max(0, normalized * targetDuration));
              videoRef.current.currentTime = boundedTime;
            }
          },
        }, 0.65);

        // Chapter 01 departs fully before Chapter 02 begins
        scrubTl.to(chapter1StageRef.current, {
          opacity: 0,
          y: -25,
          duration: 0.35,
          ease: 'power2.in',
          immediateRender: false,
        }, 1.85);

        // ── Phase 2 (2.1 -> 3.65): Chapter 02 / Woven Label & "5months of patience, 88 piece" ──
        scrubTl.fromTo(chapter2StageRef.current,
          { opacity: 0, y: 25 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', immediateRender: false },
          2.15
        );

        // Chapter 02 departs fully before Chapter 03A begins
        scrubTl.to(chapter2StageRef.current, {
          opacity: 0,
          y: -25,
          duration: 0.35,
          ease: 'power2.in',
          immediateRender: false,
        }, 3.35);

        // ── Phase 3 (3.75 -> 5.55): Fullscreen Text-Only Brutalist Manifesto ──
        scrubTl.fromTo(manifestoStageRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.35, ease: 'power1.out', immediateRender: false },
          3.75
        );

        // Statement: "ARCHIVE DROP (#)" + "This isn't your ordinary tracksuit"
        scrubTl.fromTo(manifestoText1Ref.current,
          { opacity: 0, scale: 0.95, y: 20 },
          { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'power3.out', immediateRender: false },
          3.85
        );

        scrubTl.to(manifestoText1Ref.current, {
          opacity: 0,
          scale: 1.03,
          y: -15,
          duration: 0.35,
          ease: 'power2.in',
          immediateRender: false,
        }, 4.55);

        // Follow-up statement: Provenance Record + "This is ownership on something that only 88/8billion people can have"
        scrubTl.fromTo(manifestoText2Ref.current,
          { opacity: 0, scale: 0.95, y: 20 },
          { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'power3.out', immediateRender: false },
          4.75
        );

        scrubTl.to(manifestoText2Ref.current, {
          opacity: 0,
          scale: 1.03,
          y: -15,
          duration: 0.35,
          ease: 'power2.in',
          immediateRender: false,
        }, 5.45);

        scrubTl.to(manifestoStageRef.current, {
          opacity: 0,
          duration: 0.3,
          ease: 'power2.inOut',
          immediateRender: false,
        }, 5.55);

        // ── Phase 4 (5.65 -> 7.2): Valuation Section / Provenance Cards & "All for 88€ \n luxury ≠ expensive." ──
        scrubTl.fromTo(chapter3aStageRef.current,
          { opacity: 0, y: 25 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', immediateRender: false },
          5.65
        );

        // Valuation departs fully before Chapter 04 totebag begins
        scrubTl.to(chapter3aStageRef.current, {
          opacity: 0,
          y: -25,
          duration: 0.35,
          ease: 'power2.in',
          immediateRender: false,
        }, 6.95);

        // ── Phase 4 (7.3 -> 8.8): Chapter 04 / Brutalist Totebag Showcase ──
        scrubTl.fromTo(totebagStageRef.current,
          { opacity: 0, y: 35, scale: 0.97, pointerEvents: 'none' },
          { opacity: 1, y: 0, scale: 1, pointerEvents: 'auto', duration: 0.6, ease: 'power2.out', immediateRender: false },
          7.4
        );

        scrubTl.fromTo(totebagTextRef.current,
          { opacity: 0, y: 25 },
          { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out', immediateRender: false },
          7.55
        );

        scrubTl.to(totebagTextRef.current, {
          opacity: 0,
          y: -20,
          duration: 0.4,
          ease: 'power2.in',
          immediateRender: false,
        }, 8.5);

        scrubTl.fromTo(totebagStageRef.current,
          { y: 0, opacity: 1, scale: 1, pointerEvents: 'auto' },
          {
            y: '18vh',
            opacity: 0,
            scale: 0.95,
            pointerEvents: 'none',
            duration: 0.75,
            ease: 'power2.inOut',
            immediateRender: false,
          },
          8.55
        );

        // ── Phase 5 (8.8 -> 10.3): The Finale ("Own your difference" ONLY) ──
        scrubTl.fromTo(ownDifferenceRef.current,
          {
            opacity: 0,
            y: 25,
            scale: 0.96,
          },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            ease: 'power2.out',
            immediateRender: false,
          },
          8.8
        );

        // Pinned hold frame before hero storytelling completes
        scrubTl.to({}, { duration: 0.8 }, 9.7);

        // Storytelling background fades out cleanly as the hero storytelling concludes and scrolls into #ledger
        if (storytellingAtmosphereRef.current) {
          scrubTl.to(storytellingAtmosphereRef.current, {
            opacity: 0,
            duration: 0.6,
            ease: 'power2.inOut',
            immediateRender: false,
          }, 9.8);
        }

        // Attach discrete mobile one-slide-per-swipe & wheel listener (keeps animation identical, snappier 1-slide steps)
        if (useDiscreteMobile) {
          const stageEl = stageRef.current;

          const syncTouchActionForStep = (stepIdx: number) => {
            stageEl.style.touchAction =
              stepIdx >= STORY_CHAPTERS.length - 1 ? 'pan-y' : 'pan-x';
          };

          syncTouchActionForStep(mobileStepRef.current);
          if (mobileStepRef.current > 0) {
            scrubTl.pause(STORY_CHAPTERS[mobileStepRef.current].time);
          }

          const goToDiscreteStep = (stepIndex: number) => {
            const bounded = Math.max(0, Math.min(STORY_CHAPTERS.length - 1, stepIndex));
            mobileStepRef.current = bounded;
            syncTouchActionForStep(bounded);
            setStoryState(getStoryProgressStateForSlide(bounded));

            scrubTl.tweenTo(STORY_CHAPTERS[bounded].time, {
              duration: 0.44,
              ease: 'power2.out',
              overwrite: 'auto',
            });

            if (videoRef.current) {
              if (bounded === 1) {
                videoRef.current.currentTime = 0;
                videoRef.current.play().catch(() => {});
              } else {
                videoRef.current.pause();
              }
            }
          };

          let gestureStartX = 0;
          let gestureStartY = 0;
          let gestureConsumed = false;

          const onTouchStart = (e: TouchEvent) => {
            if (!e.touches.length) return;
            gestureStartX = e.touches[0].clientX;
            gestureStartY = e.touches[0].clientY;
            gestureConsumed = false;
          };

          const onTouchMove = (e: TouchEvent) => {
            if (!isReady || !e.touches.length) return;
            if (window.scrollY > 14) return;

            const dx = e.touches[0].clientX - gestureStartX;
            const dy = e.touches[0].clientY - gestureStartY;

            // Leave horizontal figure / totebag swipes completely untouched
            if (Math.abs(dx) > Math.abs(dy) * 1.15) return;

            const dir: 1 | -1 = dy < 0 ? 1 : -1;
            const stepResult = stepStorySlide({
              currentStep: mobileStepRef.current,
              direction: dir,
            });

            // At the start pulling down (refresh) allow natural scroll
            if (dir === -1 && mobileStepRef.current === 0) {
              return;
            }

            // On final slide (Slide 7) swiping downward to enter Garment Archive:
            // Arrest raw thumb momentum and smoothly land on #ledger so fast swipes never overshoot it
            if (stepResult.shouldExitToArchive) {
              if (onFastExitToArchive) {
                e.preventDefault();
                e.stopPropagation();
                if (!gestureConsumed && Math.abs(dy) >= 18) {
                  gestureConsumed = true;
                  onFastExitToArchive();
                }
              }
              return;
            }

            // Hold viewport pinned at y=0 while stepping through slides 0..7
            e.preventDefault();
            e.stopPropagation();

            // Trigger 1 discrete slide immediately per touch gesture — never locked out by prior animation
            if (!gestureConsumed && Math.abs(dy) >= 20 && stepResult.changed) {
              gestureConsumed = true;
              goToDiscreteStep(stepResult.nextStep);
            }
          };

          const onWheel = (e: WheelEvent) => {
            if (!isReady) return;
            if (window.scrollY > 14) return;
            if (Math.abs(e.deltaY) < 8) return;

            const dir: 1 | -1 = e.deltaY > 0 ? 1 : -1;
            const stepResult = stepStorySlide({
              currentStep: mobileStepRef.current,
              direction: dir,
            });

            if (dir === -1 && mobileStepRef.current === 0) {
              return;
            }

            if (stepResult.shouldExitToArchive) {
              if (onFastExitToArchive) {
                e.preventDefault();
                e.stopPropagation();
                const now = performance.now();
                const evaluation = evaluateWheelStoryStep({
                  deltaY: e.deltaY,
                  nowMs: now,
                  lastStepTimeMs: lastWheelStepTimeRef.current,
                  lastStepDeltaAbs: lastWheelDeltaAbsRef.current,
                  lastDirection: lastWheelDirRef.current,
                });
                if (evaluation.shouldTrigger) {
                  lastWheelStepTimeRef.current = now;
                  lastWheelDeltaAbsRef.current = Math.abs(e.deltaY);
                  lastWheelDirRef.current = dir;
                  onFastExitToArchive();
                }
              }
              return;
            }

            e.preventDefault();
            e.stopPropagation();

            const now = performance.now();
            const evaluation = evaluateWheelStoryStep({
              deltaY: e.deltaY,
              nowMs: now,
              lastStepTimeMs: lastWheelStepTimeRef.current,
              lastStepDeltaAbs: lastWheelDeltaAbsRef.current,
              lastDirection: lastWheelDirRef.current,
            });

            if (evaluation.shouldTrigger && stepResult.changed) {
              lastWheelStepTimeRef.current = now;
              lastWheelDeltaAbsRef.current = Math.abs(e.deltaY);
              lastWheelDirRef.current = dir;
              goToDiscreteStep(stepResult.nextStep);
            }
          };

          const onReplayEvent = () => {
            scrubTl.pause(0);
            mobileStepRef.current = 0;
            lastWheelStepTimeRef.current = 0;
            lastWheelDeltaAbsRef.current = 0;
            lastWheelDirRef.current = 0;
            goToDiscreteStep(STORY_REPLAY_SLIDE_INDEX);
          };

          const onSkipEvent = () => {
            const lastIdx = STORY_CHAPTERS.length - 1;
            mobileStepRef.current = lastIdx;
            syncTouchActionForStep(lastIdx);
            scrubTl.pause(STORY_CHAPTERS[lastIdx].time);
            setStoryState(getStoryProgressStateForSlide(lastIdx));
            if (videoRef.current) {
              videoRef.current.pause();
            }
          };

          stageEl.addEventListener('touchstart', onTouchStart, { passive: true });
          stageEl.addEventListener('touchmove', onTouchMove, { passive: false });
          stageEl.addEventListener('wheel', onWheel, { passive: false });
          window.addEventListener('noire:replay-story', onReplayEvent);
          window.addEventListener('noire:skip-story', onSkipEvent);

          return () => {
            stageEl.style.touchAction = '';
            stageEl.removeEventListener('touchstart', onTouchStart);
            stageEl.removeEventListener('touchmove', onTouchMove);
            stageEl.removeEventListener('wheel', onWheel);
            window.removeEventListener('noire:replay-story', onReplayEvent);
            window.removeEventListener('noire:skip-story', onSkipEvent);
          };
        }
      }
    }, containerRef);

    return () => {
      ctx.revert();
    };
  }, [isReady, isMobileViewport, onFastExitToArchive]);

  return (
    <div 
      ref={containerRef} 
      id="hero-stage" 
      className="relative w-full bg-[#161616] text-[#D6CCBA] overflow-hidden"
    >
      
      {/* ──────────────── THE LOCKED HERO VIEWPORT STAGE ──────────────── */}
      <div 
        ref={stageRef} 
        className="relative w-full h-[100dvh] min-h-[540px] flex items-center justify-center overflow-hidden bg-[#161616]"
      >
        
        {/* Layer 0: Warm Graphite Studio Spotlight Wall (Base Hero) */}
        <div className="absolute inset-0 z-0 bg-[#161616]">
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 85% 65% at 50% 48%, #2B2A28 0%, #1d1c1a 65%, #161616 100%)',
            }}
          />
          <div className="plate-grain absolute inset-0 pointer-events-none" />
        </div>

        {/* Layer 0B: Dedicated Storytelling Atmosphere (Mimics structural reference with pure modern CSS gradients) */}
        <StorytellingAtmosphere 
          ref={storytellingAtmosphereRef}
          style={{ opacity: 0 }}
        />

        {/* Top Metadata Strip: Desktop centered datum preserved; Mobile stripped of extra text with refined architectural Skip link */}
        <div 
          ref={topMetaRef}
          className="absolute top-[4.5rem] md:top-20 left-0 right-0 z-40 pointer-events-none px-4 sm:px-8 md:px-12 lg:px-16"
        >
          {/* Desktop & Tablet: Original centered datum strip */}
          <div className="hidden md:flex max-w-7xl mx-auto items-center justify-center text-xs font-mono-archive tracking-[0.2em] text-[#D6CCBA]/55 border-b border-[#D6CCBA]/10 pb-2.5">
            <span>TWO COLOURWAYS · 88 NUMBERED SETS</span>
          </div>

          {/* Mobile: Apple Clear Liquid Glass Skip capsule with scroll-triggered optics */}
          {onSkipStory && (
            <div className="flex md:hidden items-center justify-end">
              <LiquidGlassBar
                as="button"
                type="button"
                onClick={onSkipStory}
                frostOpacity={0.12}
                saturation={1.12}
                scrollProgress={storyState.percent / 100}
                className="pointer-events-auto inline-flex items-center justify-center min-h-[36px] sm:min-h-[38px] px-3.5 sm:px-4 py-1.5 border border-white/20 font-mono-archive text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.18em] sm:tracking-[0.2em] text-[#F5EFEB] hover:text-white transition-transform duration-200 cursor-pointer whitespace-nowrap active:scale-[0.97]"
              >
                <span style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.45)' }}>Skip intro</span>
                <span aria-hidden="true" className="text-[#FF0800] font-bold">→</span>
              </LiquidGlassBar>
            </div>
          )}
        </div>

        {/* Mobile Active Storytelling Apple Clear Liquid Glass Bar (<768px) */}
        {onSkipStory && (
          <div
            className={`md:hidden absolute top-[4.5rem] sm:top-[4.75rem] inset-x-2.5 min-[375px]:inset-x-3.5 sm:inset-x-6 z-[45] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              storyState.isStoryActive
                ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                : 'opacity-0 -translate-y-1.5 scale-[0.98] pointer-events-none'
            }`}
            aria-hidden={!storyState.isStoryActive}
          >
            <LiquidGlassBar
              frostOpacity={0.14}
              saturation={1.12}
              scrollProgress={storyState.percent / 100}
              className="w-full max-w-[540px] mx-auto px-3 min-[375px]:px-3.5 sm:px-4.5 py-2 sm:py-2.5 border border-white/20"
            >
              <div className="flex items-center justify-between gap-1.5 min-[375px]:gap-2.5 sm:gap-3">
                <div
                  className="min-w-0 flex-1 flex items-center gap-1 min-[375px]:gap-1.5 text-[8.5px] min-[375px]:text-[9.5px] sm:text-[11px] font-mono-archive uppercase tracking-[0.08em] min-[375px]:tracking-[0.14em] sm:tracking-[0.18em] text-white"
                  style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.55)' }}
                >
                  <span className="text-[#FF0800] font-bold shrink-0">
                    {storyState.chapter.code}/0{TOTAL_STORY_CHAPTERS}
                  </span>
                  <span className="text-white/45 shrink-0" aria-hidden="true">·</span>
                  <span className="truncate text-[#F5EFEB]/95">{storyState.chapter.label}</span>
                </div>

                <button
                  type="button"
                  onClick={onSkipStory}
                  tabIndex={storyState.isStoryActive ? 0 : -1}
                  className="min-h-[28px] min-[375px]:min-h-[32px] sm:min-h-[34px] px-2 min-[375px]:px-2.5 sm:px-3.5 py-1 rounded-full bg-white/12 hover:bg-white/22 border border-white/20 font-mono-archive text-[8.5px] min-[375px]:text-[9.5px] sm:text-[10.5px] font-medium uppercase tracking-[0.1em] min-[375px]:tracking-[0.15em] sm:tracking-[0.18em] text-white transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1 sm:gap-1.5 active:scale-[0.97]"
                  style={{
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.28)',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.45)',
                  }}
                >
                  <span>Skip intro</span>
                  <span aria-hidden="true" className="text-[#FF0800] font-bold">→</span>
                </button>
              </div>

              {/* Integrated inner liquid progress filament */}
              <div
                className="mt-2 mx-1.5 sm:mx-2 h-[2px] rounded-full bg-white/15 overflow-hidden"
                role="progressbar"
                aria-label="Storytelling slide progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={storyState.percent}
              >
                <div
                  className="h-full rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.65)] transition-[width] duration-300 ease-out"
                  style={{ width: `${storyState.percent}%` }}
                />
              </div>
            </LiquidGlassBar>
          </div>
        )}

        {/* Layer 1 (BEHIND HERO FIGURE): Mathematically Centered Symmetrical Red Extenda Wordmark */}
        <div 
          ref={redWordmarkRef}
          aria-hidden="true"
          className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none select-none overflow-hidden"
        >
          {/* Desktop & Tablet: Symmetrical flanking wings with centered gap behind model */}
          <div className="hidden md:flex items-center justify-center gap-12 md:gap-20 lg:gap-28 xl:gap-36 w-full max-w-7xl mx-auto px-6 md:px-12 transform-gpu translate-y-6 lg:translate-y-8">
            <span className="font-extenda uppercase text-[#FF0800] text-[10.5vw] lg:text-[9.5vw] xl:text-[9vw] leading-[0.72] tracking-[-0.035em] font-black opacity-95 text-right whitespace-nowrap transform-gpu drop-shadow-[0_4px_35px_rgba(255,8,0,0.25)]">
              ARCHIVE
            </span>
            <span className="font-extenda uppercase text-[#FF0800] text-[10.5vw] lg:text-[9.5vw] xl:text-[9vw] leading-[0.72] tracking-[0.14em] font-black opacity-95 text-left whitespace-nowrap transform-gpu drop-shadow-[0_4px_35px_rgba(255,8,0,0.25)]">
              DROP
            </span>
          </div>

          {/* Mobile: Centered, balanced architectural poster stack */}
          <div className="flex md:hidden flex-col items-center justify-center w-full px-4 transform-gpu translate-y-2">
            <span className="font-extenda uppercase text-[#FF0800] text-[22vw] leading-[0.72] tracking-[-0.03em] font-black opacity-95 text-center drop-shadow-[0_4px_35px_rgba(255,8,0,0.25)]">
              ARCHIVE
            </span>
            <span className="font-extenda uppercase text-[#FF0800] text-[22vw] leading-[0.72] tracking-[0.14em] font-black opacity-95 text-center drop-shadow-[0_4px_35px_rgba(255,8,0,0.25)]">
              DROP
            </span>
          </div>
        </div>

        {/* Layer 2 (IN FRONT OF RED TEXT): Horizontal Slide Figure Container */}
        <div 
          ref={heroFigureContainerRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseUp={handleTouchEnd}
          className="hero-figure-layer absolute inset-x-0 bottom-0 z-20 h-full flex items-end justify-center pointer-events-auto cursor-grab active:cursor-grabbing select-none transform-gpu"
        >
          {/* Horizontal Track Container */}
          <div 
            className="w-full h-full flex transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] transform-gpu"
            style={{
              transform: `translateX(-${activeSlide * 100}%)`,
            }}
          >
            {/* Figure 01: Carbon Noir */}
            <div className="w-full h-full flex items-end justify-center shrink-0 flex-none pointer-events-none">
              <div className="flex items-end justify-center h-full max-h-[76vh] sm:max-h-[80vh] md:max-h-[85vh] lg:max-h-[88vh]">
                <img 
                  src="/assets/aistudio/background-removed-background-removed-2026-10-24_00_30_49.918_0600-standard_4-standard_315b0c80.png" 
                  alt="Atelier NOIRÉ Archive Tracksuit — Carbon Noir" 
                  className="h-full w-auto max-h-[74vh] sm:max-h-[78vh] md:max-h-[83vh] lg:max-h-[86vh] object-contain object-bottom filter drop-shadow-[0_20px_45px_rgba(0,0,0,0.65)] origin-bottom transform-gpu"
                  loading="eager"
                  fetchPriority="high"
                />
              </div>
            </div>

            {/* Figure 02: Blue Charcoal */}
            <div className="w-full h-full flex items-end justify-center shrink-0 flex-none pointer-events-none">
              <div className="flex items-end justify-center h-full max-h-[76vh] sm:max-h-[80vh] md:max-h-[85vh] lg:max-h-[88vh]">
                <img 
                  src="/assets/aistudio/background-removed-_MG_5014-standard_3c5997f5.png" 
                  alt="Atelier NOIRÉ Archive Tracksuit — Blue Charcoal" 
                  className="h-full w-auto max-h-[74vh] sm:max-h-[78vh] md:max-h-[83vh] lg:max-h-[86vh] object-contain object-bottom filter drop-shadow-[0_20px_45px_rgba(0,0,0,0.65)] origin-bottom transform-gpu"
                  style={{ transform: 'scale(1.046)' }}
                  loading="eager"
                  fetchPriority="high"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Layer 3: Opening Frame Typography & Headline & Docked Controls (Reverses on Scroll) */}
        <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between pt-28 sm:pt-32 pb-8 sm:pb-10 md:pb-12 px-6 sm:px-8 md:px-12 lg:px-16 max-w-7xl mx-auto w-full">
          
          {/* Top Headline Block */}
          <div ref={heroHeadRef} className="max-w-lg lg:max-w-xl">
            <p className="font-mono-archive text-[10px] md:text-xs text-[#D6CCBA]/70 uppercase tracking-[0.2em] mb-2.5">
              ATELIER NOIRÉ / ARCHIVE DROP
            </p>
            <h1 className="font-serif-editorial text-3xl sm:text-5xl md:text-6xl lg:text-[4.75rem] font-normal leading-[0.94] tracking-tight text-[#D6CCBA]">
              <span className="italic font-light mr-1.5 text-4xl sm:text-6xl md:text-7xl lg:text-[5.75rem]">A</span>tracksuit.<br />
              <span className="italic font-light text-[#D6CCBA]/85">Taken a little</span><br />
              <span className="italic font-light text-[#D6CCBA]/85">too seriously.</span>
            </h1>
            <p className="md:hidden mt-2.5 flex items-center gap-1.5 text-[10px] font-mono-archive uppercase tracking-[0.16em] text-[#D6CCBA]/75 whitespace-nowrap">
              <span className="text-[#FF0800] font-bold" aria-hidden="true">↓</span>
              <span>Swipe up for next slide · Swipe figure</span>
            </p>
          </div>

          {/* Bottom Row: Right Archive Registry Spec Stamp */}
          <div ref={heroFootRef} className="relative flex items-end justify-end w-full pointer-events-none pb-1 sm:pb-2">
            {/* Right Subtle Spec Stamp */}
            <div className="hidden lg:flex flex-col items-end text-right font-mono-archive text-[10px] tracking-[0.2em] text-[#D6CCBA]/45 uppercase pointer-events-none">
              <span>88 NUMBERED SETS</span>
              <span className="text-[#D6CCBA]/30 mt-0.5">390 GSM FLEECE</span>
            </div>
          </div>

          {/* Minimalist Architectural Colourway Selector Box */}
          <div 
            ref={colorwayControlsRef}
            className="absolute left-1/2 -translate-x-1/2 bottom-[max(1.5rem,4.5dvh)] sm:bottom-[max(2rem,5dvh)] md:bottom-[max(2.25rem,5.5dvh)] z-50 pointer-events-auto select-none max-w-[calc(100vw-2rem)]"
          >
            <div className={`transition-colors duration-300 bg-[#161616]/92 backdrop-blur-md px-3.5 sm:px-6 py-2 border flex items-center justify-center gap-3 sm:gap-6 shadow-2xl whitespace-nowrap ${
              activeSlide === 0 ? 'border-[#FF0800]/60 ring-1 ring-[#FF0800]/20' : 'border-[#8FA9C4]/60 ring-1 ring-[#8FA9C4]/20'
            }`}>
              <button
                type="button"
                onClick={() => handleSlideChange(0)}
                aria-pressed={activeSlide === 0}
                className={`relative flex items-center gap-2 sm:gap-2.5 pb-1 transition-all duration-300 cursor-pointer font-mono-archive text-[10px] sm:text-xs tracking-[0.18em] sm:tracking-[0.22em] uppercase whitespace-nowrap ${
                  activeSlide === 0 
                    ? 'text-[#F0F2F4] font-bold' 
                    : 'text-[#D6CCBA]/45 hover:text-[#D6CCBA]/85'
                }`}
              >
                <span className={`w-2 h-2 rounded-full transition-all duration-300 shrink-0 ${
                  activeSlide === 0 ? 'bg-[#FF0800] ring-2 ring-[#FF0800]/40 scale-110 shadow-[0_0_8px_rgba(255,8,0,0.5)]' : 'bg-[#D6CCBA]/30'
                }`} />
                <span>CARBON</span>
                {activeSlide === 0 && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF0800]" />
                )}
              </button>

              <span className="text-[#D6CCBA]/25 select-none font-light">/</span>

              <button
                type="button"
                onClick={() => handleSlideChange(1)}
                aria-pressed={activeSlide === 1}
                className={`relative flex items-center gap-2 sm:gap-2.5 pb-1 transition-all duration-300 cursor-pointer font-mono-archive text-[10px] sm:text-xs tracking-[0.18em] sm:tracking-[0.22em] uppercase whitespace-nowrap ${
                  activeSlide === 1 
                    ? 'text-[#F0F2F4] font-bold' 
                    : 'text-[#D6CCBA]/45 hover:text-[#D6CCBA]/85'
                }`}
              >
                <span className={`w-2 h-2 rounded-full transition-all duration-300 shrink-0 ${
                  activeSlide === 1 ? 'bg-[#8FA9C4] ring-2 ring-[#8FA9C4]/40 scale-110 shadow-[0_0_8px_rgba(143,169,196,0.5)]' : 'bg-[#D6CCBA]/30'
                }`} />
                <span>BLUE CHARCOAL</span>
                {activeSlide === 1 && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#8FA9C4]" />
                )}
              </button>
            </div>
          </div>

        </div>

        {/* ═══════════════════════════════════════════════════════════════
            LAYER 4: EDITORIAL STORYTELLING SEQUENCE (BRUTALIST ART DIRECTION)
            Strict architectural typography, frameless independent image adaptation,
            generous blank space layout adapting perfectly across all viewports.
            ═══════════════════════════════════════════════════════════════ */}

        {/* ── CHAPTER 01: STUDIO RECORD / "THE DEFAULT DIDN'T MAKE THE CUT" ── */}
        <div 
          ref={chapter1StageRef}
          className="absolute inset-0 z-35 flex items-center justify-center pointer-events-none"
          style={{ opacity: 0 }}
        >
          {/* Strictly contained within the central dark chamber */}
          <div className="w-full max-w-6xl mx-auto px-8 sm:px-12 md:px-16 lg:px-20 h-full flex flex-col justify-center py-[clamp(24px,5vh,60px)]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 items-center w-full">
              
              {/* Media Viewport (5 cols on desktop): Unframed adapting studio video */}
              <div className="lg:col-span-5 order-2 lg:order-1 flex justify-center lg:justify-start">
                <div className="relative w-full max-w-md overflow-hidden bg-black/60 shadow-[0_20px_45px_rgba(0,0,0,0.9)]">
                  <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 font-mono-archive text-[9px] uppercase tracking-[0.24em] text-[#D6CCBA]/80 bg-[#0A0A0A]/95 px-2 py-0.5">
                    <span className="text-[#FF0800] font-bold">*</span>
                    <span>ATELIER RECORD · DHAKA</span>
                  </div>

                  <video 
                    ref={videoRef}
                    src="/noire-archive-drop/assets/video/measuring-small.mp4" 
                    poster="/assets/img/measuring-poster-1600.webp" 
                    preload="auto"
                    muted 
                    playsInline 
                    onLoadedMetadata={(e) => {
                      videoDurationRef.current = e.currentTarget.duration || 4.546;
                    }}
                    className="w-full h-auto max-h-[40vh] sm:max-h-[44vh] lg:max-h-[54vh] object-cover filter contrast-[1.08] brightness-95"
                    aria-label="Artisan measuring and needle setup in studio"
                  />
                </div>
              </div>

              {/* Blank Space Typography (7 cols on desktop): Brutalist Typography, Zero Boxes */}
              <div className="lg:col-span-7 order-1 lg:order-2 flex flex-col justify-center">
                <div className="flex items-center gap-3 font-mono-archive text-[11px] sm:text-xs uppercase tracking-[0.28em] text-[#D6CCBA]/85 mb-3 sm:mb-5">
                  <span className="text-[#FF0800] font-bold text-base leading-none">*</span>
                  <span className="font-bold text-[#D6CCBA]">STUDIO SPECIFICATION</span>
                  <span className="text-[#D6CCBA]/30">/</span>
                  <span className="text-[#D6CCBA]/60">DHAKA ATELIER</span>
                </div>

                <h2 className="font-extenda-hecto font-normal uppercase text-[#F0F2F4] text-3xl sm:text-5xl md:text-6xl lg:text-[4.75rem] xl:text-[5.5rem] leading-[0.92] tracking-tight">
                  The default didn't make the cut
                </h2>

                <div className="pt-4 sm:pt-5 mt-4 sm:mt-5 border-t border-[#D6CCBA]/20 max-w-lg">
                  <p className="font-mono-archive text-xs sm:text-sm md:text-base text-[#D6CCBA] uppercase tracking-[0.2em] font-medium leading-relaxed">
                    Single handedly made in dhaka atelier, designed in Ireland
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── CHAPTER 02: WOVEN LABEL / "5MONTHS OF PATIENCE, 88 PIECE" ── */}
        <div 
          ref={chapter2StageRef}
          className="absolute inset-0 z-35 flex items-center justify-center pointer-events-none"
          style={{ opacity: 0 }}
        >
          {/* Strictly contained within the central dark chamber */}
          <div className="w-full max-w-6xl mx-auto px-8 sm:px-12 md:px-16 lg:px-20 h-full flex flex-col justify-center py-[clamp(24px,5vh,60px)]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 items-center w-full">
              
              {/* Picture (6 cols on desktop): Frameless, independently adapting image */}
              <div className="lg:col-span-6 order-2 lg:order-1 flex justify-center items-center">
                <img 
                  src="/assets/aistudio/_MG_5274_8b478bc1.jpg" 
                  alt="Atelier NOIRÉ authentic woven neck label"
                  className="w-auto max-w-full lg:max-w-md h-auto max-h-[38vh] sm:max-h-[44vh] lg:max-h-[54vh] object-contain drop-shadow-[0_24px_50px_rgba(0,0,0,0.95)] filter contrast-[1.05]"
                />
              </div>

              {/* Blank Space Typography (6 cols on desktop): Big yet readable Brutalist Typography */}
              <div className="lg:col-span-6 order-1 lg:order-2 flex flex-col justify-center">
                <div className="flex items-center gap-3 font-mono-archive text-[11px] sm:text-xs uppercase tracking-[0.28em] text-[#D6CCBA]/85 mb-3 sm:mb-5">
                  <span className="text-[#FF0800] font-bold text-base leading-none">*</span>
                  <span className="font-bold text-[#D6CCBA]">EDITION 01</span>
                  <span className="text-[#D6CCBA]/30">/</span>
                  <span className="text-[#D6CCBA]/60">LIMITED RELEASE</span>
                </div>

                <h2 className="font-extenda-hecto font-normal uppercase text-[#F0F2F4] text-3xl sm:text-5xl md:text-6xl lg:text-[4.75rem] xl:text-[5.5rem] leading-[0.92] tracking-tight">
                  <span className="font-impact font-bold">5</span>MONTHS OF PATIENCE, <span className="font-impact font-bold">88</span> PIECE
                </h2>

                <div className="pt-4 sm:pt-5 mt-4 sm:mt-5 border-t border-[#D6CCBA]/20 max-w-lg">
                  <p className="font-mono-archive text-[11px] sm:text-xs md:text-sm text-[#D6CCBA]/80 uppercase tracking-[0.24em] font-medium">
                    NO REISSUES · SINGLE BATCH DISCIPLINE
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            LAYER 4B: FULLSCREEN BRUTALIST TEXT-ONLY MANIFESTO
            Stark, monolithic architectural typography (Statement & Provenance Record)
            ═══════════════════════════════════════════════════════════════ */}
        <div 
          ref={manifestoStageRef}
          className="absolute inset-0 z-36 flex items-center justify-center pointer-events-none px-6 sm:px-10 md:px-14"
          style={{ opacity: 0 }}
        >
          {/* First Manifesto Statement: "This isn't your ordinary tracksuit" */}
          <div 
            ref={manifestoText1Ref}
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center max-w-4xl lg:max-w-5xl mx-auto px-4"
          >
            <div className="flex items-center justify-center gap-2.5 font-mono-archive text-[11px] sm:text-xs md:text-sm uppercase tracking-[0.38em] text-[#FF0800] mb-4 sm:mb-6 font-bold">
              <span className="text-base leading-none">*</span>
              <span>ARCHIVE DROP (#)</span>
            </div>
            <h2 className="font-extenda-hecto font-normal uppercase text-[#F0F2F4] text-3xl sm:text-5xl md:text-6xl lg:text-[5.5rem] xl:text-[6.25rem] leading-[0.9] tracking-tight">
              This isn't your ordinary tracksuit
            </h2>
          </div>

          {/* Follow-up Manifesto Statement: Provenance Record */}
          <div 
            ref={manifestoText2Ref}
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center max-w-4xl lg:max-w-5xl mx-auto px-4"
          >
            <div className="flex items-center justify-center gap-3 font-mono-archive text-[10px] sm:text-xs uppercase tracking-[0.44em] text-[#D6CCBA]/90 mb-5 sm:mb-7 font-medium">
              <span className="text-[#FF0800] font-bold text-sm leading-none">*</span>
              <span className="text-[#D6CCBA] font-semibold">PROVENANCE RECORD</span>
              <span className="text-[#D6CCBA]/30">/</span>
              <span className="text-[#D6CCBA]/70 tracking-[0.38em]">88 SETS WORLDWIDE</span>
            </div>
            <h2 className="font-extenda-hecto font-normal uppercase text-[#FFFFFF] text-2xl sm:text-4xl md:text-5xl lg:text-[4.5rem] xl:text-[5.25rem] leading-[1.06] sm:leading-[1.02] tracking-[0.03em] drop-shadow-[0_4px_35px_rgba(255,255,255,0.18)]">
              This is ownership on something that only <span className="font-impact font-bold tracking-normal text-[#FF0800]">88</span>/<span className="font-impact font-bold tracking-normal">8</span>BILLION people can have
            </h2>
            <div className="mt-6 sm:mt-8 flex items-center justify-center gap-6 font-mono-archive text-[10px] sm:text-xs uppercase tracking-[0.36em] text-[#D6CCBA]/65 border-t border-[#D6CCBA]/20 pt-4 max-w-md w-full">
              <span>ZERO RESTOCKS</span>
              <span className="text-[#D6CCBA]/30">·</span>
              <span>NUMBERED ARCHIVE</span>
            </div>
          </div>
        </div>

        {/* ── CHAPTER 03B: VALUATION / PROVENANCE CARDS & VALUE (AFTER STATEMENT & PROVENANCE RECORD) ── */}
        <div 
          ref={chapter3aStageRef}
          className="absolute inset-0 z-35 flex items-center justify-center pointer-events-none"
          style={{ opacity: 0 }}
        >
          {/* Strictly contained within the central dark chamber */}
          <div className="w-full max-w-6xl mx-auto px-8 sm:px-12 md:px-16 lg:px-20 h-full flex flex-col justify-center py-[clamp(24px,5vh,60px)]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 items-center w-full">
              
              {/* Picture (6 cols on desktop): Frameless archival cards & NOIRÉ mark */}
              <div className="lg:col-span-6 order-2 lg:order-1 flex justify-center items-center">
                <img 
                  src="/assets/aistudio/edited-image-1793723014_126eaedc.png" 
                  alt="Atelier NOIRÉ archive hangtags and identity graphic"
                  className="w-auto max-w-full lg:max-w-md h-auto max-h-[38vh] sm:max-h-[44vh] lg:max-h-[54vh] object-contain drop-shadow-[0_24px_50px_rgba(0,0,0,0.95)] filter contrast-[1.04]"
                />
              </div>

              {/* Blank Space Typography (6 cols on desktop): Big yet readable Brutalist Typography */}
              <div className="lg:col-span-6 order-1 lg:order-2 flex flex-col justify-center">
                <div className="flex items-center gap-3 font-mono-archive text-[11px] sm:text-xs uppercase tracking-[0.28em] text-[#D6CCBA]/85 mb-3 sm:mb-5">
                  <span className="text-[#FF0800] font-bold text-base leading-none">*</span>
                  <span className="font-bold text-[#D6CCBA]">VALUATION</span>
                  <span className="text-[#D6CCBA]/30">/</span>
                  <span className="text-[#D6CCBA]/60">DIRECT ATELIER PRICING</span>
                </div>

                <h2 className="font-extenda-hecto font-normal uppercase text-[#F0F2F4] text-4xl sm:text-6xl md:text-7xl lg:text-[6.5rem] xl:text-[7.5rem] leading-[0.88] tracking-tight">
                  ALL FOR <span className="font-impact font-bold tracking-tight">88€</span>
                </h2>

                <p className="font-extenda-hecto font-medium uppercase text-[#FFFFFF] text-2xl sm:text-4xl md:text-5xl lg:text-[3.75rem] xl:text-[4.5rem] leading-[1.05] tracking-[0.05em] mt-3 sm:mt-5 drop-shadow-[0_4px_30px_rgba(0,0,0,0.95)]">
                  <span className="text-[#FFFFFF]">LUXURY</span>
                  <span className="font-sans font-black text-[#FF0800] inline-block mx-2.5 sm:mx-4 text-3xl sm:text-5xl md:text-6xl align-middle drop-shadow-[0_0_16px_rgba(255,8,0,0.85)]">
                    ≠
                  </span>
                  <span className="text-[#FFFFFF]">EXPENSIVE.</span>
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            LAYER 5: CHAPTER 04 / BRUTALIST TOTEBAG SHOWCASE
            Pure editorial product spread following the brutalist theme
            ═══════════════════════════════════════════════════════════════ */}
        <div 
          ref={totebagStageRef}
          className="absolute inset-0 z-38 flex flex-col items-center justify-center px-8 sm:px-12 md:px-16 lg:px-20 max-w-5xl mx-auto w-full pt-16 sm:pt-20 pb-4"
          style={{ opacity: 0, pointerEvents: 'none' }}
        >
          <div className="w-full flex flex-col items-center gap-3 sm:gap-5 transform-gpu max-w-4xl">
            
            {/* Top Micro-Metadata Strip: Zero boxes, pure architectural line */}
            <div className="w-full flex items-center justify-between text-[10px] sm:text-[11px] font-mono-archive tracking-[0.24em] uppercase text-[#D6CCBA]/70 border-b border-[#D6CCBA]/15 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-[#FF0800] font-bold text-base leading-none">*</span>
                <span className="text-[#FF0800] font-bold">COMPLIMENTARY ARCHIVE PIECE</span>
                <span className="text-[#D6CCBA]/30 hidden sm:inline">·</span>
                <span className="hidden sm:inline">100% NATURAL FIBRE</span>
              </div>

              {/* Minimalist Slide Chevrons */}
              <div className="flex items-center gap-3 text-[#D6CCBA]/70 font-mono-archive text-[11px]">
                <span className="text-[#D6CCBA]/40 hidden sm:inline">SWIPE TO ROTATE</span>
                <button
                  type="button"
                  onClick={() => handleSlideChange(0)}
                  disabled={activeSlide === 0}
                  aria-label="Previous totebag"
                  className="hover:text-white disabled:opacity-20 cursor-pointer transition-colors"
                >
                  ←
                </button>
                <span className="text-[#D6CCBA]/30">/</span>
                <button
                  type="button"
                  onClick={() => handleSlideChange(1)}
                  disabled={activeSlide === 1}
                  aria-label="Next totebag"
                  className="hover:text-white disabled:opacity-20 cursor-pointer transition-colors"
                >
                  →
                </button>
              </div>
            </div>

            {/* Totebag Floating Stage: Zero border box, natural floor shadow */}
            <div 
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleTouchStart}
              onMouseUp={handleTouchEnd}
              className="relative w-full h-[36vh] sm:h-[40vh] md:h-[44vh] max-h-[460px] flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
            >
              {/* Realistic Ground Contact Shadow */}
              <div 
                className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 w-[55%] sm:w-[50%] h-6 sm:h-8 bg-black/80 rounded-[100%] blur-md pointer-events-none z-0" 
              />

              {/* Horizontal Sliding Track for the two authentic totebags */}
              <div 
                className="w-full h-full flex transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] transform-gpu relative z-10 pointer-events-none"
                style={{
                  transform: `translateX(-${activeSlide * 100}%)`,
                }}
              >
                {/* Totebag 01: Blue */}
                <div className="w-full h-full flex items-center justify-center shrink-0 flex-none p-2 sm:p-4">
                  <img 
                    src="/assets/aistudio/nobg-result__1__ee377718.png"
                    alt="100% natural fibre made embroidered totebag — Atelier NOIRÉ Edition Blue"
                    className="w-auto h-full max-h-[96%] object-contain filter drop-shadow-[0_24px_35px_rgba(0,0,0,0.85)] drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)] transform-gpu"
                    loading="eager"
                  />
                </div>

                {/* Totebag 02: Black */}
                <div className="w-full h-full flex items-center justify-center shrink-0 flex-none p-2 sm:p-4">
                  <img 
                    src="/assets/aistudio/nobg-result_9467ad38.png"
                    alt="100% natural fibre made embroidered totebag — Atelier NOIRÉ Edition Black"
                    className="w-auto h-full max-h-[96%] object-contain filter drop-shadow-[0_24px_35px_rgba(0,0,0,0.85)] drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)] transform-gpu"
                    loading="eager"
                  />
                </div>
              </div>
            </div>

            {/* Brutalist Editorial Typography for Totebag */}
            <div 
              ref={totebagTextRef}
              className="w-full flex flex-col space-y-3 sm:space-y-4"
            >
              <h2 className="font-extenda-hecto font-normal uppercase text-[#F0F2F4] text-3xl sm:text-5xl md:text-6xl lg:text-[4.75rem] leading-[0.9] tracking-tight">
                <span className="font-impact font-bold">100%</span> NATURAL FIBRE EMBROIDERED TOTEBAG
              </h2>
              
              <div className="pt-3 border-t border-[#D6CCBA]/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
                <p className="font-sans text-xs sm:text-sm md:text-base text-[#D6CCBA]/85 font-light leading-relaxed max-w-2xl">
                  Tailored from heavy natural cotton canvas with contrast geometric corner blocking and direct thread NOIRÉ embroidery. Included complimentary with each numbered tracksuit set.
                </p>

                {/* Clean Typographical Colourway Toggles */}
                <div className="flex items-center gap-3 font-mono-archive text-[11px] sm:text-xs uppercase tracking-[0.22em] shrink-0 self-end sm:self-auto">
                  <span className="text-[#D6CCBA]/40">COLOURWAY:</span>
                  <button
                    type="button"
                    onClick={() => handleSlideChange(0)}
                    className={`transition-all duration-300 py-1 px-2.5 border cursor-pointer ${
                      activeSlide === 0
                        ? 'border-[#8FA9C4] text-white bg-[#8FA9C4]/20 font-bold shadow-sm'
                        : 'border-transparent text-[#D6CCBA]/50 hover:text-[#D6CCBA]'
                    }`}
                  >
                    01 NAVY BLUE
                  </button>
                  <span className="text-[#D6CCBA]/25">/</span>
                  <button
                    type="button"
                    onClick={() => handleSlideChange(1)}
                    className={`transition-all duration-300 py-1 px-2.5 border cursor-pointer ${
                      activeSlide === 1
                        ? 'border-[#D6CCBA] text-white bg-[#D6CCBA]/20 font-bold shadow-sm'
                        : 'border-transparent text-[#D6CCBA]/50 hover:text-[#D6CCBA]'
                    }`}
                  >
                    02 OBSIDIAN BLACK
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            LAYER 6: THE CULMINATING REVEAL ("Own your difference" ONLY)
            Stripped-down sculptural typography with zero extra text
            ═══════════════════════════════════════════════════════════════ */}
        <div 
          ref={ownDifferenceRef}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center text-center px-4 sm:px-6 md:px-12 pointer-events-none select-none will-change-[transform,opacity]"
          style={{ opacity: 0, transform: 'translate3d(0, 28px, 0)' }}
        >
          <div className="max-w-5xl mx-auto flex flex-col items-center transform-gpu">
            <h2 className="leading-none tracking-tight flex items-baseline justify-center select-none whitespace-nowrap max-w-full">
              <span 
                className="font-amoresa text-[#FF0800] text-5xl min-[380px]:text-6xl sm:text-7xl md:text-8xl lg:text-[8rem] xl:text-[9.5rem] font-normal inline-block transform-gpu leading-none drop-shadow-[0_4px_35px_rgba(255,8,0,0.35)] translate-y-1 sm:translate-y-2"
              >
                O
              </span>
              <span 
                className="font-perandory text-[#F0F2F4] text-2xl min-[380px]:text-3xl sm:text-4xl md:text-5xl lg:text-[5.5rem] xl:text-[7rem] uppercase tracking-[0.05em] font-normal inline-block ml-1 sm:ml-2.5 leading-none"
              >
                wn your difference
              </span>
            </h2>
          </div>
        </div>

      </div>

    </div>
  );
};
