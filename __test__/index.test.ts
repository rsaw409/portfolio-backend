import { vi, describe, test } from 'vitest';

vi.mock('http', () => {
  return {
    createServer: vi.fn(() => {
      return {
        on: vi.fn(),
        listen: vi.fn(),
        setTimeout: vi.fn(),
      };
    }),
    Server: vi.fn(),
  };
});

vi.mock('express', () => {
  return {
    default: vi.fn(() => {
      return {
        use: vi.fn(),
        set: vi.fn(),
      };
    }),
  };
});

vi.mock('../src/portfolio-backend/index.js', () => {
  return {
    default: vi.fn(),
  };
});

vi.mock('../src/tic-toe-backend/index.js', () => {
  return {
    default: vi.fn(),
  };
});

vi.mock('../src/split-backend/index.js', () => {
  return {
    default: vi.fn(),
  };
});

vi.mock('../src/postgres.js', () => {
  return {
    default: {
      init: vi.fn(),
    },
  };
});

describe('TEST main fn', () => {
  test('main() Fn', async () => {
    await import('../src/index.js');
  });
});
