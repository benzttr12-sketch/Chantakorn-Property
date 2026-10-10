'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Check, Copy, Download, ImageIcon, Loader2, Sparkles, Video } from 'lucide-react';
import type { Property } from '@/lib/types';
import { fetchStaffApi } from '@/lib/staff-api';
import { formatPrice, getPropertyTypeName } from '@/lib/utils';

export default function PropertyMediaStudio({ property }: { property: Property | null }) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [style, setStyle] = useState('Modern Luxury');
  const [busy, setBusy] = useState<'generate_video' | 'edit_image' | null>(null);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState('');
  const [copied, setCopied] = useState('');
  const propertyBrief = property
    ? `${property.title}\nประเภท: ${getPropertyTypeName(property.property_type)}\nราคา: ${formatPrice(property.price)}\nทำเล: ${[property.subdistrict, property.district, property.province].filter(Boolean).join(' · ')}`
    : '';
  const videoBrief = `บรีฟวิดีโอประกาศทรัพย์\n${propertyBrief}\nสัดส่วนภาพ: ${aspectRatio}\nโจทย์: ${prompt.trim() || 'นำเสนอรูปและรายละเอียดจริงของทรัพย์ตามลำดับ พร้อมช่องทางติดต่อ'}\nใช้รูปและรายละเอียดของทรัพย์นี้เท่านั้น ไม่เพิ่มสิ่งปลูกสร้างหรือสิ่งอำนวยความสะดวกที่ไม่มีจริง`;
  const imageBrief = `บรีฟเตรียมภาพประกาศ\n${propertyBrief}\nสไตล์: ${style}\nโจทย์: ${prompt.trim() || 'เตรียมภาพให้ดูสะอาด ชัดเจน และสื่อสภาพจริงของทรัพย์'}\nคงสภาพและข้อมูลสำคัญของทรัพย์เดิม หากใช้ภาพตกแต่งจำลองให้ระบุชัดเจน`;

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setError('');
      window.setTimeout(() => setCopied(''), 2500);
    } catch {
      setError('คัดลอกไม่ได้ กรุณาใช้ปุ่มดาวน์โหลดบรีฟแทน');
    }
  }

  function download(text: string, filename: string) {
    const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function generate(action: 'generate_video' | 'edit_image') {
    if (busy || !property) return;
    setBusy(action);
    setError('');
    setPlan('');
    try {
      const response = await fetchStaffApi('/api/ai/property-media-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, prompt: action === 'generate_video' ? videoBrief : imageBrief, aspectRatio, editStyle: style }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || result.outputType !== 'staging_plan' || !result.stagingDescription) {
        throw new Error(result.error || 'ยังเตรียมสื่อไม่ได้ กรุณาลองอีกครั้ง');
      }
      setPlan(result.stagingDescription);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'บริการ AI ยังไม่พร้อม กรุณาใช้บรีฟเพื่อทำงานต่อ');
    } finally {
      setBusy(null);
    }
  }

  const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:opacity-50';

  return (
    <section className="space-y-5" aria-labelledby="media-studio-title">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="mb-2 text-xs font-semibold tracking-wider text-gold-700">สื่อสำหรับประกาศ</p>
            <h2 id="media-studio-title" className="text-2xl font-bold text-navy-950">เตรียมภาพและวิดีโอให้งานไปต่อได้</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">เริ่มจากข้อมูลทรัพย์จริง เตรียมบรีฟให้ทีมผลิตสื่อ หรือให้ AI ช่วยเขียนแผนเตรียมภาพ</p>
          </div>
          {property && <p className="max-w-xs rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-navy-950">{property.title}</p>}
        </div>
        <div className="mt-5">
          <label htmlFor="media-brief" className="mb-2 block text-sm font-semibold text-navy-950">อยากนำเสนอทรัพย์แบบไหน</label>
          <textarea id="media-brief" rows={3} maxLength={2500} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="เช่น เน้นขนาดที่ดิน ทางเข้า และบรรยากาศรอบทรัพย์ ใช้รูปที่อัปโหลดไว้" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20" />
        </div>
        {!property && <p className="mt-3 text-sm text-slate-600" role="status">เพิ่มหรือเลือกทรัพย์ก่อนเตรียมบรีฟสื่อ</p>}
      </div>

      {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <Video className="mb-3 size-6 text-gold-700" aria-hidden="true" />
          <h3 className="text-lg font-bold text-navy-950">บรีฟวิดีโอประกาศ</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">ส่งรายละเอียดให้ช่างภาพหรือทีมตัดต่อได้ทันที บริการสร้างวิดีโอ AI ยังไม่ได้เปิดใช้งาน</p>
          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-semibold text-navy-950">สัดส่วนวิดีโอ</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['16:9', '9:16'] as const).map((ratio) => <button type="button" key={ratio} aria-pressed={aspectRatio === ratio} onClick={() => setAspectRatio(ratio)} className={`${button} ${aspectRatio === ratio ? 'border-navy-950 bg-navy-950 text-white hover:bg-navy-900' : ''}`}>{ratio === '16:9' ? '16:9 แนวนอน' : '9:16 แนวตั้ง'}</button>)}
            </div>
          </fieldset>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={!property} onClick={() => copy(videoBrief, 'video')} className={button}>{copied === 'video' ? <Check className="size-4" /> : <Copy className="size-4" />}คัดลอกบรีฟวิดีโอ</button>
            <button type="button" disabled={!property} onClick={() => download(videoBrief, 'property-video-brief.txt')} className={button}><Download className="size-4" />ดาวน์โหลดบรีฟ</button>
          </div>
          <button type="button" disabled={!!busy || !property} onClick={() => generate('generate_video')} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:opacity-50">{busy === 'generate_video' && <Loader2 className="size-4 animate-spin" />}ตรวจบริการสร้างวิดีโอ AI</button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <ImageIcon className="mb-3 size-6 text-gold-700" aria-hidden="true" />
          <h3 className="text-lg font-bold text-navy-950">แผนเตรียมภาพและการตกแต่ง</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">AI ช่วยเขียนคำแนะนำจากบรีฟที่ให้ ผลลัพธ์เป็นข้อความสำหรับทีมงานนำไปใช้จัดภาพ</p>
          <label htmlFor="media-style" className="mb-2 mt-4 block text-sm font-semibold text-navy-950">สไตล์ภาพ</label>
          <select id="media-style" value={style} onChange={(event) => setStyle(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500">
            <option value="Modern Luxury">โมเดิร์น หรูเรียบ</option>
            <option value="Minimalist Scandinavian">มินิมอล อบอุ่น</option>
            <option value="Contemporary Thai-Bali">ร่วมสมัย ผ่อนคลาย</option>
            <option value="Industrial Loft">ลอฟท์ เรียบเท่</option>
          </select>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={!!busy || !property} onClick={() => generate('edit_image')} className={`${button} border-navy-950 bg-navy-950 text-white hover:bg-navy-900`}>{busy === 'edit_image' ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}ให้ AI ช่วยเขียนแผน</button>
            <button type="button" disabled={!property} onClick={() => download(imageBrief, 'property-image-brief.txt')} className={button}><Download className="size-4" />ดาวน์โหลดบรีฟภาพ</button>
          </div>
        </div>
      </div>

      {plan && <div className="rounded-2xl border border-gold-200 bg-gold-50/50 p-5 sm:p-6" aria-live="polite">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-navy-950">แผนเตรียมภาพจาก AI</h3>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => copy(plan, 'plan')} className={button}>{copied === 'plan' ? <Check className="size-4" /> : <Copy className="size-4" />}คัดลอกแผน</button><button type="button" onClick={() => download(plan, 'property-image-plan.txt')} className={button}><Download className="size-4" />ดาวน์โหลดแผน</button></div>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{plan}</p>
        <p className="mt-4 text-xs leading-5 text-slate-500">คำแนะนำนี้สร้างจากข้อมูลข้อความ รูปทรัพย์ต้นฉบับยังเป็นรูปเดิม</p>
      </div>}

      {property?.images?.[0] && <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-xl"><Image src={property.images[0]} alt={`รูปต้นฉบับ: ${property.title}`} fill sizes="80px" className="object-cover" /></div>
        <div><p className="text-sm font-semibold text-navy-950">รูปทรัพย์ต้นฉบับ</p><p className="mt-1 text-xs leading-5 text-slate-500">ใช้รูปจริงประกอบบรีฟ ไม่มีการแก้ไขหรือสร้างรูปใหม่ในขั้นตอนนี้</p></div>
      </div>}
    </section>
  );
}
