import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 从 package.json 读取当前版本
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
);
const currentVersion = packageJson.version;

// 读取 CHANGELOG.md
const changelogPath = path.join(__dirname, '../CHANGELOG.md');
const changelog = fs.readFileSync(changelogPath, 'utf8');

// 解析 CHANGELOG.md，提取当前版本的内容
function extractCurrentVersionChangelog(content, version) {
  const lines = content.split('\n');
  const versionHeader = `## [${version}]`;
  
  let startIndex = -1;
  let endIndex = -1;
  
  // 找到当前版本的开始位置
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(versionHeader)) {
      startIndex = i;
      break;
    }
  }
  
  if (startIndex === -1) {
    console.error(`Version ${version} not found in CHANGELOG.md`);
    return `Version ${version} release notes not found in CHANGELOG.md`;
  }
  
  // 找到下一个版本的开始位置（即当前版本的结束位置）
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## [')) {
      endIndex = i;
      break;
    }
  }
  
  // 如果没有找到下一个版本，就取到文件末尾
  if (endIndex === -1) {
    endIndex = lines.length;
  }
  
  // 提取当前版本的内容
  let versionContent = lines.slice(startIndex, endIndex).join('\n').trim();
  
  // 移除分隔线
  versionContent = versionContent.replace(/\n---\n*$/, '').trim();
  
  return versionContent;
}

const releaseNotes = extractCurrentVersionChangelog(changelog, currentVersion);

// 直接输出到标准输出
console.log(releaseNotes);
