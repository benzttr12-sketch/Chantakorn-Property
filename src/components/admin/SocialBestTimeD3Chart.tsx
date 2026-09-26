'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  TimeSlotEngagement, 
  generateHistoricalEngagementMatrix,
  getHourlyEngagementAverages,
  getDailyEngagementAverages,
  calculateBestTimeSlot,
  BestTimeRecommendation
} from '@/lib/social-engagement-engine';
import { Property, PropertyType } from '@/lib/types';
import { 
  Flame, 
  Sparkles, 
  TrendingUp, 
  Clock, 
  Calendar, 
  BarChart3, 
  Grid3X3, 
  Activity, 
  Info,
  CheckCircle2,
  ChevronRight,
  Eye,
  MousePointerClick
} from 'lucide-react';

interface SocialBestTimeD3ChartProps {
  property?: Property | null;
  channel?: string;
  onSelectTimeSlot?: (slot: { dayName: string; timeLabel: string; hour: number; score: number }) => void;
  selectedTimeSlot?: { day: number; hour: number } | null;
}

type ChartViewMode = 'heatmap' | 'curve' | 'ranking';
type MetricMode = 'score' | 'inquiries' | 'clicks';

export default function SocialBestTimeD3Chart({
  property,
  channel = 'facebook',
  onSelectTimeSlot,
  selectedTimeSlot,
}: SocialBestTimeD3ChartProps) {
  const [viewMode, setViewMode] = useState<ChartViewMode>('heatmap');
  const [metric, setMetric] = useState<MetricMode>('score');
  const [hoveredSlot, setHoveredSlot] = useState<TimeSlotEngagement | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Generate matrix data based on current channel & property type
  const matrixData = useMemo(() => {
    return generateHistoricalEngagementMatrix(channel, property?.property_type);
  }, [channel, property?.property_type]);

  const bestSlotRec: BestTimeRecommendation = useMemo(() => {
    return calculateBestTimeSlot(property, channel);
  }, [property, channel]);

  const hourlyCurveData = useMemo(() => {
    return getHourlyEngagementAverages(channel, property?.property_type);
  }, [channel, property?.property_type]);

  const dailyRankingData = useMemo(() => {
    return getDailyEngagementAverages(channel, property?.property_type);
  }, [channel, property?.property_type]);

  // Render D3 Visualizations
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clean previous render

    const containerWidth = containerRef.current.clientWidth || 700;
    const isMobile = containerWidth < 600;

    // D3 VIEW 1: 7x24 HEATMAP MATRIX
    const renderHeatmap = (
      svgEl: d3.Selection<SVGSVGElement, unknown, null, undefined>,
      width: number,
      mobile: boolean
    ) => {
      const margin = { 
        top: 36, 
        right: 20, 
        bottom: 40, 
        left: mobile ? 48 : 65 
      };
      const height = mobile ? 320 : 360;
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      svgEl.attr('viewBox', `0 0 ${width} ${height}`)
         .attr('width', '100%')
         .attr('height', height);

      const g = svgEl.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const days = [0, 1, 2, 3, 4, 5, 6];
      const dayLabels = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
      const hours = Array.from({ length: 24 }, (_, i) => i);

      const xScale = d3.scaleBand<number>()
        .domain(hours)
        .range([0, innerWidth])
        .padding(0.08);

      const yScale = d3.scaleBand<number>()
        .domain(days)
        .range([0, innerHeight])
        .padding(0.12);

      const maxVal = metric === 'score' ? 100 : metric === 'inquiries' ? 18 : 10;
      
      const colorScale = d3.scaleSequential<string>()
        .domain([0, maxVal])
        .interpolator((t) => {
          if (t < 0.25) return d3.interpolateRgb('#0f172a', '#1e3a8a')(t / 0.25);
          if (t < 0.55) return d3.interpolateRgb('#1e3a8a', '#d97706')((t - 0.25) / 0.3);
          if (t < 0.85) return d3.interpolateRgb('#d97706', '#f59e0b')((t - 0.55) / 0.3);
          return d3.interpolateRgb('#f59e0b', '#10b981')((t - 0.85) / 0.15);
        });

      const xAxis = g.append('g')
        .attr('transform', `translate(0, -8)`);

      xAxis.selectAll('.hour-label')
        .data(hours)
        .enter()
        .append('text')
        .attr('x', (d) => (xScale(d) || 0) + xScale.bandwidth() / 2)
        .attr('y', 0)
        .attr('text-anchor', 'middle')
        .attr('font-size', mobile ? '8px' : '10px')
        .attr('font-weight', (d) => (d % 3 === 0 ? '700' : '500'))
        .attr('fill', (d) => (d % 3 === 0 ? '#94a3b8' : '#475569'))
        .text((d) => (mobile ? (d % 4 === 0 ? `${d}h` : '') : (d % 2 === 0 ? `${d.toString().padStart(2, '0')}` : '')));

      const yAxis = g.append('g');

      yAxis.selectAll('.day-label')
        .data(days)
        .enter()
        .append('text')
        .attr('x', -10)
        .attr('y', (d) => (yScale(d) || 0) + yScale.bandwidth() / 2 + 4)
        .attr('text-anchor', 'end')
        .attr('font-size', mobile ? '10px' : '12px')
        .attr('font-weight', '700')
        .attr('fill', (d) => (d === 0 || d === 6 ? '#f59e0b' : '#cbd5e1'))
        .text((d) => dayLabels[d]);

      const cells = g.selectAll('.heat-cell')
        .data(matrixData)
        .enter()
        .append('g')
        .attr('class', 'heat-cell');

      cells.append('rect')
        .attr('x', (d) => xScale(d.hour) || 0)
        .attr('y', (d) => yScale(d.day) || 0)
        .attr('width', xScale.bandwidth())
        .attr('height', yScale.bandwidth())
        .attr('rx', 4)
        .attr('ry', 4)
        .attr('fill', (d) => {
          const val = metric === 'score' ? d.score : metric === 'inquiries' ? d.inquiriesRate : d.clickRate;
          return colorScale(val);
        })
        .attr('stroke', (d) => {
          const isBest = d.day === bestSlotRec.dayIndex && d.hour === bestSlotRec.hour;
          const isSelected = selectedTimeSlot?.day === d.day && selectedTimeSlot?.hour === d.hour;
          if (isBest) return '#fbbf24';
          if (isSelected) return '#38bdf8';
          return '#0f172a';
        })
        .attr('stroke-width', (d) => {
          const isBest = d.day === bestSlotRec.dayIndex && d.hour === bestSlotRec.hour;
          const isSelected = selectedTimeSlot?.day === d.day && selectedTimeSlot?.hour === d.hour;
          return isBest || isSelected ? 2.5 : 0.8;
        })
        .attr('cursor', 'pointer')
        .style('transition', 'transform 0.15s ease, stroke-width 0.15s ease')
        .on('mouseenter', function (event, d) {
          d3.select(this)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 2.5);

          const rect = svgRef.current?.getBoundingClientRect();
          if (rect) {
            setTooltipPos({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
            });
          }
          setHoveredSlot(d);
        })
        .on('mousemove', function (event) {
          const rect = svgRef.current?.getBoundingClientRect();
          if (rect) {
            setTooltipPos({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
            });
          }
        })
        .on('mouseleave', function (event, d) {
          const isBest = d.day === bestSlotRec.dayIndex && d.hour === bestSlotRec.hour;
          const isSelected = selectedTimeSlot?.day === d.day && selectedTimeSlot?.hour === d.hour;
          d3.select(this)
            .attr('stroke', isBest ? '#fbbf24' : isSelected ? '#38bdf8' : '#0f172a')
            .attr('stroke-width', isBest || isSelected ? 2.5 : 0.8);
          setHoveredSlot(null);
          setTooltipPos(null);
        })
        .on('click', function (event, d) {
          if (onSelectTimeSlot) {
            onSelectTimeSlot({
              dayName: d.dayName,
              timeLabel: d.timeLabel,
              hour: d.hour,
              score: d.score,
            });
          }
        });

      const bestCellX = (xScale(bestSlotRec.hour) || 0) + xScale.bandwidth() / 2;
      const bestCellY = (yScale(bestSlotRec.dayIndex) || 0) + yScale.bandwidth() / 2;

      const badgeG = g.append('g')
        .attr('transform', `translate(${bestCellX}, ${bestCellY})`)
        .attr('pointer-events', 'none');

      badgeG.append('circle')
        .attr('r', Math.min(xScale.bandwidth(), yScale.bandwidth()) / 2.8)
        .attr('fill', '#f59e0b')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.95);

      badgeG.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', mobile ? '8px' : '10px')
        .attr('font-weight', '900')
        .attr('fill', '#020617')
        .text('★');

      const legendG = svgEl.append('g')
        .attr('transform', `translate(${margin.left}, ${height - 14})`);

      const legendWidth = Math.min(220, innerWidth * 0.6);

      const defs = svgEl.append('defs');
      const linearGradient = defs.append('linearGradient')
        .attr('id', 'heatmap-legend-grad')
        .attr('x1', '0%').attr('y1', '0%')
        .attr('x2', '100%').attr('y2', '0%');

      linearGradient.append('stop').attr('offset', '0%').attr('stop-color', '#1e3a8a');
      linearGradient.append('stop').attr('offset', '50%').attr('stop-color', '#d97706');
      linearGradient.append('stop').attr('offset', '100%').attr('stop-color', '#10b981');

      legendG.append('rect')
        .attr('width', legendWidth)
        .attr('height', 8)
        .attr('rx', 4)
        .attr('fill', 'url(#heatmap-legend-grad)');

      legendG.append('text')
        .attr('x', 0)
        .attr('y', 18)
        .attr('font-size', '9px')
        .attr('font-weight', '600')
        .attr('fill', '#94a3b8')
        .text('ความสนใจต่ำ');

      legendG.append('text')
        .attr('x', legendWidth)
        .attr('y', 18)
        .attr('text-anchor', 'end')
        .attr('font-size', '9px')
        .attr('font-weight', '700')
        .attr('fill', '#34d399')
        .text('🔥 ช่วงเวลาทอง (Peak Activity)');
    };

    // D3 VIEW 2: 24-HOUR AREA CURVE
    const renderAreaCurve = (
      svgEl: d3.Selection<SVGSVGElement, unknown, null, undefined>,
      width: number,
      mobile: boolean
    ) => {
      const margin = { top: 30, right: 30, bottom: 45, left: 45 };
      const height = mobile ? 300 : 340;
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      svgEl.attr('viewBox', `0 0 ${width} ${height}`)
         .attr('width', '100%')
         .attr('height', height);

      const g = svgEl.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const xScale = d3.scaleLinear()
        .domain([0, 23])
        .range([0, innerWidth]);

      const yMax = d3.max(hourlyCurveData, (d) => (metric === 'score' ? d.score : metric === 'inquiries' ? d.inquiries : d.clicks)) || 100;
      const yScale = d3.scaleLinear()
        .domain([0, Math.ceil(yMax * 1.15)])
        .nice()
        .range([innerHeight, 0]);

      g.append('g')
        .attr('class', 'grid')
        .call(
          d3.axisLeft(yScale)
            .ticks(5)
            .tickSize(-innerWidth)
            .tickFormat(() => '')
        )
        .selectAll('line')
        .attr('stroke', '#1e293b')
        .attr('stroke-dasharray', '2,2');

      g.select('.domain').remove();

      const defs = svgEl.append('defs');
      const areaGrad = defs.append('linearGradient')
        .attr('id', 'curve-area-gradient')
        .attr('x1', '0%').attr('y1', '0%')
        .attr('x2', '0%').attr('y2', '100%');

      areaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#f59e0b').attr('stop-opacity', 0.45);
      areaGrad.append('stop').attr('offset', '60%').attr('stop-color', '#3b82f6').attr('stop-opacity', 0.15);
      areaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#1e1b4b').attr('stop-opacity', 0.0);

      const area = d3.area<any>()
        .x((d) => xScale(d.hour))
        .y0(innerHeight)
        .y1((d) => yScale(metric === 'score' ? d.score : metric === 'inquiries' ? d.inquiries : d.clicks))
        .curve(d3.curveMonotoneX);

      const line = d3.line<any>()
        .x((d) => xScale(d.hour))
        .y((d) => yScale(metric === 'score' ? d.score : metric === 'inquiries' ? d.inquiries : d.clicks))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(hourlyCurveData)
        .attr('fill', 'url(#curve-area-gradient)')
        .attr('d', area);

      g.append('path')
        .datum(hourlyCurveData)
        .attr('fill', 'none')
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 3)
        .attr('d', line);

      g.selectAll('.data-dot')
        .data(hourlyCurveData)
        .enter()
        .append('circle')
        .attr('cx', (d) => xScale(d.hour))
        .attr('cy', (d) => yScale(metric === 'score' ? d.score : metric === 'inquiries' ? d.inquiries : d.clicks))
        .attr('r', (d) => (d.isPeakHour ? 5.5 : 3.5))
        .attr('fill', (d) => (d.isPeakHour ? '#10b981' : d.isCurrentHour ? '#38bdf8' : '#fbbf24'))
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 2)
        .attr('cursor', 'pointer');

      const xAxis = d3.axisBottom(xScale)
        .ticks(mobile ? 8 : 12)
        .tickFormat((d) => `${d}:00`);

      g.append('g')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(xAxis)
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px');

      const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat((d) => `${d}${metric === 'score' ? 'pt' : ''}`);

      g.append('g')
        .call(yAxis)
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px');

      const peaks = hourlyCurveData.filter((d) => d.isPeakHour);
      peaks.forEach((peak) => {
        g.append('text')
          .attr('x', xScale(peak.hour))
          .attr('y', yScale(metric === 'score' ? peak.score : metric === 'inquiries' ? peak.inquiries : peak.clicks) - 10)
          .attr('text-anchor', 'middle')
          .attr('font-size', '9px')
          .attr('font-weight', '800')
          .attr('fill', '#34d399')
          .text('🔥 Peak');
      });
    };

    // D3 VIEW 3: 7-DAY RANKING BARS
    const renderRankingBars = (
      svgEl: d3.Selection<SVGSVGElement, unknown, null, undefined>,
      width: number,
      mobile: boolean
    ) => {
      const margin = { top: 20, right: 60, bottom: 20, left: mobile ? 65 : 85 };
      const height = 320;
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      svgEl.attr('viewBox', `0 0 ${width} ${height}`)
         .attr('width', '100%')
         .attr('height', height);

      const g = svgEl.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const sortedDaily = [...dailyRankingData].sort((a, b) => b.score - a.score);

      const yScale = d3.scaleBand<string>()
        .domain(sortedDaily.map((d) => d.dayName))
        .range([0, innerHeight])
        .padding(0.24);

      const xScale = d3.scaleLinear()
        .domain([0, 100])
        .range([0, innerWidth]);

      const barGroups = g.selectAll('.bar-group')
        .data(sortedDaily)
        .enter()
        .append('g')
        .attr('class', 'bar-group')
        .attr('transform', (d) => `translate(0, ${yScale(d.dayName) || 0})`);

      barGroups.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', innerWidth)
        .attr('height', yScale.bandwidth())
        .attr('rx', 6)
        .attr('fill', '#1e293b');

      barGroups.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', (d) => xScale(d.score))
        .attr('height', yScale.bandwidth())
        .attr('rx', 6)
        .attr('fill', (d, i) => (i === 0 ? '#10b981' : i === 1 ? '#f59e0b' : '#3b82f6'));

      g.selectAll('.day-title')
        .data(sortedDaily)
        .enter()
        .append('text')
        .attr('x', -12)
        .attr('y', (d) => (yScale(d.dayName) || 0) + yScale.bandwidth() / 2 + 4)
        .attr('text-anchor', 'end')
        .attr('font-size', mobile ? '10px' : '12px')
        .attr('font-weight', '700')
        .attr('fill', '#f1f5f9')
        .text((d, i) => `${i === 0 ? '👑 ' : ''}${d.dayName}`);

      barGroups.append('text')
        .attr('x', (d) => xScale(d.score) + 8)
        .attr('y', yScale.bandwidth() / 2 + 4)
        .attr('font-size', '11px')
        .attr('font-weight', '800')
        .attr('fill', '#ffffff')
        .text((d) => `${d.score} คะแนน`);

      barGroups.append('text')
        .attr('x', 10)
        .attr('y', yScale.bandwidth() / 2 + 4)
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .attr('fill', '#020617')
        .text((d) => `เวลาทอง: ${d.peakHourLabel}`);
    };

    if (viewMode === 'heatmap') {
      renderHeatmap(svg, containerWidth, isMobile);
    } else if (viewMode === 'curve') {
      renderAreaCurve(svg, containerWidth, isMobile);
    } else if (viewMode === 'ranking') {
      renderRankingBars(svg, containerWidth, isMobile);
    }
  }, [viewMode, metric, matrixData, hourlyCurveData, dailyRankingData, bestSlotRec, selectedTimeSlot, onSelectTimeSlot]);

  return (
    <div className="bg-navy-950 text-slate-100 rounded-3xl p-5 sm:p-6 border border-navy-800 shadow-2xl space-y-6 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-gold-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-60 h-60 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

      {/* Header Section */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-navy-800/80">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-gold-500/20 text-gold-400 border border-gold-500/30">
              <Clock className="w-4 h-4" />
            </span>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>ระบบ AI คำนวณช่วงเวลาทองในการโพสต์</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                D3 Heatmap & Analytics
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            วิเคราะห์พฤติกรรมการทักแชท (Inquiries) และความสนใจทรัพย์ย้อนหลังจากผู้ซื้อในหาดใหญ่–สงขลา กว่า 2,400+ รายการ
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-navy-900/90 rounded-2xl border border-navy-700/80 self-start md:self-auto">
          <button
            onClick={() => setViewMode('heatmap')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'heatmap'
                ? 'bg-gold-500 text-navy-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span>ความร้อน 7 วัน (7x24)</span>
          </button>

          <button
            onClick={() => setViewMode('curve')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'curve'
                ? 'bg-gold-500 text-navy-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>แนวโน้ม 24 ชม.</span>
          </button>

          <button
            onClick={() => setViewMode('ranking')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'ranking'
                ? 'bg-gold-500 text-navy-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>จัดอันดับวัน</span>
          </button>
        </div>
      </div>

      {/* Top Highlight: #1 Prime Recommended Window Banner */}
      <div className="relative z-10 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-navy-900 via-slate-900 to-navy-900 border border-gold-500/40 shadow-lg flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gold-400 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-gold-500/20 text-navy-950">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-gold-400">
                ช่วงเวลาที่แนะนำสูงสุดสำหรับทรัพย์นี้
              </span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-gold-400/20 text-gold-300 font-bold border border-gold-400/30">
                {bestSlotRec.conversionProbability}
              </span>
            </div>
            <h4 className="text-lg sm:text-xl font-black text-white mt-0.5">
              {bestSlotRec.dayName} เวลา {bestSlotRec.timeLabel}
            </h4>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              {bestSlotRec.strategicReason}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-end lg:self-center">
          {onSelectTimeSlot && (
            <button
              onClick={() =>
                onSelectTimeSlot({
                  dayName: bestSlotRec.dayName,
                  timeLabel: bestSlotRec.timeLabel,
                  hour: bestSlotRec.hour,
                  score: bestSlotRec.score,
                })
              }
              className="px-4 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-black text-xs flex items-center space-x-2 shadow-md transition-all active:scale-95 whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>เลือกช่วงเวลานี้โพสต์</span>
            </button>
          )}
        </div>
      </div>

      {/* Visualization Canvas Container */}
      <div className="relative z-10" ref={containerRef}>
        {/* Metric Switcher sub-bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-400">
            <Info className="w-3.5 h-3.5 text-gold-400" />
            <span>แสดงตามเกณฑ์:</span>
            <div className="inline-flex rounded-xl bg-navy-900 border border-navy-800 p-0.5">
              <button
                onClick={() => setMetric('score')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                  metric === 'score' ? 'bg-gold-500/20 text-gold-300 border border-gold-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ดัชนีคะแนนรวม (Score %)
              </button>
              <button
                onClick={() => setMetric('inquiries')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                  metric === 'inquiries' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ยอดทักแชท (Inquiries)
              </button>
              <button
                onClick={() => setMetric('clicks')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                  metric === 'clicks' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ยอดคลิก (CTR %)
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
            <MousePointerClick className="w-3.5 h-3.5 text-gold-400" />
            <span>แตะหรือชี้ที่ช่องเพื่อดูเจาะลึก / คลิกเพื่อเลือกเวลา</span>
          </div>
        </div>

        {/* SVG Render Element */}
        <div className="w-full overflow-x-auto no-scrollbar rounded-2xl bg-slate-900/80 p-2 sm:p-4 border border-navy-800 relative min-h-[320px] flex items-center justify-center">
          <svg ref={svgRef} className="w-full max-w-full overflow-visible" />

          {/* D3 Hover Tooltip */}
          {hoveredSlot && tooltipPos && (
            <div
              className="absolute z-30 pointer-events-none p-3.5 bg-slate-950/95 border border-gold-500/50 rounded-2xl shadow-2xl text-xs backdrop-blur-md min-w-[240px] transform -translate-x-1/2 -translate-y-full mb-3 animate-in fade-in zoom-in-95 duration-150"
              style={{
                left: `${Math.max(130, Math.min((containerRef.current?.clientWidth || 600) - 130, tooltipPos.x))}px`,
                top: `${Math.max(10, tooltipPos.y - 12)}px`,
              }}
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="font-extrabold text-white text-sm">
                  {hoveredSlot.dayName} {hoveredSlot.timeLabel}
                </span>
                <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${
                  hoveredSlot.score >= 85 ? 'bg-emerald-500/20 text-emerald-400' : hoveredSlot.score >= 65 ? 'bg-gold-500/20 text-gold-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  {hoveredSlot.score}/100 จุด
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 my-2 text-[11px]">
                <div className="bg-slate-900 p-1.5 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">คาดการณ์ทักแชท:</span>
                  <span className="font-bold text-emerald-400">+{hoveredSlot.inquiriesRate} รายการ</span>
                </div>
                <div className="bg-slate-900 p-1.5 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">อัตราคลิก:</span>
                  <span className="font-bold text-amber-400">+{hoveredSlot.clickRate}% CTR</span>
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-slate-300">
                <p><strong>🎯 กลุ่มเป้าหมายหลัก:</strong> {hoveredSlot.audienceDemographic}</p>
                <p><strong>💡 รูปแบบที่เหมาะ:</strong> {hoveredSlot.recommendedFormat}</p>
              </div>

              <div className="mt-2 pt-1 border-t border-slate-800 text-[10px] text-gold-400 font-bold text-center">
                👉 คลิกเพื่อนำเวลานี้ไปตั้งเวลาโพสต์
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alternative Prime Slots Grid */}
      <div className="relative z-10 pt-2 border-t border-navy-800/80">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-gold-400" />
          <span>3 ช่วงเวลาทองสำรองที่น่าสนใจ (Alternative Prime Windows)</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {bestSlotRec.topAlternativeWindows.map((alt, idx) => (
            <div
              key={idx}
              onClick={() => {
                if (onSelectTimeSlot) {
                  onSelectTimeSlot({
                    dayName: alt.dayName,
                    timeLabel: alt.timeLabel,
                    hour: parseInt(alt.timeLabel.split(':')[0], 10),
                    score: alt.score,
                  });
                }
              }}
              className="p-3 bg-navy-900/70 hover:bg-navy-800/90 border border-navy-700/80 rounded-2xl cursor-pointer transition-all hover:border-gold-500/50 group space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-black text-white text-xs group-hover:text-gold-300 transition-colors">
                  {alt.dayName}
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-400">
                  {alt.score} pt
                </span>
              </div>
              <p className="text-xs text-gold-400 font-bold">{alt.timeLabel}</p>
              <p className="text-[11px] text-slate-400 leading-tight line-clamp-2">
                {alt.highlight}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
