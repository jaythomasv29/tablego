// The offer is intentionally pending the owner's flyer; never invent a discount or expiry.
export interface Promotion { id: string; title: string; description: string; terms: string; image?: string; imageAlt?: string; startsOn?: string; endsOn?: string }
export const currentPromotion: Promotion | null = null;
