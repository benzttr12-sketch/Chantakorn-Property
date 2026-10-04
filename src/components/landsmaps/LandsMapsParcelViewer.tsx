'use client';

import { ExternalLink, MapPin } from 'lucide-react';
import ParcelLocationMap from '@/components/landsmaps/ParcelLocationMap';
import { LANDSMAPS_URL, TREASURY_APPRAISAL_URL, isValidCoordinates, sqWahToRaiNganWah } from '@/lib/landsmaps';
import { Property } from '@/lib/types';
import { formatPrice } from '@/lib/utils';

interface LandsMapsParcelViewerProps {
  property: Property;
}

export default function LandsMapsParcelViewer({ property }: LandsMapsParcelViewerProps) {
  const hasCoordinates = property.coordinates_available !== false
    && isValidCoordinates(property.latitude, property.longitude);
  let area: ReturnType<typeof sqWahToRaiNganWah> | null = null;
  try {
    if (Number.isFinite(property.land_size) && property.land_size > 0) {
      area = sqWahToRaiNganWah(property.land_size);
    }
  } catch { /* An invalid stored area must not prevent the public listing from opening. */ }
  const location = [property.subdistrict && `ต.${property.subdistrict}`, property.district && `อ.${property.district}`, property.province && `จ.${property.province}`]
    .filter(Boolean).join(' ');
  const googleMapsUrl = hasCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property.latitude},${property.longitude}`)}`
    : null;

  return (
    <section className="space-y-5 rounded-3xl border border-gold-500/30 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="property-land-location-title">
      <div className="flex items-start gap-3 border-b border-gray-100 pb-4">
        <MapPin className="mt-1 h-6 w-6 shrink-0 text-gold-600" aria-hidden="true" />
        <div>
          <h3 id="property-land-location-title" className="text-lg font-extrabold text-navy-950">ตำแหน่งที่ดินจากประกาศ</h3>
          <p className="mt-1 text-sm text-gray-500">หมุดจากข้อมูลทรัพย์ ไม่ใช่แนวเขตโฉนดจากกรมที่ดิน</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs text-gray-500">เนื้อที่ในประกาศ</p>
          <p className="mt-1 font-bold text-navy-950">
            {area ? `${area.rai} ไร่ ${area.ngan} งาน ${area.sqWah.toLocaleString('th-TH', { maximumFractionDigits: 4 })} ตร.ว.` : 'ยังไม่ระบุเนื้อที่'}
          </p>
          {area && <p className="mt-1 text-xs text-gray-500">{area.totalSqMeters.toLocaleString('th-TH', { maximumFractionDigits: 4 })} ตร.ม.</p>}
        </div>
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs text-gray-500">ทำเล</p>
          <p className="mt-1 font-bold text-navy-950">{location || 'ยังไม่ระบุทำเล'}</p>
          {hasCoordinates && <p className="mt-1 break-words font-mono text-xs text-gray-500">{property.latitude.toFixed(6)}, {property.longitude.toFixed(6)}</p>}
        </div>
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs text-gray-500">ราคาเสนอขาย</p>
          <p className="mt-1 font-bold text-navy-950">{Number.isFinite(property.price) && property.price > 0 ? formatPrice(property.price) : 'ยังไม่ระบุราคา'}</p>
          <p className="mt-1 text-xs text-gray-500">ราคาตั้งขายจากประกาศ ไม่ใช่ราคาประเมินกรมธนารักษ์</p>
        </div>
      </div>

      {hasCoordinates ? (
        <ParcelLocationMap latitude={property.latitude} longitude={property.longitude} height="320px" />
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">ยังไม่มีพิกัดที่ดินในประกาศนี้</div>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        {googleMapsUrl && <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-4 py-2 font-semibold text-blue-700 hover:bg-blue-50">ดูตำแหน่งบน Google Maps <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>}
        <a href={LANDSMAPS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-4 py-2 font-semibold text-blue-700 hover:bg-blue-50">ค้นรูปแปลงใน LandsMaps <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
        <a href={TREASURY_APPRAISAL_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-4 py-2 font-semibold text-blue-700 hover:bg-blue-50">ค้นราคาประเมินกรมธนารักษ์ <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
      </div>
      <p className="text-xs leading-relaxed text-gray-500">ดูรูปแปลงจริงและตรวจสอบราคาประเมินในเว็บไซต์ทางการ โดยใช้จังหวัด อำเภอ และข้อมูลโฉนดของที่ดินแปลงนั้น</p>
    </section>
  );
}
