// FILES SERVICE v2 — S3-compatible (MinIO + Cloudflare R2 + AWS S3)
// Railway: usa Cloudflare R2 o AWS S3
// VPS: usa MinIO (docker-compose.yml)
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Controller, Get, Post, Param, Query, Delete, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, SedeId } from '../auth/strategies/jwt.strategy';
import { Readable } from 'stream';

const PRESIGNED_EXPIRY = 3600;

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private client: S3Client;
  private readonly bucket: string;

  constructor(private config: ConfigService) {
    this.bucket = this.config.get<string>('S3_BUCKET', 'sgci-clinica');
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const region   = this.config.get<string>('S3_REGION', 'auto');
    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId:     this.config.getOrThrow('S3_ACCESS_KEY'),
        secretAccessKey: this.config.getOrThrow('S3_SECRET_KEY'),
      },
    });
  }

  async upload(buffer: Buffer, key: string, contentType: string, metadata: Record<string,string> = {}): Promise<string> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType, Metadata: metadata }));
    return `s3://${this.bucket}/${key}`;
  }

  async getPresignedUrl(key: string, expiry = PRESIGNED_EXPIRY): Promise<string> {
    const k = key.replace(`s3://${this.bucket}/`, '');
    try {
      return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: k }), { expiresIn: expiry });
    } catch (e: any) {
      if (e.name === 'NoSuchKey') throw new NotFoundException('Archivo no encontrado');
      throw e;
    }
  }

  async getPresignedUploadUrl(key: string, expiry = 900): Promise<string> {
    return getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiry });
  }

  async download(key: string): Promise<Buffer> {
    const k = key.replace(`s3://${this.bucket}/`, '');
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: k }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as Readable) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    const k = key.replace(`s3://${this.bucket}/`, '');
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: k }));
  }
}

@ApiTags('files')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('files')
export class FilesController {
  constructor(private svc: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Subir archivo (máx 20MB)' })
  @Roles('MEDICO','PSICOLOGO','LABORATORIO','ADMIN_SEDE','SUPERADMIN')
  async upload(@UploadedFile() file: Express.Multer.File, @Query('path') path: string, @CurrentUser() user: any, @SedeId() sedeId: string) {
    const key = `${sedeId}/${path ?? 'uploads'}/${Date.now()}-${file.originalname}`;
    const s3Path = await this.svc.upload(file.buffer, key, file.mimetype, { 'uploaded-by': user.sub });
    const url = await this.svc.getPresignedUrl(s3Path);
    return { key: s3Path, url, size: file.size };
  }

  @Get('presigned-url')
  async getUrl(@Query('key') key: string) {
    return { url: await this.svc.getPresignedUrl(key), expiresIn: PRESIGNED_EXPIRY };
  }

  @Delete(':key')
  @Roles('ADMIN_SEDE','SUPERADMIN')
  async deleteFile(@Param('key') key: string) {
    await this.svc.delete(decodeURIComponent(key));
    return { deleted: true };
  }
}

@Module({ providers: [FilesService], controllers: [FilesController], exports: [FilesService] })
export class FilesModule {}
