import { vi, describe, test, beforeEach, expect, Mock } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';

vi.mock('../../../src/split-backend/controller.js', () => {
  return {
    joinGroup: vi.fn(),
    createGroup: vi.fn(),
    createUser: vi.fn(),
    saveTransaction: vi.fn(),
    savePayment: vi.fn(),
    getAllUsersInGroup: vi.fn(),
    getAllTransactionInGroup: vi.fn(),
    getOverviewDataInGroup: vi.fn(),
    savePayments: vi.fn(),
    registerDevice: vi.fn(),
  };
});

const { getAllUsersInGroup, registerDevice } =
  await import('../../../src/split-backend/controller.js');

const { addRoutes } = await import('../../../src/split-backend/routes.js');

describe('TEST routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('test express routes - getAllUsers', async () => {
    (getAllUsersInGroup as Mock).mockImplementation(
      async (_req: Request, res: Response) => {
        return res.status(200).send([]);
      }
    );
    const app = express();
    addRoutes(app);
    const response = await request(app).post('/getAllUsersInGroup');
    expect(getAllUsersInGroup).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  test('test express routes - registerDevice', async () => {
    (registerDevice as Mock).mockImplementation(
      async (_req: Request, res: Response) => {
        return res.status(200).send({});
      }
    );
    const app = express();
    addRoutes(app);
    const response = await request(app).post('/registerDevice');
    expect(registerDevice).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  // ...rest of the test cases...
});
