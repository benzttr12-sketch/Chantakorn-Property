import type { Property } from '@/lib/types';

// Official lookup services. They are not a public data API for this application.
export const LANDSMAPS_URL = 'https://landsmaps.dol.go.th/';
export const TREASURY_APPRAISAL_URL = 'https://assessprice.treasury.go.th/';

export interface LandValuationInput {
  chanoteNo: string;
  landNo: string;
  surveyPage: string;
  mapSheet: string;
  province: string;
  district: string;
  subdistrict: string;
  landSizeSqWah: number;
  latitude: number | null;
  longitude: number | null;
  appraisalPricePerSqWah: number | null;
  appraisalReference: string;
  appraisalCheckedAt: string;
  appraisalPeriod: string;
  askingPrice: number | null;
}

export const EMPTY_LAND_VALUATION: LandValuationInput = {
  chanoteNo: '',
  landNo: '',
  surveyPage: '',
  mapSheet: '',
  province: '',
  district: '',
  subdistrict: '',
  landSizeSqWah: 0,
  latitude: null,
  longitude: null,
  appraisalPricePerSqWah: null,
  appraisalReference: '',
  appraisalCheckedAt: '',
  appraisalPeriod: '',
  askingPrice: null,
};

export class LandValuationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LandValuationValidationError';
  }
}

const MAX_AREA = 1_000_000_000;
const MAX_MONEY = Number.MAX_SAFE_INTEGER / 100;
const FIELD_LABELS: Record<string, string> = {
  chanoteNo: 'เลขโฉนด',
  landNo: 'เลขที่ดิน',
  surveyPage: 'หน้าสำรวจ',
  mapSheet: 'ระวาง',
  province: 'จังหวัด',
  district: 'อำเภอ',
  subdistrict: 'ตำบล',
  landSizeSqWah: 'เนื้อที่',
  latitude: 'ละติจูด',
  longitude: 'ลองจิจูด',
  appraisalPricePerSqWah: 'ราคาประเมินต่อ ตร.ว.',
  appraisalReference: 'แหล่งอ้างอิง',
  appraisalCheckedAt: 'วันที่ตรวจข้อมูล',
  appraisalPeriod: 'รอบราคาประเมิน',
  askingPrice: 'ราคาเสนอขาย',
};

function textField(
  input: Record<string, unknown>,
  name: string,
  maxLength: number,
): string {
  const value = input[name];
  if (value === undefined || value === null) return '';
  if (
    typeof value !== 'string' ||
    value.length > maxLength ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new LandValuationValidationError(
      `ข้อมูล${FIELD_LABELS[name] || 'ที่กรอก'}ไม่ถูกต้อง`,
    );
  }
  return value.trim();
}

function nullableNumber(
  input: Record<string, unknown>,
  name: string,
): number | null {
  const value = input[name];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new LandValuationValidationError(
      `ข้อมูล${FIELD_LABELS[name] || 'ที่กรอก'}ต้องเป็นตัวเลขที่ถูกต้อง`,
    );
  }
  return value;
}

export function isValidCoordinates(
  latitude: unknown,
  longitude: unknown,
): boolean {
  return (
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90 &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180
  );
}

/** Validate entered evidence. Never invent a parcel identifier, coordinate or official rate. */
export function validateLandValuation(input: unknown): LandValuationInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new LandValuationValidationError('กรุณาระบุข้อมูลที่ดิน');
  }
  const body = input as Record<string, unknown>;
  const landSizeSqWah = nullableNumber(body, 'landSizeSqWah');
  if (
    landSizeSqWah === null ||
    landSizeSqWah <= 0 ||
    landSizeSqWah > MAX_AREA
  ) {
    throw new LandValuationValidationError(
      'เนื้อที่ต้องมากกว่า 0 และไม่เกิน 1,000,000,000 ตร.ว.',
    );
  }
  const latitude = nullableNumber(body, 'latitude');
  const longitude = nullableNumber(body, 'longitude');
  if (
    (latitude === null) !== (longitude === null) ||
    (latitude !== null && !isValidCoordinates(latitude, longitude))
  ) {
    throw new LandValuationValidationError(
      'กรุณาระบุละติจูดและลองจิจูดที่ถูกต้องทั้งคู่',
    );
  }
  const appraisalPricePerSqWah = nullableNumber(
    body,
    'appraisalPricePerSqWah',
  );
  if (
    appraisalPricePerSqWah !== null &&
    (appraisalPricePerSqWah <= 0 ||
      appraisalPricePerSqWah > 1_000_000_000 ||
      appraisalPricePerSqWah * landSizeSqWah > MAX_MONEY)
  ) {
    throw new LandValuationValidationError(
      'ราคาประเมินต่อ ตร.ว. ต้องมากกว่า 0 และอยู่ในช่วงที่คำนวณได้',
    );
  }
  const askingPrice = nullableNumber(body, 'askingPrice');
  if (askingPrice !== null && (askingPrice < 0 || askingPrice > MAX_MONEY)) {
    throw new LandValuationValidationError(
      'ราคาเสนอขายต้องไม่ติดลบและอยู่ในช่วงที่คำนวณได้',
    );
  }
  const appraisalReference = textField(body, 'appraisalReference', 2000);
  const appraisalCheckedAt = textField(body, 'appraisalCheckedAt', 10);
  const appraisalPeriod = textField(body, 'appraisalPeriod', 100);
  if (appraisalCheckedAt) {
    const parsed = new Date(`${appraisalCheckedAt}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(appraisalCheckedAt) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== appraisalCheckedAt ||
      appraisalCheckedAt < '2000-01-01' ||
      appraisalCheckedAt > new Date().toISOString().slice(0, 10)
    ) {
      throw new LandValuationValidationError(
        'วันที่ตรวจสอบต้องเป็นวันที่จริงตั้งแต่ปี 2000 และไม่อาจนำหน้าวันปัจจุบัน',
      );
    }
  }
  if (
    appraisalPricePerSqWah !== null &&
    (!appraisalReference || !appraisalCheckedAt || !appraisalPeriod)
  ) {
    throw new LandValuationValidationError(
      'กรุณาระบุแหล่งอ้างอิง วันที่ตรวจสอบ และรอบราคาประเมินเมื่อมีอัตราประเมิน',
    );
  }
  return {
    chanoteNo: textField(body, 'chanoteNo', 100),
    landNo: textField(body, 'landNo', 100),
    surveyPage: textField(body, 'surveyPage', 100),
    mapSheet: textField(body, 'mapSheet', 100),
    province: textField(body, 'province', 100),
    district: textField(body, 'district', 100),
    subdistrict: textField(body, 'subdistrict', 100),
    landSizeSqWah,
    latitude,
    longitude,
    appraisalPricePerSqWah,
    appraisalReference,
    appraisalCheckedAt,
    appraisalPeriod,
    askingPrice,
  };
}

function money(value: number): number | null {
  // Tiny entered areas can produce an unrepresentable unit price or percentage.
  // Keep unavailable results null instead of emitting Infinity or unsafe rounded values.
  if (!Number.isFinite(value) || Math.abs(value) > MAX_MONEY) return null;
  return Math.round(value * 100) / 100;
}

export function calculateLandValuation(input: LandValuationInput) {
  const value = validateLandValuation(input);
  const totalAppraisalValue =
    value.appraisalPricePerSqWah === null
      ? null
      : money(value.landSizeSqWah * value.appraisalPricePerSqWah);
  const askingPricePerSqWah =
    value.askingPrice === null
      ? null
      : money(value.askingPrice / value.landSizeSqWah);
  return {
    totalSqWah: value.landSizeSqWah,
    totalSqMeters: value.landSizeSqWah * 4,
    totalAppraisalValue,
    askingPricePerSqWah,
    differencePercentage:
      totalAppraisalValue === null ||
      totalAppraisalValue === 0 ||
      value.askingPrice === null
        ? null
        : money(
            ((value.askingPrice - totalAppraisalValue) / totalAppraisalValue) *
              100,
          ),
    // Illustrative standard 2% transfer fee only; tax and temporary reductions are not included.
    standardTransferFee:
      totalAppraisalValue === null
        ? null
        : money(totalAppraisalValue * 0.02),
  };
}

export function sqWahToRaiNganWah(totalSqWah: number) {
  if (
    !Number.isFinite(totalSqWah) ||
    totalSqWah < 0 ||
    totalSqWah > MAX_AREA
  ) {
    throw new LandValuationValidationError('เนื้อที่ไม่ถูกต้อง');
  }
  const rai = Math.floor(totalSqWah / 400);
  const afterRai = totalSqWah - rai * 400;
  const ngan = Math.floor(afterRai / 100);
  return {
    rai,
    ngan,
    sqWah: afterRai - ngan * 100,
    totalSqMeters: totalSqWah * 4,
  };
}

export function raiNganWahToSqWah(
  rai: number,
  ngan: number,
  sqWah: number,
): number {
  if (
    ![rai, ngan, sqWah].every((value) => Number.isFinite(value) && value >= 0) ||
    !Number.isInteger(rai) ||
    !Number.isInteger(ngan) ||
    ngan > 3 ||
    sqWah >= 100
  ) {
    throw new LandValuationValidationError(
      'กรุณาระบุไร่เป็นจำนวนเต็ม งาน 0–3 และ ตร.ว. น้อยกว่า 100',
    );
  }
  const total = rai * 400 + ngan * 100 + sqWah;
  if (total > MAX_AREA)
    throw new LandValuationValidationError('เนื้อที่มากเกินช่วงที่รองรับ');
  return total;
}

/** No supported public parcel deep-link contract has been established. */
export function buildLandsMapsUrl(): string {
  return LANDSMAPS_URL;
}

export function buildGoogleMapsUrl(
  latitude: number | null,
  longitude: number | null,
): string | null {
  return isValidCoordinates(latitude, longitude)
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : null;
}

/** Existing asking prices are comparisons, not completed sale prices or a Treasury valuation. */
export function getAskingPriceComparables(
  properties: Property[],
  input: LandValuationInput,
) {
  const province = input.province.trim();
  const district = input.district.trim();
  const rates = !province || !district
    ? []
    : properties
        .filter(
          (property) =>
            property &&
            property.property_type === 'land' &&
            property.status === 'sale' &&
            typeof property.province === 'string' &&
            typeof property.district === 'string' &&
            property.province.trim() === province &&
            property.district.trim() === district &&
            Number.isFinite(property.land_size) &&
            property.land_size > 0 &&
            property.land_size <= MAX_AREA &&
            Number.isFinite(property.price) &&
            property.price > 0 &&
            property.price <= MAX_MONEY,
        )
        .map((property) => property.price / property.land_size)
        .filter((rate) => Number.isFinite(rate) && rate <= MAX_MONEY)
        .sort((a, b) => a - b);
  const middle = Math.floor(rates.length / 2);
  const medianPricePerSqWah =
    rates.length === 0
      ? null
      : rates.length % 2
        ? rates[middle]
        : (rates[middle - 1] + rates[middle]) / 2;
  const estimatedTotal =
    medianPricePerSqWah === null ||
    !Number.isFinite(input.landSizeSqWah) ||
    input.landSizeSqWah <= 0 ||
    medianPricePerSqWah * input.landSizeSqWah > MAX_MONEY
      ? null
      : money(medianPricePerSqWah * input.landSizeSqWah);
  return {
    count: rates.length,
    medianPricePerSqWah:
      medianPricePerSqWah === null ? null : money(medianPricePerSqWah),
    estimatedTotal,
  };
}
