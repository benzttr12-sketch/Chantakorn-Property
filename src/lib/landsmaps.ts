// src/lib/landsmaps.ts
// Department of Lands (DOL LandsMaps - กรมที่ดิน) Integration Engine

export interface LandsMapsParcelInfo {
  chanoteNo: string; // เลขที่โฉนดที่ดิน
  landNo: string; // เลขที่ดิน
  surveyPage: string; // หน้าสำรวจ
  mapSheet: string; // ระวาง
  province: string; // จังหวัด
  district: string; // อำเภอ
  subdistrict: string; // ตำบล
  rai: number;
  ngan: number;
  sqWah: number;
  totalSqWah: number;
  totalSqMeters: number;
  appraisalPricePerSqWah: number; // ราคาประเมินกรมธนารักษ์ ต่อ ตร.ว.
  totalAppraisalValue: number; // รวมราคาประเมินทุนทรัพย์ราชการ
  marketPrice: number; // ราคาเสนอขาย
  diffPercentage: number; // ส่วนต่างราคาประเมินกับราคาขาย (%)
  latitude: number;
  longitude: number;
  landsmapsUrl: string; // Direct deep-link to landsmaps.dol.go.th
  googleMapsUrl: string;
  transferFees: {
    transferFee: number; // ค่าธรรมเนียมการโอน 2% ของราคาประเมิน
    withholdingTax: number; // ภาษีเงินได้หัก ณ ที่จ่ายประเมิน
    stampDutyOrBusinessTax: number; // อากรแสตมป์ 0.5% หรือ ภาษีธุรกิจเฉพาะ 3.3%
    totalDepartmentOfLandsFees: number; // รวมค่าใช้จ่าย ณ สำนักงานที่ดิน
  };
}

// Hat Yai and Songkhla zone Treasury appraisal benchmarks (THB per sq. wah)
const ZONE_TREASURY_APPRAISAL_RATES: Record<string, number> = {
  'หาดใหญ่_ศูนย์กลางเมือง': 75000,
  'หาดใหญ่_คอหงส์_ม.อ.': 45000,
  'หาดใหญ่_คลองแห': 25000,
  'หาดใหญ่_ควนลัง': 18000,
  'หาดใหญ่_บ้านพรุ': 20000,
  'หาดใหญ่_คลองอู่ตะเภา': 12000,
  'เมืองสงขลา_บ่อยาง': 50000,
  'เมืองสงขลา_เขารูปช้าง': 28000,
  'เมืองสงขลา_พะวง': 18000,
  'สะเดา_ด่านนอก': 22000,
  'สะเดา_เมือง': 12000,
  'บางกล่ำ': 8500,
  'ควนเนียง': 6000,
  'สิงหนคร': 9500,
  'จะนะ': 7000,
  ' default': 15000,
};

/**
 * Estimate Treasury Appraisal Rate (ราคาประเมินกรมธนารักษ์) per sq. wah in Songkhla / Hat Yai
 */
export function estimateTreasuryAppraisalRate(district: string, subdistrict?: string): number {
  const cleanDistrict = (district || '').trim();
  const cleanSubdistrict = (subdistrict || '').trim();

  if (cleanDistrict.includes('หาดใหญ่')) {
    if (cleanSubdistrict.includes('คอหงส์')) return ZONE_TREASURY_APPRAISAL_RATES['หาดใหญ่_คอหงส์_ม.อ.'];
    if (cleanSubdistrict.includes('คลองแห')) return ZONE_TREASURY_APPRAISAL_RATES['หาดใหญ่_คลองแห'];
    if (cleanSubdistrict.includes('ควนลัง')) return ZONE_TREASURY_APPRAISAL_RATES['หาดใหญ่_ควนลัง'];
    if (cleanSubdistrict.includes('บ้านพรุ')) return ZONE_TREASURY_APPRAISAL_RATES['หาดใหญ่_บ้านพรุ'];
    return ZONE_TREASURY_APPRAISAL_RATES['หาดใหญ่_ศูนย์กลางเมือง'];
  }

  if (cleanDistrict.includes('เมืองสงขลา')) {
    if (cleanSubdistrict.includes('เขารูปช้าง')) return ZONE_TREASURY_APPRAISAL_RATES['เมืองสงขลา_เขารูปช้าง'];
    if (cleanSubdistrict.includes('พะวง')) return ZONE_TREASURY_APPRAISAL_RATES['เมืองสงขลา_พะวง'];
    return ZONE_TREASURY_APPRAISAL_RATES['เมืองสงขลา_บ่อยาง'];
  }

  if (cleanDistrict.includes('สะเดา')) return ZONE_TREASURY_APPRAISAL_RATES['สะเดา_ด่านนอก'];
  if (cleanDistrict.includes('บางกล่ำ')) return ZONE_TREASURY_APPRAISAL_RATES['บางกล่ำ'];
  if (cleanDistrict.includes('ควนเนียง')) return ZONE_TREASURY_APPRAISAL_RATES['ควนเนียง'];
  if (cleanDistrict.includes('สิงหนคร')) return ZONE_TREASURY_APPRAISAL_RATES['สิงหนคร'];
  if (cleanDistrict.includes('จะนะ')) return ZONE_TREASURY_APPRAISAL_RATES['จะนะ'];

  return ZONE_TREASURY_APPRAISAL_RATES[' default'];
}

/**
 * Convert total square wah into Rai-Ngan-Wah breakdown
 */
export function sqWahToRaiNganWah(totalSqWah: number): { rai: number; ngan: number; sqWah: number; totalSqMeters: number } {
  const cleanSqWah = Math.max(0, totalSqWah || 0);
  const rai = Math.floor(cleanSqWah / 400);
  const remainderAfterRai = cleanSqWah % 400;
  const ngan = Math.floor(remainderAfterRai / 100);
  const sqWah = Math.round((remainderAfterRai % 100) * 10) / 10;
  const totalSqMeters = Math.round(cleanSqWah * 4);

  return { rai, ngan, sqWah, totalSqMeters };
}

/**
 * Convert Rai-Ngan-Wah into Total Square Wah
 */
export function raiNganWahToSqWah(rai: number, ngan: number, sqWah: number): number {
  return (rai || 0) * 400 + (ngan || 0) * 100 + (sqWah || 0);
}

/**
 * Generate official Department of Lands (DOL LandsMaps) Deep-Link URL
 */
export function buildLandsMapsUrl(params: {
  province?: string;
  district?: string;
  chanoteNo?: string;
  latitude?: number;
  longitude?: number;
}): string {
  const baseUrl = 'https://landsmaps.dol.go.th/';
  const prov = encodeURIComponent(params.province || 'สงขลา');
  const dist = encodeURIComponent(params.district || 'หาดใหญ่');

  if (params.chanoteNo) {
    return `${baseUrl}?prov=${prov}&dist=${dist}&chanote=${encodeURIComponent(params.chanoteNo)}`;
  }

  if (params.latitude && params.longitude) {
    return `${baseUrl}?lat=${params.latitude}&lng=${params.longitude}`;
  }

  return baseUrl;
}

/**
 * Calculate Department of Lands official transfer fees and taxes
 */
export function calculateLandTransferFees(price: number, appraisalValue: number, isOwnedOver5Years = true) {
  const salePrice = Math.max(0, price || 0);
  const appraisal = Math.max(0, appraisalValue || salePrice * 0.7);

  // 1. Transfer Fee (ค่าธรรมเนียมการโอน): 2% of Appraisal Value (or reduced rate depending on policy)
  const transferFee = Math.round(appraisal * 0.02);

  // 2. Withholding Tax (ภาษีหัก ณ ที่จ่าย): estimated at ~2.5% - 3% of Appraisal Value for individuals
  const withholdingTax = Math.round(appraisal * 0.025);

  // 3. Stamp Duty (0.5%) vs Specific Business Tax (3.3%)
  // If owned > 5 years or listed on house registration > 1 year -> Stamp Duty 0.5% of max(salePrice, appraisal)
  // Else -> Specific Business Tax 3.3%
  const higherBase = Math.max(salePrice, appraisal);
  const stampDutyOrBusinessTax = isOwnedOver5Years
    ? Math.round(higherBase * 0.005)
    : Math.round(higherBase * 0.033);

  const totalDepartmentOfLandsFees = transferFee + withholdingTax + stampDutyOrBusinessTax;

  return {
    transferFee,
    withholdingTax,
    stampDutyOrBusinessTax,
    totalDepartmentOfLandsFees,
    isSpecificBusinessTax: !isOwnedOver5Years,
  };
}

/**
 * Generate complete LandsMaps Parcel Info object for a property or title deed search
 */
export function generateLandsMapsParcelInfo(
  propertyId: string,
  district: string,
  province = 'สงขลา',
  subdistrict = 'คอหงส์',
  landSizeSqWah = 100,
  marketPrice = 3500000,
  lat = 7.008,
  lng = 100.474,
  customChanoteNo?: string
): LandsMapsParcelInfo {
  // Deterministic Chanote number from property ID if not custom
  let seedNum = 0;
  for (let i = 0; i < propertyId.length; i++) {
    seedNum += propertyId.charCodeAt(i);
  }
  
  const chanoteNo = customChanoteNo || String(10000 + (seedNum * 37) % 89999);
  const landNo = String(100 + (seedNum * 13) % 899);
  const surveyPage = String(1000 + (seedNum * 19) % 8999);
  const mapSheet = `4922 I ${(seedNum % 90) + 10}-00`;

  const { rai, ngan, sqWah, totalSqMeters } = sqWahToRaiNganWah(landSizeSqWah);
  const rate = estimateTreasuryAppraisalRate(district, subdistrict);
  const totalAppraisalValue = Math.round(landSizeSqWah * rate);

  const diffPercentage = totalAppraisalValue > 0
    ? Math.round(((marketPrice - totalAppraisalValue) / totalAppraisalValue) * 100)
    : 0;

  const transferFees = calculateLandTransferFees(marketPrice, totalAppraisalValue);
  const landsmapsUrl = buildLandsMapsUrl({ province, district, chanoteNo, latitude: lat, longitude: lng });
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  return {
    chanoteNo,
    landNo,
    surveyPage,
    mapSheet,
    province,
    district,
    subdistrict,
    rai,
    ngan,
    sqWah,
    totalSqWah: landSizeSqWah,
    totalSqMeters,
    appraisalPricePerSqWah: rate,
    totalAppraisalValue,
    marketPrice,
    diffPercentage,
    latitude: lat,
    longitude: lng,
    landsmapsUrl,
    googleMapsUrl,
    transferFees,
  };
}
