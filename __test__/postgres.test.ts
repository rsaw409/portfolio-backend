import { vi, expect, describe, test, afterEach } from 'vitest';

vi.mock('sequelize', () => {
  return {
    Sequelize: vi.fn(function (connStr) {
      return {
        authenticate: vi.fn(),
        sync: vi.fn(({ alter, force }) => {}),
        query: vi.fn(),
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

const { default: connectToPortfolioDB } = await import(
  '../src/portfolio-backend/db/postgres.js'
);
const { default: connectToSplitDB } = await import(
  '../src/portfolio-backend/db/postgres.js'
);

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
