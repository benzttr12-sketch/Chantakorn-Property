import React from 'react';
import { Property } from '@/lib/types';
import { formatPrice, getPropertyTypeName, formatThaiNumber } from '@/lib/utils';
import { 
  Home, 
  Tag, 
  Coins, 
  Maximize, 
  Bed, 
  Bath, 
  Car, 
  Calendar, 
  Armchair, 
  FileText,
  Compass
} from 'lucide-react';
import { calculateFengShui } from '@/lib/feng-shui';

interface PropertySpecsProps {
  property: Property;
}

export default function PropertySpecs({ property }: PropertySpecsProps) {
  const fengShui = property.feng_shui || calculateFengShui(property.facing_direction, {
    lat: property.latitude,
    lng: property.longitude,
    propertyId: property.id
  });

  const specs = [
    {
      label: 'ประเภททรัพย์',
      value: getPropertyTypeName(property.property_type),
      icon: Home,
    },
    {
      label: 'ทิศหน้าทรัพย์ (ฮวงจุ้ย)',
      value: `${fengShui.direction} (${fengShui.element.split(' ')[0]})`,
      icon: Compass,
    },
    {
      label: 'สถานะ',
      value: property.status === 'rent' ? 'สำหรับเช่า' : 'สำหรับขาย',
      icon: Tag,
    },
    {
      label: property.status === 'rent' ? 'ราคาค่าเช่า' : 'ราคาขาย',
      value: formatPrice(property.price, property.status),
      icon: Coins,
      highlight: true,
    },
    {
      label: 'ขนาดที่ดิน',
      value: property.land_size > 0 ? `${formatThaiNumber(property.land_size)} ตร.ว.` : 'ไม่ระบุ',
      icon: Maximize,
    },
    {
      label: 'พื้นที่ใช้สอย',
      value: property.usable_area > 0 ? `${formatThaiNumber(property.usable_area)} ตร.ม.` : 'ไม่ระบุ',
      icon: Maximize,
    },
    {
      label: 'ห้องนอน',
      value: property.bedrooms > 0 ? `${property.bedrooms} ห้อง` : '-',
      icon: Bed,
    },
    {
      label: 'ห้องน้ำ',
      value: property.bathrooms > 0 ? `${property.bathrooms} ห้อง` : '-',
      icon: Bath,
    },
    {
      label: 'ที่จอดรถ',
      value: property.parking > 0 ? `${property.parking} คัน` : '-',
      icon: Car,
    },
    {
      label: 'ปีที่สร้าง',
      value: property.year_built ? `พ.ศ. ${property.year_built + 543} (${property.year_built})` : 'ไม่ระบุ',
      icon: Calendar,
    },
    {
      label: 'เฟอร์นิเจอร์',
      value: property.furniture || 'พร้อมอยู่บางส่วน',
      icon: Armchair,
    },
    {
      label: 'เอกสารสิทธิ์',
      value: 'โฉนดที่ดิน น.ส. 4 จ (ครุฑแดง) พร้อมโอน',
      icon: FileText,
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 border border-surface-border shadow-card">
      <h3 className="text-base font-bold text-navy-950 uppercase tracking-wider mb-5 pb-3 border-b border-gray-100 flex items-center">
        <FileText className="w-4 h-4 text-gold-600 mr-2" />
        ข้อมูลจำเพาะของทรัพย์ (Property Specifications)
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {specs.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={`p-3.5 rounded-xl border flex items-center space-x-3 ${
                item.highlight
                  ? 'bg-gold-50/60 border-gold-300/80 text-navy-950'
                  : 'bg-gray-50/70 border-gray-100 text-gray-800'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                item.highlight ? 'bg-gold-500 text-navy-950' : 'bg-white text-navy-900 shadow-xs'
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-grow">
                <span className="text-[11px] text-gray-500 block leading-tight">
                  {item.label}
                </span>
                <span className={`text-xs sm:text-sm font-bold block truncate ${
                  item.highlight ? 'text-gold-700 text-base' : 'text-navy-950'
                }`}>
                  {item.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
