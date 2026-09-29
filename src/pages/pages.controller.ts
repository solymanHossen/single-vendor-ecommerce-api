import { Controller, Get, Param, Put, Body, UseGuards } from '@nestjs/common';
import { PagesService } from './pages.service';
import { UpdatePageDto } from './dto/update-page.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Public()
  @Get()
  findAll() {
    return this.pagesService.findAll();
  }

  @Public()
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.pagesService.findOne(slug);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('settings.manage')
@Controller('admin/pages')
export class AdminPagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  findAll() {
    return this.pagesService.findAllAdmin();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pagesService.findOneById(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updatePageDto: UpdatePageDto) {
    return this.pagesService.update(+id, updatePageDto);
  }
}
