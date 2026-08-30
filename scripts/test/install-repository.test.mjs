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
import { relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import test, { after, before } from 'node:test'
import {
  PLUGIN_ID,
  computeContentDigest,
  currentRelease,
  listSkillDirectories,
} from '../lib/catalog-contract.mjs'
import {
  defaultSymlinkProbe,
  installRepository,
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

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' })
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

function makeBaseCatalog() {
  const root = resolve(scratchRoot, 'base-catalog')
  copyWorkingCatalog(root)
  initializeGitRepository(root, { tag: BASE_RELEASE_TAG })
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
