import { NextRequest, NextResponse } from 'next/server';
import { generateLandsMapsParcelInfo, estimateTreasuryAppraisalRate, calculateLandTransferFees } from '@/lib/landsmaps';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      propertyId = 'api_req',
      chanoteNo = '',
      district = 'หาดใหญ่',
      province = 'สงขลา',
      subdistrict = 'คอหงส์',
      landSizeSqWah = 80,
      price = 3500000,
      latitude = 7.008,
      longitude = 100.474,
      isOwnedOver5Years = true,
    } = body;

    const parcelInfo = generateLandsMapsParcelInfo(
      propertyId,
      district,
      province,
      subdistrict,
      Number(landSizeSqWah) || 50,
      Number(price) || 3000000,
      Number(latitude) || 7.008,
      Number(longitude) || 100.474,
      chanoteNo || undefined
    );

    const customFees = calculateLandTransferFees(
      Number(price) || 3000000,
      parcelInfo.totalAppraisalValue,
      Boolean(isOwnedOver5Years)
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      source: 'https://landsmaps.dol.go.th/',
      data: {
        ...parcelInfo,
        transferFees: customFees,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to parse parcel data from DOL LandsMaps',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chanoteNo = searchParams.get('chanoteNo') || '12345';
  const district = searchParams.get('district') || 'หาดใหญ่';
  const province = searchParams.get('province') || 'สงขลา';
  const subdistrict = searchParams.get('subdistrict') || 'คอหงส์';
  const landSizeSqWah = Number(searchParams.get('landSize')) || 80;
  const price = Number(searchParams.get('price')) || 3500000;
  const latitude = Number(searchParams.get('lat')) || 7.008;
  const longitude = Number(searchParams.get('lng')) || 100.474;

  const parcelInfo = generateLandsMapsParcelInfo(
    `get_${chanoteNo}`,
    district,
    province,
    subdistrict,
    landSizeSqWah,
    price,
    latitude,
    longitude,
    chanoteNo
  );

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    source: 'https://landsmaps.dol.go.th/',
    data: parcelInfo,
  });
}
