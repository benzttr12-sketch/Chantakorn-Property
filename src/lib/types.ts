export type PropertyType = 'house' | 'land' | 'condo' | 'commercial' | 'investment' | 'consignment';
export type PropertyStatus = 'sale' | 'rent';

export interface PropertyImage {
  id: string;
  property_id: string;
  image_url: string;
  sort_order: number;
}

export type AgentRank = 'แอดมิน' | 'นายหน้า';

export interface Agent {
  id: string;
  name: string;
  rank?: AgentRank;
  title: AgentRank | string;
  phone: string;
  line_id: string;
  facebook?: string;
  email: string;
  photo_url: string;
  bio: string;
  user_id?: string;
}

export type FacingDirection =
  | 'ทิศเหนือ'
  | 'ทิศใต้'
  | 'ทิศตะวันออก'
  | 'ทิศตะวันตก'
  | 'ทิศตะวันออกเฉียงเหนือ'
  | 'ทิศตะวันออกเฉียงใต้'
  | 'ทิศตะวันตกเฉียงเหนือ'
  | 'ทิศตะวันตกเฉียงใต้';

export interface FengShuiAnalysis {
  direction: string;
  degrees: number;
  element: string;
  elementColor: string;
  score: number;
  grade: string;
  meaning: string;
  summary: string;
  highlights: string[];
  windEnergy: string;
  sunEnergy: string;
  suitableFor: string[];
  luckyColors: string[];
  auspiciousDecorTips: string[];
  auspiciousNumbers: string;
  qiFlow: string;
}

export interface Property {
  id: string;
  title: string;
  slug: string;
  description: string;
  property_type: PropertyType;
  status: PropertyStatus;
  price: number;
  province: string;
  district: string;
  subdistrict?: string;
  address?: string;
  latitude: number;
  longitude: number;
  facing_direction?: FacingDirection | string;
  feng_shui?: FengShuiAnalysis;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  land_size: number; // ตร.ว.
  usable_area: number; // ตร.ม.
  year_built?: number;
  furniture: string;
  features: string[];
  cover_image: string;
  images: string[];
  video_url?: string;
  videos?: string[];
  featured: boolean;
  published: boolean;
  internal_notes?: string;
  agent_id?: string;
  agent?: Agent;
  created_at: string;
  updated_at?: string;
}

export interface PropertyCardProps {
  id: string;
  title: string;
  type: PropertyType;
  status: PropertyStatus;
  price: number;
  location: string;
  district: string;
  province: string;
  coverImage: string;
  images?: string[];
  bedrooms: number;
  bathrooms: number;
  landSize: number;
  usableArea: number;
  featured?: boolean;
  video_url?: string;
  slug: string;
  createdAt?: string;
  facingDirection?: string;
}

export interface Inquiry {
  id: string;
  property_id?: string;
  property_title?: string;
  name: string;
  phone: string;
  line_id?: string;
  message: string;
  inquiry_type: 'inquiry' | 'viewing' | 'consignment_sell';
  status: 'new' | 'contacted' | 'scheduled' | 'closed';
  consignment_details?: {
    property_type: string;
    province: string;
    district: string;
    subdistrict?: string;
    expected_price: number;
    land_size?: number;
    usable_area?: number;
    photos_count?: number;
    photos?: string[];
  };
  created_at: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  phone?: string;
  role: 'ADMIN' | 'AGENT' | 'USER';
  avatar_url?: string;
  email?: string;
  line_id?: string;
  facebook?: string;
  bio?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PropertyFilters {
  type?: PropertyType | 'all';
  status?: PropertyStatus | 'all';
  province?: string;
  district?: string;
  subdistrict?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number | 'any';
  bathrooms?: number | 'any';
  features?: string[];
  searchQuery?: string;
  hasVideo?: boolean;
  sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'popular';
}

export type PropertyHistoryChangeType =
  | 'price_change'
  | 'status_change'
  | 'agent_change'
  | 'published_change'
  | 'featured_change'
  | 'info_update'
  | 'created'
  | 'manual_note';

export interface PropertyHistoryLog {
  id: string;
  property_id: string;
  property_title?: string;
  change_type: PropertyHistoryChangeType;
  previous_value?: string | number | boolean | null;
  new_value?: string | number | boolean | null;
  diff_summary: string;
  actor_name: string;
  actor_email?: string;
  actor_role?: string;
  timestamp: string;
  notes?: string;
}

export type SystemActivityCategory = 'property' | 'inquiry' | 'user_role' | 'system';

export interface SystemActivity {
  id: string;
  category: SystemActivityCategory;
  action: string;
  title: string;
  description: string;
  target_id?: string;
  target_name?: string;
  actor_name: string;
  actor_email?: string;
  actor_role?: string;
  metadata?: Record<string, any>;
  created_at: string;
}
