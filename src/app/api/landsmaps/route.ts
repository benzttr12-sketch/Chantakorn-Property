import { NextRequest, NextResponse } from 'next/server';
import {
  LANDSMAPS_URL,
  TREASURY_APPRAISAL_URL,
  LandValuationValidationError,
  buildGoogleMapsUrl,
  calculateLandValuation,
  validateLandValuation,
} from '@/lib/landsmaps';

const source = 'manual_official_lookup';
const links = { landsmaps: LANDSMAPS_URL, treasury: TREASURY_APPRAISAL_URL };

/** Capability information only. No generated deeds, boundaries or government prices. */
export async function GET() {
  return NextResponse.json({
    success: true,
    source,
    officialDataFetched: false,
    links,
    capabilities: {
      officialLookup: 'external_website',
      manualValuation: true,
      parcelApi: false,
    },
  });
}

/** Pure calculation of explicitly supplied data; does not fetch or persist private records. */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'รูปแบบ JSON ไม่ถูกต้อง' },
      { status: 400 },
    );
  }

  try {
    const input = validateLandValuation(body);
    return NextResponse.json({
      success: true,
      source,
      officialDataFetched: false,
      links: {
        ...links,
        googleMaps: buildGoogleMapsUrl(input.latitude, input.longitude),
      },
      input,
      data: calculateLandValuation(input),
      transferFeeNote:
        'ค่าธรรมเนียมโอนอัตราทั่วไป 2% เป็นเพียงประมาณการ ไม่รวมภาษีหรือค่าธรรมเนียมอื่น ๆ',
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof LandValuationValidationError
            ? error.message
            : 'ไม่สามารถคำนวณข้อมูลที่ดินได้',
      },
      {
        status: error instanceof LandValuationValidationError ? 400 : 500,
      },
    );
  }
}
