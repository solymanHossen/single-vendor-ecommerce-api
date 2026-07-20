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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CategoriesService } from './categories.service';
import { CreateCategorySchema, type CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategorySchema, type UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryEntity, CategoryTreeNodeEntity } from './entities/category.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Retrieve the full category hierarchy as a nested tree' })
  @ApiResponse({ status: HttpStatus.OK, type: CategoryTreeNodeEntity, isArray: true })
  async findAll(): Promise<{ message: string; data: CategoryTreeNodeEntity[] }> {
    const tree = await this.categoriesService.findTree();
    return { message: 'Categories retrieved successfully', data: tree };
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Retrieve a single category with its parent, children, and product count',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: CategoryEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Category does not exist' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: CategoryEntity }> {
    const category = await this.categoriesService.findOne(id);
    return { message: 'Category retrieved successfully', data: category };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new category' })
  @ApiBody({ schema: z.toJSONSchema(CreateCategorySchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: CategoryEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Slug already exists' })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'parentId references a category that does not exist',
  })
  async create(
    @Body(new ZodValidationPipe(CreateCategorySchema)) dto: CreateCategoryDto,
  ): Promise<{ message: string; data: CategoryEntity }> {
    const category = await this.categoriesService.create(dto);
    return { message: 'Category created successfully', data: category };
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an existing category' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: z.toJSONSchema(UpdateCategorySchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: CategoryEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Category does not exist' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Slug already exists' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateCategorySchema)) dto: UpdateCategoryDto,
  ): Promise<{ message: string; data: CategoryEntity }> {
    const category = await this.categoriesService.update(id, dto);
    return { message: 'Category updated successfully', data: category };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a category' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Category deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Category does not exist' })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Category still has products or child categories',
  })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string; data: null }> {
    await this.categoriesService.remove(id);
    return { message: 'Category deleted successfully', data: null };
  }
}
