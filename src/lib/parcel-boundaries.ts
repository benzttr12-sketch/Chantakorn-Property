import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';

export type ParcelBoundaryCollection = FeatureCollection<
    Polygon | MultiPolygon,
    { label: string; origin: 'imported' | 'sketch' }
>;

export const EMPTY_PARCEL_BOUNDARIES: ParcelBoundaryCollection = {
    type: 'FeatureCollection',
    features: [],
};

const MAX_FEATURES = 500;
const MAX_COORDINATES = 10_000;
const MAX_BYTES = 512 * 1024;
const MAX_LABEL_LENGTH = 100;

export class ParcelBoundaryValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ParcelBoundaryValidationError';
    }
}

function fail(message: string): never {
    throw new ParcelBoundaryValidationError(message);
}

function record(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function checkSize(value: unknown): void {
    let serialized: string | undefined;
    try {
        serialized = JSON.stringify(value);
    } catch {
        fail('ข้อมูลแนวเขตไม่ใช่ GeoJSON ที่ถูกต้อง');
    }
    if (serialized === undefined) fail('ข้อมูลแนวเขตไม่ใช่ GeoJSON ที่ถูกต้อง');
    if (new TextEncoder().encode(serialized).byteLength > MAX_BYTES) {
        fail('ข้อมูลแนวเขตต้องมีขนาดไม่เกิน 512 KB');
    }
}

function checkCrs(value: Record<string, unknown>): void {
    if (!Object.hasOwn(value, 'crs')) return;
    const crs = record(value.crs);
    const properties = record(crs?.properties);
    if (crs?.type !== 'name' || (
        properties?.name !== 'EPSG:4326'
        && properties?.name !== 'urn:ogc:def:crs:EPSG::4326'
    )) {
        fail('รองรับเฉพาะพิกัด WGS84 (EPSG:4326) แบบลองจิจูด ละติจูด');
    }
}

/** Retain only display labels and provenance; unrelated file properties are discarded. */
function boundaryProperties(value: unknown, index: number): ParcelBoundaryCollection['features'][number]['properties'] {
    const properties = record(value);
    let label = `แปลง ${index + 1}`;
    for (const field of ['label', 'name', 'chanoteNo']) {
        const candidate = properties?.[field];
        if (typeof candidate !== 'string') continue;
        // Labels remain plain text. Consumers must use textContent, never HTML tooltips.
        const trimmed = candidate.trim();
        if (trimmed.length > 0 && trimmed.length <= MAX_LABEL_LENGTH && !/[\u0000-\u001f\u007f]/.test(trimmed)) {
            label = trimmed;
            break;
        }
    }
    return { label, origin: properties?.origin === 'sketch' ? 'sketch' : 'imported' };
}

function position(value: unknown, count: { total: number }): Position {
    count.total += 1;
    if (count.total > MAX_COORDINATES) fail('ข้อมูลแนวเขตต้องมีพิกัดรวมไม่เกิน 10,000 จุด');
    if (!Array.isArray(value) || value.length < 2 || value.length > 3) {
        fail('พิกัดแนวเขตต้องอยู่ในรูปแบบลองจิจูด ละติจูด');
    }
    if (value.some(coordinate => typeof coordinate !== 'number' || !Number.isFinite(coordinate))) {
        fail('พิกัดแนวเขตต้องเป็นตัวเลขที่ถูกต้อง');
    }
    const [longitude, latitude] = value as number[];
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        fail('พิกัดแนวเขตอยู่นอกช่วง WGS84');
    }
    // Elevation is optional in GeoJSON, but this map stores only longitude/latitude.
    return [longitude, latitude];
}

function ring(value: unknown, count: { total: number }): Position[] {
    if (!Array.isArray(value) || value.length < 4) {
        fail('แนวเขตแต่ละวงต้องมีอย่างน้อย 3 มุมและจุดปิดวง');
    }
    const points = value.map(point => position(point, count));
    const first = points[0];
    const last = points[points.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        fail('แนวเขตต้องปิดวง โดยจุดสุดท้ายตรงกับจุดแรก');
    }
    // Translate before the shoelace calculation to retain precision for small plots.
    let doubleArea = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
        const current = points[index];
        const next = points[index + 1];
        doubleArea += (current[0] - first[0]) * (next[1] - first[1])
            - (next[0] - first[0]) * (current[1] - first[1]);
    }
    if (!Number.isFinite(doubleArea) || doubleArea === 0) {
        fail('แนวเขตต้องล้อมพื้นที่จริง ไม่ใช่จุดซ้ำหรือเส้นตรง');
    }
    return points;
}

function polygon(value: unknown, count: { total: number }): Position[][] {
    if (!Array.isArray(value) || value.length === 0) fail('รูปแปลงต้องมีแนวเขตอย่างน้อย 1 วง');
    return value.map(boundaryRing => ring(boundaryRing, count));
}

function geometry(value: unknown, count: { total: number }): Polygon | MultiPolygon {
    const input = record(value);
    if (!input) fail('รูปแปลงต้องเป็น Polygon หรือ MultiPolygon');
    checkCrs(input);
    if (input.type === 'Polygon') {
        return { type: 'Polygon', coordinates: polygon(input.coordinates, count) };
    }
    if (input.type === 'MultiPolygon') {
        if (!Array.isArray(input.coordinates) || input.coordinates.length === 0) {
            fail('MultiPolygon ต้องมีรูปแปลงอย่างน้อย 1 รูป');
        }
        return { type: 'MultiPolygon', coordinates: input.coordinates.map(part => polygon(part, count)) };
    }
    fail('รองรับเฉพาะแนวเขต Polygon หรือ MultiPolygon');
}

/** Validate uploaded/manual geometry. This never establishes official cadastral verification. */
export function validateParcelBoundaries(input: unknown): ParcelBoundaryCollection {
    checkSize(input);
    const collection = record(input);
    if (!collection) fail('ข้อมูลแนวเขตไม่ใช่ GeoJSON ที่ถูกต้อง');
    checkCrs(collection);
    let features: unknown[];
    if (collection.type === 'FeatureCollection') {
        if (!Array.isArray(collection.features)) fail('GeoJSON ต้องมีรายการ features');
        features = collection.features;
    } else if (collection.type === 'Feature') {
        features = [collection];
    } else if (collection.type === 'Polygon' || collection.type === 'MultiPolygon') {
        features = [{ type: 'Feature', properties: null, geometry: collection }];
    } else {
        fail('รองรับเฉพาะ FeatureCollection, Feature, Polygon หรือ MultiPolygon');
    }
    if (features.length > MAX_FEATURES) fail('ข้อมูลแนวเขตต้องมีรูปแปลงไม่เกิน 500 รายการ');
    const count = { total: 0 };
    const normalized = features.map((value, index): Feature<Polygon | MultiPolygon, ParcelBoundaryCollection['features'][number]['properties']> => {
        const feature = record(value);
        if (!feature || feature.type !== 'Feature') fail('รายการรูปแปลงต้องอยู่ในรูปแบบ Feature');
        checkCrs(feature);
        return {
            type: 'Feature',
            properties: boundaryProperties(feature.properties, index),
            geometry: geometry(feature.geometry, count),
        };
    });
    const result: ParcelBoundaryCollection = { type: 'FeatureCollection', features: normalized };
    // Default labels and normalized metadata may increase the stored size.
    checkSize(result);
    return result;
}

export function parseParcelBoundaryFile(text: string, fileName: string): ParcelBoundaryCollection {
    if (!/\.(?:geojson|json)$/i.test(fileName)) {
        fail('รองรับไฟล์ .geojson หรือ .json เท่านั้น กรุณาส่งออกแนวเขตเป็น GeoJSON (WGS84)');
    }
    if (new TextEncoder().encode(text).byteLength > MAX_BYTES) fail('ไฟล์แนวเขตต้องมีขนาดไม่เกิน 512 KB');
    let input: unknown;
    try {
        input = JSON.parse(text);
    } catch {
        fail('อ่านไฟล์ไม่ได้ กรุณาตรวจรูปแบบ GeoJSON');
    }
    return validateParcelBoundaries(input);
}

/** Close an explicitly drawn outline. Sketches are never labeled official cadastral data. */
export function createSketchBoundary(points: Array<[number, number]>, label: string): ParcelBoundaryCollection {
    const closed = points.map(point => [...point]);
    if (closed.length > 0) {
        const first = closed[0];
        const last = closed[closed.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) closed.push([...first]);
    }
    return validateParcelBoundaries({
        type: 'Feature',
        properties: { label, origin: 'sketch' },
        geometry: { type: 'Polygon', coordinates: [closed] },
    });
}

/** Leaflet bounds are latitude/longitude, while GeoJSON positions are longitude/latitude. */
export function getParcelBoundaryBounds(collection: ParcelBoundaryCollection): [[number, number], [number, number]] | null {
    let south = Infinity;
    let west = Infinity;
    let north = -Infinity;
    let east = -Infinity;
    for (const feature of collection.features) {
        const polygons = feature.geometry.type === 'Polygon'
            ? [feature.geometry.coordinates]
            : feature.geometry.coordinates;
        for (const rings of polygons) {
            for (const boundaryRing of rings) {
                for (const [longitude, latitude] of boundaryRing) {
                    south = Math.min(south, latitude);
                    west = Math.min(west, longitude);
                    north = Math.max(north, latitude);
                    east = Math.max(east, longitude);
                }
            }
        }
    }
    return south === Infinity ? null : [[south, west], [north, east]];
}
