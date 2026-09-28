import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SettingsService } from './settings.service';
import { SettingsEntity } from './entities/settings.entity';
import { UpdateSettingsSchema, type UpdateSettingsDto } from './dto/update-settings.dto';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public')
  @Public()
  @ApiOperation({
    summary: 'Store settings for the storefront (branding, contact, shipping, announcement, SEO)',
    description: 'No secrets live here, so anyone may read it. Cached; write-through on update.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: SettingsEntity })
  async getPublicSettings(): Promise<{ message: string; data: SettingsEntity }> {
    const settings = await this.settingsService.getSettings();
    return { message: 'Settings retrieved successfully', data: new SettingsEntity(settings) };
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Retrieve every store setting (admin console)' })
  @ApiResponse({ status: HttpStatus.OK, type: SettingsEntity })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  async getSettings(): Promise<{ message: string; data: SettingsEntity }> {
    const settings = await this.settingsService.getSettings();
    return { message: 'Settings retrieved successfully', data: new SettingsEntity(settings) };
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  // Only SUPER_ADMIN — these settings change the whole storefront (brand,
  // checkout pricing) and gate account creation and OAuth sign-in: a
  // materially higher blast radius than routine ADMIN actions.
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update any subset of store settings' })
  @ApiBody({
    // Input shape: the empty-string → null transforms have no JSON Schema form.
    schema: z.toJSONSchema(UpdateSettingsSchema, {
      io: 'input',
      unrepresentable: 'any',
    }) as unknown as ApiBodySchema,
  })
  @ApiResponse({ status: HttpStatus.OK, type: SettingsEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  async updateSettings(
    @Body(new ZodValidationPipe(UpdateSettingsSchema)) dto: UpdateSettingsDto,
  ): Promise<{ message: string; data: SettingsEntity }> {
    const settings = await this.settingsService.updateSettings(dto);
    return { message: 'Settings updated successfully', data: new SettingsEntity(settings) };
  }
}
