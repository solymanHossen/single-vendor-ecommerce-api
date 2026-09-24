import { ApiProperty } from '@nestjs/swagger';

interface AddressEntityInput {
  id: number;
  userId: number;
  recipientName: string | null;
  phone: string | null;
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

  @ApiProperty({ nullable: true, example: 'Nusrat Jahan' })
  recipientName: string | null;

  @ApiProperty({ nullable: true, example: '01712345678' })
  phone: string | null;

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
    this.recipientName = partial.recipientName;
    this.phone = partial.phone;
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
