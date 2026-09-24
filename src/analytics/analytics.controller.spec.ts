import { Test, type TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

const mockAnalyticsService = { getDashboard: jest.fn() };

describe('AnalyticsController', () => {
  let controller: AnalyticsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: mockAnalyticsService }],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    jest.clearAllMocks();
  });

  it('passes the validated range through and wraps the response', async () => {
    const dashboard = { rangeDays: 30 };
    mockAnalyticsService.getDashboard.mockResolvedValue(dashboard);

    const result = await controller.getDashboard({ range: 30 });

    expect(mockAnalyticsService.getDashboard).toHaveBeenCalledWith(30);
    expect(result).toEqual({ message: 'Analytics retrieved successfully', data: dashboard });
  });
});
