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
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AddressesService } from './addresses.service';
import { CreateAddressSchema, type CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressSchema, type UpdateAddressDto } from './dto/update-address.dto';
import { AddressEntity } from './entities/address.entity';

type ApiBodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>['schema'];

@ApiTags('Addresses')
@ApiBearerAuth()
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's addresses" })
  @ApiResponse({ status: HttpStatus.OK, type: AddressEntity, isArray: true })
  async findAll(
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string; data: AddressEntity[] }> {
    const addresses = await this.addressesService.findAll(user.id);
    return { message: 'Addresses retrieved successfully', data: addresses };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a single address owned by the current user' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: AddressEntity })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Address does not exist' })
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: AddressEntity }> {
    const address = await this.addressesService.findOne(user.id, id);
    return { message: 'Address retrieved successfully', data: address };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new address for the current user' })
  @ApiBody({ schema: z.toJSONSchema(CreateAddressSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.CREATED, type: AddressEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateAddressSchema)) dto: CreateAddressDto,
  ): Promise<{ message: string; data: AddressEntity }> {
    const address = await this.addressesService.create(user.id, dto);
    return { message: 'Address created successfully', data: address };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an address owned by the current user' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: z.toJSONSchema(UpdateAddressSchema) as unknown as ApiBodySchema })
  @ApiResponse({ status: HttpStatus.OK, type: AddressEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Address does not exist' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateAddressSchema)) dto: UpdateAddressDto,
  ): Promise<{ message: string; data: AddressEntity }> {
    const address = await this.addressesService.update(user.id, id, dto);
    return { message: 'Address updated successfully', data: address };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an address owned by the current user' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Address deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Address does not exist' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; data: null }> {
    await this.addressesService.remove(user.id, id);
    return { message: 'Address deleted successfully', data: null };
  }
}
