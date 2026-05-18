import { CaloriesService } from './calories.service';
import { ActivityLevelEnum } from '../common/enums/activity-level.enum';
import { GenderEnum } from '../common/enums/gender.enum';

describe('CaloriesService', () => {
  it('calculates and persists daily calories using profile', async () => {
    const dailyCalculationRepository = {
      save: jest.fn().mockResolvedValue({
        id: '1',
        bmr: 1780.5,
        tdee: 2759.77,
        dailyCalories: 2759.77,
        recommendations: {
          dailyAdvice: 'Stay hydrated',
          healthyAlternatives: ['Greek yogurt'],
        },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    };

    const usersService = {
      findById: jest.fn().mockResolvedValue({
        id: 'user-1',
        age: 30,
        gender: GenderEnum.MALE,
        height: 180,
        weight: 80,
        activityLevel: ActivityLevelEnum.MODERATE,
        dietaryPreference: null,
      }),
    };

    const geminiService = {
      generateDailyAdvice: jest.fn().mockResolvedValue({
        dailyAdvice: 'Stay hydrated',
        healthyAlternatives: ['Greek yogurt'],
        protein: 207,
        carbs: 310,
        fats: 77,
      }),
    };

    const redisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const configService = {
      get: jest.fn().mockReturnValue(86400),
    };

    const service = new CaloriesService(
      dailyCalculationRepository as never,
      usersService as never,
      geminiService as never,
      redisService as never,
      configService as never,
    );

    const result = await service.calculateDailyForUser('user-1');

    expect(usersService.findById).toHaveBeenCalledWith('user-1');
    expect(redisService.get).toHaveBeenCalledTimes(2);
    expect(redisService.set).toHaveBeenCalledTimes(2);
    expect(geminiService.generateDailyAdvice).toHaveBeenCalledTimes(1);
    expect(dailyCalculationRepository.save).toHaveBeenCalledTimes(2);
    expect(dailyCalculationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        recommendations: expect.objectContaining({
          dailyAdvice: 'Stay hydrated',
          healthyAlternatives: ['Greek yogurt'],
          macroTargets: expect.objectContaining({
            protein: expect.any(Number),
            carbs: expect.any(Number),
            fats: expect.any(Number),
          }),
        }),
      }),
    );
    expect(result.dailyCalories).toBe(2759);
  });
});
