#!/usr/bin/env node
// Expand the shipped static GLB for Tripo without regenerating its shape or paint.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const [source, destination] = process.argv.slice(2);
if (!source || !destination || path.resolve(source) === path.resolve(destination)) {
  throw Error('Usage: node scripts/prepare-hero-rig-input.mjs source.glb separate-output.glb');
}
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const bytes = await fs.readFile(source), doc = await io.readBinary(bytes);
if (doc.getRoot().listSkins().length) throw Error('Expected a static source');
const before = getBounds(doc.getRoot().listScenes()[0]);
await doc.transform(dequantize());
for (const texture of doc.getRoot().listTextures()) {
  texture.setImage(await sharp(texture.getImage()).png().toBuffer()).setMimeType('image/png');
}
for (const extension of [...doc.getRoot().listExtensionsUsed()]) {
  if (['EXT_meshopt_compression', 'EXT_texture_webp'].includes(extension.extensionName)) extension.dispose();
}
const output = await io.writeBinary(doc);
await fs.mkdir(path.dirname(destination), { recursive: true });
await fs.writeFile(destination, output);
const report = {
  source, destination, sourceSha256: createHash('sha256').update(bytes).digest('hex'),
  outputSha256: createHash('sha256').update(output).digest('hex'),
  before, after: getBounds(doc.getRoot().listScenes()[0]),
  note: 'Dequantize only; decoded WebP pixels become lossless PNG. No remesh, new texture or axis change.',
};
await fs.writeFile(destination.replace(/\.glb$/, '') + '-preparation.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
