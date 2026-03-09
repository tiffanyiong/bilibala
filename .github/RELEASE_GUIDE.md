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
main (develop) → beta → production
```

1. **Develop** on `main` branch (or feature branches)
2. **Create PR to beta** for testing: creates `v1.1.0-beta.1`, `v1.1.0-beta.2`, etc.
3. **Create PR to production** for release: creates `v1.1.0`, `v1.1.1`, etc.

## Examples

### Adding a New Feature (Minor Version)

**Step 1: PR to Beta**
1. Create PR: `main` → `beta`
2. Set PR title: `✨ Add video export feature` or `[minor] Add video export feature`
3. OR add label: `minor` or `feature`
4. Merge PR → Creates: `v1.1.0-beta.1`

**Step 2: PR to Production (after testing)**
1. Create PR: `beta` → `production`
2. Set PR title: `✨ Add video export feature`
3. OR add label: `minor`
4. Merge PR → Creates: `v1.1.0`

---

### Fixing a Bug (Patch Version)

**Step 1: PR to Beta**
1. Create PR: `main` → `beta`
2. Set PR title: `🐛 Fix audio sync issue` or `Fix audio sync issue`
3. OR add label: `patch` or `bugfix` (or no label at all)
4. Merge PR → Creates: `v1.1.1-beta.1`

**Step 2: PR to Production**
1. Create PR: `beta` → `production`
2. Set PR title: `🐛 Fix audio sync issue`
3. Merge PR → Creates: `v1.1.1`

---

### Breaking Changes (Major Version)

**Step 1: PR to Beta**
1. Create PR: `main` → `beta`
2. Set PR title: `[major] Complete UI redesign with new navigation`
3. OR add label: `major` or `breaking`
4. Merge PR → Creates: `v2.0.0-beta.1`

**Step 2: PR to Production**
1. Create PR: `beta` → `production`
2. Set PR title: `[major] Complete UI redesign with new navigation`
3. OR add label: `major`
4. Merge PR → Creates: `v2.0.0`

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

## Notes

- When in doubt, use **labels** - they're visible and easy to understand
- Beta releases help catch issues before production
- You can always create additional releases manually if needed
