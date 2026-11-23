'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Facebook, MapPin, MessageCircle, Phone, RefreshCw, UserRound, Users } from 'lucide-react';
import type { ExtendedAgent } from '@/data/agents';
import { fetchAgents } from '@/lib/store/agents-store';
import { DEFAULT_OFFICIAL_LINE_URL, formatFacebookUrl, formatLineUrl } from '@/lib/utils';

function AdvisorCard({ agent, compact }: { agent: ExtendedAgent; compact: boolean }) {
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const telephone = agent.phone.trim().replace(/[^\d+]/g, '');
  const hasDirectContact = Boolean(telephone || agent.line_id.trim() || agent.facebook?.trim());

  return (
    <article className={`flex min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-white shadow-xs ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      <div className="flex min-w-0 items-start gap-4">
        <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-navy-50 text-navy-700 ${compact ? 'size-14' : 'size-20'}`}>
          {agent.photo_url && agent.photo_url !== failedPhotoUrl ? (
            <Image
              src={agent.photo_url}
              alt=""
              fill
              sizes={compact ? '56px' : '80px'}
              unoptimized
              referrerPolicy="no-referrer"
              onError={() => setFailedPhotoUrl(agent.photo_url)}
              className="object-cover"
            />
          ) : <UserRound className="h-7 w-7" aria-hidden="true" />}
        </div>
        <div className="min-w-0 pt-1">
          <p className="text-[11px] font-medium text-gold-700">ที่ปรึกษาอสังหาริมทรัพย์</p>
          <h3 className="mt-2 break-words text-base font-bold leading-relaxed text-navy-950">{agent.name}</h3>
          {agent.zone && (
            <p className="mt-2 flex items-start gap-1 text-xs leading-relaxed text-slate-600">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span className={`break-words ${compact ? 'line-clamp-2' : ''}`}>{agent.zone}</span>
            </p>
          )}
        </div>
      </div>
      {!compact && agent.bio && <p className="mt-4 break-words text-xs leading-6 text-slate-500">{agent.bio}</p>}
      {agent.specialty && (
        <p className={`mt-3 break-words text-xs leading-6 text-slate-600 ${compact ? 'line-clamp-2' : ''}`}>
          <span className="font-medium text-navy-950">ดูแลด้าน </span>{agent.specialty}
        </p>
      )}
      <div className={`mt-auto ${compact ? 'pt-3' : 'pt-5'}`}>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {telephone && (
            <a href={`tel:${telephone}`} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-navy-950 hover:bg-slate-50">
              <Phone className="h-3.5 w-3.5 shrink-0 text-gold-600" aria-hidden="true" />
              <span className="break-all">{agent.phone}</span>
            </a>
          )}
          {agent.line_id.trim() && (
            <a href={formatLineUrl(agent.line_id)} target="_blank" rel="noopener noreferrer" aria-label={`ติดต่อ ${agent.name} ผ่าน LINE`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />LINE
            </a>
          )}
          {agent.facebook?.trim() && (
            <a href={formatFacebookUrl(agent.facebook)} target="_blank" rel="noopener noreferrer" aria-label={`Facebook ของ ${agent.name}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-navy-950 hover:bg-slate-50">
              <Facebook className="h-3.5 w-3.5" aria-hidden="true" />Facebook
            </a>
          )}
          {!hasDirectContact && (
            <Link href="/contact" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-navy-950">
              ติดต่อทีมเพื่อนัดหมาย
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export default function AboutTeam({ compact = false }: { compact?: boolean }) {
  const [agents, setAgents] = useState<ExtendedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const revisionRef = useRef(0);
  const loadingArea = useRef<HTMLDivElement>(null);

  const loadAgents = useCallback(async () => {
    const revision = ++revisionRef.current;
    setLoading(true);
    setError(false);
    try {
      const records = await fetchAgents();
      if (revision === revisionRef.current) setAgents(records.filter(agent => agent.name.trim()));
    } catch {
      if (revision === revisionRef.current) setError(true);
    } finally {
      if (revision === revisionRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const area = loadingArea.current;
    let observer: IntersectionObserver | undefined;
    if (compact && area && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer?.disconnect();
        void loadAgents();
      }, { rootMargin: '320px 0px' });
      observer.observe(area);
    } else {
      void loadAgents();
    }

    return () => {
      observer?.disconnect();
      revisionRef.current += 1;
    };
  }, [compact, loadAgents]);

  if (loading) return <div ref={loadingArea} role="status" className="rounded-2xl border border-slate-200 bg-white p-7 text-center text-sm text-slate-500"><RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin text-gold-600 motion-reduce:animate-none" />กำลังโหลดข้อมูลทีมงาน...</div>;
  if (error) return <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center"><p className="text-sm font-semibold text-navy-950">ยังโหลดข้อมูลทีมงานไม่ได้</p><p className="mt-2 text-xs leading-relaxed text-slate-500">ลองใหม่อีกครั้ง หรือติดต่อทีมผ่าน LINE ได้ทันที</p><div className="mt-4 flex flex-wrap justify-center gap-2"><button onClick={() => void loadAgents()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 text-xs font-semibold text-navy-950"><RefreshCw className="h-3.5 w-3.5" />ลองโหลดใหม่</button><a href={DEFAULT_OFFICIAL_LINE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy-950 px-4 text-xs font-semibold text-white"><MessageCircle className="h-3.5 w-3.5 text-gold-300" />ติดต่อผ่าน LINE</a></div></div>;
  if (!agents.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-7 text-center"><Users className="mx-auto mb-3 h-7 w-7 text-slate-300" /><p className="text-sm font-semibold text-navy-950">ยังไม่มีโปรไฟล์ทีมงานที่แสดงบนเว็บไซต์</p><p className="mt-2 text-xs leading-relaxed text-slate-500">ติดต่อ Chantakorn Property เพื่อสอบถามทรัพย์หรือนัดหมายกับทีมได้</p><a href={DEFAULT_OFFICIAL_LINE_URL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-gold-700"><MessageCircle className="h-3.5 w-3.5" />ติดต่อทีมผ่าน LINE</a></div>;
  const displayedAgents = compact ? agents.slice(0, 3) : agents;
  return (
    <div className={`grid gap-4 ${compact ? 'sm:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]' : 'lg:grid-cols-2'}`}>
      {displayedAgents.map(agent => <AdvisorCard key={agent.id} agent={agent} compact={compact} />)}
    </div>
  );
}
