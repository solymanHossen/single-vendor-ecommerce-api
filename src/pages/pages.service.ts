import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdatePageDto } from './dto/update-page.dto';

@Injectable()
export class PagesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.page.findMany({
      where: { isVisible: true },
      select: { id: true, slug: true, title: true, updatedAt: true }
    });
  }

  async findOne(slug: string) {
    const page = await this.prisma.page.findUnique({
      where: { slug },
    });
    if (!page || !page.isVisible) {
      throw new NotFoundException(`Page with slug ${slug} not found`);
    }
    return page;
  }

  async findAllAdmin() {
    return this.prisma.page.findMany({
      orderBy: { slug: 'asc' }
    });
  }

  async findOneById(id: number) {
    const page = await this.prisma.page.findUnique({
      where: { id },
    });
    if (!page) {
      throw new NotFoundException(`Page with id ${id} not found`);
    }
    return page;
  }

  async update(id: number, updatePageDto: UpdatePageDto) {
    try {
      return await this.prisma.page.update({
        where: { id },
        data: updatePageDto,
      });
    } catch (e) {
      throw new NotFoundException(`Page with id ${id} not found`);
    }
  }
}
