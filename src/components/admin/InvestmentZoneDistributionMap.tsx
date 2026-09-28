'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Property, PropertyType } from '@/lib/types';
import { formatPrice, propertyHref, getPropertyTypeName } from '@/lib/utils';
import { SONGKHLA_DISTRICTS } from '@/data/locations';
import {
  TrendingUp,
  Sparkles,
  MapPin,
  Layers,
  Compass,
  Filter,
  BarChart3,
  Flame,
  Award,
  DollarSign,
  Maximize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Building2,
  ChevronRight,
  ShieldCheck,
  Percent,
  Activity,
  ArrowUpRight,
  Info
} from 'lucide-react';
import Link from 'next/link';

export interface InvestmentZoneInfo {
  id: string;
  name: string;
  nameEn: string;
  district: string;
  lat: number;
  lng: number;
  grade: 'A+' | 'A' | 'B+' | 'B';
  gradeTitle: string;
  catalysts: string[];
  targetBuyer: string;
  avgRoiPercent: number;
  infrastructure: string[];
  color: string;
}

// Landmark high-value investment zones across Hat Yai & Songkhla
export const INVESTMENT_ZONES: InvestmentZoneInfo[] = [
  {
    id: 'zone-psu-khohong',
    name: 'โซน ม.อ. – คอหงส์ – ปุณณกัณฑ์',
    nameEn: 'PSU - Kho Hong - Punnakan High-Yield Zone',
    district: 'หาดใหญ่',
    lat: 7.0090,
    lng: 100.4980,
    grade: 'A+',
    gradeTitle: 'Prime High-Yield & Student/Medical Hub',
    catalysts: ['ใกล้มหาวิทยาลัยสงขลานครินทร์ (ม.อ.)', 'โรงพยาบาลสงขลานครินทร์', 'แหล่งเช่าหอพักและบุคลากรทางการแพทย์', 'ศูนย์วิจัยการแพทย์'],
    targetBuyer: 'นักลงทุนปล่อยเช่ารายเดือน, บุคลากรแพทย์, อาจารย์มหาวิทยาลัย',
    avgRoiPercent: 7.2,
    infrastructure: ['ถนนปุณณกัณฑ์', 'ถนนกาญจนวนิช', 'ศูนย์ประชุมนานาชาติ ม.อ.'],
    color: '#EAB308', // Gold
  },
  {
    id: 'zone-downtown-central',
    name: 'โซนใจกลางเมืองหาดใหญ่ – เซ็นทรัล – เพชรเกษม',
    nameEn: 'Hat Yai CBD - Central Festival & Phetkasem',
    district: 'หาดใหญ่',
    lat: 7.0020,
    lng: 100.4750,
    grade: 'A+',
    gradeTitle: 'Ultra-Prime Commercial & Luxury Living',
    catalysts: ['ศูนย์การค้าเซ็นทรัล หาดใหญ่', 'ไดอาน่า คอมเพล็กซ์', 'ศูนย์กลางพาณิชยกรรมและโรงแรมชั้นนำ', 'ชุมทางรถไฟหาดใหญ่'],
    targetBuyer: 'นักธุรกิจ, เจ้าของกิจการ, นักลงทุนเก็งกำไร Capital Gain',
    avgRoiPercent: 6.8,
    infrastructure: ['ถนนเพชรเกษม', 'ถนนธรรมนูญวิถี', 'สถานีขนส่งหาดใหญ่'],
    color: '#3B82F6', // Blue
  },
  {
    id: 'zone-khuanlang-airport',
    name: 'โซนควนลัง – ท่าอากาศยานนานาชาติหาดใหญ่',
    nameEn: 'Khuan Lang - Airport Gateway Corridor',
    district: 'หาดใหญ่',
    lat: 6.9850,
    lng: 100.4150,
    grade: 'A',
    gradeTitle: 'New Suburban Expansion & Logistics Growth',
    catalysts: ['ท่าอากาศยานนานาชาติหาดใหญ่ (HDY)', 'โครงการหมู่บ้านจัดสรรและพูลวิลล่าเกิดใหม่', 'เส้นทางเลี่ยงเมืองเชื่อมสตูล-พัทลุง', 'ถนนสายสนามบิน'],
    targetBuyer: 'ครอบครัวสมัยใหม่, เจ้าหน้าที่การบิน, นักลงทุนบ้านจัดสรร',
    avgRoiPercent: 6.0,
    infrastructure: ['ถนนสนามบินพาณิชย์', 'ทางหลวงหมายเลข 4135', 'ทางเลี่ยงเมืองควนลัง'],
    color: '#10B981', // Emerald
  },
  {
    id: 'zone-banphru-kanjana',
    name: 'โซนบ้านพรุ – กาญจนวนิชใต้ (Southern Growth Corridor)',
    nameEn: 'Ban Phru - South Kanjanavanich Growth Corridor',
    district: 'หาดใหญ่',
    lat: 6.9450,
    lng: 100.4850,
    grade: 'A',
    gradeTitle: 'High-Growth Residential & Community Hub',
    catalysts: ['การขยายตัวของเมืองหาดใหญ่สู่ทิศใต้', 'สวนสาธารณะพรุค้างคาว', 'โรงเรียนชื่อดัง', 'ใกล้เส้นทางเศรษฐกิจเชื่อมสะเดา'],
    targetBuyer: 'ครอบครัวอยู่อาศัยจริง, นักพัฒนาอสังหาฯ แนวราบ',
    avgRoiPercent: 5.8,
    infrastructure: ['ถนนกาญจนวนิช (ทล.407)', 'สถานีรถไฟบ้านพรุ'],
    color: '#8B5CF6', // Purple
  },
  {
    id: 'zone-khlonghae-lopburi',
    name: 'โซนคลองแห – ลพบุรีราเมศวร์ (Northern Trade Link)',
    nameEn: 'Khlong Hae - Lopburi Ramesuan Commercial Link',
    district: 'หาดใหญ่',
    lat: 7.0450,
    lng: 100.4680,
    grade: 'B+',
    gradeTitle: 'Tourism & Wholesale Commercial Zone',
    catalysts: ['ตลาดน้ำคลองแห', 'ถนนลพบุรีราเมศวร์ตัดใหม่ 4-6 ช่องจราจร', 'โชว์รูมและศูนย์กระจายสินค้าภาคใต้', 'บิ๊กซี หาดใหญ่ 2'],
    targetBuyer: 'ผู้ประกอบการโฮลเซลล์, คลังสินค้า, นักลงทุนอาคารพาณิชย์',
    avgRoiPercent: 6.4,
    infrastructure: ['ถนนลพบุรีราเมศวร์ (ทล.414)', 'ถนนคลองแห-คูเต่า'],
    color: '#F97316', // Orange
  },
  {
    id: 'zone-songkhla-samila-heritage',
    name: 'โซนเมืองสงขลา – แหลมสมิหลา – เมืองเก่าสงขลา',
    nameEn: 'Mueang Songkhla - Samila Beach & Heritage Zone',
    district: 'เมืองสงขลา',
    lat: 7.1850,
    lng: 100.6050,
    grade: 'A',
    gradeTitle: 'Cultural Heritage, Tourism & Coastal Prestige',
    catalysts: ['ย่านเมืองเก่าสงขลา ถนนนางงาม', 'หาดชลาทัศน์และแหลมสมิหลา', 'ศูนย์ราชการจังหวัดสงขลา', 'สถาบันการศึกษา มรภ.สงขลา / มทร.ศรีวิชัย'],
    targetBuyer: 'ผู้ซื้อบ้านพักตากอากาศ, โฮสเทล/คาเฟ่, ข้าราชการระดับสูง',
    avgRoiPercent: 5.9,
    infrastructure: ['ถนนราชดำเนิน', 'ถนนชลาทัศน์', 'สะพานติณสูลานนท์'],
    color: '#EC4899', // Pink
  },
  {
    id: 'zone-sadao-border-sez',
    name: 'โซนสะเดา – ปาดังเบซาร์ – เขตเศรษฐกิจพิเศษชายแดน (SEZ)',
    nameEn: 'Sadao - Padang Besar Cross-Border Trade & SEZ Hub',
    district: 'สะเดา',
    lat: 6.6450,
    lng: 100.4350,
    grade: 'B+',
    gradeTitle: 'Cross-Border Logistics & Industrial Growth',
    catalysts: ['ด่านพรมแดนสะเดาแห่งใหม่ มูลค่าการค้าชายแดนอันดับ 1 ของประเทศ', 'เขตพัฒนาเศรษฐกิจพิเศษ (SEZ สงขลา)', 'ชุมทางรถไฟขนส่งตู้สินค้าปาดังเบซาร์', 'การเชื่อมต่อนิคมอุตสาหกรรมมาเลเซีย'],
    targetBuyer: 'บริษัทโลจิสติกส์ระหว่างประเทศ, นักลงทุนคลังสินค้าและที่ดินอุตสาหกรรม',
    avgRoiPercent: 7.5,
    infrastructure: ['มอเตอร์เวย์ M84 หาดใหญ่-สะเดา (อนาคต)', 'ทางหลวงหมายเลข 4 (เพชรเกษม)', 'สถานีรถไฟปาดังเบซาร์'],
    color: '#06B6D4', // Cyan
  },
  {
    id: 'zone-singhanakhon-port',
    name: 'โซนสิงหนคร – ท่าเรือน้ำลึกสงขลา – หัวเขา',
    nameEn: 'Singhanakhon - Deep Sea Port & Maritime Trade',
    district: 'สิงหนคร',
    lat: 7.2250,
    lng: 100.5650,
    grade: 'B',
    gradeTitle: 'Maritime Industrial & Port Economy',
    catalysts: ['ท่าเรือน้ำลึกสงขลา', 'อู่ต่อเรือและอุตสาหกรรมนอกชายฝั่ง', 'แพขนานยนต์ข้ามฟากเมืองสงขลา-สิงหนคร', 'สะพานติณสูลานนท์'],
    targetBuyer: 'ผู้ประกอบการท่าเรือ, คลังน้ำมันและบริการพลังงาน, นักลงทุนที่ดินแปลงใหญ่',
    avgRoiPercent: 5.5,
    infrastructure: ['ทางหลวงหมายเลข 408', 'ท่าเรือน้ำลึกสงขลา'],
    color: '#64748B', // Slate
  }
];

interface InvestmentZoneDistributionMapProps {
  properties: Property[];
  onSelectProperty?: (property: Property) => void;
  className?: string;
}

type MetricType = 'valuation' | 'pricePerSqm' | 'avgPrice' | 'rentalYield';
type VisualMode = 'density' | 'clusters' | 'voronoi';

export default function InvestmentZoneDistributionMap({
  properties,
  onSelectProperty,
  className = '',
}: InvestmentZoneDistributionMapProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('valuation');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedZone, setSelectedZone] = useState<InvestmentZoneInfo | null>(null);
  const [visualMode, setVisualMode] = useState<VisualMode>('density');
  const [hoveredProperty, setHoveredProperty] = useState<Property | null>(null);
  const [hoveredZone, setHoveredZone] = useState<InvestmentZoneInfo | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; title: string; subtitle: string; details: { label: string; value: string; color?: string }[] } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const histogramRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);

  // Filter properties by type
  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      if (selectedType === 'all') return true;
      return p.property_type === selectedType;
    });
  }, [properties, selectedType]);

  // Aggregate stats by district and investment zone
  const zoneStats = useMemo(() => {
    return INVESTMENT_ZONES.map((zone) => {
      // Find properties within ~8km radius of zone center or matching district
      const matchingProps = filteredProperties.filter((p) => {
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lng)) {
          return p.district.includes(zone.district);
        }
        // Approximate distance calculation in degrees
        const dLat = (lat - zone.lat) * 111; // km
        const dLng = (lng - zone.lng) * 111 * Math.cos((zone.lat * Math.PI) / 180);
        const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
        return distKm < 8.0 || p.district.includes(zone.district);
      });

      const count = matchingProps.length;
      const totalValuation = matchingProps.reduce((sum, p) => sum + (p.price || 0), 0);
      const avgPrice = count > 0 ? totalValuation / count : 0;
      
      // Calculate avg price per sqm (usable area or land size)
      let totalArea = 0;
      let areaCount = 0;
      matchingProps.forEach((p) => {
        const area = p.usable_area || p.land_size || 0;
        if (area > 0) {
          totalArea += (p.price / area);
          areaCount++;
        }
      });
      const avgPricePerSqm = areaCount > 0 ? totalArea / areaCount : 45000;

      // Price ranges
      const minPrice = count > 0 ? Math.min(...matchingProps.map(p => p.price)) : 0;
      const maxPrice = count > 0 ? Math.max(...matchingProps.map(p => p.price)) : 0;

      return {
        zone,
        count,
        totalValuation,
        avgPrice,
        avgPricePerSqm,
        minPrice,
        maxPrice,
        properties: matchingProps,
        estimatedRoi: zone.avgRoiPercent,
      };
    });
  }, [filteredProperties]);

  // Total summary
  const summaryStats = useMemo(() => {
    const totalValuation = filteredProperties.reduce((sum, p) => sum + (p.price || 0), 0);
    const avgPrice = filteredProperties.length > 0 ? totalValuation / filteredProperties.length : 0;
    const highGradeZones = zoneStats.filter(z => z.zone.grade.startsWith('A'));
    const totalHighGradeVal = highGradeZones.reduce((sum, z) => sum + z.totalValuation, 0);

    return {
      totalListings: filteredProperties.length,
      totalValuation,
      avgPrice,
      totalHighGradeVal,
      topZone: zoneStats.reduce((max, z) => z.totalValuation > max.totalValuation ? z : max, zoneStats[0]),
    };
  }, [filteredProperties, zoneStats]);

  // Primary D3 Map Visualization Renderer
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = Math.max(500, Math.min(650, width * 0.75));

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    svg.selectAll('*').remove();

    // Setup Defs for Glow Filters and Gradients
    const defs = svg.append('defs');

    // Radar Glow Filter
    const filter = defs.append('filter')
      .attr('id', 'investment-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    filter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'coloredBlur');

    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Linear Gradients for Zones
    INVESTMENT_ZONES.forEach((z) => {
      const grad = defs.append('radialGradient')
        .attr('id', `grad-${z.id}`)
        .attr('cx', '50%')
        .attr('cy', '50%')
        .attr('r', '50%');

      grad.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', z.color)
        .attr('stop-opacity', 0.85);

      grad.append('stop')
        .attr('offset', '65%')
        .attr('stop-color', z.color)
        .attr('stop-opacity', 0.35);

      grad.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', z.color)
        .attr('stop-opacity', 0.0);
    });

    // Dark Map Base Group
    const g = svg.append('g').attr('class', 'map-viewport');
    gRef.current = g;

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.8, 6])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Setup Mercator Projection centered on Songkhla Province (Lat 6.95, Lng 100.52)
    const projection = d3.geoMercator()
      .center([100.52, 6.95])
      .scale(width * 38)
      .translate([width / 2, height / 2]);

    // Draw Map Canvas Background Grid
    const gridG = g.append('g').attr('class', 'grid-lines').attr('opacity', 0.15);
    for (let x = 0; x < width * 2; x += 40) {
      gridG.append('line')
        .attr('x1', x - width / 2).attr('y1', -height)
        .attr('x2', x - width / 2).attr('y2', height * 2)
        .attr('stroke', '#C9A227').attr('stroke-width', 0.5).attr('stroke-dasharray', '2,4');
    }
    for (let y = 0; y < height * 2; y += 40) {
      gridG.append('line')
        .attr('x1', -width).attr('y1', y - height / 2)
        .attr('x2', width * 2).attr('y2', y - height / 2)
        .attr('stroke', '#C9A227').attr('stroke-width', 0.5).attr('stroke-dasharray', '2,4');
    }

    // Geographic Features: Songkhla Lake (ทะเลสาบสงขลา) Water Body Simulation
    const lakeCoords: [number, number][] = [
      [100.50, 7.28], [100.58, 7.22], [100.60, 7.15],
      [100.55, 7.12], [100.48, 7.15], [100.42, 7.22],
      [100.45, 7.27], [100.50, 7.28]
    ];
    const lakePath = d3.line<[number, number]>()
      .x(d => projection(d)![0])
      .y(d => projection(d)![1])
      .curve(d3.curveBasisClosed);

    g.append('path')
      .datum(lakeCoords)
      .attr('d', lakePath)
      .attr('fill', '#0284c7')
      .attr('fill-opacity', 0.18)
      .attr('stroke', '#38bdf8')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,2');

    g.append('text')
      .attr('x', projection([100.52, 7.20])![0])
      .attr('y', projection([100.52, 7.20])![1])
      .attr('fill', '#38bdf8')
      .attr('fill-opacity', 0.7)
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('letter-spacing', '2px')
      .attr('text-anchor', 'middle')
      .text('ทะเลสาบสงขลา (SONGKHLA LAKE)');

    // Gulf of Thailand Coastline (อ่าวไทย)
    const seaCoords: [number, number][] = [
      [100.62, 7.30], [100.61, 7.19], [100.62, 7.08], [100.68, 6.95], [100.75, 6.85]
    ];
    const seaPath = d3.line<[number, number]>()
      .x(d => projection(d)![0])
      .y(d => projection(d)![1])
      .curve(d3.curveBasis);

    g.append('path')
      .datum(seaCoords)
      .attr('d', seaPath)
      .attr('fill', 'none')
      .attr('stroke', '#0284c7')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 3);

    // Highway Arterials (เส้นทางคมนาคมหลัก)
    const highwayRoutes: { name: string; path: [number, number][] }[] = [
      {
        name: 'ทล.4 (เพชรเกษม)',
        path: [[100.35, 7.05], [100.42, 7.01], [100.47, 7.00], [100.49, 6.93], [100.45, 6.64]]
      },
      {
        name: 'ทล.407 (กาญจนวนิช)',
        path: [[100.61, 7.18], [100.56, 7.10], [100.50, 7.01], [100.48, 6.94], [100.43, 6.64]]
      },
      {
        name: 'ทล.414 (ลพบุรีราเมศวร์)',
        path: [[100.44, 7.05], [100.50, 7.06], [100.57, 7.12], [100.61, 7.16]]
      }
    ];

    const highwayLine = d3.line<[number, number]>()
      .x(d => projection(d)![0])
      .y(d => projection(d)![1])
      .curve(d3.curveCatmullRom);

    highwayRoutes.forEach(h => {
      g.append('path')
        .datum(h.path)
        .attr('d', highwayLine)
        .attr('fill', 'none')
        .attr('stroke', '#C9A227')
        .attr('stroke-opacity', 0.25)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,3');
    });

    // Map Coordinates of All Properties
    const pointsData = filteredProperties.map(p => {
      const lat = Number(p.latitude) || 7.0084;
      const lng = Number(p.longitude) || 100.4705;
      const [x, y] = projection([lng, lat]) || [0, 0];
      return {
        property: p,
        x,
        y,
        price: p.price || 0,
        area: p.usable_area || p.land_size || 50,
      };
    }).filter(d => Number.isFinite(d.x) && Number.isFinite(d.y));

    // MODE 1: 2D Spatial Density Surface (D3 Contour Density)
    if (visualMode === 'density' && pointsData.length > 2) {
      const densityData = d3.contourDensity<{ x: number; y: number; price: number }>()
        .x(d => d.x)
        .y(d => d.y)
        .weight(d => {
          if (selectedMetric === 'valuation' || selectedMetric === 'avgPrice') {
            return Math.min(10, Math.max(1, d.price / 2000000));
          }
          return 1;
        })
        .size([width, height])
        .bandwidth(35)
        .thresholds(12)(pointsData);

      // Color Interpolator for Heat Density
      const densityColor = d3.scaleSequential(d3.interpolateYlOrRd)
        .domain([0, d3.max(densityData, d => d.value) || 0.01]);

      const densityG = g.append('g').attr('class', 'density-contours');
      densityG.selectAll('path')
        .data(densityData)
        .enter()
        .append('path')
        .attr('d', d3.geoPath())
        .attr('fill', d => densityColor(d.value))
        .attr('fill-opacity', 0.18)
        .attr('stroke', d => densityColor(d.value))
        .attr('stroke-opacity', 0.4)
        .attr('stroke-width', 0.8);
    }

    // MODE 2: Delaunay Voronoi Investment Polygons
    if (visualMode === 'voronoi' && pointsData.length >= 3) {
      const delaunay = d3.Delaunay.from(pointsData, d => d.x, d => d.y);
      const voronoi = delaunay.voronoi([0, 0, width, height]);

      const voronoiG = g.append('g').attr('class', 'voronoi-cells');
      voronoiG.selectAll('path')
        .data(pointsData)
        .enter()
        .append('path')
        .attr('d', (_, i) => voronoi.renderCell(i))
        .attr('fill', d => {
          const maxP = d3.max(pointsData, p => p.price) || 20000000;
          return d3.interpolateViridis(d.price / maxP);
        })
        .attr('fill-opacity', 0.12)
        .attr('stroke', '#C9A227')
        .attr('stroke-opacity', 0.3)
        .attr('stroke-width', 0.8)
        .on('mouseenter', (event, d) => {
          setHoveredProperty(d.property);
          const [px, py] = d3.pointer(event, container);
          setTooltipPos({
            x: px,
            y: py,
            title: d.property.title,
            subtitle: `${d.property.district}, ${d.property.province}`,
            details: [
              { label: 'ราคาเสนอขาย', value: formatPrice(d.property.price, d.property.status), color: '#EAB308' },
              { label: 'ประเภท', value: getPropertyTypeName(d.property.property_type) },
              { label: 'พื้นที่ใช้สอย', value: `${d.property.usable_area || '-'} ตร.ม.` },
            ]
          });
        })
        .on('mouseleave', () => {
          setHoveredProperty(null);
          setTooltipPos(null);
        });
    }

    // Investment Zone Hub Radii & Pulses
    const zonesG = g.append('g').attr('class', 'investment-zone-nodes');

    zoneStats.forEach((stat) => {
      const [zx, zy] = projection([stat.zone.lng, stat.zone.lat]) || [0, 0];
      if (!Number.isFinite(zx) || !Number.isFinite(zy)) return;

      const isA = stat.zone.grade.startsWith('A');
      const baseRadius = Math.max(26, Math.min(65, 20 + Math.sqrt(stat.totalValuation / 1000000) * 3));

      const zoneNode = zonesG.append('g')
        .attr('class', `zone-hub-${stat.zone.id}`)
        .attr('cursor', 'pointer')
        .on('click', () => {
          setSelectedZone(stat.zone);
        })
        .on('mouseenter', (event) => {
          setHoveredZone(stat.zone);
          const [px, py] = d3.pointer(event, container);
          setTooltipPos({
            x: px,
            y: py,
            title: `⭐ ${stat.zone.name}`,
            subtitle: `${stat.zone.gradeTitle} (${stat.zone.district})`,
            details: [
              { label: 'เกรดการลงทุน', value: `Grade ${stat.zone.grade}`, color: stat.zone.color },
              { label: 'มูลค่าทรัพย์ในโซน', value: `฿${(stat.totalValuation / 1000000).toFixed(1)} ล้านบาท`, color: '#EAB308' },
              { label: 'ราคาเฉลี่ยต่อ ตร.ม.', value: `฿${stat.avgPricePerSqm.toLocaleString('th-TH', { maximumFractionDigits: 0 })}/ตร.ม.` },
              { label: 'ผลตอบแทนเฉลี่ย (ROI)', value: `${stat.estimatedRoi}% ต่อปี`, color: '#10B981' },
              { label: 'จำนวนทรัพย์ในไปป์ไลน์', value: `${stat.count} รายการ` },
            ]
          });
        })
        .on('mouseleave', () => {
          setHoveredZone(null);
          setTooltipPos(null);
        });

      // Ambient Heat Circle
      zoneNode.append('circle')
        .attr('cx', zx)
        .attr('cy', zy)
        .attr('r', baseRadius * 1.4)
        .attr('fill', `url(#grad-${stat.zone.id})`)
        .attr('opacity', 0.65);

      // Outer Pulsing Radar Ring (for Grade A+ & A)
      if (isA) {
        zoneNode.append('circle')
          .attr('cx', zx)
          .attr('cy', zy)
          .attr('r', baseRadius)
          .attr('fill', 'none')
          .attr('stroke', stat.zone.color)
          .attr('stroke-width', 1.5)
          .attr('stroke-opacity', 0.8)
          .attr('stroke-dasharray', '4,3')
          .attr('filter', 'url(#investment-glow)');
      }

      // Core Zone Badge Anchor
      zoneNode.append('circle')
        .attr('cx', zx)
        .attr('cy', zy)
        .attr('r', 16)
        .attr('fill', '#0B1F3A')
        .attr('stroke', stat.zone.color)
        .attr('stroke-width', 2.5)
        .attr('filter', 'url(#investment-glow)');

      // Grade text in center of zone
      zoneNode.append('text')
        .attr('x', zx)
        .attr('y', zy + 4)
        .attr('text-anchor', 'middle')
        .attr('fill', stat.zone.color)
        .attr('font-size', '11px')
        .attr('font-weight', '900')
        .text(stat.zone.grade);

      // Zone Label Tag Pill
      const labelG = zoneNode.append('g')
        .attr('transform', `translate(${zx}, ${zy + 24})`);

      labelG.append('rect')
        .attr('x', -55)
        .attr('y', 0)
        .attr('width', 110)
        .attr('height', 20)
        .attr('rx', 6)
        .attr('fill', '#020812')
        .attr('fill-opacity', 0.9)
        .attr('stroke', stat.zone.color)
        .attr('stroke-width', 0.8);

      labelG.append('text')
        .attr('x', 0)
        .attr('y', 13)
        .attr('text-anchor', 'middle')
        .attr('fill', '#FFFFFF')
        .attr('font-size', '9.5px')
        .attr('font-weight', '700')
        .text(stat.zone.name.split('–')[0].trim());
    });

    // Property Pins (Individual Assets as Gold Diamond Nodes)
    const pinsG = g.append('g').attr('class', 'property-pins');

    pointsData.forEach(pt => {
      const pin = pinsG.append('g')
        .attr('class', `property-pin-${pt.property.id}`)
        .attr('cursor', 'pointer')
        .on('click', () => {
          if (onSelectProperty) onSelectProperty(pt.property);
        })
        .on('mouseenter', (event) => {
          setHoveredProperty(pt.property);
          const [px, py] = d3.pointer(event, container);
          setTooltipPos({
            x: px,
            y: py,
            title: pt.property.title,
            subtitle: `${pt.property.district}, สงขลา • ${getPropertyTypeName(pt.property.property_type)}`,
            details: [
              { label: 'ราคา', value: formatPrice(pt.property.price, pt.property.status), color: '#EAB308' },
              { label: 'สถานะ', value: pt.property.status === 'rent' ? 'สำหรับเช่า' : 'สำหรับขาย' },
              { label: 'พื้นที่', value: `${pt.property.usable_area || pt.property.land_size || '-'} ตร.ม.` },
            ]
          });
        })
        .on('mouseleave', () => {
          setHoveredProperty(null);
          setTooltipPos(null);
        });

      // Inner glowing point
      pin.append('circle')
        .attr('cx', pt.x)
        .attr('cy', pt.y)
        .attr('r', 4.5)
        .attr('fill', '#FACC15')
        .attr('stroke', '#0B1F3A')
        .attr('stroke-width', 1.5);
    });

    // Songkhla City Center Pin (เมืองสงขลา)
    const [songkhlaX, songkhlaY] = projection([100.6141, 7.1756]) || [0, 0];
    if (Number.isFinite(songkhlaX)) {
      g.append('text')
        .attr('x', songkhlaX)
        .attr('y', songkhlaY - 14)
        .attr('fill', '#94A3B8')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .attr('text-anchor', 'middle')
        .text('📍 เมืองสงขลา (Mueang)');
    }

    // Hat Yai Center Pin (หาดใหญ่)
    const [hatyaiX, hatyaiY] = projection([100.4705, 7.0084]) || [0, 0];
    if (Number.isFinite(hatyaiX)) {
      g.append('text')
        .attr('x', hatyaiX)
        .attr('y', hatyaiY - 26)
        .attr('fill', '#FACC15')
        .attr('font-size', '11px')
        .attr('font-weight', 'extrabold')
        .attr('text-anchor', 'middle')
        .text('★ ศูนย์กลางเศรษฐกิจหาดใหญ่');
    }

  }, [filteredProperties, zoneStats, selectedMetric, visualMode, onSelectProperty]);

  // Render D3 Price Distribution Histogram in Secondary Card
  useEffect(() => {
    if (!histogramRef.current) return;

    const svg = d3.select(histogramRef.current);
    const width = 360;
    const height = 140;
    const margin = { top: 15, right: 15, bottom: 25, left: 35 };

    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);
    svg.selectAll('*').remove();

    const pricesInM = filteredProperties.map(p => (p.price || 0) / 1000000).filter(p => p > 0);
    if (pricesInM.length === 0) return;

    const maxPrice = Math.max(15, d3.max(pricesInM) || 20);

    const x = d3.scaleLinear()
      .domain([0, maxPrice])
      .range([margin.left, width - margin.right]);

    const bins = d3.bin()
      .domain(x.domain() as [number, number])
      .thresholds(x.ticks(10))(pricesInM);

    const y = d3.scaleLinear()
      .domain([0, d3.max(bins, d => d.length) || 1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    // Bars
    svg.append('g')
      .selectAll('rect')
      .data(bins)
      .enter()
      .append('rect')
      .attr('x', d => x(d.x0 || 0) + 1)
      .attr('width', d => Math.max(0, x(d.x1 || 0) - x(d.x0 || 0) - 2))
      .attr('y', d => y(d.length))
      .attr('height', d => y(0) - y(d.length))
      .attr('fill', '#C9A227')
      .attr('rx', 3)
      .attr('opacity', 0.85);

    // Median line
    const medianVal = d3.median(pricesInM) || 0;
    if (medianVal > 0) {
      svg.append('line')
        .attr('x1', x(medianVal))
        .attr('x2', x(medianVal))
        .attr('y1', margin.top)
        .attr('y2', height - margin.bottom)
        .attr('stroke', '#EF4444')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '3,3');

      svg.append('text')
        .attr('x', x(medianVal) + 4)
        .attr('y', margin.top + 8)
        .attr('fill', '#EF4444')
        .attr('font-size', '9px')
        .attr('font-weight', 'bold')
        .text(`มัธยฐาน: ${medianVal.toFixed(1)}M`);
    }

    // X Axis
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => `${d}M`))
      .attr('color', '#94A3B8')
      .selectAll('text')
      .attr('font-size', '9px');

    // Y Axis
    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(3))
      .attr('color', '#94A3B8')
      .selectAll('text')
      .attr('font-size', '9px');

  }, [filteredProperties]);

  const handleResetZoom = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(600)
        .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    }
  };

  const handleZoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.scaleBy, 0.75);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Header & Analytics Summary */}
      <div className="bg-gradient-to-r from-[#071324] via-[#0B1F3A] to-[#071324] rounded-3xl p-6 sm:p-7 border border-gold-500/30 shadow-xl text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-gold-500/20 border border-gold-500/40 text-gold-300 text-xs font-bold uppercase tracking-wider mb-2">
              <Award className="w-3.5 h-3.5 text-gold-400" />
              <span>D3 GEOSPATIAL INVESTMENT INTELLIGENCE</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
              <span>แผนที่วิเคราะห์การกระจายตัวของราคา & โซนลงทุนศักยภาพสูง</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 mt-1 max-w-2xl">
              ระบุและวิเคราะห์ทำเลทอง (High-Value Investment Zones) ในหาดใหญ่–สงขลา พร้อมคำนวณความหนาแน่นของมูลค่าทรัพย์ (Price Density) และผลตอบแทนเฉลี่ย (Gross ROI)
            </p>
          </div>

          {/* Quick Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-navy-950/80 border border-white/10 rounded-2xl p-3">
              <div className="text-[10px] text-gray-400 font-semibold">มูลค่าทรัพย์รวมในระบบ</div>
              <div className="text-base sm:text-lg font-black text-gold-400 mt-0.5">
                ฿{(summaryStats.totalValuation / 1000000).toFixed(1)} ลบ.
              </div>
              <div className="text-[10px] text-emerald-400 font-bold">{summaryStats.totalListings} รายการ</div>
            </div>

            <div className="bg-navy-950/80 border border-white/10 rounded-2xl p-3">
              <div className="text-[10px] text-gray-400 font-semibold">ราคาเฉลี่ยต่อทรัพย์</div>
              <div className="text-base sm:text-lg font-black text-white mt-0.5">
                ฿{(summaryStats.avgPrice / 1000000).toFixed(2)} ลบ.
              </div>
              <div className="text-[10px] text-gray-400">หาดใหญ่–สงขลา</div>
            </div>

            <div className="bg-navy-950/80 border border-white/10 rounded-2xl p-3 col-span-2 sm:col-span-1">
              <div className="text-[10px] text-gold-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-gold-400" />
                <span>โซนศักยภาพสูงสุด</span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-white mt-0.5 truncate">
                {summaryStats.topZone?.zone.name.split('–')[0]}
              </div>
              <div className="text-[10px] text-gold-400 font-semibold">
                ROI ~{summaryStats.topZone?.estimatedRoi}%
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Controls Bar */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          {/* Visual Mode Selector */}
          <div className="flex items-center space-x-1 bg-navy-950 p-1 rounded-xl border border-white/15">
            <span className="text-[11px] font-bold text-gray-400 px-2 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-gold-400" />
              <span>การแสดงผล:</span>
            </span>

            <button
              type="button"
              onClick={() => setVisualMode('density')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                visualMode === 'density'
                  ? 'bg-gold-500 text-navy-950 shadow-md font-black'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Density Heatmap (ความหนาแน่น)
            </button>

            <button
              type="button"
              onClick={() => setVisualMode('voronoi')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                visualMode === 'voronoi'
                  ? 'bg-gold-500 text-navy-950 shadow-md font-black'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Voronoi Territories (ขอบเขตอิทธิพล)
            </button>
          </div>

          {/* Property Type Filter */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'ทุกประเภท' },
              { id: 'house', label: 'บ้านเดี่ยว' },
              { id: 'condo', label: 'คอนโด' },
              { id: 'land', label: 'ที่ดิน' },
              { id: 'commercial', label: 'อาคารพาณิชย์' },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedType(t.id)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedType === t.id
                    ? 'bg-white text-navy-950 font-bold shadow-sm'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid: D3 Map (Left 8 Cols) + Zone Rankings & D3 Histogram (Right 4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Interactive D3 Geospatial Canvas (8 Cols) */}
        <div className="lg:col-span-8 bg-[#030914] rounded-3xl border border-navy-800 shadow-xl overflow-hidden relative flex flex-col">
          {/* Canvas Floating Top Overlay (Controls & Legend) */}
          <div className="p-4 flex flex-wrap items-center justify-between gap-2 border-b border-navy-800/80 bg-navy-950/60 backdrop-blur-md z-10">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-gold-400 animate-pulse" />
              <span className="text-xs font-bold text-white">
                พิกัดอสังหาริมทรัพย์และฮับการลงทุนสงขลา ({filteredProperties.length} หมุด)
              </span>
            </div>

            {/* D3 Map Zoom & Pan Control Bar */}
            <div className="flex items-center space-x-1 bg-navy-900/90 border border-white/15 rounded-xl p-1">
              <button
                type="button"
                onClick={handleZoomIn}
                title="ขยายแผนที่"
                className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                title="ย่อแผนที่"
                className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                title="รีเซ็ตมุมมองกลาง"
                className="p-1.5 text-gray-300 hover:text-gold-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* D3 SVG Container */}
          <div ref={containerRef} className="relative w-full flex-grow min-h-[480px] bg-[#020712] overflow-hidden select-none">
            <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

            {/* Floating D3 Tooltip */}
            {tooltipPos && (
              <div
                style={{
                  left: `${Math.min(containerRef.current?.clientWidth ? containerRef.current.clientWidth - 260 : 300, Math.max(15, tooltipPos.x + 15))}px`,
                  top: `${Math.max(15, tooltipPos.y - 120)}px`,
                }}
                className="pointer-events-none absolute z-30 w-64 bg-navy-950/95 backdrop-blur-md text-white p-3.5 rounded-2xl border border-gold-500/50 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="text-xs font-extrabold text-gold-400 line-clamp-1">{tooltipPos.title}</div>
                <div className="text-[10px] text-gray-300 mb-2">{tooltipPos.subtitle}</div>
                <div className="space-y-1 text-[11px] border-t border-white/15 pt-2">
                  {tooltipPos.details.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-gray-400 text-[10px]">{item.label}:</span>
                      <span className="font-bold font-mono" style={{ color: item.color || '#FFFFFF' }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Map Legend Overlay */}
            <div className="absolute bottom-3 left-3 bg-navy-950/85 backdrop-blur-md p-3 rounded-2xl border border-white/15 shadow-lg text-[10px] text-gray-300 space-y-1.5 pointer-events-none max-w-xs">
              <div className="font-bold text-gold-400 uppercase tracking-wider text-[9px]">เกรดความน่าลงทุน</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <span>Grade A+ (Prime ROI)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Grade A (High Growth)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span>Grade B+ (Expansion)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span>Grade B (Logistics/SEZ)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Zone Rankings, Investment Insights & D3 Price Histogram (4 Cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Card 1: D3 Price Distribution Histogram */}
          <div className="bg-white rounded-3xl p-5 border border-surface-border shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-navy-950 text-sm flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-gold-600" />
                  <span>D3 การกระจายตัวของราคา (Price Distribution)</span>
                </h3>
                <p className="text-[11px] text-gray-500">ความถี่ของทรัพย์สินตามระดับราคา (หน่วย: ล้านบาท)</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-2 border border-gray-100 flex justify-center">
              <svg ref={histogramRef} className="w-full h-auto" />
            </div>

            <div className="mt-2 text-[10px] text-gray-500 flex items-center justify-between">
              <span>ต่ำสุด: ฿{(d3.min(filteredProperties, p => p.price) || 0) / 1000000}M</span>
              <span className="text-red-600 font-bold">--- เส้นประ: ค่ามัธยฐาน</span>
              <span>สูงสุด: ฿{(d3.max(filteredProperties, p => p.price) || 0) / 1000000}M</span>
            </div>
          </div>

          {/* Card 2: Investment Zone Hotspots Leaderboard */}
          <div className="bg-white rounded-3xl p-5 border border-surface-border shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-navy-950 text-sm flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span>ทำเลทอง & โซนลงทุนศักยภาพสูง ({INVESTMENT_ZONES.length} โซน)</span>
                </h3>
                <p className="text-[11px] text-gray-500">คลิกเพื่อดูบทวิเคราะห์และทรัพย์ในทำเล</p>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 no-scrollbar">
              {zoneStats.map((stat) => {
                const isSelected = selectedZone?.id === stat.zone.id;
                return (
                  <div
                    key={stat.zone.id}
                    onClick={() => setSelectedZone(isSelected ? null : stat.zone)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-navy-950 text-white border-gold-500 shadow-md'
                        : 'bg-gray-50/70 hover:bg-gray-100/80 border-gray-200/70 text-navy-950'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="px-1.5 py-0.2 rounded font-black text-[10px]"
                            style={{
                              backgroundColor: isSelected ? stat.zone.color : `${stat.zone.color}25`,
                              color: isSelected ? '#0B1F3A' : stat.zone.color
                            }}
                          >
                            Grade {stat.zone.grade}
                          </span>
                          <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-gold-400' : 'text-navy-950'}`}>
                            {stat.zone.name}
                          </h4>
                        </div>
                        <div className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                          {stat.zone.gradeTitle}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className={`text-xs font-black ${isSelected ? 'text-white' : 'text-gold-700'}`}>
                          ROI ~{stat.estimatedRoi}%
                        </div>
                        <div className={`text-[10px] ${isSelected ? 'text-gray-400' : 'text-gray-500'}`}>
                          {stat.count} ทรัพย์ในโซน
                        </div>
                      </div>
                    </div>

                    {/* Expandable Details when selected */}
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-white/15 space-y-2 text-xs animate-in fade-in duration-200">
                        <div>
                          <div className="text-[10px] font-bold text-gold-400 uppercase">ปัจจัยขับเคลื่อนมูลค่า (Catalysts):</div>
                          <ul className="list-disc list-inside text-[11px] text-gray-200 mt-1 space-y-0.5">
                            {stat.zone.catalysts.map((c, i) => (
                              <li key={i} className="line-clamp-1">{c}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex justify-between items-center pt-2 text-[11px]">
                          <span className="text-gray-400">มูลค่ารวมไปป์ไลน์:</span>
                          <span className="font-bold text-gold-400 font-mono">
                            ฿{(stat.totalValuation / 1000000).toFixed(1)} ล้านบาท
                          </span>
                        </div>

                        <Link
                          href={`/admin/properties?district=${encodeURIComponent(stat.zone.district)}`}
                          className="w-full py-1.5 bg-gold-500 hover:bg-gold-400 text-navy-950 font-black text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all shadow-sm cursor-pointer mt-2"
                        >
                          <span>ดูทรัพย์ในโซน {stat.zone.district}</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
