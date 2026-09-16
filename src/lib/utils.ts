import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { PropertyType, PropertyStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number, status: PropertyStatus = 'sale'): string {
  if (!price && price !== 0) return 'ติดต่อสอบถาม';
  const formatted = new Intl.NumberFormat('th-TH').format(price);
  if (status === 'rent') {
    return `฿${formatted} / เดือน`;
  }
  return `฿${formatted}`;
}

export function formatThaiNumber(num: number): string {
  return new Intl.NumberFormat('th-TH').format(num);
}

export function getPropertyTypeName(type: PropertyType | string): string {
  switch (type) {
    case 'house':
      return 'บ้าน / ทาวน์โฮม';
    case 'land':
      return 'ที่ดิน';
    case 'condo':
      return 'คอนโดมิเนียม';
    case 'commercial':
      return 'อาคารพาณิชย์';
    case 'investment':
      return 'อสังหาฯ เพื่อการลงทุน';
    case 'consignment':
      return 'ขายฝาก / จำนอง';
    default:
      return 'อสังหาริมทรัพย์';
  }
}

export function getPropertyStatusBadge(status: PropertyStatus): { text: string; bgClass: string; textClass: string } {
  if (status === 'rent') {
    return {
      text: 'ให้เช่า',
      bgClass: 'bg-emerald-600',
      textClass: 'text-white'
    };
  }
  return {
    text: 'ขาย',
    bgClass: 'bg-gold-500',
    textClass: 'text-navy-950 font-bold'
  };
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0E00-\u0E7F-]+/g, '')
    .replace(/--+/g, '-');
}

export function formatThaiDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  const day = date.getDate();
  const month = thaiMonths[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}
