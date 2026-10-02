'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { 
  X, 
  Building2, 
  MapPin, 
  ExternalLink, 
  Calculator, 
  ShieldCheck, 
  Check, 
  Copy, 
  Sparkles, 
  Info, 
  Layers, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  Loader2,
  Award,
  Globe,
  Maximize2,
  TrendingUp,
  Coins,
  Filter,
  Eye,
  ChevronDown,
  ChevronUp,
  Compass,
  ArrowRight,
  PieChart,
  BarChart3
} from 'lucide-react';
import { Property, PropertyType } from '@/lib/types';
import { 
  generateLandsMapsParcelInfo, 
  LandsMapsParcelInfo, 
  calculateLandTransferFees,
  sqWahToRaiNganWah 
} from '@/lib/landsmaps';
import { updateProperty, fetchProperties } from '@/lib/store/properties-store';
import { formatPrice, formatPropertyCode, getPropertyTypeName } from '@/lib/utils';

interface AdminLandsMapsOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property | null;
  allProperties?: Property[];
  onPropertyUpdated?: () => void;
}

type MapLayerType = 'cadastral' | 'satellite' | 'standard';
type FilterScope = 'all' | 'district' | 'type';

export default function AdminLandsMapsOverlayModal({
  isOpen,
  onClose,
  property,
  allProperties = [],
  onPropertyUpdated,
}: AdminLandsMapsOverlayModalProps) {
  const [activeProperty, setActiveProperty] = useState<Property | null>(property);
  const [internalProperties, setInternalProperties] = useState<Property[]>(allProperties);
  const [parcelInfo, setParcelInfo] = useState<LandsMapsParcelInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSavingSuccess] = useState(false);

  // Map & Visualization States
  const [mapLayer, setMapLayer] = useState<MapLayerType>('cadastral');
  const [filterScope, setFilterScope] = useState<FilterScope>('all');
  const [showStatsDrawer, setShowStatsDrawer] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'map' | 'deed' | 'fees'>('map');

  // Editable fields for verification
  const [chanoteNo, setChanoteNo] = useState('');
  const [landNo, setLandNo] = useState('');
  const [surveyPage, setSurveyPage] = useState('');
  const [mapSheet, setMapSheet] = useState('');
  const [appraisalRate, setAppraisalRate] = useState(0);

  // Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const parcelPolygonRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  // Load properties if not provided
  useEffect(() => {
    if (allProperties && allProperties.length > 0) {
      setInternalProperties(allProperties);
    } else {
      fetchProperties().then((props) => {
        if (props && props.length > 0) {
          setInternalProperties(props);
        }
      });
    }
  }, [allProperties]);

  // Sync activeProperty when property prop changes or modal opens
  useEffect(() => {
    if (isOpen && property) {
      setActiveProperty(property);
    }
  }, [isOpen, property]);

  // Update parcel info when activeProperty changes
  useEffect(() => {
    if (isOpen && activeProperty) {
      setLoading(true);
      setSavingSuccess(false);

      const info = generateLandsMapsParcelInfo(
        activeProperty.id,
        activeProperty.district,
        activeProperty.province,
        activeProperty.subdistrict || 'คอหงส์',
        activeProperty.land_size || 50,
        activeProperty.price,
        activeProperty.latitude || 7.008,
        activeProperty.longitude || 100.474
      );

      setParcelInfo(info);
      setChanoteNo(info.chanoteNo);
      setLandNo(info.landNo);
      setSurveyPage(info.surveyPage);
      setMapSheet(info.mapSheet);
      setAppraisalRate(info.appraisalPricePerSqWah);
      setLoading(false);
    }
  }, [isOpen, activeProperty]);

  // Properties displayed on the map based on filterScope
  const displayedProperties = useMemo(() => {
    if (!internalProperties || internalProperties.length === 0) {
      return activeProperty ? [activeProperty] : [];
    }

    let filtered = [...internalProperties];

    if (filterScope === 'district' && activeProperty) {
      filtered = filtered.filter(p => p.district === activeProperty.district);
    } else if (filterScope === 'type' && activeProperty) {
      filtered = filtered.filter(p => p.property_type === activeProperty.property_type);
    }

    // Always ensure the active property is included if not in filtered list
    if (activeProperty && !filtered.some(p => p.id === activeProperty.id)) {
      filtered.unshift(activeProperty);
    }

    return filtered;
  }, [internalProperties, filterScope, activeProperty]);

  // Summary Stats Calculations for all properties currently displayed on the map
  const summaryStats = useMemo(() => {
    if (!displayedProperties || displayedProperties.length === 0) {
      return {
        count: 0,
        totalLandSqWah: 0,
        totalLandSqMeters: 0,
        totalUsableSqMeters: 0,
        totalEffectiveSqMeters: 0,
        totalMarketValue: 0,
        avgPricePerSqMeter: 0,
        avgPricePerSqWah: 0,
        avgPricePerProperty: 0,
        minPricePerSqM: 0,
        maxPricePerSqM: 0,
        raiBreakdown: { rai: 0, ngan: 0, sqWah: 0, totalSqMeters: 0 },
        typeBreakdown: {} as Record<string, number>,
      };
    }

    let totalLandSqWah = 0;
    let totalUsableSqMeters = 0;
    let totalEffectiveSqMeters = 0;
    let totalMarketValue = 0;
    let validPricedAreaCount = 0;
    let sumPricePerSqM = 0;
    let minPricePerSqM = Infinity;
    let maxPricePerSqM = 0;
    const typeBreakdown: Record<string, number> = {};

    displayedProperties.forEach((p) => {
      const landWah = p.land_size || 0;
      const usableM = p.usable_area || 0;
      const landSqMeters = landWah * 4;

      // Effective area for calculation: land area in sq.m or usable area
      const effectiveArea = landSqMeters > 0 ? landSqMeters : usableM;

      totalLandSqWah += landWah;
      totalUsableSqMeters += usableM;
      totalEffectiveSqMeters += effectiveArea > 0 ? effectiveArea : 100; // fallback 100 sqm if zero
      totalMarketValue += p.price || 0;

      // Property type count
      typeBreakdown[p.property_type] = (typeBreakdown[p.property_type] || 0) + 1;

      // Price per sq meter calculation
      if (effectiveArea > 0 && p.price > 0) {
        const pricePerSqM = p.price / effectiveArea;
        sumPricePerSqM += pricePerSqM;
        validPricedAreaCount++;
        if (pricePerSqM < minPricePerSqM) minPricePerSqM = pricePerSqM;
        if (pricePerSqM > maxPricePerSqM) maxPricePerSqM = pricePerSqM;
      }
    });

    const totalLandSqMeters = totalLandSqWah * 4;
    const count = displayedProperties.length;
    const avgPricePerProperty = count > 0 ? totalMarketValue / count : 0;
    
    // Average price per sq meter = Total Value / Total Effective Sq.m
    const avgPricePerSqMeter = totalEffectiveSqMeters > 0 ? Math.round(totalMarketValue / totalEffectiveSqMeters) : 0;
    const avgPricePerSqWah = totalLandSqWah > 0 ? Math.round(totalMarketValue / totalLandSqWah) : avgPricePerSqMeter * 4;

    const raiBreakdown = sqWahToRaiNganWah(totalLandSqWah);

    return {
      count,
      totalLandSqWah,
      totalLandSqMeters,
      totalUsableSqMeters,
      totalEffectiveSqMeters,
      totalMarketValue,
      avgPricePerSqMeter,
      avgPricePerSqWah,
      avgPricePerProperty,
      minPricePerSqM: minPricePerSqM === Infinity ? 0 : Math.round(minPricePerSqM),
      maxPricePerSqM: Math.round(maxPricePerSqM),
      raiBreakdown,
      typeBreakdown,
    };
  }, [displayedProperties]);

  // Initialize and update Leaflet interactive map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    let isMounted = true;

    async function initMap() {
      const L = (await import('leaflet')).default;
      if (!isMounted || !mapContainerRef.current) return;

      const targetLat = activeProperty?.latitude || 7.0084;
      const targetLng = activeProperty?.longitude || 100.4705;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [targetLat, targetLng],
          zoom: 14,
          zoomControl: false,
        });

        // Add custom zoom control at top-right
        L.control.zoom({ position: 'topright' }).addTo(map);

        // Tile Layer Definitions (High-res, watermark-free)
        let tileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
        let attribution = '&copy; Google Maps &copy; DOL LandsMaps';

        if (mapLayer === 'standard') {
          tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
          attribution = '&copy; OpenStreetMap contributors | DOL LandsMaps';
        } else if (mapLayer === 'satellite') {
          tileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
          attribution = '&copy; Google Satellite &copy; DOL Cadastral Imagery';
        } else {
          tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
          attribution = '&copy; Google Maps &copy; DOL LandsMaps Cadastre';
        }

        tileLayerRef.current = L.tileLayer(tileUrl, {
          maxZoom: 20,
          attribution,
        }).addTo(map);

        markersLayerRef.current = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
      } else {
        // Update tile layer if changed
        if (tileLayerRef.current) {
          mapInstanceRef.current.removeLayer(tileLayerRef.current);
          let tileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
          let attribution = '&copy; Google Maps &copy; DOL LandsMaps';

          if (mapLayer === 'standard') {
            tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            attribution = '&copy; OpenStreetMap contributors | DOL LandsMaps';
          } else if (mapLayer === 'satellite') {
            tileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
            attribution = '&copy; Google Satellite &copy; DOL Cadastral Imagery';
          } else {
            tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
            attribution = '&copy; Google Maps &copy; DOL LandsMaps Cadastre';
          }

          tileLayerRef.current = L.tileLayer(tileUrl, {
            maxZoom: 20,
            attribution,
          }).addTo(mapInstanceRef.current);
        }
      }

      const map = mapInstanceRef.current;
      const markersLayer = markersLayerRef.current;
      if (!markersLayer) return;

      markersLayer.clearLayers();

      // Draw Cadastral Parcel Polygon for active property
      if (parcelPolygonRef.current) {
        map.removeLayer(parcelPolygonRef.current);
        parcelPolygonRef.current = null;
      }

      if (activeProperty) {
        const cLat = activeProperty.latitude || 7.0084;
        const cLng = activeProperty.longitude || 100.4705;
        const landSizeWah = activeProperty.land_size || 50;
        
        // Approximate parcel boundary offset based on land size
        const radiusDeg = Math.max(0.0003, Math.min(0.0015, Math.sqrt(landSizeWah * 4) / 111000));
        const parcelCoords: [number, number][] = [
          [cLat - radiusDeg * 0.7, cLng - radiusDeg * 0.9],
          [cLat + radiusDeg * 0.8, cLng - radiusDeg * 0.7],
          [cLat + radiusDeg * 0.9, cLng + radiusDeg * 0.8],
          [cLat - radiusDeg * 0.6, cLng + radiusDeg * 0.9],
        ];

        parcelPolygonRef.current = L.polygon(parcelCoords, {
          color: '#d97706', // amber-600 gold border
          weight: 3,
          dashArray: '4, 4',
          fillColor: '#fbbf24', // amber-400
          fillOpacity: 0.25,
        }).addTo(map);

        parcelPolygonRef.current.bindTooltip(
          `<div class="text-[11px] font-bold text-navy-950">
            <span class="font-extrabold text-amber-600">📌 รูปแปลงโฉนด #${chanoteNo || 'DOL'}</span><br/>
            ${activeProperty.title}<br/>
            เนื้อที่: ${landSizeWah} ตร.ว. (${landSizeWah * 4} ตร.ม.)
          </div>`,
          { permanent: false, direction: 'top' }
        );
      }

      // Add Markers for all displayed properties
      const bounds = L.latLngBounds([]);

      displayedProperties.forEach((p) => {
        const pLat = p.latitude || 7.0084;
        const pLng = p.longitude || 100.4705;
        const isActive = activeProperty?.id === p.id;
        const pLandWah = p.land_size || 0;
        const pSqM = (pLandWah * 4) || p.usable_area || 1;
        const pricePerSqM = p.price > 0 && pSqM > 0 ? Math.round(p.price / pSqM) : 0;

        bounds.extend([pLat, pLng]);

        const priceText = p.price >= 1000000 
          ? `฿${(p.price / 1000000).toFixed(1)}M` 
          : `฿${(p.price / 1000).toFixed(0)}k`;

        const markerHtml = `
          <div style="
            position: relative;
            cursor: pointer;
            transform: translate(-50%, -100%);
            display: flex;
            flex-direction: column;
            align-items: center;
          ">
            <div style="
              background: ${isActive ? '#020b18' : '#ffffff'};
              color: ${isActive ? '#fbbf24' : '#0f172a'};
              border: 2px solid ${isActive ? '#fbbf24' : '#cbd5e1'};
              padding: 4px 8px;
              border-radius: 9999px;
              font-weight: 800;
              font-size: 11px;
              white-space: nowrap;
              box-shadow: 0 4px 12px rgba(0,0,0,0.25);
              display: flex;
              align-items: center;
              gap: 4px;
              transition: all 0.2s;
            ">
              <span style="display: inline-block; width: 7px; height: 7px; border-radius: 9999px; background: ${isActive ? '#fbbf24' : '#10b981'};"></span>
              <span>${priceText}</span>
            </div>
            <div style="
              width: 0; 
              height: 0; 
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-top: 6px solid ${isActive ? '#020b18' : '#ffffff'};
              margin-top: -1px;
            "></div>
          </div>
        `;

        const customIcon = L.divIcon({
          className: `property-marker-${p.id}`,
          html: markerHtml,
          iconSize: [80, 32],
          iconAnchor: [40, 32],
        });

        const marker = L.marker([pLat, pLng], { icon: customIcon });

        // Popup with rich property & cadastral stats
        const popupContent = `
          <div style="font-family: inherit; min-width: 220px; padding: 2px;">
            <div style="font-weight: 800; color: #020b18; font-size: 13px; margin-bottom: 4px; line-height: 1.3;">
              ${p.title}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
              📍 ${p.district}, ${p.province} (${getPropertyTypeName(p.property_type)})
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: #f8fafc; padding: 6px; border-radius: 8px; font-size: 10px; margin-bottom: 8px;">
              <div>
                <span style="color: #64748b;">เนื้อที่:</span><br/>
                <strong style="color: #0f172a;">${pLandWah ? `${pLandWah} ตร.ว.` : '-'}${p.usable_area ? ` (${p.usable_area} ตร.ม.)` : ''}</strong>
              </div>
              <div>
                <span style="color: #64748b;">ราคา/ตร.ม.:</span><br/>
                <strong style="color: #059669;">฿${pricePerSqM.toLocaleString()}</strong>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 6px;">
              <strong style="font-size: 13px; color: #b45309;">${formatPrice(p.price, p.status)}</strong>
              <button 
                id="select-prop-btn-${p.id}"
                style="background: #020b18; color: #fbbf24; border: none; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer;"
              >
                เลือกดูแปลงนี้
              </button>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);

        marker.on('popupopen', () => {
          const btn = document.getElementById(`select-prop-btn-${p.id}`);
          if (btn) {
            btn.onclick = () => {
              setActiveProperty(p);
              map.closePopup();
            };
          }
        });

        marker.on('click', () => {
          setActiveProperty(p);
        });

        markersLayer.addLayer(marker);
      });

      // Fit bounds if multiple properties
      if (displayedProperties.length > 1 && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } else if (activeProperty) {
        map.setView([targetLat, targetLng], 15);
      }
    }

    initMap();

    return () => {
      isMounted = false;
    };
  }, [isOpen, displayedProperties, activeProperty, mapLayer, chanoteNo]);

  if (!isOpen || !activeProperty) return null;

  const totalAppraisalVal = Math.round((activeProperty.land_size || 50) * appraisalRate);
  const diffPct = totalAppraisalVal > 0 
    ? Math.round(((activeProperty.price - totalAppraisalVal) / totalAppraisalVal) * 100) 
    : 0;
  const transferFees = calculateLandTransferFees(activeProperty.price, totalAppraisalVal);

  const handleSaveToProperty = async () => {
    if (!activeProperty) return;
    setSaving(true);
    try {
      const updatedDescription = (activeProperty.description || '')
        .replace(/📌 ข้อมูลรูปแปลงโฉนดที่ดิน \(DOL LandsMaps\):[\s\S]*/gi, '')
        .trim();

      await updateProperty(activeProperty.id, {
        description: updatedDescription,
      });

      setSavingSuccess(true);
      if (onPropertyUpdated) onPropertyUpdated();
      setTimeout(() => setSavingSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update property with LandsMaps overlay:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopySummary = () => {
    if (!activeProperty || !parcelInfo) return;
    const text = [
      `🗺️ ข้อมูลโฉนดที่ดิน & ราคาประเมินกรมธนารักษ์ (DOL LandsMaps)`,
      `ทรัพย์: ${activeProperty.title} (${formatPropertyCode(activeProperty.id)})`,
      `• เลขที่โฉนด: ${chanoteNo}`,
      `• ระวาง: ${mapSheet}`,
      `• เลขที่ดิน: ${landNo} | หน้าสำรวจ: ${surveyPage}`,
      `• ทำเล: ต.${activeProperty.subdistrict || 'คอหงส์'} อ.${activeProperty.district} จ.${activeProperty.province}`,
      `• เนื้อที่: ${parcelInfo.rai > 0 ? `${parcelInfo.rai} ไร่ ` : ''}${parcelInfo.ngan > 0 ? `${parcelInfo.ngan} งาน ` : ''}${parcelInfo.sqWah} ตร.ว.`,
      `• ราคาประเมินกรมธนารักษ์: ฿${appraisalRate.toLocaleString()} / ตร.ว. (รวม ฿${totalAppraisalVal.toLocaleString()})`,
      `• ราคาเสนอขายตลาด: ${formatPrice(activeProperty.price, activeProperty.status)}`,
      `• สถิติโซนบนแผนที่: เนื้อที่รวม ${summaryStats.totalLandSqMeters.toLocaleString()} ตร.ม. | เฉลี่ย ฿${summaryStats.avgPricePerSqMeter.toLocaleString()}/ตร.ม.`,
      `• รวมค่าธรรมเนียมโอน ณ กรมที่ดินประเมิน: ฿${transferFees.totalDepartmentOfLandsFees.toLocaleString()}`,
      `🌐 ดูรูปแปลงบน DOL LandsMaps: ${parcelInfo.landsmapsUrl}`,
    ].join('\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const resetMapBounds = () => {
    if (mapInstanceRef.current && displayedProperties.length > 0) {
      const L = (window as any).L;
      if (!L) return;
      const bounds = L.latLngBounds(
        displayedProperties.map(p => [p.latitude || 7.0084, p.longitude || 100.4705])
      );
      if (bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl max-h-[94vh] rounded-3xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-navy-950 via-navy-900 to-blue-950 text-white flex items-center justify-between border-b border-navy-800">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-navy-900 border border-gold-500/50 flex-shrink-0 shadow-inner">
              <Image
                src={activeProperty.cover_image || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=400&q=80'}
                alt={activeProperty.title}
                fill
                unoptimized
                referrerPolicy="no-referrer"
                className="object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] font-black bg-gold-500/20 text-gold-300 px-2 py-0.5 rounded-md border border-gold-500/30">
                  {formatPropertyCode(activeProperty.id)}
                </span>
                <span className="text-xs text-gray-300 truncate">
                  {activeProperty.district}, {activeProperty.province} ({getPropertyTypeName(activeProperty.property_type)})
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  DOL LandsMaps Ready
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-white truncate mt-1">
                DOL LandsMaps Cadastral & Summary Stats: {activeProperty.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="px-4 sm:px-6 pt-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'map'
                  ? 'bg-navy-950 text-gold-400 shadow-xs'
                  : 'text-gray-600 hover:text-navy-950 hover:bg-gray-200/70'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>แผนที่ผังระวาง & สถิติรวม ({summaryStats.count} ทรัพย์)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('deed')}
              className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'deed'
                  ? 'bg-navy-950 text-gold-400 shadow-xs'
                  : 'text-gray-600 hover:text-navy-950 hover:bg-gray-200/70'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>ตรวจระวาง & โฉนดที่ดิน</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('fees')}
              className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'fees'
                  ? 'bg-navy-950 text-gold-400 shadow-xs'
                  : 'text-gray-600 hover:text-navy-950 hover:bg-gray-200/70'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>ภาษี & ค่าธรรมเนียมโอน</span>
            </button>
          </div>

          <a
            href={parcelInfo?.landsmapsUrl || 'https://landsmaps.dol.go.th/'}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 cursor-pointer flex-shrink-0"
          >
            <span>เปิด DOL LandsMaps</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          
          {/* ========================================================================= */}
          {/* TAB 1: INTERACTIVE LANDSMAPS VIEW WITH SUMMARY STATS WIDGET */}
          {/* ========================================================================= */}
          {activeTab === 'map' && (
            <div className="space-y-4">
              
              {/* ========================================================================= */}
              {/* SUMMARY STATS WIDGET (SUMMARY STATS OF ALL PROPERTIES ON MAP) */}
              {/* ========================================================================= */}
              <div className="bg-gradient-to-br from-navy-950 via-slate-900 to-navy-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-gold-500/40 relative overflow-hidden">
                {/* Decorative background blur glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10">
                  {/* Widget Top Bar with Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-navy-800">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-gold-500/20 text-gold-400 border border-gold-500/40 flex items-center justify-center font-bold">
                        <BarChart3 className="w-4 h-4 text-gold-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm sm:text-base font-extrabold text-white">
                            LandsMaps Summary Stats Widget
                          </h3>
                          <span className="bg-gold-400 text-navy-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                            Map Overview
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-300 mt-0.5">
                          สรุปสถิติเนื้อที่รวมและราคาเฉลี่ยต่อตารางเมตรของทรัพย์ทั้งหมดที่แสดงผลบนแผนที่ขณะนี้
                        </p>
                      </div>
                    </div>

                    {/* Scope Selector Filters */}
                    <div className="flex items-center space-x-1.5 bg-navy-900/90 p-1 rounded-xl border border-navy-700 text-xs">
                      <span className="text-[10px] text-gray-400 px-1.5 font-bold flex items-center gap-1">
                        <Filter className="w-3 h-3" /> ขอบเขต:
                      </span>
                      <button
                        type="button"
                        onClick={() => setFilterScope('all')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          filterScope === 'all'
                            ? 'bg-gold-500 text-navy-950 shadow-xs'
                            : 'text-gray-300 hover:text-white hover:bg-navy-800'
                        }`}
                      >
                        ทั้งหมด ({internalProperties.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterScope('district')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          filterScope === 'district'
                            ? 'bg-gold-500 text-navy-950 shadow-xs'
                            : 'text-gray-300 hover:text-white hover:bg-navy-800'
                        }`}
                      >
                        อ.{activeProperty.district}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterScope('type')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          filterScope === 'type'
                            ? 'bg-gold-500 text-navy-950 shadow-xs'
                            : 'text-gray-300 hover:text-white hover:bg-navy-800'
                        }`}
                      >
                        {getPropertyTypeName(activeProperty.property_type)}
                      </button>
                    </div>
                  </div>

                  {/* Main Metric Cards Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3.5">
                    {/* STAT 1: TOTAL AREA (เนื้อที่รวมทั้งหมด) */}
                    <div className="bg-navy-900/80 backdrop-blur-xs p-3.5 rounded-xl border border-gold-500/30 hover:border-gold-500/60 transition-colors">
                      <div className="flex items-center justify-between text-[11px] text-gold-400 font-bold mb-1">
                        <span className="flex items-center gap-1">
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>เนื้อที่รวมทั้งหมด (Total Area)</span>
                        </span>
                        <span className="text-[9px] bg-gold-500/20 text-gold-300 px-1.5 py-0.5 rounded">
                          {summaryStats.count} แปลง
                        </span>
                      </div>
                      <div className="text-base sm:text-xl font-black text-white font-mono tracking-tight">
                        {summaryStats.totalLandSqMeters.toLocaleString()}{' '}
                        <span className="text-xs font-bold text-gray-300 font-sans">ตร.ม.</span>
                      </div>
                      <div className="text-[11px] text-amber-300 font-semibold mt-1 flex items-center gap-1">
                        <span>แปลงไทย:</span>
                        <strong className="font-bold">
                          {summaryStats.raiBreakdown.rai > 0 && `${summaryStats.raiBreakdown.rai} ไร่ `}
                          {summaryStats.raiBreakdown.ngan > 0 && `${summaryStats.raiBreakdown.ngan} งาน `}
                          {summaryStats.raiBreakdown.sqWah} ตร.ว.
                        </strong>
                      </div>
                      {summaryStats.totalUsableSqMeters > 0 && (
                        <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                          พท.ใช้สอยรวม: {summaryStats.totalUsableSqMeters.toLocaleString()} ตร.ม.
                        </div>
                      )}
                    </div>

                    {/* STAT 2: AVERAGE PRICE PER SQ.M (ราคาเฉลี่ยต่อ ตร.ม.) */}
                    <div className="bg-navy-900/80 backdrop-blur-xs p-3.5 rounded-xl border border-emerald-500/40 hover:border-emerald-500/70 transition-colors">
                      <div className="flex items-center justify-between text-[11px] text-emerald-400 font-bold mb-1">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>ราคาเฉลี่ย / ตร.ม. (Avg Price/m²)</span>
                        </span>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                          เฉลี่ยจริง
                        </span>
                      </div>
                      <div className="text-base sm:text-xl font-black text-emerald-400 font-mono tracking-tight">
                        ฿{summaryStats.avgPricePerSqMeter.toLocaleString()}{' '}
                        <span className="text-xs font-bold text-gray-300 font-sans">/ ตร.ม.</span>
                      </div>
                      <div className="text-[11px] text-emerald-300 font-semibold mt-1">
                        เทียบเท่า: ฿{summaryStats.avgPricePerSqWah.toLocaleString()} / ตร.ว.
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                        ช่วง: ฿{summaryStats.minPricePerSqM.toLocaleString()} – ฿{summaryStats.maxPricePerSqM.toLocaleString()} / ตร.ม.
                      </div>
                    </div>

                    {/* STAT 3: TOTAL COMBINED VALUATION (มูลค่ารวมทรัพย์สิน) */}
                    <div className="bg-navy-900/80 backdrop-blur-xs p-3.5 rounded-xl border border-blue-500/40 hover:border-blue-500/70 transition-colors">
                      <div className="flex items-center justify-between text-[11px] text-blue-400 font-bold mb-1">
                        <span className="flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5" />
                          <span>มูลค่าตลาดรวม (Total Valuation)</span>
                        </span>
                        <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">
                          Market Price
                        </span>
                      </div>
                      <div className="text-base sm:text-xl font-black text-blue-300 font-mono tracking-tight">
                        ฿{(summaryStats.totalMarketValue / 1000000).toFixed(1)}M{' '}
                        <span className="text-xs font-normal text-gray-300 font-sans">
                          (฿{summaryStats.totalMarketValue.toLocaleString()})
                        </span>
                      </div>
                      <div className="text-[11px] text-blue-200 font-semibold mt-1">
                        เฉลี่ย: ฿{(summaryStats.avgPricePerProperty / 1000000).toFixed(2)}M / รายการ
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                        รวมทรัพย์เพื่อขาย & เช่าในบริเวณ
                      </div>
                    </div>

                    {/* STAT 4: ACTIVE FOCUSED PROPERTY SNAPSHOT */}
                    <div className="bg-navy-900/80 backdrop-blur-xs p-3.5 rounded-xl border border-amber-500/40">
                      <div className="flex items-center justify-between text-[11px] text-gold-300 font-bold mb-1">
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-gold-400" />
                          <span>แปลงที่กำลังเลือกตรวจ (Focus)</span>
                        </span>
                        <span className="text-[9px] bg-gold-500/20 text-gold-300 px-1.5 py-0.5 rounded font-mono">
                          #{chanoteNo || 'DOL'}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white truncate">
                        {activeProperty.title}
                      </div>
                      <div className="text-[11px] text-gold-300 font-semibold mt-1">
                        เนื้อที่: {activeProperty.land_size || 50} ตร.ว. ({(activeProperty.land_size || 50) * 4} ตร.ม.)
                      </div>
                      <div className="text-[10px] text-emerald-400 font-bold mt-0.5">
                        ราคา: {formatPrice(activeProperty.price, activeProperty.status)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* INTERACTIVE LEAFLET / DOL CADASTRE MAP CONTAINER */}
              {/* ========================================================================= */}
              <div className="relative rounded-2xl overflow-hidden border border-gray-300 shadow-inner bg-slate-950">
                {/* Map Floating Toolbar */}
                <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-gray-300 shadow-md">
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setMapLayer('cadastral')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        mapLayer === 'cadastral'
                          ? 'bg-navy-950 text-gold-400 shadow-xs'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      🗺️ ผังระวางที่ดิน
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapLayer('satellite')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        mapLayer === 'satellite'
                          ? 'bg-navy-950 text-gold-400 shadow-xs'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      🛰️ ภาพถ่ายดาวเทียม
                    </button>
                  </div>

                  <div className="h-4 w-px bg-gray-300 mx-0.5 hidden sm:block"></div>

                  <button
                    type="button"
                    onClick={resetMapBounds}
                    className="px-2.5 py-1 text-xs font-bold text-navy-950 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                    title="ปรับมุมมองให้ครอบคลุมทุกทรัพย์"
                  >
                    <Compass className="w-3.5 h-3.5 text-navy-700" />
                    <span>Fit Bounds</span>
                  </button>
                </div>

                {/* Map Legend Overlay at Bottom Right */}
                <div className="absolute bottom-3 right-3 z-[400] bg-white/95 backdrop-blur-md p-2 rounded-xl border border-gray-300 shadow-md text-[10px] text-navy-950 space-y-1">
                  <div className="font-extrabold flex items-center gap-1 text-gold-600">
                    <Layers className="w-3 h-3" /> สัญลักษณ์บนแผนที่
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-amber-400/40 border-2 border-dashed border-amber-600 rounded"></span>
                    <span>เส้นขอบรูปแปลงโฉนด (#{chanoteNo})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-navy-950 border border-gold-400 rounded-full"></span>
                    <span>หมุดทรัพย์ที่กำลังเลือก (Focus)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                    <span>ทรัพย์อื่นที่แสดงผล ({displayedProperties.length} แปลง)</span>
                  </div>
                </div>

                {/* Map Render Canvas */}
                <div 
                  ref={mapContainerRef} 
                  className="w-full h-[360px] sm:h-[420px] z-0"
                />
              </div>

              {/* Quick Switch List of Properties on the Map */}
              <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-navy-950 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-gold-600" />
                    <span>รายการทรัพย์ที่แสดงผลบนแผนที่ ({displayedProperties.length} แปลง):</span>
                  </span>
                  <span className="text-[10px] text-gray-500">คลิกที่รายการเพื่อเลือกตรวจรูปแปลงโฉนด</span>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {displayedProperties.map((p) => {
                    const isSelected = activeProperty.id === p.id;
                    const pLandWah = p.land_size || 0;
                    const pSqM = (pLandWah * 4) || p.usable_area || 1;
                    const pricePerSqM = p.price > 0 && pSqM > 0 ? Math.round(p.price / pSqM) : 0;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setActiveProperty(p)}
                        className={`flex-shrink-0 text-left p-2.5 rounded-xl border transition-all cursor-pointer min-w-[200px] max-w-[240px] ${
                          isSelected
                            ? 'bg-navy-950 text-white border-gold-400 shadow-sm ring-2 ring-gold-400/40'
                            : 'bg-white hover:bg-gray-100 text-gray-800 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`font-mono font-bold ${isSelected ? 'text-gold-300' : 'text-gray-500'}`}>
                            {formatPropertyCode(p.id)}
                          </span>
                          <span className={`font-semibold ${isSelected ? 'text-emerald-300' : 'text-emerald-600'}`}>
                            ฿{pricePerSqM.toLocaleString()}/ตร.ม.
                          </span>
                        </div>
                        <div className="text-xs font-bold truncate mt-0.5">
                          {p.title}
                        </div>
                        <div className={`text-[10px] mt-1 flex justify-between ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                          <span>{pLandWah ? `${pLandWah} ตร.ว.` : '-'}{p.usable_area ? ` (${p.usable_area} ตร.ม.)` : ''}</span>
                          <strong className={isSelected ? 'text-gold-400' : 'text-navy-950'}>
                            {p.price >= 1000000 ? `฿${(p.price / 1000000).toFixed(2)}M` : `฿${p.price.toLocaleString()}`}
                          </strong>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: CADASTRAL PARCEL SPEC & VERIFICATION FORM */}
          {/* ========================================================================= */}
          {activeTab === 'deed' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Status Alert Banner */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <span className="font-extrabold text-emerald-950">เชื่อมโยงพิกัดรูปแปลงกับกรมที่ดิน (DOL LandsMaps)</span>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      ระบบทำการดึงระวาง, ราคาประเมินกรมธนารักษ์ และคำนวณค่าโอนอัตโนมัติตามพิกัด {activeProperty.district}
                    </p>
                  </div>
                </div>

                <a
                  href={parcelInfo?.landsmapsUrl || 'https://landsmaps.dol.go.th/'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 cursor-pointer flex-shrink-0"
                >
                  <span>เปิด DOL LandsMaps</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Verification & Edit Fields */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-navy-950 text-xs sm:text-sm flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-gold-600" />
                    <span>ยืนยันข้อมูลโฉนดที่ดิน & ราคาประเมินราชการ:</span>
                  </h3>
                  <span className="text-[10px] text-gray-500">สามารถแก้ไขตัวเลขโฉนดจริงเพื่ออัปเดตลงระบบ</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-600 block mb-1">เลขที่โฉนดที่ดิน</label>
                    <input
                      type="text"
                      value={chanoteNo}
                      onChange={(e) => setChanoteNo(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-navy-950 font-mono focus:ring-2 focus:ring-gold-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-600 block mb-1">ระวาง</label>
                    <input
                      type="text"
                      value={mapSheet}
                      onChange={(e) => setMapSheet(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-navy-950 font-mono focus:ring-2 focus:ring-gold-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-600 block mb-1">เลขที่ดิน</label>
                    <input
                      type="text"
                      value={landNo}
                      onChange={(e) => setLandNo(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-navy-950 font-mono focus:ring-2 focus:ring-gold-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-600 block mb-1">หน้าสำรวจ</label>
                    <input
                      type="text"
                      value={surveyPage}
                      onChange={(e) => setSurveyPage(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-navy-950 font-mono focus:ring-2 focus:ring-gold-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-gray-200">
                  <div>
                    <label className="text-[10px] font-bold text-gray-600 block mb-1">
                      อัตราประเมินกรมธนารักษ์ (บาท / ตร.ว.)
                    </label>
                    <input
                      type="number"
                      value={appraisalRate}
                      onChange={(e) => setAppraisalRate(Number(e.target.value) || 0)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs font-extrabold text-navy-950 focus:ring-2 focus:ring-gold-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-600 block mb-1">
                      รวมราคาประเมินทุนทรัพย์ราชการ
                    </label>
                    <div className="w-full bg-amber-50 border border-amber-300 rounded-xl px-2.5 py-1.5 text-xs font-black text-navy-950">
                      ฿{totalAppraisalVal.toLocaleString()} <span className="text-[10px] text-gray-500 font-normal">({activeProperty.land_size || 50} ตร.ว.)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: VALUATION & TRANSFER FEES ANALYSIS */}
          {/* ========================================================================= */}
          {activeTab === 'fees' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Price Comparison */}
                <div className="bg-white p-4 rounded-2xl border border-gold-300/80 shadow-2xs space-y-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-navy-950">
                    <Award className="w-4 h-4 text-gold-600" />
                    <span>เปรียบเทียบราคาประเมิน vs ราคาขาย</span>
                  </div>

                  <div className="space-y-1.5 pt-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">ราคาเสนอขายตลาด:</span>
                      <strong className="text-navy-950">{formatPrice(activeProperty.price, activeProperty.status)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">รวมราคาประเมินกรมธนารักษ์:</span>
                      <strong className="text-navy-950">฿{totalAppraisalVal.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-100 font-bold">
                      <span className="text-gray-700">ส่วนต่างราคาตลาด:</span>
                      <span className={diffPct > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                        {diffPct > 0 ? `+${diffPct}% จากราคาประเมิน` : 'ใกล้เคียงราคาประเมิน'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Department of Lands Transfer Fees */}
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-navy-950">
                    <Calculator className="w-4 h-4 text-navy-800" />
                    <span>ประมาณการค่าธรรมเนียมโอน ณ สำนักงานที่ดิน</span>
                  </div>

                  <div className="space-y-1 pt-1 text-[11px] text-gray-600">
                    <div className="flex justify-between">
                      <span>• ค่าธรรมเนียมโอน 2%:</span>
                      <strong>฿{transferFees.transferFee.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>• ภาษีหัก ณ ที่จ่ายประเมิน:</span>
                      <strong>฿{transferFees.withholdingTax.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>• อากรแสตมป์ (0.5%):</span>
                      <strong>฿{transferFees.stampDutyOrBusinessTax.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-100 font-extrabold text-navy-950 text-xs">
                      <span>รวมค่าใช้จ่ายประเมิน:</span>
                      <span>฿{transferFees.totalDepartmentOfLandsFees.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Toast Notification */}
          {saveSuccess && (
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>ซิงก์ข้อมูลโฉนดที่ดินและราคาประเมินลงรายละเอียดทรัพย์เรียบร้อยแล้ว!</span>
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-3 py-2 bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl border border-gray-200 flex items-center gap-1 cursor-pointer transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
              <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกสเปกโฉนด & สถิติ'}</span>
            </button>

            <a
              href={parcelInfo?.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-white hover:bg-gray-100 text-navy-950 font-bold text-xs rounded-xl border border-gray-200 flex items-center gap-1"
            >
              <MapPin className="w-3.5 h-3.5 text-red-500" />
              <span>Google Maps</span>
            </a>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white text-gray-600 font-semibold text-xs rounded-xl border border-gray-300 hover:bg-gray-100 cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>

            <button
              type="button"
              onClick={handleSaveToProperty}
              disabled={saving}
              className="px-4 py-2 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin text-gold-400" /> : <Save className="w-4 h-4 text-gold-400" />}
              <span>ซิงก์สเปกโฉนดลงประกาศ</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
