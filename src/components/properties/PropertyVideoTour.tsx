'use client';

import React, { useState } from 'react';
import { 
  Video, 
  Play, 
  ExternalLink, 
  Maximize2, 
  Sparkles,
  Film
} from 'lucide-react';
import { parseVideoUrl } from '@/lib/image-compressor';

interface PropertyVideoTourProps {
  videoUrl: string;
  title: string;
  coverImage?: string;
}

export default function PropertyVideoTour({
  videoUrl,
  title,
  coverImage
}: PropertyVideoTourProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const parsed = parseVideoUrl(videoUrl);

  if (!parsed) return null;

  return (
    <div id="video-tour-section" className="bg-white rounded-3xl p-6 sm:p-8 border border-surface-border shadow-card scroll-mt-24 space-y-5">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center border border-red-200/60 shadow-sm">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-black text-navy-950">
                วิดีโอพาทัวร์อสังหาริมทรัพย์
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700 tracking-wider flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping mr-0.5" />
                Video Tour
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              ชมบรรยากาศและมุมมองของจริงรอบตัวบ้านแบบละเอียด
            </p>
          </div>
        </div>

        {/* Source link */}
        <a
          href={parsed.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold border border-gray-200 transition-colors"
        >
          <span>เปิดดูในต้นฉบับ</span>
          <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
        </a>
      </div>

      {/* Video Player Container (16:9) */}
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-navy-950 border border-navy-900 shadow-inner group">
        {parsed.type === 'youtube' && parsed.embedUrl && (
          <iframe
            src={parsed.embedUrl}
            title={`วิดีโอพาทัวร์ ${title}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full border-0"
          />
        )}

        {parsed.type === 'direct' && (
          <video
            controls
            preload="metadata"
            poster={coverImage}
            className="w-full h-full object-contain bg-black"
          >
            <source src={parsed.url} />
            เบราว์เซอร์ของคุณไม่รองรับการเล่นวิดีโอนี้
          </video>
        )}

        {(parsed.type === 'tiktok' || parsed.type === 'facebook' || parsed.type === 'other') && (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white bg-gradient-to-br from-navy-950 via-slate-900 to-navy-900 space-y-4">
            <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-gold-400 border border-white/20">
              <Video className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-1">
              <h4 className="font-bold text-white text-base">
                วิดีโอบน {parsed.type === 'tiktok' ? 'TikTok' : parsed.type === 'facebook' ? 'Facebook' : 'แพลตฟอร์มภายนอก'}
              </h4>
              <p className="text-xs text-gray-300">
                คลิกปุ่มด้านล่างเพื่อเปิดรับชมวิดีโอพาทัวร์สถานที่จริงผ่านแอปพลิเคชันหรือเว็บต้นทาง
              </p>
            </div>
            <a
              href={parsed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-950 font-bold text-xs rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all"
            >
              <Play className="w-4 h-4 fill-navy-950" />
              <span>เปิดรับชมวิดีโอทันที</span>
            </a>
          </div>
        )}
      </div>

      {/* Feature notice */}
      <div className="flex items-center space-x-2 text-[11px] text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-100">
        <Sparkles className="w-4 h-4 text-gold-600 flex-shrink-0" />
        <span>
          หากต้องการนัดหมายเข้าชมสถานที่จริงร่วมกับนายหน้าผู้ดูแล สามารถส่งข้อความหรือโทรติดต่อได้ที่กล่องด้านข้าง
        </span>
      </div>
    </div>
  );
}
