import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemLog } from './entities/system-log.entity';

@Injectable()
export class LogsService {
  constructor(
    @InjectRepository(SystemLog)
    private readonly systemLogRepository: Repository<SystemLog>,
  ) {}

  async getLogs(limit = 200) {
    const safeLimit = Math.max(1, Math.min(limit, 1000));

    const logs = await this.systemLogRepository.find({
      order: { createdAt: 'DESC' },
      take: safeLimit,
    });

    return logs.map((log) => ({
      id: log.id,
      serviceName: log.serviceName,
      action: log.action,
      requestData: log.requestData,
      responseData: log.responseData,
      status: log.status,
      createdAt: log.createdAt,
    }));
  }

  async deleteLogsOlderThan(cutoffDate: Date): Promise<number> {
    const result = await this.systemLogRepository
      .createQueryBuilder()
      .delete()
      .from(SystemLog)
      .where('created_at < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected ?? 0;
  }
}
