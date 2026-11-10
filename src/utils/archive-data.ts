/**
 * Pure domain logic and specifications for Atelier NOIRÉ Archive Drop
 */

export interface ColorwayTheme {
  id: 'carbon' | 'blue-charcoal';
  name: string;
  palette: {
    dominant: string;
    surfaces: string;
    accent: string;
    textPrimary: string;
    textBody: string;
    textMuted: string;
    buttonBg: string;
    buttonText: string;
    border: string;
  };
  totalSets: number;
  availableSets: number;
  heroImage: string;
  heroAlt: string;
}

export interface CataloguePhoto {
  id: string;
  src: string;
  aspectRatio: string;
  aspectLabel: string;
  title: string;
  maxWidth: string;
  objectFit?: 'cover' | 'contain';
  notes: string;
}

export const CATALOGUE_GALLERY: Record<'carbon' | 'blue-charcoal', CataloguePhoto[]> = {
  carbon: [
    {
      id: 'carbon-01-top-view',
      src: '/assets/aistudio/lock_in_color_details_designs_and_stitches_from_the_second_picture_clothing_reference_only_lock_in_s_969fe8a9-6386-42e6-a2f5-55ec499a4390_ba8ec28b.png',
      aspectRatio: '1824 / 2288',
      aspectLabel: '4:5',
      title: 'top view',
      maxWidth: '540px',
      objectFit: 'contain',
      notes: 'Direct overhead perspective. Full tracksuit composition in deep noir loopback fleece.',
    },
    {
      id: 'carbon-02-horizontal-crop',
      src: '/assets/aistudio/file_00000000522482118f9873bb62d7e5de_3_f98f2c97.jpg',
      aspectRatio: '1024 / 826',
      aspectLabel: '5:4',
      title: 'horizontal crop',
      maxWidth: '720px',
      objectFit: 'contain',
      notes: 'Horizontal cut highlighting chest silhouette, dropped shoulders and hooded construction.',
    },
    {
      id: 'carbon-03-back-view',
      src: '/assets/aistudio/2026-11-01_07_20_57.782_0600_c236c75e.jpg',
      aspectRatio: '1024 / 1536',
      aspectLabel: '2:3',
      title: 'back view M hoodie with XL trousers',
      maxWidth: '480px',
      objectFit: 'contain',
      notes: 'Rear editorial silhouette pairing Medium top with Extra-Large straight-leg trouser fall.',
    },
    {
      id: 'carbon-04-embroidery',
      src: '/assets/aistudio/_MG_5259_6af32076.jpg',
      aspectRatio: '5184 / 3456',
      aspectLabel: '3:2',
      title: 'chest embroidery- 20k stitches',
      maxWidth: '780px',
      objectFit: 'contain',
      notes: 'High-density multi-tone cursive script and monogram stitching on 390 GSM fleece.',
    },
    {
      id: 'carbon-05-close-up',
      src: '/assets/aistudio/_MG_5259__1__5d8e7dd2.jpg',
      aspectRatio: '1260 / 1000',
      aspectLabel: '5:4',
      title: 'close up, virgin cotton-viscose',
      maxWidth: '700px',
      objectFit: 'contain',
      notes: 'Macro textile resolution displaying tight yarn gauge and dual-tone embroidery relief.',
    },
    {
      id: 'carbon-06-hood-embroidery',
      src: '/assets/aistudio/_MG_5151_2_3c9b89ad.jpg',
      aspectRatio: '3024 / 3885',
      aspectLabel: '4:5',
      title: 'hood embroidery',
      maxWidth: '540px',
      objectFit: 'contain',
      notes: 'Architectural hood apex embroidery relief in tonal black thread on 390 GSM fleece.',
    },
    {
      id: 'carbon-07-hood-embroidery-macro',
      src: '/assets/aistudio/_MG_5262_01ad090f.jpg',
      aspectRatio: '2938 / 2878',
      aspectLabel: '1:1',
      title: 'hood embroidery',
      maxWidth: '600px',
      objectFit: 'contain',
      notes: 'High-density macro embroidery detail showing directional satin needlework on double-layered hood.',
    },
    {
      id: 'carbon-08-totebag',
      src: '/assets/aistudio/_MG_5016_2_cd2ad39c.jpg',
      aspectRatio: '1583 / 2259',
      aspectLabel: '2:3',
      title: 'Handcrafted totebag',
      maxWidth: '520px',
      objectFit: 'contain',
      notes: 'Embroidered natural canvas totebag with signature geometric blocking. Included complimentary with each archive set.',
    },
  ],
  'blue-charcoal': [
    {
      id: 'blue-01-front-view',
      src: '/assets/aistudio/2026-11-01_07_13_34.115_0600_bb8a7721.jpg',
      aspectRatio: '1824 / 2288',
      aspectLabel: '4:5',
      title: 'front view',
      maxWidth: '540px',
      objectFit: 'contain',
      notes: 'Full frontal studio portrait. Blue Charcoal tracksuit with chrome reflection mannequin.',
    },
    {
      id: 'blue-02-one-third',
      src: '/assets/aistudio/file_00000000cf10821192d5b1152d2773e0_2_42d7355a.jpg',
      aspectRatio: '1000 / 1500',
      aspectLabel: '2:3',
      title: '1/3rd',
      maxWidth: '480px',
      objectFit: 'contain',
      notes: 'Front profile and arm stripe geometry.',
    },
    {
      id: 'blue-03-full-silhouette',
      src: '/assets/aistudio/2026-11-03_17_06_32.405_0600_6b9f05f3.jpg',
      aspectRatio: '768 / 1024',
      aspectLabel: '3:4',
      title: 'full silhouette',
      maxWidth: '520px',
      objectFit: 'contain',
      notes: 'Full studio portrait displaying relaxed straight drape and arm stripe geometry.',
    },
    {
      id: 'blue-04-rear-perspective',
      src: '/assets/aistudio/file_000000007db88211a8e0b9aba7ad72ef_2817ac89.png',
      aspectRatio: '1200 / 1500',
      aspectLabel: '4:5',
      title: 'rear perspective',
      maxWidth: '540px',
      objectFit: 'contain',
      notes: "Rear perspective of a 6'3 MANNEQUIN wearing XXL set",
    },
    {
      id: 'blue-05-embroidery',
      src: '/assets/aistudio/_MG_5101__1__e5a01ec8.jpg',
      aspectRatio: '5184 / 3456',
      aspectLabel: '3:2',
      title: 'chest embroidery',
      maxWidth: '780px',
      objectFit: 'contain',
      notes: 'Direct blue-on-slate embroidery relief with dual-thread cursive needlework.',
    },
    {
      id: 'blue-06-close-up',
      src: '/assets/aistudio/_MG_5099_844c6804.jpg',
      aspectRatio: '1935 / 1653',
      aspectLabel: '7:6',
      title: 'close up, virgin cotton viscose - ethically dyed',
      maxWidth: '700px',
      objectFit: 'contain',
      notes: 'Ultra-close fiber inspection of the loopback weave and hand-guided needle tension.',
    },
    {
      id: 'blue-07-hood-embroidery',
      src: '/assets/aistudio/_MG_5013_2_2c04bac4.jpg',
      aspectRatio: '3191 / 3541',
      aspectLabel: '9:10',
      title: 'hood embroidery',
      maxWidth: '560px',
      objectFit: 'contain',
      notes: 'Overhead angle of hood apex displaying contrasting steel blue monogram embroidery on slate fleece.',
    },
    {
      id: 'blue-08-hood-embroidery-macro',
      src: '/assets/aistudio/_MG_5103_9b0735a9.jpg',
      aspectRatio: '5184 / 3456',
      aspectLabel: '3:2',
      title: 'hood embroidery',
      maxWidth: '780px',
      objectFit: 'contain',
      notes: 'Macro texture of the electric steel-blue embroidery thread against looped cotton ribbing.',
    },
    {
      id: 'blue-09-totebag',
      src: '/assets/aistudio/_MG_5020_07cb5c31.jpg',
      aspectRatio: '3456 / 5184',
      aspectLabel: '2:3',
      title: 'Handcrafted totebag',
      maxWidth: '500px',
      objectFit: 'contain',
      notes: 'Embroidered natural canvas totebag with signature geometric blocking. Included complimentary with each archive set.',
    },
  ],
};

export interface GarmentSpecs {
  editionNumber: string;
  totalEdition: number;
  topGsm: number;
  bottomGsm: number;
  composition: string;
  embroideryLocations: string[];
  designOrigin: string;
  productionStudio: string;
  priceEur: number;
}

export const ARCHIVE_SPECS: GarmentSpecs = {
  editionNumber: '01',
  totalEdition: 88,
  topGsm: 390,
  bottomGsm: 280,
  composition: '100% Heavyweight Cotton Loopback Fleece',
  embroideryLocations: ['Hood Apex', 'Chest Left', 'Trouser Upper Leg'],
  designOrigin: 'Dublin, Ireland',
  productionStudio: 'Independent Atelier, Bangladesh',
  priceEur: 88,
};

export const COLORWAYS: Record<'carbon' | 'blue-charcoal', ColorwayTheme> = {
  carbon: {
    id: 'carbon',
    name: 'Noir / Carbon',
    palette: {
      dominant: '#161616',
      surfaces: '#2B2A28',
      accent: '#D6CCBA',
      textPrimary: '#D6CCBA',
      textBody: '#AFA99E',
      textMuted: 'rgba(214, 204, 186, 0.62)',
      buttonBg: '#D6CCBA',
      buttonText: '#161616',
      border: 'rgba(214, 204, 186, 0.20)',
    },
    totalSets: 44,
    availableSets: 14,
    heroImage: '/assets/aistudio/lock_in_color_details_designs_and_stitches_from_the_second_picture_clothing_reference_only_lock_in_s_969fe8a9-6386-42e6-a2f5-55ec499a4390_ba8ec28b.png',
    heroAlt: 'Atelier NOIRÉ Archive Drop set in Noir Carbon: 390 GSM hooded top with natural botanical black panels and embroidered trousers.',
  },
  'blue-charcoal': {
    id: 'blue-charcoal',
    name: 'Blue Charcoal',
    palette: {
      dominant: '#14191F',
      surfaces: '#263443',
      accent: '#8FA9C4',
      textPrimary: '#F0F2F4',
      textBody: '#BBC6D0',
      textMuted: '#A4AFBA',
      buttonBg: '#8FA9C4',
      buttonText: '#111820',
      border: '#465462',
    },
    totalSets: 44,
    availableSets: 9,
    heroImage: '/assets/aistudio/2026-11-01_07_13_34.115_0600_bb8a7721.jpg',
    heroAlt: 'Atelier NOIRÉ Archive Drop set in Blue Charcoal: deep slate surfaces with caramel stripe and sleeve highlights.',
  },
};

export interface FitModel {
  gender: 'male' | 'female';
  label: string;
  heightCm: number;
  heightImperial: string;
  weightKg: number;
  weightLbs: number;
  chestOrBustCm: number;
  waistCm: number;
  sizeWorn: string;
  image: string;
  fitNotes: string;
}

export const FIT_MODELS: Record<'male' | 'female', FitModel> = {
  male: {
    gender: 'male',
    label: 'Male Model Reference',
    heightCm: 178,
    heightImperial: "5'10\"",
    weightKg: 60,
    weightLbs: 132,
    chestOrBustCm: 96,
    waistCm: 76,
    sizeWorn: 'L',
    image: '/assets/aistudio/atelier_noire_detail_corrected_1920_e77bd4e1.jpg',
    fitNotes: 'True relaxed silhouette on a 5\'10" / 60 kg male silhouette. Authentic studio lookbook capture.',
  },
  female: {
    gender: 'female',
    label: 'Female Model Reference',
    heightCm: 163,
    heightImperial: "5'4\"",
    weightKg: 48,
    weightLbs: 106,
    chestOrBustCm: 84,
    waistCm: 64,
    sizeWorn: 'M',
    image: '/assets/aistudio/file_000000005c4082119e181008ed05ab16_58be1455.jpg',
    fitNotes: 'Generous architectural drape on a 5\'4" / 48 kg female silhouette. Authentic studio lookbook capture.',
  },
};

/**
 * Recommends size based on chest measurement in cm
 */
export function recommendSize(chestCm: number): string {
  if (chestCm <= 94) return 'S';
  if (chestCm <= 100) return 'M';
  if (chestCm <= 106) return 'L';
  if (chestCm <= 114) return 'XL';
  return 'XXL';
}

/**
 * Calculates remaining inventory across colourways
 */
export function calculateRemainingSets(): { totalAvailable: number; percentSold: number } {
  const totalAvailable = COLORWAYS.carbon.availableSets + COLORWAYS['blue-charcoal'].availableSets;
  const totalIssued = ARCHIVE_SPECS.totalEdition;
  const percentSold = Math.round(((totalIssued - totalAvailable) / totalIssued) * 100);
  return { totalAvailable, percentSold };
}

export const CLOSED_SIZES = ['S'] as const;

/**
 * Validates set reservation
 */
export function validateReservation(colorway: 'carbon' | 'blue-charcoal', size: string): { valid: boolean; error?: string } {
  const validSizes = ['S', 'M', 'L', 'XL', 'XXL'];
  if (!validSizes.includes(size)) {
    return { valid: false, error: 'Please choose an available size from the run.' };
  }
  if ((CLOSED_SIZES as readonly string[]).includes(size)) {
    return { valid: false, error: `Size ${size} is archive closed and no longer available.` };
  }
  const theme = COLORWAYS[colorway];
  if (!theme || theme.availableSets <= 0) {
    return { valid: false, error: 'This edition colourway is currently allocated.' };
  }
  return { valid: true };
}

export interface GarmentSizeDetail {
  size: string;
  hoodieChestPitToPitCm: number;
  hoodieLengthCm: number;
  hoodieShoulderCm: number;
  hoodieSleeveCm: number;
  trouserWaistRelaxedCm: number;
  trouserInseamCm: number;
  trouserOutseamCm: number;
  recommendedChestRangeCm: string;
  status: 'available' | 'closed';
}

export const SIZE_SPECIFICATIONS: Record<string, GarmentSizeDetail> = {
  S: {
    size: 'S',
    hoodieChestPitToPitCm: 54,
    hoodieLengthCm: 67,
    hoodieShoulderCm: 52,
    hoodieSleeveCm: 61,
    trouserWaistRelaxedCm: 72,
    trouserInseamCm: 75,
    trouserOutseamCm: 102,
    recommendedChestRangeCm: '84 – 94 cm (33 – 37 in)',
    status: 'closed',
  },
  M: {
    size: 'M',
    hoodieChestPitToPitCm: 57,
    hoodieLengthCm: 70,
    hoodieShoulderCm: 55,
    hoodieSleeveCm: 63,
    trouserWaistRelaxedCm: 76,
    trouserInseamCm: 77,
    trouserOutseamCm: 105,
    recommendedChestRangeCm: '95 – 100 cm (37.5 – 39.5 in)',
    status: 'available',
  },
  L: {
    size: 'L',
    hoodieChestPitToPitCm: 60,
    hoodieLengthCm: 72,
    hoodieShoulderCm: 58,
    hoodieSleeveCm: 64,
    trouserWaistRelaxedCm: 82,
    trouserInseamCm: 79,
    trouserOutseamCm: 108,
    recommendedChestRangeCm: '101 – 106 cm (40 – 42 in)',
    status: 'available',
  },
  XL: {
    size: 'XL',
    hoodieChestPitToPitCm: 63,
    hoodieLengthCm: 75,
    hoodieShoulderCm: 61,
    hoodieSleeveCm: 66,
    trouserWaistRelaxedCm: 88,
    trouserInseamCm: 81,
    trouserOutseamCm: 111,
    recommendedChestRangeCm: '107 – 114 cm (42 – 45 in)',
    status: 'available',
  },
  XXL: {
    size: 'XXL',
    hoodieChestPitToPitCm: 66,
    hoodieLengthCm: 77,
    hoodieShoulderCm: 63,
    hoodieSleeveCm: 67,
    trouserWaistRelaxedCm: 94,
    trouserInseamCm: 82,
    trouserOutseamCm: 113,
    recommendedChestRangeCm: '115 – 124 cm (45 – 49 in)',
    status: 'available',
  },
};

export const CUSTOMER_CARE_DETAILS = {
  conciergeEmail: 'noire.ireland@gmail.com',
  operatingHours: 'Monday – Friday, 09:00 – 18:00 IST',
  statutoryCancellationDays: 14,
  shippingTerritory: 'Republic of Ireland (All 26 counties of Ireland*)',
  shippingMethod: 'Insured Tracked Courier Service',
  shippingCost: 'Complimentary (100% Free)',
  paymentMethod: 'Cash on Delivery (COD) upon physical handover',
  estimatedProcessingTime: '1 – 2 business days',
  estimatedTransitTime: '2 – 3 business days post-dispatch',
  missingInformationNotes: [
    'Physical Dublin return address will be provided on formal return authorization or confirmed prior to public launch.',
    'Official company registration number (CRO) to be added prior to live commercial deployment.',
    'Courier live API tracking integration will link dynamically once operational carrier contract is active.',
  ],
};

