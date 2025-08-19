import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const minioConfig = {
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
};

const bucketName = process.env.MINIO_BUCKET_NAME || 'chat-files';

export const minioClient = new Minio.Client(minioConfig);

// Initialize bucket if it doesn't exist
export async function initializeBucket(): Promise<void> {
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName, 'us-east-1');
      console.log(`Bucket '${bucketName}' created successfully`);
    }
  } catch (error) {
    console.error('Error initializing bucket:', error);
    throw error;
  }
}

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export class StorageService {
  static async uploadFile(
    buffer: Buffer,
    originalFilename: string,
    mimeType: string
  ): Promise<UploadResult> {
    try {
      const fileExtension = path.extname(originalFilename);
      const filename = `${uuidv4()}${fileExtension}`;
      const size = buffer.length;

      // Upload file to MinIO
      await minioClient.putObject(bucketName, filename, buffer, {
        'Content-Type': mimeType,
        'Content-Length': size,
      });

      // Generate public URL
      const url = await minioClient.presignedUrl('GET', bucketName, filename, 24 * 60 * 60); // 24 hours

      return {
        url,
        filename,
        size,
        mimeType,
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('Failed to upload file');
    }
  }

  static async deleteFile(filename: string): Promise<void> {
    try {
      await minioClient.removeObject(bucketName, filename);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error('Failed to delete file');
    }
  }

  static async getFileUrl(filename: string): Promise<string> {
    try {
      return await minioClient.presignedUrl('GET', bucketName, filename, 24 * 60 * 60);
    } catch (error) {
      console.error('Error generating file URL:', error);
      throw new Error('Failed to generate file URL');
    }
  }

  static isValidFileType(mimeType: string): boolean {
    const allowedTypes = [
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      // Videos
      'video/mp4',
      'video/webm',
      'video/mov',
      'video/avi',
      // Audio
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/m4a',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
    ];
    
    return allowedTypes.includes(mimeType);
  }

  static getMaxFileSize(): number {
    return parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB default
  }
}
