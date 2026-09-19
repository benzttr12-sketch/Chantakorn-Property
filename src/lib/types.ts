export type PropertyType = 'house' | 'land' | 'condo' | 'commercial' | 'investment' | 'consignment';
export type PropertyStatus = 'sale' | 'rent';

export interface PropertyImage {
  id: string;
  property_id: string;
  image_url: string;
  sort_order: number;
}

export interface Agent {
  id: string;
  name: string;
  title: string;
  phone: string;
  line_id: string;
  facebook?: string;
  email: string;
  photo_url: string;
  bio: string;
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
  featured: boolean;
  published: boolean;
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
  slug: string;
  createdAt?: string;
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
  sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'popular';
}
