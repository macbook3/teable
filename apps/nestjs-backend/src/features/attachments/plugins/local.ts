/* eslint-disable @typescript-eslint/naming-convention */
import * as crypto from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { resolve, join } from 'path';
import { BadRequestException, Injectable } from '@nestjs/common';
import { getRandomString } from '@teable/core';
import type { Request } from 'express';
import * as fse from 'fs-extra';
import sharp from 'sharp';
import { CacheService } from '../../../cache/cache.service';
import { IStorageConfig, StorageConfig } from '../../../configs/storage';
import { Encryptor } from '../../../utils/encryptor';
import { getFullStorageUrl } from '../../../utils/full-storage-url';
import { second } from '../../../utils/second';
import type StorageAdapter from './adapter';
import type { ILocalFileUpload, IObjectMeta, IPresignParams, IRespHeaders } from './types';

interface ITokenEncryptor {
  expiresDate: number;
  respHeaders?: IRespHeaders;
}

@Injectable()
export class LocalStorage implements StorageAdapter {
  path: string;
  storageDir: string;
  temporaryDir = resolve(process.cwd(), '.temporary');
  expireTokenEncryptor: Encryptor<ITokenEncryptor>;
  readPath = '/api/attachments/read';

  constructor(
    @StorageConfig() readonly config: IStorageConfig,
    private readonly cacheService: CacheService
  ) {
    this.expireTokenEncryptor = new Encryptor(this.config.encryption);
    this.path = this.config.local.path;
    this.storageDir = resolve(process.cwd(), this.path);

    fse.ensureDir(this.temporaryDir);
    fse.ensureDir(this.storageDir);
  }

  private getUploadUrl(token: string) {
    return `/api/attachments/upload/${token}`;
  }

  private deleteFile(filePath: string) {
    if (fse.existsSync(filePath)) {
      fse.unlinkSync(filePath);
    }
  }

  private getUrl(bucket: string, path: string, params: ITokenEncryptor) {
    const token = this.expireTokenEncryptor.encrypt(params);
    return `${join(this.readPath, bucket, path)}?token=${token}`;
  }

  parsePath(path: string) {
    const parts = path.split('/');
    return {
      bucket: parts[0],
      token: parts[parts.length - 1],
    };
  }

  async presigned(_bucket: string, dir: string, params: IPresignParams) {
    const { contentType, contentLength, hash } = params;
    const token = getRandomString(12);
    const filename = hash ?? token;
    const expiresIn = params?.expiresIn ?? second(this.config.tokenExpireIn);
    await this.cacheService.set(
      `attachment:local-signature:${token}`,
      {
        expiresDate: Math.floor(Date.now() / 1000) + expiresIn,
        contentLength,
        contentType,
      },
      expiresIn
    );

    const path = join(dir, filename);
    return {
      token,
      path,
      url: this.getUploadUrl(token),
      uploadMethod: 'PUT',
      requestHeaders: {
        'Content-Type': contentType,
        'Content-Length': contentLength,
      },
    };
  }

  async validateToken(token: string, file: ILocalFileUpload) {
    const validateMeta = await this.cacheService.get(`attachment:local-signature:${token}`);
    if (!validateMeta) {
      throw new BadRequestException('Invalid token');
    }
    const { expiresDate, contentLength, contentType } = validateMeta;

    const { size, mimetype } = file;
    if (Math.floor(Date.now() / 1000) > expiresDate) {
      throw new BadRequestException('Token has expired');
    }
    if (contentLength && contentLength !== size) {
      throw new BadRequestException('Size mismatch');
    }
    if (mimetype && mimetype !== contentType) {
      throw new BadRequestException(`Not allow upload ${mimetype} file`);
    }
  }

  async saveTemporaryFile(req: Request) {
    const name = getRandomString(12);
    const path = resolve(this.temporaryDir, name);
    let size = 0;
    return new Promise<ILocalFileUpload>((resolve, reject) => {
      try {
        const fileStream = createWriteStream(path);
        req.on('data', (chunk) => {
          fileStream.write(chunk);
          size += chunk.length;
        });

        req.on('end', () => {
          fileStream.end();
          resolve({
            size,
            mimetype: req.headers['content-type'] as string,
            path,
          });
        });
        req.on('error', (err) => {
          this.deleteFile(path);
          reject(err.message);
        });
        fileStream.on('error', (err) => {
          this.deleteFile(path);
          reject(err.message);
        });
      } catch (error) {
        this.deleteFile(path);
        reject(error);
      }
    });
  }

  async save(filePath: string, rename: string) {
    const distPath = resolve(this.storageDir);
    const newFilePath = resolve(distPath, rename);
    await fse.copy(filePath, newFilePath);
    await fse.remove(filePath);
    return join(this.path, rename);
  }

  read(path: string) {
    return createReadStream(resolve(this.storageDir, path));
  }

  getLastModifiedTime(path: string) {
    const url = resolve(this.storageDir, path);
    if (!fse.existsSync(url)) {
      return;
    }
    return fse.statSync(url).mtimeMs;
  }

  async getFileMate(path: string) {
    const info = await sharp(path).metadata();
    return {
      width: info.width,
      height: info.height,
    };
  }

  async getHash(path: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const fileReadStream = createReadStream(path);
    fileReadStream.on('data', (data) => {
      hash.update(data);
    });
    return new Promise((resolve) => {
      fileReadStream.on('end', () => {
        resolve(hash.digest('hex'));
      });
    });
  }

  async getObject(bucket: string, path: string, token: string): Promise<IObjectMeta> {
    const uploadCache = await this.cacheService.get(`attachment:upload:${token}`);
    if (!uploadCache) {
      throw new BadRequestException(`Invalid token: ${token}`);
    }
    const { mimetype, hash, size } = uploadCache;

    const meta = {
      hash,
      mimetype,
      size,
      url: this.getUrl(bucket, path, {
        respHeaders: { 'Content-Type': mimetype },
        expiresDate: -1,
      }),
    };

    if (!mimetype?.startsWith('image/')) {
      return meta;
    }
    return {
      ...meta,
      ...(await this.getFileMate(resolve(this.storageDir, bucket, path))),
    };
  }

  async getPreviewUrl(
    bucket: string,
    path: string,
    expiresIn: number = second(this.config.urlExpireIn),
    respHeaders?: IRespHeaders
  ): Promise<string> {
    const url = this.getUrl(bucket, path, {
      expiresDate: Math.floor(Date.now() / 1000) + expiresIn,
      respHeaders,
    });
    return getFullStorageUrl(url);
  }

  verifyReadToken(token: string) {
    try {
      const { expiresDate, respHeaders } = this.expireTokenEncryptor.decrypt(token);
      if (expiresDate > 0 && Math.floor(Date.now() / 1000) > expiresDate) {
        throw new BadRequestException('Token has expired');
      }
      return { respHeaders };
    } catch (error) {
      throw new BadRequestException('Invalid token');
    }
  }

  async uploadFileWidthPath(
    bucket: string,
    path: string,
    filePath: string,
    _metadata: Record<string, unknown>
  ) {
    this.save(filePath, join(bucket, path));
    return join(this.readPath, path);
  }
}
