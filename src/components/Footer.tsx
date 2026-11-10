import React, { useEffect, useRef, useState } from "react";
import { CareModalTab } from "./CustomerCareModal";

/* ------------------------------------------------------------------ */
/*  CONTENT — edit text / links here only                              */
/* ------------------------------------------------------------------ */

const HEADLINE = [
  "ARCHIVE DROP NO. 01 /",
  "88 SETS•JUST THE BEGINNING",
  "2026®• ie~",
];

export type FooterLink = { 
  label: string; 
  href?: string; 
  tab?: CareModalTab; 
  external?: boolean;
  imageSrc?: string;
  imageAlt?: string;
};

// TikTok & WhatsApp image buttons replace Instagram & Editorial Inquiries
const LINKS: FooterLink[] = [
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@noire_ie1?_r=1&_t=ZS-9BHs55O7OaK",
    external: true,
    imageSrc: "/assets/aistudio/80cb644e10fd16f0da157bee10feb8a6_81c7539b.jpg",
    imageAlt: "Atelier NOIRÉ on TikTok",
  },
  {
    label: "WhatsApp",
    href: "https://wa.me/353899636843",
    external: true,
    imageSrc: "/assets/aistudio/02457c4b7b0f56db2b3e188d5d273509_7f78e4ff.jpg",
    imageAlt: "Message Atelier NOIRÉ on WhatsApp (+353 89 963 6843)",
  },
  { label: "Concierge Orders", tab: "shipping" },
  { label: "14-Day Returns & Care", tab: "returns" },
  { label: "Privacy & GDPR", tab: "privacy" },
];

const EMAIL = "noire.ireland@gmail.com";

const d = (s: number) => ({ ["--d" as string]: `${s}s` } as React.CSSProperties);

export interface FooterProps {
  onOpenCareModal?: (tab: CareModalTab) => void;
}

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

const Footer: React.FC<FooterProps> = ({ onOpenCareModal }) => {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  // Trigger animations once when the footer scrolls into view
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Subtle mouse parallax for the red (#) ring (mouse only, not touch)
  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    e.currentTarget.style.setProperty("--mx", x.toFixed(3));
    e.currentTarget.style.setProperty("--my", y.toFixed(3));
  };
  const onLeave = (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.style.setProperty("--mx", "0");
    e.currentTarget.style.setProperty("--my", "0");
  };

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleLinkClick = (e: React.MouseEvent, link: FooterLink) => {
    if (link.tab) {
      e.preventDefault();
      onOpenCareModal?.(link.tab);
    }
  };

  const handleRegistryClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.history.pushState({}, "", "/admin");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <footer
      ref={ref}
      id="returns"
      className={`nf ${inView ? "is-in" : ""}`}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      role="contentinfo"
      aria-label="Atelier NOIRÉ Archive drop editorial footer"
    >
      <style>{css}</style>

      {/* ============ 1. GIANT HEADLINE + RED (#) RING ============ */}
      <div className="nf-hero">
        <h2
          className="nf-headline"
          aria-label="Archive Drop No. 01 / 88 Sets. Just the beginning. 2026"
        >
          {HEADLINE.map((line, i) => (
            <span className="nf-line" key={i} aria-hidden="true">
              <span className="nf-line-inner" style={d(0.08 + i * 0.12)}>
                {line}
              </span>
            </span>
          ))}
        </h2>

        {/* Interactive red (#) circular ring with bold outline overlapping the main text */}
        <button
          type="button"
          onClick={scrollToTop}
          className="nf-ring-btn"
          aria-label="Back to top of page"
          title="Return to top"
        >
          <div className="nf-ring-wrap" style={d(0.25)}>
            <svg
              className="nf-ring-svg"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                className="nf-ring-circle"
                cx="50"
                cy="50"
                r="44"
                stroke="currentColor"
                strokeWidth="6.5"
                strokeLinecap="round"
              />
            </svg>
            <div className="nf-ring-content">
              <span className="nf-ring-hash">(#)</span>
            </div>
          </div>
        </button>
      </div>

      {/* ============ 2. HAIRLINE RULE ============ */}
      <div className="nf-rule-container" style={d(0.4)}>
        <hr className="nf-rule" />
      </div>

      {/* ============ 3. THREE MICRO-COLUMNS (REFERENCE 2 GRID) ============ */}
      <div className="nf-meta-grid" style={d(0.48)}>
        {/* Column 1: Archive Run with pulsing red dot */}
        <div className="nf-meta-col nf-meta-col-1">
          <div className="nf-badge">
            <span className="nf-dot" aria-hidden="true" />
            <span className="nf-badge-text">ARCHIVE RUN · 88 SETS WORLDWIDE</span>
          </div>
        </div>

        {/* Column 2: Ireland Coverage */}
        <div className="nf-meta-col nf-meta-col-2">
          <p className="nf-meta-text">
            ALL 26 COUNTIES OF IRELAND* (FREE COD)
          </p>
        </div>

        {/* Column 3: Dublin Returns Link */}
        <div className="nf-meta-col nf-meta-col-3">
          <button
            type="button"
            onClick={() => onOpenCareModal?.("returns")}
            className="nf-meta-action"
          >
            STATUTORY 14-DAY RETURNS · DUBLIN, IRELAND
          </button>
        </div>
      </div>

      {/* ============ 4. LOWER CONTENT BLOCK (ABOUT & DIRECTORY) ============ */}
      <div className="nf-body-grid">
        {/* Left column: ABOUT section */}
        <div className="nf-about-col" style={d(0.56)}>
          <span className="nf-section-tag">ABOUT</span>
          <p className="nf-about-desc">
            This archive drop embodies the philosophy of Atelier Noiré: precision
            tailoring, raw textile weight and restrained monolithic silhouettes.
            Dublin designed. Dhaka atelier tailored. Heavyweight{" "}
            <span className="nf-highlight">390 GSM</span> loopback fleece top and{" "}
            <span className="nf-highlight">280 GSM</span> structured trousers.
            Strictly <span className="nf-highlight">eighty-eight</span> individually
            numbered sets worldwide. No reprint, no seasonal reissue.
          </p>
          <div className="nf-about-contact">
            <span className="nf-contact-label">DIRECT LIAISON:</span>{" "}
            <a href={`mailto:${EMAIL}`} className="nf-email-link">
              {EMAIL}
            </a>
          </div>
        </div>

        {/* Right column: DIRECTORY / LIAISON */}
        <div className="nf-dir-col" style={d(0.64)}>
          <span className="nf-section-tag">DIRECTORY / LIAISON</span>
          <ul className="nf-nav-list" role="list">
            {LINKS.map((link, idx) => (
              <li key={link.label} className="nf-nav-item">
                {link.tab ? (
                  <button
                    type="button"
                    onClick={(e) => handleLinkClick(e, link)}
                    className="nf-nav-link"
                  >
                    <span className="nf-nav-index">
                      ({String(idx + 1).padStart(2, "0")})
                    </span>
                    <span className="nf-nav-label">{link.label}</span>
                    <span className="nf-nav-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </button>
                ) : link.imageSrc ? (
                  <a
                    href={link.href || "#"}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    aria-label={link.imageAlt || link.label}
                    className="nf-nav-link nf-nav-media-link"
                  >
                    <span className="nf-nav-index">
                      ({String(idx + 1).padStart(2, "0")})
                    </span>
                    <span className="nf-nav-media-wrap">
                      <img
                        src={link.imageSrc}
                        alt={link.imageAlt || link.label}
                        className="nf-nav-media-img"
                        loading="lazy"
                      />
                    </span>
                    <span className="nf-nav-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </a>
                ) : (
                  <a
                    href={link.href || "#"}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="nf-nav-link"
                  >
                    <span className="nf-nav-index">
                      ({String(idx + 1).padStart(2, "0")})
                    </span>
                    <span className="nf-nav-label">{link.label}</span>
                    <span className="nf-nav-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ============ 5. LEGAL & REGISTRY FOOTER BAR ============ */}
      <div className="nf-legal-bar" style={d(0.72)}>
        <div className="nf-legal-left">
          © 2026 ATELIER NOIRÉ · DUBLIN, IRELAND. ALL RIGHTS RESERVED.
        </div>
        <div className="nf-legal-right">
          <span>EDITION 01 / 88 SETS</span>
          <span className="nf-legal-sep" aria-hidden="true">•</span>
          <button
            type="button"
            onClick={() => onOpenCareModal?.("returns")}
            className="nf-legal-action"
          >
            CUSTOMER CARE
          </button>
          <span className="nf-legal-sep" aria-hidden="true">•</span>
          <a
            href="/admin"
            onClick={handleRegistryClick}
            className="nf-registry-link"
            title="Administrator Registry Login"
          >
            [ REGISTRY ]
          </a>
        </div>
      </div>
    </footer>
  );
};

export { Footer };
export default Footer;

/* ------------------------------------------------------------------ */
/*  CSS STYLES — STRICT REFERENCE 2 GRID & MONOCHROME/RED PALETTE     */
/* ------------------------------------------------------------------ */

const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');

.nf {
  --nf-bg: #151515;
  --nf-headline: #D1D3D4;
  --nf-text: #B4B8BC;
  --nf-meta: #82878D;
  --nf-rule: rgba(255, 255, 255, 0.12);
  --nf-red: #ff2a1f;
  --nf-font-head: 'Inter Tight', -apple-system, BlinkMacSystemFont, sans-serif;
  --nf-font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
  --nf-ease: cubic-bezier(0.16, 1, 0.3, 1);
  --mx: 0;
  --my: 0;

  position: relative;
  width: 100%;
  background: var(--nf-bg);
  color: var(--nf-text);
  padding: 3.5rem 1.25rem 2rem;
  box-sizing: border-box;
  overflow: hidden;
  font-family: var(--nf-font-head);
  -webkit-font-smoothing: antialiased;
}

@media (min-width: 640px) {
  .nf {
    padding: 4rem 2rem 2.5rem;
  }
}

@media (min-width: 1024px) {
  .nf {
    padding: 5rem 3.5rem 3rem;
  }
}

/* 1. GIANT HEADLINE + RED RING (HERO ROW) */
.nf-hero {
  position: relative;
  width: 100%;
  display: block;
  margin-bottom: 2.75rem;
}

@media (min-width: 768px) {
  .nf-hero {
    margin-bottom: 3.75rem;
  }
}

@media (min-width: 1024px) {
  .nf-hero {
    margin-bottom: 4.75rem;
  }
}

.nf-headline {
  margin: 0;
  padding: 0;
  width: 100%;
  display: block;
  font-family: var(--nf-font-head);
  font-size: clamp(1.5rem, 6.55vw, 2.5rem);
  font-weight: 850;
  line-height: 0.90;
  letter-spacing: -0.045em;
  text-transform: uppercase;
  color: var(--nf-headline);
}

@media (min-width: 640px) {
  .nf-headline {
    font-size: clamp(2.8rem, 6.75vw, 5.2rem);
    line-height: 0.89;
    letter-spacing: -0.048em;
  }
}

@media (min-width: 1024px) {
  .nf-headline {
    font-size: clamp(4.6rem, 6.78vw, 10.5rem);
    line-height: 0.88;
    letter-spacing: -0.05em;
  }
}

.nf-line {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  width: 100%;
}

.nf-line-inner {
  display: block;
  transform: translateY(105%);
  opacity: 0;
  transition: transform 1.4s var(--nf-ease), opacity 1.4s var(--nf-ease);
  transition-delay: var(--d, 0s);
  will-change: transform, opacity;
}

.nf.is-in .nf-line-inner {
  transform: translateY(0);
  opacity: 1;
}

/* RED (#) RING BUTTON — BOLD OUTLINE & SUBTLE TEXT OVERLAP */
.nf-ring-btn {
  position: absolute;
  right: 0;
  bottom: clamp(-6px, 0.4vw, 16px);
  z-index: 5;
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  outline: none;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.nf-ring-wrap {
  position: relative;
  width: clamp(100px, 17vw, 240px);
  height: clamp(100px, 17vw, 240px);
  color: var(--nf-red);
  transform: translate(calc(var(--mx) * 12px), calc(var(--my) * 12px)) scale(0.92);
  opacity: 0;
  transition: transform 0.25s ease-out, opacity 1.2s var(--nf-ease);
  transition-delay: var(--d, 0s);
}

@media (max-width: 639px) {
  .nf-ring-btn {
    bottom: -8px;
    right: 0;
  }
  .nf-ring-wrap {
    width: clamp(92px, 24vw, 125px);
    height: clamp(92px, 24vw, 125px);
  }
}

.nf.is-in .nf-ring-wrap {
  opacity: 1;
  transform: translate(calc(var(--mx) * 12px), calc(var(--my) * 12px)) scale(1);
}

.nf-ring-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
  overflow: visible;
}

.nf-ring-circle {
  stroke-dasharray: 277;
  stroke-dashoffset: 277;
  transition: stroke-dashoffset 1.8s var(--nf-ease), stroke-width 0.25s ease;
  transition-delay: 0.25s;
}

.nf.is-in .nf-ring-circle {
  stroke-dashoffset: 0;
}

.nf-ring-content {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.nf-ring-hash {
  font-family: var(--nf-font-head);
  font-size: clamp(2rem, 4.5vw, 4.5rem);
  font-weight: 900;
  letter-spacing: -0.04em;
  color: var(--nf-red);
  transition: transform 0.3s var(--nf-ease);
  line-height: 1;
}

.nf-ring-btn:hover .nf-ring-hash {
  transform: scale(1.08);
}

.nf-ring-btn:hover .nf-ring-circle {
  stroke-width: 8;
}

/* 2. HAIRLINE RULE */
.nf-rule-container {
  width: 100%;
  margin-bottom: 1.5rem;
  opacity: 0;
  transform: scaleX(0.01);
  transform-origin: left center;
  transition: opacity 1.2s var(--nf-ease), transform 1.2s var(--nf-ease);
  transition-delay: var(--d, 0s);
}

.nf.is-in .nf-rule-container {
  opacity: 1;
  transform: scaleX(1);
}

.nf-rule {
  border: none;
  height: 1px;
  background: var(--nf-rule);
  margin: 0;
  padding: 0;
}

/* 3. THREE MICRO-COLUMNS */
.nf-meta-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  padding-bottom: 2rem;
  margin-bottom: 2rem;
  opacity: 0;
  transform: translateY(14px);
  transition: opacity 1.1s var(--nf-ease), transform 1.1s var(--nf-ease);
  transition-delay: var(--d, 0s);
}

.nf.is-in .nf-meta-grid {
  opacity: 1;
  transform: translateY(0);
}

@media (min-width: 768px) {
  .nf-meta-grid {
    grid-template-columns: 1.2fr 1fr 1fr;
    gap: 2rem;
    padding-bottom: 2.5rem;
    margin-bottom: 2.5rem;
  }
}

.nf-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

.nf-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--nf-red);
  box-shadow: 0 0 10px rgba(255, 42, 31, 0.7);
  display: inline-block;
}

.nf-badge-text,
.nf-meta-text {
  font-family: var(--nf-font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nf-meta);
  margin: 0;
  line-height: 1.4;
}

.nf-meta-action {
  font-family: var(--nf-font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nf-meta);
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  text-align: left;
  transition: color 0.25s ease;
}

.nf-meta-action:hover {
  color: #fff;
}

/* 4. LOWER BODY GRID (ABOUT & DIRECTORY) */
.nf-body-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem;
  margin-bottom: 3.5rem;
}

@media (min-width: 900px) {
  .nf-body-grid {
    grid-template-columns: 1.4fr 1fr;
    gap: 4rem;
  }
}

.nf-section-tag {
  display: block;
  font-family: var(--nf-font-mono);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--nf-meta);
  margin-bottom: 1.25rem;
}

.nf-about-col,
.nf-dir-col {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 1.1s var(--nf-ease), transform 1.1s var(--nf-ease);
  transition-delay: var(--d, 0s);
}

.nf.is-in .nf-about-col,
.nf.is-in .nf-dir-col {
  opacity: 1;
  transform: translateY(0);
}

.nf-about-desc {
  font-size: clamp(0.92rem, 1.1vw, 1.05rem);
  line-height: 1.65;
  color: var(--nf-text);
  margin: 0 0 1.5rem 0;
  max-width: 620px;
}

.nf-highlight {
  color: var(--nf-red);
  font-weight: 600;
}

.nf-about-contact {
  font-family: var(--nf-font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  color: var(--nf-meta);
}

.nf-contact-label {
  color: var(--nf-meta);
  margin-right: 0.35rem;
}

.nf-email-link {
  color: #fff;
  text-decoration: underline;
  text-decoration-color: var(--nf-red);
  text-underline-offset: 4px;
  transition: color 0.2s ease, text-decoration-color 0.2s ease;
}

.nf-email-link:hover {
  color: var(--nf-red);
}

/* DIRECTORY LINKS */
.nf-nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.nf-nav-item {
  width: 100%;
}

.nf-nav-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: transparent;
  border: none;
  border-radius: 10px;
  padding: 0.55rem 0.45rem;
  margin: 0;
  color: var(--nf-headline);
  text-decoration: none;
  font-family: var(--nf-font-head);
  font-size: clamp(0.95rem, 1.15vw, 1.1rem);
  font-weight: 500;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: color 0.25s ease, border-color 0.25s ease, background-color 0.25s ease, padding 0.25s ease;
  box-sizing: border-box;
}

.nf-nav-link:hover {
  color: #fff;
  background-color: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.2);
  padding-left: 0.65rem;
}

.nf-nav-media-link {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}

.nf-nav-media-wrap {
  flex: 1;
  display: flex;
  align-items: center;
}

.nf-nav-media-img {
  width: 54px;
  height: 54px;
  border-radius: 14px;
  object-fit: cover;
  display: block;
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
  transition: transform 0.28s var(--nf-ease), border-color 0.25s ease;
}

.nf-nav-media-link:hover .nf-nav-media-img {
  transform: scale(1.06);
  border-color: rgba(255, 42, 31, 0.65);
}

.nf-nav-index {
  font-family: var(--nf-font-mono);
  font-size: 0.75rem;
  color: var(--nf-meta);
  margin-right: 1rem;
  transition: color 0.25s ease;
}

.nf-nav-link:hover .nf-nav-index {
  color: var(--nf-red);
}

.nf-nav-label {
  flex: 1;
  text-align: left;
}

.nf-nav-arrow {
  color: var(--nf-meta);
  font-size: 0.95rem;
  transition: transform 0.25s var(--nf-ease), color 0.25s ease;
}

.nf-nav-link:hover .nf-nav-arrow {
  transform: translate(3px, -3px);
  color: var(--nf-red);
}

/* 5. BOTTOM LEGAL BAR */
.nf-legal-bar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  justify-content: space-between;
  align-items: flex-start;
  padding-top: 1.5rem;
  border-top: 1px solid var(--nf-rule);
  font-family: var(--nf-font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--nf-meta);
  opacity: 0;
  transition: opacity 1s var(--nf-ease);
  transition-delay: var(--d, 0s);
}

@media (min-width: 768px) {
  .nf-legal-bar {
    flex-direction: row;
    align-items: center;
  }
}

.nf.is-in .nf-legal-bar {
  opacity: 1;
}

.nf-legal-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.nf-legal-sep {
  color: var(--nf-red);
}

.nf-legal-action {
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  color: var(--nf-meta);
  font-family: inherit;
  font-size: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  cursor: pointer;
  transition: color 0.2s ease;
}

.nf-legal-action:hover {
  color: #fff;
}

.nf-registry-link {
  color: var(--nf-meta);
  text-decoration: none;
  transition: color 0.2s ease;
}

.nf-registry-link:hover {
  color: var(--nf-red);
}

/* REDUCED MOTION ACCESSIBILITY */
@media (prefers-reduced-motion: reduce) {
  .nf-line-inner,
  .nf-ring-wrap,
  .nf-ring-circle,
  .nf-rule-container,
  .nf-meta-grid,
  .nf-about-col,
  .nf-dir-col,
  .nf-legal-bar {
    transition: none !important;
    transform: none !important;
    opacity: 1 !important;
    stroke-dashoffset: 0 !important;
  }
}
`;
