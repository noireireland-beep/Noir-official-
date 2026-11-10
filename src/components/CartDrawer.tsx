import React, { useState, useEffect } from 'react';
import { COLORWAYS, ARCHIVE_SPECS } from '../utils/archive-data';
import { VALID_COUNTIES, validateEircode, validateIrishPhone, validateEmail } from '../server/validation';
import { CareModalTab } from './CustomerCareModal';

interface CartItem {
  colorway: 'carbon' | 'blue-charcoal';
  size: string;
  quantity: number;
}

interface CompletedOrderData {
  orderReference: string;
  customer: {
    fullName: string;
    email: string;
    phone: string;
    streetAddress: string;
    unitOrApartment?: string;
    city: string;
    county: string;
    eircode: string;
    country: string;
  };
  items: Array<{
    colorway: string;
    colorwayName: string;
    size: string;
    quantity: number;
    unitPriceEur: number;
    subtotalEur: number;
  }>;
  financials: {
    unitPriceEur: number;
    subtotalEur: number;
    shippingEur: number;
    totalEur: number;
    currency: string;
  };
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onRemoveItem: (index: number) => void;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onAddToCart?: (colorway: 'carbon' | 'blue-charcoal', size: string) => void;
  onClearCart?: () => void;
  onOpenCareModal?: (tab: CareModalTab) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onRemoveItem,
  onUpdateQuantity,
  onAddToCart,
  onClearCart,
  onOpenCareModal,
}) => {
  // Form fields for Irish customer checkout
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phoneLocal, setPhoneLocal] = useState<string>('');
  const [streetAddress, setStreetAddress] = useState<string>('');
  const [unitOrApartment, setUnitOrApartment] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [county, setCounty] = useState<string>('Dublin');
  const [eircode, setEircode] = useState<string>('');

  // Per-field inline error feedback
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Quick card selectors (default to L; S is closed)
  const [quickSizeCarbon, setQuickSizeCarbon] = useState<string>('L');
  const [quickSizeBlue, setQuickSizeBlue] = useState<string>('L');

  // Checkout submission states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<CompletedOrderData | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  // Freeze background scrolling while inside acquisition dossier
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const subtotal = items.reduce((acc, item) => acc + item.quantity * ARCHIVE_SPECS.priceEur, 0);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);
    const newFieldErrors: Record<string, string> = {};

    // Client-side per-field validations
    if (!fullName.trim() || fullName.trim().length < 2) {
      newFieldErrors.fullName = 'Full name must be at least 2 characters.';
    }

    if (!validateEmail(email)) {
      newFieldErrors.email = 'Please provide a valid email address (e.g. collector@atelier-noire.ie).';
    }

    // Canonical Irish phone (+353) formatting
    const rawCleanDigits = phoneLocal.trim().replace(/^(\+353|00353|0)\s*/, '').replace(/[\s\-\(\)\.]/g, '');
    const canonicalPhone = `+353 ${rawCleanDigits}`;
    if (!rawCleanDigits || !validateIrishPhone(canonicalPhone)) {
      newFieldErrors.phone = 'Valid Irish phone number required (e.g. 87 123 4567).';
    }

    if (!streetAddress.trim() || streetAddress.trim().length < 4) {
      newFieldErrors.streetAddress = 'Street address is required.';
    }

    if (!city.trim() || city.trim().length < 2) {
      newFieldErrors.city = 'Town or city is required.';
    }

    if (!validateEircode(eircode)) {
      newFieldErrors.eircode = 'Valid 7-character Irish Eircode required (e.g. D02 X285).';
    }

    if (items.length === 0) {
      setSubmissionError('Your acquisition selection is empty.');
      return;
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      setSubmissionError('Please correct the highlighted fields below to proceed.');
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const payload = {
        customer: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: canonicalPhone,
          streetAddress: streetAddress.trim(),
          unitOrApartment: unitOrApartment.trim() || undefined,
          city: city.trim(),
          county,
          eircode: eircode.trim().toUpperCase(),
        },
        items: items.map((i) => ({
          colorway: i.colorway,
          size: i.size,
          quantity: i.quantity,
        })),
        idempotencyKey,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const rawText = await res.text();
      let data: {
        success?: boolean;
        orderId?: string;
        order?: CompletedOrderData;
        error?: string;
        errors?: string[];
      } = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        setSubmissionError(
          `Unexpected server response (${res.status}). Please try again.`
        );
        return;
      }

      if (!res.ok || data.success !== true || !data.order) {
        const errorList: string[] = data.errors || [
          data.error || `Failed to place order (${res.status}).`,
        ];
        const serverFieldErrors: Record<string, string> = {};

        errorList.forEach((err) => {
          const lower = err.toLowerCase();
          if (lower.includes('name')) serverFieldErrors.fullName = err;
          else if (lower.includes('email')) serverFieldErrors.email = err;
          else if (lower.includes('phone')) serverFieldErrors.phone = err;
          else if (lower.includes('address') || lower.includes('street')) serverFieldErrors.streetAddress = err;
          else if (lower.includes('city') || lower.includes('town')) serverFieldErrors.city = err;
          else if (lower.includes('eircode')) serverFieldErrors.eircode = err;
          else if (lower.includes('county')) serverFieldErrors.county = err;
        });

        if (Object.keys(serverFieldErrors).length > 0) {
          setFieldErrors((prev) => ({ ...prev, ...serverFieldErrors }));
        }

        const errorMsg = errorList.join(' ');
        setSubmissionError(errorMsg);
        return;
      }

      // Success
      setCompletedOrder(data.order);
      if (onClearCart) {
        onClearCart();
      }
      // Regenerate idempotency key for future checkouts
      setIdempotencyKey(`idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
    } catch (err: unknown) {
      console.error('Order submission network error:', err);
      const msg = err instanceof Error ? err.message : 'Network error.';
      setSubmissionError(`A communication error occurred while connecting to the atelier registry: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetCheckout = () => {
    setCompletedOrder(null);
    setSubmissionError(null);
    onClose();
  };

  const scrollToLedger = () => {
    onClose();
    setTimeout(() => {
      const el = document.getElementById('ledger');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 120);
  };

  return (
    <div 
      className="fixed inset-0 z-[2000] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Atelier NOIRÉ Acquisition Dossier"
    >
      {/* Heavy Luxury Atmospheric Backdrop */}
      <div 
        onClick={onClose} 
        onTouchMove={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onWheel={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className="absolute inset-0 bg-[#07080A]/85 backdrop-blur-md transition-opacity duration-300 touch-none" 
      />

      {/* Slide-out Drawer Panel */}
      <div 
        className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10"
        data-lenis-prevent="true"
      >
        <div 
          data-lenis-prevent="true"
          className="w-screen max-w-lg h-full max-h-[100dvh] bg-[#161616] text-[#D6CCBA] border-l border-[#D6CCBA]/25 shadow-[0_0_80px_rgba(0,0,0,0.95)] flex flex-col relative overflow-hidden"
        >
          {/* Grain texture overlay */}
          <div className="plate-grain absolute inset-0 pointer-events-none opacity-20" />

          {/* ═══════════════════════════════════════════════════════════════
              ARCHITECTURAL DOSSIER HEADER
              ═══════════════════════════════════════════════════════════════ */}
          <div className="relative z-10 shrink-0 px-6 py-5 sm:px-8 sm:py-6 border-b border-[#D6CCBA]/15 bg-[#121212] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono-archive uppercase tracking-[0.22em] text-[#D6CCBA]/60">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF0800]" />
                <span>ARCHIVE DROP 01 // DOSSIER</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-serif-editorial text-[#D6CCBA] font-normal tracking-tight mt-0.5">
                Acquisition Registry
              </h2>
            </div>
            
            <button
              type="button"
              onClick={onClose}
              aria-label="Close acquisition drawer"
              className="px-3 py-1.5 border border-[#D6CCBA]/20 hover:border-[#D6CCBA] text-xs font-mono-archive uppercase tracking-widest text-[#D6CCBA]/70 hover:text-[#D6CCBA] bg-[#161616] transition-colors cursor-pointer"
            >
              CLOSE [✕]
            </button>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              DRAWER BODY CONTENT
              ═══════════════════════════════════════════════════════════════ */}
          <div 
            data-lenis-prevent="true"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            className="relative z-10 p-6 sm:p-8 flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y space-y-6"
            style={{ 
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y'
            }}
          >
            {completedOrder ? (
              /* ═══════════════════════════════════════════════════════════════
                 ORDER RECORDED CONFIRMATION — STRICT ARCHITECTURAL GRID
                 Minimal, structured, luxury archival dossier layout
                 ═══════════════════════════════════════════════════════════════ */
              <div className="py-2 space-y-5 animate-fadeIn">
                
                {/* Header Stamp */}
                <div className="border border-[#2B2A28] bg-[#141414] p-5 text-left">
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2 text-[10px] font-mono-archive uppercase tracking-[0.22em] text-[#D6CCBA]/70">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF0800]" />
                      <span>ARCHIVE DISPATCH RECORD</span>
                    </div>
                    <span className="text-[10px] font-mono-archive uppercase tracking-wider px-2 py-0.5 bg-[#2B2A28] text-[#D6CCBA] border border-[#D6CCBA]/20">
                      RECORDED
                    </span>
                  </div>

                  <h3 className="font-serif-editorial text-2xl sm:text-3xl text-white font-normal leading-tight">
                    Order Registered
                  </h3>

                  <div className="mt-3 pt-3 border-t border-[#2B2A28] flex flex-wrap items-center justify-between gap-2 font-mono-archive text-xs">
                    <span className="text-[#D6CCBA]/50 uppercase tracking-widest text-[10px]">REFERENCE CODE</span>
                    <span className="font-bold text-white tracking-[0.2em]">{completedOrder.orderReference}</span>
                  </div>
                </div>

                {/* Architectural 4-Quadrant Dossier Grid */}
                <div className="border border-[#2B2A28] bg-[#141414] grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#2B2A28] text-xs font-mono-archive">
                  
                  {/* Quadrant 01: Collector Information */}
                  <div className="p-4 sm:p-5 space-y-2">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#D6CCBA]/50 block">
                      01 / COLLECTOR
                    </span>
                    <div className="text-white space-y-0.5">
                      <div className="font-bold text-sm text-[#D6CCBA]">{completedOrder.customer.fullName}</div>
                      <div className="text-[#D6CCBA]/80 text-[11px] truncate">{completedOrder.customer.email}</div>
                      <div className="text-[#8FA9C4] text-[11px] font-medium">{completedOrder.customer.phone}</div>
                    </div>
                  </div>

                  {/* Quadrant 02: Dispatch Destination */}
                  <div className="p-4 sm:p-5 space-y-2">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#D6CCBA]/50 block">
                      02 / DESTINATION
                    </span>
                    <div className="text-[#D6CCBA]/90 text-[11px] leading-relaxed space-y-0.5">
                      <div>
                        {completedOrder.customer.streetAddress}
                        {completedOrder.customer.unitOrApartment ? `, ${completedOrder.customer.unitOrApartment}` : ''}
                      </div>
                      <div>{completedOrder.customer.city}, Co. {completedOrder.customer.county}</div>
                      <div className="font-bold text-white pt-0.5">EIRCODE: {completedOrder.customer.eircode}</div>
                    </div>
                  </div>

                </div>

                {/* Quadrants 03 & 04: Allocated Items & Settlement Grid */}
                <div className="border border-[#2B2A28] bg-[#141414] grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#2B2A28] text-xs font-mono-archive">
                  
                  {/* Quadrant 03: Allocated Sets */}
                  <div className="p-4 sm:p-5 space-y-2.5">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#D6CCBA]/50 block">
                      03 / ALLOCATION
                    </span>
                    <div className="space-y-2">
                      {completedOrder.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1 border-b border-[#2B2A28] last:border-b-0">
                          <div>
                            <span className="text-white font-semibold block">{item.quantity}× {item.colorwayName}</span>
                            <span className="text-[10px] text-[#D6CCBA]/60">Size {item.size} · 390 GSM</span>
                          </div>
                          <span className="text-white font-bold">€{item.subtotalEur}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quadrant 04: Settlement Terms */}
                  <div className="p-4 sm:p-5 space-y-2.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-[#D6CCBA]/50 block mb-2">
                        04 / SETTLEMENT
                      </span>
                      <div className="space-y-1 text-[11px] text-[#D6CCBA]/80">
                        <div className="flex justify-between">
                          <span>Dispatch Courier</span>
                          <span className="text-white">Complimentary</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Settlement Method</span>
                          <span className="text-[#FF0800] font-bold">Cash on Delivery</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-[#2B2A28] flex items-baseline justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-[#D6CCBA]/60">DUE ON DELIVERY</span>
                      <span className="text-lg font-bold font-serif-editorial text-white">€{completedOrder.financials.totalEur}.00</span>
                    </div>
                  </div>

                </div>

                {/* Minimalist Return Action */}
                <button
                  type="button"
                  onClick={handleResetCheckout}
                  className="w-full py-3.5 bg-[#D6CCBA] hover:bg-white text-[#161616] text-xs font-mono-archive uppercase tracking-[0.22em] font-bold transition-all cursor-pointer shadow-lg"
                >
                  Return to Storefront
                </button>

              </div>

            ) : items.length === 0 ? (

              /* Empty State with Direct CTA & Quick-Acquire Cards */
              <div className="py-4 space-y-6">
                <div className="border border-[#D6CCBA]/15 bg-[#2B2A28]/30 p-5 text-left space-y-2.5">
                  <span className="text-[10px] font-mono-archive uppercase tracking-[0.24em] text-[#D6CCBA]/50 block">
                    STATUS: [ ZERO ALLOCATION ASSIGNED ]
                  </span>
                  <p className="font-serif-editorial italic text-lg sm:text-xl text-[#D6CCBA]/90 leading-snug">
                    Your acquisition dossier is currently unassigned.
                  </p>
                  <p className="text-xs font-sans text-[#D6CCBA]/65 leading-relaxed">
                    Archive Drop 01 is strictly capped at 88 numbered sets worldwide across Carbon Noir and Blue Charcoal. Once assigned, no restock or reproduction will occur.
                  </p>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={scrollToLedger}
                      className="w-full py-3.5 bg-[#D6CCBA] hover:bg-white text-[#161616] text-xs font-mono-archive uppercase tracking-[0.22em] font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg"
                    >
                      <span>Explore Garment Archive</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>

                {/* Quick Claim Cards in Drawer */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-[10px] font-mono-archive uppercase tracking-[0.2em] text-[#D6CCBA]/50">
                    <span>DIRECT ACQUISITION OPTIONS</span>
                    <span>€{ARCHIVE_SPECS.priceEur} / SET</span>
                  </div>

                  {/* Quick Card 01: Carbon Noir */}
                  <div className="border border-[#D6CCBA]/20 bg-[#1D1C1B] p-3.5 flex gap-3.5 items-center">
                    <img 
                      src="/assets/aistudio/lock_in_color_details_designs_and_stitches_from_the_second_picture_clothing_reference_only_lock_in_s_969fe8a9-6386-42e6-a2f5-55ec499a4390_ba8ec28b.png"
                      alt="Carbon Noir"
                      className="w-16 h-20 object-contain bg-[#2B2A28] border border-[#D6CCBA]/15 p-1 shrink-0"
                    />
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-mono-archive text-[11px] uppercase tracking-wider text-[#D6CCBA] font-semibold truncate">
                          01 · Carbon Noir
                        </span>
                        <span className="font-mono-archive text-xs text-[#D6CCBA]">€{ARCHIVE_SPECS.priceEur}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {['S', 'M', 'L', 'XL'].map((s) => {
                          const isClosed = s === 'S';
                          return (
                            <button
                              key={`carbon-${s}`}
                              type="button"
                              disabled={isClosed}
                              onClick={() => !isClosed && setQuickSizeCarbon(s)}
                              className={`px-1.5 py-0.5 text-[10px] font-mono-archive border ${
                                isClosed
                                  ? 'opacity-35 cursor-not-allowed border-[#D6CCBA]/15 text-[#D6CCBA]/35 line-through'
                                  : quickSizeCarbon === s 
                                    ? 'bg-[#D6CCBA] text-[#161616] border-[#D6CCBA] font-bold cursor-pointer' 
                                    : 'border-[#D6CCBA]/25 text-[#D6CCBA]/70 hover:border-[#D6CCBA] cursor-pointer'
                              }`}
                              title={isClosed ? 'Size S: Archive Closed' : `Size ${s}`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (onAddToCart) {
                            onAddToCart('carbon', quickSizeCarbon);
                          }
                        }}
                        className="w-full mt-1 py-1.5 bg-[#2B2A28] hover:bg-[#D6CCBA] hover:text-[#161616] text-[#D6CCBA] text-[10px] font-mono-archive uppercase tracking-[0.18em] font-semibold border border-[#D6CCBA]/30 transition-colors cursor-pointer"
                      >
                        + Add Carbon Set (Size {quickSizeCarbon})
                      </button>
                    </div>
                  </div>

                  {/* Quick Card 02: Blue Charcoal */}
                  <div className="border border-[#465462]/60 bg-[#171E27] p-3.5 flex gap-3.5 items-center">
                    <img 
                      src="/assets/aistudio/2026-11-01_07_13_34.115_0600_bb8a7721.jpg"
                      alt="Blue Charcoal"
                      className="w-16 h-20 object-contain bg-[#263443] border border-[#465462] p-1 shrink-0"
                    />
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-mono-archive text-[11px] uppercase tracking-wider text-[#BBC6D0] font-semibold truncate">
                          02 · Blue Charcoal
                        </span>
                        <span className="font-mono-archive text-xs text-[#F0F2F4]">€{ARCHIVE_SPECS.priceEur}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {['S', 'M', 'L', 'XL'].map((s) => {
                          const isClosed = s === 'S';
                          return (
                            <button
                              key={`blue-${s}`}
                              type="button"
                              disabled={isClosed}
                              onClick={() => !isClosed && setQuickSizeBlue(s)}
                              className={`px-1.5 py-0.5 text-[10px] font-mono-archive border ${
                                isClosed
                                  ? 'opacity-35 cursor-not-allowed border-[#465462]/40 text-[#BBC6D0]/35 line-through'
                                  : quickSizeBlue === s 
                                    ? 'bg-[#8FA9C4] text-[#111820] border-[#8FA9C4] font-bold cursor-pointer' 
                                    : 'border-[#465462] text-[#BBC6D0] hover:border-[#8FA9C4] cursor-pointer'
                              }`}
                              title={isClosed ? 'Size S: Archive Closed' : `Size ${s}`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (onAddToCart) {
                            onAddToCart('blue-charcoal', quickSizeBlue);
                          }
                        }}
                        className="w-full mt-1 py-1.5 bg-[#263443] hover:bg-[#8FA9C4] hover:text-[#111820] text-[#BBC6D0] text-[10px] font-mono-archive uppercase tracking-[0.18em] font-semibold border border-[#465462] transition-colors cursor-pointer"
                      >
                        + Add Blue Set (Size {quickSizeBlue})
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            ) : (

              /* Populated Cart & Real COD Checkout Form */
              <>
                {/* Error Banner */}
                {submissionError && (
                  <div className="p-3.5 bg-[#FF0800]/15 border border-[#FF0800]/40 text-xs text-[#FFFFFF] font-mono-archive flex items-start gap-2.5">
                    <span className="text-[#FF0800] font-bold text-sm leading-none mt-0.5">⚠</span>
                    <span className="flex-1 leading-relaxed">{submissionError}</span>
                  </div>
                )}

                {/* Items List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-mono-archive text-[#D6CCBA]/60 uppercase tracking-wider border-b border-[#D6CCBA]/10 pb-2">
                    <span>ALLOCATED PIECES ({items.length})</span>
                    <span>EDITION CAPPED AT 88</span>
                  </div>

                  <ul className="space-y-3">
                    {items.map((item, index) => {
                      const theme = COLORWAYS[item.colorway];
                      const photoUrl = item.colorway === 'blue-charcoal'
                        ? '/assets/aistudio/2026-11-01_07_13_34.115_0600_bb8a7721.jpg'
                        : '/assets/aistudio/lock_in_color_details_designs_and_stitches_from_the_second_picture_clothing_reference_only_lock_in_s_969fe8a9-6386-42e6-a2f5-55ec499a4390_ba8ec28b.png';

                      return (
                        <li 
                          key={`${item.colorway}-${item.size}-${index}`}
                          className="flex gap-4 p-3 bg-[#2B2A28]/30 border border-[#D6CCBA]/15 relative"
                        >
                          <img 
                            src={photoUrl} 
                            alt={theme.name} 
                            className="w-16 h-20 object-contain bg-[#1F1E1D] border border-[#D6CCBA]/10 p-1 shrink-0" 
                          />
                          <div className="flex-1 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-serif-editorial text-sm text-[#D6CCBA]">
                                  Archive Drop Tracksuit
                                </h4>
                                <p className="text-xs font-mono-archive text-[#D6CCBA]/70">
                                  {theme.name} &middot; Size {item.size}
                                </p>
                              </div>
                              <span className="font-mono-archive text-xs font-bold text-[#D6CCBA]">
                                €{ARCHIVE_SPECS.priceEur * item.quantity}
                              </span>
                            </div>

                            <p className="text-[10px] font-mono-archive text-[#D6CCBA]/50">
                              + Includes Complimentary Embroidered Totebag
                            </p>

                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#D6CCBA]/10">
                              <div className="flex items-center border border-[#D6CCBA]/25">
                                <button
                                  type="button"
                                  onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                                  className="w-6 h-6 flex items-center justify-center text-xs text-[#D6CCBA] hover:bg-[#D6CCBA]/20 cursor-pointer"
                                  aria-label="Decrease quantity"
                                >
                                  -
                                </button>
                                <span className="w-6 text-center text-xs font-mono-archive">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                                  className="w-6 h-6 flex items-center justify-center text-xs text-[#D6CCBA] hover:bg-[#D6CCBA]/20 cursor-pointer"
                                  aria-label="Increase quantity"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => onRemoveItem(index)}
                                className="text-[10px] font-mono-archive uppercase tracking-widest text-[#FF0800] hover:text-[#ff3b34] cursor-pointer"
                              >
                                [ Remove ]
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Ledger Financial Breakdown */}
                <div className="p-4 bg-[#2B2A28]/40 border border-[#D6CCBA]/15 text-xs font-mono-archive space-y-2">
                  <div className="flex justify-between text-[#D6CCBA]/70">
                    <span>Archive Subtotal</span>
                    <span>€{subtotal}.00</span>
                  </div>
                  <div className="flex justify-between text-[#D6CCBA]/70">
                    <span>Delivery (All 26 counties of Ireland*)</span>
                    <span className="text-[#D6CCBA] font-semibold">FREE</span>
                  </div>
                  <div className="flex justify-between text-[#D6CCBA]/70">
                    <span>Payment Method</span>
                    <span className="text-[#D6CCBA] font-semibold">CASH ON DELIVERY (COD)</span>
                  </div>
                  <div className="flex justify-between text-[#D6CCBA]/70">
                    <span>Dublin Provenance Certificate</span>
                    <span className="text-[#D6CCBA] font-semibold">INCLUDED</span>
                  </div>
                  <div className="pt-2 border-t border-[#D6CCBA]/15 flex justify-between text-sm text-[#FFFFFF] font-bold">
                    <span>Total Due Upon Delivery</span>
                    <span>€{subtotal}.00</span>
                  </div>
                </div>

                {/* Explicit COD Explanatory Note */}
                <div className="p-3 bg-[#1B1A19] border border-[#D6CCBA]/20 text-[11px] font-mono-archive text-[#D6CCBA]/85 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#FF0800]">
                    PAYMENT TERMS · CASH ON DELIVERY ONLY
                  </div>
                  <p className="leading-relaxed">
                    No card details or advance payments are taken online. You will inspect your garment box and pay <strong className="text-white">€{subtotal}.00</strong> directly to the courier upon delivery anywhere in Ireland.
                  </p>
                </div>

                {/* Reservation / Collector Form */}
                <form id="reservation-form" onSubmit={handleCheckoutSubmit} className="space-y-3 pt-2">
                  <div className="text-[10px] font-mono-archive uppercase tracking-[0.22em] text-[#D6CCBA]/65">
                    COLLECTOR DISPATCH DOSSIER (IRELAND)
                  </div>

                  <div>
                    <label className="text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/70 block mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Cillian O'Connor"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        clearFieldError('fullName');
                      }}
                      className={`w-full bg-[#1F1E1D] border ${
                        fieldErrors.fullName ? 'border-[#FF0800]' : 'border-[#D6CCBA]/25'
                      } px-3 py-2 text-xs text-[#FFFFFF] font-mono placeholder-[#D6CCBA]/30 focus:outline-none focus:border-[#D6CCBA]`}
                    />
                    {fieldErrors.fullName && (
                      <p className="mt-1 text-[11px] font-mono-archive text-[#FF0800] flex items-center gap-1.5 animate-fadeIn">
                        <span className="font-bold">⚠</span>
                        <span>{fieldErrors.fullName}</span>
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/70 block mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="collector@atelier-noire.ie"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          clearFieldError('email');
                        }}
                        className={`w-full bg-[#1F1E1D] border ${
                          fieldErrors.email ? 'border-[#FF0800]' : 'border-[#D6CCBA]/25'
                        } px-3 py-2 text-xs text-[#FFFFFF] font-mono placeholder-[#D6CCBA]/30 focus:outline-none focus:border-[#D6CCBA]`}
                      />
                      {fieldErrors.email && (
                        <p className="mt-1 text-[11px] font-mono-archive text-[#FF0800] flex items-center gap-1.5 animate-fadeIn">
                          <span className="font-bold">⚠</span>
                          <span>{fieldErrors.email}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/70 block mb-1">
                        Irish Phone Number *
                      </label>
                      <div className="flex">
                        <div className="inline-flex items-center px-3 bg-[#282725] border border-r-0 border-[#D6CCBA]/30 text-xs text-[#D6CCBA] font-mono font-bold tracking-wider select-none shrink-0 shadow-inner">
                          +353
                        </div>
                        <input
                          type="tel"
                          required
                          placeholder="87 123 4567"
                          value={phoneLocal}
                          onChange={(e) => {
                            let val = e.target.value;
                            val = val.replace(/^(\+353|00353)\s*/, '');
                            if (val.startsWith('0')) {
                              val = val.slice(1);
                            }
                            setPhoneLocal(val);
                            clearFieldError('phone');
                          }}
                          className={`w-full bg-[#1F1E1D] border ${
                            fieldErrors.phone ? 'border-[#FF0800]' : 'border-[#D6CCBA]/25'
                          } px-3 py-2 text-xs text-[#FFFFFF] font-mono placeholder-[#D6CCBA]/30 focus:outline-none focus:border-[#D6CCBA]`}
                        />
                      </div>
                      {fieldErrors.phone && (
                        <p className="mt-1 text-[11px] font-mono-archive text-[#FF0800] flex items-center gap-1.5 animate-fadeIn">
                          <span className="font-bold">⚠</span>
                          <span>{fieldErrors.phone}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/70 block mb-1">
                      Street Address *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 14 Grafton Street"
                      value={streetAddress}
                      onChange={(e) => {
                        setStreetAddress(e.target.value);
                        clearFieldError('streetAddress');
                      }}
                      className={`w-full bg-[#1F1E1D] border ${
                        fieldErrors.streetAddress ? 'border-[#FF0800]' : 'border-[#D6CCBA]/25'
                      } px-3 py-2 text-xs text-[#FFFFFF] font-mono placeholder-[#D6CCBA]/30 focus:outline-none focus:border-[#D6CCBA]`}
                    />
                    {fieldErrors.streetAddress && (
                      <p className="mt-1 text-[11px] font-mono-archive text-[#FF0800] flex items-center gap-1.5 animate-fadeIn">
                        <span className="font-bold">⚠</span>
                        <span>{fieldErrors.streetAddress}</span>
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/70 block mb-1">
                        Apartment / House Unit (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Apt 3B, Floor 2"
                        value={unitOrApartment}
                        onChange={(e) => setUnitOrApartment(e.target.value)}
                        className="w-full bg-[#1F1E1D] border border-[#D6CCBA]/25 px-3 py-2 text-xs text-[#FFFFFF] font-mono placeholder-[#D6CCBA]/30 focus:outline-none focus:border-[#D6CCBA]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/70 block mb-1">
                        Town / City *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Dublin"
                        value={city}
                        onChange={(e) => {
                          setCity(e.target.value);
                          clearFieldError('city');
                        }}
                        className={`w-full bg-[#1F1E1D] border ${
                          fieldErrors.city ? 'border-[#FF0800]' : 'border-[#D6CCBA]/25'
                        } px-3 py-2 text-xs text-[#FFFFFF] font-mono placeholder-[#D6CCBA]/30 focus:outline-none focus:border-[#D6CCBA]`}
                      />
                      {fieldErrors.city && (
                        <p className="mt-1 text-[11px] font-mono-archive text-[#FF0800] flex items-center gap-1.5 animate-fadeIn">
                          <span className="font-bold">⚠</span>
                          <span>{fieldErrors.city}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/70 block mb-1">
                        County (Ireland) *
                      </label>
                      <select
                        value={county}
                        onChange={(e) => {
                          setCounty(e.target.value);
                          clearFieldError('county');
                        }}
                        className={`w-full bg-[#1F1E1D] border ${
                          fieldErrors.county ? 'border-[#FF0800]' : 'border-[#D6CCBA]/25'
                        } px-3 py-2 text-xs text-[#FFFFFF] font-mono focus:outline-none focus:border-[#D6CCBA] cursor-pointer`}
                      >
                        {VALID_COUNTIES.map((c) => (
                          <option key={c} value={c} className="bg-[#161616] text-[#D6CCBA]">
                            Co. {c}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.county && (
                        <p className="mt-1 text-[11px] font-mono-archive text-[#FF0800] flex items-center gap-1.5 animate-fadeIn">
                          <span className="font-bold">⚠</span>
                          <span>{fieldErrors.county}</span>
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/70 block mb-1">
                        Eircode (Postal Code) *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={8}
                        placeholder="e.g. D02 X285"
                        value={eircode}
                        onChange={(e) => {
                          setEircode(e.target.value.toUpperCase());
                          clearFieldError('eircode');
                        }}
                        className={`w-full bg-[#1F1E1D] border ${
                          fieldErrors.eircode ? 'border-[#FF0800]' : 'border-[#D6CCBA]/25'
                        } px-3 py-2 text-xs text-[#FFFFFF] font-mono placeholder-[#D6CCBA]/30 focus:outline-none focus:border-[#D6CCBA] uppercase`}
                      />
                      {fieldErrors.eircode && (
                        <p className="mt-1 text-[11px] font-mono-archive text-[#FF0800] flex items-center gap-1.5 animate-fadeIn">
                          <span className="font-bold">⚠</span>
                          <span>{fieldErrors.eircode}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              DOCKED PRIMARY ACQUISITION CTA
              ═══════════════════════════════════════════════════════════════ */}
          {!completedOrder && items.length > 0 && (
            <div className="relative z-20 px-6 py-3.5 sm:px-8 sm:py-4 bg-[#141414] border-t border-[#D6CCBA]/20 shadow-[0_-10px_25px_rgba(0,0,0,0.6)]">
              {/* Sophisticated Client Policies Strip */}
              <div className="mb-3 p-3 bg-[#1B1A19] border border-[#D6CCBA]/25 flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
                <div className="flex items-center gap-2 text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF0800]" />
                  <span>CLIENT ASSISTANCE & POLICIES</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenCareModal ? onOpenCareModal('returns') : (window.location.hash = '#returns')}
                    className="px-3 py-1.5 text-[10.5px] font-mono-archive uppercase tracking-wider font-bold border border-[#D6CCBA]/35 hover:border-[#D6CCBA] hover:bg-[#D6CCBA] hover:text-[#161616] text-[#D6CCBA] transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    <span>14-Day Returns & Care</span>
                    <span className="text-[10px] opacity-60">→</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenCareModal ? onOpenCareModal('shipping') : (window.location.hash = '#shipping')}
                    className="px-3 py-1.5 text-[10.5px] font-mono-archive uppercase tracking-wider font-bold border border-[#D6CCBA]/35 hover:border-[#D6CCBA] hover:bg-[#D6CCBA] hover:text-[#161616] text-[#D6CCBA] transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    <span>Delivery & COD</span>
                    <span className="text-[10px] opacity-60">→</span>
                  </button>
                </div>
              </div>

              <button
                form="reservation-form"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 sm:py-4 bg-[#D6CCBA] hover:bg-white text-[#161616] text-xs font-mono-archive uppercase tracking-[0.24em] font-bold border border-[#D6CCBA] transition-all cursor-pointer shadow-2xl flex items-center justify-center gap-3 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span>Securing Allocation...</span>
                ) : (
                  <>
                    <span>Confirm COD Order — €{subtotal}</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              FOOTER METADATA STRIP
              ═══════════════════════════════════════════════════════════════ */}
          <div className="relative z-10 px-6 py-3.5 bg-[#0F0F0F] border-t border-[#D6CCBA]/15 text-[10px] font-mono-archive text-[#D6CCBA]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <span>• STRICTLY 88 NUMBERED PIECES · NO REISSUE</span>
            <span>DUBLIN STUDIO ARCHIVE &middot; CASH ON DELIVERY</span>
          </div>
        </div>
      </div>
    </div>
  );
};
