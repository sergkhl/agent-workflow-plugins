import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  appendFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import test, { after, before } from 'node:test'
import {
  PLUGIN_ID,
  computeContentDigest,
  currentRelease,
  listSkillDirectories,
  validateCatalog,
} from '../lib/catalog-contract.mjs'
import {
  defaultSymlinkProbe,
  installRepository,
  parseArguments,
  verifyGlobalInstallation,
  verifyInstalledRepository,
} from '../install-repository.mjs'

const catalogWorkingTree = resolve(import.meta.dirname, '..', '..')
// The base fixture is the working tree itself, so its tag has to track the real manifest version.
const { releaseTag: BASE_RELEASE_TAG } = currentRelease(catalogWorkingTree)
const BASE_SKILLS = listSkillDirectories(resolve(catalogWorkingTree, 'plugins', PLUGIN_ID, 'skills'))
// The upgrade fixture must use a version no release pins, since it swaps a real skill for a stub.
const UPGRADE_VERSION = '99.0.0'
const UPGRADE_RELEASE_TAG = `${PLUGIN_ID}--v${UPGRADE_VERSION}`
let scratchRoot
let baseCatalog
let upgradeCatalog

function run(command, args, cwd, env) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', ...(env ? { env } : {}) })
  assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join('\n'))
  return result.stdout.trim()
}

function initializeGitRepository(root, { tag } = {}) {
  run('git', ['init', '-q', '-b', 'main'], root)
  run('git', ['config', 'user.name', 'Agent Workflow Tests'], root)
  run('git', ['config', 'user.email', 'agent-workflow-tests@example.invalid'], root)
  run('git', ['add', '-A'], root)
  run('git', ['commit', '-q', '-m', 'fixture'], root)
  if (tag) run('git', ['tag', tag], root)
}

function copyWorkingCatalog(destination) {
  cpSync(catalogWorkingTree, destination, {
    recursive: true,
    dereference: false,
    filter(source) {
      const path = relative(catalogWorkingTree, source)
      return path !== '.git' && !path.startsWith(`.git${sep}`) && path !== 'node_modules'
    },
  })
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

// Drop working-tree files that only the developer's global Git excludes ignore, so the fixture stays
// clean when Git runs under a fake HOME.
function removeIgnoredFiles(root) {
  run('git', ['clean', '-fdXq'], root)
}

function makeBaseCatalog() {
  const root = resolve(scratchRoot, 'base-catalog')
  copyWorkingCatalog(root)
  initializeGitRepository(root, { tag: BASE_RELEASE_TAG })
  removeIgnoredFiles(root)
  return root
}

function makeUpgradeCatalog() {
  const root = resolve(scratchRoot, 'upgrade-catalog')
  copyWorkingCatalog(root)
  const plugin = resolve(root, 'plugins', PLUGIN_ID)
  const codexPath = resolve(plugin, '.codex-plugin', 'plugin.json')
  const claudePath = resolve(plugin, '.claude-plugin', 'plugin.json')
  const codex = JSON.parse(readFileSync(codexPath, 'utf8'))
  const claude = JSON.parse(readFileSync(claudePath, 'utf8'))
  codex.version = UPGRADE_VERSION
  claude.version = UPGRADE_VERSION
  claude.skills = claude.skills
    .filter((entry) => entry !== './skills/wait-what')
    .concat('./skills/future-skill')
  writeJson(codexPath, codex)
  writeJson(claudePath, claude)

  rmSync(resolve(plugin, 'skills', 'wait-what'), { recursive: true })
  mkdirSync(resolve(plugin, 'skills', 'future-skill'))
  writeFileSync(resolve(plugin, 'skills', 'future-skill', 'SKILL.md'), [
    '---',
    'name: future-skill',
    'description: A fixture skill used to verify upgrade inventory changes.',
    '---',
    '',
    '# Future skill',
    '',
    'Exercise the repository installer upgrade contract.',
    '',
  ].join('\n'))

  unlinkSync(resolve(root, '.agents', 'skills', 'wait-what'))
  symlinkSync(`../../plugins/${PLUGIN_ID}/skills/future-skill`,
    resolve(root, '.agents', 'skills', 'future-skill'), 'dir')
  initializeGitRepository(root, { tag: UPGRADE_RELEASE_TAG })
  removeIgnoredFiles(root)
  return root
}

function makeConsumer(label) {
  const root = resolve(scratchRoot, `${label}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(root)
  writeFileSync(resolve(root, 'README.md'), '# Consumer fixture\n')
  initializeGitRepository(root)
  return root
}

function addProjectSkill(repositoryRoot, name = 'project-only') {
  const directory = resolve(repositoryRoot, '.agents', 'skills', name)
  mkdirSync(directory, { recursive: true })
  writeFileSync(resolve(directory, 'SKILL.md'), `---\nname: ${name}\ndescription: Fixture project skill.\n---\n`)
  return directory
}

function installBase(repositoryRoot, extra = {}, dependencies = {}) {
  return installRepository({
    repositoryRoot,
    pluginId: PLUGIN_ID,
    releaseTag: BASE_RELEASE_TAG,
    source: baseCatalog,
    operation: 'install',
    apply: true,
    ...extra,
  }, dependencies)
}

function treeSnapshot(root) {
  const rows = []
  const walk = (directory, prefix = '') => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (prefix === '' && entry.name === '.git') continue
      const path = resolve(directory, entry.name)
      const name = prefix ? `${prefix}/${entry.name}` : entry.name
      const stat = lstatSync(path)
      if (stat.isSymbolicLink()) {
        rows.push(`link ${name} ${readlinkSync(path)}`)
      } else if (stat.isDirectory()) {
        rows.push(`dir ${name}`)
        walk(path, name)
      } else {
        const digest = createHash('sha256').update(readFileSync(path)).digest('hex')
        rows.push(`file ${name} ${digest}`)
      }
    }
  }
  walk(root)
  return rows
}

function assertManagedLink(repositoryRoot, name) {
  const path = resolve(repositoryRoot, '.agents', 'skills', name)
  assert.ok(lstatSync(path).isSymbolicLink())
  assert.equal(readlinkSync(path), `../plugins/${PLUGIN_ID}/skills/${name}`)
  assert.ok(realpathSync(path).startsWith(realpathSync(repositoryRoot) + sep))
}

before(() => {
  scratchRoot = mkdtempSync(resolve(tmpdir(), 'agent-workflow-installer-tests-'))
  baseCatalog = makeBaseCatalog()
  upgradeCatalog = makeUpgradeCatalog()
})

after(() => {
  rmSync(scratchRoot, { recursive: true, force: true })
})

test('clean installation creates one vendor tree, exact repository links, and a deterministic lock', () => {
  const consumer = makeConsumer('clean')
  const result = installBase(consumer)
  assert.equal(result.applied, true)
  assert.ok(lstatSync(resolve(consumer, '.agents', 'skills')).isDirectory())
  assert.equal(lstatSync(resolve(consumer, '.agents', 'skills')).isSymbolicLink(), false)
  for (const name of BASE_SKILLS) assertManagedLink(consumer, name)
  assert.equal(readlinkSync(resolve(consumer, '.claude', 'skills')), '../.agents/skills')

  const installed = verifyInstalledRepository(consumer)
  assert.equal(installed.lock.releaseTag, BASE_RELEASE_TAG)
  assert.equal(installed.lock.contentDigest, computeContentDigest(installed.paths.vendor))
  assert.equal(installed.lock.managedSymlinks.length, BASE_SKILLS.length + 1)

  const moved = `${consumer}-moved`
  renameSync(consumer, moved)
  assert.doesNotThrow(() => verifyInstalledRepository(moved))
})

test('installation preserves unrelated real project skills', () => {
  const consumer = makeConsumer('project-skill')
  const projectSkill = addProjectSkill(consumer)
  installBase(consumer)
  assert.ok(lstatSync(projectSkill).isDirectory())
  assert.equal(lstatSync(projectSkill).isSymbolicLink(), false)
  assert.ok(existsSync(resolve(projectSkill, 'SKILL.md')))
})

test('an idempotent rerun makes no changes', () => {
  const consumer = makeConsumer('idempotent')
  installBase(consumer)
  const beforeState = treeSnapshot(consumer)
  const lockBefore = readFileSync(resolve(consumer, '.agents', 'plugins', `${PLUGIN_ID}.vendor.json`), 'utf8')
  const result = installBase(consumer)
  assert.equal(result.applied, false)
  assert.deepEqual(treeSnapshot(consumer), beforeState)
  assert.equal(readFileSync(resolve(consumer, '.agents', 'plugins', `${PLUGIN_ID}.vendor.json`), 'utf8'), lockBefore)
})

test('two clean installations generate byte-identical lock files and link inventories', () => {
  const first = makeConsumer('deterministic-a')
  const second = makeConsumer('deterministic-b')
  installBase(first)
  installBase(second)
  const lockPath = (root) => resolve(root, '.agents', 'plugins', `${PLUGIN_ID}.vendor.json`)
  assert.equal(readFileSync(lockPath(first), 'utf8'), readFileSync(lockPath(second), 'utf8'))
})

test('pre-existing exact links are adopted after their single vendor authority is installed', () => {
  const consumer = makeConsumer('adopt-links')
  mkdirSync(resolve(consumer, '.agents', 'skills'), { recursive: true })
  mkdirSync(resolve(consumer, '.claude'), { recursive: true })
  for (const name of BASE_SKILLS) {
    symlinkSync(`../plugins/${PLUGIN_ID}/skills/${name}`,
      resolve(consumer, '.agents', 'skills', name), 'dir')
  }
  symlinkSync('../.agents/skills', resolve(consumer, '.claude', 'skills'), 'dir')
  installBase(consumer)
  assert.doesNotThrow(() => verifyInstalledRepository(consumer))
})

test('file, directory, and wrong-symlink skill collisions produce zero partial writes', async (t) => {
  for (const kind of ['file', 'directory', 'wrong-symlink']) {
    await t.test(kind, () => {
      const consumer = makeConsumer(`collision-${kind}`)
      const collision = resolve(consumer, '.agents', 'skills', 'codebase-design')
      mkdirSync(resolve(consumer, '.agents', 'skills'), { recursive: true })
      if (kind === 'file') writeFileSync(collision, 'project content\n')
      if (kind === 'directory') mkdirSync(collision)
      if (kind === 'wrong-symlink') symlinkSync('../somewhere-else', collision, 'dir')
      const beforeState = treeSnapshot(consumer)
      assert.throws(() => installBase(consumer), /occupied by/)
      assert.deepEqual(treeSnapshot(consumer), beforeState)
      assert.equal(existsSync(resolve(consumer, '.agents', 'plugins', PLUGIN_ID)), false)
    })
  }
})

test('an incompatible real .claude/skills directory blocks installation with zero writes', () => {
  const consumer = makeConsumer('claude-collision')
  mkdirSync(resolve(consumer, '.claude', 'skills'), { recursive: true })
  writeFileSync(resolve(consumer, '.claude', 'skills', 'local.txt'), 'preserve me\n')
  const beforeState = treeSnapshot(consumer)
  assert.throws(() => installBase(consumer), /.claude\/skills is occupied by directory/)
  assert.deepEqual(treeSnapshot(consumer), beforeState)
})

test('--check detects an exact managed link whose target became broken', () => {
  const consumer = makeConsumer('broken-link')
  installBase(consumer)
  rmSync(resolve(consumer, '.agents', 'plugins', PLUGIN_ID, 'skills', 'codebase-design'), { recursive: true })
  assert.throws(() => installRepository({
    repositoryRoot: consumer,
    pluginId: PLUGIN_ID,
    operation: 'check',
  }), /broken symlink/)
})

test('update adds and removes managed links while preserving real project skills', () => {
  const consumer = makeConsumer('update')
  const projectSkill = addProjectSkill(consumer)
  installBase(consumer)
  const result = installRepository({
    repositoryRoot: consumer,
    pluginId: PLUGIN_ID,
    releaseTag: UPGRADE_RELEASE_TAG,
    source: upgradeCatalog,
    operation: 'update',
    apply: true,
  })
  assert.equal(result.applied, true)
  assert.equal(existsSync(resolve(consumer, '.agents', 'skills', 'wait-what')), false)
  assertManagedLink(consumer, 'future-skill')
  assert.ok(lstatSync(projectSkill).isDirectory())
  const installed = verifyInstalledRepository(consumer)
  assert.equal(installed.lock.pluginVersion, UPGRADE_VERSION)
  assert.equal(installed.lock.releaseTag, UPGRADE_RELEASE_TAG)
})

test('update refuses a modified managed link and preserves the complete consumer tree', () => {
  const consumer = makeConsumer('modified-link')
  installBase(consumer)
  const link = resolve(consumer, '.agents', 'skills', 'wait-what')
  unlinkSync(link)
  symlinkSync('../project-owned-target', link, 'dir')
  const beforeState = treeSnapshot(consumer)
  assert.throws(() => installRepository({
    repositoryRoot: consumer,
    pluginId: PLUGIN_ID,
    releaseTag: UPGRADE_RELEASE_TAG,
    source: upgradeCatalog,
    operation: 'update',
    apply: true,
  }), /points to .*expected/)
  assert.deepEqual(treeSnapshot(consumer), beforeState)
})

test('uninstall stops on modified vendor content without deleting anything', () => {
  const consumer = makeConsumer('modified-vendor')
  installBase(consumer)
  appendFileSync(resolve(consumer, '.agents', 'plugins', PLUGIN_ID, 'README.md'), '\nlocal modification\n')
  const beforeState = treeSnapshot(consumer)
  assert.throws(() => installRepository({
    repositoryRoot: consumer,
    pluginId: PLUGIN_ID,
    operation: 'uninstall',
    apply: true,
  }), /local modifications/)
  assert.deepEqual(treeSnapshot(consumer), beforeState)
})

test('safe uninstall removes only locked links and pristine vendor content', () => {
  const consumer = makeConsumer('uninstall')
  const projectSkill = addProjectSkill(consumer)
  installBase(consumer)
  const result = installRepository({
    repositoryRoot: consumer,
    pluginId: PLUGIN_ID,
    operation: 'uninstall',
    apply: true,
  })
  assert.equal(result.applied, true)
  assert.equal(existsSync(resolve(consumer, '.agents', 'plugins', PLUGIN_ID)), false)
  assert.equal(existsSync(resolve(consumer, '.agents', 'plugins', `${PLUGIN_ID}.vendor.json`)), false)
  assert.equal(existsSync(resolve(consumer, '.claude', 'skills')), false)
  for (const name of BASE_SKILLS) assert.equal(existsSync(resolve(consumer, '.agents', 'skills', name)), false)
  assert.ok(lstatSync(projectSkill).isDirectory())
  assert.ok(lstatSync(resolve(consumer, '.agents', 'skills')).isDirectory())
  assert.ok(lstatSync(resolve(consumer, '.agents')).isDirectory())
  assert.ok(lstatSync(resolve(consumer, '.claude')).isDirectory())
})

test('symlink-permission failure explains remediation and never falls back to copies', () => {
  const consumer = makeConsumer('symlink-permission')
  const beforeState = treeSnapshot(consumer)
  const deniedProbe = (root) => defaultSymlinkProbe(root, () => {
    const error = new Error('operation not permitted')
    error.code = 'EPERM'
    throw error
  })
  assert.throws(() => installBase(consumer, {}, { symlinkProbe: deniedProbe }),
    /requires real directory symlinks and never falls back to copies.*symlink permission/is)
  assert.deepEqual(treeSnapshot(consumer), beforeState)
})

const RESOURCE_ROOT = 'dev-setup/catalog'

function verifyCatalog(consumer) {
  return verifyInstalledRepository(consumer, PLUGIN_ID, { catalogRoot: RESOURCE_ROOT })
}

function addPresetLinks(consumer) {
  const project = resolve(consumer, RESOURCE_ROOT, 'skills', 'project-only')
  mkdirSync(project, { recursive: true })
  writeFileSync(resolve(project, 'SKILL.md'), '# Project-owned fixture\n')
  mkdirSync(resolve(consumer, '.agents', 'skills'), { recursive: true })
  mkdirSync(resolve(consumer, '.claude'))
  symlinkSync('../dev-setup/catalog/plugins', resolve(consumer, '.agents', 'plugins'), 'dir')
  symlinkSync('../../dev-setup/catalog/skills/project-only',
    resolve(consumer, '.agents', 'skills', 'project-only'), 'dir')
  for (const name of ['drain-plans', 'wait-what']) {
    symlinkSync(`../../dev-setup/catalog/skills/${name}`,
      resolve(consumer, '.agents', 'skills', name), 'dir')
  }
  symlinkSync('../.agents/skills', resolve(consumer, '.claude', 'skills'), 'dir')
  writeFileSync(resolve(consumer, 'preset.json'), '{"selected":"fixture-preset"}\n')
  return project
}

function updateCatalog(consumer, extra = {}, dependencies = {}) {
  return installBase(consumer, {
    catalogRoot: RESOURCE_ROOT,
    operation: 'update',
    source: upgradeCatalog,
    releaseTag: UPGRADE_RELEASE_TAG,
    ...extra,
  }, dependencies)
}

test('catalog preflight, install, check, and repeat preserve setup-owned discovery and project skills', () => {
  const consumer = makeConsumer('catalog')
  addPresetLinks(consumer)
  const beforeState = treeSnapshot(consumer)
  const preflight = installBase(consumer, { catalogRoot: RESOURCE_ROOT, apply: false })
  assert.equal(preflight.applied, false)
  assert.deepEqual(treeSnapshot(consumer), beforeState)
  const first = installBase(consumer, { catalogRoot: RESOURCE_ROOT })
  assert.equal(first.lock.schemaVersion, 2)
  assert.deepEqual(first.lock.layout, { type: 'catalog', root: RESOURCE_ROOT })
  assert.ok(first.lock.managedSymlinks.every(link => link.path.startsWith(`${RESOURCE_ROOT}/skills/`)))
  assert.equal(first.lock.managedSymlinks.length, BASE_SKILLS.length)
  verifyCatalog(consumer)
  const installed = treeSnapshot(consumer)
  const again = installBase(consumer, { catalogRoot: RESOURCE_ROOT })
  assert.equal(again.applied, false)
  assert.deepEqual(treeSnapshot(consumer), installed)
  for (const row of beforeState) assert.ok(installed.includes(row), row)
  const check = installRepository({ repositoryRoot: consumer, pluginId: PLUGIN_ID,
    catalogRoot: RESOURCE_ROOT, operation: 'check' })
  assert.equal(check.applied, false)
  assert.deepEqual(treeSnapshot(consumer), installed)
})

test('catalog update and uninstall touch only catalog-managed resources', () => {
  const consumer = makeConsumer('catalog-update')
  addPresetLinks(consumer)
  const preserved = treeSnapshot(consumer)
  installBase(consumer, { catalogRoot: RESOURCE_ROOT })
  const beforeUpdate = treeSnapshot(consumer)
  updateCatalog(consumer, { apply: false })
  assert.deepEqual(treeSnapshot(consumer), beforeUpdate)
  updateCatalog(consumer)
  assert.ok(existsSync(resolve(consumer, RESOURCE_ROOT, 'skills', 'future-skill')))
  assert.equal(existsSync(resolve(consumer, RESOURCE_ROOT, 'skills', 'wait-what')), false)
  verifyCatalog(consumer)
  const beforeUninstall = treeSnapshot(consumer)
  const options = { repositoryRoot: consumer, pluginId: PLUGIN_ID,
    catalogRoot: RESOURCE_ROOT, operation: 'uninstall' }
  installRepository(options)
  assert.deepEqual(treeSnapshot(consumer), beforeUninstall)
  installRepository({ ...options, apply: true })
  const finalState = treeSnapshot(consumer)
  for (const row of preserved) assert.ok(finalState.includes(row), row)
  assert.equal(existsSync(resolve(consumer, RESOURCE_ROOT, 'plugins', PLUGIN_ID)), false)
  assert.ok(lstatSync(resolve(consumer, '.agents', 'plugins')).isSymbolicLink())
})

test('catalog installation refuses a portable name occupied by a project skill without writes', () => {
  const consumer = makeConsumer('catalog-project-collision')
  addPresetLinks(consumer)
  const project = resolve(consumer, RESOURCE_ROOT, 'skills', 'grilling')
  mkdirSync(project)
  writeFileSync(resolve(project, 'SKILL.md'), '# Project-owned grilling skill\n')
  const beforeState = treeSnapshot(consumer)
  assert.throws(() => installBase(consumer, { catalogRoot: RESOURCE_ROOT }), /occupied by directory/)
  assert.deepEqual(treeSnapshot(consumer), beforeState)
})

test('legacy catalog lock migrates only on update after verifying actual catalog links', () => {
  const consumer = makeConsumer('legacy-catalog')
  installBase(consumer)
  mkdirSync(resolve(consumer, 'dev-setup'))
  renameSync(resolve(consumer, '.agents'), resolve(consumer, RESOURCE_ROOT))
  unlinkSync(resolve(consumer, '.claude', 'skills'))
  const beforeState = treeSnapshot(consumer)
  assert.equal(verifyCatalog(consumer).legacyCatalog, true)
  assert.equal(verifyCatalog(consumer).lock.schemaVersion, 1)
  installBase(consumer, { catalogRoot: RESOURCE_ROOT, operation: 'update', apply: false })
  assert.deepEqual(treeSnapshot(consumer), beforeState)
  assert.throws(() => installBase(consumer, { catalogRoot: RESOURCE_ROOT }), /use --update/)
  assert.deepEqual(treeSnapshot(consumer), beforeState)
  installBase(consumer, { catalogRoot: RESOURCE_ROOT, operation: 'update' })
  const verified = verifyCatalog(consumer)
  assert.equal(verified.legacyCatalog, false)
  assert.equal(verified.lock.schemaVersion, 2)
  assert.equal(existsSync(resolve(consumer, '.agents')), false)
  assert.deepEqual(readdirSync(resolve(consumer, '.claude')), [])
})

test('catalog migration rejects altered vendor content, manifests, and managed links without writes', () => {
  for (const alteration of ['vendor', 'manifest', 'link']) {
    const consumer = makeConsumer(`legacy-${alteration}`)
    installBase(consumer)
    mkdirSync(resolve(consumer, 'dev-setup'))
    renameSync(resolve(consumer, '.agents'), resolve(consumer, RESOURCE_ROOT))
    if (alteration === 'vendor') {
      appendFileSync(resolve(consumer, RESOURCE_ROOT, 'plugins', PLUGIN_ID, 'README.md'), '\nmodified\n')
    } else if (alteration === 'manifest') {
      const vendor = resolve(consumer, RESOURCE_ROOT, 'plugins', PLUGIN_ID)
      const manifestPath = resolve(vendor, '.claude-plugin', 'plugin.json')
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      manifest.skills.pop()
      writeJson(manifestPath, manifest)
      // Even a recomputed digest must not hide a manifest/inventory mismatch.
      const lockPath = resolve(consumer, RESOURCE_ROOT, 'plugins', `${PLUGIN_ID}.vendor.json`)
      const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
      lock.contentDigest = computeContentDigest(vendor)
      writeJson(lockPath, lock)
    } else {
      const link = resolve(consumer, RESOURCE_ROOT, 'skills', 'wait-what')
      unlinkSync(link)
      symlinkSync('../unowned', link, 'dir')
    }
    const beforeState = treeSnapshot(consumer)
    assert.throws(() => updateCatalog(consumer), /local modifications|manifest skill inventory|points to .*expected/)
    assert.deepEqual(treeSnapshot(consumer), beforeState)
  }
})

test('catalog roots reject unsafe paths and symlink ancestors without writes', () => {
  for (const catalogRoot of ['../escape', '/tmp/catalog', '.', '.git/resources',
    '.GIT/resources', '.Agents', '.CLAUDE', 'catalog.',
    '.agents', 'dev-setup/../catalog', 'dev-setup//catalog', 'C:\\catalog']) {
    const consumer = makeConsumer('unsafe-catalog')
    const beforeState = treeSnapshot(consumer)
    assert.throws(() => installBase(consumer, { catalogRoot }), /safe repository-relative/)
    assert.deepEqual(treeSnapshot(consumer), beforeState)
  }
  const consumer = makeConsumer('catalog-symlink-parent')
  const external = makeConsumer('unrelated-directory')
  symlinkSync(external, resolve(consumer, 'dev-setup'), 'dir')
  const beforeState = treeSnapshot(consumer)
  const beforeExternal = treeSnapshot(external)
  assert.throws(() => installBase(consumer, { catalogRoot: RESOURCE_ROOT }), /must be a real directory/)
  assert.deepEqual(treeSnapshot(consumer), beforeState)
  assert.deepEqual(treeSnapshot(external), beforeExternal)
})

test('catalog lock rejects a mismatched layout or a path outside its managed skill root', () => {
  for (const corruption of ['layout', 'link']) {
    const consumer = makeConsumer(`catalog-lock-${corruption}`)
    installBase(consumer, { catalogRoot: RESOURCE_ROOT })
    const path = resolve(consumer, RESOURCE_ROOT, 'plugins', `${PLUGIN_ID}.vendor.json`)
    const lock = JSON.parse(readFileSync(path, 'utf8'))
    if (corruption === 'layout') lock.layout.root = 'other/catalog'
    else lock.managedSymlinks[0].path = '../outside'
    writeJson(path, lock)
    const beforeState = treeSnapshot(consumer)
    assert.throws(() => verifyCatalog(consumer), /layout does not match|Unsafe managed symlink/)
    assert.deepEqual(treeSnapshot(consumer), beforeState)
  }
})

test('catalog update rolls back the vendor, lock, and removed links after a new-link collision', () => {
  const consumer = makeConsumer('catalog-rollback')
  addPresetLinks(consumer)
  installBase(consumer, { catalogRoot: RESOURCE_ROOT })
  let beforeApply
  assert.throws(() => updateCatalog(consumer, {}, { symlinkProbe() {
    // Another actor adds an unowned directory after preflight; preserve that addition on rollback.
    mkdirSync(resolve(consumer, RESOURCE_ROOT, 'skills', 'future-skill'))
    beforeApply = treeSnapshot(consumer)
  } }), /changed after preflight/)
  assert.deepEqual(treeSnapshot(consumer), beforeApply)
  assert.equal(verifyCatalog(consumer).lock.releaseTag, BASE_RELEASE_TAG)
})

test('CLI catalog selection supports every operation without changing direct-install defaults', () => {
  const consumer = makeConsumer('catalog-cli')
  const cli = resolve(catalogWorkingTree, 'scripts', 'install-repository.mjs')
  const args = [cli, '--repo', consumer, '--plugin', PLUGIN_ID, '--catalog-root', RESOURCE_ROOT]
  run(process.execPath, [...args, '--source', baseCatalog, '--ref', BASE_RELEASE_TAG, '--apply'], consumer)
  run(process.execPath, [...args, '--check'], consumer)
  run(process.execPath, [...args, '--source', upgradeCatalog, '--ref', UPGRADE_RELEASE_TAG, '--update', '--apply'], consumer)
  assert.equal(verifyCatalog(consumer).lock.releaseTag, UPGRADE_RELEASE_TAG)
  run(process.execPath, [...args, '--uninstall', '--apply'], consumer)
  assert.equal(existsSync(resolve(consumer, '.agents')), false)
})

function globalUpdate(extra = {}) {
  return { operation: 'update', releaseTag: UPGRADE_RELEASE_TAG, source: upgradeCatalog, ...extra }
}

function makeHome(label) {
  const home = resolve(scratchRoot, `home-${label}-${Math.random().toString(16).slice(2)}`)
  for (const skill of ['personal-only', 'synced/from-claude-ai']) {
    const directory = resolve(home, '.claude', 'skills', skill)
    mkdirSync(directory, { recursive: true })
    writeFileSync(resolve(directory, 'SKILL.md'),
      `---\nname: ${skill.split('/').pop()}\ndescription: Fixture personal skill.\n---\n`)
  }
  return home
}

// Always target the fixture home; a global call without homeRoot would reach the real ~/.claude.
function installGlobal(home, extra = {}, dependencies = {}) {
  return installRepository({
    global: true,
    pluginId: PLUGIN_ID,
    releaseTag: BASE_RELEASE_TAG,
    source: baseCatalog,
    operation: 'install',
    apply: true,
    ...extra,
  }, { env: {}, ...dependencies, homeRoot: home })
}

function assertGlobalLink(home, name) {
  const path = resolve(home, '.claude', 'skills', name)
  assert.ok(lstatSync(path).isSymbolicLink(), `${name} must be a symlink`)
  assert.equal(readlinkSync(path), `../../.agents/plugins/${PLUGIN_ID}/skills/${name}`)
  assert.equal(realpathSync(path), realpathSync(resolve(home, '.agents', 'plugins', PLUGIN_ID, 'skills', name)))
}

function globalLockPath(home) {
  return resolve(home, '.agents', 'plugins', `${PLUGIN_ID}.vendor.json`)
}

test('global installation links every skill into personal Claude skills beside unmanaged entries', () => {
  const home = makeHome('global-clean')
  const initial = treeSnapshot(home)
  assert.equal(installGlobal(home).applied, true)
  for (const name of BASE_SKILLS) assertGlobalLink(home, name)
  assert.equal(existsSync(resolve(home, '.agents', 'skills')), false)
  const installed = treeSnapshot(home)
  for (const row of initial) assert.ok(installed.includes(row), row)

  const verified = verifyGlobalInstallation(home)
  assert.equal(verified.lock.schemaVersion, 2)
  assert.deepEqual(verified.lock.layout, { type: 'global' })
  assert.equal(verified.lock.managedSymlinks.length, BASE_SKILLS.length)
  assert.ok(verified.lock.managedSymlinks.every((link) => link.path.startsWith('.claude/skills/')))

  const moved = `${home}-moved`
  renameSync(home, moved)
  assert.doesNotThrow(() => verifyGlobalInstallation(moved))
})

test('global preflight writes nothing and an exact rerun changes nothing', () => {
  const home = makeHome('global-idempotent')
  const initial = treeSnapshot(home)
  assert.equal(installGlobal(home, { apply: false }).applied, false)
  assert.deepEqual(treeSnapshot(home), initial)
  installGlobal(home)
  const installed = treeSnapshot(home)
  const lockBefore = readFileSync(globalLockPath(home), 'utf8')
  assert.equal(installGlobal(home).applied, false)
  assert.deepEqual(treeSnapshot(home), installed)
  assert.equal(readFileSync(globalLockPath(home), 'utf8'), lockBefore)
})

test('a personal skill occupying a managed name blocks global installation without writes', async (t) => {
  for (const kind of ['file', 'directory', 'wrong-symlink']) {
    await t.test(kind, () => {
      const home = makeHome(`global-collision-${kind}`)
      const collision = resolve(home, '.claude', 'skills', 'codebase-design')
      if (kind === 'file') writeFileSync(collision, 'personal content\n')
      if (kind === 'directory') mkdirSync(collision)
      if (kind === 'wrong-symlink') symlinkSync('../somewhere-else', collision, 'dir')
      const beforeState = treeSnapshot(home)
      assert.throws(() => installGlobal(home), /occupied by/)
      assert.deepEqual(treeSnapshot(home), beforeState)
      assert.equal(existsSync(resolve(home, '.agents')), false)
    })
  }
})

test('a symlinked global anchor is refused without writing through it', async (t) => {
  for (const anchor of ['.claude', '.claude/skills', '.agents', '.agents/plugins']) {
    await t.test(anchor, () => {
      const home = makeHome(`global-anchor-${anchor.replace(/[./]/g, '-')}`)
      const outside = resolve(scratchRoot, `outside-${Math.random().toString(16).slice(2)}`)
      mkdirSync(outside)
      const path = resolve(home, anchor)
      rmSync(path, { recursive: true, force: true })
      mkdirSync(dirname(path), { recursive: true })
      symlinkSync(outside, path, 'dir')
      const beforeHome = treeSnapshot(home)
      assert.throws(() => installGlobal(home), /must be a real directory/)
      assert.deepEqual(treeSnapshot(home), beforeHome)
      assert.deepEqual(readdirSync(outside), [])
    })
  }
})

test('global installation requires an absolute home that already has a Claude user directory', () => {
  for (const homeRoot of ['', 'relative/home']) {
    assert.throws(() => installRepository({ global: true, pluginId: PLUGIN_ID, operation: 'check' },
      { env: {}, homeRoot }), /absolute home directory/)
  }
  const home = resolve(scratchRoot, `home-without-claude-${Math.random().toString(16).slice(2)}`)
  mkdirSync(home)
  assert.throws(() => installGlobal(home), /existing Claude Code user directory/)
  assert.deepEqual(readdirSync(home), [])
})

test('a relocated CLAUDE_CONFIG_DIR blocks global install, update, and check but not uninstall', () => {
  const home = makeHome('global-config-dir')
  const elsewhere = resolve(scratchRoot, `claude-config-${Math.random().toString(16).slice(2)}`)
  mkdirSync(elsewhere)
  const relocated = { env: { CLAUDE_CONFIG_DIR: elsewhere } }
  const initial = treeSnapshot(home)
  assert.throws(() => installGlobal(home, {}, relocated), /CLAUDE_CONFIG_DIR=/)
  assert.deepEqual(treeSnapshot(home), initial)

  installGlobal(home, {}, { env: { CLAUDE_CONFIG_DIR: resolve(home, '.claude') } })
  assert.throws(() => installGlobal(home, { operation: 'check', apply: false }, relocated), /CLAUDE_CONFIG_DIR=/)
  assert.throws(() => installGlobal(home, globalUpdate({ apply: false }), relocated), /CLAUDE_CONFIG_DIR=/)
  assert.equal(installGlobal(home, { operation: 'uninstall' }, relocated).applied, true)
})

test('global update adds and removes managed links while preserving personal skills', () => {
  const home = makeHome('global-update')
  installGlobal(home)
  const beforeUpdate = treeSnapshot(home)
  assert.equal(installGlobal(home, globalUpdate({ apply: false })).applied, false)
  assert.deepEqual(treeSnapshot(home), beforeUpdate)
  assert.equal(installGlobal(home, globalUpdate()).applied, true)
  assert.equal(existsSync(resolve(home, '.claude', 'skills', 'wait-what')), false)
  assertGlobalLink(home, 'future-skill')
  assert.ok(existsSync(resolve(home, '.claude', 'skills', 'personal-only', 'SKILL.md')))
  assert.ok(existsSync(resolve(home, '.claude', 'skills', 'synced', 'from-claude-ai', 'SKILL.md')))
  assert.equal(verifyGlobalInstallation(home).lock.releaseTag, UPGRADE_RELEASE_TAG)
})

test('global update refuses a hijacked managed link and preserves the home', () => {
  const home = makeHome('global-hijack')
  installGlobal(home)
  const link = resolve(home, '.claude', 'skills', 'wait-what')
  unlinkSync(link)
  symlinkSync('../personal-target', link, 'dir')
  const beforeState = treeSnapshot(home)
  assert.throws(() => installGlobal(home, globalUpdate()), /points to .*expected/)
  assert.deepEqual(treeSnapshot(home), beforeState)
})

test('global uninstall removes only the snapshot, lock, and managed links', () => {
  const home = makeHome('global-uninstall')
  const initial = treeSnapshot(home)
  installGlobal(home)
  const installed = treeSnapshot(home)
  assert.equal(installGlobal(home, { operation: 'uninstall', apply: false }).applied, false)
  assert.deepEqual(treeSnapshot(home), installed)
  assert.equal(installGlobal(home, { operation: 'uninstall' }).applied, true)
  assert.deepEqual(treeSnapshot(home), ['dir .agents', 'dir .agents/plugins', ...initial])
})

test('global and repository installations sharing a lock path refuse each other without writes', () => {
  // A home directory can itself be a Git repository, where both layouts use .agents/plugins.
  const globalHome = makeHome('global-git-home')
  initializeGitRepository(globalHome)
  installGlobal(globalHome)
  const globalState = treeSnapshot(globalHome)
  assert.throws(() => verifyInstalledRepository(globalHome), /layout does not match/)
  assert.throws(() => installBase(globalHome), /layout does not match/)
  assert.deepEqual(treeSnapshot(globalHome), globalState)

  const repositoryHome = makeConsumer('direct-home')
  installBase(repositoryHome)
  const repositoryState = treeSnapshot(repositoryHome)
  assert.throws(() => installGlobal(repositoryHome), /\.claude\/skills must be a real directory/)
  assert.throws(() => verifyGlobalInstallation(repositoryHome), /\.claude\/skills must be a real directory/)
  assert.deepEqual(treeSnapshot(repositoryHome), repositoryState)
})

test('a global lock rejects a foreign layout or a link outside personal skills', () => {
  for (const [corruption, expected] of [['layout', /layout does not match/], ['link', /Unsafe managed symlink/]]) {
    const home = makeHome(`global-lock-${corruption}`)
    installGlobal(home)
    const lock = JSON.parse(readFileSync(globalLockPath(home), 'utf8'))
    if (corruption === 'layout') lock.layout.root = 'somewhere'
    else lock.managedSymlinks[0].path = '.agents/skills/codebase-design'
    writeJson(globalLockPath(home), lock)
    const beforeState = treeSnapshot(home)
    assert.throws(() => verifyGlobalInstallation(home), expected)
    assert.throws(() => installGlobal(home, { operation: 'uninstall' }), expected)
    assert.deepEqual(treeSnapshot(home), beforeState)
  }
})

test('--global excludes repository selection in the CLI parser and the API', () => {
  const check = ['--plugin', PLUGIN_ID, '--check']
  assert.throws(() => parseArguments([...check, '--global', '--repo', '.']), /cannot be combined/)
  assert.throws(() => parseArguments([...check, '--global', '--catalog-root', RESOURCE_ROOT]), /cannot be combined/)
  assert.throws(() => parseArguments(check), /--repo <root> or --global is required/)
  assert.equal(parseArguments([...check, '--global']).global, true)

  const home = makeHome('global-api')
  for (const extra of [{ repositoryRoot: catalogWorkingTree }, { catalogRoot: RESOURCE_ROOT }]) {
    assert.throws(() => installRepository({ global: true, pluginId: PLUGIN_ID, operation: 'check', ...extra },
      { env: {}, homeRoot: home }), /cannot be combined/)
  }
  assert.throws(() => installRepository({ pluginId: PLUGIN_ID, operation: 'check' }),
    /--repo <root> or --global is required/)
})

test('CLI --global supports every operation against the HOME directory', () => {
  const home = makeHome('global-cli')
  const env = { ...process.env, HOME: home, USERPROFILE: home }
  delete env.CLAUDE_CONFIG_DIR
  const cli = resolve(catalogWorkingTree, 'scripts', 'install-repository.mjs')
  const args = [cli, '--global', '--plugin', PLUGIN_ID]
  const initial = treeSnapshot(home)
  run(process.execPath, [...args, '--source', baseCatalog, '--ref', BASE_RELEASE_TAG], home, env)
  assert.deepEqual(treeSnapshot(home), initial)
  run(process.execPath, [...args, '--source', baseCatalog, '--ref', BASE_RELEASE_TAG, '--apply'], home, env)
  run(process.execPath, [...args, '--check'], home, env)
  run(process.execPath, [...args, '--source', upgradeCatalog, '--ref', UPGRADE_RELEASE_TAG, '--update', '--apply'],
    home, env)
  assert.equal(verifyGlobalInstallation(home).lock.releaseTag, UPGRADE_RELEASE_TAG)
  run(process.execPath, [...args, '--uninstall', '--apply'], home, env)
  assert.deepEqual(treeSnapshot(home), ['dir .agents', 'dir .agents/plugins', ...initial])
})

test('the running installer still validates older catalogs whose Claude marketplace carries Codex metadata', () => {
  const legacy = resolve(scratchRoot, 'legacy-marketplace-catalog')
  copyWorkingCatalog(legacy)
  const claudePath = resolve(legacy, '.claude-plugin', 'marketplace.json')
  const claude = JSON.parse(readFileSync(claudePath, 'utf8'))
  claude.interface = { displayName: 'Agent Workflow Plugins' }
  claude.plugins[0].policy = { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }
  writeJson(claudePath, claude)
  assert.doesNotThrow(() => validateCatalog(legacy))

  const codexPath = resolve(legacy, '.agents', 'plugins', 'marketplace.json')
  const codex = JSON.parse(readFileSync(codexPath, 'utf8'))
  delete codex.interface
  writeJson(codexPath, codex)
  assert.throws(() => validateCatalog(legacy), /Codex marketplace display name/)
})
