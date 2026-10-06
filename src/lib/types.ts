// Shared TypeScript type definitions for Chantakorn Property
// Mirrors the Supabase schema: profiles, properties, inquiries, favorite_properties

export type PropertyStatus = 'sale' | 'rent' | 'sold';

export type UserRole = 'ADMIN' | 'AGENT' | 'USER';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatar_url?: string;
  line_id?: string;
  facebook?: string;
  bio?: string;
  created_at: string;
  updated_at?: string;
}

export interface Agent extends UserProfile {
  agency_name?: string;
  license_number?: string;
  rating?: number;
  review_count?: number;
  properties_count?: number;
  is_verified?: boolean;
  experience_years?: number;
  specialties?: string[];
  languages?: string[];
  description?: string;
}

export interface PropertyImage {
  id: string;
  url: string;
  is_primary?: boolean;
  caption?: string;
}

export interface Property {
  id: string;
  slug: string;
  title: string;
  description: string;
  internal_notes?: string;

  property_type: 'house' | 'land' | 'condo' | 'commercial' | 'townhome';
  status: PropertyStatus;
  price: number;

  address?: string;
  district: string;
  province: string;
  postcode?: string;
  latitude: number;
  longitude: number;
  location_display_name?: string;

  bedrooms: number;
  bathrooms: number;
  parking?: number;
  land_size: number;
  land_size_rai?: number;
  land_size_ngan?: number;
  land_size_square_wa?: number;
  usable_area?: number;
  facing_direction?: 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest';

  image_urls?: string[];
  cover_image: string;
  images: string[];
  video_url?: string | null;
  video_type?: 'youtube' | 'facebook' | 'tiktok' | 'file' | null;

  features?: string[];

  year_built?: number;
  furniture?: 'none' | 'partial' | 'full';
  house_condition?: 'new' | 'excellent' | 'good' | 'fair' | 'needs_renovation';

  land_title_deed_type?: 'chanote' | 'nor_sor_3_kor' | 'nor_sor_3_hor' | 'sor_kor_1' | 'por_bor_tor_5' | 'other';
  land_zoning?: 'orange' | 'yellow' | 'green' | 'purple' | 'red' | 'blue' | 'brown' | 'none';
  land_width_meters?: number;
  public_utility_access?: string[];
  canal_access?: boolean;
  road_access?: boolean;
  corner_plot?: boolean;

  created_at: string;
  updated_at: string;
  published?: boolean;
  featured?: boolean;

  agent?: Agent;
  views_count?: number;
}

export interface PropertyFilters {
  status?: PropertyStatus | 'all';
  property_type?: Property['property_type'] | 'all';
  district?: string;
  minPrice?: number;
  maxPrice?: number;
  minLandSize?: number;
  maxLandSize?: number;
  bedrooms?: number | 'any';
  bathrooms?: number | 'any';
  features?: string[];
  searchQuery?: string;
  hasVideo?: boolean;
  featured?: boolean;
  sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'popular';
}

export type PropertyHistoryChangeType =
  | 'price_change'
  | 'status_change'
  | 'description_update'
  | 'images_update'
  | 'features_update'
  | 'other';

export interface PropertyHistoryEntry {
  id: string;
  property_id: string;
  changed_at: string;
  change_type: PropertyHistoryChangeType;
  field_name?: string;
  old_value?: string | number | boolean | null;
  new_value?: string | number | boolean | null;
  note?: string;
  changed_by?: string;
}

export interface Inquiry {
  id: string;
  property_id?: string | null;
  property_title?: string;
  full_name: string;
  email: string;
  phone: string;
  message?: string;
  inquiry_type: 'general' | 'viewing' | 'price_negotiation' | 'sell_with_us';
  status: 'new' | 'in_progress' | 'contacted' | 'closed';
  created_at: string;
  updated_at?: string;
  admin_notes?: string;
}

export interface Review {
  id: string;
  property_id?: string | null;
  user_id?: string | null;
  user_name: string;
  user_avatar_url?: string | null;
  rating: number;
  comment: string;
  is_featured: boolean;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface SystemSettings {
  id: string;
  contact_phone: string;
  contact_email: string;
  contact_line_id: string;
  contact_facebook_url: string;
  office_address: string;
  office_hours: string;
  is_maintenance_mode?: boolean;
}

export interface NearbyLandmark {
  title: string;
  category: 'hospital' | 'education' | 'shopping' | 'transport' | 'market' | 'tourism' | 'government' | 'other';
  latitude: number;
  longitude: number;
}

export interface MapDisplayProperty extends Property {
  display_price_label: string;
  status_color: string;
}

export type NotificationType = 'inquiry_new' | 'inquiry_updated' | 'review_new' | 'review_updated' | 'system_alert';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}
