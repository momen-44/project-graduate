import { registerDecorator, ValidationArguments } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { Express } from 'express';

export class RegisterWithImageDto {
  name!: string;
  email!: string;
  password!: string;
  age?: number;
  gender?: string;
  height?: number;
  weight?: number;
  activityLevel?: string;
  metabolismRate?: string;
  dietaryPreference?: string;
  profileImage?: Express.Multer.File;

  /**
   * This DTO is used for form-data requests with file upload
   * The actual validation happens in the controller via validateImageFile()
   */
}
