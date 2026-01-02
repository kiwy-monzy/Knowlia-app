---
description: Clean build artifacts and dependencies to resolve build hangs
---

This workflow helps resolve issues where the build process hangs or fails due to stale cache or artifacts.

1. Clean dist and target directories
// turbo
RMDIR /S /Q dist
// turbo
RMDIR /S /Q src-tauri\target

2. Clean node_modules (optional but recommended if issues persist)
Note: Reinstalling dependencies can take time.
// turbo
RMDIR /S /Q node_modules
// turbo
DEL pnpm-lock.yaml

3. Reinstall dependencies
pnpm install

4. Run build with debug output to identify any remaining issues
pnpm build --debug
