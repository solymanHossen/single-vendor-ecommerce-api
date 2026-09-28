import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuditService } from './audit.service';
import { AuditQuerySchema, type AuditQueryDto } from './dto/audit-query.dto';
import { PaginatedAuditLogsEntity } from './entities/audit-log.entity';

@ApiTags('Admin · Audit log')
@ApiBearerAuth()
// Deliberately not a grantable permission: the trail of access changes is
// for the store owner, not for the staff whose changes it records.
@Roles(Role.SUPER_ADMIN)
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Security-relevant admin activity, newest first' })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedAuditLogsEntity })
  async findAll(
    @Query(new ZodValidationPipe(AuditQuerySchema)) query: AuditQueryDto,
  ): Promise<{ message: string; data: PaginatedAuditLogsEntity }> {
    const data = await this.auditService.findAll(query);
    return { message: 'Audit log retrieved successfully', data };
  }
}
