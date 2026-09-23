'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { 
  Users, 
  Phone, 
  MessageSquare, 
  ShieldCheck, 
  Star, 
  Award, 
  MapPin, 
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { ExtendedAgent } from '@/data/agents';
import { getAgents } from '@/lib/store/agents-store';

interface FeaturedAgentsProps {
  onSelectAgentForBooking?: (agentName: string) => void;
}

export default function FeaturedAgents({ onSelectAgentForBooking }: FeaturedAgentsProps) {
  const [agents, setAgents] = useState<ExtendedAgent[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setAgents(getAgents());

    const handleUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) setAgents(e.detail);
    };
    window.addEventListener('chantakorn_agents_updated', handleUpdate);
    return () => window.removeEventListener('chantakorn_agents_updated', handleUpdate);
  }, []);

  const checkScrollability = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);

    // Calculate approximate active card index
    const cardWidth = 320;
    const index = Math.round(el.scrollLeft / cardWidth);
    setActiveIndex(Math.min(index, Math.max(0, agents.length - 1)));
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      checkScrollability();
      el.addEventListener('scroll', checkScrollability, { passive: true });
      window.addEventListener('resize', checkScrollability);
      return () => {
        el.removeEventListener('scroll', checkScrollability);
        window.removeEventListener('resize', checkScrollability);
      };
    }
  }, [agents]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = 340;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const scrollToIndex = (index: number) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const cardWidth = 336; // 320px width + 16px gap
    el.scrollTo({
      left: index * cardWidth,
      behavior: 'smooth'
    });
  };

  const handleBookingClick = (agentName: string) => {
    if (onSelectAgentForBooking) {
      onSelectAgentForBooking(agentName);
    } else {
      const el = document.getElementById('booking-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <section className="py-10 md:py-14 bg-slate-50/70 border-b border-slate-200 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Compact Header with Slide Arrows */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-3">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-gold-50 border border-gold-200 text-gold-800 text-[11px] font-bold mb-1.5">
              <Users className="w-3 h-3 text-gold-600" />
              <span>นายหน้าแนะนำประจำพื้นที่หาดใหญ่–สงขลา</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-navy-950 tracking-tight">
              ทีมงานที่ปรึกษาอสังหาริมทรัพย์มืออาชีพ
            </h2>
          </div>

          {/* Slider Controls */}
          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-navy-950 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-xs cursor-pointer"
              aria-label="Previous Agent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-navy-950 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-xs cursor-pointer"
              aria-label="Next Agent"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Compact Horizontal Slider / Carousel */}
        <div
          ref={scrollContainerRef}
          className="flex space-x-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-none scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="w-[280px] sm:w-[320px] shrink-0 snap-start bg-white rounded-2xl border border-slate-200/90 hover:border-gold-400/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
            >
              {/* Compact Card Header */}
              <div className="p-4 space-y-3">
                <div className="flex items-center space-x-3">
                  {/* Avatar */}
                  <div className="relative w-14 h-14 rounded-full overflow-hidden shrink-0 border-2 border-gold-300/80 shadow-xs">
                    <Image
                      src={agent.photo_url || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80'}
                      alt={agent.name}
                      fill
                      sizes="56px"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Name & Title */}
                  <div className="overflow-hidden flex-1 min-w-0">
                    <div className="flex items-center space-x-1.5 mb-0.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-navy-950 text-gold-400 shrink-0">
                        {agent.rank || 'นายหน้า'}
                      </span>
                      <div className="flex items-center text-amber-500 text-[11px] font-bold font-mono">
                        <Star className="w-3 h-3 fill-amber-400 mr-0.5" />
                        <span>{agent.rating ? agent.rating.toFixed(1) : '5.0'}</span>
                      </div>
                    </div>
                    <h3 className="text-sm font-black text-navy-950 truncate group-hover:text-gold-600 transition-colors">
                      {agent.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 truncate">
                      {agent.title}
                    </p>
                  </div>
                </div>

                {/* Zone & Specialty Compact Badge */}
                <div className="bg-slate-50 rounded-xl p-2 border border-slate-100 space-y-1 text-[11px]">
                  <div className="flex items-center space-x-1 text-slate-700 truncate">
                    <MapPin className="w-3 h-3 text-gold-600 shrink-0" />
                    <span className="font-bold text-slate-900 truncate">{agent.zone}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    ✨ {agent.specialty}
                  </div>
                </div>

                {/* Mini Stats */}
                <div className="grid grid-cols-2 gap-1.5 text-center text-[10px] text-slate-600">
                  <div className="bg-slate-50/80 py-1 px-1.5 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[9px]">ปิดการขาย</span>
                    <strong className="text-navy-950 font-bold font-mono">{agent.closedDeals || 10}+ เคส</strong>
                  </div>
                  <div className="bg-slate-50/80 py-1 px-1.5 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[9px]">ประสบการณ์</span>
                    <strong className="text-navy-950 font-bold font-mono">{agent.experienceYears || 3} ปี</strong>
                  </div>
                </div>
              </div>

              {/* Compact Footer Actions */}
              <div className="p-3 bg-slate-50/60 border-t border-slate-100 space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <a
                    href={`tel:${agent.phone.replace(/[^0-9]/g, '')}`}
                    className="flex items-center justify-center space-x-1 py-1.5 px-2 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-bold border border-slate-200 transition-colors"
                  >
                    <Phone className="w-3 h-3 text-navy-900" />
                    <span className="truncate">{agent.phone}</span>
                  </a>

                  <a
                    href="https://line.me/R/ti/p/@chantakorn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-1 py-1.5 px-2 rounded-lg bg-[#06C755]/10 hover:bg-[#06C755]/20 text-[#06C755] text-[11px] font-bold border border-[#06C755]/30 transition-colors"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>ทัก LINE</span>
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => handleBookingClick(agent.name)}
                  className="w-full py-2 px-3 rounded-lg bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-[11px] flex items-center justify-center space-x-1 shadow-xs transition-colors cursor-pointer"
                >
                  <Calendar className="w-3 h-3 text-gold-400" />
                  <span>นัดชมทรัพย์กับ {agent.name.split(' ')[0]}</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Slide Indicator Dots */}
        {agents.length > 1 && (
          <div className="flex justify-center items-center space-x-1.5 pt-2">
            {agents.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => scrollToIndex(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  activeIndex === idx ? 'w-5 bg-gold-500' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
