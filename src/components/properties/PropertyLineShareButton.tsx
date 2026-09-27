'use client';

import { useState } from 'react';
import { Check, MessageCircle } from 'lucide-react';

const LINE_OA_URL = 'https://lin.ee/NMSe28T3';

interface PropertyLineShareButtonProps {
  title: string;
  price: string;
  location: string;
}

export default function PropertyLineShareButton({ title, price, location }: PropertyLineShareButtonProps) {
  const [feedback, setFeedback] = useState('');

  const handleShare = async () => {
    const message = [
      `สนใจสอบถามอสังหาฯ: ${title}`,
      `ราคา: ${price}`,
      `ทำเล: ${location}`,
      `รายละเอียด: ${window.location.href}`,
      `LINE Official Account: ${LINE_OA_URL}`,
    ].join('\n');

    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      window.location.assign(`https://line.me/R/share?text=${encodeURIComponent(message)}`);
      return;
    }

    // Open synchronously from the click so desktop popup blockers do not suppress the OA tab.
    window.open(LINE_OA_URL, '_blank', 'noopener,noreferrer');
    try {
      await navigator.clipboard.writeText(message);
      setFeedback('คัดลอกรายละเอียดแล้ว วางข้อความในแชท LINE ได้เลย');
      window.setTimeout(() => setFeedback(''), 4000);
    } catch {
      setFeedback('เปิด LINE แล้ว คัดลอกลิงก์หน้านี้ไปส่งในแชทได้เลย');
      window.setTimeout(() => setFeedback(''), 4000);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleShare}
        className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        aria-label={`แชร์ ${title} ทาง LINE`}
        title="เปิด LINE พร้อมรายละเอียดทรัพย์ให้ตรวจสอบก่อนส่ง"
      >
        {feedback ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />}
        <span>แชร์ทาง LINE</span>
      </button>
      {feedback && <span role="status" className="max-w-56 text-right text-[11px] text-emerald-800">{feedback}</span>}
    </div>
  );
}
