/**
 * Locale-accurate customer identity and address data for a Bangladesh-market
 * storefront. Curated instead of faker's default (US-centric) locale so that
 * seeded names, phone numbers, cities and postal codes look real in the UI.
 */

export const FIRST_NAMES = [
  'Arif',
  'Tanvir',
  'Rakib',
  'Sabbir',
  'Fahim',
  'Nayeem',
  'Imran',
  'Mahmud',
  'Shakil',
  'Rifat',
  'Asif',
  'Zubair',
  'Tahsin',
  'Siam',
  'Mehedi',
  'Rashed',
  'Sohel',
  'Ashik',
  'Farhan',
  'Rayhan',
  'Nusrat',
  'Farzana',
  'Tasnim',
  'Sadia',
  'Maliha',
  'Anika',
  'Sumaiya',
  'Jannatul',
  'Rumana',
  'Tanjila',
  'Nabila',
  'Lamia',
  'Mim',
  'Afsana',
  'Sharmin',
  'Nazia',
  'Ishrat',
  'Tahmina',
  'Raisa',
  'Fariha',
] as const;

export const LAST_NAMES = [
  'Rahman',
  'Hossain',
  'Ahmed',
  'Islam',
  'Chowdhury',
  'Khan',
  'Uddin',
  'Alam',
  'Karim',
  'Haque',
  'Sarker',
  'Miah',
  'Talukder',
  'Siddique',
  'Bhuiyan',
  'Mahmud',
  'Akter',
  'Sultana',
  'Begum',
  'Kabir',
] as const;

/** Grameenphone, Banglalink, Robi, Airtel and Teletalk mobile prefixes. */
export const MOBILE_PREFIXES = ['017', '013', '019', '014', '018', '016', '015'] as const;

export interface LocationSeed {
  readonly area: string;
  readonly city: string;
  /** Administrative division — stored in Address.state. */
  readonly division: string;
  readonly postalCode: string;
  /** Inside Dhaka metro qualifies for the lower delivery charge. */
  readonly insideDhaka: boolean;
}

export const LOCATIONS: readonly LocationSeed[] = [
  { area: 'Dhanmondi', city: 'Dhaka', division: 'Dhaka', postalCode: '1205', insideDhaka: true },
  { area: 'Gulshan 1', city: 'Dhaka', division: 'Dhaka', postalCode: '1212', insideDhaka: true },
  { area: 'Banani', city: 'Dhaka', division: 'Dhaka', postalCode: '1213', insideDhaka: true },
  {
    area: 'Uttara Sector 7',
    city: 'Dhaka',
    division: 'Dhaka',
    postalCode: '1230',
    insideDhaka: true,
  },
  { area: 'Mirpur 10', city: 'Dhaka', division: 'Dhaka', postalCode: '1216', insideDhaka: true },
  { area: 'Mohammadpur', city: 'Dhaka', division: 'Dhaka', postalCode: '1207', insideDhaka: true },
  {
    area: 'Bashundhara R/A',
    city: 'Dhaka',
    division: 'Dhaka',
    postalCode: '1229',
    insideDhaka: true,
  },
  { area: 'Motijheel', city: 'Dhaka', division: 'Dhaka', postalCode: '1000', insideDhaka: true },
  { area: 'Badda', city: 'Dhaka', division: 'Dhaka', postalCode: '1212', insideDhaka: true },
  { area: 'Tongi', city: 'Gazipur', division: 'Dhaka', postalCode: '1710', insideDhaka: false },
  {
    area: 'Fatullah',
    city: 'Narayanganj',
    division: 'Dhaka',
    postalCode: '1421',
    insideDhaka: false,
  },
  {
    area: 'Agrabad',
    city: 'Chattogram',
    division: 'Chattogram',
    postalCode: '4100',
    insideDhaka: false,
  },
  {
    area: 'GEC Circle',
    city: 'Chattogram',
    division: 'Chattogram',
    postalCode: '4000',
    insideDhaka: false,
  },
  {
    area: 'Kotbari',
    city: 'Cumilla',
    division: 'Chattogram',
    postalCode: '3503',
    insideDhaka: false,
  },
  {
    area: 'Zindabazar',
    city: 'Sylhet',
    division: 'Sylhet',
    postalCode: '3100',
    insideDhaka: false,
  },
  {
    area: 'Shaheb Bazar',
    city: 'Rajshahi',
    division: 'Rajshahi',
    postalCode: '6100',
    insideDhaka: false,
  },
  { area: 'Sonadanga', city: 'Khulna', division: 'Khulna', postalCode: '9100', insideDhaka: false },
  {
    area: 'Band Road',
    city: 'Barishal',
    division: 'Barishal',
    postalCode: '8200',
    insideDhaka: false,
  },
  {
    area: 'Jahaj Company Mor',
    city: 'Rangpur',
    division: 'Rangpur',
    postalCode: '5400',
    insideDhaka: false,
  },
  {
    area: 'Ganginar Par',
    city: 'Mymensingh',
    division: 'Mymensingh',
    postalCode: '2200',
    insideDhaka: false,
  },
];

/** Delivery charges (BDT) mirroring common Bangladeshi courier pricing. */
export const SHIPPING_FEE_INSIDE_DHAKA = 60;
export const SHIPPING_FEE_OUTSIDE_DHAKA = 120;
/** Orders at or above this subtotal (BDT) ship free. */
export const FREE_SHIPPING_THRESHOLD = 10000;
