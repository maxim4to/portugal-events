import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Agent worktrees live under .claude/worktrees — full copies of the repo
    // whose tests must not run (or fail) as part of this checkout's suite.
    exclude: [...configDefaults.exclude, '.claude/**', 'qa/out/**'],
  },
});
