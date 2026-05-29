import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let version = args[0];

if (!version) {
  console.error('❌ Error: Please provide a version argument.');
  console.error('Usage: npm run publish -- v0.1.9');
  process.exit(1);
}

// Normalize version strings
// cleanVersion: 0.1.9 (for files)
// tagVersion: v0.1.9 (for git tag)
const cleanVersion = version.startsWith('v') ? version.slice(1) : version;
const tagVersion = version.startsWith('v') ? version : `v${version}`;
const envisCoreDir = 'src-tauri/crates/envis-core';

function getGitOutputWithCwd(command, cwd) {
  return execSync(command, { cwd, stdio: 'pipe' }).toString().trim();
}

function hasStagedChanges(cwd = rootDir) {
  try {
    execSync('git diff --cached --quiet', { cwd, stdio: 'ignore' });
    return false;
  } catch {
    return true;
  }
}

// Validate version format (simple check)
if (!/^\d+\.\d+\.\d+/.test(cleanVersion)) {
  console.error(`❌ Error: Invalid version format "${cleanVersion}". Expected format like 0.1.9`);
  process.exit(1);
}

console.log(`🚀 Starting release process for version ${cleanVersion} (${tagVersion})...`);

try {
  // 0. Commit envis-core changes first (if any)
  const envisCoreAbsDir = path.join(rootDir, envisCoreDir);
  const envisCoreChanges = getGitOutputWithCwd('git status --porcelain', envisCoreAbsDir);
  if (envisCoreChanges.length > 0) {
    console.log('📌 Detected changes in envis-core submodule, committing inside submodule...');
    execSync('git add .', { stdio: 'inherit', cwd: envisCoreAbsDir });

    let committedSubmodule = false;
    if (hasStagedChanges(envisCoreAbsDir)) {
      execSync(`git commit -m "chore(envis-core): prepare release ${tagVersion}"`, {
        stdio: 'inherit',
        cwd: envisCoreAbsDir,
      });
      committedSubmodule = true;
      console.log('✅ Committed envis-core submodule changes');
    } else {
      console.log('ℹ️ No staged changes in envis-core submodule after add, skip commit');
    }

    // If we made a commit inside the sub-repo, push it to its remote as well
    if (committedSubmodule) {
      try {
        console.log('⬆️ Pushing envis-core submodule commits to remote...');
        execSync('git push origin', { stdio: 'inherit', cwd: envisCoreAbsDir });
        console.log('✅ Pushed envis-core submodule to remote');
      } catch (err) {
        console.warn('⚠️ Warning: Failed to push envis-core submodule to remote:', err.message);
      }
    }
  } else {
    console.log('ℹ️ No changes in envis-core submodule, skip pre-commit');
  }

  // 1. Update package.json
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const oldVersion = packageJson.version;
  packageJson.version = cleanVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ Updated package.json (${oldVersion} -> ${cleanVersion})`);

  // 2. Update src-tauri/tauri.conf.json
  const tauriConfPath = path.join(rootDir, 'src-tauri/tauri.conf.json');
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'));
  tauriConf.version = cleanVersion;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log(`✅ Updated src-tauri/tauri.conf.json`);

  // 3. Update src-tauri/Cargo.toml
  const cargoTomlPath = path.join(rootDir, 'src-tauri/Cargo.toml');
  let cargoToml = fs.readFileSync(cargoTomlPath, 'utf-8');
  // Replace version = "x.x.x" inside [package] section
  // We use a regex that looks for version = "..." at the start of a line, which is typical for Cargo.toml
  if (cargoToml.match(/^version = "[^"]+"/m)) {
    cargoToml = cargoToml.replace(/^version = "[^"]+"/m, `version = "${cleanVersion}"`);
    fs.writeFileSync(cargoTomlPath, cargoToml);
    console.log(`✅ Updated src-tauri/Cargo.toml`);
  } else {
    console.warn(`⚠️ Warning: Could not find version field in Cargo.toml`);
  }

  // 4. Git operations
  console.log('📦 Committing and pushing...');
  
  // Stage all files
  execSync(`git add .`, { stdio: 'inherit', cwd: rootDir });
  
  // Commit
  execSync(`git commit -m "chore: release ${tagVersion}"`, { stdio: 'inherit', cwd: rootDir });
  
  // Push commits
  console.log('⬆️ Pushing commits to remote...');
  execSync('git push origin', { stdio: 'inherit', cwd: rootDir });

  // Tag
  console.log('🏷️ Tagging...');
  execSync(`git tag ${tagVersion}`, { stdio: 'inherit', cwd: rootDir });
  
  // Push tag
  console.log('⬆️ Pushing tag to remote...');
  execSync(`git push origin ${tagVersion}`, { stdio: 'inherit', cwd: rootDir });

  console.log(`🎉 Release ${tagVersion} completed successfully!`);

} catch (error) {
  console.error('❌ Error during release process:', error.message);
  process.exit(1);
}
