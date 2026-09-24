import type { ImageKey } from './images.data';

/**
 * Single source of truth for the seeded storefront catalog.
 *
 * Everything the catalog seeders write — categories, attributes and their
 * options, products, images, variants — is derived from the declarations in
 * this file, so the category tree, attribute vocabulary and product variants
 * can never drift out of sync with one another.
 *
 * Prices are whole BDT (৳) amounts — the store's payment providers are
 * bKash/SSLCommerz/COD/Stripe, i.e. a Bangladesh-market storefront.
 */

// ── Categories ──────────────────────────────────────────────────────────────

export interface CategorySeed {
  readonly name: string;
  readonly slug: string;
  /** Short uppercase code used as the product SKU prefix. */
  readonly code: string;
  readonly icon: ImageKey;
  readonly metaDesc: string;
  readonly children?: readonly CategorySeed[];
}

export const CATEGORY_TREE: readonly CategorySeed[] = [
  {
    name: 'Electronics',
    slug: 'electronics',
    code: 'ELC',
    icon: 'iphoneWithLaptop',
    metaDesc:
      'Shop the latest smartphones, laptops, tablets, audio and wearables with official warranty.',
    children: [
      {
        name: 'Smartphones',
        slug: 'smartphones',
        code: 'PHN',
        icon: 'iphoneOnWood',
        metaDesc: 'Flagship and mid-range smartphones from Apple, Samsung, Google and OnePlus.',
      },
      {
        name: 'Laptops',
        slug: 'laptops',
        code: 'LTP',
        icon: 'macbookNeon',
        metaDesc: 'Ultrabooks, creator and gaming laptops for work, study and play.',
      },
      {
        name: 'Tablets',
        slug: 'tablets',
        code: 'TAB',
        icon: 'ipadWithPencil',
        metaDesc: 'iPad and Android tablets for drawing, streaming and productivity on the go.',
      },
      {
        name: 'Audio',
        slug: 'audio',
        code: 'AUD',
        icon: 'headphonesYellow',
        metaDesc: 'Noise-cancelling headphones, true-wireless earbuds and portable speakers.',
      },
      {
        name: 'Wearables',
        slug: 'wearables',
        code: 'WRB',
        icon: 'smartwatchBlack',
        metaDesc: 'Smartwatches and fitness trackers that keep you connected and healthy.',
      },
      {
        name: 'Cameras',
        slug: 'cameras',
        code: 'CAM',
        icon: 'instantCamera',
        metaDesc: 'Instant, mirrorless and action cameras for every kind of storyteller.',
      },
    ],
  },
  {
    name: 'Gaming',
    slug: 'gaming',
    code: 'GAM',
    icon: 'gamingRig',
    metaDesc: 'Consoles, controllers, gaming PCs and pro-grade accessories.',
    children: [
      {
        name: 'Consoles & Controllers',
        slug: 'consoles',
        code: 'CON',
        icon: 'ps5Console',
        metaDesc: 'PlayStation and Xbox consoles, controllers and bundles.',
      },
      {
        name: 'Gaming PC',
        slug: 'gaming-pc',
        code: 'GPC',
        icon: 'battlestation',
        metaDesc: 'Pre-built RTX gaming rigs, tuned and stress-tested before dispatch.',
      },
      {
        name: 'PC Accessories',
        slug: 'pc-accessories',
        code: 'PCA',
        icon: 'mechanicalKeyboard',
        metaDesc: 'Mechanical keyboards, precision mice and high-refresh monitors.',
      },
    ],
  },
  {
    name: 'Fashion',
    slug: 'fashion',
    code: 'FSH',
    icon: 'clothingRack',
    metaDesc: 'Everyday essentials and statement pieces for men and women.',
    children: [
      {
        name: "Men's Clothing",
        slug: 'mens-clothing',
        code: 'MEN',
        icon: 'teeWhite',
        metaDesc: 'T-shirts, jackets, denim and tailoring for men.',
      },
      {
        name: "Women's Clothing",
        slug: 'womens-clothing',
        code: 'WMN',
        icon: 'trackSuitYellow',
        metaDesc: 'Knitwear, loungewear and seasonal favourites for women.',
      },
      {
        name: 'Footwear',
        slug: 'footwear',
        code: 'FTW',
        icon: 'sneakerRed',
        metaDesc: 'Running shoes, lifestyle sneakers and formal footwear.',
      },
      {
        name: 'Bags & Accessories',
        slug: 'bags-accessories',
        code: 'ACC',
        icon: 'crossbodyBag',
        metaDesc: 'Backpacks, handbags, wallets, watches, eyewear and jewellery.',
      },
    ],
  },
  {
    name: 'Beauty & Personal Care',
    slug: 'beauty',
    code: 'BTY',
    icon: 'makeupFlatlay',
    metaDesc: 'Authentic skincare, makeup and fragrances from trusted brands.',
    children: [
      {
        name: 'Skincare',
        slug: 'skincare',
        code: 'SKN',
        icon: 'skincareSet',
        metaDesc: 'Cleansers, serums and treatments for every skin type.',
      },
      {
        name: 'Makeup',
        slug: 'makeup',
        code: 'MKP',
        icon: 'makeupBrushes',
        metaDesc: 'Lipsticks, brushes and complete makeup kits.',
      },
      {
        name: 'Fragrances',
        slug: 'fragrances',
        code: 'FRG',
        icon: 'perfumeNo5',
        metaDesc: 'Iconic eau de parfums and long-lasting signature scents.',
      },
    ],
  },
  {
    name: 'Home & Living',
    slug: 'home-living',
    code: 'HOM',
    icon: 'sectionalLivingRoom',
    metaDesc: 'Furniture, kitchenware and decor to make every room feel like home.',
    children: [
      {
        name: 'Furniture',
        slug: 'furniture',
        code: 'FUR',
        icon: 'velvetSofa',
        metaDesc: 'Sofas, lounge chairs and dining seating built to last.',
      },
      {
        name: 'Kitchen & Dining',
        slug: 'kitchen-dining',
        code: 'KIT',
        icon: 'espressoMachine',
        metaDesc: 'Coffee machines, drinkware and everyday kitchen essentials.',
      },
      {
        name: 'Decor & Lighting',
        slug: 'decor-lighting',
        code: 'DEC',
        icon: 'floorLamp',
        metaDesc: 'Lamps, room dividers and stationery for a considered home.',
      },
    ],
  },
  {
    name: 'Sports & Fitness',
    slug: 'sports-fitness',
    code: 'SPT',
    icon: 'barbellDeadlift',
    metaDesc: 'Strength equipment, yoga gear and home-workout essentials.',
    children: [
      {
        name: 'Gym Equipment',
        slug: 'gym-equipment',
        code: 'GYM',
        icon: 'barbellDeadlift',
        metaDesc: 'Barbells, plates and strength-training equipment.',
      },
      {
        name: 'Yoga & Wellness',
        slug: 'yoga-wellness',
        code: 'YOG',
        icon: 'yogaSunset',
        metaDesc: 'Yoga mats, resistance bands and recovery essentials.',
      },
    ],
  },
];

// ── Attributes ──────────────────────────────────────────────────────────────

/**
 * Canonical attribute vocabulary. Option values are derived from the product
 * declarations below, so an attribute only receives options that at least
 * one variant actually uses.
 */
export const ATTRIBUTE_NAMES = [
  'Color',
  'Storage',
  'RAM',
  'Size',
  'Waist',
  'Shoe Size',
  'Case Size',
  'Volume',
  'Edition',
  'Switch Type',
  'Ring Size',
] as const;

export type AttributeName = (typeof ATTRIBUTE_NAMES)[number];

/** A plain option value, or one that raises the variant price by `priceDelta` BDT. */
export type OptionSeed = string | { readonly value: string; readonly priceDelta: number };

export interface VariantAxisSeed {
  readonly attribute: AttributeName;
  readonly options: readonly OptionSeed[];
}

// ── Products ────────────────────────────────────────────────────────────────

export interface ProductSeed {
  readonly name: string;
  readonly slug: string;
  readonly categorySlug: string;
  readonly brand: string;
  /** Regular price, whole BDT. */
  readonly basePrice: number;
  /** Sale price, whole BDT — must be lower than `basePrice` when present. */
  readonly discountPrice?: number;
  readonly summary: string;
  readonly features: readonly string[];
  /** First entry becomes the thumbnail. */
  readonly images: readonly ImageKey[];
  /** Cartesian product of these axes becomes the product's variant set. */
  readonly variantAxes?: readonly VariantAxisSeed[];
  /** Fixed stock level (e.g. 0 to demo "out of stock"); randomised when omitted. */
  readonly stock?: number;
  /** Defaults to true; false demos "draft / coming soon" products in admin. */
  readonly isPublished?: boolean;
}

const APPAREL_SIZES = ['S', 'M', 'L', 'XL'] as const;
const SHOE_SIZES = ['39', '40', '41', '42', '43', '44'] as const;

export const PRODUCTS: readonly ProductSeed[] = [
  // ── Smartphones ────────────────────────────────────────────────────────────
  {
    name: 'Apple iPhone 15 Pro',
    slug: 'iphone-15-pro',
    categorySlug: 'smartphones',
    brand: 'Apple',
    basePrice: 164999,
    discountPrice: 154999,
    summary:
      'Forged in aerospace-grade titanium, iPhone 15 Pro pairs the A17 Pro chip with a pro camera system that shoots 48MP ProRAW and 4K60 Dolby Vision video.',
    features: [
      '6.1" Super Retina XDR display with ProMotion and Always-On',
      'A17 Pro chip with 6-core GPU and hardware ray tracing',
      '48MP main, 12MP ultra-wide and 3x telephoto cameras',
      'USB-C with USB 3 speeds and customisable Action button',
    ],
    images: ['iphoneOnWood', 'iphoneOnSheet', 'iphoneNeonHand'],
    variantAxes: [
      { attribute: 'Color', options: ['Natural Titanium', 'Black Titanium', 'White Titanium'] },
      {
        attribute: 'Storage',
        options: [
          '128GB',
          { value: '256GB', priceDelta: 15000 },
          { value: '512GB', priceDelta: 40000 },
        ],
      },
    ],
  },
  {
    name: 'Samsung Galaxy S24 Ultra',
    slug: 'samsung-galaxy-s24-ultra',
    categorySlug: 'smartphones',
    brand: 'Samsung',
    basePrice: 149999,
    discountPrice: 139999,
    summary:
      'Galaxy AI meets a titanium frame: the S24 Ultra brings a built-in S Pen, a 200MP camera with 100x Space Zoom and seven years of OS updates.',
    features: [
      '6.8" QHD+ Dynamic AMOLED 2X, 2600 nits peak brightness',
      'Snapdragon 8 Gen 3 for Galaxy with 12GB RAM',
      '200MP wide camera with 5x and 3x optical telephoto',
      'Built-in S Pen and 5000mAh battery with 45W charging',
    ],
    images: ['samsungViolet', 'androidHomeScreen'],
    variantAxes: [
      { attribute: 'Color', options: ['Titanium Gray', 'Titanium Violet', 'Titanium Black'] },
      { attribute: 'Storage', options: ['256GB', { value: '512GB', priceDelta: 18000 }] },
    ],
  },
  {
    name: 'Google Pixel 8 Pro',
    slug: 'google-pixel-8-pro',
    categorySlug: 'smartphones',
    brand: 'Google',
    basePrice: 114999,
    discountPrice: 104999,
    summary:
      'The most helpful Pixel yet, with Google Tensor G3, Magic Editor, Best Take and a pro-level triple camera tuned by computational photography.',
    features: [
      '6.7" Super Actua LTPO display, 1–120Hz',
      'Google Tensor G3 with Titan M2 security chip',
      '50MP main, 48MP ultra-wide and 48MP 5x telephoto',
      'Seven years of OS, security and Feature Drop updates',
    ],
    images: ['androidHomeScreen', 'androidDarkScreen'],
    variantAxes: [
      { attribute: 'Color', options: ['Obsidian', 'Porcelain', 'Bay'] },
      { attribute: 'Storage', options: ['128GB', { value: '256GB', priceDelta: 10000 }] },
    ],
  },
  {
    name: 'Apple iPhone 13',
    slug: 'iphone-13',
    categorySlug: 'smartphones',
    brand: 'Apple',
    basePrice: 84999,
    discountPrice: 74999,
    summary:
      'A proven all-rounder with the A15 Bionic chip, a bright OLED display and a dual-camera system with Cinematic mode — now at its best-ever price.',
    features: [
      '6.1" Super Retina XDR OLED display',
      'A15 Bionic chip with 16-core Neural Engine',
      'Dual 12MP cameras with sensor-shift stabilisation',
      'Ceramic Shield front and IP68 water resistance',
    ],
    images: ['iphoneWhiteBack', 'iphoneWithLaptop'],
    variantAxes: [
      { attribute: 'Color', options: ['Starlight', 'Midnight', 'Blue'] },
      { attribute: 'Storage', options: ['128GB', { value: '256GB', priceDelta: 12000 }] },
    ],
  },
  {
    name: 'OnePlus 12',
    slug: 'oneplus-12',
    categorySlug: 'smartphones',
    brand: 'OnePlus',
    basePrice: 89999,
    summary:
      'Flagship speed without the flagship price: Snapdragon 8 Gen 3, a Hasselblad-tuned camera and 80W SUPERVOOC charging that fills the battery in under 30 minutes.',
    features: [
      '6.82" 2K ProXDR LTPO display, 4500 nits peak',
      'Snapdragon 8 Gen 3 with up to 16GB LPDDR5X RAM',
      '4th Gen Hasselblad camera with 64MP 3x periscope',
      '5400mAh battery with 80W wired and 50W wireless charging',
    ],
    images: ['androidDarkScreen', 'androidHomeScreen'],
    variantAxes: [
      { attribute: 'Color', options: ['Silky Black', 'Flowy Emerald'] },
      { attribute: 'Storage', options: ['256GB', { value: '512GB', priceDelta: 9000 }] },
    ],
  },

  // ── Laptops ────────────────────────────────────────────────────────────────
  {
    name: 'Apple MacBook Air 13" M3',
    slug: 'macbook-air-m3',
    categorySlug: 'laptops',
    brand: 'Apple',
    basePrice: 144999,
    discountPrice: 134999,
    summary:
      'Impossibly thin and completely silent, MacBook Air with M3 delivers up to 18 hours of battery life and runs Apple Intelligence with ease.',
    features: [
      '13.6" Liquid Retina display, 500 nits, 1 billion colours',
      'Apple M3 chip with 8-core CPU and hardware ray tracing',
      'Fanless design — just 1.24 kg and 11.3 mm thin',
      'Supports two external displays with the lid closed',
    ],
    images: ['macbookNeon', 'macbookSilver', 'laptopOnDesk'],
    variantAxes: [
      { attribute: 'Color', options: ['Midnight', 'Starlight', 'Space Gray'] },
      { attribute: 'Storage', options: ['256GB', { value: '512GB', priceDelta: 25000 }] },
    ],
  },
  {
    name: 'Apple MacBook Pro 14" M3 Pro',
    slug: 'macbook-pro-14-m3-pro',
    categorySlug: 'laptops',
    brand: 'Apple',
    basePrice: 239999,
    summary:
      'A pro laptop for demanding workflows: the M3 Pro chip, a stunning Liquid Retina XDR display and a battery that lasts a full day of rendering.',
    features: [
      '14.2" Liquid Retina XDR, 1600 nits HDR peak',
      'M3 Pro with 11-core CPU and 14-core GPU',
      '18GB unified memory, up to 22 hours battery life',
      'HDMI, SDXC slot, MagSafe 3 and three Thunderbolt 4 ports',
    ],
    images: ['laptopOnDesk', 'laptopBrowser', 'laptopWorkspace'],
    variantAxes: [
      { attribute: 'Storage', options: ['512GB', { value: '1TB', priceDelta: 30000 }] },
    ],
  },
  {
    name: 'Dell XPS 13 Plus',
    slug: 'dell-xps-13-plus',
    categorySlug: 'laptops',
    brand: 'Dell',
    basePrice: 169999,
    discountPrice: 157999,
    summary:
      'A future-forward ultrabook with an edge-to-edge keyboard, seamless glass haptic touchpad and a 3.5K OLED touch display.',
    features: [
      '13.4" 3.5K OLED InfinityEdge touch display',
      'Intel Core Ultra 7 155H with Intel Arc graphics',
      'Capacitive function row and invisible haptic touchpad',
      'Thunderbolt 4, Wi-Fi 7 and 1TB PCIe Gen 4 SSD',
    ],
    images: ['laptopWorkspace', 'laptopBrowser'],
    variantAxes: [{ attribute: 'RAM', options: ['16GB', { value: '32GB', priceDelta: 18000 }] }],
  },
  {
    name: 'Lenovo ThinkPad X1 Carbon Gen 12',
    slug: 'lenovo-thinkpad-x1-carbon-gen-12',
    categorySlug: 'laptops',
    brand: 'Lenovo',
    basePrice: 184999,
    summary:
      'The business-class benchmark: a 1.09 kg carbon-fibre chassis, legendary ThinkPad keyboard and enterprise-grade security built in.',
    features: [
      '14" 2.8K OLED display with Dolby Vision',
      'Intel Core Ultra 7 vPro with AI-accelerated NPU',
      'MIL-STD-810H tested for durability',
      'Match-on-chip fingerprint reader and IR privacy camera',
    ],
    images: ['macbookSilver', 'laptopWorkspace'],
    variantAxes: [{ attribute: 'RAM', options: ['16GB', { value: '32GB', priceDelta: 20000 }] }],
  },
  {
    name: 'ASUS ROG Zephyrus G14 (2024)',
    slug: 'asus-rog-zephyrus-g14-2024',
    categorySlug: 'laptops',
    brand: 'ASUS',
    basePrice: 199999,
    discountPrice: 186999,
    summary:
      'A 14-inch powerhouse with an RTX 4070, a 120Hz ROG Nebula OLED panel and a CNC-machined aluminium chassis that weighs just 1.5 kg.',
    features: [
      '14" 3K ROG Nebula OLED, 120Hz, 0.2ms, G-SYNC',
      'AMD Ryzen 9 8945HS with NVIDIA GeForce RTX 4070',
      'Slash Lighting LED strip and vapour-chamber cooling',
      '1TB PCIe 4.0 SSD with 73Wh battery',
    ],
    images: ['gamingRig', 'battlestation'],
    variantAxes: [{ attribute: 'RAM', options: ['16GB', { value: '32GB', priceDelta: 15000 }] }],
  },

  // ── Tablets ────────────────────────────────────────────────────────────────
  {
    name: 'Apple iPad Air 11" (M2)',
    slug: 'ipad-air-11-m2',
    categorySlug: 'tablets',
    brand: 'Apple',
    basePrice: 84999,
    discountPrice: 79999,
    summary:
      'Serious performance in a thin and light design — the M2 chip, a Liquid Retina display and support for Apple Pencil Pro and Magic Keyboard.',
    features: [
      '11" Liquid Retina display with True Tone',
      'Apple M2 chip built for Apple Intelligence',
      'Landscape 12MP front camera with Center Stage',
      'Works with Apple Pencil Pro and Magic Keyboard',
    ],
    images: ['ipadWithPencil'],
    variantAxes: [
      { attribute: 'Color', options: ['Space Gray', 'Blue', 'Purple', 'Starlight'] },
      { attribute: 'Storage', options: ['128GB', { value: '256GB', priceDelta: 14000 }] },
    ],
  },
  {
    name: 'Samsung Galaxy Tab S9',
    slug: 'samsung-galaxy-tab-s9',
    categorySlug: 'tablets',
    brand: 'Samsung',
    basePrice: 94999,
    discountPrice: 87999,
    summary:
      'The first IP68 Galaxy Tab: a Dynamic AMOLED 2X screen, an S Pen in the box and Snapdragon 8 Gen 2 performance for creators on the move.',
    features: [
      '11" Dynamic AMOLED 2X, 120Hz',
      'Snapdragon 8 Gen 2 for Galaxy',
      'IP68 water and dust resistance, including the S Pen',
      'Quad speakers tuned by AKG with Dolby Atmos',
    ],
    images: ['ipadWithPencil', 'laptopBrowser'],
    variantAxes: [{ attribute: 'Color', options: ['Graphite', 'Beige'] }],
  },

  // ── Audio ──────────────────────────────────────────────────────────────────
  {
    name: 'Apple AirPods Pro (2nd Generation)',
    slug: 'airpods-pro-2',
    categorySlug: 'audio',
    brand: 'Apple',
    basePrice: 32999,
    discountPrice: 28999,
    summary:
      'Up to 2x more Active Noise Cancellation, Adaptive Audio and Personalised Spatial Audio in a MagSafe USB-C case with Find My.',
    features: [
      'H2 chip with Adaptive Audio and Conversation Awareness',
      'Active Noise Cancellation and Transparency mode',
      'Up to 6 hours listening, 30 hours with the case',
      'IP54 dust, sweat and water resistance',
    ],
    images: ['airpodsFloating', 'earbudsFlatlay'],
  },
  {
    name: 'Apple AirPods Max',
    slug: 'airpods-max',
    categorySlug: 'audio',
    brand: 'Apple',
    basePrice: 74999,
    discountPrice: 68999,
    summary:
      'High-fidelity audio meets industry-leading noise cancellation in a breathable knit-mesh canopy and memory-foam ear cushions.',
    features: [
      'Apple-designed 40mm dynamic drivers',
      'Computational audio with Adaptive EQ',
      'Personalised Spatial Audio with dynamic head tracking',
      'Up to 20 hours of listening with ANC on',
    ],
    images: ['airpodsMaxOrange', 'headphonesAnc'],
    variantAxes: [
      { attribute: 'Color', options: ['Silver', 'Space Gray', 'Sky Blue', 'Pink', 'Green'] },
    ],
  },
  {
    name: 'Sony WH-1000XM5 Wireless Headphones',
    slug: 'sony-wh-1000xm5',
    categorySlug: 'audio',
    brand: 'Sony',
    basePrice: 47999,
    discountPrice: 41999,
    summary:
      "Sony's best noise cancelling ever, powered by eight microphones and two processors, with crystal-clear calls and 30-hour battery life.",
    features: [
      'Auto NC Optimizer with 8 microphones',
      'Specially designed 30mm carbon-fibre drivers',
      'LDAC and DSEE Extreme for Hi-Res wireless audio',
      '3-minute quick charge gives 3 hours of playback',
    ],
    images: ['headphonesAnc', 'headphonesYellow'],
    variantAxes: [{ attribute: 'Color', options: ['Black', 'Silver', 'Midnight Blue'] }],
  },
  {
    name: 'Sony WH-CH720N Noise Cancelling Headphones',
    slug: 'sony-wh-ch720n',
    categorySlug: 'audio',
    brand: 'Sony',
    basePrice: 15999,
    discountPrice: 13499,
    summary:
      "Sony's lightest wireless noise-cancelling headband yet, with 35 hours of battery life and a comfortable fit for all-day listening.",
    features: [
      'Dual Noise Sensor technology',
      'Integrated Processor V1 for natural sound',
      'Up to 35 hours battery with ANC on',
      'Multipoint connection for two devices at once',
    ],
    images: ['headphonesWithKeyboard', 'headphonesWhiteStudio'],
    variantAxes: [{ attribute: 'Color', options: ['Black', 'White', 'Blue'] }],
  },
  {
    name: 'Beats Studio Pro',
    slug: 'beats-studio-pro',
    categorySlug: 'audio',
    brand: 'Beats',
    basePrice: 42999,
    discountPrice: 35999,
    summary:
      'Custom acoustic architecture, fully adaptive noise cancelling and lossless USB-C audio — the signature Beats sound, re-engineered.',
    features: [
      'Fully adaptive Active Noise Cancelling',
      'Personalised Spatial Audio with head tracking',
      'Lossless audio via USB-C',
      'Up to 40 hours of battery life',
    ],
    images: ['headphonesYellow', 'headphonesAnc'],
    variantAxes: [{ attribute: 'Color', options: ['Black', 'Sandstone', 'Navy'] }],
  },
  {
    name: 'Samsung Galaxy Buds2 Pro',
    slug: 'samsung-galaxy-buds2-pro',
    categorySlug: 'audio',
    brand: 'Samsung',
    basePrice: 19999,
    discountPrice: 15999,
    summary:
      '24-bit Hi-Fi sound, intelligent ANC and an ergonomic fit that is 15% smaller than the previous generation.',
    features: [
      '24-bit Hi-Fi audio with Samsung Seamless Codec',
      'Intelligent ANC with three high-SNR microphones',
      '360 Audio with Direct Multi-Channel',
      'IPX7 water resistance',
    ],
    images: ['earbudsRed', 'earbudsFlatlay'],
    variantAxes: [{ attribute: 'Color', options: ['Graphite', 'White', 'Bora Purple'] }],
  },
  {
    name: 'Audio-Technica ATH-M50x Studio Monitor Headphones',
    slug: 'audio-technica-ath-m50x',
    categorySlug: 'audio',
    brand: 'Audio-Technica',
    basePrice: 18500,
    summary:
      'The critically acclaimed studio monitor headphones trusted by engineers and producers for accurate, extended-range reproduction.',
    features: [
      '45mm large-aperture drivers with rare-earth magnets',
      'Exceptional clarity across an extended frequency range',
      '90-degree swivelling earcups for one-ear monitoring',
      'Three detachable cables included',
    ],
    images: ['headphonesWhiteStudio', 'headphonesLeatherRetro'],
  },
  {
    name: 'JBL Flip 6 Portable Bluetooth Speaker',
    slug: 'jbl-flip-6',
    categorySlug: 'audio',
    brand: 'JBL',
    basePrice: 14499,
    discountPrice: 11999,
    summary:
      'Bold JBL Original Pro Sound from a 2-way speaker system, in a rugged IP67 waterproof and dustproof body built for adventures.',
    features: [
      'Racetrack woofer plus separate tweeter',
      'IP67 waterproof and dustproof',
      'Up to 12 hours of playtime',
      'PartyBoost pairs multiple JBL speakers',
    ],
    images: ['speakerPortable'],
    variantAxes: [{ attribute: 'Color', options: ['Black', 'Blue', 'Red', 'Teal'] }],
  },
  {
    name: 'Retro Leather On-Ear Headphones',
    slug: 'retro-leather-on-ear-headphones',
    categorySlug: 'audio',
    brand: 'Urban Sound',
    basePrice: 6500,
    discountPrice: 4990,
    summary:
      'Vintage-inspired wired headphones with genuine leather ear pads, brushed aluminium cups and warm, balanced tuning.',
    features: [
      '40mm neodymium drivers',
      'Genuine lambskin leather ear pads',
      'Braided 1.2m cable with in-line mic',
      'Foldable design with travel pouch',
    ],
    images: ['headphonesLeatherRetro'],
  },

  // ── Wearables ──────────────────────────────────────────────────────────────
  {
    name: 'Apple Watch Series 9',
    slug: 'apple-watch-series-9',
    categorySlug: 'wearables',
    brand: 'Apple',
    basePrice: 52999,
    discountPrice: 47999,
    summary:
      'A brighter display, the magical new double-tap gesture and the S9 SiP make Apple Watch Series 9 the most capable Apple Watch yet.',
    features: [
      'Always-On Retina display, up to 2000 nits',
      'S9 SiP with on-device Siri and double tap',
      'Blood oxygen, ECG and temperature sensing',
      'Crash Detection and Fall Detection',
    ],
    images: ['smartwatchBlack', 'smartwatchWhite'],
    variantAxes: [
      { attribute: 'Case Size', options: ['41mm', { value: '45mm', priceDelta: 4000 }] },
      { attribute: 'Color', options: ['Midnight', 'Starlight', 'Silver'] },
    ],
  },
  {
    name: 'Samsung Galaxy Watch6',
    slug: 'samsung-galaxy-watch6',
    categorySlug: 'wearables',
    brand: 'Samsung',
    basePrice: 34999,
    discountPrice: 29999,
    summary:
      'A slimmer bezel, a 20% larger display and advanced sleep coaching turn Galaxy Watch6 into a personal health companion.',
    features: [
      'Sapphire Crystal Super AMOLED display',
      'BioActive Sensor with body composition analysis',
      'Personalised Sleep Coaching',
      'Up to 40 hours of battery life',
    ],
    images: ['smartwatchWhite', 'smartwatchBlack'],
    variantAxes: [
      { attribute: 'Case Size', options: ['40mm', { value: '44mm', priceDelta: 3000 }] },
    ],
  },

  // ── Cameras ────────────────────────────────────────────────────────────────
  {
    name: 'Polaroid Now+ Gen 2 Instant Camera',
    slug: 'polaroid-now-plus-gen-2',
    categorySlug: 'cameras',
    brand: 'Polaroid',
    basePrice: 21999,
    discountPrice: 18999,
    summary:
      'Analog instant photography with creative control: Bluetooth-connected app modes, five lens filters and a precise two-lens autofocus system.',
    features: [
      'Two-lens autofocus system',
      'Five creative lens filters included',
      'App control: aperture priority, double exposure, light painting',
      'Uses i-Type and 600 film',
    ],
    images: ['instantCamera'],
    variantAxes: [{ attribute: 'Color', options: ['White', 'Black'] }],
  },

  // ── Consoles & Controllers ─────────────────────────────────────────────────
  {
    name: 'Sony PlayStation 5 Slim',
    slug: 'playstation-5-slim',
    categorySlug: 'consoles',
    brand: 'Sony',
    basePrice: 69999,
    discountPrice: 62999,
    summary:
      'Play like never before with lightning-fast loading, haptic feedback, adaptive triggers and 3D Audio in a new, 30% smaller design.',
    features: [
      'Ultra-high-speed 1TB SSD',
      'Ray tracing at up to 120fps with 4K output',
      'DualSense wireless controller included',
      'Tempest 3D AudioTech',
    ],
    images: ['ps5Console', 'ps5Controller', 'gamingMonitor'],
    variantAxes: [
      {
        attribute: 'Edition',
        options: ['Digital Edition', { value: 'Disc Edition', priceDelta: 8000 }],
      },
    ],
  },
  {
    name: 'DualSense Wireless Controller',
    slug: 'dualsense-wireless-controller',
    categorySlug: 'consoles',
    brand: 'Sony',
    basePrice: 8999,
    discountPrice: 7999,
    summary:
      'Feel the game with haptic feedback and dynamic adaptive triggers, plus a built-in microphone and an iconic comfortable design.',
    features: [
      'Haptic feedback and adaptive triggers',
      'Built-in microphone and headset jack',
      'Create button for capturing and sharing',
      'USB-C rechargeable battery',
    ],
    images: ['ps5Controller'],
    variantAxes: [
      { attribute: 'Color', options: ['White', 'Midnight Black', 'Cosmic Red', 'Galactic Purple'] },
    ],
  },
  {
    name: 'Xbox Wireless Controller',
    slug: 'xbox-wireless-controller',
    categorySlug: 'consoles',
    brand: 'Microsoft',
    basePrice: 7499,
    discountPrice: 6799,
    summary:
      'Modernised design with textured grips, a hybrid D-pad and a Share button — works with Xbox Series X|S, Windows PCs and mobile devices.',
    features: [
      'Textured grip on triggers, bumpers and back case',
      'Hybrid D-pad for precise, familiar input',
      'Bluetooth and Xbox Wireless connectivity',
      'Up to 40 hours on AA batteries',
    ],
    images: ['xboxController'],
    variantAxes: [{ attribute: 'Color', options: ['Robot White', 'Carbon Black', 'Shock Blue'] }],
  },

  // ── Gaming PC ──────────────────────────────────────────────────────────────
  {
    name: 'Titan RTX 4070 Super Gaming PC',
    slug: 'titan-rtx-4070-super-gaming-pc',
    categorySlug: 'gaming-pc',
    brand: 'Titan Systems',
    basePrice: 259999,
    discountPrice: 239999,
    summary:
      'A hand-assembled 1440p high-refresh beast with an RTX 4070 Super, a Core i7-14700K and a tempered-glass case with ARGB airflow.',
    features: [
      'Intel Core i7-14700K (20 cores, up to 5.6GHz)',
      'NVIDIA GeForce RTX 4070 Super 12GB with DLSS 3',
      '360mm AIO liquid cooler and 850W 80+ Gold PSU',
      '24-hour stress tested with 2-year warranty',
    ],
    images: ['battlestation', 'gamingRig'],
    variantAxes: [
      { attribute: 'RAM', options: ['16GB', { value: '32GB', priceDelta: 9000 }] },
      { attribute: 'Storage', options: ['1TB', { value: '2TB', priceDelta: 11000 }] },
    ],
  },
  {
    name: 'Titan Creator RTX 4080 Super Workstation',
    slug: 'titan-creator-rtx-4080-super-workstation',
    categorySlug: 'gaming-pc',
    brand: 'Titan Systems',
    basePrice: 369999,
    summary:
      'Built for 4K gaming and GPU rendering: an RTX 4080 Super, a Ryzen 9 7950X3D and 64GB DDR5 in a whisper-quiet chassis.',
    features: [
      'AMD Ryzen 9 7950X3D (16 cores, 3D V-Cache)',
      'NVIDIA GeForce RTX 4080 Super 16GB',
      '64GB DDR5-6000 and 2TB Gen 4 NVMe SSD',
      'Sound-dampened case with 1000W 80+ Platinum PSU',
    ],
    images: ['gamingRig', 'battlestation'],
    isPublished: false,
  },

  // ── PC Accessories ─────────────────────────────────────────────────────────
  {
    name: 'Keychron K2 Pro Wireless Mechanical Keyboard',
    slug: 'keychron-k2-pro',
    categorySlug: 'pc-accessories',
    brand: 'Keychron',
    basePrice: 11999,
    discountPrice: 10499,
    summary:
      'A 75% hot-swappable mechanical keyboard with QMK/VIA support, Bluetooth 5.1 and a double-shot PBT keycap set for Mac and Windows.',
    features: [
      'Hot-swappable Gateron G Pro switches',
      'QMK/VIA fully programmable',
      'Bluetooth 5.1 (3 devices) and wired USB-C',
      'Up to 100 hours battery with backlight off',
    ],
    images: ['mechanicalKeyboard'],
    variantAxes: [
      { attribute: 'Switch Type', options: ['Red (Linear)', 'Brown (Tactile)', 'Blue (Clicky)'] },
    ],
  },
  {
    name: 'Apple Magic Keyboard with Touch ID',
    slug: 'apple-magic-keyboard-touch-id',
    categorySlug: 'pc-accessories',
    brand: 'Apple',
    basePrice: 13999,
    summary:
      'Fast, secure authentication with Touch ID, a comfortable scissor mechanism and a battery that lasts about a month between charges.',
    features: [
      'Touch ID for Mac computers with Apple silicon',
      'Scissor mechanism with low, stable key travel',
      'Pairs automatically with your Mac',
      'USB-C to Lightning cable included',
    ],
    images: ['magicKeyboard'],
  },
  {
    name: 'Razer DeathAdder V3 Pro Gaming Mouse',
    slug: 'razer-deathadder-v3-pro',
    categorySlug: 'pc-accessories',
    brand: 'Razer',
    basePrice: 16999,
    discountPrice: 14499,
    summary:
      'An ultra-lightweight 63g ergonomic esports mouse with the Focus Pro 30K optical sensor and HyperSpeed wireless.',
    features: [
      'Focus Pro 30K optical sensor',
      'Optical Mouse Switches Gen-3, 90M clicks',
      'Razer HyperSpeed Wireless, up to 90 hours',
      '63g ergonomic shape',
    ],
    images: ['gamingMouseRgb'],
  },
  {
    name: 'Logitech M720 Triathlon Multi-Device Mouse',
    slug: 'logitech-m720-triathlon',
    categorySlug: 'pc-accessories',
    brand: 'Logitech',
    basePrice: 4499,
    discountPrice: 3799,
    summary:
      'Switch between three computers at the touch of a button, with hyper-fast scrolling and up to 24 months of battery life.',
    features: [
      'Easy-Switch between up to 3 devices',
      'Hyper-fast scroll wheel',
      'Bluetooth or Unifying USB receiver',
      'Up to 24 months on a single AA battery',
    ],
    images: ['wirelessMouse'],
  },
  {
    name: 'LG UltraGear 27" QHD 180Hz Gaming Monitor',
    slug: 'lg-ultragear-27-qhd-180hz',
    categorySlug: 'pc-accessories',
    brand: 'LG',
    basePrice: 44999,
    discountPrice: 39999,
    summary:
      'A 27-inch Nano IPS QHD panel running at 180Hz with 1ms response, HDR10 and NVIDIA G-SYNC compatibility for tear-free gameplay.',
    features: [
      '27" QHD (2560×1440) Nano IPS, 180Hz',
      '1ms (GtG) response time',
      'DCI-P3 98% colour gamut with HDR10',
      'Height, tilt and pivot adjustable stand',
    ],
    images: ['gamingMonitor', 'battlestation'],
  },

  // ── Men's Clothing ─────────────────────────────────────────────────────────
  {
    name: 'Essential Crew-Neck Cotton T-Shirt',
    slug: 'essential-crew-neck-cotton-tee',
    categorySlug: 'mens-clothing',
    brand: 'Northline',
    basePrice: 1290,
    discountPrice: 990,
    summary:
      'The everyday tee done right: 180 GSM combed cotton, a tailored-but-relaxed fit and a collar that keeps its shape wash after wash.',
    features: [
      '100% combed ring-spun cotton, 180 GSM',
      'Pre-shrunk and enzyme washed for softness',
      'Double-stitched hems and taped shoulders',
      'Machine washable',
    ],
    images: ['teeWhite', 'teeBlackHanger'],
    variantAxes: [
      { attribute: 'Color', options: ['White', 'Black', 'Navy'] },
      { attribute: 'Size', options: APPAREL_SIZES },
    ],
  },
  {
    name: 'Graphic Print Streetwear Tee',
    slug: 'graphic-print-streetwear-tee',
    categorySlug: 'mens-clothing',
    brand: 'Northline',
    basePrice: 1590,
    summary:
      'Oversized boxy fit with a bold front screen print — a streetwear staple cut from heavyweight 220 GSM cotton jersey.',
    features: [
      'Heavyweight 220 GSM cotton jersey',
      'Drop-shoulder oversized silhouette',
      'Plastisol screen print that will not crack',
      'Ribbed crew neck',
    ],
    images: ['teeGraphicSand', 'teeGraphicBlack'],
    variantAxes: [
      { attribute: 'Color', options: ['Sand', 'Black'] },
      { attribute: 'Size', options: APPAREL_SIZES },
    ],
  },
  {
    name: 'Premium Leather Biker Jacket',
    slug: 'premium-leather-biker-jacket',
    categorySlug: 'mens-clothing',
    brand: 'Harbor & Hide',
    basePrice: 15999,
    discountPrice: 12999,
    summary:
      'A timeless asymmetric biker jacket in full-grain lambskin leather with YKK zips and a quilted satin lining.',
    features: [
      'Full-grain lambskin leather',
      'YKK metal zips and snap-down lapels',
      'Quilted satin lining for warmth',
      'Three exterior and two interior pockets',
    ],
    images: ['leatherJacket'],
    variantAxes: [{ attribute: 'Size', options: ['M', 'L', 'XL'] }],
  },
  {
    name: 'Slim Fit Stretch Denim Jeans',
    slug: 'slim-fit-stretch-denim-jeans',
    categorySlug: 'mens-clothing',
    brand: 'Northline',
    basePrice: 3490,
    discountPrice: 2790,
    summary:
      'Classic five-pocket jeans in a comfort-stretch denim that moves with you, finished with a subtle vintage wash.',
    features: [
      '98% cotton, 2% elastane stretch denim',
      'Slim through the hip and thigh, tapered leg',
      'Reinforced rivets and YKK zip fly',
      'Mid-rise waist',
    ],
    images: ['denimJeans'],
    variantAxes: [
      { attribute: 'Color', options: ['Indigo', 'Washed Black'] },
      { attribute: 'Waist', options: ['30', '32', '34', '36'] },
    ],
  },
  {
    name: 'Tailored Check Three-Piece Suit',
    slug: 'tailored-check-three-piece-suit',
    categorySlug: 'mens-clothing',
    brand: 'Savile Lane',
    basePrice: 26999,
    discountPrice: 22999,
    summary:
      'A sharp windowpane-check three-piece in a wool-blend cloth — jacket, waistcoat and trousers tailored for weddings and formal occasions.',
    features: [
      'Wool-blend windowpane check fabric',
      'Half-canvas construction for natural drape',
      'Matching waistcoat and flat-front trousers',
      'Free alteration at our Dhaka store',
    ],
    images: ['checkSuit'],
    variantAxes: [{ attribute: 'Size', options: ['M', 'L', 'XL'] }],
  },
  {
    name: 'Classic Pullover Hoodie',
    slug: 'classic-pullover-hoodie',
    categorySlug: 'mens-clothing',
    brand: 'Northline',
    basePrice: 2990,
    discountPrice: 2490,
    summary:
      'Brushed-back fleece, a lined hood and a roomy kangaroo pocket — the hoodie you will reach for every cool evening.',
    features: [
      '320 GSM brushed cotton-poly fleece',
      'Double-layered hood with flat drawcords',
      'Ribbed cuffs and hem',
      'Kangaroo pocket',
    ],
    images: ['hoodieGray'],
    variantAxes: [
      { attribute: 'Color', options: ['Heather Gray', 'Black'] },
      { attribute: 'Size', options: APPAREL_SIZES },
    ],
  },
  {
    name: 'Lightweight Nylon Bomber Jacket',
    slug: 'lightweight-nylon-bomber-jacket',
    categorySlug: 'mens-clothing',
    brand: 'Harbor & Hide',
    basePrice: 5490,
    summary:
      'A water-repellent nylon bomber with a satin sheen, ribbed trims and a utility sleeve pocket — made for transitional weather.',
    features: [
      'Water-repellent nylon shell',
      'Ribbed collar, cuffs and hem',
      'Utility zip pocket on the sleeve',
      'Lightweight, packable fill',
    ],
    images: ['bomberJacket'],
    variantAxes: [{ attribute: 'Size', options: APPAREL_SIZES }],
    stock: 0,
  },

  // ── Women's Clothing ───────────────────────────────────────────────────────
  {
    name: 'Hand-Knit Fringe Poncho',
    slug: 'hand-knit-fringe-poncho',
    categorySlug: 'womens-clothing',
    brand: 'Loom & Co.',
    basePrice: 2790,
    discountPrice: 2290,
    summary:
      'An airy open-knit poncho with a V-neck and hand-tied fringe hem — effortless layering over dresses or denim.',
    features: [
      'Soft acrylic-cotton open knit',
      'Hand-tied fringe hem',
      'One size fits most',
      'Hand wash cold',
    ],
    images: ['knitPoncho'],
  },
  {
    name: 'Oversized Crewneck Sweatshirt',
    slug: 'oversized-crewneck-sweatshirt',
    categorySlug: 'womens-clothing',
    brand: 'Loom & Co.',
    basePrice: 2490,
    summary:
      'A cloud-soft oversized sweatshirt with dropped shoulders and a relaxed, cropped length for easy everyday styling.',
    features: [
      'Brushed-back organic cotton fleece',
      'Dropped shoulders and relaxed fit',
      'Ribbed crew neck, cuffs and hem',
      'GOTS-certified organic cotton',
    ],
    images: ['sweatshirtWhite'],
    variantAxes: [{ attribute: 'Size', options: ['S', 'M', 'L'] }],
  },
  {
    name: 'Two-Piece Jogger Tracksuit',
    slug: 'two-piece-jogger-tracksuit',
    categorySlug: 'womens-clothing',
    brand: 'Loom & Co.',
    basePrice: 3990,
    discountPrice: 3290,
    summary:
      'A matching hoodie-and-jogger set in a vibrant colourway — cosy enough for lounging, polished enough for weekend errands.',
    features: [
      'Cotton-rich French terry',
      'Cropped hoodie with drawstring hood',
      'Elasticated jogger waist and cuffs',
      'Side seam pockets',
    ],
    images: ['trackSuitYellow'],
    variantAxes: [
      { attribute: 'Color', options: ['Mustard', 'Sage'] },
      { attribute: 'Size', options: ['S', 'M', 'L'] },
    ],
  },

  // ── Footwear ───────────────────────────────────────────────────────────────
  {
    name: 'Nike Air Zoom Pegasus 40',
    slug: 'nike-air-zoom-pegasus-40',
    categorySlug: 'footwear',
    brand: 'Nike',
    basePrice: 14995,
    discountPrice: 12495,
    summary:
      'A springy ride for every run: dual Zoom Air units and responsive React foam, now with a more supportive, breathable upper.',
    features: [
      'Forefoot and heel Zoom Air units',
      'Nike React foam midsole',
      'Engineered mesh upper with midfoot band',
      'Waffle-inspired rubber outsole',
    ],
    images: ['sneakerRed', 'sneakerGreyFloating'],
    variantAxes: [{ attribute: 'Shoe Size', options: SHOE_SIZES }],
  },
  {
    name: 'Nike Air Max 90',
    slug: 'nike-air-max-90',
    categorySlug: 'footwear',
    brand: 'Nike',
    basePrice: 16495,
    summary:
      'Nothing as fly, nothing as comfortable — the Air Max 90 stays true to its OG running roots with the iconic Waffle sole and visible Max Air.',
    features: [
      'Visible Max Air unit in the heel',
      'Leather and textile upper',
      'Padded, low-cut collar',
      'Rubber Waffle outsole',
    ],
    images: ['sneakerAirMax'],
    variantAxes: [{ attribute: 'Shoe Size', options: SHOE_SIZES }],
  },
  {
    name: "Nike Air Force 1 '07 Wheat",
    slug: 'nike-air-force-1-07-wheat',
    categorySlug: 'footwear',
    brand: 'Nike',
    basePrice: 13995,
    discountPrice: 11495,
    summary:
      'The radiance lives on in the b-ball original — rich wheat nubuck, crisp overlays and just the right amount of flash.',
    features: [
      'Premium nubuck upper',
      'Nike Air cushioning',
      'Padded low-cut collar',
      'Pivot-circle rubber outsole',
    ],
    images: ['sneakerWheat'],
    variantAxes: [{ attribute: 'Shoe Size', options: SHOE_SIZES }],
  },
  {
    name: 'Suede Wingtip Oxford Shoes',
    slug: 'suede-wingtip-oxford-shoes',
    categorySlug: 'footwear',
    brand: 'Savile Lane',
    basePrice: 7490,
    discountPrice: 6490,
    summary:
      'Goodyear-welted oxfords in teal suede with classic brogue detailing and a contrast crepe sole — heritage craft with a modern twist.',
    features: [
      'Genuine suede upper',
      'Goodyear-welted construction',
      'Leather-lined with cushioned insole',
      'Natural crepe rubber sole',
    ],
    images: ['oxfordShoe'],
    variantAxes: [{ attribute: 'Shoe Size', options: ['40', '41', '42', '43'] }],
  },
  {
    name: 'Featherlight Knit Running Sneaker',
    slug: 'featherlight-knit-running-sneaker',
    categorySlug: 'footwear',
    brand: 'Stride',
    basePrice: 4990,
    discountPrice: 3990,
    summary:
      'A 210g sock-fit runner with a seamless knit upper and a responsive EVA midsole — perfect for daily miles and the gym.',
    features: [
      'Seamless one-piece knit upper',
      'Lightweight EVA midsole',
      'Sock-like fit with pull tab',
      'Only 210g (size 42)',
    ],
    images: ['sneakerGreyFloating'],
    variantAxes: [{ attribute: 'Shoe Size', options: SHOE_SIZES }],
  },

  // ── Bags & Accessories ─────────────────────────────────────────────────────
  {
    name: 'Urban Commuter Laptop Backpack',
    slug: 'urban-commuter-laptop-backpack',
    categorySlug: 'bags-accessories',
    brand: 'Transit',
    basePrice: 4490,
    discountPrice: 3690,
    summary:
      'A water-resistant 22L daypack with a padded 15.6" laptop sleeve, anti-theft back pocket and USB charging port.',
    features: [
      'Fits laptops up to 15.6"',
      'Water-resistant recycled polyester',
      'Hidden anti-theft back pocket',
      'Built-in USB charging port',
    ],
    images: ['backpackNavy'],
    variantAxes: [{ attribute: 'Color', options: ['Navy', 'Charcoal'] }],
  },
  {
    name: 'Quilted Leather Crossbody Bag',
    slug: 'quilted-leather-crossbody-bag',
    categorySlug: 'bags-accessories',
    brand: 'Maison Rue',
    basePrice: 9490,
    discountPrice: 7990,
    summary:
      'A chevron-quilted leather camera bag with a gold-tone chain strap, tassel zip pull and a structured silhouette.',
    features: [
      'Chevron-quilted genuine leather',
      'Adjustable gold-tone chain strap',
      'Microfibre lining with card slot',
      'Tassel zip closure',
    ],
    images: ['crossbodyBag'],
  },
  {
    name: 'Reusable Canvas Tote Bag',
    slug: 'reusable-canvas-tote-bag',
    categorySlug: 'bags-accessories',
    brand: 'Transit',
    basePrice: 890,
    summary:
      'A heavy-duty 12oz organic canvas tote with reinforced handles — plastic-free shopping that lasts for years.',
    features: [
      '12oz organic cotton canvas',
      'Reinforced cross-stitched handles',
      'Carries up to 15 kg',
      'Machine washable',
    ],
    images: ['toteBag'],
  },
  {
    name: 'Handcrafted Leather Bifold Wallet',
    slug: 'handcrafted-leather-bifold-wallet',
    categorySlug: 'bags-accessories',
    brand: 'Harbor & Hide',
    basePrice: 1990,
    discountPrice: 1590,
    summary:
      'Vegetable-tanned leather that develops a rich patina with age, hand-stitched with waxed thread for decades of use.',
    features: [
      'Vegetable-tanned full-grain leather',
      'Six card slots and two cash compartments',
      'RFID-blocking lining',
      'Hand-stitched with waxed thread',
    ],
    images: ['leatherWallet'],
    variantAxes: [{ attribute: 'Color', options: ['Cognac', 'Dark Brown'] }],
  },
  {
    name: 'Classic Wayfarer Sunglasses',
    slug: 'classic-wayfarer-sunglasses',
    categorySlug: 'bags-accessories',
    brand: 'Solis',
    basePrice: 3490,
    discountPrice: 2790,
    summary:
      'An iconic acetate frame with polarised UV400 lenses that cut glare while keeping colours true.',
    features: [
      'Hand-polished acetate frame',
      'Polarised UV400 lenses',
      'Five-barrel metal hinges',
      'Protective case and cleaning cloth included',
    ],
    images: ['sunglasses'],
  },
  {
    name: 'Minimalist Leather Strap Watch',
    slug: 'minimalist-leather-strap-watch',
    categorySlug: 'bags-accessories',
    brand: 'Nordgren',
    basePrice: 8490,
    discountPrice: 6990,
    summary:
      'A clean 40mm dial, Japanese quartz movement and an Italian leather strap — understated elegance for every day.',
    features: [
      'Japanese Miyota quartz movement',
      'Sapphire-coated mineral crystal',
      '5 ATM water resistance',
      'Quick-release Italian leather strap',
    ],
    images: ['watchLeatherStrap', 'watchRoseGold'],
    variantAxes: [{ attribute: 'Color', options: ['Brown', 'Black'] }],
  },
  {
    name: 'Rose Gold Chronograph Watch',
    slug: 'rose-gold-chronograph-watch',
    categorySlug: 'bags-accessories',
    brand: 'Nordgren',
    basePrice: 13990,
    summary:
      'A rose-gold stainless-steel chronograph with sub-dials, a date window and a supple nubuck strap.',
    features: [
      'Chronograph with three sub-dials',
      '316L stainless steel case, rose-gold PVD',
      '10 ATM water resistance',
      'Two-year international warranty',
    ],
    images: ['watchRoseGold'],
  },
  {
    name: 'Sterling Silver Halo Ring',
    slug: 'sterling-silver-halo-ring',
    categorySlug: 'bags-accessories',
    brand: 'Aurelia',
    basePrice: 6490,
    discountPrice: 5490,
    summary:
      'A brilliant-cut cubic zirconia centre stone framed by a sparkling halo on a pavé band of 925 sterling silver.',
    features: [
      '925 sterling silver with rhodium plating',
      'AAA-grade cubic zirconia stones',
      'Hypoallergenic and tarnish-resistant',
      'Presented in a velvet gift box',
    ],
    images: ['diamondRing'],
    variantAxes: [{ attribute: 'Ring Size', options: ['6', '7', '8'] }],
  },

  // ── Skincare ───────────────────────────────────────────────────────────────
  {
    name: 'Hydrating Gentle Face Cleanser',
    slug: 'hydrating-gentle-face-cleanser',
    categorySlug: 'skincare',
    brand: 'Dermaluxe',
    basePrice: 1450,
    discountPrice: 1250,
    summary:
      'A non-foaming, pH-balanced cleanser with ceramides and hyaluronic acid that removes impurities without stripping the skin barrier.',
    features: [
      'Three essential ceramides and hyaluronic acid',
      'Fragrance-free and non-comedogenic',
      'Suitable for normal to dry skin',
      '150ml tube',
    ],
    images: ['cleanserTube', 'lotionBottles'],
  },
  {
    name: 'Vitamin C Brightening Serum',
    slug: 'vitamin-c-brightening-serum',
    categorySlug: 'skincare',
    brand: 'Dermaluxe',
    basePrice: 1890,
    discountPrice: 1490,
    summary:
      'A stable 15% vitamin C serum with ferulic acid and vitamin E that fades dark spots and restores radiance in four weeks.',
    features: [
      '15% L-ascorbic acid with ferulic acid',
      'Antioxidant vitamin E',
      'Visible brightening in 4 weeks',
      '30ml amber glass dropper bottle',
    ],
    images: ['serumDropper', 'botanicalOils'],
  },
  {
    name: 'Restorative Hair & Scalp Mask',
    slug: 'restorative-hair-scalp-mask',
    categorySlug: 'skincare',
    brand: 'Act + Acre',
    basePrice: 1290,
    summary:
      'A weekly deep-conditioning treatment with plant proteins and cold-pressed oils that repairs damage and adds shine.',
    features: [
      'Cold-processed plant proteins',
      'Silicone- and sulfate-free',
      'Safe for colour-treated hair',
      '200ml tube',
    ],
    images: ['hairMask'],
  },
  {
    name: 'Personalised Skincare Starter Set',
    slug: 'personalised-skincare-starter-set',
    categorySlug: 'skincare',
    brand: 'Curology',
    basePrice: 3490,
    discountPrice: 2990,
    summary:
      'A complete three-step routine — cleanser, custom treatment and moisturiser — formulated around your skin goals.',
    features: [
      'Gentle cleanser, custom formula and moisturiser',
      'Dermatologist-developed',
      'Targets acne, texture and dark spots',
      'One-month supply',
    ],
    images: ['skincareSet', 'skincareTube'],
  },

  // ── Makeup ─────────────────────────────────────────────────────────────────
  {
    name: 'Velvet Matte Lipstick & Gloss Duo',
    slug: 'velvet-matte-lipstick-gloss-duo',
    categorySlug: 'makeup',
    brand: 'Rouge Atelier',
    basePrice: 1650,
    discountPrice: 1390,
    summary:
      'A long-wear velvet matte lipstick paired with a high-shine gloss for a two-in-one day-to-night look.',
    features: [
      'Up to 12-hour wear',
      'Enriched with shea butter and vitamin E',
      'Non-drying, transfer-resistant formula',
      'Cruelty-free',
    ],
    images: ['lipstickDuo'],
    variantAxes: [{ attribute: 'Color', options: ['Classic Red', 'Nude Rose', 'Berry'] }],
  },
  {
    name: 'Pro Makeup Brush Set (12 Pieces)',
    slug: 'pro-makeup-brush-set-12',
    categorySlug: 'makeup',
    brand: 'Rouge Atelier',
    basePrice: 2490,
    discountPrice: 1990,
    summary:
      'Twelve synthetic-bristle brushes for face and eyes — soft, dense and shed-free, with a vegan-leather travel roll.',
    features: [
      '12 synthetic, vegan brushes',
      'Seamless blending for powder, cream and liquid',
      'Weighted aluminium ferrules',
      'Vegan-leather roll-up case',
    ],
    images: ['makeupBrushes', 'makeupFlatlay'],
  },
  {
    name: 'Everyday Makeup Essentials Kit',
    slug: 'everyday-makeup-essentials-kit',
    categorySlug: 'makeup',
    brand: 'Rouge Atelier',
    basePrice: 4990,
    summary:
      'Everything you need for a flawless everyday look: eyeshadow palette, blush, compact powder, mascara and a satin lipstick.',
    features: [
      '9-shade neutral eyeshadow palette',
      'Blush and pressed compact powder',
      'Volumising mascara and satin lipstick',
      'Gift-ready keepsake box',
    ],
    images: ['makeupFlatlay'],
  },

  // ── Fragrances ─────────────────────────────────────────────────────────────
  {
    name: 'Chanel Coco Noir Eau de Parfum',
    slug: 'chanel-coco-noir-edp',
    categorySlug: 'fragrances',
    brand: 'Chanel',
    basePrice: 19500,
    discountPrice: 17500,
    summary:
      'A mysterious, sensual oriental fragrance with notes of grapefruit, rose, jasmine and a warm base of patchouli and sandalwood.',
    features: [
      'Top: grapefruit and bergamot',
      'Heart: rose, jasmine and geranium',
      'Base: patchouli, sandalwood, vanilla and tonka',
      'Long-lasting eau de parfum concentration',
    ],
    images: ['perfumeNoirRoses', 'perfumeNoirPink'],
    variantAxes: [{ attribute: 'Volume', options: ['50ml', { value: '100ml', priceDelta: 7500 }] }],
  },
  {
    name: 'Chanel N°5 Eau de Parfum',
    slug: 'chanel-no5-edp',
    categorySlug: 'fragrances',
    brand: 'Chanel',
    basePrice: 20500,
    summary:
      'The essence of femininity — a powdery floral bouquet housed in the iconic bottle with a minimalist design.',
    features: [
      'Aldehydic floral bouquet',
      'Notes of May rose and jasmine',
      'Warm vanilla and sandalwood dry-down',
      'Iconic faceted glass bottle',
    ],
    images: ['perfumeNo5'],
    variantAxes: [{ attribute: 'Volume', options: ['50ml', { value: '100ml', priceDelta: 8000 }] }],
    stock: 0,
  },

  // ── Furniture ──────────────────────────────────────────────────────────────
  {
    name: 'Mid-Century Leather Sofa (3-Seater)',
    slug: 'mid-century-leather-sofa-3-seater',
    categorySlug: 'furniture',
    brand: 'Hearthwood',
    basePrice: 94999,
    discountPrice: 84999,
    summary:
      'Tan top-grain leather over a kiln-dried hardwood frame, with deep channel-tufted cushions and tapered solid-oak legs.',
    features: [
      'Top-grain aniline leather',
      'Kiln-dried hardwood frame, 10-year warranty',
      'High-resilience foam with feather wrap',
      'W 213 × D 89 × H 84 cm',
    ],
    images: ['leatherSofa'],
  },
  {
    name: 'Emerald Velvet Sofa',
    slug: 'emerald-velvet-sofa',
    categorySlug: 'furniture',
    brand: 'Hearthwood',
    basePrice: 78999,
    summary:
      'A statement sofa in rich emerald performance velvet with a low track arm and slim brass-capped legs.',
    features: [
      'Stain-resistant performance velvet',
      'Pocket-spring seat for lasting support',
      'Brass-capped solid-wood legs',
      'Free delivery and assembly in Dhaka',
    ],
    images: ['velvetSofa'],
  },
  {
    name: 'Terracotta Boucle Loveseat',
    slug: 'terracotta-boucle-loveseat',
    categorySlug: 'furniture',
    brand: 'Hearthwood',
    basePrice: 57999,
    discountPrice: 51999,
    summary:
      'A compact two-seater in cosy terracotta boucle — ideal for apartments, reading nooks and studio living.',
    features: [
      'Textured boucle upholstery',
      'Compact 160 cm width',
      'Removable back cushions',
      'Solid beech legs',
    ],
    images: ['terracottaSofa'],
  },
  {
    name: 'Modular L-Shaped Sectional Sofa',
    slug: 'modular-l-shaped-sectional-sofa',
    categorySlug: 'furniture',
    brand: 'Hearthwood',
    basePrice: 124999,
    summary:
      'Reconfigurable modules let you build the perfect layout — a deep-seated family sectional in stain-resistant linen blend.',
    features: [
      'Reconfigurable left- or right-hand chaise',
      'Deep 100 cm seats',
      'Machine-washable linen-blend covers',
      'Seats five comfortably',
    ],
    images: ['sectionalLivingRoom'],
    isPublished: false,
  },
  {
    name: 'Scandinavian Dining Chair (Set of 2)',
    slug: 'scandinavian-dining-chair-set-of-2',
    categorySlug: 'furniture',
    brand: 'Fjord Living',
    basePrice: 12990,
    discountPrice: 10990,
    summary:
      'A moulded polypropylene shell with a padded seat and solid beech legs — an easy-care design classic.',
    features: [
      'Moulded polypropylene seat shell',
      'Padded faux-leather seat cushion',
      'Solid beech legs with metal cross-bracing',
      'Sold as a set of two',
    ],
    images: ['diningChair', 'tulipChairs'],
    variantAxes: [{ attribute: 'Color', options: ['Black', 'White'] }],
  },
  {
    name: 'Mustard Mid-Century Lounge Armchair',
    slug: 'mustard-mid-century-lounge-armchair',
    categorySlug: 'furniture',
    brand: 'Fjord Living',
    basePrice: 19990,
    discountPrice: 17990,
    summary:
      'A sculpted lounge chair in warm mustard woven fabric with splayed walnut-finish legs — a cheerful accent for any room.',
    features: [
      'Woven polyester upholstery',
      'Walnut-finish splayed legs',
      'High-density foam seat',
      'Ships fully assembled',
    ],
    images: ['mustardArmchair'],
  },

  // ── Kitchen & Dining ───────────────────────────────────────────────────────
  {
    name: 'Barista Pro Espresso Machine with Grinder',
    slug: 'barista-pro-espresso-machine-with-grinder',
    categorySlug: 'kitchen-dining',
    brand: 'Crema',
    basePrice: 59999,
    discountPrice: 52999,
    summary:
      'Café-quality espresso at home — an integrated conical burr grinder, 3-second heat-up and precise PID temperature control.',
    features: [
      'Integrated conical burr grinder, 30 settings',
      'ThermoJet heating: ready in 3 seconds',
      'PID digital temperature control',
      'Powerful steam wand for microfoam',
    ],
    images: ['espressoMachine', 'latteCups'],
  },
  {
    name: 'Stoneware Coffee Mug Set (4 Pieces)',
    slug: 'stoneware-coffee-mug-set-4',
    categorySlug: 'kitchen-dining',
    brand: 'Crema',
    basePrice: 1690,
    discountPrice: 1390,
    summary:
      'Four minimalist 350ml stoneware mugs with a satin glaze — microwave and dishwasher safe.',
    features: [
      'Durable high-fired stoneware',
      '350ml capacity each',
      'Microwave and dishwasher safe',
      'Set of four',
    ],
    images: ['whiteMug', 'latteCups'],
  },
  {
    name: 'Insulated Stainless Steel Water Bottle 750ml',
    slug: 'insulated-stainless-steel-water-bottle-750ml',
    categorySlug: 'kitchen-dining',
    brand: 'Hydrate',
    basePrice: 1490,
    discountPrice: 1190,
    summary:
      'Double-wall vacuum insulation keeps drinks cold for 24 hours or hot for 12, in a leak-proof powder-coated bottle.',
    features: [
      'Double-wall vacuum insulation',
      'Cold 24h / hot 12h',
      '18/8 food-grade stainless steel, BPA-free',
      'Leak-proof screw cap',
    ],
    images: ['waterBottle'],
    variantAxes: [{ attribute: 'Color', options: ['Sage Green', 'Matte Black', 'Arctic White'] }],
  },
  {
    name: 'Tri-Ply Stainless Cookware Set (7 Pieces)',
    slug: 'tri-ply-stainless-cookware-set-7',
    categorySlug: 'kitchen-dining',
    brand: 'Hearthwood Kitchen',
    basePrice: 18990,
    discountPrice: 15990,
    summary:
      'Professional tri-ply stainless steel with an aluminium core for even heating — induction-ready and oven safe to 260°C.',
    features: [
      'Tri-ply construction with aluminium core',
      'Works on gas, electric and induction',
      'Oven safe to 260°C',
      'Includes frying pan, saucepans, sauté pan and stockpot',
    ],
    images: ['modernKitchen'],
  },

  // ── Decor & Lighting ───────────────────────────────────────────────────────
  {
    name: 'Industrial Arc Floor Lamp',
    slug: 'industrial-arc-floor-lamp',
    categorySlug: 'decor-lighting',
    brand: 'Lumen',
    basePrice: 6490,
    discountPrice: 5490,
    summary:
      'A matte-grey steel floor lamp with an adjustable dome shade — directed task light for reading corners and desks.',
    features: [
      'Powder-coated steel',
      'Adjustable arm and pivoting shade',
      'E27 bulb holder (LED bulb included)',
      'Foot-operated switch',
    ],
    images: ['floorLamp'],
  },
  {
    name: 'Handwoven Rattan Room Divider',
    slug: 'handwoven-rattan-room-divider',
    categorySlug: 'decor-lighting',
    brand: 'Loom & Co. Home',
    basePrice: 13990,
    summary:
      'A three-panel folding screen of handwoven rattan in a solid mango-wood frame — boho warmth that zones any space.',
    features: [
      'Handwoven natural rattan panels',
      'Solid mango-wood frame',
      'Folds flat for storage',
      'H 170 × W 135 cm',
    ],
    images: ['bohoBedroom'],
  },
  {
    name: 'A5 Hardcover Dotted Notebook',
    slug: 'a5-hardcover-dotted-notebook',
    categorySlug: 'decor-lighting',
    brand: 'Papertrail',
    basePrice: 590,
    discountPrice: 490,
    summary:
      '192 pages of 100 GSM fountain-pen-friendly paper with a lay-flat binding — for bullet journals, sketches and notes.',
    features: [
      '192 dotted pages, 100 GSM acid-free paper',
      'Lay-flat thread-sewn binding',
      'Ribbon marker and elastic closure',
      'Numbered pages with index',
    ],
    images: ['notebookPen'],
  },

  // ── Gym Equipment ──────────────────────────────────────────────────────────
  {
    name: 'Olympic Barbell & Bumper Plate Set (100 kg)',
    slug: 'olympic-barbell-bumper-plate-set-100kg',
    categorySlug: 'gym-equipment',
    brand: 'IronForge',
    basePrice: 49999,
    discountPrice: 44999,
    summary:
      'A 20 kg Olympic bar with needle bearings and 80 kg of colour-coded bumper plates — everything a home gym needs to lift heavy.',
    features: [
      '20 kg bar, 1500 lb tested, needle bearings',
      '80 kg high-density rubber bumper plates',
      'Two spring collars included',
      'Low-bounce, floor-friendly design',
    ],
    images: ['barbellDeadlift'],
  },
  {
    name: 'Resistance Band Set with Door Anchor',
    slug: 'resistance-band-set-with-door-anchor',
    categorySlug: 'gym-equipment',
    brand: 'IronForge',
    basePrice: 1990,
    discountPrice: 1490,
    summary:
      'Five stackable latex tube bands (up to 68 kg combined) with handles, ankle straps and a door anchor for full-body workouts anywhere.',
    features: [
      'Five bands from 4.5 kg to 22.5 kg',
      'Stack up to 68 kg resistance',
      'Foam handles, ankle straps and door anchor',
      'Carry bag and workout guide included',
    ],
    images: ['homeWorkout'],
  },

  // ── Yoga & Wellness ────────────────────────────────────────────────────────
  {
    name: 'Non-Slip Eco Yoga Mat 6mm',
    slug: 'non-slip-eco-yoga-mat-6mm',
    categorySlug: 'yoga-wellness',
    brand: 'Asana',
    basePrice: 2490,
    discountPrice: 1990,
    summary:
      'A 6mm natural-rubber and TPE mat with a grippy, sweat-resistant surface and alignment lines for perfect poses.',
    features: [
      '6mm cushioning for joints',
      'Natural rubber base, TPE top layer',
      'Laser-etched alignment lines',
      'Carry strap included',
    ],
    images: ['yogaSunset', 'homeWorkout'],
    variantAxes: [{ attribute: 'Color', options: ['Lavender', 'Teal', 'Charcoal'] }],
  },
];
