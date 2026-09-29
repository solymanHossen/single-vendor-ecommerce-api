/** Every store-wide setting — the full shape of the `app_settings` singleton. */
export interface AppSettings {
  // Customer accounts
  allowRegistration: boolean;
  enableGoogleLogin: boolean;
  // Branding
  storeName: string;
  tagline: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  // Contact
  supportEmail: string | null;
  supportPhone: string | null;
  whatsappNumber: string | null;
  storeAddress: string | null;
  businessHours: string | null;
  // Social
  facebookUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  tiktokUrl: string | null;
  // Shipping (whole BDT)
  shippingFeeInsideDhaka: number;
  shippingFeeOutsideDhaka: number;
  freeShippingThreshold: number;
  // Inventory
  lowStockThreshold: number;
  // Announcement bar
  announcementEnabled: boolean;
  announcementMessage: string;
  announcementPromotion: boolean;
  // SEO
  metaTitle: string | null;
  metaDescription: string | null;
}

/** The subset checkout needs to price delivery. */
export type ShippingRules = Pick<
  AppSettings,
  'shippingFeeInsideDhaka' | 'shippingFeeOutsideDhaka' | 'freeShippingThreshold'
>;
