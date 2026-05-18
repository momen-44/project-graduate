import {
  BadRequestException,
  ConflictException,
  Injectable,
  Optional,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Express } from 'express';
import { UsersService } from '../users/users.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto, VerifyResetCodeDto } from './dto/reset-password.dto';
import { PasswordReset } from './entities/password-reset.entity';
import { Session } from './entities/session.entity';
import { redactSensitiveData, sha256 } from '../common/utils/security.util';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  EMAIL_QUEUE,
  LOGGING_QUEUE,
} from '../common/constants/queue.constants';
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

interface ResetPasswordTokenPayload {
  sub: string;
  email: string;
  resetRecordId: string;
  purpose: 'password_reset';
}

@Injectable()
export class AuthService {
  private readonly resetCodeTtlMs = 5 * 60 * 1000;
  private readonly resetTokenExpiresIn = '10m';

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cloudinaryService: CloudinaryService,
    @InjectRepository(PasswordReset)
    private readonly passwordResetRepository: Repository<PasswordReset>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly mailService: MailService,
    @Optional()
    @InjectQueue(LOGGING_QUEUE)
    private readonly loggingQueue?: Queue,
  ) {}

  async register(dto: Partial<RegisterDto>, profileImage?: any) {
    // Validate required fields
    if (
      !dto.name ||
      !dto.email ||
      !dto.password ||
      !dto.age ||
      !dto.gender ||
      !dto.height ||
      !dto.weight ||
      !dto.activityLevel ||
      !dto.dietaryPreference
    ) {
      throw new BadRequestException(
        'Name, email, password, age, gender, height, weight, activityLevel, and dietaryPreference are required',
      );
    }

    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    let imageUrl: string | null = null;
    let imagePublicId: string | null = null;

    // Upload image to Cloudinary if provided
    if (profileImage) {
      try {
        const uploadResult =
          await this.cloudinaryService.uploadFile(profileImage);
        imageUrl = uploadResult.secure_url;
        imagePublicId = uploadResult.public_id;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Image upload failed';
        throw new InternalServerErrorException(
          `Failed to upload image: ${errorMessage}`,
        );
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = await this.usersService.createUser({
      name: dto.name,
      email: dto.email,
      passwordHash,
      age: dto.age ?? null,
      gender: dto.gender ?? null,
      height: dto.height ?? null,
      weight: dto.weight ?? null,
      activityLevel: dto.activityLevel ?? null,
      metabolismRate: dto.metabolismRate ?? undefined,
      dietaryPreference: dto.dietaryPreference ?? null,
      profileImageUrl: imageUrl,
      profileImagePublicId: imagePublicId,
    });

    const accessToken = await this.signToken(user.id, user.email);

    await this.enqueueLog(
      'auth',
      'register',
      { email: dto.email, imagePublicId },
      { userId: user.id },
      'success',
    );

    return {
      accessToken,
      user: this.usersService.toSafeUser(user),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatched = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatched) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.signToken(user.id, user.email);

    // Create refresh token and session
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshHash = await argon2.hash(refreshToken);
    const refreshFingerprint = sha256(refreshToken);
    const now = new Date();
    const refreshTtlDays = Number(
      this.configService.get<number>('REFRESH_EXPIRES_DAYS') ?? 14,
    );
    const refreshExpiresAt = new Date(
      now.getTime() + refreshTtlDays * 24 * 60 * 60 * 1000,
    );

    if (!this.sessionRepository) {
      throw new InternalServerErrorException(
        'Session repository not available',
      );
    }

    const session = this.sessionRepository.create({
      userId: user.id,
      refreshTokenHash: refreshHash,
      refreshTokenFingerprint: refreshFingerprint,
      deviceId: (dto as any).device_id ?? null,
      deviceInfo: (dto as any).device_info ?? null,
      ip: null,
      userAgent: null,
      issuedAt: now,
      expiresAt: refreshExpiresAt,
      revoked: false,
    });

    await this.sessionRepository.save(session);

    await this.enqueueLog(
      'auth',
      'login',
      { email: dto.email, deviceId: (dto as any).device_id ?? null },
      { userId: user.id, sessionId: session.id },
      'success',
    );

    return {
      accessToken,
      access_expires_in: this.configService.get('JWT_EXPIRES_IN') ?? '1h',
      refresh_token: refreshToken,
      refresh_expires_in: refreshTtlDays * 24 * 60 * 60,
      session_id: session.id,
      user: this.usersService.toSafeUser(user),
    };
  }

  async refresh(dto: { refresh_token: string; device_id?: string }) {
    if (!this.sessionRepository) {
      throw new InternalServerErrorException(
        'Session repository not available',
      );
    }

    const incomingFingerprint = sha256(dto.refresh_token);

    let session = await this.sessionRepository.findOne({
      where: { refreshTokenFingerprint: incomingFingerprint },
    });

    // Fallback for legacy sha256-only stored hashes
    let legacyMatch = false;
    if (!session) {
      const incomingSha = sha256(dto.refresh_token);
      session = await this.sessionRepository.findOne({
        where: { refreshTokenHash: incomingSha } as any,
      });
      if (session) legacyMatch = true;
    }

    if (!session) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    if (session.revoked) {
      throw new UnauthorizedException('Session revoked');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // verify argon2 hash (or accept legacy sha256 equality)
    if (!legacyMatch) {
      const verified = await argon2.verify(
        session.refreshTokenHash,
        dto.refresh_token,
      );
      if (!verified) {
        throw new UnauthorizedException('Refresh token invalid or expired');
      }
    } else {
      // legacyMatch: session.refreshTokenHash currently contains a sha256 fingerprint
      const incomingSha = sha256(dto.refresh_token);
      if (session.refreshTokenHash !== incomingSha) {
        throw new UnauthorizedException('Refresh token invalid or expired');
      }
    }

    // Optional device binding check
    if (
      dto.device_id &&
      session.deviceId &&
      dto.device_id !== session.deviceId
    ) {
      throw new UnauthorizedException('Device mismatch');
    }

    // Rotation: revoke old session and create a new one
    session.revoked = true;
    await this.sessionRepository.save(session);

    const user = await this.usersService.findById(session.userId);
    if (!user) throw new UnauthorizedException('Invalid session user');

    const accessToken = await this.signToken(user.id, user.email);

    const newRefreshToken = crypto.randomBytes(64).toString('hex');
    const newHash = await argon2.hash(newRefreshToken);
    const newFingerprint = sha256(newRefreshToken);
    const now = new Date();
    const refreshTtlDays = Number(
      this.configService.get<number>('REFRESH_EXPIRES_DAYS') ?? 14,
    );
    const refreshExpiresAt = new Date(
      now.getTime() + refreshTtlDays * 24 * 60 * 60 * 1000,
    );

    const newSession = this.sessionRepository.create({
      userId: user.id,
      refreshTokenHash: newHash,
      refreshTokenFingerprint: newFingerprint,
      deviceId: session.deviceId,
      deviceInfo: session.deviceInfo,
      ip: session.ip,
      userAgent: session.userAgent,
      issuedAt: now,
      expiresAt: refreshExpiresAt,
      revoked: false,
    });
    await this.sessionRepository.save(newSession);

    await this.enqueueLog(
      'auth',
      'refresh',
      { sessionId: session.id },
      { newSessionId: newSession.id },
      'success',
    );

    return {
      accessToken: accessToken,
      access_expires_in: this.configService.get('JWT_EXPIRES_IN') ?? '1h',
      refresh_token: newRefreshToken,
      refresh_expires_in: refreshTtlDays * 24 * 60 * 60,
      session_id: newSession.id,
    };
  }

  async revoke(dto: { refresh_token?: string; session_id?: string }) {
    if (!this.sessionRepository) {
      throw new InternalServerErrorException(
        'Session repository not available',
      );
    }

    let session: Session | null = null;
    if (dto.session_id) {
      session = await this.sessionRepository.findOne({
        where: { id: dto.session_id },
      });
    } else if (dto.refresh_token) {
      const fingerprint = sha256(dto.refresh_token);
      session = await this.sessionRepository.findOne({
        where: { refreshTokenFingerprint: fingerprint },
      });
      if (!session) {
        const incomingSha = sha256(dto.refresh_token);
        session = await this.sessionRepository.findOne({
          where: { refreshTokenHash: incomingSha } as any,
        });
      }
    }

    if (!session) {
      return { revoked: false };
    }

    session.revoked = true;
    await this.sessionRepository.save(session);

    await this.enqueueLog(
      'auth',
      'revoke',
      { sessionId: session.id },
      null,
      'success',
    );

    return { revoked: true };
  }

  async listSessions(userId?: string) {
    if (!this.sessionRepository) {
      throw new InternalServerErrorException(
        'Session repository not available',
      );
    }
    if (!userId) {
      return [];
    }
    const sessions = await this.sessionRepository.find({ where: { userId } });
    return sessions.map((s) => ({
      id: s.id,
      deviceId: s.deviceId,
      deviceInfo: s.deviceInfo,
      issuedAt: s.issuedAt,
      expiresAt: s.expiresAt,
      revoked: s.revoked,
    }));
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      return {
        message:
          'If an account exists for this email, a reset link has been sent.',
      };
    }

    await this.passwordResetRepository.update(
      { userId: user.id, used: false },
      { used: true },
    );

    const rawToken = this.generateOtp();
    const hashedToken = sha256(rawToken);
    const expiresAt = new Date(Date.now() + this.resetCodeTtlMs);

    const resetRecord = await this.passwordResetRepository.save({
      userId: user.id,
      token: hashedToken,
      expiresAt,
      used: false,
    });

    const resetUrlBase = this.configService.getOrThrow<string>(
      'FRONTEND_RESET_PASSWORD_URL',
    );
    const resetLink = `${resetUrlBase}?email=${encodeURIComponent(user.email)}&code=${rawToken}`;

    await this.mailService.sendResetPasswordEmail(
      user.email,
      resetLink,
      rawToken,
    );

    await this.enqueueLog(
      'auth',
      'forgot-password',
      { email: dto.email },
      null,
      'accepted',
    );

    return {
      message:
        'If an account exists for this email, a reset link has been sent.',
    };
  }

  async verifyResetCode(dto: VerifyResetCodeDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const hashedCode = sha256(dto.code);
    const resetRecord = await this.passwordResetRepository.findOne({
      where: {
        userId: user.id,
        token: hashedCode,
        used: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { id: 'DESC' },
    });

    if (!resetRecord) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    resetRecord.used = true;
    await this.passwordResetRepository.save(resetRecord);

    const resetToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        resetRecordId: resetRecord.id,
        purpose: 'password_reset',
      } satisfies ResetPasswordTokenPayload,
      {
        secret: this.getResetTokenSecret(),
        expiresIn: this.resetTokenExpiresIn,
      },
    );

    return {
      resetToken,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    let payload: ResetPasswordTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<ResetPasswordTokenPayload>(
        dto.resetToken,
        {
          secret: this.getResetTokenSecret(),
        },
      );
    } catch (_) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (
      payload.purpose !== 'password_reset' ||
      !payload.sub ||
      !payload.email ||
      !payload.resetRecordId
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || user.email !== payload.email) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const resetRecord = await this.passwordResetRepository.findOne({
      where: {
        id: payload.resetRecordId,
        userId: user.id,
        used: true,
      },
    });

    if (!resetRecord) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    user.passwordHash = passwordHash;
    await this.usersService.saveUser(user);

    await this.passwordResetRepository.delete({ id: resetRecord.id });

    await this.enqueueLog(
      'auth',
      'reset-password',
      { userId: user.id, resetRecordId: resetRecord.id },
      { userId: user.id },
      'success',
    );

    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  private async signToken(userId: string, email: string): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: userId,
        email,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_SECRET_KEY'),
        expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') ??
          '1h') as never,
      },
    );
  }

  private async enqueueLog(
    serviceName: string,
    action: string,
    requestData: Record<string, unknown> | null,
    responseData: Record<string, unknown> | null,
    status: string,
  ): Promise<void> {
    if (!this.loggingQueue) {
      return;
    }

    await this.loggingQueue.add(
      'create-system-log',
      {
        serviceName,
        action,
        requestData: redactSensitiveData(requestData),
        responseData: redactSensitiveData(responseData),
        status,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 200,
        removeOnFail: 200,
      },
    );
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private getResetTokenSecret(): string {
    return (
      this.configService.get<string>('RESET_JWT_SECRET_KEY') ??
      this.configService.getOrThrow<string>('JWT_SECRET_KEY')
    );
  }
}
