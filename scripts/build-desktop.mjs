import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const npmCommand = 'npm';
const dotnetCommand = 'dotnet';

const frontendDir = path.join(root, 'frontend');
const backendDir = path.join(root, 'backend');
const frontendDist = path.join(frontendDir, 'dist');
const embeddedFrontend = path.join(backendDir, 'public');
const releaseDir = path.join(root, 'release');
const stagingDir = path.join(releaseDir, 'staging');
const backendExe = path.join(stagingDir, 'ValorantTrackerBackend.exe');
const resourceDir = path.join(root, 'desktop-dotnet', 'ValorantTracker.Desktop', 'Resources');
const resourceBackend = path.join(resourceDir, 'ValorantTrackerBackend.exe');
const desktopProject = path.join(root, 'desktop-dotnet', 'ValorantTracker.Desktop', 'ValorantTracker.Desktop.csproj');
const desktopStaging = path.join(stagingDir, 'desktop');
const finalExe = path.join(releaseDir, 'ValorantTracker.exe');

function assertInsideRoot(target) {
  const resolved = path.resolve(target);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Refusing to modify a path outside the project: ${resolved}`);
  }
  return resolved;
}

function remove(target) {
  fs.rmSync(assertInsideRoot(target), { recursive: true, force: true });
}

function run(command, args) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  if (process.platform === 'win32') {
    const quote = (value) => /[\s&|<>^]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
    const commandLine = [command, ...args].map(quote).join(' ');
    execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandLine], {
      cwd: root,
      stdio: 'inherit'
    });
    return;
  }
  execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}

console.log('Building Valorant Tracker desktop release');
fs.mkdirSync(releaseDir, { recursive: true });
remove(stagingDir);
remove(embeddedFrontend);
remove(resourceDir);
fs.mkdirSync(stagingDir, { recursive: true });
fs.mkdirSync(resourceDir, { recursive: true });

if (!fs.existsSync(path.join(frontendDir, 'node_modules'))) {
  run(npmCommand, ['--prefix', 'frontend', 'ci']);
}
run(npmCommand, ['--prefix', 'frontend', 'run', 'build']);
fs.cpSync(frontendDist, embeddedFrontend, { recursive: true });

if (!fs.existsSync(path.join(backendDir, 'node_modules'))) {
  run(npmCommand, ['--prefix', 'backend', 'ci']);
}
run(npmCommand, ['--prefix', 'backend', 'run', 'build:exe']);

if (!fs.existsSync(backendExe)) {
  throw new Error('Backend packaging completed without producing an executable.');
}
fs.copyFileSync(backendExe, resourceBackend);

run(dotnetCommand, [
  'publish', desktopProject,
  '-c', 'Release',
  '-r', 'win-x64',
  '--self-contained', 'true',
  '-p:PublishSingleFile=true',
  '-p:IncludeNativeLibrariesForSelfExtract=true',
  '-p:EnableCompressionInSingleFile=true',
  '-o', desktopStaging
]);

const publishedExe = path.join(desktopStaging, 'ValorantTracker.Desktop.exe');
if (!fs.existsSync(publishedExe)) {
  throw new Error('Desktop publish completed without producing an executable.');
}

remove(finalExe);
fs.copyFileSync(publishedExe, finalExe);
remove(stagingDir);
remove(resourceDir);

const sizeMb = (fs.statSync(finalExe).size / 1024 / 1024).toFixed(1);
console.log(`\nRelease ready: ${finalExe} (${sizeMb} MB)`);
