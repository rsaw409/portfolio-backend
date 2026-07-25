import { vi, describe, test } from 'vitest';

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => {
      return {
        storage: {
          from: vi.fn(() => {
            return {
              upload: vi.fn(),
              list: vi.fn(() => {
                return {
                  data: [],
                };
              }),
              remove: vi.fn(),
            };
          }),
        },
      };
    }),
  };
});

vi.mock('base64-arraybuffer', () => {
  return {
    decode: vi.fn(),
  };
});

const { default: supabase } = await import('../../../src/@rsaw409/supabase.js');

describe('TESTS supabase funtions', () => {
  test('uploadFileToSupabse', async () => {
    const file = {
      buffer: {
        toString: vi.fn(),
      },
    } as unknown as Express.Multer.File;
    await supabase.uploadFileToSupabse('dummy/url', file);
  });

  test('deleteFileFromSupabase', async () => {
    await supabase.deleteFileFromSupabase('dummy/url');
  });
});
