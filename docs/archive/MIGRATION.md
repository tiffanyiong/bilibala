# 📦 Migration Guide: Old Structure → New Feature-Based Structure

This document explains the changes made during the reorganization and how to update any code that references the old structure.

## Summary of Changes

The codebase has been reorganized from a flat structure to a feature-based architecture for better scalability and maintainability.

## File Mapping

### Before → After

#### Root Files
```
App.tsx                  → src/App.tsx
index.tsx                → src/index.tsx
types.ts                 → src/shared/types/index.ts
constants.ts             → src/shared/constants.ts
```

#### Components
```
components/Layout.tsx              → src/shared/components/Layout.tsx
components/ControlBar.tsx          → src/shared/components/ControlBar.tsx
components/StatusPill.tsx          → src/shared/components/StatusPill.tsx
components/icons/LiveIcons.tsx     → src/shared/components/icons/LiveIcons.tsx

components/LiveVoiceInterface.tsx  → src/features/live-voice/components/LiveVoiceInterface.tsx
components/DuckAvatar.tsx          → src/features/live-voice/components/DuckAvatar.tsx
components/RescueRing.tsx          → src/features/live-voice/components/RescueRing.tsx

components/ChatInterface.tsx       → src/features/chat/components/ChatInterface.tsx
components/Transcript.tsx          → src/features/chat/components/Transcript.tsx

components/VideoPlayer.tsx         → src/features/video/components/VideoPlayer.tsx

components/ContentTabs.tsx         → src/features/content/components/ContentTabs.tsx
components/TopicCard.tsx           → src/features/content/components/TopicCard.tsx
components/VocabularyCard.tsx      → src/features/content/components/VocabularyCard.tsx
```

#### Services
```
services/backend.ts        → src/shared/services/backend.ts
services/geminiService.ts  → src/shared/services/geminiService.ts
services/youtubeService.ts → src/features/video/services/youtubeService.ts
services/audioUtils.ts     → src/features/live-voice/services/audioUtils.ts
```

## Import Path Changes

### Old Import Patterns
```typescript
// ❌ Old (no longer works)
import Layout from './components/Layout';
import { analyzeVideoContent } from './services/geminiService';
import { AppState } from './types';
import { LANGUAGES } from './constants';
```

### New Import Patterns

#### Option 1: Direct Imports (Explicit)
```typescript
// ✅ New (explicit paths)
import Layout from '@/shared/components/Layout';
import { analyzeVideoContent } from '@/shared/services/geminiService';
import { AppState } from '@/shared/types';
import { LANGUAGES } from '@/shared/constants';
```

#### Option 2: Feature Exports (Recommended)
```typescript
// ✅ New (using feature index files)
import { Layout, AppState, LANGUAGES, analyzeVideoContent } from '@/shared';
import { LiveVoiceInterface } from '@/features/live-voice';
import { VideoPlayer, extractVideoId } from '@/features/video';
import { ContentTabs } from '@/features/content';
import { Transcript } from '@/features/chat';
```

## Configuration Changes

### `vite.config.ts`
```typescript
// Updated alias
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),  // Changed from '.'
  }
}
```

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]  // Changed from "./*"
    }
  }
}
```

### `index.html`
```html
<!-- Updated script path -->
<script type="module" src="/src/index.tsx"></script>
<!-- Changed from "/index.tsx" -->
```

## Breaking Changes

### 1. Import Paths
All import paths have changed. Use the `@/` alias for cleaner imports:
- `@/features/*` - Feature modules
- `@/shared/*` - Shared resources

### 2. File Locations
Files are no longer in the root or flat `components/` directory. They are organized by feature.

### 3. No Breaking Changes to Functionality
The app's functionality remains exactly the same. Only the file organization has changed.

## Quick Migration Checklist

If you have custom code or branches to merge:

- [ ] Update all import statements to use new paths
- [ ] Replace `./components/` with `@/features/*/components/` or `@/shared/components/`
- [ ] Replace `./services/` with `@/features/*/services/` or `@/shared/services/`
- [ ] Replace `./types` with `@/shared/types`
- [ ] Replace `./constants` with `@/shared/constants`
- [ ] Test that the app builds and runs correctly

## Benefits of New Structure

### 1. **Feature Isolation**
Each feature is self-contained with its own components and services.

### 2. **Scalability**
Easy to add new features without cluttering existing code.

### 3. **Maintainability**
Clear separation of concerns makes code easier to understand and modify.

### 4. **Reusability**
Shared components and services are centralized in `src/shared/`.

### 5. **Team Collaboration**
Multiple developers can work on different features simultaneously without conflicts.

### 6. **Code Splitting**
Feature-based structure enables better code splitting and lazy loading.

## Example: Adding a New Feature

### Old Way (Flat Structure)
```
components/
  MyNewComponent.tsx       # Gets lost in a long list
  MyOtherComponent.tsx
services/
  myNewService.ts          # Hard to find related code
```

### New Way (Feature-Based)
```
src/features/my-feature/
  components/
    MyNewComponent.tsx
    MyOtherComponent.tsx
  services/
    myNewService.ts
  index.ts                 # Clean public API
```

```typescript
// Easy to import
import { MyNewComponent } from '@/features/my-feature';
```

## Rollback (If Needed)

If you need to rollback to the old structure:

1. The old files have been removed from the root
2. You can restore from git history:
   ```bash
   git log --all --full-history -- components/
   git checkout <commit-hash> -- components/ services/ types.ts constants.ts
   ```

However, the new structure is recommended for long-term maintainability.

## Questions?

See `src/README.md` for detailed information about the new structure, or `ARCHITECTURE.md` for system-level documentation.
