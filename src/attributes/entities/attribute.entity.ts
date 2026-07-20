import { ApiProperty } from '@nestjs/swagger';

export class AttributeOptionEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 3 })
  attributeId: number;

  @ApiProperty({ example: 'Red' })
  value: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: AttributeOptionEntity) {
    this.id = partial.id;
    this.attributeId = partial.attributeId;
    this.value = partial.value;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}

interface AttributeEntityInput {
  id: number;
  name: string;
  options: AttributeOptionEntity[];
  createdAt: Date;
  updatedAt: Date;
}

export class AttributeEntity {
  @ApiProperty({ example: 3 })
  id: number;

  @ApiProperty({ example: 'Color' })
  name: string;

  @ApiProperty({ type: () => AttributeOptionEntity, isArray: true })
  options: AttributeOptionEntity[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: AttributeEntityInput) {
    this.id = partial.id;
    this.name = partial.name;
    this.options = partial.options;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}
