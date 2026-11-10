import React, { useState, useEffect, useRef } from 'react';
import { ARCHIVE_SPECS, SIZE_SPECIFICATIONS, FIT_MODELS, CUSTOMER_CARE_DETAILS } from '../utils/archive-data';

export type CareModalTab = 'returns' | 'shipping' | 'sizing' | 'care' | 'privacy' | 'contact';

interface CustomerCareModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: CareModalTab;
}

export const CustomerCareModal: React.FC<CustomerCareModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'returns',
}) => {
  const [activeTab, setActiveTab] = useState<CareModalTab>(initialTab);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollPrompt, setShowScrollPrompt] = useState<boolean>(true);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Reset scroll position to top when tab changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      setShowScrollPrompt(true);
    }
  }, [activeTab]);

  // Handle ESC key and scroll locking
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop > 40) {
      setShowScrollPrompt(false);
    }
  };

  if (!isOpen) return null;

  const tabs: { id: CareModalTab; label: string; code: string; badge?: string }[] = [
    { id: 'returns', code: '01', label: 'Returns & 14-Day Rights', badge: 'STATUTORY' },
    { id: 'shipping', code: '02', label: 'Delivery & COD', badge: 'FREE IE' },
    { id: 'sizing', code: '03', label: 'Size Chart & Fit' },
    { id: 'care', code: '04', label: 'Garment Care' },
    { id: 'privacy', code: '05', label: 'Privacy & GDPR' },
    { id: 'contact', code: '06', label: 'Concierge Contact' },
  ];

  return (
    <div 
      className="fixed inset-0 z-[2500] flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/85 backdrop-blur-md animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="care-modal-title"
      data-lenis-prevent="true"
    >
      {/* Backdrop click to dismiss */}
      <div 
        className="fixed inset-0 cursor-pointer" 
        onClick={onClose}
        aria-hidden="true" 
      />

      {/* Sophisticated Architectural Modal Box with Deterministic Flexbox Layout */}
      <div 
        className="relative z-10 w-full max-w-4xl bg-[#141414] text-[#D6CCBA] border-2 border-[#D6CCBA]/35 shadow-[0_35px_80px_-15px_rgba(0,0,0,0.95)] flex flex-col h-[88vh] max-h-[820px] min-h-[480px] overflow-hidden rounded-none ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
        data-lenis-prevent="true"
      >
        {/* Architectural Double-Accent Bezel */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#D6CCBA]/40 via-[#FF0800] to-[#D6CCBA]/40" />

        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-[#D6CCBA]/15 bg-[#1B1A19]/90 shrink-0 select-none">
          <div className="flex items-center gap-3.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF0800] shadow-[0_0_10px_rgba(255,8,0,0.8)] shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono-archive uppercase tracking-[0.26em] text-[#D6CCBA]/60 block leading-tight">
                  ATELIER NOIRÉ · CLIENT CARE & POLICY DOSSIER
                </span>
                <span className="hidden sm:inline-block text-[9px] font-mono-archive px-1.5 py-0.5 bg-[#2B2A28] text-[#D6CCBA]/80 border border-[#D6CCBA]/20 uppercase tracking-widest">
                  DUBLIN
                </span>
              </div>
              <h2 id="care-modal-title" className="font-serif-editorial text-xl sm:text-2xl text-[#FFFFFF] font-light leading-snug mt-0.5">
                Client Care, Sizing & Statutory Policies
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-[#D6CCBA]/30 hover:border-[#D6CCBA] hover:bg-[#D6CCBA] hover:text-[#161616] text-[#D6CCBA] text-xs font-mono-archive uppercase tracking-wider font-bold transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
            aria-label="Close care dossier"
          >
            <span>CLOSE</span>
            <span className="text-sm leading-none">✕</span>
          </button>
        </div>

        {/* Horizontal Tab Navigation Strip */}
        <div className="flex items-center gap-1.5 px-4 sm:px-8 py-2.5 bg-[#101010] border-b border-[#D6CCBA]/15 overflow-x-auto scrollbar-none shrink-0 select-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-2 text-xs font-mono-archive uppercase tracking-wider whitespace-nowrap transition-all border cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? 'bg-[#D6CCBA] text-[#161616] border-[#D6CCBA] font-extrabold shadow-md scale-[1.01]'
                    : 'bg-[#181818] text-[#D6CCBA]/70 border-[#D6CCBA]/15 hover:text-white hover:border-[#D6CCBA]/40 hover:bg-[#202020]'
                }`}
              >
                <span className={`text-[10px] opacity-60 font-mono ${isActive ? 'text-[#161616]' : 'text-[#D6CCBA]/50'}`}>
                  {tab.code}
                </span>
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[9px] px-1.5 py-0.5 font-bold uppercase tracking-wider ${
                    isActive ? 'bg-[#161616] text-[#D6CCBA]' : 'bg-[#2B2A28] text-[#D6CCBA]'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            DETERMINISTICALLY SCROLLABLE CONTENT BODY
            flex-1 min-h-0 + overflow-y-auto guarantees smooth independent scrolling
            ═══════════════════════════════════════════════════════════════ */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-8 md:p-10 space-y-8 text-sm font-sans leading-relaxed text-[#D6CCBA]/90 select-text"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
            scrollbarColor: '#2B2A28 #141414',
          }}
          data-lenis-prevent="true"
        >

          {/* ────────────────── 1. RETURNS & STATUTORY CANCELLATION ────────────────── */}
          {activeTab === 'returns' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-[#D6CCBA]/15 pb-4">
                <span className="text-[10px] font-mono-archive uppercase tracking-[0.22em] text-[#FF0800] block mb-1 font-bold">
                  § 01 · STATUTORY CONSUMER PROTECTION · IRELAND & EU
                </span>
                <h3 className="font-serif-editorial text-2xl sm:text-3xl text-[#FFFFFF] font-light">
                  Returns & Statutory 14-Day Online Cancellation
                </h3>
                <p className="font-mono-archive text-xs text-[#D6CCBA]/70 mt-1.5">
                  Governed strictly by the Irish Consumer Rights Act 2022 & European Union Consumer Rights Directive
                </p>
              </div>

              {/* Core Statutory Cancellation Right Box */}
              <div className="p-5 bg-[#1F1E1D] border-2 border-[#D6CCBA]/30 space-y-3 shadow-lg">
                <div className="flex items-center gap-2 text-xs font-mono-archive uppercase tracking-wider text-white font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#D6CCBA]" />
                  <span>14-DAY STATUTORY RIGHT OF WITHDRAWAL (COOLING-OFF PERIOD)</span>
                </div>
                <p className="text-xs sm:text-sm text-[#D6CCBA]/95 leading-relaxed">
                  Under the European Union (Consumer Information, Cancellation and Other Rights) Regulations and the Irish Consumer Rights Act 2022, every client who purchases an Atelier NOIRÉ garment online has the statutory right to cancel their order within <strong>14 calendar days</strong> from the date of physical delivery without providing any reason.
                </p>
                <p className="text-xs sm:text-sm text-[#D6CCBA]/90 leading-relaxed border-t border-[#D6CCBA]/15 pt-2.5">
                  We never operate a blanket &ldquo;no-returns&rdquo; policy or attempt to waive statutory rights. Every numbered set delivered across Ireland is protected by authoritative consumer law.
                </p>
              </div>

              {/* Conditions & Return Postage */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-5 bg-[#181818] border border-[#D6CCBA]/20 space-y-3">
                  <h4 className="font-mono-archive text-xs uppercase tracking-wider text-white font-bold flex items-center gap-2">
                    <span className="text-[#FF0800]">01.1</span>
                    <span>Garment Condition Standards</span>
                  </h4>
                  <ul className="text-xs text-[#D6CCBA]/85 space-y-2 list-disc pl-4 font-mono-archive leading-relaxed">
                    <li>Garments must remain unwashed, unworn outside, and in pristine archive condition.</li>
                    <li>Trying garments on indoors for fit and proportion evaluation is fully permitted.</li>
                    <li>Must be returned with the original rigid black presentation box, embroidered canvas totebag, hangtags, and numbered certificate of authenticity intact.</li>
                    <li>Items returned showing wear, washing, makeup, scent, or pet hair are subject to statutory deduction for diminished value.</li>
                  </ul>
                </div>

                <div className="p-5 bg-[#181818] border border-[#D6CCBA]/20 space-y-3">
                  <h4 className="font-mono-archive text-xs uppercase tracking-wider text-white font-bold flex items-center gap-2">
                    <span className="text-[#FF0800]">01.2</span>
                    <span>Return Postage Logistics</span>
                  </h4>
                  <ul className="text-xs text-[#D6CCBA]/85 space-y-2 list-disc pl-4 font-mono-archive leading-relaxed">
                    <li><strong>Change-of-mind cancellations:</strong> In accordance with statutory online sales law, the customer pays direct return postage costs. We recommend an insured, trackable postal service (e.g. An Post Express Post or registered courier).</li>
                    <li><strong>Faulty, damaged, or incorrect pieces:</strong> Atelier NOIRÉ pays 100% of return logistics expenses and will provide a pre-paid collection label or reimburse courier fees in full.</li>
                  </ul>
                </div>
              </div>

              {/* Faulty / Incorrect Goods Legal Remedies */}
              <div className="p-5 bg-[#1A1515] border-2 border-[#FF0800]/50 space-y-3 shadow-md">
                <h4 className="font-mono-archive text-xs uppercase tracking-wider text-[#FF0800] font-extrabold flex items-center gap-2">
                  <span>STATUTORY REMEDIES FOR FAULTY OR INCORRECT GOODS</span>
                </h4>
                <p className="text-xs sm:text-sm text-[#D6CCBA]/95 leading-relaxed">
                  Under Irish Consumer Law, you are legally entitled to garments that are as described, of satisfactory quality, and fit for purpose. If an item arrives with a textile defect, sewing flaw, transit damage, or is an incorrect variant, you are entitled to:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 font-mono-archive text-xs">
                  <div className="p-3 bg-[#161616] border border-[#D6CCBA]/20">
                    <span className="text-white font-bold block mb-1">PRIORITY REPLACEMENT</span>
                    <span className="text-[#D6CCBA]/75">Immediate exchange priority from archive reserves.</span>
                  </div>
                  <div className="p-3 bg-[#161616] border border-[#D6CCBA]/20">
                    <span className="text-white font-bold block mb-1">FREE RETURN COURIER</span>
                    <span className="text-[#D6CCBA]/75">100% courier collection cost covered by Atelier NOIRÉ.</span>
                  </div>
                  <div className="p-3 bg-[#161616] border border-[#D6CCBA]/20">
                    <span className="text-white font-bold block mb-1">FULL SEPA REFUND</span>
                    <span className="text-[#D6CCBA]/75">Electronic bank transfer to your nominated account.</span>
                  </div>
                </div>
              </div>

              {/* 4-Step Process Guide */}
              <div className="p-5 bg-[#181818] border border-[#D6CCBA]/20 space-y-3">
                <h4 className="font-mono-archive text-xs uppercase tracking-wider text-white font-bold">
                  Step-by-Step Return Procedure:
                </h4>
                <ol className="text-xs font-mono-archive text-[#D6CCBA]/85 space-y-2 list-decimal pl-4 leading-relaxed">
                  <li>Email our concierge at <a href="mailto:noire.ireland@gmail.com" className="text-white underline underline-offset-4 font-bold hover:text-[#FF0800]">noire.ireland@gmail.com</a> within 14 days of delivery with your Order Reference (e.g. <code>NOIRE-2026-XXXX</code>).</li>
                  <li>Our studio acknowledges your notification within 24 business hours and issues an authorized Return Tracking Number and physical Dublin return address.</li>
                  <li>Package the tracksuit securely in its archival black presentation box with all certificates and dispatch via trackable courier.</li>
                  <li>Upon condition inspection at our Dublin studio, your refund will be disbursed within 14 days via direct electronic bank transfer (SEPA) to your account.</li>
                </ol>
              </div>

              {/* Transparent Physical Address Notice */}
              <div className="p-3.5 bg-[#101010] border border-[#D6CCBA]/20 text-[11px] font-mono-archive text-[#D6CCBA]/65 space-y-1">
                <span className="text-white font-bold uppercase block">ATELIER TRANSPARENCY NOTICE:</span>
                <p>
                  Direct physical studio return address in Dublin is provided with each verified Return Authorization number. Formal CRO company registration numbers and registered Dublin postal headquarters will be finalized prior to public commercial launch.
                </p>
              </div>
            </div>
          )}

          {/* ────────────────── 2. SHIPPING & CASH ON DELIVERY ────────────────── */}
          {activeTab === 'shipping' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-[#D6CCBA]/15 pb-4">
                <span className="text-[10px] font-mono-archive uppercase tracking-[0.22em] text-[#D6CCBA]/70 block mb-1 font-bold">
                  § 02 · LOGISTICS SPECIFICATION · ALL 26 COUNTIES OF IRELAND*
                </span>
                <h3 className="font-serif-editorial text-2xl sm:text-3xl text-[#FFFFFF] font-light">
                  Complimentary Ireland Delivery & Cash on Delivery (COD)
                </h3>
                <p className="font-mono-archive text-xs text-[#D6CCBA]/70 mt-1.5">
                  Direct insured courier service across all 26 counties of Ireland*
                </p>
              </div>

              {/* 3 Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono-archive text-xs">
                <div className="p-4 bg-[#1F1E1D] border border-[#D6CCBA]/25">
                  <span className="text-[10px] uppercase text-[#D6CCBA]/60 block mb-1">SHIPPING TARIFF</span>
                  <span className="text-xl font-serif-editorial text-white font-bold block">100% FREE</span>
                  <span className="text-[11px] text-[#D6CCBA]/80 block mt-1">Free delivery to all 26 counties of Ireland*.</span>
                </div>
                <div className="p-4 bg-[#1F1E1D] border border-[#D6CCBA]/25">
                  <span className="text-[10px] uppercase text-[#D6CCBA]/60 block mb-1">DISPATCH ESTIMATE</span>
                  <span className="text-xl font-serif-editorial text-white font-bold block">1–2 BUSINESS DAYS</span>
                  <span className="text-[11px] text-[#D6CCBA]/80 block mt-1">Studio inspection & packaging.</span>
                </div>
                <div className="p-4 bg-[#1F1E1D] border border-[#D6CCBA]/25">
                  <span className="text-[10px] uppercase text-[#D6CCBA]/60 block mb-1">COURIER TRANSIT</span>
                  <span className="text-xl font-serif-editorial text-white font-bold block">2–3 BUSINESS DAYS</span>
                  <span className="text-[11px] text-[#D6CCBA]/80 block mt-1">Standard delivery across all 26 counties of Ireland*.</span>
                </div>
              </div>

              {/* COD Mechanics */}
              <div className="p-5 bg-[#181818] border border-[#D6CCBA]/25 space-y-3">
                <h4 className="font-mono-archive text-xs uppercase tracking-wider text-white font-bold">
                  How Cash on Delivery (COD) Works:
                </h4>
                <p className="text-xs sm:text-sm text-[#D6CCBA]/95 leading-relaxed">
                  We believe in zero financial risk for collectors. When you submit your order, <strong>no card information or online advance payment is taken</strong>. Your set is allocated in our registry and hand-prepared at our studio.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 font-mono-archive text-xs">
                  <div className="p-3 bg-[#121212] border border-[#D6CCBA]/15">
                    <span className="text-[#FF0800] font-bold block mb-1">STEP 01: RESERVE</span>
                    <span>Submit your name, delivery address, Eircode & mobile number.</span>
                  </div>
                  <div className="p-3 bg-[#121212] border border-[#D6CCBA]/15">
                    <span className="text-[#FF0800] font-bold block mb-1">STEP 02: CONFIRMATION</span>
                    <span>Receive automated archive confirmation and dispatch notification.</span>
                  </div>
                  <div className="p-3 bg-[#121212] border border-[#D6CCBA]/15">
                    <span className="text-[#FF0800] font-bold block mb-1">STEP 03: HANDOVER</span>
                    <span>Inspect parcel and pay €88 exact in cash directly to the courier.</span>
                  </div>
                </div>
              </div>

              {/* Courier Tracking Details */}
              <div className="p-4 bg-[#181818] border border-[#D6CCBA]/20 space-y-2 font-mono-archive text-xs">
                <h4 className="text-white font-bold uppercase tracking-wider">Tracking Availability:</h4>
                <p className="text-[#D6CCBA]/85 leading-relaxed">
                  Upon handover to our Irish courier distribution partner, tracking numbers are dispatched automatically via SMS and email to the contact information provided in your reservation.
                </p>
                <p className="text-[11px] text-[#D6CCBA]/60 pt-1">
                  *Complimentary delivery covers all 26 counties of Ireland* with valid Eircode postal routing.
                </p>
              </div>
            </div>
          )}

          {/* ────────────────── 3. SIZE CHART & FIT DOSSIER ────────────────── */}
          {activeTab === 'sizing' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-[#D6CCBA]/15 pb-4">
                <span className="text-[10px] font-mono-archive uppercase tracking-[0.22em] text-[#D6CCBA]/70 block mb-1 font-bold">
                  § 03 · ARCHITECTURAL PATTERN SPECIFICATIONS
                </span>
                <h3 className="font-serif-editorial text-2xl sm:text-3xl text-[#FFFFFF] font-light">
                  Garment Size Guide & Exact Pattern Measurements
                </h3>
                <p className="font-mono-archive text-xs text-[#D6CCBA]/70 mt-1.5">
                  Direct pattern measurements in centimeters and inches · Never fabricated
                </p>
              </div>

              {/* Fit Philosophy */}
              <div className="p-4 bg-[#1F1E1D] border border-[#D6CCBA]/25 space-y-2 text-xs sm:text-sm">
                <span className="font-mono-archive text-[10px] uppercase tracking-wider text-[#FF0800] font-bold block">
                  PROPORTION & DRAPE INTENTION
                </span>
                <p className="text-[#D6CCBA]/95 leading-relaxed">
                  The Archive Drop No. 01 tracksuit features a contemporary, relaxed architectural drape. The hoodie is constructed with deliberately dropped shoulders, generous chest volume, and a boxy torso fall, while the trousers feature a relaxed straight leg that breaks naturally over footwear.
                </p>
              </div>

              {/* Table with Sticky Header */}
              <div className="overflow-x-auto border-2 border-[#D6CCBA]/30 bg-[#161616] shadow-xl">
                <table className="w-full text-left font-mono-archive text-xs border-collapse">
                  <thead className="bg-[#202020] border-b-2 border-[#D6CCBA]/30 text-white sticky top-0 z-10">
                    <tr>
                      <th className="p-3.5 uppercase tracking-wider font-bold">Size</th>
                      <th className="p-3.5 uppercase tracking-wider font-bold">Chest (Pit-to-Pit)</th>
                      <th className="p-3.5 uppercase tracking-wider font-bold">Hoodie Length</th>
                      <th className="p-3.5 uppercase tracking-wider font-bold">Shoulder Width</th>
                      <th className="p-3.5 uppercase tracking-wider font-bold">Trouser Waist</th>
                      <th className="p-3.5 uppercase tracking-wider font-bold">Trouser Inseam</th>
                      <th className="p-3.5 uppercase tracking-wider font-bold">Availability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D6CCBA]/15">
                    {Object.values(SIZE_SPECIFICATIONS).map((spec) => {
                      const isClosed = spec.status === 'closed';
                      return (
                        <tr 
                          key={spec.size}
                          className={isClosed ? 'opacity-40 bg-black/40' : 'hover:bg-[#252525] transition-colors'}
                        >
                          <td className="p-3.5 font-bold text-white whitespace-nowrap">
                            Size {spec.size}
                            {isClosed && (
                              <span className="ml-2 text-[9px] uppercase px-1.5 py-0.5 bg-black text-[#FF0800] border border-[#FF0800]/50 font-normal">
                                CLOSED
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">{spec.hoodieChestPitToPitCm} cm / {(spec.hoodieChestPitToPitCm / 2.54).toFixed(1)}&quot;</td>
                          <td className="p-3.5 whitespace-nowrap">{spec.hoodieLengthCm} cm / {(spec.hoodieLengthCm / 2.54).toFixed(1)}&quot;</td>
                          <td className="p-3.5 whitespace-nowrap">{spec.hoodieShoulderCm} cm / {(spec.hoodieShoulderCm / 2.54).toFixed(1)}&quot;</td>
                          <td className="p-3.5 whitespace-nowrap">{spec.trouserWaistRelaxedCm} cm (relax)</td>
                          <td className="p-3.5 whitespace-nowrap">{spec.trouserInseamCm} cm / {(spec.trouserInseamCm / 2.54).toFixed(1)}&quot;</td>
                          <td className="p-3.5 whitespace-nowrap font-semibold">
                            {isClosed ? (
                              <span className="text-[#FF0800]">Archive Closed</span>
                            ) : (
                              <span className="text-[#8FA9C4]">In Stock</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Lookbook Models Reference */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-[#181818] border border-[#D6CCBA]/20 space-y-2">
                  <span className="text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/60 block font-bold">
                    MALE LOOKBOOK REFERENCE
                  </span>
                  <h4 className="font-serif-editorial text-lg text-white">
                    {FIT_MODELS.male.label} (Wearing Size {FIT_MODELS.male.sizeWorn})
                  </h4>
                  <ul className="text-xs font-mono-archive text-[#D6CCBA]/85 space-y-1">
                    <li>Height: {FIT_MODELS.male.heightImperial} ({FIT_MODELS.male.heightCm} cm)</li>
                    <li>Weight: {FIT_MODELS.male.weightKg} kg ({FIT_MODELS.male.weightLbs} lbs)</li>
                    <li>Chest: {FIT_MODELS.male.chestOrBustCm} cm &middot; Waist: {FIT_MODELS.male.waistCm} cm</li>
                    <li className="text-[11px] text-[#D6CCBA]/60 pt-1">Fit Result: Architectural relaxed drape with layering ease.</li>
                  </ul>
                </div>

                <div className="p-4 bg-[#181818] border border-[#D6CCBA]/20 space-y-2">
                  <span className="text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/60 block font-bold">
                    FEMALE LOOKBOOK REFERENCE
                  </span>
                  <h4 className="font-serif-editorial text-lg text-white">
                    {FIT_MODELS.female.label} (Wearing Size {FIT_MODELS.female.sizeWorn})
                  </h4>
                  <ul className="text-xs font-mono-archive text-[#D6CCBA]/85 space-y-1">
                    <li>Height: {FIT_MODELS.female.heightImperial} ({FIT_MODELS.female.heightCm} cm)</li>
                    <li>Weight: {FIT_MODELS.female.weightKg} kg ({FIT_MODELS.female.weightLbs} lbs)</li>
                    <li>Bust: {FIT_MODELS.female.chestOrBustCm} cm &middot; Waist: {FIT_MODELS.female.waistCm} cm</li>
                    <li className="text-[11px] text-[#D6CCBA]/60 pt-1">Fit Result: Contemporary oversized streetwear fall.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ────────────────── 4. GARMENT CARE & LONGEVITY ────────────────── */}
          {activeTab === 'care' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-[#D6CCBA]/15 pb-4">
                <span className="text-[10px] font-mono-archive uppercase tracking-[0.22em] text-[#D6CCBA]/70 block mb-1 font-bold">
                  § 04 · TEXTILE PRESERVATION & LONGEVITY
                </span>
                <h3 className="font-serif-editorial text-2xl sm:text-3xl text-[#FFFFFF] font-light">
                  Garment Care Protocol
                </h3>
                <p className="font-mono-archive text-xs text-[#D6CCBA]/70 mt-1.5">
                  Engineered for decades of wear · Heavyweight unbrushed 390 GSM fleece
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 bg-[#181818] border border-[#D6CCBA]/20 space-y-2">
                  <span className="text-xs font-mono-archive font-bold text-white block uppercase tracking-wider">
                    01. WASHING CYCLE
                  </span>
                  <p className="text-xs text-[#D6CCBA]/85 font-mono-archive leading-relaxed">
                    Cold gentle machine wash at 30°C or below. Always turn both hoodie and trousers inside out prior to washing to protect the high-density 20,000-stitch chest embroidery and hood apex monogram from abrasion.
                  </p>
                </div>

                <div className="p-5 bg-[#181818] border border-[#D6CCBA]/20 space-y-2">
                  <span className="text-xs font-mono-archive font-bold text-white block uppercase tracking-wider">
                    02. DRYING PROTOCOL
                  </span>
                  <p className="text-xs text-[#D6CCBA]/85 font-mono-archive leading-relaxed">
                    <strong>Never tumble dry.</strong> Tumble heat damages loopback cotton fibres and shrinks heavy fleece. Reshape while damp and hang dry or lay flat in natural shade to preserve structural drape.
                  </p>
                </div>

                <div className="p-5 bg-[#181818] border border-[#D6CCBA]/20 space-y-2">
                  <span className="text-xs font-mono-archive font-bold text-white block uppercase tracking-wider">
                    03. STEAMING & IRONING
                  </span>
                  <p className="text-xs text-[#D6CCBA]/85 font-mono-archive leading-relaxed">
                    Use low-to-medium heat on reverse. Do not apply a direct hot iron face onto raised satin embroidery reliefs or rubberized tips. Hand steaming is recommended.
                  </p>
                </div>

                <div className="p-5 bg-[#181818] border border-[#D6CCBA]/20 space-y-2">
                  <span className="text-xs font-mono-archive font-bold text-white block uppercase tracking-wider">
                    04. ARCHIVAL STORAGE
                  </span>
                  <p className="text-xs text-[#D6CCBA]/85 font-mono-archive leading-relaxed">
                    Store folded inside the provided rigid presentation box or keep stored inside the 100% natural canvas totebag to protect the deep botanical black dye from direct ultraviolet light.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ────────────────── 5. PRIVACY & DATA RIGHTS (GDPR) ────────────────── */}
          {activeTab === 'privacy' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-[#D6CCBA]/15 pb-4">
                <span className="text-[10px] font-mono-archive uppercase tracking-[0.22em] text-[#D6CCBA]/70 block mb-1 font-bold">
                  § 05 · EUROPEAN DATA PROTECTION REGULATION (GDPR)
                </span>
                <h3 className="font-serif-editorial text-2xl sm:text-3xl text-[#FFFFFF] font-light">
                  Privacy Policy & Client Data Ethics
                </h3>
                <p className="font-mono-archive text-xs text-[#D6CCBA]/70 mt-1.5">
                  Minimal data collection &middot; Zero commercial tracking &middot; Full Irish compliance
                </p>
              </div>

              <div className="space-y-4 text-xs font-mono-archive text-[#D6CCBA]/85 leading-relaxed">
                <div className="p-4 bg-[#181818] border border-[#D6CCBA]/20 space-y-2">
                  <h4 className="text-white font-bold uppercase tracking-wider">1. Minimal Information Collection</h4>
                  <p>
                    When placing a Cash on Delivery order with Atelier NOIRÉ, we collect strictly the minimum information necessary to execute delivery: full name, email address, physical delivery street address, Eircode, and mobile phone number for courier coordination.
                  </p>
                </div>

                <div className="p-4 bg-[#181818] border border-[#D6CCBA]/20 space-y-2">
                  <h4 className="text-white font-bold uppercase tracking-wider">2. Zero Payment Card Storage</h4>
                  <p>
                    Because Archive Drop No. 01 operates exclusively on a Cash on Delivery (COD) physical handover model in Ireland, we never process, collect, or store credit or debit card numbers online.
                  </p>
                </div>

                <div className="p-4 bg-[#181818] border border-[#D6CCBA]/20 space-y-2">
                  <h4 className="text-white font-bold uppercase tracking-wider">3. No Third-Party Commercial Tracking</h4>
                  <p>
                    We do not sell, rent, or trade client information to data brokers, marketing networks, or behavioral advertising platforms. Your data is used exclusively to fulfill your acquisition.
                  </p>
                </div>

                <div className="p-4 bg-[#181818] border border-[#D6CCBA]/20 space-y-2">
                  <h4 className="text-white font-bold uppercase tracking-wider">4. Statutory Rights to Erasure</h4>
                  <p>
                    Under the GDPR and the Irish Data Protection Act 2018, you maintain the right to access, rectify, or demand the permanent deletion of your customer records by contacting <a href="mailto:noire.ireland@gmail.com" className="text-white underline font-bold">noire.ireland@gmail.com</a>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ────────────────── 6. CONCIERGE CONTACT ────────────────── */}
          {activeTab === 'contact' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-[#D6CCBA]/15 pb-4">
                <span className="text-[10px] font-mono-archive uppercase tracking-[0.22em] text-[#D6CCBA]/70 block mb-1 font-bold">
                  § 06 · STUDIO LIAISON & ORDER ASSISTANCE
                </span>
                <h3 className="font-serif-editorial text-2xl sm:text-3xl text-[#FFFFFF] font-light">
                  Client Concierge & Direct Contact
                </h3>
                <p className="font-mono-archive text-xs text-[#D6CCBA]/70 mt-1.5">
                  Direct communication with the Atelier NOIRÉ team in Dublin
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono-archive text-xs">
                <div className="p-5 bg-[#181818] border border-[#D6CCBA]/20 space-y-2">
                  <span className="text-[10px] text-[#D6CCBA]/60 uppercase tracking-wider block font-bold">OFFICIAL EMAIL</span>
                  <a 
                    href="mailto:noire.ireland@gmail.com" 
                    className="text-white text-base font-bold underline underline-offset-4 hover:text-[#FF0800] transition-colors block"
                  >
                    noire.ireland@gmail.com
                  </a>
                  <p className="text-[11px] text-[#D6CCBA]/75 pt-1 leading-relaxed">
                    Direct inquiries regarding order status, address modifications, sizing advice, and return authorizations.
                  </p>
                </div>

                <div className="p-5 bg-[#181818] border border-[#D6CCBA]/20 space-y-2">
                  <span className="text-[10px] text-[#D6CCBA]/60 uppercase tracking-wider block font-bold">CONCIERGE HOURS</span>
                  <span className="text-white text-base font-bold block">
                    Mon – Fri &middot; 09:00 – 18:00 IST
                  </span>
                  <p className="text-[11px] text-[#D6CCBA]/75 pt-1 leading-relaxed">
                    All client correspondences are reviewed and answered within 24 business hours.
                  </p>
                </div>

                <div className="p-5 bg-[#181818] border border-[#D6CCBA]/20 space-y-2">
                  <span className="text-[10px] text-[#D6CCBA]/60 uppercase tracking-wider block font-bold">STUDIO PROVENANCE</span>
                  <span className="text-white text-base font-bold block">
                    Dublin, Republic of Ireland
                  </span>
                  <p className="text-[11px] text-[#D6CCBA]/75 pt-1 leading-relaxed">
                    Designed and patterned in Dublin; crafted in limited runs of 88 sets.
                  </p>
                </div>

                <div className="p-5 bg-[#181818] border border-[#D6CCBA]/20 space-y-2">
                  <span className="text-[10px] text-[#D6CCBA]/60 uppercase tracking-wider block font-bold">REGISTRATION TRANSPARENCY</span>
                  <span className="text-white text-base font-bold block">
                    Pre-Deployment Phase
                  </span>
                  <p className="text-[11px] text-[#D6CCBA]/75 pt-1 leading-relaxed">
                    Official telephone dispatch line and registered office details will be published upon commercial launch.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Dock Strip */}
        <div className="px-5 sm:px-8 py-3 bg-[#111111] border-t border-[#D6CCBA]/15 flex items-center justify-between gap-3 text-[11px] font-mono-archive text-[#D6CCBA]/60 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF0800]" />
            <span className="uppercase tracking-wider">ARCHIVE DROP 01 · 88 NUMBERED SETS</span>
          </div>

          <div className="flex items-center gap-4">
            {showScrollPrompt && (
              <span className="hidden sm:inline-block text-[10px] text-[#D6CCBA]/50 tracking-widest uppercase animate-pulse">
                SCROLL TO INSPECT DOSSIER ↓
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1 bg-[#222120] hover:bg-[#D6CCBA] hover:text-[#161616] text-[#D6CCBA] text-xs font-mono-archive uppercase tracking-wider border border-[#D6CCBA]/30 transition-colors cursor-pointer font-semibold"
            >
              Close Dossier
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
