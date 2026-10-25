#!/usr/bin/env node
/** Mobile asset pass. Never change vertex-derived pivots or rigged geometry. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import { compressTexture, dequantize, getBounds, listTextureSlots, meshopt, simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

// Protect vertex-derived pivots and rigs; also reflective surfaces whose
// highlights visibly distort after simplification (confirmed by side-by-side QA).
const KEEP_GEOMETRY = new Set('motor propeller windmill sails floorfan windgen dynamo knife musicbox tester magnet mirror carousel cannon laser pump helicopter trafficlight fox-rig solar buzzer drum bell panel target tuba'.split(' '));
const FARM = new Set('barn coop doghouse cow dog duck fox hen pig rabbit sheep tractor sack kitten goat kid goose rooster horse chick beehive flowerbed-buds flowerbed-bloom nest stable tree-oak'.split(' '));
const args = process.argv.slice(2), names = [];
let input = 'assets-src/models', output = 'public/models', report = '';
while (args.length) {
  const a = args.shift();
  if (a === '--input') input = args.shift();
  else if (a === '--output') output = args.shift();
  else if (a === '--report') report = args.shift();
  else if (a.startsWith('--')) throw new Error(`Unknown option: ${a}`);
  else names.push(a);
}
if (!input || !output) throw new Error('Both input and output directories are required.');
if (path.resolve(input) === path.resolve(output)) throw new Error('Input and output must differ. Keep a source backup.');
if (!names.length) names.push(...(await fs.readdir(input)).filter(n => n.endsWith('.glb')).map(n => n.slice(0, -4)).sort());
if (!names.length) throw new Error(`No GLB sources in ${input}`);
await fs.mkdir(output, { recursive: true });
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const accessor = a => a ? { type: a.getType(), normalized: a.getNormalized(), componentType: a.getComponentType(), data: sha(Buffer.from(a.getArray().buffer, a.getArray().byteOffset, a.getArray().byteLength)) } : null;
function geometrySignature(doc) {
  const r = doc.getRoot(), nodes = r.listNodes(), meshes = r.listMeshes();
  return sha(JSON.stringify({
    meshes: meshes.map(m => m.listPrimitives().map(p => ({ mode: p.getMode(), indices: accessor(p.getIndices()), attributes: p.listSemantics().sort().map(s => [s, accessor(p.getAttribute(s))]), targets: p.listTargets().map(t => t.listSemantics().sort().map(s => [s, accessor(t.getAttribute(s))])) }))),
    nodes: nodes.map(n => ({ name: n.getName(), t: n.getTranslation(), r: n.getRotation(), s: n.getScale(), children: n.listChildren().map(n => nodes.indexOf(n)), mesh: meshes.indexOf(n.getMesh()), weights: n.getWeights() })),
    skins: r.listSkins().map(s => ({ joints: s.listJoints().map(n => nodes.indexOf(n)), matrices: accessor(s.getInverseBindMatrices()), skeleton: nodes.indexOf(s.getSkeleton()) })),
    animations: r.listAnimations().map(a => ({ name: a.getName(), channels: a.listChannels().map(c => ({ node: nodes.indexOf(c.getTargetNode()), path: c.getTargetPath(), input: accessor(c.getSampler().getInput()), output: accessor(c.getSampler().getOutput()), interpolation: c.getSampler().getInterpolation() })) })),
  }));
}
/** Replace embedded WebP images without re-encoding a single geometry byte. */
function rewriteWebpImages(source, originals, textures) {
  if (source.readUInt32LE(0) !== 0x46546c67 || source.readUInt32LE(4) !== 2) throw new Error('Expected GLB 2');
  const jsonLength = source.readUInt32LE(12), binHeader = 20 + jsonLength;
  const json = JSON.parse(source.subarray(20, binHeader).toString());
  if (json.images?.length !== textures.length || json.images.some(i => i.mimeType !== 'image/webp' || i.bufferView === undefined)) return null;
  if (source.readUInt32LE(binHeader + 4) !== 0x004e4942) throw new Error('Expected embedded binary GLB chunk');
  const bin = source.subarray(binHeader + 8), replacements = new Map();
  for (let i = 0; i < textures.length; i++) {
    const index = json.images[i].bufferView, view = json.bufferViews[index];
    const original = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    if (sha(original) !== originals[i]) throw new Error('Image order changed; refusing unsafe binary rewrite');
    replacements.set(index, Buffer.from(textures[i].getImage()));
  }
  const chunks = []; let length = 0;
  function append(bytes) {
    const padding = (4 - length % 4) % 4;
    if (padding) { chunks.push(Buffer.alloc(padding)); length += padding; }
    const offset = length; chunks.push(bytes); length += bytes.length; return offset;
  }
  for (const [index, view] of json.bufferViews.entries()) {
    if (view.buffer === 0) {
      const bytes = replacements.get(index) ?? bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
      view.byteOffset = append(bytes); view.byteLength = bytes.length;
    }
    const ext = view.extensions?.EXT_meshopt_compression;
    if (ext?.buffer === 0) {
      const bytes = bin.subarray(ext.byteOffset ?? 0, (ext.byteOffset ?? 0) + ext.byteLength);
      ext.byteOffset = append(bytes);
    }
  }
  json.buffers[0].byteLength = length;
  let jsonBytes = Buffer.from(JSON.stringify(json)), binBytes = Buffer.concat(chunks);
  jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc((4 - jsonBytes.length % 4) % 4, 0x20)]);
  binBytes = Buffer.concat([binBytes, Buffer.alloc((4 - binBytes.length % 4) % 4)]);
  const header = Buffer.alloc(20), bh = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonBytes.length + binBytes.length, 8);
  header.writeUInt32LE(jsonBytes.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  bh.writeUInt32LE(binBytes.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonBytes, bh, binBytes]);
}
function stats(doc, bytes) {
  const r = doc.getRoot();
  const triangles = r.listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((s, p) => s + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);
  const textures = r.listTextures().map(t => ({ slots: listTextureSlots(t), size: t.getSize(), bytes: t.getImage().byteLength, mime: t.getMimeType() }));
  return { bytes, triangles, textures, textureMiB: textures.reduce((s, t) => s + t.size[0] * t.size[1] * 4 * 4 / 3, 0) / 1048576, bounds: getBounds(r.listScenes()[0]), skins: r.listSkins().length, animations: r.listAnimations().length };
}
const rows = [];
for (const name of names) {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Invalid model name: ${name}`);
  const source = path.join(input, `${name}.glb`), destination = path.join(output, `${name}.glb`);
  const sourceBytes = await fs.readFile(source), doc = await io.read(source);
  doc.setLogger(new Logger(Logger.Verbosity.WARN));
  const before = stats(doc, sourceBytes.length), signature = geometrySignature(doc);
  const originalImages = doc.getRoot().listTextures().map(t => sha(t.getImage()));
  const keep = KEEP_GEOMETRY.has(name) || before.skins > 0 || before.animations > 0;
  const budget = FARM.has(name) ? 8000 : 6000;
  for (const texture of doc.getRoot().listTextures()) {
    const slots = listTextureSlots(texture), color = slots.some(s => /baseColor|emissive|diffuse|specularColor|sheenColor/.test(s));
    const limit = color ? 512 : 256, size = texture.getSize();
    if (Math.max(...size) <= limit && texture.getMimeType() === 'image/webp') continue;
    await compressTexture(texture, { encoder: sharp, targetFormat: 'webp', resize: [limit, limit], quality: color ? 88 : 90, effort: 70, lossless: false });
  }
  if (doc.getRoot().listTextures().some(t => t.getMimeType() === 'image/webp')) doc.createExtension(EXTTextureWebP).setRequired(true);
  if (!keep && before.triangles > budget) {
    await doc.transform(dequantize(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: budget / before.triangles, error: 0.0025 }), meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16 }));
  } else {
    // QUANTIZE here means lossless buffer compression of the existing arrays;
    // do not run quantize(), reorder(), weld(), or simplify() on sensitive meshes.
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  }
  const bytes = (keep || before.triangles <= budget ? rewriteWebpImages(sourceBytes, originalImages, doc.getRoot().listTextures()) : null) ?? await io.writeBinary(doc);
  const result = await io.readBinary(bytes);
  const exactGeometry = geometrySignature(result) === signature;
  if (keep && !exactGeometry) throw new Error(`${name}: protected geometry/rig changed; no output written.`);
  const after = stats(result, bytes.length);
  if (after.skins !== before.skins || after.animations !== before.animations) throw new Error(`${name}: lost skin or animation`);
  await fs.writeFile(destination, bytes);
  rows.push({ name, sourceSha256: sha(sourceBytes), outputSha256: sha(bytes), protectedGeometry: keep, exactGeometry, targetTriangles: keep ? null : budget, before, after });
  console.log(`${name}: ${before.triangles} → ${after.triangles} tris; ${(before.bytes / 1024).toFixed(1)} → ${(after.bytes / 1024).toFixed(1)} KiB; textures ${before.textureMiB.toFixed(1)} → ${after.textureMiB.toFixed(1)} MiB${keep ? '; geometry exact' : ''}`);
}
const totals = key => rows.reduce((s, r) => ({ bytes: s.bytes + r[key].bytes, triangles: s.triangles + r[key].triangles, textureMiB: s.textureMiB + r[key].textureMiB }), { bytes: 0, triangles: 0, textureMiB: 0 });
const result = { generatedAt: new Date().toISOString(), source: input, output, settings: { colorSize: 512, dataSize: 256, colorQuality: 88, dataQuality: 90, simplifyError: 0.0025 }, textureMemoryNote: 'Estimated RGBA8 + complete mip chain for every unique embedded image. Asset inventory, not measured process or GPU allocation.', totals: { before: totals('before'), after: totals('after') }, models: rows };
if (report) { await fs.mkdir(path.dirname(report), { recursive: true }); await fs.writeFile(report, JSON.stringify(result, null, 2) + '\n'); }
console.log(JSON.stringify(result.totals));
