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
  ZoomIn,
  Search,
  Navigation,
  Globe,
  Sliders,
  Ruler,
  X
} from 'lucide-react';
import { DISTRICTS_LIST } from '@/lib/utils';
import { 
  generateLandsMapsParcelInfo, 
  estimateTreasuryAppraisalRate, 
  sqWahToRaiNganWah,
  calculateLandTransferFees 
} from '@/lib/landsmaps';

// Songkhla Land Office Presets & Coordinates
const LAND_OFFICE_ZONES = [
  { id: '01-เมืองสงขลา', name: '01-เมืองสงขลา', district: 'เมืองสงขลา', subdistrict: 'บ่อยาง', lat: 7.1982, lng: 100.5951, defaultChanote: '64094', locationNote: 'ถ.ราษฎร์อุทิศ 1 ต.บ่อยาง' },
  { id: 'หาดใหญ่', name: 'หาดใหญ่ (อำเภอหาดใหญ่)', district: 'หาดใหญ่', subdistrict: 'คอหงส์', lat: 7.0084, lng: 100.4705, defaultChanote: '45892', locationNote: 'โซน ม.อ. - คอหงส์' },
  { id: 'หาดใหญ่-คลองแห', name: 'หาดใหญ่ (คลองแห/สนามบิน)', district: 'หาดใหญ่', subdistrict: 'คลองแห', lat: 7.0421, lng: 100.4632, defaultChanote: '51204', locationNote: 'ตลาดน้ำคลองแห' },
  { id: 'สะเดา', name: 'สะเดา (ด่านนอก/ปาดังเบซาร์)', district: 'สะเดา', subdistrict: 'สำนักขาม', lat: 6.6384, lng: 100.4221, defaultChanote: '38190', locationNote: 'ด่านนอกสะเดา' },
  { id: 'บางกล่ำ', name: 'บางกล่ำ (ท่าช้าง/บ้านหาร)', district: 'บางกล่ำ', subdistrict: 'ท่าช้าง', lat: 7.0851, lng: 100.4120, defaultChanote: '29814', locationNote: 'โซนอุตสาหกรรมบางกล่ำ' },
  { id: 'สิงหนคร', name: 'สิงหนคร (สทิงหม้อ/หัวเขา)', district: 'สิงหนคร', subdistrict: 'สทิงหม้อ', lat: 7.2281, lng: 100.5621, defaultChanote: '18492', locationNote: 'โซนท่าเรือน้ำลึก' },
  { id: 'จะนะ', name: 'จะนะ (บ้านนา/สะกอม)', district: 'จะนะ', subdistrict: 'บ้านนา', lat: 6.9182, lng: 100.7381, defaultChanote: '14320', locationNote: 'โซนจะนะเมืองใหม่' },
];

export default function AutoPinLandsMapsValuation() {
  const [selectedProvince, setSelectedProvince] = useState('สงขลา');
  const [selectedLandOffice, setSelectedLandOffice] = useState('01-เมืองสงขลา');
  const [district, setDistrict] = useState('เมืองสงขลา');
  const [subdistrict, setSubdistrict] = useState('บ่อยาง');
  const [chanoteNo, setChanoteNo] = useState<string>('64094');
  const [landSizeSqWah, setLandSizeSqWah] = useState<number>(80);
  const [propertyType, setPropertyType] = useState('land');
  
  // Coordinates for auto-pin
  const [lat, setLat] = useState<number>(7.1982);
  const [lng, setLng] = useState<number>(100.5951);
  
  const [isLocating, setIsLocating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isOwnedOver5Years, setIsOwnedOver5Years] = useState(true);
  const [mapLayer, setMapLayer] = useState<'hybrid' | 'streets' | 'osm'>('hybrid');
  
  // UI Panels & Layer Toggles
  const [showParcelLines, setShowParcelLines] = useState(true);
  const [showNeighborPlots, setShowNeighborPlots] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showDetailCard, setShowDetailCard] = useState(true);
  const [searchPlaceQuery, setSearchPlaceQuery] = useState('');

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

  // Function to render Land Parcel Boundaries & Neighbouring Cadastral Plots exactly like DOL LandsMaps
  const updateParcelBoundaries = useCallback(async (
    centerLat: number, 
    centerLng: number, 
    wahSize: number, 
    chanoteNum: string,
    isVisible: boolean,
    isNeighborVisible: boolean,
    isDimVisible: boolean,
    explicitMap?: any
  ) => {
    const map = explicitMap || mapInstanceRef.current;
    if (!map) return;

    const L = (await import('leaflet')).default;
    
    if (!parcelLayerGroupRef.current) {
      parcelLayerGroupRef.current = L.layerGroup().addTo(map);
    }
    const layerGroup = parcelLayerGroupRef.current;
    layerGroup.clearLayers();

    if (!isVisible) return;

    const safeWah = Math.max(20, wahSize || 80);
    // Base scale per lot in degrees
    const lotWidthM = 8; // approx 8 meters wide for urban shopfront/plot
    const lotDepthM = 20; // approx 20 meters deep
    
    const latMeters = 111000;
    const lngMeters = 111000 * Math.cos((centerLat * Math.PI) / 180);

    const dLatLot = (lotDepthM / 2) / latMeters;
    const dLngLot = (lotWidthM / 2) / lngMeters;

    const parsedBaseChanote = parseInt(chanoteNum, 10) || 64094;

    // 1. DENSE CADASTRAL PARCEL SUBDIVISION NETWORK (เส้นแบ่งแต่ละแปลงทั่วทั้งถนนและบล็อกรอบด้าน)
    if (isNeighborVisible) {
      // Create 32 realistic parcels lining both sides of the main street and side streets
      const subdivisionRows = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
      const subdivisionColumns = [
        { colIndex: -2, offsetLng: -dLngLot * 5.2, streetSide: 'left-alley' },
        { colIndex: -1, offsetLng: -dLngLot * 2.1, streetSide: 'west-block' },
        { colIndex: 1, offsetLng: dLngLot * 2.1, streetSide: 'east-block' },
        { colIndex: 2, offsetLng: dLngLot * 5.2, streetSide: 'right-alley' },
      ];

      subdivisionColumns.forEach((col) => {
        subdivisionRows.forEach((rowIndex) => {
          // Skip the central target lot at (0, 1) or (0, -1) which will be drawn as the main target
          if (rowIndex === 0 && col.colIndex === 1) return;

          const lotChanote = parsedBaseChanote + (col.colIndex * 15) + rowIndex;
          const lotWah = Math.round(safeWah * (0.85 + ((Math.abs(rowIndex + col.colIndex) % 4) * 0.1)));

          const pLat = centerLat + rowIndex * dLatLot * 2.05;
          const pLng = centerLng + col.offsetLng;

          // Slightly irregular parcel vertices for authentic cadastral feel
          const jitterLat1 = ((rowIndex * 3 + col.colIndex) % 3) * 0.05 * dLatLot;
          const jitterLng1 = ((rowIndex + col.colIndex * 2) % 3) * 0.05 * dLngLot;

          const parcelCoords: [number, number][] = [
            [pLat - dLatLot * 0.96 + jitterLat1, pLng - dLngLot * 0.98],
            [pLat + dLatLot * 0.98 + jitterLat1, pLng - dLngLot * 0.95 + jitterLng1],
            [pLat + dLatLot * 0.95, pLng + dLngLot * 0.98 + jitterLng1],
            [pLat - dLatLot * 0.98, pLng + dLngLot * 0.95],
          ];

          // DOL Red Cadastral Parcel Line (เส้นสีแดงระวางกรมที่ดิน ชัดเจน คมชัด)
          const lotPoly = L.polygon(parcelCoords, {
            color: '#E11D48', // Official DOL Cadastral Red
            weight: 1.8,
            opacity: 0.95,
            fillColor: '#F43F5E',
            fillOpacity: 0.12,
            className: 'dol-cadastral-lot-line'
          }).addTo(layerGroup);

          // Click on any neighbouring plot to select it immediately
          lotPoly.on('click', () => {
            const newLat = Number(pLat.toFixed(5));
            const newLng = Number(pLng.toFixed(5));
            setLat(newLat);
            setLng(newLng);
            setChanoteNo(String(lotChanote));
            setLandSizeSqWah(lotWah);
            setShowDetailCard(true);
            if (markerRef.current) {
              markerRef.current.setLatLng([newLat, newLng]);
            }
            const { showParcelLines: sP, showNeighborPlots: sN, showDimensions: sD } = stateRef.current;
            updateParcelBoundaries(newLat, newLng, lotWah, String(lotChanote), sP, sN, sD);
          });

          lotPoly.bindTooltip(
            `<div style="font-family: 'Prompt', sans-serif; font-size: 11px; font-weight: bold; color: #020b18; background: rgba(255,255,255,0.96); padding: 4px 8px; border-radius: 8px; border: 1.5px solid #e11d48; box-shadow: 0 2px 8px rgba(0,0,0,0.25);">
              <span style="color: #be123c; font-weight: 800;">โฉนด #${lotChanote}</span><br/>
              เนื้อที่: ${lotWah} ตร.ว. (${lotWah * 4} ตร.ม.)<br/>
              <span style="color: #64748b; font-size: 9px;">(คลิกเพื่อเลือกแปลงนี้)</span>
            </div>`,
            { permanent: false, direction: 'center' }
          );
        });
      });
    }

    // 2. MAIN TARGET LAND PARCEL (แปลงโฉนดเป้าหมายที่เลือก - เส้นแดงไฮไลต์สีทอง พร้อมหมุดหลักเขต ก.1-ก.4)
    const targetParcelCoords: [number, number][] = [
      [centerLat - dLatLot * 0.98, centerLng - dLngLot * 0.98], // หมุด ก.1 (ล่างซ้าย)
      [centerLat + dLatLot * 0.98, centerLng - dLngLot * 0.95], // หมุด ก.2 (บนซ้าย)
      [centerLat + dLatLot * 0.95, centerLng + dLngLot * 0.98], // หมุด ก.3 (บนขวา)
      [centerLat - dLatLot * 0.98, centerLng + dLngLot * 0.95], // หมุด ก.4 (ล่างขวา)
    ];

    // Main Highlighted Parcel Polygon (เส้นสีแดงสด ไฮไลต์สีทองเข้ม)
    L.polygon(targetParcelCoords, {
      color: '#DC2626', // Bright Crimson Red (DOL Style)
      weight: 3.5,
      fillColor: '#F59E0B',
      fillOpacity: 0.38,
      className: 'dol-target-parcel'
    }).addTo(layerGroup);

    // Corner boundary pins (หมุดหลักเขตที่ดิน 4 มุม ก.1 - ก.4 พร้อมป้ายกำกับ)
    const cornerLabels = ['หลักเขต ก.1', 'หลักเขต ก.2', 'หลักเขต ก.3', 'หลักเขต ก.4'];
    targetParcelCoords.forEach((coord, idx) => {
      const cornerIcon = L.divIcon({
        className: 'custom-corner-dot',
        html: `
          <div style="
            width: 14px;
            height: 14px;
            background-color: #EF4444;
            border: 2px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 0 8px rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            transform: translate(-50%, -50%);
          ">
            <div style="width: 4px; height: 4px; background: #FFFFFF; border-radius: 50%;"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker(coord, { icon: cornerIcon }).addTo(layerGroup).bindTooltip(
        `<div style="font-size: 10px; font-weight: 800; color: #020b18; background: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1.5px solid #ef4444; box-shadow: 0 2px 5px rgba(0,0,0,0.25);">
          📌 ${cornerLabels[idx]}
        </div>`,
        { permanent: false, direction: 'top' }
      );
    });

    // 3. DIMENSION MEASUREMENTS (ระยะความกว้าง/ความลึกแปลง)
    if (isDimVisible) {
      const widthMeters = Math.round(lotWidthM);
      const depthMeters = Math.round(lotDepthM);

      const topEdgeCenter: [number, number] = [
        (targetParcelCoords[1][0] + targetParcelCoords[2][0]) / 2,
        (targetParcelCoords[1][1] + targetParcelCoords[2][1]) / 2,
      ];
      const bottomEdgeCenter: [number, number] = [
        (targetParcelCoords[0][0] + targetParcelCoords[3][0]) / 2,
        (targetParcelCoords[0][1] + targetParcelCoords[3][1]) / 2,
      ];
      const leftEdgeCenter: [number, number] = [
        (targetParcelCoords[0][0] + targetParcelCoords[1][0]) / 2,
        (targetParcelCoords[0][1] + targetParcelCoords[1][1]) / 2,
      ];
      const rightEdgeCenter: [number, number] = [
        (targetParcelCoords[3][0] + targetParcelCoords[2][0]) / 2,
        (targetParcelCoords[3][1] + targetParcelCoords[2][1]) / 2,
      ];

      const createDimTag = (text: string) => L.divIcon({
        className: 'dol-dim-tag',
        html: `
          <div style="
            background: rgba(255, 255, 255, 0.95);
            color: #DC2626;
            border: 1px solid #EF4444;
            padding: 1px 5px;
            font-size: 9px;
            font-weight: 800;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.25);
            white-space: nowrap;
            transform: translate(-50%, -50%);
          ">
            ↔ ${text}
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });

      L.marker(topEdgeCenter, { icon: createDimTag(`หลัง ${widthMeters} ม.`), interactive: false }).addTo(layerGroup);
      L.marker(bottomEdgeCenter, { icon: createDimTag(`หน้ากว้าง ${widthMeters} ม.`), interactive: false }).addTo(layerGroup);
      L.marker(leftEdgeCenter, { icon: createDimTag(`ลึก ${depthMeters} ม.`), interactive: false }).addTo(layerGroup);
      L.marker(rightEdgeCenter, { icon: createDimTag(`ลึก ${depthMeters} ม.`), interactive: false }).addTo(layerGroup);
    }

    // 4. MAIN ROAD BOUNDARIES (แนวเขตทางสาธารณประโยชน์ / ถนนหลัก)
    const roadLeftLng = centerLat;
    const roadNorthLat = centerLat + dLatLot * 10;
    const roadSouthLat = centerLat - dLatLot * 10;

    // Roadway front lines (เส้นขอบทางสาธารณะ)
    const roadLeftEdge: [number, number][] = [
      [roadSouthLat, centerLng - dLngLot * 1.05],
      [roadNorthLat, centerLng - dLngLot * 1.05],
    ];
    const roadRightEdge: [number, number][] = [
      [roadSouthLat, centerLng + dLngLot * 1.05],
      [roadNorthLat, centerLng + dLngLot * 1.05],
    ];

    L.polyline(roadLeftEdge, {
      color: '#F97316',
      weight: 2.5,
      dashArray: '5, 5',
    }).addTo(layerGroup);

    L.polyline(roadRightEdge, {
      color: '#F97316',
      weight: 2.5,
      dashArray: '5, 5',
    }).addTo(layerGroup).bindTooltip(
      `<div style="font-size: 10px; font-weight: 800; color: #c2410c; background: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1px solid #f97316;">
        🚗 ทางสาธารณประโยชน์ (ถนนหลัก กว้าง ~10 ม.)
      </div>`,
      { permanent: false, direction: 'top' }
    );

  }, []);

  // Initialize interactive Leaflet map for LandsMaps
  useEffect(() => {
    let isMounted = true;

    async function initLeafletMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;
      const L = (await import('leaflet')).default;
      if (!isMounted || !mapContainerRef.current || mapInstanceRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 18, // Optimal zoom level for DOL Cadastre Parcel boundaries
        zoomControl: false,
      });

      mapInstanceRef.current = map;

      // Add zoom control at top right (below search bar)
      L.control.zoom({ position: 'topright' }).addTo(map);

      const tileConfig = getTileConfig(mapLayer);
      const tileLayer = L.tileLayer(tileConfig.url, {
        maxZoom: tileConfig.maxZoom,
        attribution: tileConfig.attribution,
      }).addTo(map);
      tileLayerRef.current = tileLayer;

      // Custom Pin Icon
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
              background-color: #DC2626;
              color: #FFFFFF;
              border: 2px solid #FFFFFF;
              border-radius: 9999px;
              padding: 4px 10px;
              font-weight: 800;
              font-size: 11px;
              display: flex;
              align-items: center;
              gap: 4px;
              box-shadow: 0 6px 14px rgba(0,0,0,0.6);
              white-space: nowrap;
            ">
              <span>📍 หมุดโฉนด #${chanoteNo}</span>
            </div>
            <div style="
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 8px solid #DC2626;
            "></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);
      markerRef.current = marker;

      // Render Initial Parcel Boundaries IMMEDIATELY
      parcelLayerGroupRef.current = L.layerGroup().addTo(map);
      updateParcelBoundaries(lat, lng, landSizeSqWah, chanoteNo, showParcelLines, showNeighborPlots, showDimensions, map);

      // Invalidate size to ensure Leaflet vectors and tiles render crisp
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          updateParcelBoundaries(lat, lng, landSizeSqWah, chanoteNo, showParcelLines, showNeighborPlots, showDimensions, mapInstanceRef.current);
        }
      }, 150);

      // Handle marker drag end to update lat/lng
      marker.on('dragend', (e: any) => {
        const position = e.target.getLatLng();
        const newLat = Number(position.lat.toFixed(5));
        const newLng = Number(position.lng.toFixed(5));
        setLat(newLat);
        setLng(newLng);
        setShowDetailCard(true);
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
        setShowDetailCard(true);
        if (markerRef.current) {
          markerRef.current.setLatLng([newLat, newLng]);
        }
        const { landSizeSqWah: currentWah, chanoteNo: currentChanote, showParcelLines: sP, showNeighborPlots: sN, showDimensions: sD } = stateRef.current;
        updateParcelBoundaries(newLat, newLng, currentWah, currentChanote, sP, sN, sD);
      });
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

  // Switch tile layer
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
      mapInstanceRef.current.invalidateSize();
    }
  };

  // Update map center and pin
  const updateMapPin = (newLat: number, newLng: number, newChanote?: string) => {
    setLat(newLat);
    setLng(newLng);
    if (newChanote) setChanoteNo(newChanote);
    setShowDetailCard(true);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([newLat, newLng], 18, { animate: true });
      if (markerRef.current) {
        markerRef.current.setLatLng([newLat, newLng]);
      }
      updateParcelBoundaries(newLat, newLng, landSizeSqWah, newChanote || chanoteNo, showParcelLines, showNeighborPlots, showDimensions);
    }
  };

  // Handle Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const zone = LAND_OFFICE_ZONES.find(z => z.id === selectedLandOffice) || LAND_OFFICE_ZONES[0];
    updateMapPin(zone.lat, zone.lng, chanoteNo || zone.defaultChanote);
  };

  // Handle Land Office selection
  const handleLandOfficeChange = (officeId: string) => {
    setSelectedLandOffice(officeId);
    const zone = LAND_OFFICE_ZONES.find(z => z.id === officeId);
    if (zone) {
      setDistrict(zone.district);
      setSubdistrict(zone.subdistrict);
      setChanoteNo(zone.defaultChanote);
      updateMapPin(zone.lat, zone.lng, zone.defaultChanote);
    }
  };

  // Auto GPS locate
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

  const getMarketMultiplier = () => {
    let multiplier = 1.35;
    if (district.includes('หาดใหญ่')) {
      if (subdistrict.includes('คอหงส์') || subdistrict.includes('หาดใหญ่')) multiplier = 1.55;
      else multiplier = 1.4;
    } else if (district.includes('เมืองสงขลา')) {
      multiplier = 1.35;
    } else if (district.includes('สะเดา')) {
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
    selectedProvince,
    subdistrict,
    landSizeSqWah,
    estimatedMarketTotal,
    lat,
    lng,
    chanoteNo
  );

  const handleCopyValuationReport = () => {
    const raiNganWah = sqWahToRaiNganWah(landSizeSqWah);
    const reportText = [
      `🏛️ ข้อมูลรูปแปลงโฉนดที่ดิน & ราคาประเมิน (DOL LandsMaps & Chantakorn Valuation)`,
      `• เลขที่โฉนด: ${chanoteNo || '64094'}`,
      `• หน้าสำรวจ: ${parcelInfo.surveyPage} | เลขที่ดิน: ${parcelInfo.landNo}`,
      `• ระวาง: ${parcelInfo.mapSheet}`,
      `• ที่ตั้ง: ตำบล${subdistrict} อำเภอ${district} จังหวัด${selectedProvince}`,
      `• เนื้อที่ดิน: ${raiNganWah.rai > 0 ? `${raiNganWah.rai} ไร่ ` : ''}${raiNganWah.ngan > 0 ? `${raiNganWah.ngan} งาน ` : ''}${raiNganWah.sqWah} ตร.ว. (${raiNganWah.totalSqMeters.toLocaleString()} ตร.ม.)`,
      `• ราคาประเมินทุนทรัพย์กรมธนารักษ์: ฿${totalTreasuryAppraisal.toLocaleString()} (฿${treasuryRatePerSqWah.toLocaleString()}/ตร.ว.)`,
      `• ราคาประเมินตลาดสากล: ฿${estimatedMarketTotal.toLocaleString()} (ช่วง ฿${marketLow.toLocaleString()} - ฿${marketHigh.toLocaleString()})`,
      `• ค่าธรรมเนียม & ภาษีโอน ณ สำนักงานที่ดิน: ฿${transferFees.totalDepartmentOfLandsFees.toLocaleString()}`,
      `• พิกัดแปลง: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      `🌐 ตรวจสอบรูปแปลงโฉนดจริงบน DOL LandsMaps: ${parcelInfo.landsmapsUrl}`,
    ].join('\n');

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="w-full bg-[#111827] rounded-3xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col">
      
      {/* ========================================================================= */}
      {/* OFFICIAL DOL LANDSMAPS TOP NAVIGATION BAR (ตรงตามดีไซน์กรมที่ดิน) */}
      {/* ========================================================================= */}
      <div className="bg-[#0f172a] text-white px-3 sm:px-6 py-2.5 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3 select-none">
        
        {/* Left: LandsMaps Logo & Search Form */}
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2">
          
          {/* Logo & Garuda */}
          <div className="flex items-center space-x-2 mr-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center font-bold text-white shadow-md border border-amber-300">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <span className="font-black text-base text-white tracking-wide flex items-center gap-1">
                Lands<span className="text-red-500">Maps</span>
              </span>
              <span className="text-[9px] text-gray-400 block -mt-0.5">กรมที่ดิน Department of Lands</span>
            </div>
          </div>

          {/* Select จังหวัด */}
          <div className="flex items-center">
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              className="bg-[#1e293b] text-xs font-bold text-gray-100 border border-gray-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-red-500"
            >
              <option value="สงขลา">สงขลา</option>
              <option value="กรุงเทพมหานคร">กรุงเทพมหานคร</option>
              <option value="สุราษฎร์ธานี">สุราษฎร์ธานี</option>
              <option value="ภูเก็ต">ภูเก็ต</option>
              <option value="นครศรีธรรมราช">นครศรีธรรมราช</option>
              <option value="ตรัง">ตรัง</option>
              <option value="พัทลุง">พัทลุง</option>
              <option value="ยะลา">ยะลา</option>
              <option value="ปัตตานี">ปัตตานี</option>
              <option value="นราธิวาส">นราธิวาส</option>
            </select>
          </div>

          {/* Select สำนักงานที่ดิน / อำเภอ */}
          <div className="flex items-center">
            <select
              value={selectedLandOffice}
              onChange={(e) => handleLandOfficeChange(e.target.value)}
              className="bg-[#1e293b] text-xs font-bold text-gray-100 border border-gray-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-red-500 max-w-[170px] sm:max-w-none truncate"
            >
              {LAND_OFFICE_ZONES.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>

          {/* Input เลขที่โฉนด */}
          <div className="flex items-center">
            <input
              type="text"
              value={chanoteNo}
              onChange={(e) => setChanoteNo(e.target.value)}
              placeholder="เลขที่โฉนด (เช่น 64094)"
              className="bg-[#1e293b] text-xs font-bold text-white border border-gray-700 rounded-lg px-3 py-1.5 w-28 sm:w-32 focus:outline-none focus:border-red-500 font-mono placeholder:text-gray-500"
            />
          </div>

          {/* Red Search Button */}
          <button
            type="submit"
            className="bg-[#DC2626] hover:bg-[#B91C1C] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95"
          >
            <Search className="w-3.5 h-3.5" />
            <span>ค้นหา</span>
          </button>
        </form>

        {/* Right Top Actions */}
        <div className="flex items-center space-x-2 text-xs">
          
          <button
            type="button"
            onClick={handleAutoGPSLocate}
            disabled={isLocating}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded-lg border border-slate-700 font-medium transition-all cursor-pointer"
          >
            <Crosshair className={`w-3.5 h-3.5 text-amber-400 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'GPS...' : 'ตำแหน่งฉัน'}</span>
          </button>

          <a
            href={parcelInfo.landsmapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold rounded-lg shadow-xs flex items-center gap-1 text-[11px] hover:brightness-110 transition-all cursor-pointer"
          >
            <span>🌐 เปิดเว็บจริง DOL</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 text-[10px] font-bold text-gray-400 border border-slate-700">
            <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white">TH</span>
            <span className="px-1.5 py-0.5 text-gray-400">EN</span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* QUICK PRESETS CHIPS (คลิกเปลี่ยนแปลงตัวอย่างตามภาพหน้าจอ) */}
      {/* ========================================================================= */}
      <div className="bg-[#1e293b] px-4 py-2 border-b border-gray-700/80 flex items-center gap-2 overflow-x-auto text-[11px] scrollbar-none">
        <span className="text-gray-400 font-bold whitespace-nowrap flex items-center gap-1 text-[10px]">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>แปลงตัวอย่าง:</span>
        </span>

        {LAND_OFFICE_ZONES.map((zone) => (
          <button
            key={zone.id}
            type="button"
            onClick={() => {
              setSelectedLandOffice(zone.id);
              setDistrict(zone.district);
              setSubdistrict(zone.subdistrict);
              setChanoteNo(zone.defaultChanote);
              updateMapPin(zone.lat, zone.lng, zone.defaultChanote);
            }}
            className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-all cursor-pointer font-bold ${
              selectedLandOffice === zone.id
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-slate-800 text-gray-300 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            📍 โฉนด #{zone.defaultChanote} ({zone.locationNote})
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* MAIN MAP CONTAINER WITH FLOATING DOL CONTROLS & PARCEL DETAILS DRAWER */}
      {/* ========================================================================= */}
      <div className="relative w-full h-[520px] sm:h-[620px] bg-slate-950 overflow-hidden">
        
        {/* The Leaflet Map Canvas */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* 1. Top Floating Place Search Bar (เหมือนในระบบ LandsMaps) */}
        <div className="absolute top-3 left-3 z-[1000] flex items-center bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-300 px-3 py-1.5 w-64 sm:w-80">
          <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            value={searchPlaceQuery}
            onChange={(e) => setSearchPlaceQuery(e.target.value)}
            placeholder="ค้นหาสถานที่สำคัญ (เช่น ถ.ราษฎร์อุทิศ 1)..."
            className="w-full text-xs font-semibold text-gray-900 bg-transparent focus:outline-none placeholder:text-gray-400"
          />
          {searchPlaceQuery && (
            <button
              type="button"
              onClick={() => setSearchPlaceQuery('')}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 2. Top-Right Map Mode & Layer Switcher Bar */}
        <div className="absolute top-14 right-3 z-[1000] flex flex-col gap-1.5 items-end">
          
          <div className="bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-gray-300 flex items-center space-x-1">
            <button
              type="button"
              onClick={() => handleLayerChange('hybrid')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                mapLayer === 'hybrid'
                  ? 'bg-slate-900 text-amber-400 shadow-xs'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              🛰️ ดาวเทียม
            </button>
            <button
              type="button"
              onClick={() => handleLayerChange('streets')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                mapLayer === 'streets'
                  ? 'bg-slate-900 text-amber-400 shadow-xs'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              🗺️ แผนที่ถนน
            </button>
            <button
              type="button"
              onClick={() => handleLayerChange('osm')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                mapLayer === 'osm'
                  ? 'bg-slate-900 text-amber-400 shadow-xs'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              🌍 OSM
            </button>
          </div>

          {/* Quick Fit Parcel Button */}
          <button
            type="button"
            onClick={handleZoomToParcel}
            className="px-3 py-1.5 bg-white/95 hover:bg-white text-slate-900 text-xs font-extrabold rounded-xl shadow-md border border-gray-300 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5 text-red-600" />
            <span>🔍 โฟกัสรูปแปลงโฉนด</span>
          </button>
        </div>

        {/* 3. Bottom-Left Floating Ruler / Layer Toggles */}
        <div className="absolute bottom-4 left-3 z-[1000] flex flex-wrap items-center gap-2">
          
          <div className="bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 text-white flex items-center gap-1 shadow-lg text-[11px]">
            <button
              type="button"
              onClick={() => setShowParcelLines(!showParcelLines)}
              className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1 ${
                showParcelLines
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-800 text-gray-400'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>เส้นระวางสีแดง DOL</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNeighborPlots(!showNeighborPlots)}
              className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1 ${
                showNeighborPlots
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-800 text-gray-400'
              }`}
            >
              <span>แปลงข้างเคียง (30+ แปลง)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDimensions(!showDimensions)}
              className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1 ${
                showDimensions
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800 text-gray-400'
              }`}
            >
              <span>ระยะเมตร</span>
            </button>
          </div>

        </div>

        {/* 4. OFFICIAL LANDSMAPS PARCEL DETAIL CARD / DRAWER (แสดงรายละเอียดรูปแปลงที่ดินตามภาพ) */}
        {showDetailCard && (
          <div className="absolute top-14 left-3 sm:left-4 z-[1000] w-[310px] sm:w-[360px] bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-red-500 overflow-hidden animate-in fade-in slide-in-from-left duration-200">
            
            {/* Card Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-black text-xs leading-tight">
                    รายละเอียดรูปแปลงที่ดิน (DOL Parcel)
                  </h4>
                  <p className="text-[10px] text-red-100">
                    สำนักงานที่ดิน: สำนักงานที่ดินจังหวัดสงขลา
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDetailCard(false)}
                className="w-6 h-6 rounded-full hover:bg-black/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Card Body - Exact LandsMaps Attributes */}
            <div className="p-3.5 space-y-2.5 text-xs text-gray-800 max-h-[380px] overflow-y-auto">
              
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                <div>
                  <span className="text-[10px] text-gray-500 font-semibold block">เลขที่โฉนด</span>
                  <span className="font-mono font-black text-red-600 text-sm">{chanoteNo}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-semibold block">หน้าสำรวจ / เลขที่ดิน</span>
                  <span className="font-mono font-black text-gray-900 text-xs">{parcelInfo.surveyPage} / {parcelInfo.landNo}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-gray-200/80">
                  <span className="text-[10px] text-gray-500 font-semibold block">ระวางแผนที่ภูมิประเทศ</span>
                  <span className="font-mono font-bold text-gray-900 text-[11px]">{parcelInfo.mapSheet} (มาตราส่วน 1:4000)</span>
                </div>
              </div>

              {/* Location */}
              <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 space-y-1">
                <div className="flex items-center gap-1 text-amber-900 font-extrabold text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  <span>ที่ตั้งแปลงที่ดิน:</span>
                </div>
                <div className="text-[11px] text-gray-800 font-medium pl-4">
                  ตำบล{subdistrict} อำเภอ{district} จังหวัด{selectedProvince}
                </div>
              </div>

              {/* Land Size Specs */}
              <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-blue-900 font-semibold block">เนื้อที่ตามโฉนด</span>
                  <span className="font-black text-blue-950 text-xs">
                    {sqWahToRaiNganWah(landSizeSqWah).rai > 0 && `${sqWahToRaiNganWah(landSizeSqWah).rai} ไร่ `}
                    {sqWahToRaiNganWah(landSizeSqWah).ngan > 0 && `${sqWahToRaiNganWah(landSizeSqWah).ngan} งาน `}
                    {sqWahToRaiNganWah(landSizeSqWah).sqWah} ตร.ว.
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-blue-700 block">คำนวณเป็น ตร.ม.</span>
                  <span className="font-mono font-bold text-xs text-blue-950">{(landSizeSqWah * 4).toLocaleString()} ตร.ม.</span>
                </div>
              </div>

              {/* Treasury Appraisal Values */}
              <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-300 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-900 font-extrabold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>ราคาประเมินที่ดิน (กรมธนารักษ์)</span>
                  </span>
                  <span className="bg-emerald-200 text-emerald-900 text-[9px] font-black px-1.5 py-0.5 rounded">
                    Official
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-0.5">
                  <span className="text-sm font-black text-emerald-950">
                    ฿{totalTreasuryAppraisal.toLocaleString()}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 font-mono">
                    (฿{treasuryRatePerSqWah.toLocaleString()} / ตร.ว.)
                  </span>
                </div>
              </div>

              {/* Coordinates */}
              <div className="text-[10px] text-gray-500 flex items-center justify-between font-mono bg-gray-100 px-2.5 py-1.5 rounded-lg">
                <span>พิกัด GPS:</span>
                <span className="font-bold text-gray-800">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href={parcelInfo.landsmapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                >
                  <span>🌐 เปิดดูบนเว็บ DOL</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <button
                  type="button"
                  onClick={handleCopyValuationReport}
                  className="px-2 py-2 bg-gray-100 hover:bg-gray-200 text-navy-950 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer border border-gray-300"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-600" />}
                  <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกข้อมูล'}</span>
                </button>
              </div>

            </div>

          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* BOTTOM SUMMARY STATS & TAX VALUATION CALCULATOR */}
      {/* ========================================================================= */}
      <div className="p-5 sm:p-7 bg-[#0b1324] text-white border-t border-gray-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <span>สรุปรายงานราคาประเมิน & ค่าธรรมเนียมโอน ณ สำนักงานที่ดิน</span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              คำนวณฐานราคาประเมินทุนทรัพย์ที่ดินโฉนด #{chanoteNo} ต.{subdistrict} อ.{district}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyValuationReport}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
              <span>{copied ? 'คัดลอกรายงานแล้ว' : 'คัดลอกรายงานฉบับเต็ม'}</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>ราคาประเมินราชการ</span>
              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">กรมธนารักษ์</span>
            </div>
            <div className="text-xl font-black text-amber-400">
              ฿{totalTreasuryAppraisal.toLocaleString()}
            </div>
            <div className="text-[11px] text-gray-400">
              ฿{treasuryRatePerSqWah.toLocaleString()} <span className="text-[10px]">/ ตร.ว.</span>
            </div>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>ราคาตลาดโดยประมาณ</span>
              <span className="text-[9px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-bold">Market Value</span>
            </div>
            <div className="text-xl font-black text-blue-400">
              ฿{estimatedMarketTotal.toLocaleString()}
            </div>
            <div className="text-[11px] text-gray-400">
              ช่วงราคา: ฿{marketLow.toLocaleString()} - ฿{marketHigh.toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>ค่าธรรมเนียม & ภาษีโอน</span>
              <span className="text-[9px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-bold">กรมที่ดิน</span>
            </div>
            <div className="text-xl font-black text-red-400">
              ฿{transferFees.totalDepartmentOfLandsFees.toLocaleString()}
            </div>
            <div className="text-[11px] text-gray-400">
              ค่าโอน 2%: ฿{transferFees.transferFee.toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>ข้อมูลโฉนด & ระวาง</span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">DOL LandsMaps</span>
            </div>
            <div className="text-base font-black text-emerald-400">
              โฉนด #{chanoteNo}
            </div>
            <div className="text-[10px] font-mono text-gray-400 truncate">
              ระวาง {parcelInfo.mapSheet}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
