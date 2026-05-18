import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { LogsService } from './logs.service';

@Injectable()
export class LogsCleanupService {
  private readonly logger = new Logger(LogsCleanupService.name);

  constructor(
    private readonly logsService: LogsService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async cleanupOldLogs(): Promise<void> {
    const retentionDays =
      this.configService.get<number>('LOG_RETENTION_DAYS') ?? 30;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const affected = await this.logsService.deleteLogsOlderThan(cutoff);
    this.logger.log(
      `Deleted ${affected} logs older than ${retentionDays} days`,
    );
  }
}
