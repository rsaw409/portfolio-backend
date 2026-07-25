import { Request, Response, NextFunction } from 'express';
import { vi, describe, test, beforeEach, expect } from 'vitest';

vi.mock('file-type', () => {
  return {
    fileTypeFromBuffer: vi.fn(),
  };
});

vi.mock('../../../../src/@rsaw409/logger.js', () => {
  return {
    default: {
      error: vi.fn(),
      info: vi.fn(),
    },
  };
});

const { fileValidation } = await import('../../../../src/portfolio-backend/utils/file-validation.js');
const { fileTypeFromBuffer } = await import('file-type');

describe('TEST filevalidation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('Should return if no file found in req', async () => {
    let req: Partial<Request> = {};
    let res: Partial<Response> = {};
    let next: Partial<NextFunction> = vi.fn();
    await fileValidation(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  test('Should return if mimetype is not valid.', async () => {
    let req: Partial<Request> = {
      file: {
        buffer: Buffer.from(""),
      } as Express.Multer.File,
    };
    let res: Partial<Response> = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    let next: Partial<NextFunction> = vi.fn();
    (fileTypeFromBuffer as any).mockImplementation(() => {
      return {
        mime: 'application/pdf',
      };
    });
    await fileValidation(req as Request, res as Response, next as NextFunction);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ message: expect.any(String) });
  });

  test('Should call next if mimetype is valid.', async () => {
    let req: Partial<Request> = {
      file: {
        buffer: Buffer.from(""),
      } as Express.Multer.File,
    };
    let res: Partial<Response> = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    let next: Partial<NextFunction> = vi.fn();
    (fileTypeFromBuffer as any).mockImplementation(() => {
      return {
        mime: 'image/png',
      };
    });
    await fileValidation(req as Request, res as Response, next as NextFunction);
    expect(next).toHaveBeenCalled();
  });
});
