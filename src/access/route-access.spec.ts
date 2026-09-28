import 'reflect-metadata';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { PERMISSIONS_KEY } from './require-permissions.decorator';
import { AdminUsersController } from '../admin-users/admin-users.controller';
import { StaffRolesController } from '../staff-roles/staff-roles.controller';
import { AuditController } from '../audit/audit.controller';
import { SettingsController } from '../settings/settings.controller';
import { OrdersController } from '../orders/orders.controller';
import { AnalyticsController } from '../analytics/analytics.controller';
import { AdminProductsController } from '../products/admin-products.controller';

/**
 * Pins what each sensitive route requires, so a refactor can't silently
 * loosen access. Update deliberately when access rules change.
 */
type Controller = { prototype: object };

const handler = (controller: Controller, method: string): object => {
  const fn = (controller.prototype as Record<string, object | undefined>)[method];
  if (!fn) throw new Error(`No method ${method}`);
  return fn;
};
const permissionsOf = (controller: Controller, method: string): unknown =>
  Reflect.getMetadata(PERMISSIONS_KEY, handler(controller, method)) ??
  Reflect.getMetadata(PERMISSIONS_KEY, controller);
const rolesOf = (controller: Controller, method?: string): unknown =>
  (method ? Reflect.getMetadata(ROLES_KEY, handler(controller, method)) : undefined) ??
  Reflect.getMetadata(ROLES_KEY, controller);

describe('route access', () => {
  it.each([
    [AdminUsersController, 'findAll', ['customers.view']],
    [AdminUsersController, 'findOne', ['customers.view']],
    [AdminUsersController, 'setStatus', ['customers.manage']],
    [AdminUsersController, 'unlock', ['customers.manage']],
    [AdminUsersController, 'revokeSessions', ['customers.manage']],
    [AdminUsersController, 'revokeSession', ['customers.manage']],
    [SettingsController, 'updateSettings', ['settings.manage']],
    [OrdersController, 'updateStatus', ['orders.manage']],
    [AnalyticsController, 'getDashboard', ['analytics.view']],
    [AdminProductsController, 'findAll', ['catalog.manage']],
  ] as const)('%p.%s needs %j', (controller, method, expected) => {
    expect(permissionsOf(controller as unknown as Controller, method)).toEqual(expected);
  });

  it.each([
    [AdminUsersController, 'setAccess'],
    [StaffRolesController, undefined],
    [AuditController, undefined],
  ] as const)('%p.%s is super-admin only', (controller, method) => {
    expect(rolesOf(controller as unknown as Controller, method)).toEqual([Role.SUPER_ADMIN]);
  });

  it('leaves the public settings read public', () => {
    expect(
      permissionsOf(SettingsController as unknown as Controller, 'getPublicSettings'),
    ).toBeUndefined();
  });
});
