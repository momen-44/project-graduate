import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { Express } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RevokeDto } from './dto/revoke.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto, VerifyResetCodeDto } from './dto/reset-password.dto';
import { validateImageFile } from '../common/utils/image-validation.util';

@ApiTags('Auth')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller(['auth', 'api/v1/auth'])
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  @UseInterceptors(FileInterceptor('profileImage'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'name',
        'email',
        'password',
        'age',
        'gender',
        'height',
        'weight',
        'activityLevel',
        'dietaryPreference',
      ],
      properties: {
        name: {
          type: 'string',
          minLength: 1,
          maxLength: 120,
          example: 'أحمد محمد',
        },
        email: {
          type: 'string',
          format: 'email',
          example: 'user@example.com',
        },
        password: {
          type: 'string',
          minLength: 8,
          maxLength: 100,
          example: 'SecurePassword123!',
        },
        age: {
          type: 'integer',
          minimum: 10,
          maximum: 120,
          example: 25,
        },
        gender: {
          type: 'string',
          enum: ['male', 'female', 'other'],
          example: 'male',
        },
        height: {
          type: 'integer',
          minimum: 50,
          maximum: 260,
          example: 175,
          description: 'Height in cm',
        },
        weight: {
          type: 'integer',
          minimum: 30,
          maximum: 500,
          example: 70,
          description: 'Weight in kg',
        },
        activityLevel: {
          type: 'string',
          enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
          example: 'moderate',
        },
        dietaryPreference: {
          type: 'string',
          enum: ['vegetarian', 'vegan', 'pescatarian', 'omnivore'],
          example: 'omnivore',
        },
        profileImage: {
          type: 'string',
          format: 'binary',
          description: 'Profile image - optional (JPEG, PNG, WebP, max 5MB)',
        },
      },
    },
  })
  async register(
    @Body() dto: Partial<RegisterDto>,
    @UploadedFile() profileImage?: any,
  ) {
    // Validate image only if provided
    if (profileImage) {
      validateImageFile(profileImage);
    }
    return this.authService.register(dto, profileImage);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a password reset code' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOkResponse({
    description: 'Reset code requested successfully.',
  })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify a password reset code' })
  @ApiBody({ type: VerifyResetCodeDto })
  @ApiOkResponse({
    description:
      'Verification succeeded and a temporary reset token was issued.',
  })
  @ApiBadRequestResponse({
    description: 'The verification code was invalid or expired.',
  })
  @Post('verify-reset-code')
  verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reset a password using a temporary reset token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({
    description: 'Password reset successfully.',
  })
  @ApiBadRequestResponse({
    description: 'The reset token was invalid or expired.',
  })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('revoke')
  revoke(@Body() dto: RevokeDto) {
    return this.authService.revoke(dto);
  }

  @Get('sessions')
  sessions(@Request() req) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.authService.listSessions(userId);
  }
}
