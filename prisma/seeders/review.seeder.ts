import { PrismaClient, OrderStatus, Role, type Prisma } from '@prisma/client';
import { faker } from '@faker-js/faker';
import type { Seeder } from './seeder.interface';
import {
  insertAll,
  resetIdentitySequence,
  truncateTables,
  addDays,
  addHours,
  daysAgo,
  notAfterNow,
} from './seeder.utils';
import {
  CRITICAL_REVIEW_REPLIES,
  POSITIVE_REVIEW_REPLIES,
  RATING_WEIGHTS,
  REVIEW_COMMENTS,
} from './data/content.data';

/** Share of delivered line items whose buyer leaves a review. */
const REVIEW_PROBABILITY = 0.65;

export class ReviewSeeder implements Seeder {
  readonly name = 'ReviewSeeder';
  readonly description =
    'Seeds verified-purchase reviews with photos and admin replies from delivered orders';
  readonly order = 10;

  async seed(prisma: PrismaClient): Promise<void> {
    console.info('🧹 Cleaning review tables...');
    await truncateTables(prisma, ['review_replies', 'review_images', 'reviews']);

    const [deliveredOrders, admins] = await Promise.all([
      prisma.order.findMany({
        where: { status: OrderStatus.DELIVERED, userId: { not: null } },
        select: {
          id: true,
          userId: true,
          updatedAt: true,
          items: {
            select: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: { select: { url: true }, orderBy: { id: 'asc' } },
                },
              },
            },
          },
        },
        orderBy: { id: 'asc' },
      }),
      prisma.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      }),
    ]);

    if (admins.length === 0) {
      throw new Error('ReviewSeeder requires at least one ADMIN or SUPER_ADMIN user.');
    }

    const reviews: Prisma.ReviewCreateManyInput[] = [];
    const reviewImages: Prisma.ReviewImageCreateManyInput[] = [];
    const replies: Prisma.ReviewReplyCreateManyInput[] = [];
    // Mirrors the @@unique([userId, productId]) constraint: one review per
    // customer per product, even when they bought it more than once.
    const reviewedPairs = new Set<string>();
    const recentCutoff = daysAgo(3);

    for (const order of deliveredOrders) {
      if (order.userId === null) {
        continue;
      }

      for (const { product } of order.items) {
        const pairKey = `${order.userId}:${product.id}`;
        if (
          reviewedPairs.has(pairKey) ||
          !faker.datatype.boolean({ probability: REVIEW_PROBABILITY })
        ) {
          continue;
        }
        reviewedPairs.add(pairKey);

        const reviewId = reviews.length + 1;
        const rating = faker.helpers.weightedArrayElement([...RATING_WEIGHTS]);
        const createdAt = notAfterNow(
          addDays(order.updatedAt, faker.number.float({ min: 0.5, max: 14 })),
        );
        // Fresh reviews are still in the moderation queue; older ones are
        // almost always approved (a few stay rejected/pending forever).
        const isApproved =
          createdAt > recentCutoff
            ? faker.datatype.boolean({ probability: 0.35 })
            : faker.datatype.boolean({ probability: 0.93 });
        const hasComment = faker.datatype.boolean({ probability: 0.9 });

        reviews.push({
          id: reviewId,
          userId: order.userId,
          productId: product.id,
          orderId: order.id,
          rating,
          comment: hasComment
            ? faker.helpers
                .arrayElement(REVIEW_COMMENTS[rating])
                .replaceAll('{product}', product.name)
            : null,
          isApproved,
          createdAt,
          updatedAt: createdAt,
        });

        // Happy customers occasionally post photos of what they received.
        if (
          rating >= 3 &&
          product.images.length > 0 &&
          faker.datatype.boolean({ probability: 0.2 })
        ) {
          const photos = faker.helpers.arrayElements(product.images, { min: 1, max: 2 });
          for (const photo of photos) {
            reviewImages.push({ reviewId, imageUrl: photo.url });
          }
        }

        // Staff reply to every critical approved review, and to some praise.
        const shouldReply =
          isApproved && (rating <= 3 || faker.datatype.boolean({ probability: 0.3 }));
        if (shouldReply) {
          replies.push({
            reviewId,
            adminId: faker.helpers.arrayElement(admins).id,
            replyText: faker.helpers.arrayElement(
              rating <= 3 ? CRITICAL_REVIEW_REPLIES : POSITIVE_REVIEW_REPLIES,
            ),
            createdAt: notAfterNow(addHours(createdAt, faker.number.float({ min: 2, max: 48 }))),
          });
        }
      }
    }

    await insertAll(prisma.review, reviews, 'reviews');
    await insertAll(prisma.reviewImage, reviewImages, 'review_images');
    await insertAll(prisma.reviewReply, replies, 'review_replies');
    await resetIdentitySequence(prisma, 'reviews');

    const approved = reviews.filter((review) => review.isApproved).length;
    console.info(
      `✅ Seeded ${reviews.length} reviews (${approved} approved), ` +
        `${reviewImages.length} review photos and ${replies.length} admin replies.`,
    );
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    await truncateTables(prisma, ['review_replies', 'review_images', 'reviews']);
    console.info('↩️  ReviewSeeder rolled back.');
  }
}
