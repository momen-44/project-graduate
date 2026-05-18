import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { LOGGING_QUEUE } from '../common/constants/queue.constants';
import { SystemLog } from '../logs/entities/system-log.entity';

interface LoggingJob {
  serviceName: string;
  action: string;
  requestData?: unknown;
  responseData?: unknown;
  status: string;
}

@Processor(LOGGING_QUEUE)
export class LoggingProcessor extends WorkerHost {
  constructor(
    @InjectRepository(SystemLog)
    private readonly systemLogRepository: Repository<SystemLog>,
  ) {
    super();
  }

  async process(job: Job<LoggingJob>): Promise<void> {
    if (job.name !== 'create-system-log') {
      return;
    }

    const payload = job.data;
    await this.systemLogRepository.save({
      serviceName: payload.serviceName,
      action: payload.action,
      requestData: (payload.requestData as Record<string, unknown>) ?? null,
      responseData: (payload.responseData as Record<string, unknown>) ?? null,
      status: payload.status,
    });
  }
}
