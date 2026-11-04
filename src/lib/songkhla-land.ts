export type LandQuery = { map1: string; map2: string; map3: string; map4: string; scale: string; landNo: string };
export type LandRecord = { reference: [string, string, string]; map4: string; scale: string; landNo: string; price: number; sourceRow: number };
export type LandIndex = { schemaVersion: number; version: string; rowCount: number; duplicateKeys: number; conflictingKeys: number; scales: string[]; sheets: Record<string, number> };

function digits(value: string, max: number, optional = false): string {
  const normalized = value.trim().normalize('NFKC').replace(/[๐-๙]/g, digit => String(digit.charCodeAt(0) - 0x0e50));
  if (optional && !normalized) return '';
  if (!new RegExp(`^[0-9]{1,${max}}$`).test(normalized)) throw new Error('กรุณากรอกเลขระวางและเลขที่ดินเป็นตัวเลขให้ครบ');
  return normalized;
}

export function normalizeLandQuery(input: LandQuery): LandQuery {
  const map1 = digits(input.map1, 4);
  if (map1.length !== 4) throw new Error('ระวางส่วนที่ 1 ต้องมี 4 หลัก');
  return { map1, map2: digits(input.map2, 1), map3: digits(input.map3, 4).padStart(4, '0'),
    map4: digits(input.map4, 3, true), scale: digits(input.scale, 4, true), landNo: digits(input.landNo, 8) };
}

export function landSheetKey(query: LandQuery): string {
  return `${query.map1}-${query.map2}-${query.map3}`;
}

export function landAssetPath(index: LandIndex, key: string, basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''): string {
  if (!/^[a-f0-9]{16}$/.test(index.version) || !/^\d{4}-\d-\d{4}$/.test(key) || !Object.hasOwn(index.sheets, key))
    throw new Error('ไม่พบระวางนี้ในชุดข้อมูลสงขลา');
  const prefix = basePath.replace(/\/+$/, '');
  if (prefix && (!/^\/[a-zA-Z0-9_/-]+$/.test(prefix) || prefix.includes('//'))) throw new Error('เส้นทางข้อมูลไม่ถูกต้อง');
  return `${prefix}/data/songkhla-land/${index.version}/${key}.json`;
}

export function decodeLandSheet(value: unknown, key: string, index: LandIndex): LandRecord[] {
  const fail = () => { throw new Error('ข้อมูลระวางไม่สมบูรณ์ กรุณาลองโหลดอีกครั้ง'); };
  if (!value || typeof value !== 'object') return fail();
  const body = value as Record<string, unknown>;
  if (body.schemaVersion !== 1 || body.version !== index.version || body.key !== key || !Array.isArray(body.groups) || body.groups.length > 10) return fail();
  const records: LandRecord[] = [];
  for (const group of body.groups) {
    if (!group || !Array.isArray(group.reference) || group.reference.length !== 3 ||
        !group.reference.every((part: unknown) => typeof part === 'string') ||
        !/^\d{4}$/.test(group.reference[0]) || !/^\d$/.test(group.reference[1]) || !/^\d{1,4}$/.test(group.reference[2]) ||
        `${group.reference[0]}-${group.reference[1]}-${group.reference[2].padStart(4, '0')}` !== key ||
        !Array.isArray(group.rows) || group.rows.length > 20_000) return fail();
    for (const row of group.rows) {
      if (!Array.isArray(row) || row.length !== 5 || !row.slice(0, 3).every(part => typeof part === 'string') ||
          !/^\d{1,3}$/.test(row[0]) || !/^\d{1,4}$/.test(row[1]) || !/^\d{1,8}$/.test(row[2]) ||
          typeof row[3] !== 'number' || !Number.isFinite(row[3]) || row[3] <= 0 ||
          !Number.isSafeInteger(row[4]) || row[4] < 2 || row[4] > index.rowCount + 1) return fail();
      records.push({ reference: [...group.reference] as [string, string, string], map4: row[0], scale: row[1], landNo: row[2], price: row[3], sourceRow: row[4] });
      if (records.length > 20_000) return fail();
    }
  }
  if (records.length !== index.sheets[key]) return fail();
  return records;
}

export async function loadLandSheet(index: LandIndex, key: string, signal: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<LandRecord[]> {
  const url = landAssetPath(index, key);
  let response: Response;
  try { response = await fetchImpl(url, { signal, credentials: 'omit', redirect: 'error', cache: 'force-cache' }); }
  catch (failure) {
    if (signal.aborted) throw failure;
    throw new Error('เชื่อมต่อข้อมูลไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่');
  }
  if (!response.ok) throw new Error('โหลดข้อมูลระวางไม่สำเร็จ กรุณาลองอีกครั้ง');
  if (Number(response.headers.get('content-length')) > 2_097_152) throw new Error('ข้อมูลระวางมีขนาดเกินกำหนด');
  const text = await response.text();
  if (text.length > 2_097_152) throw new Error('ข้อมูลระวางมีขนาดเกินกำหนด');
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new Error('ข้อมูลระวางไม่สมบูรณ์ กรุณาลองโหลดอีกครั้ง'); }
  return decodeLandSheet(body, key, index);
}

export function matchingLandRecords(records: LandRecord[], query: LandQuery): LandRecord[] {
  const same = (left: string, right: string) => Number(left) === Number(right);
  return records.filter(row => row.reference[0] === query.map1 && row.reference[1] === query.map2 && same(row.reference[2], query.map3) &&
    same(row.landNo, query.landNo) && (!query.map4 || same(row.map4, query.map4)) &&
    (!query.scale || same(row.scale, query.scale))).sort((a, b) => a.sourceRow - b.sourceRow);
}

export function calculateLandEstimate(price: number, area: { rai: string; ngan: string; wah: string }): { squareWah: number; amount: number } {
  const values = [area.rai, area.ngan, area.wah].map(value => value.trim() || '0');
  if (!/^\d{1,6}$/.test(values[0]) || !/^[0-3]$/.test(values[1]) || !/^\d{1,2}(?:\.\d{1,2})?$/.test(values[2]))
    throw new Error('ตรวจพื้นที่: ไร่เป็นจำนวนเต็ม งาน 0–3 และตารางวา 0–99.99');
  const squareWah = Number(values[0]) * 400 + Number(values[1]) * 100 + Number(values[2]);
  const amount = squareWah * price;
  if (!Number.isFinite(price) || price <= 0 || squareWah <= 0 || !Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER / 100)
    throw new Error('กรุณาระบุพื้นที่มากกว่า 0 และอยู่ในช่วงที่คำนวณได้');
  return { squareWah, amount: Math.round(amount * 100) / 100 };
}
