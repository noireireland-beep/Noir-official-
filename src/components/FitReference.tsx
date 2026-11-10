import React, { useState } from 'react';
import { FIT_MODELS, FitModel } from '../utils/archive-data';

export const FitReference: React.FC = () => {
  const [activeGender, setActiveGender] = useState<'male' | 'female'>('male');
  
  // Keep model measurements and size-worn editable as explicitly instructed
  const [maleData, setMaleData] = useState<FitModel>(FIT_MODELS.male);
  const [femaleData, setFemaleData] = useState<FitModel>(FIT_MODELS.female);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const current = activeGender === 'male' ? maleData : femaleData;

  const handleUpdate = (field: keyof FitModel, value: any) => {
    if (activeGender === 'male') {
      setMaleData((prev) => ({ ...prev, [field]: value }));
    } else {
      setFemaleData((prev) => ({ ...prev, [field]: value }));
    }
  };

  return (
    <section id="fit-reference" className="py-24 md:py-36 px-6 md:px-12 lg:px-16 bg-[#161616] text-[#D6CCBA] border-t border-[#D6CCBA]/10">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div>
            <p className="font-mono-archive text-[11px] uppercase tracking-[0.2em] text-[#D6CCBA]/60 mb-2">
              PROPORTION & ARCHIVE PROFILE
            </p>
            <h2 className="font-serif-editorial text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-[#D6CCBA]">
              Fit & silhouette reference.
            </h2>
          </div>

          {/* Model Switcher & Edit Mode Toggle */}
          <div className="flex items-center gap-3">
            <div className="flex items-center p-1 bg-[#2B2A28] border border-[#D6CCBA]/20 rounded">
              <button
                type="button"
                onClick={() => setActiveGender('male')}
                className={`px-4 py-1.5 text-xs font-mono-archive uppercase tracking-wider rounded transition-colors ${
                  activeGender === 'male'
                    ? 'bg-[#161616] text-[#D6CCBA] shadow-sm font-semibold'
                    : 'text-[#D6CCBA]/60 hover:text-[#D6CCBA]'
                }`}
              >
                Male Fit & Silhouette
              </button>
              <button
                type="button"
                onClick={() => setActiveGender('female')}
                className={`px-4 py-1.5 text-xs font-mono-archive uppercase tracking-wider rounded transition-colors ${
                  activeGender === 'female'
                    ? 'bg-[#161616] text-[#D6CCBA] shadow-sm font-semibold'
                    : 'text-[#D6CCBA]/60 hover:text-[#D6CCBA]'
                }`}
              >
                Female Fit & Silhouette
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="px-3 py-2 text-xs font-mono-archive uppercase tracking-wider border border-[#D6CCBA]/25 rounded hover:bg-[#2B2A28] transition-colors"
            >
              {isEditing ? 'Save Specs' : 'Edit Specs'}
            </button>
          </div>
        </div>

        {/* Fit Stage Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left: Authoritative Model Fit Photograph (100% Unobstructed, zero blocking overlays) */}
          <div className="lg:col-span-6 flex flex-col items-center">
            {/* Clean metadata strip outside the image */}
            <div className="w-full max-w-lg flex items-center justify-between text-[10px] font-mono-archive uppercase tracking-wider text-[#D6CCBA]/60 mb-2.5 pb-1 border-b border-[#D6CCBA]/10">
              <span>{current.label} FIT & SILHOUETTE</span>
              <span>SIZE {current.sizeWorn}</span>
            </div>

            <div className="relative w-full max-w-lg aspect-square bg-[#1b1a18] border border-[#D6CCBA]/25 overflow-hidden flex items-center justify-center shadow-2xl">
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse 90% 70% at 50% 35%, #2B2A28 0%, #1a1918 65%, #141312 100%)',
                }}
              />
              <div className="plate-grain absolute inset-0 pointer-events-none" />

              <img 
                key={current.image}
                src={current.image} 
                alt={`${current.label} fit and silhouette — ${current.heightImperial} (${current.heightCm} cm), ${current.weightKg} kg wearing size ${current.sizeWorn}`}
                className="relative z-10 w-full h-full object-cover object-center filter contrast-[1.02] transition-opacity duration-500"
                loading="lazy"
              />
            </div>
          </div>

          {/* Right: Technical Measurements Ledger */}
          <div className="lg:col-span-6 space-y-8">
            <div>
              <span className="text-[10px] font-mono-archive uppercase tracking-[0.2em] text-[#D6CCBA]/50 block mb-2">
                AUTHENTIC MODEL SPECIFICATIONS
              </span>
              <h3 className="font-serif-editorial text-2xl md:text-3xl font-normal text-[#D6CCBA]">
                {current.label}
              </h3>
              <p className="mt-3 text-sm text-[#D6CCBA]/75 leading-relaxed font-sans">
                {current.fitNotes}
              </p>
            </div>

            {/* Editable or Display Measurements Table */}
            <div className="border border-[#D6CCBA]/15 bg-[#2B2A28]/40 p-6 rounded space-y-4">
              {/* Row 1: Height & Weight */}
              <div className="grid grid-cols-2 gap-6 pb-4 border-b border-[#D6CCBA]/10">
                <div>
                  <label className="text-[11px] font-mono-archive uppercase text-[#D6CCBA]/50 block mb-1">
                    Model Height
                  </label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={current.heightImperial}
                        onChange={(e) => handleUpdate('heightImperial', e.target.value)}
                        placeholder="5'4&quot;"
                        className="w-1/2 bg-[#161616] border border-[#D6CCBA]/30 px-3 py-1.5 rounded text-sm text-[#D6CCBA] font-mono"
                      />
                      <input 
                        type="number"
                        value={current.heightCm}
                        onChange={(e) => handleUpdate('heightCm', Number(e.target.value))}
                        placeholder="163"
                        className="w-1/2 bg-[#161616] border border-[#D6CCBA]/30 px-3 py-1.5 rounded text-sm text-[#D6CCBA] font-mono"
                      />
                    </div>
                  ) : (
                    <span className="text-xl font-serif-editorial text-[#D6CCBA]">
                      {current.heightImperial} <span className="font-mono-archive text-xs text-[#D6CCBA]/60">({current.heightCm} cm)</span>
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-mono-archive uppercase text-[#D6CCBA]/50 block mb-1">
                    Model Weight
                  </label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        value={current.weightKg}
                        onChange={(e) => handleUpdate('weightKg', Number(e.target.value))}
                        placeholder="48"
                        className="w-1/2 bg-[#161616] border border-[#D6CCBA]/30 px-3 py-1.5 rounded text-sm text-[#D6CCBA] font-mono"
                      />
                      <input 
                        type="number"
                        value={current.weightLbs}
                        onChange={(e) => handleUpdate('weightLbs', Number(e.target.value))}
                        placeholder="106"
                        className="w-1/2 bg-[#161616] border border-[#D6CCBA]/30 px-3 py-1.5 rounded text-sm text-[#D6CCBA] font-mono"
                      />
                    </div>
                  ) : (
                    <span className="text-xl font-serif-editorial text-[#D6CCBA]">
                      {current.weightKg} <span className="font-mono-archive text-xs text-[#D6CCBA]/60">kg ({current.weightLbs} lbs)</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Row 2: Chest/Bust & Waist */}
              <div className="grid grid-cols-2 gap-6 pb-4 border-b border-[#D6CCBA]/10">
                <div>
                  <label className="text-[11px] font-mono-archive uppercase text-[#D6CCBA]/50 block mb-1">
                    {activeGender === 'male' ? 'Chest Circumference' : 'Bust Circumference'}
                  </label>
                  {isEditing ? (
                    <input 
                      type="number"
                      value={current.chestOrBustCm}
                      onChange={(e) => handleUpdate('chestOrBustCm', Number(e.target.value))}
                      className="w-full bg-[#161616] border border-[#D6CCBA]/30 px-3 py-1.5 rounded text-sm text-[#D6CCBA] font-mono"
                    />
                  ) : (
                    <span className="text-xl font-serif-editorial text-[#D6CCBA]">
                      {current.chestOrBustCm} <span className="font-mono-archive text-xs text-[#D6CCBA]/60">cm</span>
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-mono-archive uppercase text-[#D6CCBA]/50 block mb-1">
                    Waist Circumference
                  </label>
                  {isEditing ? (
                    <input 
                      type="number"
                      value={current.waistCm}
                      onChange={(e) => handleUpdate('waistCm', Number(e.target.value))}
                      className="w-full bg-[#161616] border border-[#D6CCBA]/30 px-3 py-1.5 rounded text-sm text-[#D6CCBA] font-mono"
                    />
                  ) : (
                    <span className="text-xl font-serif-editorial text-[#D6CCBA]">
                      {current.waistCm} <span className="font-mono-archive text-xs text-[#D6CCBA]/60">cm</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Row 3: Garment Size Worn */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[11px] font-mono-archive uppercase text-[#D6CCBA]/50 block mb-1">
                    Garment Size Worn
                  </label>
                  {isEditing ? (
                    <input 
                      type="text"
                      value={current.sizeWorn}
                      onChange={(e) => handleUpdate('sizeWorn', e.target.value)}
                      className="w-full bg-[#161616] border border-[#D6CCBA]/30 px-3 py-1.5 rounded text-sm text-[#D6CCBA] font-mono"
                    />
                  ) : (
                    <span className="text-xl font-serif-editorial text-[#D6CCBA] font-bold">
                      Size {current.sizeWorn}
                    </span>
                  )}
                </div>

                <div className="flex flex-col justify-end">
                  <span className="text-[11px] font-mono-archive text-[#D6CCBA]/60">
                    Proportion: Architectural relaxed drape
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs font-mono-archive text-[#D6CCBA]/50 tracking-wider">
              Note: Unaltered measurements directly from the lookbook session. Never fabricated.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
};
