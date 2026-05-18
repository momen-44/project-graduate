import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EMAIL_QUEUE } from '../common/constants/queue.constants';
import { MailService } from '../mail/mail.service';

interface ResetPasswordEmailJob {
  email: string;
  resetLink: string;
  otp: string;
}

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<ResetPasswordEmailJob>): Promise<void> {
    if (job.name !== 'send-reset-password') {
      this.logger.warn(`Unsupported email job: ${job.name}`);
      return;
    }

    await this.mailService.sendResetPasswordEmail(
      job.data.email,
      job.data.resetLink,
      job.data.otp,
    );
  }
}
