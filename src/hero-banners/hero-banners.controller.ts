import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { HeroBannersService } from './hero-banners.service';
import { CreateHeroBannerSchema, type CreateHeroBannerDto } from './dto/create-hero-banner.dto';
import { UpdateHeroBannerSchema, type UpdateHeroBannerDto } from './dto/update-hero-banner.dto';
import { QueryHeroBannerSchema, type QueryHeroBannerDto } from './dto/query-hero-banner.dto';
import {
  ReorderHeroBannersSchema,
  type ReorderHeroBannersDto,
} from './dto/reorder-hero-banners.dto';
import { HeroBannerEntity } from './entities/hero-banner.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Hero Banners')
@Controller('hero-banners')
export class HeroBannersController {
  constructor(private readonly heroBannersService: HeroBannersService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List active hero banners for the storefront' })
  @ApiQuery({ name: 'placement', enum: ['MAIN', 'SIDE'], required: false })
  @ApiResponse({ status: HttpStatus.OK, type: HeroBannerEntity, isArray: true })
  async findAll(
    @Query(new ZodValidationPipe(QueryHeroBannerSchema)) query: QueryHeroBannerDto,
  ): Promise<{ message: string; data: HeroBannerEntity[] }> {
    const banners = await this.heroBannersService.findPublic(query.placement);
    return { message: 'Hero banners retrieved successfully', data: banners };
  }

  // Declared before ':id' — a static segment after a dynamic one would never
  // be reached, since Nest matches routes in declaration order and ':id'
  // would swallow "admin" as its param value first.
  @Get('admin')
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List every hero banner (active and inactive) for admin management' })
  @ApiResponse({ status: HttpStatus.OK, type: HeroBannerEntity, isArray: true })
  async findAllForAdmin(): Promise<{ message: string; data: HeroBannerEntity[] }> {
    const banners = await this.heroBannersService.findAllForAdmin();
    return { message: 'Hero banners retrieved successfully', data: banners };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new hero banner' })
  @ApiBody({ schema: z.toJSONSchema(CreateHeroBannerSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: HeroBannerEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  async create(
    @Body(new ZodValidationPipe(CreateHeroBannerSchema)) dto: CreateHeroBannerDto,
  ): Promise<{ message: string; data: HeroBannerEntity }> {
    const banner = await this.heroBannersService.create(dto);
    return { message: 'Hero banner created successfully', data: banner };
  }

  // Declared before ':id' — same reasoning as 'admin' above.
  @Patch('reorder')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Bulk-update display order for a set of hero banners' })
  @ApiBody({ schema: z.toJSONSchema(ReorderHeroBannersSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, description: 'Order updated successfully' })
  async reorder(
    @Body(new ZodValidationPipe(ReorderHeroBannersSchema)) dto: ReorderHeroBannersDto,
  ): Promise<{ message: string; data: null }> {
    await this.heroBannersService.reorder(dto);
    return { message: 'Hero banner order updated successfully', data: null };
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an existing hero banner' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: z.toJSONSchema(UpdateHeroBannerSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: HeroBannerEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Hero banner does not exist' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateHeroBannerSchema)) dto: UpdateHeroBannerDto,
  ): Promise<{ message: string; data: HeroBannerEntity }> {
    const banner = await this.heroBannersService.update(id, dto);
    return { message: 'Hero banner updated successfully', data: banner };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a hero banner and its uploaded image' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Hero banner deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Hero banner does not exist' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string; data: null }> {
    await this.heroBannersService.remove(id);
    return { message: 'Hero banner deleted successfully', data: null };
  }
}
