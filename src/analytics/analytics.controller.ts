import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AnalyticsService } from './analytics.service';
import { AnalyticsDashboardEntity } from './entities/analytics.entity';
import {
  ANALYTICS_RANGES,
  AnalyticsQuerySchema,
  type AnalyticsQueryDto,
} from './dto/analytics-query.dto';

@ApiTags('Admin Analytics')
@ApiBearerAuth()
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Admin dashboard analytics',
    description:
      'KPIs vs the previous period, daily revenue/orders (Asia/Dhaka days), order status ' +
      'and payment mix, top products, recent orders, review insight, operations queue and low stock.',
  })
  @ApiQuery({ name: 'range', required: false, enum: ANALYTICS_RANGES, description: 'Days' })
  @ApiResponse({ status: HttpStatus.OK, type: AnalyticsDashboardEntity })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admins only' })
  async getDashboard(
    @Query(new ZodValidationPipe(AnalyticsQuerySchema)) query: AnalyticsQueryDto,
  ): Promise<{ message: string; data: AnalyticsDashboardEntity }> {
    const data = await this.analyticsService.getDashboard(query.range);
    return { message: 'Analytics retrieved successfully', data };
  }
}
