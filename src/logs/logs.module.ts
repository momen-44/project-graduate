import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemLog } from './entities/system-log.entity';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { LogsCleanupService } from './logs-cleanup.service';

@Module({
  imports: [TypeOrmModule.forFeature([SystemLog])],
  controllers: [LogsController],
  providers: [LogsService, LogsCleanupService],
  exports: [LogsService, TypeOrmModule],
})
export class LogsModule {}
