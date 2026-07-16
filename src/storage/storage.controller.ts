import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { StorageEntity } from './entities/storage.entity';
import { UploadFileSchema, type UploadFileDto } from './dto/upload-file.dto';
import { StorageService } from './storage.service';
import { resolveContentType } from './storage.utils';

@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload a file to the configured storage backend' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folder: { type: 'string', default: 'general' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: StorageEntity })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Missing file or invalid folder' })
  @ApiResponse({
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    description: 'File exceeds the configured size limit',
  })
  @ApiResponse({
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    description: 'MIME type not present in the allow-list',
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body(new ZodValidationPipe(UploadFileSchema)) dto: UploadFileDto,
  ): Promise<{ message: string; data: StorageEntity }> {
    if (!file) {
      throw new BadRequestException('A file is required');
    }

    const result = await this.storageService.save(file, dto.folder);

    return {
      message: 'File uploaded successfully',
      data: new StorageEntity(result),
    };
  }

  @Get('stream/:folder/:filename')
  @Public()
  @ApiOperation({ summary: 'Stream a previously uploaded object back to the client' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Binary object stream' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Object does not exist' })
  async streamFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() response: Response,
  ): Promise<void> {
    const objectKey = `${folder}/${filename}`;
    const fileStream = await this.storageService.stream(objectKey);

    response.setHeader('Content-Type', resolveContentType(filename));
    // Helmet's default Cross-Origin-Resource-Policy is `same-origin`, which
    // blocks cross-origin <img>/<video> loads of this URL regardless of CORS
    // headers (CORP is enforced independently of CORS for no-cors resource
    // loads). Scoped to just this route rather than loosened globally in main.ts.
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    fileStream.on('error', (error: Error) => {
      this.logger.error(`Stream failure for object "${objectKey}": ${error.message}`, error.stack);
      if (!response.headersSent) {
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
      } else {
        response.destroy(error);
      }
    });

    fileStream.pipe(response);
  }

  @Delete(':folder/:filename')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a previously uploaded object' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Object deleted (idempotent)' })
  async deleteFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
  ): Promise<{ message: string; data: null }> {
    await this.storageService.remove(`${folder}/${filename}`);
    // Explicit `data: null` — without it, TransformInterceptor's fallback
    // (`body?.data ?? res`) would nest this entire { message } object inside
    // itself as `data`, duplicating the message in the response body.
    return { message: 'File deleted successfully', data: null };
  }
}
