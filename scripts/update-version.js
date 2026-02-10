#!/usr/bin/env node

/**
 * Updates package.json version from the latest git tag
 * Usage: node scripts/update-version.js
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

try {
  // Get the latest git tag
  const gitTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();

  // Remove 'v' prefix if present
  const version = gitTag.startsWith('v') ? gitTag.slice(1) : gitTag;

  // Update version
  packageJson.version = version;

  // Write back to package.json
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  console.log(`✅ Updated package.json version to ${version} (from git tag ${gitTag})`);
} catch {
  // No git available (e.g. Railway build environment) — use existing package.json version
  console.log(`ℹ️  No git tags available, using package.json version: ${packageJson.version}`);
}
