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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminUsersService } from './admin-users.service';
import {
  AdminUserQuerySchema,
  UpdateUserAccessSchema,
  UpdateUserStatusSchema,
  type AdminUserQueryDto,
  type UpdateUserAccessDto,
  type UpdateUserStatusDto,
} from './dto/admin-users.dto';
import { AdminUserDetailEntity, PaginatedAdminUsersEntity } from './entities/admin-user.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];
const bodySchema = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as unknown as ApiBodySchema;

type Detail = Promise<{ message: string; data: AdminUserDetailEntity }>;

@ApiTags('Admin · Users')
@ApiBearerAuth()
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @RequirePermissions('customers.view')
  @ApiOperation({
    summary: 'Search accounts — customers, plus staff for a SUPER_ADMIN',
    description: 'Counts honour the search but not the type/status filters (for tabs).',
  })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedAdminUsersEntity })
  async findAll(
    @CurrentUser() actor: AuthUser,
    @Query(new ZodValidationPipe(AdminUserQuerySchema)) query: AdminUserQueryDto,
  ): Promise<{ message: string; data: PaginatedAdminUsersEntity }> {
    const data = await this.adminUsersService.findAll(actor, query);
    return { message: 'Users retrieved successfully', data };
  }

  @Get(':id')
  @RequirePermissions('customers.view')
  @ApiOperation({ summary: 'One account with its sessions and order stats' })
  @ApiResponse({ status: HttpStatus.OK, type: AdminUserDetailEntity })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No such user (or a staff account you cannot see)',
  })
  async findOne(@CurrentUser() actor: AuthUser, @Param('id', ParseIntPipe) id: number): Detail {
    return {
      message: 'User retrieved successfully',
      data: await this.adminUsersService.findOne(actor, id),
    };
  }

  @Patch(':id/status')
  @RequirePermissions('customers.manage')
  @ApiOperation({ summary: 'Deactivate (signs out everywhere) or reactivate an account' })
  @ApiBody({ schema: bodySchema(UpdateUserStatusSchema) })
  @ApiResponse({ status: HttpStatus.OK, type: AdminUserDetailEntity })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Your own account, or a super admin' })
  async setStatus(
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateUserStatusSchema)) dto: UpdateUserStatusDto,
  ): Detail {
    const data = await this.adminUsersService.setStatus(id, dto, { actor, ip });
    return { message: dto.isActive ? 'Account reactivated' : 'Account deactivated', data };
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('customers.manage')
  @ApiOperation({ summary: 'Clear a sign-in lockout caused by failed attempts' })
  @ApiResponse({ status: HttpStatus.OK, type: AdminUserDetailEntity })
  async unlock(
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
    @Param('id', ParseIntPipe) id: number,
  ): Detail {
    return {
      message: 'Account unlocked',
      data: await this.adminUsersService.unlock(id, { actor, ip }),
    };
  }

  @Post(':id/sessions/revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('customers.manage')
  @ApiOperation({ summary: 'Sign the account out of every device' })
  @ApiResponse({ status: HttpStatus.OK, type: AdminUserDetailEntity })
  async revokeSessions(
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
    @Param('id', ParseIntPipe) id: number,
  ): Detail {
    const data = await this.adminUsersService.revokeSessions(id, { actor, ip });
    return { message: 'Signed out of all devices', data };
  }

  @Delete(':id/sessions/:sessionId')
  @RequirePermissions('customers.manage')
  @ApiOperation({ summary: 'End one session' })
  @ApiResponse({ status: HttpStatus.OK, type: AdminUserDetailEntity })
  async revokeSession(
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ): Detail {
    const data = await this.adminUsersService.revokeSession(id, sessionId, { actor, ip });
    return { message: 'Session ended', data };
  }

  @Patch(':id/access')
  // Never a grantable permission — that would let staff promote themselves.
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Make an account staff (with a role) or a customer again' })
  @ApiBody({ schema: bodySchema(UpdateUserAccessSchema) })
  @ApiResponse({ status: HttpStatus.OK, type: AdminUserDetailEntity })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Your own account, or a super admin' })
  async setAccess(
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateUserAccessSchema)) dto: UpdateUserAccessDto,
  ): Detail {
    return {
      message: 'Access updated',
      data: await this.adminUsersService.setAccess(id, dto, { actor, ip }),
    };
  }
}
