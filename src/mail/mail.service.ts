import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendResetPasswordEmail(
    email: string,
    resetLink: string,
    otp: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: email,
      from: this.configService.getOrThrow<string>('EMAIL_FROM'),
      subject: 'Reset your password',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <p>You requested a password reset.</p>
          <p>Your one-time code is:</p>
          <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; padding: 12px 16px; background: #f3f4f6; display: inline-block; border-radius: 8px;">${otp}</div>
          <p style="margin-top: 12px;">This code expires in 5 minutes and can only be used once.</p>
          <p style="margin-top: 20px;">Or click this button to open the reset page automatically:</p>
          <p>
            <a href="${resetLink}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px;">Reset password</a>
          </p>
          <p>If you did not request this, ignore this email.</p>
        </div>
      `,
    });

    this.logger.log(`Reset password email sent to ${email}`);
  }
}
