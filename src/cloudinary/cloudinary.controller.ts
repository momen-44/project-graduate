import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CloudinaryService } from './cloudinary.service';
import { SignedUploadDto } from './dto/signed-upload.dto';

@ApiTags('Cloudinary')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller(['cloudinary', 'api/v1/cloudinary'])
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('signed-upload')
  getSignedUpload(@Body() dto: SignedUploadDto) {
    return this.cloudinaryService.getSignedUploadParams(
      dto.folder,
      dto.publicId,
    );
  }
}
