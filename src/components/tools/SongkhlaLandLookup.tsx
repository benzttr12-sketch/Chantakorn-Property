'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, Check, ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, Search } from 'lucide-react';
import { calculateLandEstimate, landSheetKey, loadLandSheet, matchingLandRecords, normalizeLandQuery, type LandIndex, type LandQuery, type LandRecord } from '@/lib/songkhla-land';

const EMPTY: LandQuery = { map1: '', map2: '', map3: '', map4: '', scale: '', landNo: '' };
const format = (value: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 8 }).format(value);
const PAGE_SIZE = 20;
const INPUT = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-navy-950 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-100 sm:text-sm';

export default function SongkhlaLandLookup({ index }: { index: LandIndex }) {
  const [form, setForm] = useState<LandQuery>(EMPTY);
  const [results, setResults] = useState<LandRecord[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<LandRecord | null>(null);
  const [page, setPage] = useState(0);
  const [area, setArea] = useState({ rai: '', ngan: '', wah: '' });
  const request = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const cache = useRef(new Map<string, LandRecord[]>());
  useEffect(() => () => { revision.current++; request.current?.abort(); }, []);
  const map1s = useMemo(() => [...new Set(Object.keys(index.sheets).map(key => key.split('-')[0]))].sort(), [index]);
  const map2s = useMemo(() => [...new Set(Object.keys(index.sheets).filter(key => key.startsWith(form.map1 + '-')).map(key => key.split('-')[1]))].sort(), [index, form.map1]);
  const map3s = useMemo(() => Object.keys(index.sheets).filter(key => key.startsWith(`${form.map1}-${form.map2}-`)).map(key => key.split('-')[2]), [index, form.map1, form.map2]);

  function change(field: keyof LandQuery, value: string) {
    revision.current++; request.current?.abort();
    setBusy(false); setSearched(false); setSelected(null); setResults([]); setError(''); setPage(0);
    setForm(previous => ({ ...previous, [field]: value, ...(field === 'map1' ? { map2: '', map3: '' } : {}), ...(field === 'map2' ? { map3: '' } : {}) }));
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    request.current?.abort();
    const current = ++revision.current;
    const controller = new AbortController(); request.current = controller;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15_000);
    setError(''); setResults([]); setSelected(null); setSearched(false); setBusy(true); setPage(0);
    try {
      const query = normalizeLandQuery(form), key = landSheetKey(query);
      if (!Object.hasOwn(index.sheets, key)) { setSearched(true); return; }
      let rows = cache.current.get(key);
      if (!rows) {
        rows = await loadLandSheet(index, key, controller.signal);
        if (current !== revision.current) return;
        if (cache.current.size >= 3) cache.current.delete(cache.current.keys().next().value!);
        cache.current.set(key, rows);
      }
      if (current !== revision.current) return;
      const matched = matchingLandRecords(rows, query);
      setResults(matched); setSearched(true);
      if (matched.length === 1) setSelected(matched[0]);
    } catch (failure) {
      if (current === revision.current && (timedOut || !controller.signal.aborted))
        setError(timedOut ? 'โหลดข้อมูลนานเกินไป กรุณาลองอีกครั้ง' : failure instanceof Error ? failure.message : 'โหลดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally { clearTimeout(timeout); if (current === revision.current) setBusy(false); }
  }

  const estimate = useMemo(() => {
    if (!selected || !Object.values(area).some(Boolean)) return null;
    try { return { value: calculateLandEstimate(selected.price, area), error: '' }; }
    catch (failure) { return { value: null, error: failure instanceof Error ? failure.message : 'ตรวจสอบพื้นที่อีกครั้ง' }; }
  }, [selected, area]);
  const multiplePrices = new Set(results.map(row => row.price)).size > 1;
  const visible = results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return <div className="space-y-6">
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8" aria-labelledby="land-search-title">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><h2 id="land-search-title" className="text-xl font-semibold text-navy-950">ค้นหาจากเลขระวางและเลขที่ดิน</h2><p className="mt-2 text-sm leading-7 text-slate-600">ดูเลขจากเอกสารที่ดิน ระวางส่วนที่ 4 และมาตราส่วนช่วยแยกผลที่มีเลขซ้ำกัน</p></div>
        <button type="button" className="rounded-full border border-gold-300 px-4 py-2 text-sm font-medium text-gold-800 hover:bg-gold-50" onClick={() => {
          revision.current++; request.current?.abort(); setBusy(false); setResults([]); setSelected(null); setSearched(false); setError('');
          setForm({ map1: '5022', map2: '1', map3: '0000', map4: '003', scale: '5000', landNo: '422' });
        }}>ลองกรอกตัวอย่าง</button>
      </div>
      <form onSubmit={search} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-navy-950">ระวางส่วนที่ 1 <span className="text-gold-700">*</span>
            <select required value={form.map1} onChange={event => change('map1', event.target.value)} className={INPUT}><option value="">เลือกเลข 4 หลัก</option>{map1s.map(value => <option key={value}>{value}</option>)}</select>
          </label>
          <label className="text-sm font-medium text-navy-950">ระวางส่วนที่ 2 <span className="text-gold-700">*</span>
            <select required disabled={!form.map1} value={form.map2} onChange={event => change('map2', event.target.value)} className={`${INPUT} disabled:bg-slate-100`}><option value="">เลือกส่วนที่ 2</option>{map2s.map(value => <option key={value}>{value}</option>)}</select>
          </label>
          <label className="text-sm font-medium text-navy-950">ระวางส่วนที่ 3 <span className="text-gold-700">*</span>
            <input required inputMode="numeric" maxLength={4} list="songkhla-map3" value={form.map3} onChange={event => change('map3', event.target.value)} placeholder="เช่น 0000" className={INPUT} />
            <datalist id="songkhla-map3">{map3s.map(value => <option key={value} value={value} />)}</datalist>
          </label>
          <label className="text-sm font-medium text-navy-950">เลขที่ดิน <span className="text-gold-700">*</span>
            <input required inputMode="numeric" maxLength={8} value={form.landNo} onChange={event => change('landNo', event.target.value)} placeholder="เช่น 422" className={INPUT} />
          </label>
        </div>
        <div className="grid items-end gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium text-navy-950">ระวางส่วนที่ 4 <span className="font-normal text-slate-500">(ถ้าทราบ)</span><input inputMode="numeric" maxLength={3} value={form.map4} onChange={event => change('map4', event.target.value)} placeholder="เช่น 003" className={INPUT} /></label>
          <label className="text-sm font-medium text-navy-950">มาตราส่วน <span className="font-normal text-slate-500">(ถ้าทราบ)</span><select value={form.scale} onChange={event => change('scale', event.target.value)} className={INPUT}><option value="">ทุกมาตราส่วน</option>{index.scales.map(value => <option key={value} value={value}>1:{value}</option>)}</select></label>
          <button disabled={busy} type="submit" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-navy-950 px-6 py-3 font-semibold text-white hover:bg-navy-800 disabled:opacity-60">{busy ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}{busy ? 'กำลังค้นหา…' : 'ค้นหาราคาประเมิน'}</button>
        </div>
        <p className="text-xs leading-6 text-slate-500">เลขที่ดินเป็นคนละช่องกับเลขโฉนด ข้อมูลชุดนี้ค้นหาด้วยเลขที่ดินและระวางเท่านั้น</p>
      </form>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <div role="status" aria-live="polite" className="mt-5 text-sm text-slate-600">{searched ? results.length ? `พบ ${format(results.length)} รายการ` : 'ไม่พบข้อมูลที่ตรงกัน ลองตรวจเลขระวาง เลขที่ดิน หรือค้นหาที่กรมธนารักษ์' : busy ? 'กำลังโหลดเฉพาะระวางที่เลือก' : 'กรอกข้อมูลแล้วกดค้นหาได้โดยไม่ต้องเข้าสู่ระบบ'}</div>
    </section>

    {results.length > 0 && <section aria-labelledby="land-results-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <h2 id="land-results-title" className="text-xl font-semibold text-navy-950">ผลการค้นหา</h2>
      {results.length > 1 && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">{multiplePrices ? 'พบหลายราคาสำหรับข้อมูลที่ค้นหา' : 'พบข้อมูลอ้างอิงมากกว่าหนึ่งรายการ'} โปรดเทียบระวางทุกส่วนและมาตราส่วนกับเอกสาร แล้วเลือกแถวที่ต้องการใช้คำนวณ สามารถตรวจซ้ำกับกรมธนารักษ์ได้</p>}
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {visible.map(row => <button type="button" key={row.sourceRow} aria-pressed={selected?.sourceRow === row.sourceRow} onClick={() => setSelected(row)} className={`rounded-2xl border p-5 text-left transition-colors ${selected?.sourceRow === row.sourceRow ? 'border-gold-500 bg-gold-50' : 'border-slate-200 hover:border-gold-400'}`}>
          <span className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-navy-950">เลขที่ดิน {row.landNo}</span><span className="flex items-center gap-1 text-xs text-gold-800">{selected?.sourceRow === row.sourceRow && <Check size={15} aria-hidden="true" />}{selected?.sourceRow === row.sourceRow ? 'เลือกแล้ว' : 'เลือกข้อมูลนี้'}</span></span>
          <span className="mt-3 block break-words text-xs leading-6 text-slate-600">ระวาง {row.reference.join(' – ')} – {row.map4} · 1:{row.scale}</span>
          <span className="mt-4 block text-2xl font-semibold tabular-nums text-navy-950">{format(row.price)} <span className="text-xs font-normal text-slate-600">บาท/ตร.ว.</span></span>
          <span className="mt-2 block text-[11px] text-slate-500">อ้างอิงแถวที่ {format(row.sourceRow)} ในไฟล์ต้นทาง</span>
        </button>)}
      </div>
      {results.length > PAGE_SIZE && <nav aria-label="หน้าผลการค้นหาที่ดิน" className="mt-5 flex items-center justify-between gap-3 text-sm"><button disabled={page === 0} onClick={() => setPage(previous => previous - 1)} className="flex items-center gap-1 rounded-lg border p-2 disabled:opacity-40"><ChevronLeft size={16} />ก่อนหน้า</button><span>หน้า {page + 1} / {Math.ceil(results.length / PAGE_SIZE)}</span><button disabled={(page + 1) * PAGE_SIZE >= results.length} onClick={() => setPage(previous => previous + 1)} className="flex items-center gap-1 rounded-lg border p-2 disabled:opacity-40">ถัดไป<ChevronRight size={16} /></button></nav>}
    </section>}

    {selected && <section aria-labelledby="land-calculate-title" className="rounded-3xl bg-navy-950 p-5 text-white sm:p-8">
      <h2 id="land-calculate-title" className="flex items-center gap-2 text-xl font-semibold"><Calculator size={22} className="text-gold-400" aria-hidden="true" />คำนวณมูลค่าตามพื้นที่เอกสาร</h2>
      <p className="mt-3 text-sm leading-7 text-slate-300">ใช้ราคาที่เลือก {format(selected.price)} บาท/ตร.ว. คูณพื้นที่ที่คุณกรอก สำหรับที่ดินอย่างเดียว</p>
      <div className="mt-5 grid grid-cols-3 gap-3">{(['rai', 'ngan', 'wah'] as const).map((key, i) => <label key={key} className="text-sm">{['ไร่', 'งาน', 'ตารางวา'][i]}<input inputMode={key === 'wah' ? 'decimal' : 'numeric'} value={area[key]} onChange={event => setArea(previous => ({ ...previous, [key]: event.target.value }))} maxLength={key === 'rai' ? 6 : key === 'ngan' ? 1 : 5} placeholder="0" className="mt-2 w-full rounded-xl border border-navy-700 bg-navy-900 px-3 py-3 text-white focus:border-gold-400 focus:outline-none" /></label>)}</div>
      <div aria-live="polite" className="mt-6">{estimate?.value ? <><p className="text-sm text-slate-300">{format(estimate.value.squareWah)} ตารางวา × {format(selected.price)} บาท</p><p className="mt-2 text-3xl font-semibold text-gold-300">{format(estimate.value.amount)} บาท</p></> : <p className="text-sm text-gold-200">{estimate?.error || 'กรอกพื้นที่เพื่อคำนวณมูลค่าที่ดิน'}</p>}</div>
      <p className="mt-5 text-xs leading-6 text-slate-400">มูลค่าจากข้อมูลชุดนี้เป็นข้อมูลประกอบเบื้องต้น ควรตรวจบัญชีที่มีผลใช้กับกรมธนารักษ์ก่อนทำธุรกรรม ไม่รวมสิ่งปลูกสร้าง ภาษี และค่าธรรมเนียม</p>
    </section>}
    <a href="https://assessprice.treasury.go.th/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-gold-800 underline underline-offset-4">ตรวจข้อมูลที่กรมธนารักษ์<ExternalLink size={15} aria-hidden="true" /></a>
  </div>;
}
