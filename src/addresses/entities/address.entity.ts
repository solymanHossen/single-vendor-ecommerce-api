import { ApiProperty } from '@nestjs/swagger';

interface AddressEntityInput {
  id: number;
  userId: number;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class AddressEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ example: '123 Main St' })
  addressLine1: string;

  @ApiProperty({ nullable: true, example: 'Apt 4B' })
  addressLine2: string | null;

  @ApiProperty({ example: 'Springfield' })
  city: string;

  @ApiProperty({ example: 'IL' })
  state: string;

  @ApiProperty({ example: '62704' })
  postalCode: string;

  @ApiProperty({ example: 'USA' })
  country: string;

  @ApiProperty({ example: true })
  isDefault: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: AddressEntityInput) {
    this.id = partial.id;
    this.userId = partial.userId;
    this.addressLine1 = partial.addressLine1;
    this.addressLine2 = partial.addressLine2;
    this.city = partial.city;
    this.state = partial.state;
    this.postalCode = partial.postalCode;
    this.country = partial.country;
    this.isDefault = partial.isDefault;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}
