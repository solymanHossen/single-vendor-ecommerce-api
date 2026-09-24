import type { OrderStatus } from '@prisma/client';

/**
 * Human-written copy for user-generated content (reviews, support threads,
 * return requests). Realistic text matters here: product pages, admin
 * moderation queues and the support inbox are judged by how they read, and
 * lorem-ipsum makes every one of those screens look broken.
 *
 * `{product}` placeholders are substituted with the reviewed product's name.
 */

export type StarRating = 1 | 2 | 3 | 4 | 5;

export const REVIEW_COMMENTS: Readonly<Record<StarRating, readonly string[]>> = {
  5: [
    'Absolutely love the {product}! Genuine product, well packed and delivered a day earlier than promised.',
    'Exceeded my expectations. The build quality of the {product} is superb and it looks even better in person.',
    'Best purchase I have made this year. Works flawlessly and the seller support was very responsive.',
    'Five stars without a doubt. Compared prices everywhere and this was the best deal for an authentic {product}.',
    'Bought the {product} as a gift for my brother and he could not stop smiling. Premium packaging too.',
    'Using it daily for three weeks now — zero complaints. Highly recommended to anyone considering it.',
    'Original product with official warranty card. Delivery rider was polite and called before arriving.',
    'Top-notch quality. This is my second order from this shop and both experiences were excellent.',
  ],
  4: [
    'Very good {product} overall. Took one extra day to arrive but the quality makes up for it.',
    'Solid product and great value for money. Would have given five stars if the box was not slightly dented.',
    'Really happy with the {product}. Minor learning curve, but once set up it works perfectly.',
    'Good quality and exactly as described. Delivery to Chattogram took three days.',
    'Nice product, fits well and feels premium. Colour is a shade darker than the photos.',
    'Happy with the purchase. Customer service helped me choose the right variant.',
  ],
  3: [
    'The {product} is decent for the price, but I expected slightly better finishing.',
    'Average experience. The product is fine but delivery was delayed by two days without any update.',
    'It does the job. Nothing extraordinary, nothing terrible.',
    'Quality is okay. Packaging could be improved — it arrived in a thin poly bag.',
  ],
  2: [
    'Not quite what I expected from the {product}. The material feels cheaper than the listing suggests.',
    'Had to contact support twice before my order was dispatched. The product itself is just okay.',
    'Sizing runs small — I had to exchange it. The exchange process was slow.',
  ],
  1: [
    'Disappointed. The {product} stopped working properly after a week and I am waiting on a replacement.',
    'Received the wrong variant and it took too long to sort out. Would not order again in a hurry.',
  ],
};

/** Rating distribution skewed positive, as real marketplace ratings are. */
export const RATING_WEIGHTS: ReadonlyArray<{
  readonly weight: number;
  readonly value: StarRating;
}> = [
  { weight: 46, value: 5 },
  { weight: 30, value: 4 },
  { weight: 13, value: 3 },
  { weight: 7, value: 2 },
  { weight: 4, value: 1 },
];

export const POSITIVE_REVIEW_REPLIES = [
  'Thank you so much for your kind words! We are thrilled you are enjoying your purchase.',
  'We really appreciate you taking the time to share this. Happy shopping, and see you again soon!',
  'Thank you for the wonderful feedback — it means a lot to our whole team.',
  'So glad to hear it arrived on time and in perfect condition. Enjoy!',
] as const;

export const CRITICAL_REVIEW_REPLIES = [
  'We are sorry your experience fell short. Our support team has reached out by phone to make this right.',
  'Thank you for the honest feedback. We have shared it with our logistics partner to improve delivery times.',
  'Apologies for the inconvenience. Please open a support ticket with your order number and we will prioritise a replacement.',
  'We are sorry to hear this. Every product carries a 7-day easy return — our team will help you with the process.',
] as const;

export const RETURN_REASONS = [
  'The item arrived with a visible scratch on the surface. Attaching photos for reference.',
  'Wrong size delivered — I ordered L but received M.',
  'Product does not match the colour shown in the listing photos.',
  'The device does not power on even after charging overnight.',
  'I received a different variant from the one I ordered.',
  'Changed my mind — the item is unused and still in its original sealed packaging.',
  'The packaging was damaged in transit and one accessory is missing.',
] as const;

export const RETURN_APPROVED_NOTES = [
  'Return approved. Our courier will collect the item within 48 hours.',
  'Verified from the photos provided. Pickup scheduled and refund will be processed after inspection.',
  'Approved as per our 7-day return policy. A replacement unit has been reserved for you.',
] as const;

export const RETURN_REFUNDED_NOTES = [
  'Item received and inspected. Full refund issued to the original payment method.',
  'Refund completed. Please allow 3–5 business days for it to reflect in your account.',
] as const;

export const RETURN_REJECTED_NOTES = [
  'The return window of 7 days had passed at the time of the request.',
  'The item shows signs of use and physical damage not covered by our return policy.',
] as const;

export interface TicketScenario {
  readonly subject: string;
  /**
   * Order statuses this scenario makes sense for — the ticket is linked to
   * one of the customer's orders in such a state. Omitted for general,
   * pre-sales or account questions, which carry no orderId.
   */
  readonly orderStatuses?: readonly OrderStatus[];
  readonly opening: string;
  readonly staffReplies: readonly string[];
  readonly customerFollowUps: readonly string[];
}

export const TICKET_SCENARIOS: readonly TicketScenario[] = [
  {
    subject: 'Where is my order?',
    orderStatuses: ['PROCESSING', 'SHIPPED'],
    opening:
      'Hi, my order was supposed to arrive yesterday but the status has not changed. Could you please check?',
    staffReplies: [
      'Thank you for reaching out! Your parcel is with our courier partner and is scheduled for delivery within 24 hours.',
      'Update: the rider has confirmed your parcel is out for delivery today. You will receive a call before arrival.',
    ],
    customerFollowUps: ['Thanks for the quick update!', 'Received it just now, thank you.'],
  },
  {
    subject: 'Request to change delivery address',
    orderStatuses: ['PENDING', 'PROCESSING'],
    opening:
      'I placed an order this morning but entered my old address. Can you change it to my office address in Gulshan?',
    staffReplies: [
      'No problem! We have updated the delivery address on your order before dispatch.',
    ],
    customerFollowUps: ['Perfect, much appreciated.'],
  },
  {
    subject: 'Payment deducted but order shows unpaid',
    orderStatuses: ['PENDING', 'PROCESSING', 'DELIVERED'],
    opening:
      'My bKash account was charged but the order still shows the payment as unpaid. Transaction screenshot attached.',
    staffReplies: [
      'Sorry for the confusion. We are verifying the transaction with bKash — this usually takes up to 2 hours.',
      'Your payment has been confirmed and the order status is updated. Apologies for the delay!',
    ],
    customerFollowUps: ['Great, I can see it as paid now.'],
  },
  {
    subject: 'Received a damaged item',
    orderStatuses: ['DELIVERED', 'RETURNED'],
    opening:
      'The product I received has a crack on the side. The box looked fine from outside. What should I do?',
    staffReplies: [
      'We are very sorry about this. Please submit a return request from your order page and we will arrange a free pickup.',
      'Pickup is scheduled for tomorrow between 10 AM and 2 PM. A replacement will be dispatched once it reaches our warehouse.',
    ],
    customerFollowUps: [
      'Okay, I have submitted the return request.',
      'Replacement received, all good now.',
    ],
  },
  {
    subject: 'Cancel my order',
    orderStatuses: ['CANCELLED'],
    opening: 'I would like to cancel my recent order, I ordered the wrong variant by mistake.',
    staffReplies: [
      'Your order has been cancelled successfully. If you paid online, the refund will reach you within 5–7 business days.',
    ],
    customerFollowUps: ['Thank you for the fast help.'],
  },
  {
    subject: 'Is this product covered by official warranty?',
    opening:
      'Before I buy, can you confirm whether the laptop comes with official brand warranty in Bangladesh?',
    staffReplies: [
      'Yes — all our electronics are sourced from authorised distributors and include official warranty with a serial-registered warranty card.',
    ],
    customerFollowUps: ['That is reassuring, placing my order now.'],
  },
  {
    subject: 'Do you offer EMI on credit cards?',
    opening: 'Is there any EMI facility available for purchases above 50,000 taka?',
    staffReplies: [
      'Yes, 0% EMI for up to 12 months is available on selected bank cards via SSLCommerz at checkout.',
    ],
    customerFollowUps: ['Which banks are supported?'],
  },
  {
    subject: 'Coupon code not working',
    opening: 'The WELCOME10 code shows as invalid at checkout. Is it still active?',
    staffReplies: [
      'WELCOME10 requires a minimum order of ৳1,000. Please add a little more to your cart and it will apply automatically.',
    ],
    customerFollowUps: ['Got it, it worked now!'],
  },
  {
    subject: 'Size exchange for shoes',
    orderStatuses: ['DELIVERED'],
    opening: 'The shoes are a bit tight. Can I exchange them for one size bigger?',
    staffReplies: [
      'Of course! Size exchanges are free within 7 days. We will send the new pair and collect the old one at the same time.',
    ],
    customerFollowUps: ['Awesome, thank you.'],
  },
  {
    subject: 'Unable to log in to my account',
    opening: 'I keep getting "invalid credentials" even after resetting my password twice.',
    staffReplies: [
      'Sorry about that. Your account was temporarily locked after several failed attempts — it has now been unlocked. Please try again.',
    ],
    customerFollowUps: ['Logged in successfully, thanks!'],
  },
];
