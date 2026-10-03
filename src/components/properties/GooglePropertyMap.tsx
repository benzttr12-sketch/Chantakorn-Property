'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  InfoWindow, 
  useMap 
} from '@vis.gl/react-google-maps';
import { Property } from '@/lib/types';
import { formatPrice, isValidLatLng } from '@/lib/utils';
import { propertyHref } from '@/components/properties/property-link';
import { 
  GOOGLE_MAPS_API_KEY, 
  DEFAULT_MAP_CENTER, 
  SONGKHLA_DISTRICT_COORDS 
} from '@/lib/maps-config';
import { 
  Home, 
  Building2, 
  Trees, 
  Store, 
  MapPin, 
  Bed, 
  Bath, 
  Maximize, 
  ArrowRight, 
  Compass, 
  Maximize2, 
  Minimize2, 
  ExternalLink,
  Layers,
  Sparkles,
  RefreshCw,
  Navigation
} from 'lucide-react';

interface GooglePropertyMapProps {
  properties: Property[];
  selectedProperty?: Property | null;
  onSelectProperty?: (property: Property) => void;
  height?: string;
  zoom?: number;
  center?: [number, number] | { lat: number; lng: number };
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  onDistrictSelect?: (district: string) => void;
  className?: string;
  showDistrictPills?: boolean;
}

// Inner Controller to pan/zoom when selectedProperty or focusDistrict changes
function MapCameraController({ 
  selectedProperty, 
  targetCenter 
}: { 
  selectedProperty?: Property | null;
  targetCenter?: { lat: number; lng: number; zoom?: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (selectedProperty && isValidLatLng(Number(selectedProperty.latitude), Number(selectedProperty.longitude))) {
      map.panTo({
        lat: Number(selectedProperty.latitude),
        lng: Number(selectedProperty.longitude),
      });
      const currentZoom = map.getZoom() || 12;
      if (currentZoom < 14) {
        map.setZoom(15);
      }
    }
  }, [map, selectedProperty]);

  useEffect(() => {
    if (!map || !targetCenter) return;
    map.panTo({ lat: targetCenter.lat, lng: targetCenter.lng });
    if (targetCenter.zoom) {
      map.setZoom(targetCenter.zoom);
    }
  }, [map, targetCenter]);

  return null;
}

export default function GooglePropertyMap({
  properties,
  selectedProperty,
  onSelectProperty,
  height = '100%',
  zoom = 12,
  center,
  isFullScreen = false,
  onToggleFullScreen,
  onDistrictSelect,
  className = '',
  showDistrictPills = true,
}: GooglePropertyMapProps) {
  const [activePopupProperty, setActivePopupProperty] = useState<Property | null>(null);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const [targetCenter, setTargetCenter] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [selectedDistrictName, setSelectedDistrictName] = useState<string>('');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');

  // Fallback state if Google Maps Web JS is slow or blocked in preview
  const [hasGoogleMapsError, setHasGoogleMapsError] = useState(false);

  // Sync active popup with selectedProperty from parent
  useEffect(() => {
    if (selectedProperty) {
      setActivePopupProperty(selectedProperty);
    }
  }, [selectedProperty]);

  // Valid coordinate properties with safe fallback coordinates in Songkhla / Hat Yai
  const validProperties = useMemo(() => {
    return properties.map((p, idx) => {
      let lat = Number(p.latitude);
      let lng = Number(p.longitude);

      if (!isValidLatLng(lat, lng)) {
        const districtKey = p.district || 'หาดใหญ่';
        const fallback = SONGKHLA_DISTRICT_COORDS[districtKey] || DEFAULT_MAP_CENTER;
        // Jitter slightly so overlapping pins spread out naturally
        const offsetLat = ((idx % 5) - 2) * 0.004;
        const offsetLng = (((idx * 3) % 5) - 2) * 0.004;
        lat = fallback.lat + offsetLat;
        lng = fallback.lng + offsetLng;
      }

      return {
        ...p,
        latitude: lat,
        longitude: lng,
      };
    });
  }, [properties]);

  // Compute initial map center
  const initialCenter = useMemo(() => {
    if (center) {
      if (Array.isArray(center) && center.length === 2) {
        return { lat: center[0], lng: center[1] };
      }
      if ('lat' in center && 'lng' in center) {
        return { lat: center.lat, lng: center.lng };
      }
    }
    if (selectedProperty && isValidLatLng(Number(selectedProperty.latitude), Number(selectedProperty.longitude))) {
      return { lat: Number(selectedProperty.latitude), lng: Number(selectedProperty.longitude) };
    }
    if (validProperties.length > 0) {
      return { lat: Number(validProperties[0].latitude), lng: Number(validProperties[0].longitude) };
    }
    return DEFAULT_MAP_CENTER;
  }, [center, selectedProperty, validProperties]);

  // Format short price badge for marker
  const formatShortPrice = (price: number, status: string) => {
    if (status === 'rent') {
      if (price >= 1000) return `฿${(price / 1000).toFixed(0)}K/ด`;
      return `฿${price.toLocaleString()}/ด`;
    }
    if (price >= 1000000) {
      const millions = price / 1000000;
      return `฿${millions >= 10 ? millions.toFixed(1) : millions.toFixed(2)}M`;
    }
    if (price >= 100000) {
      return `฿${(price / 100000).toFixed(1)}แสน`;
    }
    return `฿${(price / 1000).toFixed(0)}K`;
  };

  const getPropertyIcon = (type: string) => {
    switch (type) {
      case 'house': return Home;
      case 'condo': return Building2;
      case 'land': return Trees;
      case 'commercial': return Store;
      default: return Building2;
    }
  };

  const handleDistrictJump = (districtKey: string) => {
    setSelectedDistrictName(districtKey);
    const coords = SONGKHLA_DISTRICT_COORDS[districtKey];
    if (coords) {
      setTargetCenter({ lat: coords.lat, lng: coords.lng, zoom: coords.zoom });
    }
    if (onDistrictSelect) {
      onDistrictSelect(districtKey);
    }
  };

  const handleResetView = () => {
    setSelectedDistrictName('');
    setTargetCenter({ lat: DEFAULT_MAP_CENTER.lat, lng: DEFAULT_MAP_CENTER.lng, zoom: 12 });
  };

  // Fallback URL for embedded view if needed
  const embedMapUrl = useMemo(() => {
    const lat = targetCenter?.lat || (activePopupProperty ? Number(activePopupProperty.latitude) : initialCenter.lat);
    const lng = targetCenter?.lng || (activePopupProperty ? Number(activePopupProperty.longitude) : initialCenter.lng);
    const zoomLvl = targetCenter?.zoom || zoom || 13;
    return `https://maps.google.com/maps?q=${lat},${lng}&hl=th&z=${zoomLvl}&t=${mapType === 'satellite' || mapType === 'hybrid' ? 'k' : 'm'}&output=embed`;
  }, [targetCenter, activePopupProperty, initialCenter, zoom, mapType]);

  return (
    <div 
      className={`relative w-full rounded-2xl overflow-hidden border border-surface-border shadow-md bg-navy-950 flex flex-col transition-all duration-300 ${
        isFullScreen ? 'h-[calc(100vh-140px)]' : 'h-full min-h-[480px]'
      } ${className}`}
      style={{ height: isFullScreen ? 'calc(100vh - 140px)' : height }}
    >
      {/* Top Floating Control Bar */}
      {showDistrictPills && (
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pointer-events-none">
          {/* District Quick Jump Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 pointer-events-auto bg-navy-950/90 backdrop-blur-md p-1.5 rounded-xl border border-white/15 shadow-xl">
            <span className="text-[11px] font-bold text-gold-400 px-2 flex items-center gap-1 shrink-0">
              <Compass className="w-3.5 h-3.5 text-gold-400" />
              <span>ทำเล:</span>
            </span>

            {Object.keys(SONGKHLA_DISTRICT_COORDS).map((d) => {
              const active = selectedDistrictName === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDistrictJump(d)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 cursor-pointer ${
                    active
                      ? 'bg-gold-500 text-navy-950 shadow-md font-bold'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {d}
                </button>
              );
            })}

            {selectedDistrictName && (
              <button
                type="button"
                onClick={handleResetView}
                className="text-[10px] text-slate-300 hover:text-white px-2 py-0.5 underline cursor-pointer shrink-0"
              >
                มุมมองรวม
              </button>
            )}
          </div>

          {/* Action Tools: Property Count, Layers, Fullscreen */}
          <div className="flex items-center space-x-2 pointer-events-auto self-end sm:self-auto">
            <div className="px-3 py-1.5 rounded-xl bg-navy-950/90 backdrop-blur-md border border-white/15 text-white text-xs font-bold shadow-xl flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>{validProperties.length} ทรัพย์บนแผนที่</span>
            </div>

            {/* Google Maps External Open */}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${initialCenter.lat},${initialCenter.lng}`}
              target="_blank"
              rel="noreferrer"
              title="เปิดดูใน Google Maps App"
              className="p-2 rounded-xl bg-navy-950/90 backdrop-blur-md border border-white/15 text-white hover:text-gold-400 hover:bg-navy-900 shadow-xl transition-all cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {onToggleFullScreen && (
              <button
                type="button"
                onClick={onToggleFullScreen}
                title={isFullScreen ? 'ย่อแผนที่' : 'ขยายเต็มหน้าจอ'}
                className="p-2 rounded-xl bg-navy-950/90 backdrop-blur-md border border-white/15 text-white hover:text-gold-400 hover:bg-navy-900 shadow-xl transition-all cursor-pointer"
              >
                {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Google Maps Engine */}
      {!hasGoogleMapsError ? (
        <APIProvider 
          apiKey={GOOGLE_MAPS_API_KEY}
          onError={() => setHasGoogleMapsError(true)}
        >
          <Map
            defaultCenter={initialCenter}
            defaultZoom={zoom}
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            gestureHandling="greedy"
            disableDefaultUI={false}
            zoomControl={true}
            mapTypeControl={true}
            streetViewControl={true}
            fullscreenControl={false}
            className="w-full h-full"
            style={{ width: '100%', height: '100%' }}
          >
            <MapCameraController 
              selectedProperty={selectedProperty} 
              targetCenter={targetCenter} 
            />

            {/* Render Advanced Markers for Properties */}
            {validProperties.map((prop) => {
              const isSelected = activePopupProperty?.id === prop.id;
              const isHovered = hoveredPropertyId === prop.id;
              const Icon = getPropertyIcon(prop.property_type);
              const shortPrice = formatShortPrice(prop.price, prop.status);
              const isRent = prop.status === 'rent';

              return (
                <AdvancedMarker
                  key={prop.id}
                  position={{
                    lat: Number(prop.latitude),
                    lng: Number(prop.longitude),
                  }}
                  onClick={() => {
                    setActivePopupProperty(prop);
                    if (onSelectProperty) onSelectProperty(prop);
                  }}
                >
                  {/* Custom Luxury Price Badge Marker */}
                  <div
                    onMouseEnter={() => setHoveredPropertyId(prop.id)}
                    onMouseLeave={() => setHoveredPropertyId(null)}
                    className={`group relative flex items-center space-x-1.5 px-2.5 py-1 rounded-full cursor-pointer transition-all duration-300 transform select-none ${
                      isSelected
                        ? 'bg-gradient-to-r from-gold-500 to-amber-400 text-navy-950 font-black scale-110 shadow-2xl ring-4 ring-gold-400/50 z-30'
                        : isHovered
                        ? 'bg-navy-900 text-gold-300 font-extrabold scale-105 shadow-xl ring-2 ring-white/60 z-20'
                        : isRent
                        ? 'bg-emerald-700 text-white font-bold shadow-md hover:bg-emerald-600'
                        : 'bg-navy-950 text-white font-bold shadow-md hover:bg-navy-900 border border-white/20'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-navy-950' : 'text-gold-400'}`} />
                    <span className="text-xs tracking-tight whitespace-nowrap">{shortPrice}</span>

                    {isSelected && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    )}
                  </div>
                </AdvancedMarker>
              );
            })}

            {/* Luxury Property InfoWindow Popup */}
            {activePopupProperty && isValidLatLng(Number(activePopupProperty.latitude), Number(activePopupProperty.longitude)) && (
              <InfoWindow
                position={{
                  lat: Number(activePopupProperty.latitude),
                  lng: Number(activePopupProperty.longitude),
                }}
                onCloseClick={() => setActivePopupProperty(null)}
                pixelOffset={[0, -32]}
              >
                <div className="w-64 max-w-[270px] p-1 text-navy-950 font-sans">
                  {/* Thumbnail Image */}
                  <div className="relative h-28 w-full rounded-xl overflow-hidden bg-slate-100 mb-2">
                    <Image
                      src={activePopupProperty.cover_image || activePopupProperty.images?.[0] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=80'}
                      alt={activePopupProperty.title}
                      fill
                      className="object-cover"
                      sizes="270px"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-2 left-2 flex items-center space-x-1">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-xs ${
                        activePopupProperty.status === 'rent' ? 'bg-emerald-600' : 'bg-gold-600'
                      }`}>
                        {activePopupProperty.status === 'rent' ? 'สำหรับเช่า' : 'สำหรับขาย'}
                      </span>
                    </div>
                    <div className="absolute bottom-2 right-2">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-navy-950/90 text-white shadow-md">
                        {formatPrice(activePopupProperty.price, activePopupProperty.status)}
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <h4 className="font-extrabold text-xs text-navy-950 line-clamp-1 mb-1 leading-snug">
                    {activePopupProperty.title}
                  </h4>

                  <p className="text-[11px] text-slate-500 mb-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-gold-600 shrink-0" />
                    <span className="truncate">{activePopupProperty.district}, {activePopupProperty.province}</span>
                  </p>

                  {/* Specs */}
                  <div className="flex items-center justify-between text-[10px] text-slate-600 border-t border-slate-100 pt-2 mb-2">
                    {activePopupProperty.bedrooms ? (
                      <span className="flex items-center gap-1">
                        <Bed className="w-3 h-3 text-slate-400" />
                        <span>{activePopupProperty.bedrooms} นอน</span>
                      </span>
                    ) : null}
                    {activePopupProperty.bathrooms ? (
                      <span className="flex items-center gap-1">
                        <Bath className="w-3 h-3 text-slate-400" />
                        <span>{activePopupProperty.bathrooms} น้ำ</span>
                      </span>
                    ) : null}
                    {activePopupProperty.usable_area ? (
                      <span className="flex items-center gap-1">
                        <Maximize className="w-3 h-3 text-slate-400" />
                        <span>{activePopupProperty.usable_area} ตร.ม.</span>
                      </span>
                    ) : null}
                  </div>

                  {/* CTA Link to Details */}
                  <Link
                    href={propertyHref(activePopupProperty)}
                    className="w-full py-1.5 px-3 bg-navy-950 hover:bg-gold-500 hover:text-navy-950 text-white text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 transition-colors shadow-sm"
                  >
                    <span>ดูรายละเอียดทรัพย์</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
      ) : (
        /* Reliable Interactive Embed Fallback */
        <div className="w-full h-full relative bg-slate-900">
          <iframe
            title="Google Maps Location View"
            width="100%"
            height="100%"
            loading="lazy"
            className="w-full h-full border-0"
            src={embedMapUrl}
          />
        </div>
      )}

      {/* Fullscreen Floating Cards Carousel at Bottom */}
      {isFullScreen && validProperties.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-auto">
          <div className="flex items-center space-x-3 overflow-x-auto pb-2 no-scrollbar">
            {validProperties.map((p) => {
              const isSelected = activePopupProperty?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setActivePopupProperty(p);
                    setTargetCenter({ lat: Number(p.latitude), lng: Number(p.longitude), zoom: 15 });
                    if (onSelectProperty) onSelectProperty(p);
                  }}
                  className={`flex-shrink-0 w-72 bg-white rounded-2xl p-2.5 shadow-2xl border transition-all cursor-pointer flex items-center space-x-3 ${
                    isSelected
                      ? 'border-gold-500 ring-2 ring-gold-400 scale-102 bg-gold-50/20'
                      : 'border-slate-200 hover:border-gold-300'
                  }`}
                >
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                    <Image
                      src={p.cover_image || p.images?.[0] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=300&q=80'}
                      alt={p.title}
                      fill
                      className="object-cover"
                      sizes="80px"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-black text-gold-700">
                      {formatPrice(p.price, p.status)}
                    </div>
                    <h5 className="text-xs font-bold text-navy-950 truncate">
                      {p.title}
                    </h5>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      📍 {p.district}, {p.province}
                    </p>
                    <div className="text-[10px] font-bold text-navy-900 mt-1 flex items-center text-gold-600 hover:underline">
                      <span>เลื่อนดูตำแหน่ง</span>
                      <ArrowRight className="w-2.5 h-2.5 ml-1" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
