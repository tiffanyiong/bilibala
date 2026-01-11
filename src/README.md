# Bilibala Source Code Structure

This directory contains the reorganized source code for the Bilibala language learning app, structured by feature for better maintainability and scalability.

## 📁 Directory Structure

```
src/
├── features/              # Feature-based modules
│   ├── live-voice/       # Live voice interaction with AI tutor
│   │   ├── components/   # LiveVoiceInterface, DuckAvatar, RescueRing
│   │   ├── services/     # audioUtils (audio processing)
│   │   └── index.ts      # Feature exports
│   │
│   ├── chat/             # Chat and transcript features
│   │   ├── components/   # ChatInterface, Transcript
│   │   └── index.ts      # Feature exports
│   │
│   ├── video/            # Video playback and YouTube integration
│   │   ├── components/   # VideoPlayer
│   │   ├── services/     # youtubeService (video metadata)
│   │   └── index.ts      # Feature exports
│   │
│   └── content/          # Content display (tabs, cards)
│       ├── components/   # ContentTabs, TopicCard, VocabularyCard
│       └── index.ts      # Feature exports
│
├── shared/               # Shared utilities, components, and services
│   ├── components/       # Layout, ControlBar, StatusPill, icons
│   ├── services/         # geminiService, backend (API clients)
│   ├── types/            # TypeScript type definitions
│   ├── constants.ts      # App-wide constants (languages, levels, etc)
│   └── index.ts          # Shared exports
│
├── App.tsx               # Main application component
└── index.tsx             # Application entry point
```

## 🎯 Design Principles

### Feature-Based Organization
Each feature is self-contained with its own:
- **Components**: UI components specific to the feature
- **Services**: Business logic and utilities for the feature
- **Index file**: Clean exports for easy importing

### Shared Resources
Common utilities, components, and services used across multiple features are centralized in `shared/`:
- **Components**: Reusable UI components (Layout, ControlBar, StatusPill, icons)
- **Services**: API clients and backend communication
- **Types**: Shared TypeScript interfaces and types
- **Constants**: App-wide configuration and constants

## 🔧 Import Patterns

### Importing from Features
```typescript
// Import from feature index
import { LiveVoiceInterface } from '@/features/live-voice';
import { VideoPlayer, extractVideoId } from '@/features/video';
import { ContentTabs } from '@/features/content';
```

### Importing from Shared
```typescript
// Import from shared index
import { Layout, AppState, LANGUAGES } from '@/shared';
import { analyzeVideoContent } from '@/shared';
```

### Path Aliases
The `@` alias points to the `src/` directory:
- `@/features/*` → `src/features/*`
- `@/shared/*` → `src/shared/*`

## 🚀 Benefits

1. **Scalability**: Easy to add new features without cluttering existing code
2. **Maintainability**: Clear separation of concerns makes code easier to understand
3. **Reusability**: Shared components and services are centralized
4. **Testability**: Features can be tested in isolation
5. **Team Collaboration**: Multiple developers can work on different features simultaneously

## 📝 Adding New Features

To add a new feature:

1. Create a new directory under `src/features/[feature-name]/`
2. Add `components/` and/or `services/` subdirectories as needed
3. Create an `index.ts` file to export the feature's public API
4. Import and use in `App.tsx` or other components

Example:
```typescript
// src/features/my-feature/index.ts
export { default as MyComponent } from './components/MyComponent';
export * from './services/myService';
```
