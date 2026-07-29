import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildSite } from '../scripts/build.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('buildSite creates a complete Cloudflare static output directory', async (t) => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'simimd-'));
  const outputDirectory = path.join(temporaryRoot, 'dist');

  t.after(async () => {
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  const copiedFiles = await buildSite({
    projectRoot,
    outputDirectory,
  });

  assert.deepEqual(copiedFiles, [
    '_headers',
    '_redirects',
    'css',
    'imgage',
    'index.html',
    'js',
  ]);

  const requiredFiles = [
    'index.html',
    'css/style.css',
    'imgage/icon.ico',
    'js/app.js',
    '_headers',
    '_redirects',
  ];

  await Promise.all(requiredFiles.map((file) => stat(path.join(outputDirectory, file))));

  const indexHtml = await readFile(path.join(outputDirectory, 'index.html'), 'utf8');
  assert.match(indexHtml, /href="css\/style\.css"/);
  assert.match(indexHtml, /src="js\/app\.js\?v=/);
  assert.doesNotMatch(indexHtml, /href=""/);

  await assert.rejects(stat(path.join(outputDirectory, 'md.html')), {
    code: 'ENOENT',
  });
});

test('Cloudflare deployment configuration and documentation stay aligned', async () => {
  const [packageJsonText, readme, wranglerJsonText] = await Promise.all([
    readFile(path.join(projectRoot, 'package.json'), 'utf8'),
    readFile(path.join(projectRoot, 'README.md'), 'utf8'),
    readFile(path.join(projectRoot, 'wrangler.jsonc'), 'utf8'),
  ]);

  const packageJson = JSON.parse(packageJsonText);
  const wranglerConfig = JSON.parse(wranglerJsonText);

  assert.equal(packageJson.scripts.build, 'node scripts/build.mjs');
  assert.equal(packageJson.scripts.deploy, 'npm run build && wrangler deploy');
  assert.equal(
    packageJson.scripts['deploy:pages'],
    'npm run build && wrangler pages deploy dist --project-name simimd --branch cfpage',
  );
  assert.equal(wranglerConfig.name, 'simimd');
  assert.equal(wranglerConfig.assets.directory, './dist');
  assert.equal(wranglerConfig.assets.html_handling, 'auto-trailing-slash');
  assert.equal('pages_build_output_dir' in wranglerConfig, false);
  assert.match(
    readme,
    /deploy\.workers\.cloudflare\.com\/\?url=https:\/\/github\.com\/SimiTalk\/PC_SimiTlakTools\/tree\/cfpage/,
  );
  assert.match(readme, /https:\/\/simimd\.pages\.dev\//);
  assert.match(readme, /https:\/\/simimd\.877781132\.workers\.dev\//);
  assert.match(readme, /Production branch \| `cfpage`/);
  assert.match(readme, /Build command \| `npm run build`/);
  assert.match(readme, /Build output directory \| `dist`/);
  assert.match(readme, /github\.com\/SimiTalk\/PC_SimiTlakTools\/fork/);
  assert.match(readme, /dash\.cloudflare\.com\/\?to=\/:account\/pages\/new\/provider\/github/);
});
