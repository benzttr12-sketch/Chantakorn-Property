import { Property, Inquiry } from '@/lib/types';
import { 
  formatPrice, 
  numberToThaiBahtWords, 
  getPropertyTypeName, 
  formatLineUrl,
  DEFAULT_OFFICIAL_FACEBOOK
} from '@/lib/utils';

export type MarketingChannel = 'facebook' | 'tiktok' | 'line' | 'instagram' | 'english' | 'chinese';
export type MarketingTone = 'luxury' | 'hot_deal' | 'friendly' | 'investor';
export type ContractType = 'sale_agreement' | 'lease_agreement' | 'brokerage_exclusive' | 'brokerage_open' | 'letter_of_intent';

// ==========================================
// 1. Social Media & Marketing Automation
// ==========================================

export interface SocialMediaPostResult {
  headline: string;
  body: string;
  hashtags: string[];
  callToAction: string;
  fullPost: string;
}

export function generateLocalSocialPost(
  property: Property,
  channel: MarketingChannel,
  tone: MarketingTone = 'hot_deal'
): SocialMediaPostResult {
  const typeName = getPropertyTypeName(property.property_type);
  const location = `${property.district ? property.district + ', ' : ''}${property.province}`;
  const priceFormatted = formatPrice(property.price);
  const priceUnit = property.status === 'rent' ? '/เดือน' : ' บาท';
  const sizeText = property.land_size ? `${property.land_size} ตร.ว.` : property.usable_area ? `${property.usable_area} ตร.ม.` : '';
  const agentName = property.agent?.name || 'ทีมงาน ฉันทากร พร็อพเพอร์ตี้';
  const agentPhone = property.agent?.phone || '082-436-4499';
  const lineLink = formatLineUrl(property.agent?.line_id || '@chantakorn');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://chantakornproperty.com';
  const propertyUrl = `${origin}/properties/${property.slug}`;

  if (channel === 'tiktok') {
    const fullPost = `🎬 [SCRIPT วิดีโอ TIKTOK / REELS สั้น 45-60 วินาที]
🏡 หัวข้อ: ${property.title}
💰 ราคา: ${priceFormatted}${priceUnit} (${location})

---
[ฉากที่ 1: วินาทีที่ 0-3 (THE HOOK - หยุดนิ้วโป้งคนดู)]
🎥 ภาพ: แพนกล้องรวดเร็วหน้าบ้าน/ห้อง พร้อมเอฟเฟกต์ซูมเข้า หรือเดินเปิดประตูบ้านแบบว้าว
🎙️ เสียงบรรยาย: "ถ้าคุณกำลังหาบ้านโซน ${property.district || 'หาดใหญ่'} ที่คุ้มค่าที่สุดในตอนนี้ ห้ามเลื่อนผ่านคลิปนี้เด็ดขาด!"
💬 ตัวหนังสือบนจอ: "🔥 หลุดจอง! ${typeName} โซน ${property.district || 'หาดใหญ่'} ${priceFormatted}${priceUnit}"

---
[ฉากที่ 2: วินาทีที่ 4-15 (จุดเด่น & พื้นที่ใช้สอย)]
🎥 ภาพ: เดินชมห้องโถงกว้าง เพดานสูง แสงธรรมชาติส่องสวยงาม เดินไปดูห้องครัว
🎙️ เสียงบรรยาย: "หลังนี้เนื้อที่จัดเต็ม ${sizeText || 'กว้างขวาง'} ${property.bedrooms} ห้องนอน ${property.bathrooms} ห้องน้ำ จอดรถได้ ${property.parking} คัน ตกแต่งพร้อมอยู่ บรรยากาศเงียบสงบสุดๆ"
💬 ตัวหนังสือบนจอ: "✅ ${property.bedrooms} นอน ${property.bathrooms} น้ำ จอดรถ ${property.parking} คัน"

---
[ฉากที่ 3: วินาทีที่ 16-30 (ทำเล & สิ่งอำนวยความสะดวก)]
🎥 ภาพ: ถ่ายมุมระเบียง ทิศทางลม ลมพัดเย็นสบาย (${property.facing_direction || 'ทิศมงคล'}) และจุดใกล้เคียง
🎙️ เสียงบรรยาย: "เดินทางสะดวกมาก ใกล้แหล่งของกิน โรงเรียน โรงพยาบาล และใจกลางเมืองหาดใหญ่–สงขลา รถไม่ติด"
💬 ตัวหนังสือบนจอ: "📍 ทำเลทอง: ${location}"

---
[ฉากที่ 4: วินาทีที่ 31-45 (สรุปราคา & ค่างวด & CALL TO ACTION)]
🎥 ภาพ: นายหน้ายืนยิ้มหน้าบ้าน หรือภาพมุมสูงสวยๆ
🎙️ เสียงบรรยาย: "ราคาเพียง ${priceFormatted}${priceUnit} เท่านั้น กู้ได้เต็ม มีบริการเช็กวงเงินฟรี ยื่นกู้ให้ทุกธนาคาร รีบคอมเมนต์หรือทักลิงก์ที่หน้าโปรไฟล์ก่อนหลุดนะครับ!"
💬 ตัวหนังสือบนจอ: "📞 นัดชม: ${agentPhone} | LINE: ${property.agent?.line_id || '@chantakorn'}"

#บ้านหาดใหญ่ #บ้านสงขลา #อสังหาหาดใหญ่ #บ้านมือสองหาดใหญ่ #ฉันทากรพร็อพเพอร์ตี้ #บ้านสวยพร้อมอยู่`;

    return {
      headline: `🔥 สคริปต์ TikTok/Reels: ${property.title}`,
      body: fullPost,
      hashtags: ['#บ้านหาดใหญ่', '#บ้านสงขลา', '#อสังหาหาดใหญ่', '#รีวิวบ้าน', '#Tiktokอสังหา'],
      callToAction: `นัดชมด่วน โทร ${agentPhone}`,
      fullPost
    };
  }

  if (channel === 'line') {
    const fullPost = `📢 [ข้อความบรอดแคสต์ LINE OA]
━━━━━━━━━━━━━━━━━━━━
✨ ${tone === 'hot_deal' ? '🔥 ดีลเด็ดมาใหม่ รีบจองก่อนพลาด!' : '🏡 แนะนำทรัพย์คัดพิเศษคุณภาพพรีเมียม'}
━━━━━━━━━━━━━━━━━━━━

🏷️ ${property.title}
📍 ทำเล: ${location}
💰 ราคาพิเศษ: ${priceFormatted}${priceUnit}

📋 รายละเอียดฟังก์ชัน:
• ประเภท: ${typeName}
• ขนาด: ${sizeText || 'พื้นที่ใช้สอยกว้างขวาง'}
• ฟังก์ชัน: ${property.bedrooms} ห้องนอน / ${property.bathrooms} ห้องน้ำ / ${property.parking} ที่จอดรถ
${property.facing_direction ? `• ทิศหน้าทรัพย์: ${property.facing_direction} (ฮวงจุ้ยดี)` : ''}
${property.furniture ? `• สภาพการตกแต่ง: ${property.furniture}` : ''}

🌟 จุดเด่นที่ไม่ควรพลาด:
${property.features && property.features.length > 0 ? property.features.slice(0, 4).map(f => `  ✔️ ${f}`).join('\n') : '  ✔️ ทำเลดี เดินทางสะดวก เข้าออกได้หลายเส้นทาง\n  ✔️ ดูแลยื่นสินเชื่อฟรีทุกขั้นตอนจนถึงวันโอน'}

🔗 ดูรูปถ่ายและรายละเอียดทั้งหมดคลิก:
👉 ${propertyUrl}

━━━━━━━━━━━━━━━━━━━━
💬 สนใจนัดชมทรัพย์จริง / ปรึกษาสินเชื่อ:
📞 โทร: ${agentPhone} (${agentName})
📱 ทักแชท LINE ตอบทันที: ${lineLink}
━━━━━━━━━━━━━━━━━━━━`;

    return {
      headline: `LINE Broadcast: ${property.title}`,
      body: fullPost,
      hashtags: [],
      callToAction: `ทักแชท LINE สอบถามทันที`,
      fullPost
    };
  }

  if (channel === 'instagram') {
    const fullPost = `✨ A place to call HOME in ${location} ✨

${property.title} — ${typeName} สไตล์โมเดิร์นที่ตอบโจทย์การอยู่อาศัยและการลงทุนในทำเลที่ดีที่สุด

🔑 KEY HIGHLIGHTS:
▫️ ${property.bedrooms} Bedrooms | ${property.bathrooms} Bathrooms
▫️ ${property.parking} Parking Spaces
▫️ Land/Area: ${sizeText || 'Spacious layout'}
${property.facing_direction ? `▫️ Direction: ${property.facing_direction}` : ''}
▫️ Offered at: ${priceFormatted}${priceUnit}

ความสุขที่เริ่มต้นได้จากบ้านหลังนี้ สัมผัสบรรยากาศจริงได้แล้ววันนี้ นัดหมายเข้าชมแบบ Exclusive ได้เลยค่ะ

📞 Private Viewing: ${agentPhone}
📲 LINE: ${property.agent?.line_id || '@chantakorn'}
🌐 Website Link in Bio: ${propertyUrl}

.
.
.
#ChantakornProperty #HatyaiRealEstate #SongkhlaProperty #LuxuryLiving #HatyaiHouse #DreamHome #บ้านหาดใหญ่ #บ้านเดี่ยวหาดใหญ่ #คอนโดหาดใหญ่ #อสังหาริมทรัพย์หาดใหญ่ #บ้านสวยสงขลา #ซื้อบ้านหาดใหญ่ #นายหน้าหาดใหญ่ #แต่งบ้าน #บ้านในฝัน`;

    return {
      headline: `Instagram Aesthetic: ${property.title}`,
      body: fullPost,
      hashtags: ['#ChantakornProperty', '#HatyaiRealEstate', '#บ้านหาดใหญ่', '#บ้านสวยสงขลา'],
      callToAction: `DM or Call ${agentPhone}`,
      fullPost
    };
  }

  if (channel === 'english') {
    const fullPost = `🏡 EXCLUSIVE LISTING: ${property.title}
📍 Location: ${location}, Thailand
💰 Price: ${priceFormatted} THB ${property.status === 'rent' ? '/ Month' : ''}

🌟 PROPERTY OVERVIEW:
Looking for a prime property in Songkhla / Hat Yai? This stunning ${typeName.toLowerCase()} offers premium living spaces and superior accessibility.

SPECIFICATIONS:
• Property Type: ${typeName}
• Bedrooms: ${property.bedrooms} | Bathrooms: ${property.bathrooms}
• Parking: ${property.parking} cars
• Area Size: ${sizeText || 'Generous living space'}
• Furnishing: ${property.furniture || 'Fully / Partially furnished'}

KEY HIGHLIGHTS:
${property.features && property.features.length > 0 ? property.features.slice(0, 4).map(f => `• ${f}`).join('\n') : '• Excellent location close to business districts, international schools, and hospitals\n• High rental demand & capital appreciation potential'}

Free consultation for foreigners, expats, and investors regarding leaseholds, company ownership, and bank financing options.

📞 For private inspection:
Phone / WhatsApp: ${agentPhone}
LINE ID: ${property.agent?.line_id || '@chantakorn'}
Explore full gallery: ${propertyUrl}`;

    return {
      headline: `Exclusive Property for ${property.status === 'sale' ? 'Sale' : 'Rent'} in ${location}`,
      body: fullPost,
      hashtags: ['#HatyaiProperty', '#ThailandRealEstate', '#SongkhlaHomes', '#InvestInThailand'],
      callToAction: `Contact us via WhatsApp / Call ${agentPhone}`,
      fullPost
    };
  }

  if (channel === 'chinese') {
    const fullPost = `🏡 【泰国合艾/宋卡优质房产推介】
🏷️ 房源标题: ${property.title}
📍 所在区域: 泰国宋卡府 ${property.district || '合艾市'} (Hat Yai / Songkhla)
💰 售价/租金: ${priceFormatted} 泰铢 ${property.status === 'rent' ? '/ 月' : ''}

【房源基本参数】
• 物业类型: ${typeName}
• 户型布局: ${property.bedrooms} 房 ${property.bathrooms} 卫
• 停车位: ${property.parking} 车位
• 占地/实用面积: ${sizeText || '空间宽敞，采光通风极佳'}
• 朝向方位: ${property.facing_direction || '吉祥朝向，风水宝地'}

【核心投资亮点】
1. 地理位置优越，邻近合艾市中心、大型购物中心、国际学校与顶尖医院
2. 周边租赁需求旺盛，回报率优渥，适合自住或资产海外配置
3. 产权清晰，专业不动产团队协助办理过户与银行按揭，省心省力

如需预约实地看房或获取中文房产投资资料，欢迎随时与我们联系：
📞 咨询热线: ${agentPhone}
📲 微信/LINE: ${property.agent?.line_id || '@chantakorn'}
🌐 房源详情网址: ${propertyUrl}`;

    return {
      headline: `泰国合艾宋卡优质房源: ${property.title}`,
      body: fullPost,
      hashtags: ['#泰国房产', '#合艾买房', '#宋卡房产投资', '#海外置业', '#合艾生活'],
      callToAction: `加微信/LINE预约看房: ${agentPhone}`,
      fullPost
    };
  }

  // Default: Facebook Feed / Marketplace
  const fullPost = `🔥 [${tone === 'hot_deal' ? 'ด่วน! ทรัพย์เด่นทำเลทอง' : tone === 'luxury' ? 'คัดพิเศษระดับพรีเมียม' : 'แนะนำบ้านสวยพร้อมอยู่'}] ${property.title}
📍 โซน: ${location}
💰 ราคาเพียง: ${priceFormatted}${priceUnit}

✨ รายละเอียดและฟังก์ชันที่น่าอยู่:
🏡 ประเภท: ${typeName}
📐 ขนาด: ${sizeText || 'พื้นที่ใช้สอยโอ่โถง'}
🛏️ ${property.bedrooms} ห้องนอน | 🚿 ${property.bathrooms} ห้องน้ำ | 🚗 ที่จอดรถ ${property.parking} คัน
${property.facing_direction ? `🧭 ทิศหน้าบ้าน: ${property.facing_direction} (รับทรัพย์ รับลม)` : ''}
🛋️ การตกแต่ง: ${property.furniture || 'พร้อมเข้าอยู่อาศัย'}

💎 จุดเด่นที่ต้องจอง:
${property.features && property.features.length > 0 ? property.features.map(f => `✔️ ${f}`).join('\n') : '✔️ ทำเลศักยภาพสูง ใกล้แหล่งอำนวยความสะดวก\n✔️ โครงสร้างแข็งแรง วัสดุมาตรฐานพรีเมียม\n✔️ ปลอดภัย เงียบสงบ น่าอยู่อาศัย'}

🎁 สิทธิพิเศษเฉพาะลูกค้า ฉันทากร พร็อพเพอร์ตี้:
✅ บริการเช็กวงเงินกู้ฟรี รู้ผลไวใน 1 วัน
✅ ดูแลเรื่องสินเชื่อ ยื่นกู้ธนาคารให้จนผ่าน
✅ ดูแลเอกสารนิติกรรมวันโอนกรรมสิทธิ์ครบวงจร

📸 ชมรูปถ่าย 360° และพิกัดแผนที่:
👉 ${propertyUrl}

━━━━━━━━━━━━━━━━━━━━
สนใจสอบถามข้อมูลเพิ่มเติม / นัดเข้าชมบ้านจริง:
📞 โทร: ${agentPhone} (${agentName})
💬 ทักไลน์: ${lineLink} หรือค้นหาไอดี "${property.agent?.line_id || '@chantakorn'}"
🌐 Facebook: ${DEFAULT_OFFICIAL_FACEBOOK}
━━━━━━━━━━━━━━━━━━━━

#บ้านหาดใหญ่ #บ้านสงขลา #ซื้อขายบ้านหาดใหญ่ #คอนโดหาดใหญ่ #ที่ดินหาดใหญ่ #ฉันทากรพร็อพเพอร์ตี้ #บ้านมือสองหาดใหญ่ #บ้านเดี่ยวสงขลา`;

  return {
    headline: `🔥 ${property.title} - ${priceFormatted}${priceUnit}`,
    body: fullPost,
    hashtags: ['#บ้านหาดใหญ่', '#บ้านสงขลา', '#ซื้อขายบ้านหาดใหญ่', '#คอนโดหาดใหญ่', '#ที่ดินหาดใหญ่'],
    callToAction: `โทรด่วน ${agentPhone}`,
    fullPost
  };
}

// ==========================================
// 2. Intelligent Lead-Property Matching Engine
// ==========================================

export interface LeadMatchScore {
  property: Property;
  score: number; // 0 - 100
  matchingFactors: string[];
  mismatchFactors: string[];
  summary: string;
  recommendedLinePitch: string;
}

export function matchLeadToProperties(
  inquiry: Inquiry,
  properties: Property[]
): LeadMatchScore[] {
  const availableProperties = properties.filter(p => p.published);
  const msgLower = (inquiry.message || '').toLowerCase();
  const consignment = inquiry.consignment_details;

  const targetType = consignment?.property_type?.toLowerCase() || '';
  const expectedPrice = consignment?.expected_price || 0;
  const targetDistrict = consignment?.district?.toLowerCase() || '';

  const results: LeadMatchScore[] = availableProperties.map(prop => {
    let score = 50; // Base score
    const matchingFactors: string[] = [];
    const mismatchFactors: string[] = [];

    // 1. Direct inquiry on this specific property
    if (inquiry.property_id && (inquiry.property_id === prop.id || inquiry.property_title === prop.title)) {
      score += 45;
      matchingFactors.push('ลูกค้าสนใจเจาะจงที่ทรัพย์หลังนี้โดยตรง (Direct Inquiry)');
    }

    // 2. Location match (District/Subdistrict/Keywords in message)
    const propDistrict = (prop.district || '').toLowerCase();
    const propSubdistrict = (prop.subdistrict || '').toLowerCase();

    if (targetDistrict && (propDistrict.includes(targetDistrict) || targetDistrict.includes(propDistrict))) {
      score += 20;
      matchingFactors.push(`ทำเลตรงกัน: อำเภอ${prop.district}`);
    } else if (msgLower.includes(propDistrict) && propDistrict.length > 2) {
      score += 15;
      matchingFactors.push(`ทำเลตรงกับข้อความที่ลูกค้าพิมพ์: ${prop.district}`);
    }

    if (propSubdistrict && msgLower.includes(propSubdistrict)) {
      score += 10;
      matchingFactors.push(`ตำบลตรงกัน: ${prop.subdistrict}`);
    }

    // 3. Property Type match
    const propType = prop.property_type.toLowerCase();
    if (targetType && (propType === targetType || targetType.includes(propType))) {
      score += 15;
      matchingFactors.push(`ประเภททรัพย์ตรงกัน: ${getPropertyTypeName(prop.property_type)}`);
    } else {
      if (msgLower.includes('บ้าน') && (propType === 'house')) {
        score += 10;
        matchingFactors.push('ตรงกับความต้องการประเภท "บ้าน"');
      } else if (msgLower.includes('คอนโด') && (propType === 'condo')) {
        score += 10;
        matchingFactors.push('ตรงกับความต้องการประเภท "คอนโด"');
      } else if (msgLower.includes('ที่ดิน') && (propType === 'land')) {
        score += 10;
        matchingFactors.push('ตรงกับความต้องการประเภท "ที่ดิน"');
      } else if (msgLower.includes('เช่า') && prop.status === 'rent') {
        score += 12;
        matchingFactors.push('ตรงกับความต้องการ "เช่า"');
      }
    }

    // 4. Price Match
    if (expectedPrice > 0) {
      const priceDiffRatio = Math.abs(prop.price - expectedPrice) / expectedPrice;
      if (priceDiffRatio <= 0.15) {
        score += 18;
        matchingFactors.push(`งบประมาณใกล้เคียงมาก (ต่างกันไม่เกิน 15%)`);
      } else if (priceDiffRatio <= 0.3) {
        score += 10;
        matchingFactors.push(`งบประมาณพอดีระดับใกล้เคียง (ต่างกันไม่เกิน 30%)`);
      } else if (priceDiffRatio > 0.6) {
        score -= 15;
        mismatchFactors.push(`ราคาต่างจากงบลูกค้าค่อนข้างมาก (${formatPrice(prop.price)} บ. เทียบกับงบ ${formatPrice(expectedPrice)} บ.)`);
      }
    }

    // 5. Bedroom match from message (e.g. 3 ห้องนอน, 2 นอน)
    const bedMatch = msgLower.match(/(\d+)\s*(ห้องนอน|นอน)/);
    if (bedMatch && bedMatch[1]) {
      const requestedBeds = parseInt(bedMatch[1], 10);
      if (prop.bedrooms === requestedBeds) {
        score += 10;
        matchingFactors.push(`จำนวนห้องนอนตรงกันพอดี (${requestedBeds} ห้องนอน)`);
      } else if (prop.bedrooms >= requestedBeds) {
        score += 5;
        matchingFactors.push(`มีห้องนอนเพียงพอ (${prop.bedrooms} ห้องนอน ตอบโจทย์ที่ขอ ${requestedBeds} ห้อง)`);
      }
    }

    // Normalize score to 10 - 99
    score = Math.max(15, Math.min(99, score));

    // Construct tailored LINE message
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://chantakornproperty.com';
    const propertyUrl = `${origin}/properties/${prop.slug}`;
    const monthlyMortgage = Math.round((prop.price * 0.9 * 0.05) / 12);

    const recommendedLinePitch = `สวัสดีครับคุณ ${inquiry.name} 🙏
จากที่ท่านได้ติดต่อสอบถามเกี่ยวกับอสังหาริมทรัพย์โซน ${inquiry.consignment_details?.district || 'หาดใหญ่–สงขลา'} 

ทาง ฉันทากร พร็อพเพอร์ตี้ ได้คัดสรรทรัพย์พิเศษที่ตรงกับความต้องการของท่านมากที่สุด:
🏡 "${prop.title}"
💰 ราคาพิเศษ: ${formatPrice(prop.price)} บาท ${prop.status === 'rent' ? '/เดือน' : `(ผ่อนเริ่มต้นประมาณ ${formatPrice(monthlyMortgage)} บ./เดือน)`}
📍 ทำเล: ${prop.district}, ${prop.province}
🛏️ ฟังก์ชัน: ${prop.bedrooms} ห้องนอน, ${prop.bathrooms} ห้องน้ำ, ที่จอดรถ ${prop.parking} คัน

🔗 สามารถเปิดดูรูปถ่ายและพิกัดได้ที่นี่ครับ:
👉 ${propertyUrl}

หากคุณ ${inquiry.name} สะดวกเปิดชมสถานที่จริง หรือต้องการให้ประเมินวงเงินสินเชื่อธนาคารฟรี แจ้งเวลาที่สะดวกได้เลยนะครับ ยินดีบริการครับ 😊`;

    return {
      property: prop,
      score,
      matchingFactors,
      mismatchFactors,
      summary: matchingFactors.length > 0 
        ? matchingFactors.join(' • ') 
        : 'ทรัพย์ทำเลใกล้เคียงในพื้นที่สงขลา',
      recommendedLinePitch
    };
  });

  // Sort descending by score
  return results.sort((a, b) => b.score - a.score);
}

// ==========================================
// 3. Automated Property Valuation & Yield Analyzer
// ==========================================

export interface ValuationAndYieldResult {
  property: Property;
  pricePerSqWa: number;
  pricePerSqMeter: number;
  marketBenchmark: {
    avgPricePerSqMeter: number;
    pricePosition: 'under_market' | 'fair_market' | 'premium';
    positionDescription: string;
  };
  rentalYield: {
    estimatedMonthlyRent: number;
    estimatedAnnualRent: number;
    grossYieldPercent: number;
    netYieldPercent: number;
    paybackYears: number;
    verdict: string;
  };
  mortgageEstimate: {
    loanAmount: number; // 90%
    downPayment: number; // 10%
    interestRate: number; // 5.5%
    loanYears: number; // 30 years
    monthlyPayment: number;
    totalInterest: number;
    minIncomeRequired: number;
  };
  investorPitchCard: string;
}

export function calculatePropertyValuationAndYield(property: Property): ValuationAndYieldResult {
  const price = property.price || 0;
  const landSize = property.land_size || 0;
  const usableArea = property.usable_area || 0;

  const pricePerSqWa = landSize > 0 ? Math.round(price / landSize) : 0;
  const pricePerSqMeter = usableArea > 0 ? Math.round(price / usableArea) : 0;

  // Regional Benchmark for Hat Yai / Songkhla
  let benchmarkPerSqM = 38000;
  if (property.property_type === 'condo') benchmarkPerSqM = 65000;
  else if (property.property_type === 'commercial') benchmarkPerSqM = 48000;
  else if (property.property_type === 'land') benchmarkPerSqM = 12000;
  else benchmarkPerSqM = 35000; // House

  let pricePosition: 'under_market' | 'fair_market' | 'premium' = 'fair_market';
  let positionDescription = 'ราคาเหมาะสมกับค่าเฉลี่ยตลาดในพื้นที่';

  if (pricePerSqMeter > 0) {
    if (pricePerSqMeter < benchmarkPerSqM * 0.85) {
      pricePosition = 'under_market';
      positionDescription = '🔥 ราคาต่ำกว่าค่าเฉลี่ยตลาด (Undervalued) คุ้มค่าแก่การลงทุนอย่างยิ่ง';
    } else if (pricePerSqMeter > benchmarkPerSqM * 1.25) {
      pricePosition = 'premium';
      positionDescription = '💎 กลุ่มราคาพรีเมียม / ทำเลทองใจกลางย่านธุรกิจ (Prime Area)';
    } else {
      pricePosition = 'fair_market';
      positionDescription = '⚖️ ราคาตามเกณฑ์มาตรฐานตลาด ซื้อง่าย ขายคล่อง';
    }
  }

  // Estimated Rental calculation
  let estimatedMonthlyRent = 0;
  if (property.status === 'rent') {
    estimatedMonthlyRent = price;
  } else {
    // Estimate rent from property price & type
    if (property.property_type === 'condo') {
      estimatedMonthlyRent = Math.round((price * 0.055) / 12);
    } else if (property.property_type === 'commercial') {
      estimatedMonthlyRent = Math.round((price * 0.065) / 12);
    } else {
      estimatedMonthlyRent = Math.round((price * 0.045) / 12);
    }
  }

  const estimatedAnnualRent = estimatedMonthlyRent * 12;
  const basePriceForYield = property.status === 'rent' ? Math.max(1000000, estimatedMonthlyRent * 240) : price;
  const grossYieldPercent = basePriceForYield > 0 ? Number(((estimatedAnnualRent / basePriceForYield) * 100).toFixed(2)) : 0;
  const netYieldPercent = Number((grossYieldPercent * 0.82).toFixed(2)); // deducting 18% expenses/vacancy
  const paybackYears = netYieldPercent > 0 ? Number((100 / netYieldPercent).toFixed(1)) : 0;

  let verdict = 'ผลตอบแทนมาตรฐาน';
  if (grossYieldPercent >= 7.0) {
    verdict = '🚀 ผลตอบแทนสูงมาก (Super High Yield) เหมาะแก่นักลงทุนปล่อยเช่ารับ Passive Income';
  } else if (grossYieldPercent >= 5.0) {
    verdict = '⭐ ผลตอบแทนดีเยี่ยม (Solid Yield) ชนะดอกเบี้ยเงินฝากธนาคารอย่างชัดเจน';
  } else {
    verdict = '🏡 เหมาะแก่การซื้ออยู่อาศัยเอง หรือถือครองเพื่อ Capital Gain ระยะยาว';
  }

  // Mortgage calculation (90% LTV, 5.5% interest, 30 years)
  const loanYears = 30;
  const interestRate = 0.055;
  const downPayment = Math.round(price * 0.1);
  const loanAmount = price - downPayment;

  const monthlyRate = interestRate / 12;
  const totalMonths = loanYears * 12;
  const monthlyPayment = loanAmount > 0 
    ? Math.round((loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths))) / (Math.pow(1 + monthlyRate, totalMonths) - 1))
    : 0;
  const totalInterest = Math.round((monthlyPayment * totalMonths) - loanAmount);
  const minIncomeRequired = Math.round(monthlyPayment * 2.2); // Bank DSR rule ~ 45%

  const investorPitchCard = `📊 [สรุปข้อมูลวิเคราะห์การลงทุน - INVESTMENT TEASER]
━━━━━━━━━━━━━━━━━━━━━━━━━━
🏢 ทรัพย์: ${property.title}
📍 พิกัด: ${property.district}, ${property.province}
💰 ราคาเสนอขาย: ${formatPrice(price)} บาท

📈 ดัชนีผลตอบแทน (Rental Yield & ROI):
• ค่าเช่าคาดการณ์: ~${formatPrice(estimatedMonthlyRent)} บาท/เดือน (${formatPrice(estimatedAnnualRent)} บ./ปี)
• Gross Rental Yield: ${grossYieldPercent}% ต่อปี
• Net Rental Yield: ${netYieldPercent}% ต่อปี
• ระยะเวลาคืนทุน: ~${paybackYears} ปี
• ความคุ้มค่า: ${verdict}

🏦 การวางแผนสินเชื่อธนาคาร (Mortgage Plan 30 ปี):
• เงินดาวน์ (10%): ${formatPrice(downPayment)} บาท
• ยอดกู้ (90%): ${formatPrice(loanAmount)} บาท
• ค่างวดผ่อนชำระ: ~${formatPrice(monthlyPayment)} บาท/เดือน
• รายได้ผู้กู้ขั้นต่ำแนะนำ: ${formatPrice(minIncomeRequired)} บาท/เดือน

📌 สรุปความคุ้มค่า: ${positionDescription}
━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  return {
    property,
    pricePerSqWa,
    pricePerSqMeter,
    marketBenchmark: {
      avgPricePerSqMeter: benchmarkPerSqM,
      pricePosition,
      positionDescription,
    },
    rentalYield: {
      estimatedMonthlyRent,
      estimatedAnnualRent,
      grossYieldPercent,
      netYieldPercent,
      paybackYears,
      verdict,
    },
    mortgageEstimate: {
      loanAmount,
      downPayment,
      interestRate: 5.5,
      loanYears,
      monthlyPayment,
      totalInterest,
      minIncomeRequired,
    },
    investorPitchCard,
  };
}

// ==========================================
// 4. Automated Legal Contract & Document Generator
// ==========================================

export interface ContractDraftResult {
  title: string;
  contractNumber: string;
  documentDate: string;
  content: string;
}

export function generateLegalContractDraft(
  property: Property,
  contractType: ContractType,
  buyerName: string = '..........................................................',
  buyerIdCard: string = '....................................',
  buyerPhone: string = '.........................',
  depositAmount: number = 50000
): ContractDraftResult {
  const dateObj = new Date();
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const thaiYear = dateObj.getFullYear() + 543;
  const dateStr = `${dateObj.getDate()} ${thaiMonths[dateObj.getMonth()]} พ.ศ. ${thaiYear}`;
  const contractNumber = `CTK-${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(1000 + Math.random() * 9000))}`;

  const priceText = `${formatPrice(property.price)} บาท (${numberToThaiBahtWords(property.price)})`;
  const depositText = `${formatPrice(depositAmount)} บาท (${numberToThaiBahtWords(depositAmount)})`;
  const remainingAmount = property.price - depositAmount;
  const remainingText = `${formatPrice(remainingAmount)} บาท (${numberToThaiBahtWords(remainingAmount)})`;

  const agentName = property.agent?.name || 'นายฉันทากร สถิตวิทยากุล (ฉันทากร พร็อพเพอร์ตี้)';
  const locationText = `${property.address || 'เลขที่ระบุตามโฉนด'} ตำบล${property.subdistrict || 'คอหงส์'} อำเภอ${property.district || 'หาดใหญ่'} จังหวัด${property.province || 'สงขลา'}`;
  const typeName = getPropertyTypeName(property.property_type);

  if (contractType === 'sale_agreement') {
    const content = `หนังสือสัญญาจะซื้อจะขายที่ดินและสิ่งปลูกสร้าง
เลขที่สัญญา: ${contractNumber}
ทำที่: บริษัท ฉันทากร พร็อพเพอร์ตี้ จำกัด (สำนักงานหาดใหญ่)
วันที่: ${dateStr}

สัญญานี้ทำขึ้นระหว่าง:
ฝ่ายที่ 1: เจ้าของกรรมสิทธิ์ผู้มีชื่อในโฉนดที่ดิน หรือผู้มีอำนาจกระทำการแทน ซึ่งต่อไปในสัญญานี้จะเรียกว่า "ผู้จะขาย" ฝ่ายหนึ่ง กับ
ฝ่ายที่ 2: ${buyerName} ถือบัตรประจำตัวประชาชนเลขที่ ${buyerIdCard} เบอร์โทรศัพท์ ${buyerPhone} ซึ่งต่อไปในสัญญานี้จะเรียกว่า "ผู้จะซื้อ" อีกฝ่ายหนึ่ง

ทั้งสองฝ่ายได้ตกลงทำสัญญาจะซื้อจะขายอสังหาริมทรัพย์ โดยมีข้อความดังต่อไปนี้:

ข้อ 1. ทรัพย์สินที่จะซื้อจะขาย
ผู้จะขายตกลงจะขาย และผู้จะซื้อตกลงจะซื้อ อสังหาริมทรัพย์ประเภท ${typeName}
ตั้งอยู่ ณ ${locationText}
เนื้อที่ดินประมาณ ${property.land_size || 'ตามที่ปรากฏในโฉนด'} ตารางวา พื้นที่ใช้สอยประมาณ ${property.usable_area || 'ตามแบบแปลน'} ตารางเมตร
พร้อมสิ่งปลูกสร้างและส่วนควบ ตลอดจนอุปกรณ์เฟอร์นิเจอร์ตามที่ตกลงกัน

ข้อ 2. ราคาซื้อขายและการชำระเงิน
คู่สัญญาตกลงราคาซื้อขายทรัพย์สินดังกล่าว เป็นจำนวนเงินทั้งสิ้น ${priceText} โดยมีเงื่อนไขการชำระเงินดังนี้:
2.1 ในวันทำสัญญานี้ ผู้จะซื้อได้วางเงินมัดจำไว้ให้แก่ผู้จะขาย เป็นจำนวนเงิน ${depositText} โดยผู้จะขายได้รับเงินมัดจำดังกล่าวไว้ถูกต้องเรียบร้อยแล้ว
2.2 สำหรับเงินค่าทรัพย์สินส่วนที่เหลืออีกจำนวน ${remainingText} ผู้จะซื้อจะชำระให้แก่ผู้จะขายในวันจดทะเบียนโอนกรรมสิทธิ์ ณ สำนักงานที่ดิน

ข้อ 3. กำหนดวันโอนกรรมสิทธิ์
คู่สัญญาตกลงจะไปดำเนินการจดทะเบียนโอนกรรมสิทธิ์ ณ สำนักงานที่ดินจังหวัดสงขลา (หรือสาขาที่รับผิดชอบ) ภายในกำหนดเวลาไม่เกิน 45 วัน นับแต่วันทำสัญญานี้ หรือภายในวันที่ ........................................

ข้อ 4. ค่าธรรมเนียมและภาษีอากร
คู่สัญญาตกลงรับผิดชอบค่าใช้จ่ายในการโอนกรรมสิทธิ์ ดังนี้:
- ค่าธรรมเนียมการโอนกรรมสิทธิ์ (2%): ฝ่ายละครึ่ง (คนละ 1%)
- ค่าภาษีเงินได้หัก ณ ที่จ่าย และภาษีธุรกิจเฉพาะ หรืออากรแสตมป์: ผู้จะขายเป็นผู้รับผิดชอบตามกฎหมาย
- ค่าจดจำนอง (หากผู้จะซื้อขอยื่นกู้ธนาคาร): ผู้จะซื้อเป็นผู้รับผิดชอบ

ข้อ 5. การรับประกันและผิดสัญญา
5.1 ผู้จะขายรับรองว่าทรัพย์สินดังกล่าวปราศจากภาระผูกพัน การรอนสิทธิ์ หรือการถูกเวนคืนใดๆ ทั้งสิ้น
5.2 หากผู้จะซื้อผิดสัญญาไม่ไปรับโอนกรรมสิทธิ์ ผู้จะขายมีสิทธิ์ริบเงินมัดจำได้ตามกฎหมาย
5.3 หากผู้จะขายผิดสัญญาไม่ยอมโอนกรรมสิทธิ์ ผู้จะขายยินยอมคืนเงินมัดจำเต็มจำนวน พร้อมค่าปรับเท่ากับจำนวนเงินมัดจำให้แก่ผู้จะซื้อ

สัญญานี้ถูกทำขึ้นเป็นสองฉบับมีข้อความถูกต้องตรงกัน คู่สัญญาทั้งสองฝ่ายได้อ่านและเข้าใจข้อความโดยละเอียดแล้ว จึงได้ลงลายมือชื่อไว้เป็นหลักฐานต่อหน้าพยาน


ลงชื่อ ................................................................ ผู้จะขาย
      (                                                )

ลงชื่อ ................................................................ ผู้จะซื้อ
      ( ${buyerName} )

ลงชื่อ ................................................................ ตัวแทนนายหน้า / พยาน
      ( ${agentName} )

ลงชื่อ ................................................................ พยาน
      ( ................................................................ )`;

    return {
      title: 'สัญญาจะซื้อจะขายที่ดินและสิ่งปลูกสร้าง',
      contractNumber,
      documentDate: dateStr,
      content,
    };
  }

  if (contractType === 'lease_agreement') {
    const monthlyRent = property.price || 15000;
    const monthlyRentText = `${formatPrice(monthlyRent)} บาท (${numberToThaiBahtWords(monthlyRent)})`;
    const securityDeposit = monthlyRent * 2;
    const securityDepositText = `${formatPrice(securityDeposit)} บาท (${numberToThaiBahtWords(securityDeposit)})`;

    const content = `หนังสือสัญญาเช่าอสังหาริมทรัพย์
เลขที่สัญญา: ${contractNumber}
ทำที่: บริษัท ฉันทากร พร็อพเพอร์ตี้ จำกัด
วันที่: ${dateStr}

คู่สัญญา:
ผู้ให้เช่า: เจ้าของกรรมสิทธิ์อสังหาริมทรัพย์ หรือผู้รับมอบอำนาจ ซึ่งต่อไปนี้เรียกว่า "ผู้ให้เช่า" ฝ่ายหนึ่ง กับ
ผู้เช่า: ${buyerName} เลขประจำตัวประชาชน ${buyerIdCard} เบอร์โทร ${buyerPhone} ซึ่งต่อไปนี้เรียกว่า "ผู้เช่า" อีกฝ่ายหนึ่ง

คู่สัญญาได้ตกลงทำสัญญาเช่า โดยมีเงื่อนไขดังต่อไปนี้:

ข้อ 1. ทรัพย์สินที่เช่า
ผู้ให้เช่าตกลงให้เช่า และผู้เช่าตกลงเช่า อสังหาริมทรัพย์ประเภท ${typeName} ตั้งอยู่ ณ ${locationText} เพื่อใช้เป็นที่อยู่อาศัยเท่านั้น

ข้อ 2. กำหนดระยะเวลาการเช่า
สัญญาเช่ามีกำหนดระยะเวลา 1 (หนึ่ง) ปี เริ่มตั้งแต่วันที่ ........................................ ถึงวันที่ ........................................

ข้อ 3. อัตราค่าเช่าและการชำระเงิน
3.1 ผู้เช่าตกลงชำระค่าเช่าในอัตราเดือนละ ${monthlyRentText} 
3.2 การชำระค่าเช่าต้องชำระล่วงหน้าภายในวันที่ 5 ของทุกเดือน โดยโอนเข้าบัญชีธนาคารของผู้ให้เช่า

ข้อ 4. เงินประกันความเสียหายและเงินล่วงหน้า
ในวันทำสัญญานี้ ผู้เช่าได้วางเงินประกันการเช่าจำนวน 2 เดือน เป็นเงิน ${securityDepositText} และค่าเช่าล่วงหน้า 1 เดือน เป็นเงิน ${monthlyRentText} รวมทั้งสิ้น ${formatPrice(securityDeposit + monthlyRent)} บาท ให้แก่ผู้ให้เช่าเรียบร้อยแล้ว
เงินประกันความเสียหายนี้ ผู้ให้เช่าจะคืนให้แก่ผู้เช่าเมื่อสิ้นสุดสัญญาเช่า ภายหลังจากหักค่าเสียหายและค่าน้ำ-ค่าไฟแล้ว

ข้อ 5. ค่าน้ำประปา ค่าไฟฟ้า และค่าส่วนกลาง
ผู้เช่าเป็นผู้รับผิดชอบชำระค่าน้ำประปา ค่าไฟฟ้า ตามบิลเรียกเก็บจากการประปาและการไฟฟ้าโดยตรง


ลงชื่อ ................................................................ ผู้ให้เช่า
      (                                                )

ลงชื่อ ................................................................ ผู้เช่า
      ( ${buyerName} )

ลงชื่อ ................................................................ ตัวแทนนายหน้า / พยาน
      ( ${agentName} )`;

    return {
      title: 'สัญญาเช่าอสังหาริมทรัพย์',
      contractNumber,
      documentDate: dateStr,
      content,
    };
  }

  // Default: Brokerage Agreement
  const commissionRate = property.property_type === 'land' ? '3% - 5%' : '3%';
  const content = `หนังสือสัญญาแต่งตั้งตัวแทนนายหน้าขายอสังหาริมทรัพย์
เลขที่สัญญา: ${contractNumber}
วันที่: ${dateStr}

สัญญานี้ทำขึ้นระหว่าง:
เจ้าของทรัพย์สิน: ${buyerName} ("ผู้แต่งตั้ง") ฝ่ายหนึ่ง กับ
ตัวแทนนายหน้า: บริษัท ฉันทากร พร็อพเพอร์ตี้ จำกัด โดย ${agentName} ("นายหน้า") อีกฝ่ายหนึ่ง

ข้อ 1. ทรัพย์สินที่มอบหมาย
ผู้แต่งตั้งตกลงแต่งตั้งให้นายหน้า เป็นตัวแทนในการทำการตลาด โฆษณา และจัดหาผู้ซื้อสำหรับอสังหาริมทรัพย์:
ประเภท: ${typeName} ณ ${locationText}
ราคาเสนอขายสุทธิที่ตกลง: ${priceText}

ข้อ 2. ค่าบำเหน็จนายหน้า
เมื่อนายหน้าสามารถจัดหาผู้ซื้อจนเกิดการทำสัญญาจะซื้อจะขาย หรือจดทะเบียนโอนกรรมสิทธิ์สำเร็จ ผู้แต่งตั้งตกลงจ่ายค่านายหน้าในอัตรา ${commissionRate} ของราคาขายจริง

ข้อ 3. หน้าที่ของตัวแทนนายหน้า
นายหน้าจะดำเนินการทำการตลาดผ่านช่องทางออนไลน์ เว็บไซต์ โซเชียลมีเดีย ป้ายประกาศ และเครือข่ายนักลงทุน ตลอดจนดูแลการเจรจา ประสานงานสินเชื่อธนาคาร และนิติกรรมวันโอน ณ สำนักงานที่ดินอย่างมืออาชีพ


ลงชื่อ ................................................................ ผู้แต่งตั้ง (เจ้าของทรัพย์)
      ( ${buyerName} )

ลงชื่อ ................................................................ ตัวแทนนายหน้า
      ( ${agentName} )`;

  return {
    title: 'สัญญาแต่งตั้งตัวแทนนายหน้าอสังหาริมทรัพย์',
    contractNumber,
    documentDate: dateStr,
    content,
  };
}

// ==========================================
// 5. Automated Quick-Closing Scripts
// ==========================================

export interface QuickClosingScript {
  id: string;
  category: string;
  title: string;
  customerTrigger: string;
  recommendedResponse: string;
}

export function getQuickClosingScripts(property?: Property): QuickClosingScript[] {
  const title = property?.title || 'บ้านหลังนี้';
  const price = property ? formatPrice(property.price) + ' บาท' : 'ราคาพิเศษ';
  const location = property?.district ? `อำเภอ${property.district}, ${property.province}` : 'โซนหาดใหญ่';
  const bedrooms = property?.bedrooms ? `${property.bedrooms} ห้องนอน` : 'หลายห้องนอน';
  const agentPhone = property?.agent?.phone || '082-436-4499';

  return [
    {
      id: 'script_location',
      category: '📍 พิกัด & ทำเล',
      title: 'ลูกค้าทักมาขอพิกัด / ถามว่าอยู่แถวไหน',
      customerTrigger: 'บ้านอยู่แถวไหนครับ? / ขอพิกัด Google Maps หน่อยค่ะ',
      recommendedResponse: `สวัสดีครับ 🙏 สำหรับ ${title} ตั้งอยู่ทำเล ${location} ครับ เดินทางสะดวก ใกล้ถนนใหญ่และสิ่งอำนวยความสะดวกมากครับ 

📌 พิกัด Google Maps และรายละเอียดรูปภาพ 360° สามารถแตะดูได้ที่นี่ครับ:
👉 ${typeof window !== 'undefined' ? window.location.origin : 'https://chantakornproperty.com'}${property ? '/properties/' + property.slug : ''}

หากคุณลูกค้าสะดวกวันไหน แจ้งเวลานัดหมายให้ผมพาเข้าไปเปิดบ้านชมบรรยากาศจริงได้เลยนะครับ ยินดีบริการครับ 😊`
    },
    {
      id: 'script_discount',
      category: '💰 การต่อรองราคา',
      title: 'ลูกค้าถามว่าลดได้อีกไหม / ต่อรองราคา',
      customerTrigger: 'ราคานี้ลดได้สุดๆ เท่าไหร่? / ต่อรองได้ไหมครับ?',
      recommendedResponse: `ราคาตั้งไว้ที่ ${price} ถือว่าคุ้มค่ามากเทียบกับพื้นที่ใช้สอย ${bedrooms} และทำเลโซนนี้ครับ แต่ถ้าคุณลูกค้าสนใจจริงๆ ทางเรายินดีช่วยคุยเปิดโต๊ะเจรจากับทางเจ้าของบ้านให้ได้ราคาที่ดีที่สุดครับ! 🤝

แนะนำให้เข้ามาดูบ้านจริงก่อนนะครับ หากถูกใจ สามารถยื่นข้อเสนอตัวเลขที่ต้องการเข้ามาได้เลยครับ สะดวกนัดดูบ้านวันธรรมดาหรือวันหยุดดีครับ? 📞 ${agentPhone}`
    },
    {
      id: 'script_loan',
      category: '🏦 การกู้ธนาคาร & สินเชื่อ',
      title: 'ลูกค้าถามเรื่องยื่นกู้ / ติดบูโร / กู้ได้กี่เปอร์เซ็นต์',
      customerTrigger: 'กู้ได้เต็มไหมครับ? / มีบริการยื่นกู้ให้ไหม? / เงินเดือนเท่านี้กู้ผ่านไหม?',
      recommendedResponse: `กู้ได้สูงสุดถึง 100% เลยครับ! ทาง ฉันทากร พร็อพเพอร์ตี้ มีทีมผู้เชี่ยวชาญด้านสินเชื่อดูแลประสานงานกับธนาคารชั้นนำให้ฟรีทุกขั้นตอน (SCB, กสิกร, ธอส., ออมสิน, กรุงไทย) 🏛️

เราช่วยตรวจเช็กวงเงินก่อนยื่นจริง ทราบผลเบื้องต้นไวใน 24 ชั่วโมง โดยไม่มีค่าใช้จ่ายครับ เพียงเตรียมสลิปเงินเดือนหรือสเตทเมนต์ย้อนหลัง 6 เดือน ให้ทีมงานช่วยวิเคราะห์ได้เลยครับ สนใจส่งเอกสารตรวจวงเงินก่อนไหมครับ? 😊`
    },
    {
      id: 'script_appointment',
      category: '📅 การนัดเข้าชมบ้าน',
      title: 'ลูกค้านัดหมายเข้าชมบ้านจริง',
      customerTrigger: 'สะดวกให้เข้าไปดูบ้านวันไหนได้บ้างครับ?',
      recommendedResponse: `ยินดีต้อนรับเลยครับ! 🎉 สามารถนัดชมได้ทุกวันเลยครับ โดยแนะนำแจ้งล่วงหน้า 1 วัน เพื่อประสานงานเปิดบ้านและเตรียมเอกสารข้อมูลโครงการไว้ให้ครับ

คุณลูกค้าสะดวกเป็นวันเสาร์-อาทิตย์ หรือวันธรรมดาช่วงเช้าหรือบ่ายดีครับ? ผมจะได้ล็อกคิวพิเศษให้ครับ หรือโทรนัดด่วนได้ที่เบอร์ ${agentPhone} ได้เลยครับ 🙏`
    },
    {
      id: 'script_followup',
      category: '⏳ การติดตามผล (Follow-up)',
      title: 'ลูกค้าเงียบไป หรือบอกว่า "ขอคิดดูก่อน"',
      customerTrigger: 'ขอปรึกษาแฟนก่อนนะคะ / เดี๋ยวติดต่อกลับค่ะ',
      recommendedResponse: `ได้เลยครับคุณลูกค้า ให้เวลาปรึกษากันได้เต็มที่เลยครับผมเข้าใจเลยครับการเลือกบ้านเป็นเรื่องสำคัญ 🏡✨

แต่ขออนุญาตแจ้งข้อมูลนิดนึงนะครับ พอดีทรัพย์หลังนี้มีผู้สนใจนัดเข้าชมอยู่เรื่อยๆ หากมีข้อสงสัยเรื่องโครงสร้าง การต่อเติม หรืออยากให้ช่วยคำนวณค่างวดเปรียบเทียบแต่ละธนาคาร ทักถามผมได้ตลอด 24 ชม. เลยนะครับ ขอให้ได้บ้านที่ถูกใจที่สุดครับ! 🌟`
    }
  ];
}
