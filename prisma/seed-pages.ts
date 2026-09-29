import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const pages = [
    {
      slug: 'about',
      title: 'About Us',
      content: '## Our Story\nWe started AURA to provide the best Next-gen tech & streetwear. We believe in high quality and excellent customer service.',
    },
    {
      slug: 'terms',
      title: 'Terms of Service',
      content: '## 1. Terms\nBy accessing this website, you are agreeing to be bound by these website Terms and Conditions of Use.',
    },
    {
      slug: 'warranty',
      title: 'Warranty',
      content: '## Warranty Policy\nAll electronics come with a standard 1-year manufacturer warranty. Please keep your invoice.',
    },
    {
      slug: 'stores',
      title: 'Store Locations',
      content: '## Our Branches\n**Dhaka Branch**\n123 Street, Dhaka\n\n**Chittagong Branch**\n456 Road, Chittagong',
    },
    {
      slug: 'privacy',
      title: 'Privacy Policy',
      content: '## Privacy Policy\nYour privacy is critically important to us. This Privacy Policy explains how we collect, use, and share information about you.',
    }
  ];

  for (const page of pages) {
    await prisma.page.upsert({
      where: { slug: page.slug },
      update: {},
      create: page,
    });
  }
  console.log('Pages seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
