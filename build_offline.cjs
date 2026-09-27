// Run after changes to any shipped file; commit sw.js and offline-info.json together.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = __dirname;
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const bank = JSON.parse(fs.readFileSync(path.join(root, 'questions.json'), 'utf8'));
const files = new Set(['index.html', 'updates.html', 'styles.css', 'app.js', 'offline.js',
  'theme.js', 'support.js', 'questions.js', 'favicon.svg', 'site.webmanifest',
  'SOURCE_REVIEW.md', 'QUESTION_REVIEW.md']);
for (const q of bank) for (const image of q.images || []) files.add(image.src);
for (const icon of JSON.parse(fs.readFileSync(path.join(root, 'site.webmanifest'), 'utf8')).icons) files.add(icon.src);
files.add('icons/icon-180.png');
// Discover local HTML assets as well, so a future script cannot silently be omitted.
for (const page of ['index.html', 'updates.html']) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"#?]+)(?:\?[^"#]*)?(?:#[^"]*)?"/g)) {
    const file = match[1];
    if (!/^[a-z]+:|^\/\//i.test(file) && fs.existsSync(path.join(root, file)) && !file.endsWith('.pdf')) files.add(file);
  }
}
const assets = [...files].sort().map(url => {
  if (url.includes('..') || path.isAbsolute(url)) throw new Error(`Unsafe asset: ${url}`);
  const data = fs.readFileSync(path.join(root, url));
  const text = /\.(?:html|css|js|json|webmanifest|svg|md)$/.test(url);
  const canonical = text ? Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n')) : data;
  return {url, bytes: canonical.length, text, sha256: digest(canonical)};
});
const template = fs.readFileSync(path.join(root, 'sw-template.js'), 'utf8').replace(/\r\n/g, '\n');
const version = digest(JSON.stringify(assets) + template).slice(0, 20);
const info = {version, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0), files: assets.length};
const worker = template.replace('/* OFFLINE_BUNDLE */', JSON.stringify({...info, assets}));
const outputs = {'sw.js': worker, 'offline-info.json': JSON.stringify(info, null, 2) + '\n'};
for (const [file, content] of Object.entries(outputs)) {
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(path.join(root,file)) || fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g, '\n') !== content) {
      throw new Error(`${file} is stale. Run node build_offline.cjs`);
    }
  } else fs.writeFileSync(path.join(root,file), content);
}
console.log(`${info.files} files, ${(info.bytes / 1024 / 1024).toFixed(1)} MiB, bundle ${version}`);
