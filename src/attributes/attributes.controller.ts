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
import { AttributesService } from './attributes.service';
import { CreateAttributeSchema, type CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeSchema, type UpdateAttributeDto } from './dto/update-attribute.dto';
import {
  CreateAttributeOptionSchema,
  type CreateAttributeOptionDto,
} from './dto/create-attribute-option.dto';
import {
  UpdateAttributeOptionSchema,
  type UpdateAttributeOptionDto,
} from './dto/update-attribute-option.dto';
import { AttributeEntity, AttributeOptionEntity } from './entities/attribute.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Attributes')
@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all attributes with their options' })
  @ApiResponse({ status: HttpStatus.OK, type: AttributeEntity, isArray: true })
  async findAll(): Promise<{ message: string; data: AttributeEntity[] }> {
    const attributes = await this.attributesService.findAll();
    return { message: 'Attributes retrieved successfully', data: attributes };
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Retrieve a single attribute with its options' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: AttributeEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Attribute does not exist' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: AttributeEntity }> {
    const attribute = await this.attributesService.findOne(id);
    return { message: 'Attribute retrieved successfully', data: attribute };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new attribute' })
  @ApiBody({ schema: z.toJSONSchema(CreateAttributeSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: AttributeEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  async create(
    @Body(new ZodValidationPipe(CreateAttributeSchema)) dto: CreateAttributeDto,
  ): Promise<{ message: string; data: AttributeEntity }> {
    const attribute = await this.attributesService.create(dto);
    return { message: 'Attribute created successfully', data: attribute };
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an existing attribute' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: z.toJSONSchema(UpdateAttributeSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: AttributeEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Attribute does not exist' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateAttributeSchema)) dto: UpdateAttributeDto,
  ): Promise<{ message: string; data: AttributeEntity }> {
    const attribute = await this.attributesService.update(id, dto);
    return { message: 'Attribute updated successfully', data: attribute };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete an attribute' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Attribute deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Attribute does not exist' })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Attribute has an option still assigned to a product variant',
  })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string; data: null }> {
    await this.attributesService.remove(id);
    return { message: 'Attribute deleted successfully', data: null };
  }

  @Post(':id/options')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Add a new option to an attribute' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: z.toJSONSchema(CreateAttributeOptionSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: AttributeOptionEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Value already exists on this attribute',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'id references an attribute that does not exist',
  })
  async addOption(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(CreateAttributeOptionSchema)) dto: CreateAttributeOptionDto,
  ): Promise<{ message: string; data: AttributeOptionEntity }> {
    const option = await this.attributesService.addOption(id, dto);
    return { message: 'Attribute option created successfully', data: option };
  }

  @Patch(':id/options/:optionId')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an attribute option' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'optionId', type: Number })
  @ApiBody({ schema: z.toJSONSchema(UpdateAttributeOptionSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: AttributeOptionEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Option does not exist for the given attribute',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Value already exists on this attribute',
  })
  async updateOption(
    @Param('id', ParseIntPipe) id: number,
    @Param('optionId', ParseIntPipe) optionId: number,
    @Body(new ZodValidationPipe(UpdateAttributeOptionSchema)) dto: UpdateAttributeOptionDto,
  ): Promise<{ message: string; data: AttributeOptionEntity }> {
    const option = await this.attributesService.updateOption(id, optionId, dto);
    return { message: 'Attribute option updated successfully', data: option };
  }

  @Delete(':id/options/:optionId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete an attribute option' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'optionId', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Attribute option deleted successfully' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Option does not exist for the given attribute',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Option is still assigned to a product variant',
  })
  async removeOption(
    @Param('id', ParseIntPipe) id: number,
    @Param('optionId', ParseIntPipe) optionId: number,
  ): Promise<{ message: string; data: null }> {
    await this.attributesService.removeOption(id, optionId);
    return { message: 'Attribute option deleted successfully', data: null };
  }
}
