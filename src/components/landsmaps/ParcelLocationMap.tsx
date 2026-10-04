'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayerGroup, Map as LeafletMap, Marker, TileLayer } from 'leaflet';
import { LocateFixed, MapPin, Maximize2, Minimize2, Navigation, RefreshCw } from 'lucide-react';
import type { Property } from '@/lib/types';

interface ParcelLocationMapProps {
  latitude: number | null;
  longitude: number | null;
  onLocationChange?: (latitude: number, longitude: number) => void;
  properties?: Property[];
  onPropertySelect?: (property: Property) => void;
  selectedPropertyId?: string;
  height?: string;
}

type BaseLayer = 'street' | 'satellite';
type LeafletModule = typeof import('leaflet');

const DEFAULT_VIEW: [number, number] = [7.008, 100.474];

function validCoordinates(latitude: number | null, longitude: number | null): boolean {
  return latitude !== null && longitude !== null
    && Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function hasPropertyCoordinates(property: Property): boolean {
  return property.coordinates_available !== false && validCoordinates(property.latitude, property.longitude);
}

function pinIcon(leaflet: LeafletModule, selected = false) {
  const pin = document.createElement('span');
  pin.style.cssText = `display:block;width:${selected ? 22 : 16}px;height:${selected ? 22 : 16}px;`
    + `background:${selected ? '#e56d2b' : '#2563eb'};border:3px solid white;border-radius:50%;`
    + 'box-shadow:0 2px 6px rgba(0,0,0,.4);';
  return leaflet.divIcon({
    className: '', html: pin,
    iconSize: selected ? [22, 22] : [16, 16],
    iconAnchor: selected ? [11, 11] : [8, 8],
  });
}

/** Displays stored or manually selected coordinates; never synthesizes parcel boundaries. */
export default function ParcelLocationMap({
  latitude, longitude, onLocationChange, properties = [], onPropertySelect,
  selectedPropertyId, height = '480px',
}: ParcelLocationMapProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const propertiesLayerRef = useRef<LayerGroup | null>(null);
  const tilesRef = useRef<Record<BaseLayer, TileLayer> | null>(null);
  const activeRef = useRef(false);
  const locationRequestGenerationRef = useRef(0);
  const latestRef = useRef({ latitude, longitude, onLocationChange, onPropertySelect });
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(0);
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('satellite');
  const [initError, setInitError] = useState('');
  const [tileError, setTileError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [cssFullscreen, setCssFullscreen] = useState(false);
  const isFullscreen = fullscreen || cssFullscreen;
  const editable = Boolean(onLocationChange);
  const invalidateLocationRequest = useCallback(() => {
    locationRequestGenerationRef.current += 1;
    setLocating(false);
  }, []);

  useEffect(() => {
    invalidateLocationRequest();
    setLocationError('');
  }, [latitude, longitude, selectedPropertyId, editable, invalidateLocationRequest]);

  useEffect(() => {
    latestRef.current = { latitude, longitude, onLocationChange, onPropertySelect };
  }, [latitude, longitude, onLocationChange, onPropertySelect]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    activeRef.current = true;
    invalidateLocationRequest();
    setReady(false);
    setInitError('');
    setTileError('');

    const initialize = async () => {
      try {
        const leaflet = (await import('leaflet')).default;
        if (cancelled || !containerRef.current) return;
        leafletRef.current = leaflet;
        const current = latestRef.current;
        const hasPin = validCoordinates(current.latitude, current.longitude);
        const center: [number, number] = hasPin
          ? [current.latitude as number, current.longitude as number] : DEFAULT_VIEW;
        const map = leaflet.map(containerRef.current, { zoomControl: true, attributionControl: true });
        mapRef.current = map;
        map.setView(center, hasPin ? 17 : 11);

        const reportTileError = () => {
          if (!cancelled) setTileError('โหลดภาพแผนที่บางส่วนไม่สำเร็จ ลองสลับแผนที่หรือโหลดใหม่');
        };
        const street = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        }).on('tileerror', reportTileError);
        const satellite = leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        }).on('tileerror', reportTileError);
        tilesRef.current = { street, satellite };
        propertiesLayerRef.current = leaflet.layerGroup().addTo(map);
        map.on('click', (event) => {
          const callback = latestRef.current.onLocationChange;
          if (callback) {
            invalidateLocationRequest();
            callback(event.latlng.lat, event.latlng.lng);
          }
        });
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => map.invalidateSize());
          resizeObserver.observe(containerRef.current);
        }
        setReady(true);
      } catch {
        if (!cancelled) setInitError('เปิดแผนที่ไม่สำเร็จ กรุณาลองโหลดแผนที่ใหม่');
      }
    };
    void initialize();
    return () => {
      cancelled = true;
      activeRef.current = false;
      locationRequestGenerationRef.current += 1;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      propertiesLayerRef.current = null;
      tilesRef.current = null;
      leafletRef.current = null;
    };
  }, [reload, invalidateLocationRequest]);

  useEffect(() => {
    const map = mapRef.current;
    const tiles = tilesRef.current;
    if (!ready || !map || !tiles) return;
    const otherLayer = baseLayer === 'street' ? 'satellite' : 'street';
    map.removeLayer(tiles[otherLayer]);
    tiles[baseLayer].addTo(map);
    setTileError('');
  }, [baseLayer, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!ready || !map || !leaflet) return;
    if (!validCoordinates(latitude, longitude)) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const coordinates: [number, number] = [latitude as number, longitude as number];
    if (!markerRef.current) {
      const marker = leaflet.marker(coordinates, { icon: pinIcon(leaflet, true), draggable: editable });
      const label = document.createElement('div');
      label.style.cssText = 'padding:12px;max-width:230px;';
      label.textContent = 'ตำแหน่งหมุดที่เลือก ไม่ใช่แนวเขตโฉนด';
      marker.bindPopup(label).addTo(map);
      marker.on('dragstart', invalidateLocationRequest);
      marker.on('dragend', () => {
        invalidateLocationRequest();
        const point = marker.getLatLng();
        latestRef.current.onLocationChange?.(point.lat, point.lng);
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(coordinates);
      if (editable) markerRef.current.dragging?.enable();
      else markerRef.current.dragging?.disable();
    }
    map.setView(coordinates, Math.max(map.getZoom(), 16));
  }, [latitude, longitude, editable, ready, invalidateLocationRequest]);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const layer = propertiesLayerRef.current;
    if (!ready || !leaflet || !layer) return;
    layer.clearLayers();
    for (const property of properties) {
      if (!hasPropertyCoordinates(property)) continue;
      if (property.id === selectedPropertyId && validCoordinates(latitude, longitude)) continue;
      const marker = leaflet.marker([property.latitude, property.longitude], {
        icon: pinIcon(leaflet), bubblingMouseEvents: false,
      });
      const popup = document.createElement('div');
      popup.style.cssText = 'padding:12px;max-width:240px;';
      const title = document.createElement('p');
      title.textContent = property.title;
      title.style.cssText = 'font-weight:600;margin:0 0 6px;';
      popup.appendChild(title);
      const area = document.createElement('p');
      area.textContent = [property.subdistrict, property.district, property.province].filter(Boolean).join(' ');
      area.style.cssText = 'font-size:12px;margin:0;';
      popup.appendChild(area);
      if (latestRef.current.onPropertySelect) {
        const select = document.createElement('button');
        select.type = 'button';
        select.textContent = 'เลือกทรัพย์นี้';
        select.style.cssText = 'margin-top:10px;padding:6px 10px;background:#fff3e8;color:#9a3412;border:1px solid #fdba74;border-radius:8px;cursor:pointer;';
        select.addEventListener('click', () => {
          invalidateLocationRequest();
          latestRef.current.onPropertySelect?.(property);
        });
        popup.appendChild(select);
      }
      marker.bindPopup(popup).addTo(layer);
      marker.on('click', () => {
        invalidateLocationRequest();
        latestRef.current.onPropertySelect?.(property);
      });
    }
  }, [properties, selectedPropertyId, latitude, longitude, onPropertySelect, ready, invalidateLocationRequest]);

  useEffect(() => {
    const update = () => {
      setFullscreen(document.fullscreenElement === shellRef.current);
    };
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  const exitFullscreen = useCallback(async () => {
    setCssFullscreen(false);
    if (document.fullscreenElement === shellRef.current) {
      try {
        await document.exitFullscreen();
      } catch {
        if (activeRef.current) setLocationError('ออกจากแผนที่เต็มหน้าจอไม่สำเร็จ ลองกด Escape');
      }
    }
    if (activeRef.current) setFullscreen(document.fullscreenElement === shellRef.current);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    fullscreenButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        void exitFullscreen();
        return;
      }
      if (event.key !== 'Tab' || !shellRef.current) return;
      const controls = Array.from(shellRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'))
        .filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !shellRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !shellRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      if (document.body.style.overflow === 'hidden') document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isFullscreen, exitFullscreen]);

  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => mapRef.current?.invalidateSize());
    return () => cancelAnimationFrame(frame);
  }, [isFullscreen, ready]);

  const goToPin = () => {
    if (validCoordinates(latitude, longitude)) mapRef.current?.setView([latitude as number, longitude as number], 18);
  };

  const fitProperties = () => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    if (!leaflet || !map) return;
    const points: [number, number][] = properties
      .filter(hasPropertyCoordinates)
      .map((property) => [property.latitude, property.longitude]);
    if (validCoordinates(latitude, longitude)) points.push([latitude as number, longitude as number]);
    if (points.length) map.fitBounds(leaflet.latLngBounds(points), { padding: [35, 35], maxZoom: 17 });
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setLocationError('เบราว์เซอร์นี้ไม่รองรับการค้นหาตำแหน่ง');
      return;
    }
    setLocationError('');
    setLocating(true);
    const requestGeneration = ++locationRequestGenerationRef.current;
    navigator.geolocation.getCurrentPosition((position) => {
      if (!activeRef.current || requestGeneration !== locationRequestGenerationRef.current) return;
      setLocating(false);
      const { latitude: nextLatitude, longitude: nextLongitude } = position.coords;
      mapRef.current?.setView([nextLatitude, nextLongitude], 17);
      latestRef.current.onLocationChange?.(nextLatitude, nextLongitude);
    }, (error) => {
      if (!activeRef.current || requestGeneration !== locationRequestGenerationRef.current) return;
      setLocating(false);
      setLocationError(error.code === error.PERMISSION_DENIED
        ? 'ยังไม่ได้อนุญาตให้ใช้ตำแหน่ง เปิดสิทธิ์ตำแหน่งในเบราว์เซอร์แล้วลองใหม่'
        : 'ค้นหาตำแหน่งไม่สำเร็จ ลองใหม่หรือระบุพิกัดด้วยตนเอง');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  };

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      await exitFullscreen();
      return;
    }
    const shell = shellRef.current;
    if (!shell) return;
    if (!shell.requestFullscreen) {
      setCssFullscreen(true);
      return;
    }
    try {
      await shell.requestFullscreen();
      if (activeRef.current) {
        const entered = document.fullscreenElement === shell;
        setFullscreen(entered);
        if (!entered) setCssFullscreen(true);
      }
    } catch {
      if (activeRef.current) setCssFullscreen(true);
    }
  };

  const hasPin = validCoordinates(latitude, longitude);
  const buttonClass = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div ref={shellRef} data-map-fullscreen={isFullscreen ? 'true' : 'false'}
      role={isFullscreen ? 'dialog' : undefined} aria-modal={isFullscreen || undefined}
      aria-label={isFullscreen ? 'แผนที่เต็มหน้าจอ' : undefined}
      className={`relative isolate overflow-hidden border border-slate-200 bg-white ${isFullscreen ? 'flex flex-col rounded-none' : 'rounded-2xl'}`}
      style={cssFullscreen ? { position: 'fixed', inset: 0, zIndex: 2147483647, height: '100dvh' } : fullscreen ? { height: '100dvh', width: '100%' } : undefined}>
      <div className={`flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 p-3 ${isFullscreen ? 'max-h-[35vh] overflow-y-auto' : ''}`}>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200" role="group" aria-label="เลือกภาพแผนที่">
          <button type="button" aria-pressed={baseLayer === 'street'} onClick={() => setBaseLayer('street')}
            className={`px-3 py-2 text-xs font-medium ${baseLayer === 'street' ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>แผนที่ถนน</button>
          <button type="button" aria-pressed={baseLayer === 'satellite'} onClick={() => setBaseLayer('satellite')}
            className={`px-3 py-2 text-xs font-medium ${baseLayer === 'satellite' ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>ภาพดาวเทียม</button>
        </div>
        <button type="button" className={buttonClass} onClick={goToPin} disabled={!ready || !hasPin}><MapPin size={14} />ไปยังหมุด</button>
        <button type="button" className={buttonClass} onClick={fitProperties} disabled={!ready || (!hasPin && !properties.some(hasPropertyCoordinates))}><LocateFixed size={14} />ดูทุกทรัพย์</button>
        {onLocationChange && <button type="button" className={buttonClass} onClick={locate} disabled={!ready || locating}><Navigation size={14} />{locating ? 'กำลังหาตำแหน่ง…' : 'ใช้ตำแหน่งของฉัน'}</button>}
        <button ref={fullscreenButtonRef} type="button" className={`${buttonClass} ml-auto`} onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? 'ออกจากแผนที่เต็มหน้าจอ' : 'เปิดแผนที่เต็มหน้าจอ'}>{isFullscreen ? <><Minimize2 size={14} /><span>ออกจากเต็มหน้าจอ</span></> : <Maximize2 size={14} />}</button>
      </div>
      <div className={`relative ${isFullscreen ? 'min-h-0 flex-1' : ''}`} style={{ height: isFullscreen ? undefined : height, minHeight: isFullscreen ? '0' : '240px' }}>
        <div ref={containerRef} className="h-full w-full" aria-label="แผนที่ตำแหน่งทรัพย์สิน" />
        {!ready && !initError && <div className="absolute inset-0 z-[500] flex items-center justify-center bg-slate-100 text-sm text-slate-600">กำลังเปิดแผนที่…</div>}
        {initError && <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-3 bg-slate-100 p-4 text-center text-sm text-slate-700" role="alert">
          <p>{initError}</p><button type="button" className={buttonClass} onClick={() => setReload((value) => value + 1)}><RefreshCw size={14} />โหลดแผนที่ใหม่</button>
        </div>}
      </div>
      <div className={`shrink-0 space-y-1 border-t border-slate-200 p-3 text-xs text-slate-600 ${isFullscreen ? 'max-h-[35vh] overflow-y-auto' : ''}`}>
        <p><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />หมุดตามพิกัดที่บันทึก ไม่ใช่แนวเขตโฉนด{properties.length > 0 && <span className="ml-3"><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-blue-600" />ทรัพย์ในฐานข้อมูล</span>}</p>
        <p>{onLocationChange ? 'คลิกแผนที่หรือลากหมุดเพื่อเลือกพิกัด • ' : ''}{baseLayer === 'satellite' ? 'ภาพดาวเทียม Esri World Imagery' : 'แผนที่ถนน OpenStreetMap'}{!hasPin ? ' • ยังไม่ได้เลือกหมุด' : ''}</p>
        {(tileError || locationError) && <div className="flex flex-wrap items-center gap-2 text-amber-800" role="status"><p>{locationError || tileError}</p>{tileError && <button type="button" className={buttonClass} onClick={() => setReload((value) => value + 1)}><RefreshCw size={12} />โหลดใหม่</button>}</div>}
      </div>
    </div>
  );
}
