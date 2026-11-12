// Keep generated build output on disk instead of duplicating media in /dev/shm.
// Source images, videos, repository files and page content are never removed.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

function relocateBuildOutput(root, temporaryBase = os.tmpdir()) {
  root = fs.realpathSync(root);
  temporaryBase = fs.realpathSync(temporaryBase);
  if (temporaryBase === root || temporaryBase.startsWith(root + path.sep)) {
    throw new Error('Temporary output must be outside the source directory.');
  }
  const output = path.join(root, '.edgeone');
  if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) {
    const actual = fs.realpathSync(output);
    if (!actual.startsWith(temporaryBase + path.sep + 'liuhai-build-')) {
      throw new Error('Unexpected build output link.');
    }
    return actual;
  }
  const temporaryRoot = fs.mkdtempSync(path.join(temporaryBase, 'liuhai-build-'));
  const destination = path.join(temporaryRoot, '.edgeone');
  if (fs.existsSync(output)) {
    try {
      fs.renameSync(output, destination);
    } catch (error) {
      if (error.code !== 'EXDEV' || process.platform !== 'linux') throw error;
      // mv preserves the existing, generated build metadata across filesystems.
      const moved = spawnSync('/bin/mv', ['--', output, destination], {encoding:'utf8'});
      if (moved.status !== 0) throw new Error('Could not relocate generated build metadata.');
    }
  } else {
    fs.mkdirSync(destination);
  }
  fs.symlinkSync(destination, output, process.platform === 'win32' ? 'junction' : 'dir');
  if (fs.realpathSync(output) !== fs.realpathSync(destination)) {
    throw new Error('Build output link verification failed.');
  }
  console.log('[portfolio] Generated build output uses temporary disk; source media preserved.');
  return destination;
}

module.exports = {relocateBuildOutput};
if (require.main === module) {
  const root = fs.realpathSync(process.cwd());
  if (process.platform === 'linux' && root.startsWith('/dev/shm/repo/')) {
    relocateBuildOutput(root, '/tmp');
  } else {
    console.log('[portfolio] Shared-memory workaround is not needed in this environment.');
  }
}
