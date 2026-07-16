import { PrismaClient } from '@prisma/client';
import { Seeder } from './seeder.interface';

export class AppSettingSeeder implements Seeder {
  readonly name = 'AppSettingSeeder';

  async seed(prisma: PrismaClient): Promise<void> {
    console.log('🔧 Upserting AppSetting singleton row...');

    await prisma.appSetting.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        allowRegistration: true,
        enableGoogleLogin: true,
      },
    });

    console.log('✅ AppSetting row ensured (id=1, all flags enabled).');
  }
}
