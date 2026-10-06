export const GOOGLE_MAPS_API_KEY = 
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 
  process.env.VITE_GOOGLE_MAPS_API_KEY || 
  '';

export const DEFAULT_MAP_CENTER = {
  lat: 7.0084,
  lng: 100.4705, // Hat Yai Downtown
};

export const SONGKHLA_DISTRICT_COORDS: Record<string, { lat: number; lng: number; zoom: number; label: string }> = {
  'หาดใหญ่': { lat: 7.0084, lng: 100.4705, zoom: 13, label: 'หาดใหญ่ (ม.อ.–เซ็นทรัล)' },
  'ควนลัง': { lat: 6.9942, lng: 100.4182, zoom: 13, label: 'ควนลัง (โซนสนามบิน)' },
  'คลองแห': { lat: 7.0428, lng: 100.4812, zoom: 13, label: 'คลองแห (ตลาดน้ำ)' },
  'บ้านพรุ': { lat: 6.9538, lng: 100.4883, zoom: 13, label: 'บ้านพรุ (ม.หาดใหญ่)' },
  'เมืองสงขลา': { lat: 7.1756, lng: 100.6141, zoom: 13, label: 'เมืองสงขลา (สมิหลา)' },
  'สะเดา': { lat: 6.6348, lng: 100.4243, zoom: 12, label: 'สะเดา (ด่านนอกชายแดน)' },
  'สิงหนคร': { lat: 7.2150, lng: 100.5600, zoom: 12, label: 'สิงหนคร (สะพานติณฯ)' },
};
