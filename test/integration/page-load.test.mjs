// test/integration/page-load.test.mjs - real-dependency integration test.
// Spins a genuine nginx container via Testcontainers, serves a marker page on a
// random mapped port, then drives Electron (test-main.cjs) to load it over real
// HTTP. This tests what the browser actually does: fetch and render a page from
// a live server. Exit 0 = PASS. Grep-able [integration] lines throughout.
import { GenericContainer } from 'testcontainers';
import { spawnSync } from 'node:child_process';

const html =
  '<!doctype html><html><head><title>HOLLY-INTEGRATION-OK</title></head>' +
  '<body><h1>integration target</h1></body></html>';

console.log('[integration] starting nginx:alpine testcontainer...');
const container = await new GenericContainer('nginx:alpine')
  .withCopyContentToContainer([
    { content: html, target: '/usr/share/nginx/html/index.html' },
  ])
  .withExposedPorts(80)
  .start();

const url = `http://localhost:${container.getMappedPort(80)}/`;
console.log('[integration] serving marker page at', url);

const extra = process.platform === 'linux' ? ['--no-sandbox'] : [];
const r = spawnSync(
  'npx',
  ['electron', ...extra, 'test/integration/test-main.cjs', `--url=${url}`],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);

await container.stop();
console.log('[integration] container stopped, electron exit =', r.status);
process.exit(r.status ?? 1);
