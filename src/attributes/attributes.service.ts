import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { CreateAttributeOptionDto } from './dto/create-attribute-option.dto';
import { UpdateAttributeOptionDto } from './dto/update-attribute-option.dto';
import { AttributeEntity, AttributeOptionEntity } from './entities/attribute.entity';

const ATTRIBUTE_OPTION_SELECT = {
  id: true,
  attributeId: true,
  value: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AttributeOptionSelect;

const ATTRIBUTE_SELECT = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  options: { select: ATTRIBUTE_OPTION_SELECT, orderBy: { value: 'asc' } },
} satisfies Prisma.AttributeSelect;

type AttributeRow = Prisma.AttributeGetPayload<{ select: typeof ATTRIBUTE_SELECT }>;
type AttributeOptionRow = Prisma.AttributeOptionGetPayload<{
  select: typeof ATTRIBUTE_OPTION_SELECT;
}>;

@Injectable()
export class AttributesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<AttributeEntity[]> {
    const rows = await this.prisma.attribute.findMany({
      select: ATTRIBUTE_SELECT,
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => this.toEntity(row));
  }

  async findOne(id: number): Promise<AttributeEntity> {
    const attribute = await this.prisma.attribute.findUniqueOrThrow({
      where: { id },
      select: ATTRIBUTE_SELECT,
    });

    return this.toEntity(attribute);
  }

  async create(dto: CreateAttributeDto): Promise<AttributeEntity> {
    const attribute = await this.prisma.attribute.create({
      data: dto,
      select: ATTRIBUTE_SELECT,
    });

    return this.toEntity(attribute);
  }

  async update(id: number, dto: UpdateAttributeDto): Promise<AttributeEntity> {
    const attribute = await this.prisma.attribute.update({
      where: { id },
      data: dto,
      select: ATTRIBUTE_SELECT,
    });

    return this.toEntity(attribute);
  }

  async remove(id: number): Promise<void> {
    // AttributeOption.attributeId cascades on delete, so removing an attribute
    // cleans up its options in the same operation. If any of those options are
    // still referenced by a VariantOption, the cascade itself hits that
    // restrict-by-default foreign key and the whole delete fails with a 422
    // (translated by PrismaClientExceptionFilter) — no manual "in use?" guard needed.
    await this.prisma.attribute.delete({ where: { id } });
  }

  async addOption(
    attributeId: number,
    dto: CreateAttributeOptionDto,
  ): Promise<AttributeOptionEntity> {
    // attributeId is a plain scalar assignment (not a nested `connect`), so an
    // attributeId that doesn't exist fails the FK constraint at the database
    // level (P2003 → 422) rather than needing a manual existence check here.
    const option = await this.prisma.attributeOption.create({
      data: { attributeId, value: dto.value },
      select: ATTRIBUTE_OPTION_SELECT,
    });

    return this.toOptionEntity(option);
  }

  async updateOption(
    attributeId: number,
    optionId: number,
    dto: UpdateAttributeOptionDto,
  ): Promise<AttributeOptionEntity> {
    // Scoped by both id and attributeId so a mismatched parent id in the URL
    // (e.g. an option that belongs to a different attribute) is rejected
    // instead of silently updating the wrong attribute's option.
    const result = await this.prisma.attributeOption.updateMany({
      where: { id: optionId, attributeId },
      data: dto,
    });

    if (result.count === 0) {
      throw new NotFoundException('Attribute option does not exist for the given attribute.');
    }

    const option = await this.prisma.attributeOption.findUniqueOrThrow({
      where: { id: optionId },
      select: ATTRIBUTE_OPTION_SELECT,
    });

    return this.toOptionEntity(option);
  }

  async removeOption(attributeId: number, optionId: number): Promise<void> {
    // VariantOption.attributeOptionId has no cascade, so deleting an option
    // still assigned to a product variant fails at the database level (422)
    // — no manual "in use?" guard needed, matching Category's removal posture.
    const result = await this.prisma.attributeOption.deleteMany({
      where: { id: optionId, attributeId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Attribute option does not exist for the given attribute.');
    }
  }

  private toEntity(attribute: AttributeRow): AttributeEntity {
    return new AttributeEntity({
      id: attribute.id,
      name: attribute.name,
      options: attribute.options.map((option) => this.toOptionEntity(option)),
      createdAt: attribute.createdAt,
      updatedAt: attribute.updatedAt,
    });
  }

  private toOptionEntity(option: AttributeOptionRow): AttributeOptionEntity {
    return new AttributeOptionEntity({
      id: option.id,
      attributeId: option.attributeId,
      value: option.value,
      createdAt: option.createdAt,
      updatedAt: option.updatedAt,
    });
  }
}
