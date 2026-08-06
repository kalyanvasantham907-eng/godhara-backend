/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  STATIC PRODUCT CATALOG — Godhara                                 ║
 * ║                                                                    ║
 * ║  Products are NOT stored in Neon PostgreSQL. This file is the      ║
 * ║  single source of truth for the product catalog on the backend.    ║
 * ║  The frontend keeps an identical copy at                           ║
 * ║  `frontend/src/data/products.ts` — because the frontend and         ║
 * ║  backend are separate deployments they cannot literally share one   ║
 * ║  file at runtime, so BOTH copies must be kept in sync whenever a    ║
 * ║  product changes.                                                   ║
 * ║                                                                    ║
 * ║  ⚠️  IMAGES: `images` below use placeholder Cloudinary-style URLs   ║
 * ║  built from each product's slug. Replace them with your real        ║
 * ║  Cloudinary URLs before going live (same slug in both this file      ║
 * ║  and the frontend copy).                                            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

export interface StaticProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  discountPrice?: number;
  stock: number;
  category: string;
  images: string[];
  imagePublicIds: string[];
  isFeatured: boolean;
  isActive: boolean;
  /** Manual admin-controlled availability override, merged in at runtime from
   * the `product_inventory` Postgres table (see src/database/index.ts). Not
   * part of the static seed data itself. */
  inStock?: boolean;
  packageSize: string;
  weight?: number;
  createdAt: string;
  updatedAt: string;
}

// Fixed timestamp so the static catalog never "changes" between requests/builds.
const SEED_TS = '2026-01-01T00:00:00.000Z';

export const CATEGORIES: string[] = [
  'Household Products',
  'Personal Care',
  'Spiritual',
  'Ayurvedic Remedies',
];

// Placeholder Cloudinary URL builder — replace with your real uploaded URLs.
const img = (slug: string) =>
  `https://res.cloudinary.com/godhara/image/upload/v1/godhara_products/${slug}.jpg`;

export const PRODUCTS: StaticProduct[] = [
  {
    id: 'prod-1784369756707',
    name: 'Bio Enzyme Dishwash Liquids',
    slug: 'bio-enzyme-dishwash-liquids',
    description:
      'Clean Your Utensils Naturally - Without Harsh Chemicals.\n\n' +
      'Godhara Bio Enzyme Dishwash Liquid is prepared using Bio Enzyme made from lemons and soapnuts, making it a natural alternative for everyday dishwashing. It helps remove grease, oil, and food stains while being gentle for regular use.\n\n' +
      'Highlights:\n' +
      '- Made from Lemon & Soapnut Bio Enzyme\n' +
      '- Free from harsh chemicals\n' +
      '- Effectively removes grease and food residue\n' +
      '- Suitable for daily cleaning of steel, copper, brass, glass, ceramic, and other washable utensils\n' +
      '- Pleasant natural freshness\n' +
      '- Concentrated formula - a small quantity is enough\n\n' +
      'How to Use:\n' +
      'Take a small amount of Dishwash Liquid on a scrubber or sponge, wash the utensils, and rinse thoroughly with clean water.\n\n' +
      'Choose a natural way to keep your utensils clean with Godhara Bio Enzyme Dishwash Liquid.',
    price: 150.0,
    stock: 48,
    category: 'Household Products',
    images: ["https://res.cloudinary.com/dndugbffx/image/upload/v1784738264/godhara_products/ilgt3tuku05syuvimjxz.jpg"],
    imagePublicIds: [],
    isFeatured: true,
    isActive: true,
    packageSize: '200 ml',
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: 'prod-1784352789746',
    name: 'Thick (Lavu) Cotton Wicks',
    slug: 'thick-lavu-cotton-wicks',
    description:
      'Experience the purity of traditional lighting with our Handmade Thick Cotton Wicks, specially crafted for a brighter, stronger, and longer-lasting flame. Made from 100% pure premium cotton, these thick wicks absorb oil or ghee efficiently, making them perfect for daily pooja, temples, festivals, and special religious ceremonies.\n\n' +
      'Key Features:\n' +
      '- Made from 100% Pure Premium Cotton\n' +
      '- Thick (Lavu) design for a bright and steady flame\n' +
      '- Burns longer than regular cotton wicks\n' +
      '- Excellent oil and ghee absorption\n' +
      '- Ideal for daily pooja, festivals, and spiritual rituals\n\n' +
      'How to Use:\n' +
      'Place the thick cotton wick in a diya, soak it well with ghee or oil, and light it. For the best results, ensure the wick is fully saturated before lighting for the purity, tradition, and divine glow of our Handmade Thick Cotton Wicks.',
    price: 200.0,
    discountPrice: 200.0,
    stock: 92,
    category: 'Spiritual',
    images: ["https://res.cloudinary.com/dndugbffx/image/upload/v1784357204/godhara_products/cbffbwsled7tqa5s47a8.jpg"],
    imagePublicIds: [],
    isFeatured: false,
    isActive: true,
    packageSize: '1000 Pcs',
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: 'prod-1784355630612',
    name: 'Thin (Sannani) Cotton Wicks',
    slug: 'thin-sannani-cotton-wicks',
    description:
      'Light every prayer with a clean, steady, and long-lasting flame. Our Handmade Premium Cotton Wicks are crafted from 100% pure, high-quality cotton to provide a clean, steady, and long-lasting flame. Soft, absorbent, and easy to use, they are ideal for daily pooja, festivals, temples, and all spiritual rituals.\n\n' +
      'Key Features:\n' +
      '- Bright, steady & long-lasting flame\n' +
      '- Highly absorbent for oil and ghee\n' +
      '- Suitable for daily pooja and special occasions\n' +
      '- No synthetic fibers or harmful chemicals\n\n' +
      'How to Use:\n' +
      'Place the cotton wick in a diya, soak it well with oil or ghee, and light it.\n\n' +
      'Bring purity, positivity, and divine light into your home with our premium handmade cotton wicks.',
    price: 250.0,
    discountPrice: 200.0,
    stock: 98,
    category: 'Spiritual',
    images: ["https://res.cloudinary.com/dndugbffx/image/upload/v1784738533/godhara_products/prroggb094t1zhbamdla.jpg"],
    imagePublicIds: [],
    isFeatured: false,
    isActive: true,
    packageSize: '1000 Pcs',
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: 'prod-1784353855528',
    name: 'Bio Enzyme Copper Cleaner Spray',
    slug: 'bio-enzyme-copper-cleaner-spray-100-ml',
    description:
      'Bring back the natural shine of your copper and brass utensils with our Bio Enzyme Copper Cleaner Spray. Made using bio-enzymes and plant-based ingredients, this cleaner effectively removes tarnish, oxidation, stains, and dullness without harsh chemicals.',
    price: 200.0,
    discountPrice: 100.0,
    stock: 37,
    category: 'Household Products',
    images: ["https://res.cloudinary.com/dndugbffx/image/upload/v1783855537/godhara_products/xmsjehdzo5pkclxsz57v.jpg"],
    imagePublicIds: [],
    isFeatured: false,
    isActive: true,
    packageSize: '100 ml',
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: 'prod-1782768884405',
    name: 'Panchagavya Facepack',
    slug: 'panchagavya-facepack',
    description:
      'Experience the power of pure, traditional skincare with our Panchagavya Facepack – a carefully crafted blend of Multani Mitti, Turmeric, and sacred desi cow ingredients like milk, curd, and ghee, enriched with Ayurvedic herbs. This all-natural formula works deeply on your skin to cleanse, nourish, and restore its natural glow-without any harmful chemicals or preservatives.',
    price: 120.0,
    stock: 50,
    category: 'Personal Care',
    images: ["https://res.cloudinary.com/dndugbffx/image/upload/v1780725508/WhatsApp_Image_2026-05-31_at_11.14.00_AM_1_le06ps.jpg"],
    imagePublicIds: [],
    isFeatured: true,
    isActive: true,
    packageSize: '100 g',
    weight: 10,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: 'prod-1782766602912',
    name: 'Panchagavya Dhoop Sticks (24pcs)',
    slug: 'panchagavya-dhoop-sticks-24pcs',
    description:
      'Godhara Panchagavya Dhoop Sticks are hand-crafted using desi cow dung, natural herbs, resins, and sacred ingredients as per ancient Indian practices. These dhoop sticks release a soothing, earthy fragrance that purifies the atmosphere and enhances spiritual energy, while creating a calm, devotional ambience for daily pooja, meditation, temples, and vastu purification.\n\n' +
      'Key Features & Benefits:\n' +
      '- Made from desi cow dung & natural herbal ingredients\n' +
      '- Chemical-free, charcoal-free & non-toxic\n' +
      '- Creates a calm, devotional atmosphere\n' +
      '- Helps in air purification & positivity\n' +
      '- Slow, even burning with long-lasting fragrance\n' +
      '- Safe for regular household use',
    price: 100.0,
    stock: 37,
    category: 'Spiritual',
    images: ["https://res.cloudinary.com/dndugbffx/image/upload/v1782876555/godhara_products/o4bevabcgdcks5xf7bm5.jpg"],
    imagePublicIds: [],
    isFeatured: true,
    isActive: true,
    packageSize: '24 Pcs',
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: 'prod-1782787086511',
    name: 'Herbal Bath Powder (100grm)',
    slug: 'herbal-bath-powder-100grm',
    description:
      'Experience the goodness of Ayurveda with our Herbal Bath Powder made with a Natural Herbal Bath Powder, made from a nourishing blend of Multani Mitti, A2 Milk, Reetha, Nagarmotha, Sona Gaov, Kapoor, Coconut Oil, Haldi, and Neem. This chemical-free formula gently cleanses, exfoliates, and nourishes your skin, leaving it soft, fresh, and naturally radiant. Suitable for all skin types and ideal for daily use, it offers a refreshing, natural bathing experience while promoting glowing skin.\n\n' +
      'Key Benefits:\n' +
      '- Made with 100% natural herbal ingredients\n' +
      '- Gently cleanses and exfoliates the skin\n' +
      '- Nourishes and moisturizes your skin\n' +
      '- Helps keep skin soft, smooth, and naturally glowing\n' +
      '- Removes dirt, excess oil, and dead skin cells\n' +
      '- Helps keep skin cells fresh\n' +
      '- Suitable for all skin types\n' +
      '- Safe and gentle for daily use\n' +
      '- Free from harsh chemicals and artificial additives',
    price: 100.0,
    stock: 50,
    category: 'Personal Care',
    images: ["https://res.cloudinary.com/dndugbffx/image/upload/v1782875543/godhara_products/xrpbvus3qtl453ai36qo.jpg"],
    imagePublicIds: [],
    isFeatured: false,
    isActive: true,
    packageSize: '100 g',
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: 'prod-1782754271075',
    name: 'Desi Cow Dung Diyas (8pcs)',
    slug: 'desi-cow-dung-diyas-8pcs',
    description:
      'Godhara Panchagavya Diyas are thoughtfully handcrafted to bring purity, devotion, and positive energy into your pooja and living spaces. Designed in traditional Indian styles, these diyas create a serene spiritual ambience when lit with oil or ghee.\n\n' +
      'Key Features & Benefits:\n' +
      '- Handcrafted with care using traditional methods\n' +
      '- Designed for steady, bright flame\n' +
      '- Ideal for offering lighting\n' +
      '- Enhances spiritual vibrations & positivity\n' +
      '- Durable and easy to use for pooja spaces',
    price: 80.0,
    stock: 99,
    category: 'Spiritual',
    images: ["https://res.cloudinary.com/dndugbffx/image/upload/v1782875361/godhara_products/bccgfyljh2kfhwcyoiz3.jpg"],
    imagePublicIds: [],
    isFeatured: false,
    isActive: true,
    packageSize: '8 Pcs',
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: 'prod-1784734346520',
    name: 'Amruthdhara Inhaler',
    slug: 'amruthdhara-inhaler',
    description:
      'Godhara Amruthdhara Inhaler is a natural herbal formulation inspired by Panchagavya traditions, used for wellness and spiritual practices. Designed for direct inhalation, it helps you breathe easier anytime, anywhere.\n\n' +
      'Benefits:\n' +
      '- Helps relieve nasal congestion and blocked sinuses\n' +
      '- Supports easy breathing during cold and allergy discomfort\n' +
      '- Refreshes the senses and improves alertness\n' +
      '- Easy to carry, leak-proof, and reusable',
    price: 80.0,
    stock: 50,
    category: 'Ayurvedic Remedies',
    images: ["https://res.cloudinary.com/dndugbffx/image/upload/v1782874316/godhara_products/idorebpbrdyzgpr8lo9k.jpg"],
    imagePublicIds: [],
    isFeatured: false,
    isActive: true,
    packageSize: '',
    weight: 10,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },

  {
    id: 'prod-1782873777831',
    name: 'Amruthdhara Drops',
    slug: 'amruthdhara-drops',
    description:
      'Experience the time-tested healing strength of Amruthdhara, a natural remedy trusted for everyday discomforts. This powerful liquid formulation works fast and is incredibly easy to use, making it a must-have in every home.\n\n' +
      'Multiple Ways to Use:\n' +
      '- Mix one drop in water, tea, or coffee for internal relief\n' +
      '- Inhale directly to ease respiratory discomfort\n' +
      '- Apply externally to relieve body aches and localized pain\n' +
      '- Use a small quantity for toothache relief',
    price: 80.0,
    stock: 50,
    category: 'Ayurvedic Remedies',
    images: ["https://res.cloudinary.com/dndugbffx/image/upload/v1782873689/godhara_products/e0aa8wuh5v9zxbfd13ff.jpg"],
    imagePublicIds: [],
    isFeatured: true,
    isActive: true,
    packageSize: '',
    weight: 10,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: 'prod-1782873499594',
    name: 'Panchagavya Danthmanjan',
    slug: 'panchagavya-danthmanjan',
    description:
      'Panchagavya Danthmanjan is a 100% natural, chemical-free Ayurvedic tooth powder made with Gomya Bhasmam, Neem, Triphala, Sendha Namak, Black Salt, Eucalyptus Oil, and Clove Oil. It helps in natural teeth whitening, deep cleaning, fresh breath, oral care, and serves as an effective alternative to modern toothpaste for complete oral care.',
    price: 120.0,
    stock: 48,
    category: 'Personal Care',
    images: ["https://res.cloudinary.com/dndugbffx/image/upload/v1782873455/godhara_products/bv3o0twmbxwpkhmvnxo5.jpg"],
    imagePublicIds: [],
    isFeatured: false,
    isActive: true,
    packageSize: '',
    weight: 50,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: 'prod-1785160838001',
    name: 'Amruthadhara Roll-on',
    slug: 'amruthadhara-roll-on',
    description:
      'Amruthadhara Roll-on is a fast-acting Ayurvedic herbal roll-on formulated with natural essential oils to provide quick relief from headaches, nasal congestion, body pain, muscle aches, and motion sickness. Its compact roll-on design makes it easy to carry and apply anytime.\n\n' +
      'Key Features:\n' +
      '- Instant relief from headaches\n' +
      '- Helps relieve cold and nasal congestion\n' +
      '- Effective for body and muscle pain\n' +
      '- Easy roll-on application\n' +
      '- Made with Ayurvedic herbal ingredients\n' +
      '- Travel-friendly and leak-proof bottle\n' +
      '- Suitable for everyday use\n\n' +
      'Directions for Use:\n' +
      'Apply a small amount to the forehead, temples, neck, or affected area and gently massage. Inhale the soothing aroma for relief from congestion. Use as needed.\n\n' +
      'Product Benefits:\n' +
      '- Quick pain relief\n' +
      '- Refreshing herbal aroma\n' +
      '- Portable and convenient\n' +
      '- Non-greasy formula\n' +
      '- Suitable for home, office, and travel',
    price: 80.0,
    stock: 50,
    category: 'Personal Care',
    images: ["https://res.cloudinary.com/dndugbffx/image/upload/v1785162849/WhatsApp_Image_2026-07-27_at_8.02.45_PM_wl6npp.jpg"],
    imagePublicIds: [],
    isFeatured: false,
    isActive: true,
    packageSize: '10 ml',
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
  {
    id: 'prod-1785725114345',
    name: 'Godhara Handmade Round Cotton Wicks',
    slug: 'godhara-handmade-round-cotton-wicks',
    description:
      'Handcrafted from premium-quality cotton, Godhara Round Cotton Wicks provide a bright, steady, and clean-burning flame for daily pooja, aarti, diyas, and festive rituals. Designed for long-lasting performance with minimal smoke, they bring purity, tradition, and devotion to every prayer.',
    price: 60.0,
    stock: 50,
    category: 'Spiritual',
    images: ["https://res.cloudinary.com/dndugbffx/image/upload/v1785725054/godhara_bwgktx.jpg"],
    imagePublicIds: [],
    isFeatured: true,
    isActive: true,
    packageSize: '108 Pcs',
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  },
];

export function getAllProducts(): StaticProduct[] {
  return PRODUCTS;
}

export function getActiveProducts(): StaticProduct[] {
  return PRODUCTS.filter((p) => p.isActive);
}

export function getFeaturedProducts(): StaticProduct[] {
  return PRODUCTS.filter((p) => p.isActive && p.isFeatured);
}

export function getProductById(id: string): StaticProduct | null {
  return PRODUCTS.find((p) => p.id === id) ?? null;
}

export function getProductBySlug(slug: string): StaticProduct | null {
  return PRODUCTS.find((p) => p.slug === slug) ?? null;
}

export function getCategories(): string[] {
  return CATEGORIES;
}
