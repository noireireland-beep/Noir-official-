import React from 'react';

interface GarmentLedgerProps {
  onSelectInspectTile?: (tileId: 'hood' | 'chest' | 'trousers' | 'sleeve') => void;
}

/**
 * GarmentLedger has been consolidated into the unified 3-layer Editorial Catalogue in ProductVariants.
 * Exported for backward compatibility.
 */
export const GarmentLedger: React.FC<GarmentLedgerProps> = () => {
  return null;
};
