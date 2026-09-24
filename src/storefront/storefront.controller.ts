import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { StorefrontService } from './storefront.service';
import { NavigationEntity } from './entities/navigation.entity';

@ApiTags('Storefront')
@Controller('storefront')
export class StorefrontController {
  constructor(private readonly storefrontService: StorefrontService) {}

  @Get('navigation')
  @Public()
  @ApiOperation({
    summary: 'Storefront header navigation',
    description:
      'Category tree with live product counts, curated collections, spotlight deal, ' +
      'trending products and the current promotion — cached for 5 minutes.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: NavigationEntity })
  async getNavigation(): Promise<{ message: string; data: NavigationEntity }> {
    const navigation = await this.storefrontService.getNavigation();
    return { message: 'Navigation retrieved successfully', data: navigation };
  }
}
