import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { InternalApiKeyGuard } from '../common/guards/internal-api-key.guard';
import { GetLogsQueryDto } from './get-logs-query.dto';
import { LogsService } from './logs.service';

@ApiTags('Logs')
@ApiSecurity('internal-key')
@UseGuards(InternalApiKeyGuard)
@Controller(['logs', 'api/v1/logs'])
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  getLogs(@Query() query: GetLogsQueryDto) {
    return this.logsService.getLogs(query.limit);
  }
}
