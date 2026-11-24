// .env를 읽은 상태(node --env-file=.env)로 npx 명령을 실행한다. 예: npm run sb -- db push
import { spawnSync } from 'node:child_process'

const result = spawnSync('npx', process.argv.slice(2), { stdio: 'inherit', shell: true })
process.exit(result.status ?? 1)
