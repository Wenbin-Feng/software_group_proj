import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const screenshotDirectory = path.join(root, 'images');
const screenshots = (await readdir(screenshotDirectory)).filter((name) => name.endsWith('.png'));
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

assert(
  screenshots.length > 13,
  'The expanded gallery must contain more than the original 13 screenshots.',
);

for (const filename of screenshots) {
  const bytes = await readFile(path.join(screenshotDirectory, filename));
  assert(bytes.subarray(0, 8).equals(pngSignature), `${filename} is not a PNG image.`);
  assert(bytes.readUInt32BE(16) >= 300, `${filename} is too narrow to read.`);
  assert(bytes.readUInt32BE(20) >= 200, `${filename} has an unexpected image height.`);
}

for (const readmePath of ['README.md', 'images/README.md']) {
  const absoluteReadme = path.join(root, readmePath);
  const markdown = await readFile(absoluteReadme, 'utf8');
  const embeddedFiles = new Set();

  // Resolve each image relative to its own README, as GitHub's renderer does.
  for (const match of markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    assert(
      !/^[a-z]+:/i.test(target),
      `${readmePath} must embed repository-local screenshot paths.`,
    );
    const resolved = path.resolve(path.dirname(absoluteReadme), target);
    assert(
      resolved.startsWith(`${screenshotDirectory}${path.sep}`),
      `Unexpected image path: ${target}`,
    );
    await readFile(resolved);
    embeddedFiles.add(path.basename(resolved));
  }

  for (const filename of screenshots) {
    assert(embeddedFiles.has(filename), `${readmePath} does not embed ${filename}.`);
  }
}

const catalog = JSON.parse(await readFile(path.join(screenshotDirectory, 'catalog.json'), 'utf8'));
assert.deepEqual(
  catalog.map((entry) => entry.file).sort(),
  [...screenshots].sort(),
  'The screenshot catalog must list every image exactly once.',
);

const gallery = await readFile(path.join(root, 'gallery.html'), 'utf8');
const galleryImages = [];
for (const match of gallery.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)) {
  const resolved = path.resolve(root, match[1]);
  assert(
    resolved.startsWith(`${screenshotDirectory}${path.sep}`),
    `Unexpected gallery image: ${match[1]}`,
  );
  await readFile(resolved);
  galleryImages.push(path.basename(resolved));
}
assert.deepEqual(
  galleryImages.sort(),
  [...screenshots].sort(),
  'The offline gallery must include every screenshot.',
);

console.log(
  `Screenshot check passed: ${screenshots.length} valid PNGs in both READMEs, catalog and offline gallery.`,
);
