import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

export interface UploadableImageFile {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size?: number;
  fieldname?: string;
  encoding?: string;
  destination?: string;
  filename?: string;
  path?: string;
}

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.getOrThrow<string>('CLOUDINARY_NAME'),
      api_key: this.configService.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.getOrThrow<string>(
        'CLOUDINARY_API_SECRET',
      ),
      secure: true,
    });
  }

  getSignedUploadParams(folderOverride?: string, publicId?: string) {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder =
      folderOverride ||
      this.configService.get<string>('CLOUDINARY_UPLOAD_FOLDER') ||
      'nutrition';

    const paramsToSign: Record<string, string | number> = {
      timestamp,
      folder,
    };

    if (publicId) {
      paramsToSign.public_id = publicId;
    }

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      this.configService.getOrThrow<string>('CLOUDINARY_API_SECRET'),
    );

    return {
      timestamp,
      signature,
      folder,
      publicId,
      apiKey: this.configService.getOrThrow<string>('CLOUDINARY_API_KEY'),
      cloudName: this.configService.getOrThrow<string>('CLOUDINARY_NAME'),
    };
  }

  uploadFile(file: UploadableImageFile): Promise<CloudinaryUploadResult> {
    const folder =
      this.configService.get<string>('CLOUDINARY_UPLOAD_FOLDER') || 'nutrition';

    return new Promise<CloudinaryUploadResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
        },
        (error, result) => {
          if (error) {
            const message =
              typeof error === 'object' &&
              error !== null &&
              'message' in error &&
              typeof (error as { message?: unknown }).message === 'string'
                ? String((error as { message: string }).message)
                : 'Cloudinary upload failed';
            reject(new Error(message));
            return;
          }

          if (!result?.secure_url || !result.public_id) {
            reject(new Error('Invalid Cloudinary upload response'));
            return;
          }

          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
          });
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}
