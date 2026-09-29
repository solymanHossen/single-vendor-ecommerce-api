import { Role } from '@prisma/client';

/**
 * Every permission a staff role can grant. Keys are stable identifiers
 * stored in `staff_roles.permissions` — rename one only with a data
 * migration. Managing staff access, roles and the audit log is deliberately
 * NOT here: those stay SUPER_ADMIN-only, so no grantable permission can be
 * used to escalate one's own access.
 */
export const PERMISSION_GROUPS = [
  {
    key: 'store',
    label: 'Store',
    permissions: [
      {
        key: 'analytics.view',
        label: 'View dashboard',
        description: 'Sales, orders and customer figures on the overview.',
      },
      {
        key: 'settings.manage',
        label: 'Edit store settings',
        description: 'Brand, contact details, delivery fees and sign-up options.',
      },
    ],
  },
  {
    key: 'orders',
    label: 'Orders',
    permissions: [
      {
        key: 'orders.view',
        label: 'View all orders',
        description: 'See every order, customer and delivery address.',
      },
      {
        key: 'orders.manage',
        label: 'Fulfil orders',
        description: 'Move orders through preparing, shipping and delivery, or cancel them.',
      },
      {
        key: 'payments.manage',
        label: 'Manage payments',
        description: 'Record payments and change payment status.',
      },
      {
        key: 'returns.manage',
        label: 'Handle returns',
        description: 'Review and resolve return requests.',
      },
    ],
  },
  {
    key: 'catalog',
    label: 'Catalog',
    permissions: [
      {
        key: 'catalog.manage',
        label: 'Manage products',
        description: 'Create and edit products, variants, categories and attributes.',
      },
      {
        key: 'coupons.manage',
        label: 'Manage coupons',
        description: 'Create, edit and retire discount codes.',
      },
      {
        key: 'campaigns.manage',
        label: 'Manage sale campaigns',
        description: 'Run time-limited sales with their own page, prices and countdown.',
      },
      {
        key: 'banners.manage',
        label: 'Manage homepage banners',
        description: 'Arrange and publish the homepage hero banners.',
      },
    ],
  },
  {
    key: 'customers',
    label: 'Customers',
    permissions: [
      {
        key: 'customers.view',
        label: 'View customers',
        description: 'See customer accounts and their order history.',
      },
      {
        key: 'customers.manage',
        label: 'Manage customer accounts',
        description: 'Deactivate, reactivate, unlock or sign out customers.',
      },
      {
        key: 'reviews.moderate',
        label: 'Moderate reviews',
        description: 'Reply to, hide or remove product reviews.',
      },
      {
        key: 'tickets.manage',
        label: 'Answer support tickets',
        description: 'See and reply to every customer support ticket.',
      },
    ],
  },
] as const;

export type Permission = (typeof PERMISSION_GROUPS)[number]['permissions'][number]['key'];

export const ALL_PERMISSIONS: readonly Permission[] = PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => permission.key),
);

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}

/**
 * What a user may do. SUPER_ADMIN: everything. ADMIN: their staff role's
 * permissions (none without a role). USER: nothing. Unknown keys stored in
 * the database (e.g. a retired permission) are dropped.
 */
export function effectivePermissions(
  role: Role,
  staffRolePermissions: readonly string[] | null | undefined,
): Permission[] {
  if (role === Role.SUPER_ADMIN) return [...ALL_PERMISSIONS];
  if (role === Role.ADMIN) return (staffRolePermissions ?? []).filter(isPermission);
  return [];
}

/** Built-in staff roles created by the seeder (editable afterwards). */
export const DEFAULT_STAFF_ROLES: ReadonlyArray<{
  name: string;
  description: string;
  permissions: readonly Permission[];
}> = [
  {
    name: 'Store manager',
    description: 'Runs day-to-day operations: everything except store settings.',
    permissions: ALL_PERMISSIONS.filter((key) => key !== 'settings.manage'),
  },
  {
    name: 'Order manager',
    description: 'Fulfils orders, handles returns and answers customers.',
    permissions: [
      'analytics.view',
      'orders.view',
      'orders.manage',
      'payments.manage',
      'returns.manage',
      'customers.view',
      'tickets.manage',
    ],
  },
  {
    name: 'Catalog editor',
    description: 'Keeps products, coupons and banners up to date.',
    permissions: [
      'catalog.manage',
      'coupons.manage',
      'campaigns.manage',
      'banners.manage',
      'reviews.moderate',
    ],
  },
];
