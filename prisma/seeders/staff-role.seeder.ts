import { Role, type PrismaClient } from '@prisma/client';
import { DEFAULT_STAFF_ROLES } from '../../src/access/permissions';
import { Seeder } from './seeder.interface';

/**
 * Creates the built-in staff roles (idempotent, by name) and gives every
 * ADMIN account without a role the broadest one, so admins keep working.
 * Runs after UserSeeder.
 */
export class StaffRoleSeeder implements Seeder {
  readonly name = 'StaffRoleSeeder';
  readonly description = 'Built-in staff roles; admins default to “Store manager”';

  async seed(prisma: PrismaClient): Promise<void> {
    for (const role of DEFAULT_STAFF_ROLES) {
      await prisma.staffRole.upsert({
        where: { name: role.name },
        // Existing roles keep any edits the owner made.
        update: {},
        create: {
          name: role.name,
          description: role.description,
          permissions: [...role.permissions],
        },
      });
    }

    const storeManager = await prisma.staffRole.findUniqueOrThrow({
      where: { name: 'Store manager' },
      select: { id: true },
    });
    const { count } = await prisma.user.updateMany({
      where: { role: Role.ADMIN, staffRoleId: null },
      data: { staffRoleId: storeManager.id },
    });

    console.log(
      `✅ ${DEFAULT_STAFF_ROLES.length} staff roles ensured; ${count} admin(s) assigned “Store manager”.`,
    );
  }
}
