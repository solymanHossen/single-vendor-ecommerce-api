import { ApiProperty } from '@nestjs/swagger';
import type { AppSettings } from '../interfaces/app-settings.interface';

/** Every store setting. None are secret, so the same shape is served publicly. */
export class SettingsEntity implements AppSettings {
  @ApiProperty({ example: true, description: 'Whether new email/password sign-ups are allowed' })
  allowRegistration: boolean;

  @ApiProperty({ example: true, description: 'Whether Google sign-in is allowed' })
  enableGoogleLogin: boolean;

  @ApiProperty({ example: 'AURA' })
  storeName: string;

  @ApiProperty({ example: 'Next-gen tech & streetwear' })
  tagline: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'http://localhost:3000/api/v1/storage/stream/branding/logo.png',
  })
  logoUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  faviconUrl: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'support@aura.com.bd' })
  supportEmail: string | null;

  @ApiProperty({ nullable: true, type: String, example: '+880 9610 123456' })
  supportPhone: string | null;

  @ApiProperty({ nullable: true, type: String, example: '+8801712345678' })
  whatsappNumber: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'House 12, Road 5, Dhanmondi, Dhaka 1205' })
  storeAddress: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'Sat–Thu, 10am–8pm' })
  businessHours: string | null;

  @ApiProperty({ nullable: true, type: String })
  facebookUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  instagramUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  youtubeUrl: string | null;

  @ApiProperty({ nullable: true, type: String })
  tiktokUrl: string | null;

  @ApiProperty({ example: 60, description: 'Delivery fee inside Dhaka (BDT)' })
  shippingFeeInsideDhaka: number;

  @ApiProperty({ example: 120, description: 'Delivery fee outside Dhaka (BDT)' })
  shippingFeeOutsideDhaka: number;

  @ApiProperty({ example: 10000, description: 'Subtotal (BDT) from which delivery is free' })
  freeShippingThreshold: number;

  @ApiProperty({ example: true })
  announcementEnabled: boolean;

  @ApiProperty({ example: '100% authentic products · Cash on delivery nationwide' })
  announcementMessage: string;

  @ApiProperty({
    example: true,
    description: 'Feature the running coupon campaign when there is one',
  })
  announcementPromotion: boolean;

  @ApiProperty({ nullable: true, type: String })
  metaTitle: string | null;

  @ApiProperty({ nullable: true, type: String })
  metaDescription: string | null;

  constructor(partial: AppSettings) {
    this.allowRegistration = partial.allowRegistration;
    this.enableGoogleLogin = partial.enableGoogleLogin;
    this.storeName = partial.storeName;
    this.tagline = partial.tagline;
    this.logoUrl = partial.logoUrl;
    this.faviconUrl = partial.faviconUrl;
    this.supportEmail = partial.supportEmail;
    this.supportPhone = partial.supportPhone;
    this.whatsappNumber = partial.whatsappNumber;
    this.storeAddress = partial.storeAddress;
    this.businessHours = partial.businessHours;
    this.facebookUrl = partial.facebookUrl;
    this.instagramUrl = partial.instagramUrl;
    this.youtubeUrl = partial.youtubeUrl;
    this.tiktokUrl = partial.tiktokUrl;
    this.shippingFeeInsideDhaka = partial.shippingFeeInsideDhaka;
    this.shippingFeeOutsideDhaka = partial.shippingFeeOutsideDhaka;
    this.freeShippingThreshold = partial.freeShippingThreshold;
    this.announcementEnabled = partial.announcementEnabled;
    this.announcementMessage = partial.announcementMessage;
    this.announcementPromotion = partial.announcementPromotion;
    this.metaTitle = partial.metaTitle;
    this.metaDescription = partial.metaDescription;
  }
}
