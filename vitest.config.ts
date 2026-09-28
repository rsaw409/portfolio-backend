import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `npm run build` compiles __test__ into dist too; running those copies
    // tests whatever the last build was, not the current source.
    exclude: [...configDefaults.exclude, 'dist/**'],
  },
});
