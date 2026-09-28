import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateStaffRoleSchema,
  UpdateStaffRoleSchema,
  type CreateStaffRoleDto,
  type UpdateStaffRoleDto,
} from './dto/staff-role.dto';
import { PermissionGroupEntity, StaffRoleEntity } from './entities/staff-role.entity';
import { StaffRolesService } from './staff-roles.service';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];
const bodySchema = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as unknown as ApiBodySchema;

@ApiTags('Admin · Staff roles')
@ApiBearerAuth()
// SUPER_ADMIN only — never a grantable permission, or a staff member could
// edit their own role into full access.
@Roles(Role.SUPER_ADMIN)
@Controller('admin/roles')
export class StaffRolesController {
  constructor(private readonly staffRolesService: StaffRolesService) {}

  @Get('permissions')
  @ApiOperation({ summary: 'Every permission a staff role can grant, grouped for display' })
  @ApiResponse({ status: HttpStatus.OK, type: PermissionGroupEntity, isArray: true })
  permissions(): { message: string; data: PermissionGroupEntity[] } {
    return {
      message: 'Permissions retrieved successfully',
      data: this.staffRolesService.permissionCatalog(),
    };
  }

  @Get()
  @ApiOperation({ summary: 'List staff roles with member counts' })
  @ApiResponse({ status: HttpStatus.OK, type: StaffRoleEntity, isArray: true })
  async findAll(): Promise<{ message: string; data: StaffRoleEntity[] }> {
    return {
      message: 'Roles retrieved successfully',
      data: await this.staffRolesService.findAll(),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a staff role' })
  @ApiBody({ schema: bodySchema(CreateStaffRoleSchema) })
  @ApiResponse({ status: HttpStatus.CREATED, type: StaffRoleEntity })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'A role with this name exists' })
  async create(
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
    @Body(new ZodValidationPipe(CreateStaffRoleSchema)) dto: CreateStaffRoleDto,
  ): Promise<{ message: string; data: StaffRoleEntity }> {
    const data = await this.staffRolesService.create(dto, { actor, ip });
    return { message: 'Role created successfully', data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a staff role or change its permissions (applies immediately)' })
  @ApiBody({ schema: bodySchema(UpdateStaffRoleSchema) })
  @ApiResponse({ status: HttpStatus.OK, type: StaffRoleEntity })
  async update(
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateStaffRoleSchema)) dto: UpdateStaffRoleDto,
  ): Promise<{ message: string; data: StaffRoleEntity }> {
    const data = await this.staffRolesService.update(id, dto, { actor, ip });
    return { message: 'Role updated successfully', data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a staff role that nobody is using' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'The role still has members' })
  async remove(
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: null }> {
    await this.staffRolesService.remove(id, { actor, ip });
    return { message: 'Role deleted successfully', data: null };
  }
}
