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
      content: 'Our Story\n\nWe started AURA to provide the best Next-gen tech & streetwear. We believe in high quality and excellent customer service. Our dedicated team works around the clock to source the best items directly to your doorstep.',
    },
    {
      slug: 'terms',
      title: 'Terms of Service',
      content: '1. Terms\n\nBy accessing this website, you are agreeing to be bound by these website Terms and Conditions of Use. We reserve the right to update these terms at any time without prior notice. Please review them periodically.',
    },
    {
      slug: 'warranty',
      title: 'Warranty',
      content: 'Warranty Policy\n\nAll electronics come with a standard 1-year manufacturer warranty. Please keep your invoice. Physical damage, water damage, and unauthorized tampering will void the warranty immediately.',
    },
    {
      slug: 'stores',
      title: 'Store Locations',
      content: 'Our Branches\n\nDhaka Branch\n123 Street, Dhaka\nOpen: 10AM - 8PM\n\nChittagong Branch\n456 Road, Chittagong\nOpen: 10AM - 6PM',
    },
    {
      slug: 'privacy',
      title: 'Privacy Policy',
      content: 'Privacy Policy\n\nYour privacy is critically important to us. This Privacy Policy explains how we collect, use, and share information about you. We do not sell your personal data to third parties. All transactions are securely encrypted.',
    }
  ];

  for (const page of pages) {
    await prisma.page.update({
      where: { slug: page.slug },
      data: { content: page.content },
    });
  }
  console.log('Pages updated successfully!');
}

main()
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
