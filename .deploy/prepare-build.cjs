// Move only this temporary clone's Git object cache out of shared memory.
// Source media and the platform's generated output directory stay in place.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

function relocateCloneCache(root, temporaryBase = os.tmpdir()) {
  root = fs.realpathSync(root);
  temporaryBase = fs.realpathSync(temporaryBase);
  if (temporaryBase === root || temporaryBase.startsWith(root + path.sep)) {
    throw new Error('Temporary cache must be outside the source directory.');
  }
  const output = path.join(root, '.git', 'objects');
  if (!fs.existsSync(output)) {
    console.log('[portfolio] No temporary Git object cache to relocate.');
    return null;
  }
  if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) {
    const actual = fs.realpathSync(output);
    if (!actual.startsWith(temporaryBase + path.sep + 'liuhai-build-')) {
      throw new Error('Unexpected Git object cache link.');
    }
    return actual;
  }
  const temporaryRoot = fs.mkdtempSync(path.join(temporaryBase, 'liuhai-build-'));
  const destination = path.join(temporaryRoot, 'objects');
  if (fs.existsSync(output)) {
    try {
      fs.renameSync(output, destination);
    } catch (error) {
      if (error.code !== 'EXDEV' || process.platform !== 'linux') throw error;
      // mv preserves all temporary clone objects across filesystems.
      const moved = spawnSync('/bin/mv', ['--', output, destination], {encoding:'utf8'});
      if (moved.status !== 0) throw new Error('Could not relocate the temporary Git object cache.');
    }
  } else {
    fs.mkdirSync(destination);
  }
  fs.symlinkSync(destination, output, process.platform === 'win32' ? 'junction' : 'dir');
  if (fs.realpathSync(output) !== fs.realpathSync(destination)) {
    throw new Error('Git object cache link verification failed.');
  }
  console.log('[portfolio] Temporary clone objects use disk; source media and .edgeone output stay unchanged.');
  return destination;
}

module.exports = {relocateCloneCache};
if (require.main === module) {
  const root = fs.realpathSync(process.cwd());
  if (process.platform === 'linux' && root.startsWith('/dev/shm/repo/')) {
    relocateCloneCache(root, '/tmp');
  } else {
    console.log('[portfolio] Shared-memory workaround is not needed in this environment.');
  }
}
