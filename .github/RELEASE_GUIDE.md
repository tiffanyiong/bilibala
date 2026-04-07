# Release Guide

This project uses automatic versioning and releases. When you merge PRs to `beta` or `production`, a GitHub release is created automatically.

## Version Format

```
v{MAJOR}.{MINOR}.{PATCH}
```

Example: `v1.2.3`

## How to Control Version Bumps

Add **labels** or **keywords in PR title** to control what version is created:

### MAJOR Version (Breaking Changes)
Use when you make incompatible changes that require users to update their code/usage.

**Option 1: PR Label**
- Add label: `major` or `breaking`

**Option 2: PR Title**
```
[major] Redesign authentication system
BREAKING CHANGE: Remove legacy API endpoints
```

Result: `v1.0.0` → `v2.0.0`

### MINOR Version (New Features)
Use when you add new functionality in a backward-compatible manner.

**Option 1: PR Label**
- Add label: `minor` or `feature`

**Option 2: PR Title**
```
[minor] Add dark mode support
feat: Add export to PDF feature
✨ Add multi-level video analysis
```

Result: `v1.0.0` → `v1.1.0`

### PATCH Version (Bug Fixes) - Default
Use for backward-compatible bug fixes. This is the default if no keyword/label is specified.

**Option 1: PR Label**
- Add label: `patch` or `bugfix`

**Option 2: PR Title**
```
Fix login button not working
🐛 Fix audio sync issue
chore: Update dependencies
```

Result: `v1.0.0` → `v1.0.1`

## Quick Reference

| PR Label | PR Title Keyword | Version Bump | When to Use |
|----------|------------------|--------------|-------------|
| `major`, `breaking` | `[major]`, `BREAKING CHANGE` | 1.0.0 → 2.0.0 | Breaking changes, major redesigns |
| `minor`, `feature` | `[minor]`, `feat:`, `✨` | 1.0.0 → 1.1.0 | New features |
| `patch`, `bugfix` | `fix:`, `🐛`, `chore:` | 1.0.0 → 1.0.1 | Bug fixes, small changes |
| *(none)* | *(none)* | 1.0.0 → 1.0.1 | Defaults to patch |

## Branch Workflow

```
feature branch → PR → main → PR → beta → PR → production
```

**Never commit directly to `main`, `beta`, or `production`.** Always work on a feature branch and open a PR.

1. **Develop** on a feature branch (e.g. `feat/my-feature`, `fix/my-bug`)
2. **PR to `main`**: merging bumps `package.json` version automatically — no tag or release created
3. **PR to `beta`**: creates `v1.1.0-beta.1`, `v1.1.0-beta.2`, etc. — GitHub prerelease
4. **PR to `production`**: promotes latest beta tag to stable `v1.1.0` — GitHub release

## Examples

### Adding a New Feature (Minor Version)

**Step 1: Feature branch → main**
1. Create branch: `feat/video-export`
2. Open PR to `main` with title: `feat: Add video export feature`
3. Merge PR → `package.json` bumped to `v1.1.0` (no tag created)

**Step 2: main → beta (for testing)**
1. Create PR: `main` → `beta`
2. Add label: `minor` or `feature`
3. Merge PR → Creates: `v1.1.0-beta.1`

**Step 3: beta → production (after testing)**
1. Create PR: `beta` → `production`
2. Merge PR → Promotes beta, creates: `v1.1.0`

---

### Fixing a Bug (Patch Version)

**Step 1: Feature branch → main**
1. Create branch: `fix/audio-sync`
2. Open PR to `main` with title: `fix: Fix audio sync issue`
3. Merge PR → `package.json` bumped to `v1.0.1`

**Step 2: main → beta**
1. Create PR: `main` → `beta`
2. No label needed (patch is default), or add `patch`/`bugfix`
3. Merge PR → Creates: `v1.0.1-beta.1`

**Step 3: beta → production**
1. Create PR: `beta` → `production`
2. Merge PR → Creates: `v1.0.1`

---

### Breaking Changes (Major Version)

**Step 1: Feature branch → main**
1. Create branch: `feat/new-navigation`
2. Open PR to `main` with title: `feat: Complete UI redesign with new navigation`
3. Add label: `major` or `breaking`
4. Merge PR → `package.json` bumped to `v2.0.0`

**Step 2: main → beta**
1. Create PR: `main` → `beta`
2. Add label: `major` or `breaking`
3. Merge PR → Creates: `v2.0.0-beta.1`

**Step 3: beta → production**
1. Create PR: `beta` → `production`
2. Merge PR → Creates: `v2.0.0`

---

### Multiple Changes in One Release

If your PR contains multiple commits with different types:
- **Labels take precedence**: Add the highest-level label needed
- **No label?** System checks PR title, then commit messages
- **Priority order**: major > minor > patch

Example:
- PR has both bug fixes and new features
- Add label: `minor` (since features > fixes)
- Result: Minor version bump

## View Releases

- **GitHub Releases**: https://github.com/tiffanyiong/bilibala/releases
- **GitHub Actions**: https://github.com/tiffanyiong/bilibala/actions

## Real-World PR Examples

### Example 1: New Feature with Label
```
PR #42: main → beta
Title: "Add multi-level video analysis"
Labels: feature
Result: v1.2.0-beta.1
```

### Example 2: Bug Fix with Emoji Title
```
PR #43: main → beta
Title: "🐛 Fix session timeout causing unexpected logout"
Labels: (none)
Result: v1.2.1-beta.1 (patch is default)
```

### Example 3: Breaking Change
```
PR #44: beta → production
Title: "[major] Migrate to new subscription API"
Labels: breaking
Result: v2.0.0
```

### Example 4: Hotfix to Production
```
PR #45: main → beta
Title: "🔒 Fix critical security vulnerability"
Labels: patch

PR #46: beta → production
Title: "🔒 Fix critical security vulnerability"
Labels: patch
Result: v1.2.2
```

## Tips

- **Labels are easiest**: Just add `major`, `minor`, or `patch` label to your PR
- **Emojis work**: GitHub recognizes `✨` (feature), `🐛` (fix), etc.
- **Keywords are case-insensitive**: `[MAJOR]`, `[major]`, `[Major]` all work
- **Priority**: Labels > PR Title > Commit Messages
- **Beta releases** are marked as "pre-release" on GitHub
- **Each PR merge** triggers a new release automatically
- **`package.json` is the version source of truth for `main`** — beta and production derive their version from it, not from git tags

## Gotchas

- **Never resolve `main → beta` conflicts via the GitHub UI** — doing so creates a merge commit on `main`, which re-triggers the main workflow and causes an unintended version bump. Always resolve conflicts locally.
- **`[skip ci]`** in the automated bot commit prevents an infinite loop (the bot bumps `package.json` then pushes back to the branch, which would otherwise re-trigger the workflow).
- **Production skips gracefully** if the stable tag already exists — no crash on duplicate tags.

## Notes

- When in doubt, use **labels** - they're visible and easy to understand
- Beta releases help catch issues before production
- You can always create additional releases manually if needed
