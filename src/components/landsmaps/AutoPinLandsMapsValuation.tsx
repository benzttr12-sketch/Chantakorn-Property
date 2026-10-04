'use client';

import { useEffect, useRef, useState } from 'react';
import { Calculator, Copy, ExternalLink, MapPin, Save, Search } from 'lucide-react';
import { Property } from '@/lib/types';
import { dataBackend } from '@/lib/backend';
import { fetchAdminProperties } from '@/lib/store/properties-store';
import { loadLandValuation, saveLandValuation } from '@/lib/store/land-valuation-store';
import {
  EMPTY_LAND_VALUATION, LANDSMAPS_URL, TREASURY_APPRAISAL_URL,
  LandValuationInput, validateLandValuation, calculateLandValuation,
  getAskingPriceComparables, isValidCoordinates, sqWahToRaiNganWah,
  raiNganWahToSqWah, buildGoogleMapsUrl,
} from '@/lib/landsmaps';
import ParcelLocationMap from './ParcelLocationMap';

interface Props {
  initialProperty?: Property | null;
  properties?: Property[];
  onSaved?: () => void;
}

const inputClass = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-navy-950 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20 disabled:bg-gray-100';
const money = (value: number | null) => value === null ? 'ยังไม่มีข้อมูล' : `฿${value.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

function TextField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string;
}) {
  return <label className="block space-y-1.5 text-xs font-medium text-gray-600">
    <span>{label}</span>
    <input className={inputClass} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} type={type} maxLength={500} />
  </label>;
}

function fromProperty(property?: Property | null): LandValuationInput {
  const hasCoordinates = property && property.coordinates_available !== false && isValidCoordinates(property.latitude, property.longitude);
  return {
    ...EMPTY_LAND_VALUATION,
    province: typeof property?.province === 'string' ? property.province : '',
    district: typeof property?.district === 'string' ? property.district : '',
    subdistrict: typeof property?.subdistrict === 'string' ? property.subdistrict : '',
    landSizeSqWah: property?.land_size || 0,
    askingPrice: property && property.price > 0 ? property.price : null,
    latitude: hasCoordinates ? property.latitude : null,
    longitude: hasCoordinates ? property.longitude : null,
  };
}

export default function AutoPinLandsMapsValuation({ initialProperty = null, properties, onSaved }: Props) {
  const [catalog, setCatalog] = useState<Property[]>(properties || []);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(initialProperty);
  const [draft, setDraft] = useState<LandValuationInput>(() => fromProperty(initialProperty));
  const [search, setSearch] = useState('');
  const [coordinates, setCoordinates] = useState('');
  const [coordinateError, setCoordinateError] = useState('');
  const [loading, setLoading] = useState(true);
  const [readFailed, setReadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [dirty, setDirty] = useState(false);
  const revision = useRef(0);
  const key = selectedProperty?.id || 'workspace';

  useEffect(() => {
    if (properties?.length) { setCatalog(properties); return; }
    let active = true;
    fetchAdminProperties().then(items => { if (active) setCatalog(items); }).catch(() => {
      if (active) setCatalogError('โหลดรายการทรัพย์ไม่สำเร็จ คุณยังค้นจากเลขโฉนดและพิกัดเองได้');
    });
    return () => { active = false; };
  }, [properties]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setReadFailed(false);
    setError(''); setNotice(''); setDirty(false);
    const base = fromProperty(selectedProperty);
    setDraft(base);
    loadLandValuation(key).then(saved => { if (active && saved) setDraft(saved); }).catch(() => {
      if (active) {
        setReadFailed(true);
        setError('อ่านข้อมูลประเมินที่บันทึกไว้ไม่สำเร็จ กรุณาลองอ่านใหม่ก่อนแก้ไขหรือบันทึก');
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [key, selectedProperty, loadAttempt]);

  function edit<K extends keyof LandValuationInput>(field: K, value: LandValuationInput[K]) {
    revision.current += 1;
    setDraft(previous => ({ ...previous, [field]: value }));
    setDirty(true); setNotice(''); setError('');
  }

  function selectProperty(property: Property | null) {
    if (dirty && !window.confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการเปลี่ยนทรัพย์และเริ่มข้อมูลใหม่หรือไม่?')) return;
    setSelectedProperty(property); setCoordinates(''); setCoordinateError('');
  }

  function setLocation(latitude: number, longitude: number) {
    if (loading || saving || readFailed) return;
    revision.current += 1;
    setDraft(previous => ({ ...previous, latitude, longitude }));
    setDirty(true); setNotice(''); setError(''); setCoordinateError('');
  }

  function pinCoordinates() {
    const match = coordinates.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
    if (!match || !isValidCoordinates(Number(match[1]), Number(match[2]))) {
      setCoordinateError('กรอกละติจูด, ลองจิจูด เช่น 7.1982, 100.5951'); return;
    }
    setLocation(Number(match[1]), Number(match[2]));
  }

  let area = { rai: 0, ngan: 0, sqWah: 0, totalSqMeters: 0 };
  try { area = sqWahToRaiNganWah(draft.landSizeSqWah); } catch { /* Validation below explains an invalid stored area. */ }
  function editArea(part: 'rai' | 'ngan' | 'sqWah', value: string) {
    try {
      edit('landSizeSqWah', raiNganWahToSqWah(
        part === 'rai' ? Number(value) : area.rai,
        part === 'ngan' ? Number(value) : area.ngan,
        part === 'sqWah' ? Number(value) : area.sqWah,
      ));
    } catch { setError('กรอกไร่เป็นจำนวนเต็ม งาน 0–3 และตารางวาตั้งแต่ 0 แต่น้อยกว่า 100'); }
  }
  const filtered = catalog.filter(property => `${property.title} ${property.id} ${property.province} ${property.district}`.toLowerCase().includes(search.toLowerCase()));
  const comparables = getAskingPriceComparables(catalog.filter(property => property.id !== selectedProperty?.id), draft);
  let validated: LandValuationInput | null = null;
  let validationMessage = '';
  try { validated = validateLandValuation(draft); } catch (problem) {
    validationMessage = problem instanceof Error ? problem.message : 'กรุณาตรวจข้อมูลที่กรอก';
  }
  const result = validated ? calculateLandValuation(validated) : null;
  const lookupDetails = [
    'ข้อมูลสำหรับค้นเว็บไซต์กรมที่ดิน / กรมธนารักษ์',
    `จังหวัด: ${draft.province || 'ยังไม่ระบุ'} อำเภอ: ${draft.district || 'ยังไม่ระบุ'} ตำบล: ${draft.subdistrict || 'ยังไม่ระบุ'}`,
    `เลขโฉนด: ${draft.chanoteNo || 'ยังไม่ระบุ'} เลขที่ดิน: ${draft.landNo || 'ยังไม่ระบุ'}`,
    `หน้าสำรวจ: ${draft.surveyPage || 'ยังไม่ระบุ'} ระวาง: ${draft.mapSheet || 'ยังไม่ระบุ'}`,
    `เนื้อที่ที่กรอก: ${draft.landSizeSqWah} ตร.ว.`,
    draft.latitude !== null && draft.longitude !== null ? `พิกัดที่บันทึก: ${draft.latitude}, ${draft.longitude}` : 'ยังไม่ได้ปักหมุด',
  ].join('\n');

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice('คัดลอกแล้ว'); } catch { setError('คัดลอกไม่สำเร็จ กรุณาอนุญาตคลิปบอร์ดในเบราว์เซอร์'); }
  }

  async function save() {
    if (!validated || saving || readFailed) return;
    const savedRevision = revision.current;
    setSaving(true); setError(''); setNotice('');
    try {
      await saveLandValuation(key, validated);
      if (savedRevision === revision.current) setDirty(false);
      setNotice(dataBackend === 'local' ? 'บันทึกในเบราว์เซอร์เครื่องนี้แล้ว' : 'บันทึกข้อมูลประเมินสำหรับพนักงานแล้ว');
      onSaved?.();
    } catch { setError('บันทึกไม่สำเร็จ กรุณาตรวจการเข้าสู่ระบบและสิทธิ์ฐานข้อมูล ข้อมูลยังอยู่ในแบบฟอร์ม'); }
    finally { setSaving(false); }
  }

  function report() {
    if (!result) return;
    copy([
      selectedProperty?.title || 'รายงานประเมินที่ดิน', lookupDetails,
      `อัตราที่ผู้ใช้บันทึกจากเว็บไซต์ทางการ: ${money(draft.appraisalPricePerSqWah)}/ตร.ว.`,
      `ราคาประเมินที่คำนวณ: ${money(result.totalAppraisalValue)}`,
      `รอบบัญชี: ${draft.appraisalPeriod || 'ยังไม่ระบุ'} วันที่ตรวจ: ${draft.appraisalCheckedAt || 'ยังไม่ระบุ'}`,
      `อ้างอิง: ${draft.appraisalReference || 'ยังไม่ระบุ'}`,
      `ราคาเสนอขาย: ${money(draft.askingPrice)}`,
      'ข้อมูลค้นและบันทึกโดยผู้ใช้ ระบบไม่ได้รับรองแนวเขตหรือออกหนังสือรับรองราคาประเมิน',
    ].join('\n\n'));
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-bold text-lg text-navy-950">ดูที่ดินบนแผนที่</h2><p className="mt-1 text-sm text-gray-500">เลือกทรัพย์เพื่อปักหมุดจากพิกัดที่บันทึก หรือคลิกแผนที่และลากหมุดไปตำแหน่งที่ต้องการ</p></div>
      <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs text-blue-800">ค้นข้อมูลผ่านเว็บไซต์ทางการ</span>
    </div>
    {catalogError && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{catalogError}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1.5 text-xs font-medium text-gray-600"><span className="flex gap-1.5 items-center"><Search size={14} />ค้นรายการทรัพย์</span><input className={inputClass} value={search} onChange={event => setSearch(event.target.value)} placeholder="ชื่อทรัพย์ รหัส จังหวัด หรืออำเภอ" /></label>
      <label className="space-y-1.5 text-xs font-medium text-gray-600"><span>เลือกทรัพย์เพื่อปักหมุด</span><select className={inputClass} value={selectedProperty?.id || ''} disabled={loading || saving} onChange={event => selectProperty(catalog.find(item => item.id === event.target.value) || null)}>
        <option value="">ค้นและประเมินแปลงอื่น</option>
        {selectedProperty && !filtered.some(item => item.id === selectedProperty.id) && <option value={selectedProperty.id}>{selectedProperty.title}</option>}
        {filtered.map(property => <option key={property.id} value={property.id}>{property.title} · {property.district}</option>)}
      </select></label>
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
      <div className="min-w-0 space-y-3">
        <ParcelLocationMap latitude={draft.latitude} longitude={draft.longitude} properties={catalog} selectedPropertyId={selectedProperty?.id} onPropertySelect={property => { if (!loading && !saving) selectProperty(property); }} onLocationChange={!loading && !saving && !readFailed ? setLocation : undefined} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex-1"><span className="sr-only">พิกัดละติจูดและลองจิจูด</span><input className={inputClass} value={coordinates} onChange={event => { setCoordinates(event.target.value); setCoordinateError(''); }} placeholder="วางพิกัด เช่น 7.1982, 100.5951" /></label>
          <button type="button" onClick={pinCoordinates} disabled={loading || saving || readFailed} className="inline-flex justify-center items-center gap-2 rounded-xl bg-navy-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"><MapPin size={16} />ปักหมุดพิกัด</button>
        </div>
        {coordinateError && <p role="alert" className="text-xs text-red-600">{coordinateError}</p>}
        <p className="text-xs text-gray-500">{draft.latitude !== null && draft.longitude !== null ? `หมุดปัจจุบัน: ${draft.latitude.toFixed(6)}, ${draft.longitude.toFixed(6)}` : 'ยังไม่มีหมุดที่ดิน — ตำแหน่งเริ่มต้นแผนที่เป็นเพียงพื้นที่ดูแผนที่'}</p>
        {draft.latitude !== null && draft.longitude !== null && <a href={buildGoogleMapsUrl(draft.latitude, draft.longitude) || undefined} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-700 underline">เปิดพิกัดใน Google Maps <ExternalLink size={12} /></a>}
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 space-y-3">
          <h3 className="font-bold text-sm text-navy-950">ดูรูปแปลงโฉนดจริงและค้นราคาประเมิน</h3>
          <p className="text-xs leading-relaxed text-gray-600">คัดลอกข้อมูลด้านขวา แล้วค้นจังหวัด อำเภอ และเลขโฉนดในเว็บกรมที่ดิน เปิดเว็บธนารักษ์เพื่อดูราคาประเมินของแปลงเดียวกัน จากนั้นนำอัตราและแหล่งอ้างอิงกลับมาบันทึกด้านล่าง</p>
          <div className="flex flex-wrap gap-2">
            <a className="inline-flex items-center gap-2 rounded-xl bg-navy-950 px-4 py-2.5 text-xs font-bold text-white" href={LANDSMAPS_URL} target="_blank" rel="noopener noreferrer">ดูแปลงจริงใน LandsMaps <ExternalLink size={14} /></a>
            <a className="inline-flex items-center gap-2 rounded-xl border border-gold-500 bg-white px-4 py-2.5 text-xs font-bold text-navy-950" href={TREASURY_APPRAISAL_URL} target="_blank" rel="noopener noreferrer">ค้นราคาประเมินธนารักษ์ <ExternalLink size={14} /></a>
            <a className="inline-flex items-center gap-1 text-xs text-blue-700 underline" href="https://assessprice.treasury.go.th/assessprice/assessprice_manual.pdf" target="_blank" rel="noopener noreferrer">คู่มือค้นราคาประเมิน <ExternalLink size={12} /></a>
            <button type="button" onClick={() => copy(lookupDetails)} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-xs"><Copy size={14} />คัดลอกข้อมูลค้น</button>
          </div>
          <p className="text-xs text-blue-800">รูปแปลงจริงเปิดในเว็บไซต์กรมที่ดิน แผนที่ในหน้านี้แสดงตำแหน่งและภาพพื้นที่ ไม่ใช้เป็นหลักฐานแนวเขตโฉนด</p>
        </div>
      </div>
      <div className="min-w-0 space-y-4">
        <fieldset disabled={loading || saving || readFailed} className="space-y-4 disabled:opacity-60">
          <div className="rounded-2xl border border-gray-200 p-4 space-y-3">
            <h3 className="text-sm font-bold text-navy-950">ข้อมูลค้นโฉนด</h3>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="จังหวัด" value={draft.province} onChange={value => edit('province', value)} />
              <TextField label="อำเภอ / เขต" value={draft.district} onChange={value => edit('district', value)} />
              <TextField label="ตำบล / แขวง" value={draft.subdistrict} onChange={value => edit('subdistrict', value)} />
              <TextField label="เลขที่โฉนด" value={draft.chanoteNo} onChange={value => edit('chanoteNo', value)} />
              <TextField label="เลขที่ดิน" value={draft.landNo} onChange={value => edit('landNo', value)} />
              <TextField label="หน้าสำรวจ" value={draft.surveyPage} onChange={value => edit('surveyPage', value)} />
            </div>
            <TextField label="ระวาง" value={draft.mapSheet} onChange={value => edit('mapSheet', value)} />
            <div><p className="mb-1.5 text-xs font-medium text-gray-600">เนื้อที่จากโฉนด / ข้อมูลที่ตรวจสอบ</p><div className="grid grid-cols-3 gap-2">
              {(['rai', 'ngan', 'sqWah'] as const).map((part, index) => <label key={part} className="text-xs text-gray-500"><span>{['ไร่', 'งาน', 'ตารางวา'][index]}</span><input className={`${inputClass} mt-1`} type="number" min="0" step={part === 'sqWah' ? '0.01' : '1'} max={part === 'ngan' ? '3' : part === 'sqWah' ? '99.99' : undefined} value={part === 'sqWah' ? Number(area[part].toFixed(4)) : area[part]} onChange={event => editArea(part, event.target.value)} /></label>)}
            </div><p className="mt-2 text-xs text-gray-500">รวม {draft.landSizeSqWah.toLocaleString('th-TH', { maximumFractionDigits: 2 })} ตร.ว. · {(draft.landSizeSqWah * 4).toLocaleString('th-TH', { maximumFractionDigits: 2 })} ตร.ม.</p></div>
          </div>
          <div className="rounded-2xl border border-gold-500/30 bg-gold-500/5 p-4 space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-navy-950"><Calculator size={16} />คำนวณจากราคาที่ค้นได้</h3>
            <label className="block space-y-1.5 text-xs text-gray-600"><span>ราคาประเมินธนารักษ์ (บาท / ตร.ว.)</span><input className={inputClass} type="number" min="0.01" step="0.01" value={draft.appraisalPricePerSqWah ?? ''} placeholder="กรอกอัตราของแปลงนี้จากเว็บทางการ" onChange={event => edit('appraisalPricePerSqWah', event.target.value === '' ? null : Number(event.target.value))} /></label>
            <TextField label="รอบบัญชีราคาประเมิน" value={draft.appraisalPeriod} placeholder="กรอกตามผลค้น เช่น พ.ศ. 2566–2569" onChange={value => edit('appraisalPeriod', value)} />
            <TextField label="วันที่ตรวจข้อมูล" type="date" value={draft.appraisalCheckedAt} onChange={value => edit('appraisalCheckedAt', value)} />
            <TextField label="อ้างอิงผลค้น / เลขเอกสาร" value={draft.appraisalReference} placeholder="รายละเอียดที่ระบุแปลงและผลค้นได้" onChange={value => edit('appraisalReference', value)} />
            <label className="block space-y-1.5 text-xs text-gray-600"><span>ราคาเสนอขายเพื่อเปรียบเทียบ (บาท)</span><input className={inputClass} type="number" min="0" step="1" value={draft.askingPrice ?? ''} onChange={event => edit('askingPrice', event.target.value === '' ? null : Number(event.target.value))} /></label>
          </div>
        </fieldset>
        <div className="rounded-2xl bg-navy-950 p-4 text-white space-y-3">
          <div><p className="text-xs text-white/65">ราคาประเมินที่ดินที่คำนวณ · ไม่รวมสิ่งปลูกสร้าง</p><p className="mt-1 text-2xl font-bold text-gold-300" data-testid="appraisal-total">{money(result?.totalAppraisalValue ?? null)}</p></div>
          <p className="text-xs text-white/70">เนื้อที่ × อัตราที่ผู้ใช้บันทึกจากผลค้น ไม่ใช่หนังสือรับรองราคาประเมิน</p>
          {result?.differencePercentage !== null && result?.differencePercentage !== undefined && <p className="text-xs">ราคาเสนอขาย{result.differencePercentage >= 0 ? 'สูงกว่า' : 'ต่ำกว่า'}ราคาประเมิน {Math.abs(result.differencePercentage).toFixed(2)}%</p>}
          {result?.standardTransferFee !== null && result?.standardTransferFee !== undefined && <p className="text-xs text-white/70">ค่าธรรมเนียมโอนอัตราปกติ 2% ประมาณ {money(result.standardTransferFee)} · ยังไม่รวมภาษีและสิทธิ์ลดค่าธรรมเนียม ต้องตรวจยอดกับสำนักงานที่ดิน</p>}
        </div>
        {comparables.count > 0 && <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">ราคาเสนอขายที่ดินในอำเภอเดียวกัน {comparables.count} รายการ: ค่ากลาง {money(comparables.medianPricePerSqWah)}/ตร.ว. · คิดตามเนื้อที่นี้ {money(comparables.estimatedTotal)}<p className="mt-1 text-gray-500">เป็นราคาเสนอขายในระบบ ไม่ใช่ราคาซื้อขายจริงหรือราคาประเมินราชการ</p></div>}
        {loading ? <p role="status" className="text-xs text-gray-500">กำลังอ่านข้อมูลที่บันทึกไว้…</p> : validationMessage && <p className="text-xs text-amber-800">{validationMessage}</p>}
        <div className="flex gap-2">
          <button type="button" disabled={!validated || loading || saving || readFailed} onClick={save} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold-500 px-3 py-3 text-sm font-bold text-navy-950 disabled:opacity-40"><Save size={16} />{saving ? 'กำลังบันทึก…' : 'บันทึกข้อมูลประเมิน'}</button>
          <button type="button" disabled={!result || loading || readFailed} onClick={report} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 text-xs disabled:opacity-40"><Copy size={14} />รายงาน</button>
        </div>
        <p className="text-xs text-gray-500">{dataBackend === 'local' ? 'ข้อมูลบันทึกเฉพาะเบราว์เซอร์เครื่องนี้' : 'ข้อมูลโฉนดและผลประเมินบันทึกสำหรับพนักงาน ไม่แสดงในหน้าประกาศสาธารณะ'}</p>
      </div>
    </div>
    {readFailed && <button type="button" onClick={() => setLoadAttempt(value => value + 1)} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold">ลองอ่านข้อมูลที่บันทึกไว้อีกครั้ง</button>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </div>;
}
