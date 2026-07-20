import { ApiProperty } from '@nestjs/swagger';

export class CategorySummaryEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Smartphones' })
  name: string;

  @ApiProperty({ example: 'smartphones' })
  slug: string;

  @ApiProperty({ example: 'https://cdn.example.com/icons/phones.svg', nullable: true })
  iconUrl: string | null;

  constructor(partial: CategorySummaryEntity) {
    this.id = partial.id;
    this.name = partial.name;
    this.slug = partial.slug;
    this.iconUrl = partial.iconUrl;
  }
}

interface CategoryEntityInput {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  iconUrl: string | null;
  metaTitle: string | null;
  metaDesc: string | null;
  productCount: number;
  parent: CategorySummaryEntity | null;
  children: CategorySummaryEntity[];
  createdAt: Date;
  updatedAt: Date;
}

export class CategoryEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Smartphones' })
  name: string;

  @ApiProperty({ example: 'smartphones' })
  slug: string;

  @ApiProperty({ example: 2, nullable: true })
  parentId: number | null;

  @ApiProperty({ example: 'https://cdn.example.com/icons/phones.svg', nullable: true })
  iconUrl: string | null;

  @ApiProperty({ nullable: true })
  metaTitle: string | null;

  @ApiProperty({ nullable: true })
  metaDesc: string | null;

  @ApiProperty({ example: 12, description: 'Number of products assigned to this category' })
  productCount: number;

  @ApiProperty({ type: () => CategorySummaryEntity, nullable: true })
  parent: CategorySummaryEntity | null;

  @ApiProperty({ type: () => CategorySummaryEntity, isArray: true })
  children: CategorySummaryEntity[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: CategoryEntityInput) {
    this.id = partial.id;
    this.name = partial.name;
    this.slug = partial.slug;
    this.parentId = partial.parentId;
    this.iconUrl = partial.iconUrl;
    this.metaTitle = partial.metaTitle;
    this.metaDesc = partial.metaDesc;
    this.productCount = partial.productCount;
    this.parent = partial.parent;
    this.children = partial.children;
    this.createdAt = partial.createdAt;
    this.updatedAt = partial.updatedAt;
  }
}

interface CategoryTreeNodeInput {
  id: number;
  name: string;
  slug: string;
  iconUrl: string | null;
  children: CategoryTreeNodeEntity[];
}

export class CategoryTreeNodeEntity {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Smartphones' })
  name: string;

  @ApiProperty({ example: 'smartphones' })
  slug: string;

  @ApiProperty({ example: 'https://cdn.example.com/icons/phones.svg', nullable: true })
  iconUrl: string | null;

  @ApiProperty({ type: () => CategoryTreeNodeEntity, isArray: true })
  children: CategoryTreeNodeEntity[];

  constructor(partial: CategoryTreeNodeInput) {
    this.id = partial.id;
    this.name = partial.name;
    this.slug = partial.slug;
    this.iconUrl = partial.iconUrl;
    this.children = partial.children;
  }
}
