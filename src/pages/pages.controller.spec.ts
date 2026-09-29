import { Test, type TestingModule } from '@nestjs/testing';
import { PagesController, AdminPagesController } from './pages.controller';
import { PagesService } from './pages.service';

const mockPage = {
  id: 1,
  slug: 'about',
  title: 'About Us',
  content: 'Our Story',
  isVisible: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('PagesController', () => {
  let controller: PagesController;
  let service: PagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PagesController],
      providers: [
        {
          provide: PagesService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([mockPage]),
            findOne: jest.fn().mockResolvedValue(mockPage),
          },
        },
      ],
    }).compile();

    controller = module.get<PagesController>(PagesController);
    service = module.get<PagesService>(PagesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll should return array of pages', async () => {
    expect(await controller.findAll()).toEqual([mockPage]);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('findOne should return a page', async () => {
    expect(await controller.findOne('about')).toEqual(mockPage);
    expect(service.findOne).toHaveBeenCalledWith('about');
  });
});

describe('AdminPagesController', () => {
  let controller: AdminPagesController;
  let service: PagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminPagesController],
      providers: [
        {
          provide: PagesService,
          useValue: {
            findAllAdmin: jest.fn().mockResolvedValue([mockPage]),
            findOneById: jest.fn().mockResolvedValue(mockPage),
            update: jest.fn().mockResolvedValue({ ...mockPage, title: 'Updated' }),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminPagesController>(AdminPagesController);
    service = module.get<PagesService>(PagesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll should return array of pages', async () => {
    expect(await controller.findAll()).toEqual([mockPage]);
    expect(service.findAllAdmin).toHaveBeenCalled();
  });

  it('findOne should return a page', async () => {
    expect(await controller.findOne('1')).toEqual(mockPage);
    expect(service.findOneById).toHaveBeenCalledWith(1);
  });

  it('update should return the updated page', async () => {
    const updateDto = { title: 'Updated' };
    expect(await controller.update('1', updateDto)).toEqual({ ...mockPage, title: 'Updated' });
    expect(service.update).toHaveBeenCalledWith(1, updateDto);
  });
});
