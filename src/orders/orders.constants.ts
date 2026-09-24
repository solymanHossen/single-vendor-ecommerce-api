import { OrderStatus } from '@prisma/client';

/** Single source of truth for the enum's members, reused by every Zod schema that validates a status. */
export const ORDER_STATUS_VALUES = Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]];

// ── Shipping (BDT) ──────────────────────────────────────────────────────────
// Same values the order seeder uses, so seeded history and live checkout agree.
export const SHIPPING_FEE_INSIDE_DHAKA = 60;
export const SHIPPING_FEE_OUTSIDE_DHAKA = 120;
/** Subtotal (before coupon) at which delivery becomes free. */
export const FREE_SHIPPING_THRESHOLD = 10_000;

export function isInsideDhaka(city: string): boolean {
  return city.trim().toLowerCase() === 'dhaka';
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
/**
 * Every status change must follow this map. Terminal states have no exits,
 * so a delivered order can't silently reopen or a cancelled one reship.
 */
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED],
  DELIVERED: [OrderStatus.RETURNED],
  CANCELLED: [],
  RETURNED: [],
};

/** Customers may cancel on their own only before the order is being prepared. */
export const CUSTOMER_CANCELLABLE_STATUSES: readonly OrderStatus[] = [OrderStatus.PENDING];

/** Cancelling from these puts the units back on the shelf. */
export const RESTOCK_ON_CANCEL_STATUSES: readonly OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PROCESSING,
];

/** Gateways (bKash, SSLCommerz, Stripe) aren't integrated yet — only COD is accepted. */
export const CHECKOUT_PAYMENT_METHODS = ['COD'] as const;
