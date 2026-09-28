import { Module } from '@nestjs/common';
import { StaffRolesController } from './staff-roles.controller';
import { StaffRolesService } from './staff-roles.service';

@Module({
  controllers: [StaffRolesController],
  providers: [StaffRolesService],
})
export class StaffRolesModule {}
