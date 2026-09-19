'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { propertyHref } from '@/components/properties/property-link';
import Image from 'next/image';
import { Property } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { MapPin, ArrowRight } from 'lucide-react';

interface PropertyMapProps {
  properties: Property[];
  selectedProperty?: Property | null;
  onSelectProperty?: (property: Property) => void;
  height?: string;
  zoom?: number;
  center?: [number, number];
}

const DEFAULT_HAT_YAI_CENTER: [number, number] = [7.0084, 100.4705];

function sanitizeCoords(lat: unknown, lng: unknown, fallback: [number, number] = DEFAULT_HAT_YAI_CENTER): [number, number] {
  const numLat = typeof lat === 'number' ? lat : parseFloat(String(lat));
  const numLng = typeof lng === 'number' ? lng : parseFloat(String(lng));
  if (Number.isFinite(numLat) && Number.isFinite(numLng) && Math.abs(numLat) <= 90 && Math.abs(numLng) <= 180) {
    return [numLat, numLng];
  }
  return fallback;
}

export default function PropertyMap({
  properties,
  selectedProperty,
  onSelectProperty,
  height = '100%',
  zoom = 12,
  center,
}: PropertyMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [activePopupProp, setActivePopupProp] = useState<Property | null>(null);

  // Compute safe initial center
  const initialCenter: [number, number] = (() => {
    if (center && Array.isArray(center) && center.length === 2) {
      return sanitizeCoords(center[0], center[1], DEFAULT_HAT_YAI_CENTER);
    }
    if (selectedProperty) {
      return sanitizeCoords(selectedProperty.latitude, selectedProperty.longitude, DEFAULT_HAT_YAI_CENTER);
    }
    if (properties && properties.length > 0) {
      for (const p of properties) {
        const coords = sanitizeCoords(p.latitude, p.longitude, [NaN, NaN]);
        if (!Number.isNaN(coords[0])) return coords;
      }
    }
    return DEFAULT_HAT_YAI_CENTER;
  })();

  useEffect(() => {
    let isMounted = true;
    let observer: ResizeObserver | undefined;

    async function initMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;
      if (!isMounted || !mapContainerRef.current || mapInstanceRef.current) return;

      // Create Leaflet map instance with guaranteed valid coordinates
      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: zoom,
        zoomControl: false,
        attributionControl: true,
      });

      // Add clean, modern OpenStreetMap / CartoDB tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);

      // Add Zoom control at top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      mapInstanceRef.current = map;

      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(mapContainerRef.current);
      setMapReady(true);
    }

    initMap().catch(() => { if (isMounted) setMapError(true); });

    return () => {
      isMounted = false;
      observer?.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // Map creation intentionally runs once; markers are updated by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when properties list changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    let active = true;
    import('leaflet').then((module) => {
      if (!active || !mapInstanceRef.current) return;
      renderMarkers(module.default, mapInstanceRef.current);
      setActivePopupProp(current => current && properties.some(property => property.id === current.id) ? current : null);
    }).catch(() => { if (active) setMapError(true); });
    return () => { active = false; };
    // renderMarkers is recreated with component state, while this effect is keyed to listing changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties, mapReady]);

  // Focus map when a specific property is selected
  useEffect(() => {
    if (selectedProperty && mapInstanceRef.current) {
      const safeCoords = sanitizeCoords(selectedProperty.latitude, selectedProperty.longitude, [NaN, NaN]);
      if (!Number.isNaN(safeCoords[0])) {
        mapInstanceRef.current.flyTo(safeCoords, 15, {
          duration: 1.2,
        });
        setActivePopupProp(selectedProperty);
      }
    }
  }, [selectedProperty, mapReady]);

  const renderMarkers = (L: any, map: any) => {
    // Clear previous markers
    Object.values(markersRef.current).forEach((marker: any) => marker.remove());
    markersRef.current = {};

    const validPropertyPoints: { prop: Property; lat: number; lng: number }[] = [];

    properties.forEach((prop) => {
      const lat = typeof prop.latitude === 'number' ? prop.latitude : parseFloat(String(prop.latitude));
      const lng = typeof prop.longitude === 'number' ? prop.longitude : parseFloat(String(prop.longitude));
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;

      validPropertyPoints.push({ prop, lat, lng });

      // Custom HTML pin with Gold/Navy styling
      const formattedShortPrice = prop.price >= 1000000 
        ? `${(prop.price / 1000000).toFixed(1)}M` 
        : prop.status === 'rent'
        ? `${(prop.price / 1000).toFixed(0)}k/ด.`
        : `${(prop.price / 1000).toFixed(0)}k`;

      const customIcon = L.divIcon({
        className: 'custom-property-pin',
        html: `
          <div style="
            background: #0B1F3A;
            color: #C9A227;
            padding: 4px 8px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            border: 2px solid #C9A227;
            box-shadow: 0 4px 12px rgba(11,31,58,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            white-space: nowrap;
            cursor: pointer;
            transform: translate(-50%, -100%);
            transition: transform 0.2s;
          " onmouseover="this.style.transform='translate(-50%, -110%) scale(1.08)'" onmouseout="this.style.transform='translate(-50%, -100%) scale(1)'">
            <span>฿${formattedShortPrice}</span>
          </div>
        `,
        iconSize: [60, 26],
        iconAnchor: [30, 26],
      });

      const marker = L.marker([lat, lng], { icon: customIcon })
        .addTo(map)
        .on('click', () => {
          setActivePopupProp(prop);
          if (onSelectProperty) onSelectProperty(prop);
        });

      markersRef.current[prop.id] = marker;
    });

    // Auto fit bounds if valid coordinates exist
    if (validPropertyPoints.length > 0) {
      try {
        const validCoords = validPropertyPoints.map(p => [p.lat, p.lng]);
        const bounds = L.latLngBounds(validCoords);
        if (bounds && bounds.isValid && bounds.isValid()) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: validPropertyPoints.length === 1 ? zoom : 14 });
        }
      } catch (err) {
        console.warn('Leaflet fitBounds error:', err);
      }
    }
  };

  return (
    <div className="relative isolate w-full h-full rounded-2xl overflow-hidden border border-surface-border shadow-card bg-gray-100">
      {mapError && <p role="alert" className="absolute inset-0 z-[1001] flex items-center justify-center bg-gray-100 p-4 text-sm">โหลดแผนที่ไม่สำเร็จ กรุณารีเฟรชหน้า</p>}
      {/* Map Container */}
      <div ref={mapContainerRef} style={{ height }} className="w-full" />

      {/* Floating Property Preview Popup */}
      {activePopupProp && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-white rounded-2xl p-3 shadow-float border border-surface-border z-[1000] animate-fadeIn">
          <button
            onClick={() => setActivePopupProp(null)}
            className="absolute -top-2 -right-2 w-6 h-6 bg-navy-950 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md hover:bg-navy-800"
          >
            ✕
          </button>

          <div className="flex space-x-3 items-center">
            <div className="relative w-24 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-200">
              <Image
                src={activePopupProp.cover_image}
                alt={activePopupProp.title}
                fill
                className="object-cover"
              />
              <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-navy-950/90 text-gold-400 text-[10px] font-bold rounded">
                {activePopupProp.status === 'rent' ? 'เช่า' : 'ขาย'}
              </span>
            </div>

            <div className="flex-grow min-w-0">
              <div className="text-[11px] text-gray-500 flex items-center truncate">
                <MapPin className="w-3 h-3 text-gold-600 mr-1 flex-shrink-0" />
                <span>{activePopupProp.district}, สงขลา</span>
              </div>
              <h4 className="font-bold text-xs text-navy-950 truncate mt-0.5">
                {activePopupProp.title}
              </h4>
              <div className="text-sm font-extrabold text-gold-600 mt-1">
                {formatPrice(activePopupProp.price, activePopupProp.status)}
              </div>
              <Link
                href={propertyHref(activePopupProp.slug)}
                className="mt-1 inline-flex items-center text-[11px] font-bold text-navy-900 hover:text-gold-600 transition-colors"
              >
                <span>ดูรายละเอียด</span>
                <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Legend Badge */}
      <div className="absolute top-4 left-4 z-[999] bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold text-navy-950 border border-surface-border shadow-sm flex items-center space-x-2">
        <span className="w-2.5 h-2.5 rounded-full bg-gold-500 animate-pulse" />
        <span>หาดใหญ่ – สงขลา ({properties.length} ตำแหน่ง)</span>
      </div>
    </div>
  );
}
