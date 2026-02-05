# Release Guide

This project uses automatic versioning and releases. When you merge code to `beta` or `production`, a GitHub release is created automatically.

## Version Format

```
v{MAJOR}.{MINOR}.{PATCH}
```

Example: `v1.2.3`

## How to Control Version Bumps

Add keywords to your **merge commit message** to control what version is created:

### MAJOR Version (Breaking Changes)
Use when you make incompatible changes that require users to update their code/usage.

```bash
# Examples:
git merge main -m "[major] Redesign authentication system"
git merge main -m "BREAKING CHANGE: Remove legacy API endpoints"
```

Result: `v1.0.0` → `v2.0.0`

### MINOR Version (New Features)
Use when you add new functionality in a backward-compatible manner.

```bash
# Examples:
git merge main -m "[minor] Add dark mode support"
git merge main -m "feat: Add export to PDF feature"
git merge main -m "feat(auth): Add social login"
```

Result: `v1.0.0` → `v1.1.0`

### PATCH Version (Bug Fixes) - Default
Use for backward-compatible bug fixes. This is the default if no keyword is specified.

```bash
# Examples:
git merge main -m "Fix login button not working"
git merge main -m "Update dependencies"
```

Result: `v1.0.0` → `v1.0.1`

## Quick Reference

| Keyword | Version Bump | When to Use |
|---------|--------------|-------------|
| `[major]` | 1.0.0 → 2.0.0 | Breaking changes, major redesigns |
| `BREAKING CHANGE` | 1.0.0 → 2.0.0 | Same as above |
| `[minor]` | 1.0.0 → 1.1.0 | New features |
| `feat:` | 1.0.0 → 1.1.0 | New features (conventional commits) |
| `feat(scope):` | 1.0.0 → 1.1.0 | New features with scope |
| *(none)* | 1.0.0 → 1.0.1 | Bug fixes, small changes |

## Branch Workflow

```
main (develop) → beta → production
```

1. **Develop** on `main` branch
2. **Merge to beta** for testing: creates `v1.1.0-beta.1`, `v1.1.0-beta.2`, etc.
3. **Merge to production** for release: creates `v1.1.0`, `v1.1.1`, etc.

## Examples

### Adding a new feature
```bash
# On main branch, after making changes
git checkout beta
git merge main -m "[minor] Add video export feature"
git push origin beta
# Creates: v1.1.0-beta.1

# After testing, promote to production
git checkout production
git merge beta -m "[minor] Add video export feature"
git push origin production
# Creates: v1.1.0
```

### Fixing a bug
```bash
git checkout beta
git merge main -m "Fix audio sync issue"
git push origin beta
# Creates: v1.2.0-beta.1 (minor bump for beta)

git checkout production
git merge beta -m "Fix audio sync issue"
git push origin production
# Creates: v1.1.1 (patch bump for production)
```

### Major version bump
```bash
git checkout production
git merge beta -m "[major] Complete UI redesign with new navigation"
git push origin production
# Creates: v2.0.0
```

## View Releases

- **GitHub Releases**: https://github.com/tiffanyiong/bilibala/releases
- **GitHub Actions**: https://github.com/tiffanyiong/bilibala/actions

## Notes

- Keywords are **case-insensitive** (`[MAJOR]` works too)
- Keywords can appear anywhere in the commit message
- Beta releases are marked as "pre-release" on GitHub
- Each merge triggers a new release automatically
