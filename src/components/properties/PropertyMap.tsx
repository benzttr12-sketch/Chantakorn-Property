'use client';

import React from 'react';
import GooglePropertyMap from './GooglePropertyMap';
import { Property } from '@/lib/types';

interface PropertyMapProps {
  properties: Property[];
  selectedProperty?: Property | null;
  onSelectProperty?: (property: Property) => void;
  height?: string;
  zoom?: number;
  center?: [number, number];
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  onDistrictSelect?: (district: string) => void;
  showDistrictPills?: boolean;
  className?: string;
}

export default function PropertyMap(props: PropertyMapProps) {
  return <GooglePropertyMap {...props} />;
}
