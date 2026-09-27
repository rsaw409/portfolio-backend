import { vi, expect, describe, test, afterEach } from 'vitest';

const calls: string[] = [];

vi.mock('sequelize', () => {
  return {
    Sequelize: vi.fn(function (connStr) {
      return {
        authenticate: vi.fn(),
        sync: vi.fn(({ alter, force }) => {
          calls.push(`sync alter=${alter}`);
        }),
        query: vi.fn((sql: string) => {
          calls.push(sql);
        }),
      };
    }),
  };
});

vi.mock('../src/@rsaw409/logger.js', () => {
  return {
    default: {
      error: vi.fn(),
      info: vi.fn(),
    },
  };
});

vi.mock('../src/portfolio-backend/db/postgres', () => {
  return {
    default: vi.fn(),
  };
});

vi.mock('../src/split-backend/db/postgres', () => {
  return {
    default: vi.fn(),
  };
});

const { default: connectToPortfolioDB } =
  await import('../src/portfolio-backend/db/postgres.js');
const { default: connectToSplitDB } =
  await import('../src/portfolio-backend/db/postgres.js');

describe('DBConnection Tests', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('DBConnection initialization', async () => {
    process.env.postgresConnStr = 'tests-postgres';
    const { default: db, DBConnection } = await import('../src/postgres.js');

    const db2 = DBConnection.getInstance();

    expect(db).toEqual(db2);

    await db.init();
    await db.init();

    db.getSequelize();

    expect(db.portfolio_backend).toEqual('portfolio_backend');
    expect(db.split_backend).toEqual('split_backend');
    expect(connectToPortfolioDB).toHaveBeenCalledTimes(1);
    expect(connectToSplitDB).toHaveBeenCalledTimes(1);
  });
});

describe('BIGINT handling', () => {
  test('int8 values come back from node-postgres as numbers', async () => {
    const { default: pg } = await import('pg');
    await import('../src/postgres.js');
    const parse = pg.types.getTypeParser(pg.types.builtins.INT8);
    expect(parse('12050')).toBe(12050);
    expect(parse('-300')).toBe(-300);
  });

  test('refuses an int8 that a number cannot hold exactly', async () => {
    const { parseBigInt } = await import('../src/postgres.js');
    expect(() => parseBigInt('9007199254740993')).toThrow(RangeError);
  });

  test('boot syncs without altering existing tables', () => {
    expect(calls).toEqual(['sync alter=false']);
  });
});
