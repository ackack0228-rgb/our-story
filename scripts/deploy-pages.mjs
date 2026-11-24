// Uploads dist/ to Cloudflare Pages from a folder outside the project.
// wrangler makes and deletes a temp folder under the current directory, and on this machine a
// recursive delete inside the OneDrive-synced project folder crashes node (exit -1073740791).
import { spawnSync, execSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { cp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const project = resolve(import.meta.dirname, '..')
const work = mkdtempSync(join(tmpdir(), 'uri-deploy-'))
// Async on purpose: the sync recursive copy crashes the same way the delete does.
await cp(join(project, 'dist'), join(work, 'dist'), { recursive: true })

// The Pages project name lives in .env (CF_PAGES_PROJECT) so the public repo doesn't name the live site.
const pagesProject = process.env.CF_PAGES_PROJECT
if (!pagesProject) {
  console.error('CF_PAGES_PROJECT is not set in .env')
  process.exit(1)
}

const commit = execSync('git rev-parse HEAD', { cwd: project }).toString().trim()
const result = spawnSync(
  process.execPath,
  [join(project, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), 'pages', 'deploy', 'dist',
    `--project-name=${pagesProject}`, '--branch=main', `--commit-hash=${commit}`, '--commit-dirty=true'],
  { cwd: work, stdio: 'inherit' },
)
// The copy has done its job. Async, like the copy; a leftover folder is not worth failing a deploy.
await rm(work, { recursive: true, force: true }).catch(() => {})
process.exit(result.status ?? 1)
