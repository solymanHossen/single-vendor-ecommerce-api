import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AddressEntity } from './entities/address.entity';

const ADDRESS_SELECT = {
  id: true,
  userId: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AddressSelect;

type AddressRow = Prisma.AddressGetPayload<{ select: typeof ADDRESS_SELECT }>;

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: number): Promise<AddressEntity[]> {
    const rows = await this.prisma.address.findMany({
      where: { userId },
      select: ADDRESS_SELECT,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return rows.map((row) => this.toEntity(row));
  }

  async findOne(userId: number, id: number): Promise<AddressEntity> {
    const address = await this.prisma.address.findFirst({
      where: { id, userId },
      select: ADDRESS_SELECT,
    });

    if (!address) {
      throw new NotFoundException('Address does not exist for the current user.');
    }

    return this.toEntity(address);
  }

  async create(userId: number, dto: CreateAddressDto): Promise<AddressEntity> {
    if (!dto.isDefault) {
      const address = await this.prisma.address.create({
        data: { ...dto, userId },
        select: ADDRESS_SELECT,
      });
      return this.toEntity(address);
    }

    // Clearing every other default and creating this one must be atomic —
    // a failure between the two steps would otherwise leave the user with
    // either zero or two default addresses.
    const [, address] = await this.prisma.$transaction([
      this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.address.create({ data: { ...dto, userId }, select: ADDRESS_SELECT }),
    ]);

    return this.toEntity(address);
  }

  async update(userId: number, id: number, dto: UpdateAddressDto): Promise<AddressEntity> {
    let result: Prisma.BatchPayload;

    if (dto.isDefault === true) {
      // Same atomicity requirement as create(): clear every other default for
      // this user and apply the update in a single transaction.
      const [, updateResult] = await this.prisma.$transaction([
        this.prisma.address.updateMany({
          where: { userId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        }),
        this.prisma.address.updateMany({ where: { id, userId }, data: dto }),
      ]);
      result = updateResult;
    } else {
      // Scoped by both id and userId so a mismatched owner (someone else's
      // address id) is rejected instead of silently updating it.
      result = await this.prisma.address.updateMany({ where: { id, userId }, data: dto });
    }

    if (result.count === 0) {
      throw new NotFoundException('Address does not exist for the current user.');
    }

    const address = await this.prisma.address.findUniqueOrThrow({
      where: { id },
      select: ADDRESS_SELECT,
    });

    return this.toEntity(address);
  }

  async remove(userId: number, id: number): Promise<void> {
    const result = await this.prisma.address.deleteMany({ where: { id, userId } });

    if (result.count === 0) {
      throw new NotFoundException('Address does not exist for the current user.');
    }
  }

  private toEntity(address: AddressRow): AddressEntity {
    return new AddressEntity({
      id: address.id,
      userId: address.userId,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      isDefault: address.isDefault,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    });
  }
}
