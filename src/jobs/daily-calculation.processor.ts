import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { CALORIES_QUEUE } from '../common/constants/queue.constants';
import { DailyCalculation } from '../calories/daily-calculation.entity';

interface SaveDailyCalculationJob {
  userId: string;
  bmr: number;
  tdee: number;
  dailyCalories: number;
  recommendations: Record<string, unknown>;
}

@Processor(CALORIES_QUEUE)
export class DailyCalculationProcessor extends WorkerHost {
  private readonly logger = new Logger(DailyCalculationProcessor.name);

  constructor(
    @InjectRepository(DailyCalculation)
    private readonly dailyCalculationRepository: Repository<DailyCalculation>,
  ) {
    super();
  }

  async process(job: Job<SaveDailyCalculationJob>): Promise<void> {
    if (job.name !== 'save-daily-calculation') {
      this.logger.warn(`Unsupported calories job: ${job.name}`);
      return;
    }

    try {
      const payload = job.data;
      await this.dailyCalculationRepository.save({
        userId: payload.userId,
        bmr: payload.bmr,
        tdee: payload.tdee,
        dailyCalories: payload.dailyCalories,
        recommendations: payload.recommendations,
      });
    } catch (err) {
      this.logger.error('Failed to save daily calculation job', err as Error);
    }
  }
}
