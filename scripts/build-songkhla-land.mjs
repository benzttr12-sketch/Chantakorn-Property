import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const HEADER = 'UTMMAP1,UTMMAP2,UTMMAP3,UTMMAP4,UTMSCALE,LAND_NO,EVAPRICE';
const repository = fileURLToPath(new URL('..', import.meta.url));
export async function buildLandAssets({ input, output, source }) {
  if ((await stat(input)).size > 80 * 1024 * 1024) throw new Error('CSV exceeds build limit');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(input)) hash.update(chunk);
  if (hash.digest('hex') !== source.sha256) throw new Error('CSV differs from verified source');
  const shards = new Map(), seen = new Map(), conflicted = new Set(), duplicateKeys = new Set(), scales = new Set();
  let rowCount = 0, duplicateRows = 0, lineNumber = 0;
  for await (const line of createInterface({ input: createReadStream(input), crlfDelay: Infinity })) {
    lineNumber++;
    if (lineNumber === 1) {
      if (line.replace(/^\uFEFF/, '') !== HEADER) throw new Error('Unexpected CSV columns');
      continue;
    }
    // This verified source is an unquoted, seven-column numeric CSV. Reject a
    // changed dialect/shape instead of silently discarding or coercing records.
    const fields = line.split(',');
    if (fields.length !== 7 || !fields.slice(0, 6).every(value => /^\d{1,8}$/.test(value)) ||
        !/^\d{1,8}(?:\.\d{1,8})?$/.test(fields[6])) throw new Error(`Invalid CSV row ${lineNumber}`);
    const [map1, map2, map3, map4, scale, landNo] = fields;
    const price = Number(fields[6]);
    if (map1.length !== 4 || map2.length !== 1 || map3.length > 4 || map4.length > 3 ||
        scale.length > 4 || !Number.isFinite(price) || price <= 0 || ++rowCount > 2_000_000) throw new Error('Invalid source domain');
    const sheetKey = `${map1}-${map2}-${map3.padStart(4, '0')}`;
    const key = fields.slice(0, 6).map(value => String(Number(value))).join('/');
    if (seen.has(key)) {
      duplicateRows++; duplicateKeys.add(key);
      if (seen.get(key) !== price) conflicted.add(key);
    } else seen.set(key, price);
    scales.add(scale);
    let shard = shards.get(sheetKey);
    if (!shard) { shard = new Map(); shards.set(sheetKey, shard); }
    const rawKey = `${map1}/${map2}/${map3}`;
    let group = shard.get(rawKey);
    if (!group) { group = { reference: [map1, map2, map3], rows: [] }; shard.set(rawKey, group); }
    // Preserve raw identifier strings (including zeros) and the original line.
    group.rows.push([map4, scale, landNo, price, lineNumber]);
  }
  if (!rowCount) throw new Error('CSV is empty');
  const version = source.sha256.slice(0, 16);
  const index = { schemaVersion: 1, version, rowCount, duplicateRows, duplicateKeys: duplicateKeys.size,
    conflictingKeys: conflicted.size, scales: [...scales].sort((a, b) => Number(a) - Number(b)), sheets: {} };
  await mkdir(output, { recursive: false }); // Refuse overwriting a published version.
  let totalBytes = 0, largestBytes = 0;
  const checksums = {};
  for (const [key, groups] of [...shards].sort(([a], [b]) => a.localeCompare(b))) {
    const contents = JSON.stringify({ schemaVersion: 1, version, key, groups: [...groups.values()] });
    const bytes = Buffer.byteLength(contents);
    if (bytes > 2 * 1024 * 1024) throw new Error('Sheet exceeds client byte budget');
    index.sheets[key] = [...groups.values()].reduce((sum, group) => sum + group.rows.length, 0);
    checksums[key] = createHash('sha256').update(contents).digest('hex');
    totalBytes += bytes; largestBytes = Math.max(largestBytes, bytes);
    await writeFile(join(output, `${key}.json`), contents, { flag: 'wx' });
  }
  return { index, checksums, totalBytes, largestBytes };
}

export async function checkPublishedSource(source, fetchImpl = fetch) {
  const response = await fetchImpl(`https://catalog.treasury.go.th/api/3/action/resource_show?id=${source.resourceId}`, {
    signal: AbortSignal.timeout(15_000), redirect: 'error',
  });
  if (!response.ok) throw new Error('Official source metadata unavailable');
  const record = await response.json();
  if (!record.success || record.result?.url !== source.downloadUrl ||
      record.result.hash !== source.md5 || record.result.size !== source.bytes ||
      record.result.resource_last_updated_date !== source.sourceUpdatedAt ||
      !record.result.last_modified?.startsWith(source.fileModifiedAt)) throw new Error('Official source changed; review and rebuild snapshot');
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = JSON.parse(await readFile(join(repository, 'src/data/songkhla-land-source.json'), 'utf8'));
  await checkPublishedSource(source);
  if (process.argv[2] === '--check-source' && process.argv.length === 3) {
    console.log(JSON.stringify({ currentCatalogMatchesSnapshot: true, sourceUpdatedAt: source.sourceUpdatedAt }));
  } else if (process.argv[2] === '--build' && process.argv.length === 4) {
    const parent = join(repository, 'public/data/songkhla-land');
    await mkdir(parent, { recursive: true });
    const built = await buildLandAssets({ input: resolve(process.argv[3]), output: join(parent, source.sha256.slice(0, 16)), source });
    await writeFile(join(repository, 'src/data/songkhla-land-index.json'), JSON.stringify(built.index));
    await mkdir(join(repository, 'docs/data'), { recursive: true });
    await writeFile(join(repository, 'docs/data/songkhla-land-integrity.json'), JSON.stringify({ source, ...built, index: undefined }, null, 2));
    console.log(JSON.stringify({ rows: built.index.rowCount, sheets: Object.keys(built.index.sheets).length,
      duplicateKeys: built.index.duplicateKeys, conflictingKeys: built.index.conflictingKeys,
      totalBytes: built.totalBytes, largestBytes: built.largestBytes }));
  } else throw new Error('Use --check-source or --build ABSOLUTE_CSV_PATH');
}
