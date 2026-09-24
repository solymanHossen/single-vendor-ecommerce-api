/**
 * Curated Unsplash photo library for seeded catalog data.
 *
 * Every id below was verified to resolve (HTTP 200, image/jpeg) and visually
 * checked against the product it illustrates — keep that invariant when
 * adding entries, since a broken or mismatched photo is the most visible
 * defect a storefront demo can have.
 *
 * Images are hot-linked through Unsplash's imgix CDN rather than copied into
 * this app's storage, so seeding stays fast and needs no S3/MinIO bucket.
 */
const UNSPLASH_BASE = 'https://images.unsplash.com/photo-';

export type ImageSize = 'thumb' | 'card' | 'full';

const SIZE_PARAMS: Readonly<Record<ImageSize, string>> = {
  thumb: 'w=200&h=200&fit=crop',
  card: 'w=600&h=600&fit=crop',
  full: 'w=1200&q=80',
};

export function unsplashUrl(photoId: string, size: ImageSize = 'full'): string {
  return `${UNSPLASH_BASE}${photoId}?auto=format&${SIZE_PARAMS[size]}`;
}

export const IMG = {
  // ── Phones & tablets ───────────────────────────────────────────────────────
  iphoneOnWood: '1592899677977-9c10ca588bbd',
  iphoneOnSheet: '1580910051074-3eb694886505',
  iphoneNeonHand: '1512499617640-c74ae3a79d37',
  iphoneWhiteBack: '1591337676887-a217a6970a8a',
  iphoneWithLaptop: '1511707171634-5f897ff02aa9',
  samsungViolet: '1610945265064-0e34e5519bbf',
  androidHomeScreen: '1598327105666-5b89351aff97',
  androidDarkScreen: '1601784551446-20c9e07cdbdb',
  ipadWithPencil: '1544244015-0df4b3ffc6b0',

  // ── Laptops & desktop ──────────────────────────────────────────────────────
  macbookNeon: '1517336714731-489689fd1ca8',
  macbookSilver: '1611186871348-b1ce696e52c9',
  laptopOnDesk: '1496181133206-80ce9b88a853',
  laptopWorkspace: '1593642632559-0c6d3fc62b89',
  laptopBrowser: '1603791440384-56cd371ee9a7',

  // ── Audio ──────────────────────────────────────────────────────────────────
  headphonesYellow: '1505740420928-5e560c06d30e',
  headphonesWhiteStudio: '1583394838336-acd977736f90',
  headphonesLeatherRetro: '1484704849700-f032a568e944',
  headphonesAnc: '1546435770-a3e426bf472b',
  headphonesWithKeyboard: '1550009158-9ebf69173e03',
  airpodsFloating: '1585155770447-2f66e2a397b5',
  airpodsMaxOrange: '1609081219090-a6d81d3085bf',
  earbudsRed: '1606220588913-b3aacb4d2f46',
  earbudsFlatlay: '1590658268037-6bf12165a8df',
  speakerPortable: '1608043152269-423dbba4e7e1',

  // ── Wearables & cameras ────────────────────────────────────────────────────
  smartwatchBlack: '1546868871-7041f2a55e12',
  smartwatchWhite: '1523275335684-37898b6baf30',
  instantCamera: '1526170375885-4d8ecf77b99f',

  // ── Gaming & PC accessories ────────────────────────────────────────────────
  ps5Controller: '1606144042614-b2417e99c4e3',
  ps5Console: '1606813907291-d86efa9b94db',
  xboxController: '1600080972464-8e5f35f63d08',
  mechanicalKeyboard: '1618384887929-16ec33fab9ef',
  magicKeyboard: '1587829741301-dc798b83add3',
  wirelessMouse: '1527864550417-7fd91fc51a46',
  gamingMouseRgb: '1629429408209-1f912961dbd8',
  gamingMonitor: '1593305841991-05c297ba4575',
  gamingRig: '1542751371-adc38448a05e',
  battlestation: '1598550476439-6847785fcea6',

  // ── Fashion: apparel ───────────────────────────────────────────────────────
  teeWhite: '1521572163474-6864f9cf17ab',
  teeGraphicBlack: '1503341504253-dff4815485f1',
  teeGraphicSand: '1576566588028-4147f3842f27',
  teeBlackHanger: '1618354691373-d851c5c3a990',
  leatherJacket: '1551028719-00167b16eac5',
  bomberJacket: '1591047139829-d91aecb6caea',
  denimJeans: '1542272604-787c3835535d',
  checkSuit: '1594938298603-c8148c4dae35',
  hoodieGray: '1556821840-3a63f95609a7',
  sweatshirtWhite: '1620799140408-edc6dcb6d633',
  knitPoncho: '1434389677669-e08b4cac3105',
  trackSuitYellow: '1515886657613-9f3515b0c78f',
  clothingRack: '1512436991641-6745cdb1723f',

  // ── Fashion: footwear ──────────────────────────────────────────────────────
  sneakerRed: '1542291026-7eec264c27ff',
  sneakerGreyFloating: '1491553895911-0055eca6402d',
  sneakerAirMax: '1600185365483-26d7a4cc7519',
  sneakerWheat: '1549298916-b41d501d3772',
  oxfordShoe: '1560343090-f0409e92791a',

  // ── Fashion: bags & accessories ────────────────────────────────────────────
  backpackNavy: '1553062407-98eeb64c6a62',
  crossbodyBag: '1548036328-c9fa89d128fa',
  toteBag: '1544816155-12df9643f363',
  leatherWallet: '1627123424574-724758594e93',
  sunglasses: '1572635196237-14b3f281503f',
  watchLeatherStrap: '1524592094714-0f0654e20314',
  watchRoseGold: '1522312346375-d1a52e2b99b3',
  diamondRing: '1605100804763-247f67b3557e',

  // ── Beauty ─────────────────────────────────────────────────────────────────
  cleanserTube: '1620916566398-39f1143ab7be',
  skincareTube: '1556228578-8c89e6adf883',
  lotionBottles: '1631729371254-42c2892f0e6e',
  serumDropper: '1608571423902-eed4a5ad8108',
  botanicalOils: '1611930022073-b7a4ba5fcccd',
  hairMask: '1608248597279-f99d160bfcbc',
  skincareSet: '1571781926291-c477ebfd024b',
  lipstickDuo: '1586495777744-4413f21062fa',
  makeupBrushes: '1596462502278-27bfdc403348',
  makeupFlatlay: '1522335789203-aabd1fc54bc9',
  perfumeNoirPink: '1585386959984-a4155224a1ad',
  perfumeNoirRoses: '1594035910387-fea47794261f',
  perfumeNo5: '1541643600914-78b084683601',

  // ── Home & living ──────────────────────────────────────────────────────────
  leatherSofa: '1540574163026-643ea20ade25',
  velvetSofa: '1555041469-a586c61ea9bc',
  terracottaSofa: '1567016432779-094069958ea5',
  sectionalLivingRoom: '1616486338812-3dadae4b4ace',
  diningChair: '1592078615290-033ee584e267',
  tulipChairs: '1574180045827-681f8a1a9622',
  mustardArmchair: '1586023492125-27b2c045efd7',
  bohoBedroom: '1583845112203-29329902332e',
  floorLamp: '1507473885765-e6ed057f782c',
  modernKitchen: '1556911220-bff31c812dba',
  espressoMachine: '1570222094114-d054a817e56b',
  latteCups: '1495474472287-4d71bcdd2085',
  whiteMug: '1514228742587-6b1558fcca3d',
  waterBottle: '1602143407151-7111542de6e8',
  notebookPen: '1531346878377-a5be20888e57',

  // ── Sports & fitness ───────────────────────────────────────────────────────
  barbellDeadlift: '1517836357463-d25dfeac3438',
  homeWorkout: '1571019613454-1cb2f99b2d8b',
  yogaSunset: '1544367567-0f2fcb009e0b',

  // ── Storefront / lifestyle ─────────────────────────────────────────────────
  retailStore: '1441986300917-64674bd600d8',
} as const satisfies Record<string, string>;

export type ImageKey = keyof typeof IMG;
