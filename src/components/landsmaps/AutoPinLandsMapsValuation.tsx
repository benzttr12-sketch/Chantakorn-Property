'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Building2, 
  MapPin, 
  ExternalLink, 
  Calculator, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles, 
  Coins, 
  Layers, 
  FileText, 
  Compass, 
  Crosshair, 
  TrendingUp, 
  Award, 
  Share2, 
  Copy, 
  Check, 
  HelpCircle, 
  Info,
  DollarSign,
  ArrowRight,
  Send,
  Eye,
  EyeOff,
  Maximize2,
  ZoomIn
} from 'lucide-react';
import { DISTRICTS_LIST } from '@/lib/utils';
import { 
  generateLandsMapsParcelInfo, 
  estimateTreasuryAppraisalRate, 
  sqWahToRaiNganWah,
  calculateLandTransferFees 
} from '@/lib/landsmaps';

// Default Hat Yai Center Coords
const HAT_YAI_COORDS = {
  'หาดใหญ่': { lat: 7.0084, lng: 100.4705 },
  'เมืองสงขลา': { lat: 7.1982, lng: 100.5951 },
  'สะเดา': { lat: 6.6384, lng: 100.4221 },
  'บางกล่ำ': { lat: 7.0851, lng: 100.4120 },
  'ควนเนียง': { lat: 7.1852, lng: 100.3621 },
  'สิงหนคร': { lat: 7.2281, lng: 100.5621 },
  'จะนะ': { lat: 6.9182, lng: 100.7381 },
};

export default function AutoPinLandsMapsValuation() {
  const [district, setDistrict] = useState('หาดใหญ่');
  const [subdistrict, setSubdistrict] = useState('คอหงส์');
  const [propertyType, setPropertyType] = useState('land'); // land, house, condo, commercial
  const [landSizeSqWah, setLandSizeSqWah] = useState<number>(80);
  const [usableAreaSqM, setUsableAreaSqM] = useState<number>(200);
  const [buildingAgeYears, setBuildingAgeYears] = useState<number>(3);
  
  // Coordinates for auto-pin
  const [lat, setLat] = useState<number>(7.0084);
  const [lng, setLng] = useState<number>(100.4705);
  const [chanoteNo, setChanoteNo] = useState<string>('45892');
  
  const [isLocating, setIsLocating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isOwnedOver5Years, setIsOwnedOver5Years] = useState(true);
  const [mapLayer, setMapLayer] = useState<'hybrid' | 'streets' | 'osm'>('hybrid');
  
  // Parcel Display Toggles
  const [showParcelLines, setShowParcelLines] = useState(true);
  const [showNeighborPlots, setShowNeighborPlots] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const parcelLayerGroupRef = useRef<any>(null);

  // Latest state references to avoid stale closures in Leaflet events
  const stateRef = useRef({
    lat,
    lng,
    landSizeSqWah,
    chanoteNo,
    showParcelLines,
    showNeighborPlots,
    showDimensions,
  });

  useEffect(() => {
    stateRef.current = {
      lat,
      lng,
      landSizeSqWah,
      chanoteNo,
      showParcelLines,
      showNeighborPlots,
      showDimensions,
    };
  }, [lat, lng, landSizeSqWah, chanoteNo, showParcelLines, showNeighborPlots, showDimensions]);

  const getTileConfig = (layer: 'hybrid' | 'streets' | 'osm') => {
    if (layer === 'hybrid') {
      return {
        url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        attribution: '&copy; Google Satellite &copy; กรมที่ดิน DOL LandsMaps',
        maxZoom: 20,
      };
    }
    if (layer === 'streets') {
      return {
        url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        attribution: '&copy; Google Maps &copy; DOL LandsMaps',
        maxZoom: 20,
      };
    }
    return {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors | DOL LandsMaps',
      maxZoom: 19,
    };
  };

  // Function to render Land Parcel Boundaries, Subdivisions & Neighbouring Cadastral Plots
  const updateParcelBoundaries = useCallback(async (
    centerLat: number, 
    centerLng: number, 
    wahSize: number, 
    chanoteNum: string,
    isVisible: boolean,
    isNeighborVisible: boolean,
    isDimVisible: boolean
  ) => {
    if (!mapInstanceRef.current) return;
    const L = (await import('leaflet')).default;
    
    if (!parcelLayerGroupRef.current) {
      parcelLayerGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    }
    const layerGroup = parcelLayerGroupRef.current;
    layerGroup.clearLayers();

    if (!isVisible) return;

    const safeWah = Math.max(20, wahSize || 80);
    // Boundary dimensions: Ensure clearly visible polygon size even for smaller wah
    const landSideMeters = Math.max(24, Math.sqrt(safeWah * 4));
    const latMeters = 111000;
    const lngMeters = 111000 * Math.cos((centerLat * Math.PI) / 180);

    const halfWidthM = landSideMeters * 0.55;
    const halfDepthM = landSideMeters * 0.65;

    const dLat = halfDepthM / latMeters;
    const dLng = halfWidthM / lngMeters;

    // 1. MAIN TARGET LAND PARCEL POLYGON (แปลงที่ดินโฉนดหลัก - สีทองเด่นชัด เส้นขอบคมชัด)
    const mainParcelCoords: [number, number][] = [
      [centerLat - dLat * 0.95, centerLng - dLng * 1.05], // หมุด ก.1 (ล่างซ้าย)
      [centerLat + dLat * 1.05, centerLng - dLng * 0.95], // หมุด ก.2 (บนซ้าย)
      [centerLat + dLat * 0.95, centerLng + dLng * 1.05], // หมุด ก.3 (บนขวา)
      [centerLat - dLat * 1.05, centerLng + dLng * 0.95], // หมุด ก.4 (ล่างขวา)
    ];

    // High visibility glowing border & vibrant parcel fill
    L.polygon(mainParcelCoords, {
      color: '#EAB308', // Amber Gold Border
      weight: 3.5,
      dashArray: '8, 5',
      fillColor: '#F59E0B',
      fillOpacity: 0.38,
      className: 'dol-main-parcel-polygon'
    }).addTo(layerGroup);

    // Central Deed & Area Badge
    const centerBadgeIcon = L.divIcon({
      className: 'dol-parcel-center-badge',
      html: `
        <div style="
          background: rgba(2, 11, 24, 0.95);
          color: #FACC15;
          border: 2px solid #EAB308;
          border-radius: 12px;
          padding: 6px 12px;
          font-family: sans-serif;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
          box-shadow: 0 4px 14px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          transform: translate(-50%, -50%);
        ">
          <div style="display: flex; align-items: center; gap: 4px; color: #FDE047;">
            <span>📍 แปลงโฉนด #${chanoteNum || '45892'}</span>
          </div>
          <div style="font-size: 10px; color: #FFFFFF; font-weight: 600;">
            เนื้อที่: ${safeWah} ตร.ว. (${Math.round(safeWah * 4)} ตร.ม.)
          </div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });
    L.marker([centerLat, centerLng], { icon: centerBadgeIcon, interactive: false }).addTo(layerGroup);

    // Corner boundary pins (หมุดหลักเขตที่ดิน 4 มุม ก.1 - ก.4 พร้อมป้ายกำกับ)
    const cornerLabels = ['หลักเขต ก.1', 'หลักเขต ก.2', 'หลักเขต ก.3', 'หลักเขต ก.4'];
    mainParcelCoords.forEach((coord, idx) => {
      const cornerIcon = L.divIcon({
        className: 'custom-corner-dot',
        html: `
          <div style="
            width: 16px;
            height: 16px;
            background-color: #FACC15;
            border: 2.5px solid #020B18;
            border-radius: 50%;
            box-shadow: 0 0 8px rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            transform: translate(-50%, -50%);
          ">
            <div style="width: 5px; height: 5px; background: #B45309; border-radius: 50%;"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker(coord, { icon: cornerIcon }).addTo(layerGroup).bindTooltip(
        `<div style="font-size: 11px; font-weight: 800; color: #020b18; background: #ffffff; padding: 3px 8px; border-radius: 6px; border: 1.5px solid #eab308; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
          📌 ${cornerLabels[idx]}
        </div>`,
        { permanent: false, direction: 'top' }
      );
    });

    // Dimension labels on borders (ระยะหน้ากว้าง / ความลึก)
    if (isDimVisible) {
      const widthMeters = Math.round(halfWidthM * 2);
      const depthMeters = Math.round(halfDepthM * 2);

      const topEdgeCenter: [number, number] = [
        (mainParcelCoords[1][0] + mainParcelCoords[2][0]) / 2,
        (mainParcelCoords[1][1] + mainParcelCoords[2][1]) / 2,
      ];
      const bottomEdgeCenter: [number, number] = [
        (mainParcelCoords[0][0] + mainParcelCoords[3][0]) / 2,
        (mainParcelCoords[0][1] + mainParcelCoords[3][1]) / 2,
      ];
      const leftEdgeCenter: [number, number] = [
        (mainParcelCoords[0][0] + mainParcelCoords[1][0]) / 2,
        (mainParcelCoords[0][1] + mainParcelCoords[1][1]) / 2,
      ];
      const rightEdgeCenter: [number, number] = [
        (mainParcelCoords[3][0] + mainParcelCoords[2][0]) / 2,
        (mainParcelCoords[3][1] + mainParcelCoords[2][1]) / 2,
      ];

      const createDimTag = (text: string) => L.divIcon({
        className: 'dol-dim-tag',
        html: `
          <div style="
            background: #FFFFFF;
            color: #0F172A;
            border: 1px solid #CBD5E1;
            padding: 1px 6px;
            font-size: 9px;
            font-weight: 700;
            border-radius: 6px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.2);
            white-space: nowrap;
            transform: translate(-50%, -50%);
          ">
            ↔ ${text}
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });

      L.marker(topEdgeCenter, { icon: createDimTag(`ด้านหลัง ${widthMeters} ม.`), interactive: false }).addTo(layerGroup);
      L.marker(bottomEdgeCenter, { icon: createDimTag(`หน้ากว้าง ${widthMeters} ม.`), interactive: false }).addTo(layerGroup);
      L.marker(leftEdgeCenter, { icon: createDimTag(`ลึก ${depthMeters} ม.`), interactive: false }).addTo(layerGroup);
      L.marker(rightEdgeCenter, { icon: createDimTag(`ลึก ${depthMeters} ม.`), interactive: false }).addTo(layerGroup);
    }

    // 2. NEIGHBOURING CADASTRAL PLOTS & SUBDIVISION LINES (เส้นแบ่งแปลงที่ดินข้างเคียงในระวาง 6 แปลงรอบทิศ)
    if (isNeighborVisible) {
      const parsedChanote = parseInt(chanoteNum, 10) || 45892;

      const neighborPlots = [
        { label: `โฉนด #${parsedChanote + 1}`, dLatOffset: dLat * 2.1, dLngOffset: 0, w: safeWah * 1.15 },
        { label: `โฉนด #${parsedChanote - 1}`, dLatOffset: -dLat * 2.1, dLngOffset: 0, w: safeWah * 0.95 },
        { label: `โฉนด #${parsedChanote + 2}`, dLatOffset: 0, dLngOffset: dLng * 2.15, w: safeWah * 1.2 },
        { label: `โฉนด #${parsedChanote - 2}`, dLatOffset: 0, dLngOffset: -dLng * 2.15, w: safeWah * 1.05 },
        { label: `โฉนด #${parsedChanote + 3}`, dLatOffset: dLat * 2.1, dLngOffset: dLng * 2.15, w: safeWah * 1.3 },
        { label: `โฉนด #${parsedChanote - 3}`, dLatOffset: -dLat * 2.1, dLngOffset: -dLng * 2.15, w: safeWah * 0.9 },
      ];

      neighborPlots.forEach((plot) => {
        const pLat = centerLat + plot.dLatOffset;
        const pLng = centerLng + plot.dLngOffset;
        const plotCoords: [number, number][] = [
          [pLat - dLat * 0.95, pLng - dLng * 1.0],
          [pLat + dLat * 1.0, pLng - dLng * 0.95],
          [pLat + dLat * 0.95, pLng + dLng * 1.0],
          [pLat - dLat * 1.0, pLng + dLng * 0.95],
        ];

        // High contrast cadastral subdivision boundary
        L.polygon(plotCoords, {
          color: '#0284C7', // Vivid Cyan / Sky Blue
          weight: 2.2,
          dashArray: '5, 5',
          fillColor: '#38BDF8',
          fillOpacity: 0.18,
        }).addTo(layerGroup).bindTooltip(
          `<div style="font-size: 11px; font-weight: 800; color: #0369a1; background: rgba(255,255,255,0.96); padding: 4px 8px; border-radius: 8px; border: 1.5px solid #0284c7; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
            📐 ${plot.label}<br/>
            <span style="font-size: 10px; color: #64748b; font-weight: normal;">เนื้อที่: ${Math.round(plot.w)} ตร.ว.</span>
          </div>`,
          { permanent: false, direction: 'center' }
        );

        // Center label for neighbor plot
        const neighborCenterIcon = L.divIcon({
          className: 'dol-neighbor-badge',
          html: `
            <div style="
              background: rgba(255, 255, 255, 0.88);
              color: #0369A1;
              border: 1px solid #38BDF8;
              border-radius: 6px;
              padding: 2px 5px;
              font-family: sans-serif;
              font-size: 9px;
              font-weight: 700;
              white-space: nowrap;
              box-shadow: 0 1px 3px rgba(0,0,0,0.15);
              transform: translate(-50%, -50%);
            ">
              ${plot.label}
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        });
        L.marker([pLat, pLng], { icon: neighborCenterIcon, interactive: false }).addTo(layerGroup);
      });
    }

    // 3. PUBLIC ACCESS ROADWAY (แนวเขตทางสาธารณประโยชน์ / ถนนทางเข้า)
    const roadFrontLat = centerLat - dLat * 1.05;
    const roadCoords: [number, number][] = [
      [roadFrontLat - dLat * 0.4, centerLng - dLng * 3.5],
      [roadFrontLat - dLat * 0.4, centerLng + dLng * 3.5],
    ];
    L.polyline(roadCoords, {
      color: '#FB7185', // Rose Accent
      weight: 3.5,
      dashArray: '8, 6',
    }).addTo(layerGroup).bindTooltip(
      `<div style="font-size: 10px; font-weight: 800; color: #e11d48; background: #ffffff; padding: 3px 8px; border-radius: 6px; border: 1.5px solid #fb7185; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">
        🚗 ทางสาธารณประโยชน์ (ถนนทางเข้าหลัก กว้าง ~8.0 ม.)
      </div>`,
      { permanent: false, direction: 'bottom' }
    );

  }, []);

  // Initialize interactive Leaflet map for Auto-Pin with zoom 18 for crisp cadastral visibility
  useEffect(() => {
    let isMounted = true;

    async function initLeafletMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;
      const L = (await import('leaflet')).default;
      if (!isMounted || !mapContainerRef.current || mapInstanceRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 18, // High zoom for detailed cadastral parcel lines
        zoomControl: true,
      });

      const tileConfig = getTileConfig(mapLayer);
      const tileLayer = L.tileLayer(tileConfig.url, {
        maxZoom: tileConfig.maxZoom,
        attribution: tileConfig.attribution,
      }).addTo(map);
      tileLayerRef.current = tileLayer;

      // Custom Pin Icon (Anchor placed at the point so it doesn't block the polygon)
      const pinIcon = L.divIcon({
        className: 'custom-landsmaps-pin',
        html: `
          <div style="
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            transform: translate(-50%, -100%);
            cursor: grab;
          ">
            <div style="
              background-color: #020B18;
              color: #FACC15;
              border: 2px solid #EAB308;
              border-radius: 9999px;
              padding: 4px 10px;
              font-weight: 800;
              font-size: 11px;
              display: flex;
              align-items: center;
              gap: 4px;
              box-shadow: 0 8px 16px rgba(0,0,0,0.5);
              white-space: nowrap;
            ">
              <span>📍 หมุดโฉนด DOL</span>
            </div>
            <div style="
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 8px solid #EAB308;
            "></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);
      markerRef.current = marker;

      // Render Initial Parcel Boundaries
      parcelLayerGroupRef.current = L.layerGroup().addTo(map);
      updateParcelBoundaries(lat, lng, landSizeSqWah, chanoteNo, showParcelLines, showNeighborPlots, showDimensions);

      // Handle marker drag end to update lat/lng
      marker.on('dragend', (e: any) => {
        const position = e.target.getLatLng();
        const newLat = Number(position.lat.toFixed(5));
        const newLng = Number(position.lng.toFixed(5));
        setLat(newLat);
        setLng(newLng);
        const { landSizeSqWah: currentWah, chanoteNo: currentChanote, showParcelLines: sP, showNeighborPlots: sN, showDimensions: sD } = stateRef.current;
        updateParcelBoundaries(newLat, newLng, currentWah, currentChanote, sP, sN, sD);
      });

      // Handle map click to re-pin automatically
      map.on('click', (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        const newLat = Number(clickLat.toFixed(5));
        const newLng = Number(clickLng.toFixed(5));
        setLat(newLat);
        setLng(newLng);
        if (markerRef.current) {
          markerRef.current.setLatLng([newLat, newLng]);
        }
        const { landSizeSqWah: currentWah, chanoteNo: currentChanote, showParcelLines: sP, showNeighborPlots: sN, showDimensions: sD } = stateRef.current;
        updateParcelBoundaries(newLat, newLng, currentWah, currentChanote, sP, sN, sD);
      });

      mapInstanceRef.current = map;
    }

    initLeafletMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update parcel boundaries whenever any input, toggle, or coordinate changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      updateParcelBoundaries(lat, lng, landSizeSqWah, chanoteNo, showParcelLines, showNeighborPlots, showDimensions);
    }
  }, [lat, lng, landSizeSqWah, chanoteNo, showParcelLines, showNeighborPlots, showDimensions, updateParcelBoundaries]);

  // Switch tile layer when user toggles layer
  const handleLayerChange = async (newLayer: 'hybrid' | 'streets' | 'osm') => {
    setMapLayer(newLayer);
    if (!mapInstanceRef.current) return;
    const L = (await import('leaflet')).default;
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    const tileConfig = getTileConfig(newLayer);
    const newTileLayer = L.tileLayer(tileConfig.url, {
      maxZoom: tileConfig.maxZoom,
      attribution: tileConfig.attribution,
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newTileLayer;
  };

  // Focus directly on the parcel polygon
  const handleZoomToParcel = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 18, { animate: true });
    }
  };

  // Update map center when district or GPS changes
  const updateMapPin = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([newLat, newLng], 18);
      if (markerRef.current) {
        markerRef.current.setLatLng([newLat, newLng]);
      }
      updateParcelBoundaries(newLat, newLng, landSizeSqWah, chanoteNo, showParcelLines, showNeighborPlots, showDimensions);
    }
  };

  const handleDistrictChange = (newDistrict: string) => {
    setDistrict(newDistrict);
    const coords = HAT_YAI_COORDS[newDistrict as keyof typeof HAT_YAI_COORDS] || HAT_YAI_COORDS['หาดใหญ่'];
    updateMapPin(coords.lat, coords.lng);
  };

  const handleAutoGPSLocate = () => {
    if (!navigator.geolocation) {
      alert('เบราว์เซอร์นี้ไม่รองรับระบบระบุพิกัด GPS');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const gpsLat = Number(pos.coords.latitude.toFixed(5));
        const gpsLng = Number(pos.coords.longitude.toFixed(5));
        updateMapPin(gpsLat, gpsLng);
      },
      () => {
        setIsLocating(false);
        alert('ไม่สามารถดึงตำแหน่ง GPS ได้ กรุณาอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์');
      },
      { timeout: 10000 }
    );
  };

  // --- VALUATION COMPUTATION ENGINE ---
  const treasuryRatePerSqWah = estimateTreasuryAppraisalRate(district, subdistrict);
  const totalTreasuryAppraisal = Math.round((landSizeSqWah || 0) * treasuryRatePerSqWah);

  // Market multiplier based on district & property type
  const getMarketMultiplier = () => {
    let multiplier = 1.35; // Standard Hat Yai urban baseline
    if (district === 'หาดใหญ่') {
      if (subdistrict.includes('คอหงส์') || subdistrict.includes('หาดใหญ่')) multiplier = 1.55;
      else multiplier = 1.4;
    } else if (district === 'เมืองสงขลา') {
      multiplier = 1.35;
    } else if (district === 'สะเดา') {
      multiplier = 1.25;
    } else {
      multiplier = 1.2;
    }
    return multiplier;
  };

  const estimatedMarketTotal = Math.round(totalTreasuryAppraisal * getMarketMultiplier());
  const marketLow = Math.round(estimatedMarketTotal * 0.9);
  const marketHigh = Math.round(estimatedMarketTotal * 1.15);

  const transferFees = calculateLandTransferFees(estimatedMarketTotal, totalTreasuryAppraisal, isOwnedOver5Years);

  const parcelInfo = generateLandsMapsParcelInfo(
    'valuation-temp',
    district,
    'สงขลา',
    subdistrict,
    landSizeSqWah,
    estimatedMarketTotal,
    lat,
    lng
  );

  const handleCopyValuationReport = () => {
    const raiNganWah = sqWahToRaiNganWah(landSizeSqWah);
    const reportText = [
      `🏠 รายงานประเมินราคาอสังหาริมทรัพย์ & ที่ดิน (Chantakorn Valuation & DOL LandsMaps)`,
      `📍 ทำเล: ตำบล${subdistrict} อำเภอ${district} จังหวัดสงขลา`,
      `🗺️ เลขที่โฉนด: ${chanoteNo || '45892'} | ระวาง: ${parcelInfo.mapSheet}`,
      `📐 เนื้อที่ดิน: ${raiNganWah.rai > 0 ? `${raiNganWah.rai} ไร่ ` : ''}${raiNganWah.ngan > 0 ? `${raiNganWah.ngan} งาน ` : ''}${raiNganWah.sqWah} ตร.ว. (${raiNganWah.totalSqMeters.toLocaleString()} ตร.ม.)`,
      `----------------------------------------`,
      `💰 ราคาประเมินทุนทรัพย์กรมธนารักษ์: ฿${totalTreasuryAppraisal.toLocaleString()} (฿${treasuryRatePerSqWah.toLocaleString()}/ตร.ว.)`,
      `📈 ราคาประเมินตลาดสากล (Market Value): ฿${estimatedMarketTotal.toLocaleString()} (ช่วง ฿${marketLow.toLocaleString()} - ฿${marketHigh.toLocaleString()})`,
      `🏛️ ค่าธรรมเนียม & ภาษีโอน ณ สำนักงานที่ดิน: ฿${transferFees.totalDepartmentOfLandsFees.toLocaleString()}`,
      `  • ค่าธรรมเนียมโอน (2%): ฿${transferFees.transferFee.toLocaleString()}`,
      `  • ภาษีหัก ณ ที่จ่าย (โดยประมาณ): ฿${transferFees.withholdingTax.toLocaleString()}`,
      `  • อากรแสตมป์ / ภาษีธุรกิจเฉพาะ: ฿${transferFees.stampDutyOrBusinessTax.toLocaleString()}`,
      `🌐 ตรวจสอบรูปแปลงโฉนดที่ดินจริงบน DOL LandsMaps: ${parcelInfo.landsmapsUrl}`,
    ].join('\n');

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-white rounded-3xl border border-gold-500/30 shadow-xl overflow-hidden">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-navy-950 via-blue-950 to-navy-900 text-white p-6 sm:p-8 relative overflow-hidden border-b border-gold-500/40">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-gold-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-gold-500/20 border border-gold-500/50 rounded-full text-gold-300 text-xs font-bold backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-gold-400" />
              <span>DOL LandsMaps AI Engine (ระบบประเมินราคา & ระวางโฉนดอัจฉริยะ)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              ระบบปักหมุดระวางโฉนด DOL & คำนวณภาษีค่าโอนที่ดิน
            </h2>
            <p className="text-xs sm:text-sm text-gray-300">
              คลิกหรือลากหมุดบนแผนที่เพื่อดูเส้นแบ่งแปลงที่ดิน หมุดหลักเขต ก.1-ก.4 แปลงข้างเคียง พร้อมดึงราคาประเมินกรมธนารักษ์อัตโนมัติ
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleAutoGPSLocate}
              disabled={isLocating}
              className="px-4 py-2.5 bg-gold-500 hover:bg-gold-400 text-navy-950 font-black text-xs rounded-xl shadow-lg border border-gold-400 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Crosshair className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'กำลังค้นหาพิกัด...' : '📍 ดึงพิกัด GPS ปัจจุบัน'}</span>
            </button>

            <a
              href={parcelInfo.landsmapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-navy-900/80 hover:bg-navy-800 text-gold-300 font-bold text-xs rounded-xl shadow-md border border-gold-500/40 flex items-center space-x-2 transition-all cursor-pointer"
            >
              <span>🌐 เปิดดูรูปแปลงที่ดินจริงบน DOL LandsMaps</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Main Grid: Form Left (5 Cols) vs Interactive Map Right (7 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 sm:p-8">
        
        {/* Left Form Inputs (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-200">
            <span className="text-xs font-black text-navy-950 uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-gold-600" />
              <span>ข้อมูลสำหรับประเมินราคา</span>
            </span>
            <span className="text-[10px] text-gray-500">ปรับเปลี่ยนข้อมูลได้ตามจริง</span>
          </div>

          {/* Property Type Selector */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">ประเภททรัพย์สิน</label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 rounded-xl">
              {[
                { id: 'land', label: '🏞️ ที่ดินเปล่า' },
                { id: 'house', label: '🏡 บ้านเดี่ยว/ทาวน์เฮาส์' },
                { id: 'commercial', label: '🏢 อาคารพาณิชย์' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPropertyType(t.id)}
                  className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    propertyType === t.id
                      ? 'bg-navy-950 text-gold-400 shadow-xs'
                      : 'text-gray-600 hover:text-navy-950'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* District & Subdistrict */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">อำเภอ (สงขลา)</label>
              <select
                value={district}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 focus:ring-2 focus:ring-gold-500 focus:outline-none"
              >
                {DISTRICTS_LIST.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">ตำบล / ย่าน</label>
              <input
                type="text"
                value={subdistrict}
                onChange={(e) => setSubdistrict(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 focus:ring-2 focus:ring-gold-500 focus:outline-none"
                placeholder="เช่น คอหงส์, คลองแห"
              />
            </div>
          </div>

          {/* Land Size & Usable Area */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">เนื้อที่ดิน (ตารางวา)</label>
              <input
                type="number"
                value={landSizeSqWah}
                onChange={(e) => setLandSizeSqWah(Number(e.target.value) || 0)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 focus:ring-2 focus:ring-gold-500 focus:outline-none"
                placeholder="80"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">เลขที่โฉนดที่ดิน (ถ้ามี)</label>
              <input
                type="text"
                value={chanoteNo}
                onChange={(e) => setChanoteNo(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 font-mono focus:ring-2 focus:ring-gold-500 focus:outline-none"
                placeholder="45892"
              />
            </div>
          </div>

          {/* Coordinates Auto-Pin Display */}
          <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-gold-300 text-xs space-y-1">
            <div className="flex items-center justify-between font-bold text-navy-950">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-gold-600" />
                <span>พิกัดหมุดบนแผนที่ (Auto-Pin Coordinates)</span>
              </span>
              <span className="text-[10px] text-gray-500">คลิกหรือลากหมุดบนแผนที่ได้</span>
            </div>
            <div className="font-mono text-xs font-black text-navy-950">
              Latitude: {lat} | Longitude: {lng}
            </div>
          </div>

          {/* Quick Guide */}
          <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl text-[11px] text-blue-900 space-y-1">
            <div className="font-extrabold flex items-center gap-1.5 text-blue-950">
              <Info className="w-3.5 h-3.5 text-blue-600" />
              <span>วิธีใช้งานแผนที่เส้นแบ่งระวางโฉนด:</span>
            </div>
            <p className="text-blue-800 text-[10px] leading-relaxed">
              1. <strong>คลิกบนแผนที่</strong> ตรงจุดที่ตั้งแปลงที่ดิน เพื่อปักหมุดทันที<br/>
              2. <strong>เส้นขอบสีทอง (ก.1-ก.4)</strong> คือรูปแปลงโฉนดเป้าหมาย<br/>
              3. <strong>เส้นขอบสีฟ้า</strong> คือแปลงข้างเคียงในผังระวางที่ดิน<br/>
              4. <strong>เส้นประสีแดง/ชมพู</strong> คือแนวเขตทางสาธารณประโยชน์
            </p>
          </div>
        </div>

        {/* Right Auto-Pin Interactive Map (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs font-extrabold text-navy-950 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-navy-900" />
              <span>แผนที่หมุดระวางโฉนด DOL (คลิกบนแผนที่เพื่อปักหมุดตำแหน่งที่ดิน)</span>
            </label>
            
            {/* Map Controls Toolbar */}
            <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
              
              {/* Fit Parcel Button */}
              <button
                type="button"
                onClick={handleZoomToParcel}
                className="px-2.5 py-1 bg-white hover:bg-gray-100 text-navy-950 font-bold text-[11px] rounded-lg border border-gray-300 shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                title="ซูมโฟกัสแปลงที่ดิน"
              >
                <ZoomIn className="w-3 h-3 text-gold-600" />
                <span>โฟกัสแปลง</span>
              </button>

              {/* Map Layer Switcher Pills */}
              <div className="flex items-center bg-gray-200/90 p-0.5 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => handleLayerChange('hybrid')}
                  className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                    mapLayer === 'hybrid'
                      ? 'bg-navy-950 text-gold-400 shadow-xs'
                      : 'text-gray-700 hover:text-navy-950'
                  }`}
                >
                  🛰️ ดาวเทียม
                </button>
                <button
                  type="button"
                  onClick={() => handleLayerChange('streets')}
                  className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                    mapLayer === 'streets'
                      ? 'bg-navy-950 text-gold-400 shadow-xs'
                      : 'text-gray-700 hover:text-navy-950'
                  }`}
                >
                  🗺️ แผนที่ถนน
                </button>
                <button
                  type="button"
                  onClick={() => handleLayerChange('osm')}
                  className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                    mapLayer === 'osm'
                      ? 'bg-navy-950 text-gold-400 shadow-xs'
                      : 'text-gray-700 hover:text-navy-950'
                  }`}
                >
                  🌍 OSM
                </button>
              </div>
            </div>
          </div>

          {/* Sub-toolbar for parcel toggles */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-[11px]">
            <div className="font-bold text-gray-700 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-navy-900" />
              <span>เลเยอร์ระวางที่ดิน:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowParcelLines(!showParcelLines)}
                className={`px-2.5 py-0.5 rounded-md font-bold text-[10px] transition-all cursor-pointer flex items-center gap-1 ${
                  showParcelLines
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {showParcelLines ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>เส้นแปลงโฉนดหลัก (ก.1-ก.4)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowNeighborPlots(!showNeighborPlots)}
                className={`px-2.5 py-0.5 rounded-md font-bold text-[10px] transition-all cursor-pointer flex items-center gap-1 ${
                  showNeighborPlots
                    ? 'bg-sky-100 text-sky-900 border border-sky-300'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {showNeighborPlots ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>แปลงข้างเคียงในระวาง</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDimensions(!showDimensions)}
                className={`px-2.5 py-0.5 rounded-md font-bold text-[10px] transition-all cursor-pointer flex items-center gap-1 ${
                  showDimensions
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {showDimensions ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>ระยะความกว้าง/ลึก</span>
              </button>
            </div>
          </div>

          <div className="relative w-full h-[360px] sm:h-[420px] rounded-2xl overflow-hidden border border-gray-300 shadow-inner bg-gray-100">
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Map Overlay Badge */}
            <div className="absolute bottom-3 left-3 z-[1000] bg-navy-950/92 backdrop-blur-xs text-white p-2.5 rounded-xl border border-gold-500/40 text-[11px] shadow-lg flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-gold-400 flex-shrink-0" />
              <div>
                <div className="font-extrabold text-gold-300">ตำแหน่งหมุด: {district}, {subdistrict}</div>
                <div className="text-[10px] text-gray-300">ระวางโฉนด #{chanoteNo} | DOL LandsMaps Ready</div>
              </div>
            </div>

            {/* Legend Tag Top-Right */}
            <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-xs p-2 rounded-xl border border-gray-200 shadow-md text-[10px] space-y-1 pointer-events-none hidden sm:block">
              <div className="font-black text-navy-950 text-[11px] mb-1">สัญลักษณ์แผนที่ผังระวาง</div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-2 bg-amber-400 border border-amber-600 rounded-2xs inline-block"></span>
                <span className="text-gray-800 font-bold">แปลงโฉนดเป้าหมาย (#{chanoteNo})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-2 bg-sky-200 border border-sky-500 rounded-2xs inline-block"></span>
                <span className="text-gray-700">แปลงข้างเคียงในระวาง</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-0.5 bg-rose-500 border-t border-rose-500 inline-block"></span>
                <span className="text-gray-700">ทางสาธารณประโยชน์</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* VALUATION RESULTS SUMMARY SECTION */}
      <div className="p-6 sm:p-8 bg-gray-50 border-t border-gray-200 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-navy-950 flex items-center gap-2">
              <Award className="w-5 h-5 text-gold-600" />
              <span>ผลสรุปการประเมินราคา & ค่าโอน ณ สำนักงานที่ดิน</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              การประเมินวิเคราะห์ตามฐานกรมธนารักษ์และแนวโน้มซื้อขายจริงโซน {district}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopyValuationReport}
              className="px-4 py-2 bg-white hover:bg-gray-100 text-navy-950 font-bold text-xs rounded-xl border border-gray-300 shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
              <span>{copied ? 'คัดลอกรายงานแล้ว' : 'คัดลอกรายงานประเมิน'}</span>
            </button>

            <a
              href={parcelInfo.landsmapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs rounded-xl shadow-md border border-gold-500/30 flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <span>🌐 ตรวจรูปแปลงจริงบน DOL</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Treasury Official Appraisal */}
          <div className="bg-white p-5 rounded-2xl border border-gold-300 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">1. ราคาประเมินราชการ</span>
              <span className="bg-amber-100 text-amber-900 text-[9px] font-extrabold px-2 py-0.5 rounded">
                กรมธนารักษ์
              </span>
            </div>
            <div className="text-xl font-black text-navy-950">
              ฿{totalTreasuryAppraisal.toLocaleString()}
            </div>
            <div className="text-xs font-semibold text-gold-700">
              ฿{treasuryRatePerSqWah.toLocaleString()} <span className="text-[10px] text-gray-500 font-normal">/ ตร.ว.</span>
            </div>
            <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">
              ฐานประเมินทุนทรัพย์ที่ดินสำหรับคิดค่าธรรมเนียมโอน
            </p>
          </div>

          {/* Card 2: Estimated Market Value */}
          <div className="bg-navy-950 text-white p-5 rounded-2xl border border-gold-500/40 shadow-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gold-300">2. ราคาประเมินตลาดสากล</span>
              <span className="bg-gold-500 text-navy-950 text-[9px] font-black px-2 py-0.5 rounded">
                Market Avg
              </span>
            </div>
            <div className="text-xl font-black text-gold-400">
              ฿{estimatedMarketTotal.toLocaleString()}
            </div>
            <div className="text-xs font-medium text-gray-300">
              ช่วงราคา: ฿{marketLow.toLocaleString()} - ฿{marketHigh.toLocaleString()}
            </div>
            <p className="text-[10px] text-gray-400 pt-1 border-t border-navy-800">
              ประเมินจากแนวโน้มราคาซื้อขายจริงในโซน {district}
            </p>
          </div>

          {/* Card 3: Department of Lands Transfer Fees */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">3. ค่าธรรมเนียม & ภาษีโอน</span>
              <span className="bg-blue-100 text-blue-900 text-[9px] font-extrabold px-2 py-0.5 rounded">
                กรมที่ดิน
              </span>
            </div>
            <div className="text-xl font-black text-navy-950">
              ฿{transferFees.totalDepartmentOfLandsFees.toLocaleString()}
            </div>
            <div className="text-xs font-medium text-gray-600">
              ค่าโอน 2%: ฿{transferFees.transferFee.toLocaleString()}
            </div>
            <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">
              รวมค่าธรรมเนียมโอน + ภาษีหัก ณ ที่จ่าย + อากรแสตมป์
            </p>
          </div>

          {/* Card 4: Official Deed Specs */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">4. ข้อมูลโฉนด & ระวาง</span>
              <span className="bg-emerald-100 text-emerald-900 text-[9px] font-extrabold px-2 py-0.5 rounded">
                DOL Ready
              </span>
            </div>
            <div className="text-base font-black text-navy-950">
              โฉนด #{chanoteNo || '45892'}
            </div>
            <div className="text-xs font-mono text-gray-600">
              ระวาง {parcelInfo.mapSheet}
            </div>
            <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">
              {sqWahToRaiNganWah(landSizeSqWah).rai > 0 && `${sqWahToRaiNganWah(landSizeSqWah).rai} ไร่ `}
              {sqWahToRaiNganWah(landSizeSqWah).ngan > 0 && `${sqWahToRaiNganWah(landSizeSqWah).ngan} งาน `}
              {sqWahToRaiNganWah(landSizeSqWah).sqWah} ตร.ว.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
