import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MlService } from './ml.service';

@Module({
  imports: [HttpModule],
  providers: [MlService],
  exports: [MlService],
})
export class MlModule {}
