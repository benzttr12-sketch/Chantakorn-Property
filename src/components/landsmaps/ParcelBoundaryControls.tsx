'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, FileUp, Layers, Save, Trash2 } from 'lucide-react';
import {
  EMPTY_PARCEL_BOUNDARIES, ParcelBoundaryCollection, parseParcelBoundaryFile, validateParcelBoundaries,
} from '@/lib/parcel-boundaries';
import { loadLandBoundaries, saveLandBoundaries } from '@/lib/store/land-valuation-store';
import { dataBackend } from '@/lib/backend';

interface Props {
  recordId: string;
  collection: ParcelBoundaryCollection;
  dirty: boolean;
  previewActive: boolean;
  onChange: (collection: ParcelBoundaryCollection) => void;
  onLoaded: (collection: ParcelBoundaryCollection) => void;
  onPreviewChange: (collection: ParcelBoundaryCollection | null) => void;
  onEditingAvailabilityChange: (available: boolean) => void;
}

export default function ParcelBoundaryControls(props: Props) {
  const { recordId, collection, dirty, previewActive } = props;
  const callbacks = useRef(props);
  const alive = useRef(true);
  const dataset = useRef<ParcelBoundaryCollection | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const importingRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [readFailed, setReadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { callbacks.current = props; }, [props]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setReadFailed(false); setNotice(''); setError('');
    callbacks.current.onLoaded(EMPTY_PARCEL_BOUNDARIES);
    loadLandBoundaries(recordId).then(saved => {
      if (active) callbacks.current.onLoaded(saved || EMPTY_PARCEL_BOUNDARIES);
    }).catch(() => {
      if (active) { setReadFailed(true); setError('อ่านแนวเขตที่บันทึกไว้ไม่สำเร็จ กรุณาลองอ่านใหม่ก่อนแก้ไข'); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [recordId, retry]);
  useEffect(() => {
    callbacks.current.onEditingAvailabilityChange(!loading && !readFailed && !saving && !importing && !datasetLoading && !previewActive);
  }, [loading, readFailed, saving, importing, datasetLoading, previewActive]);

  async function importFile(file?: File) {
    if (!file || loading || readFailed || saving || datasetLoading || importingRef.current) return;
    importingRef.current = true;
    setImporting(true);
    setError(''); setNotice('');
    try {
      if (file.size > 512 * 1024) throw new Error('ไฟล์แนวเขตต้องไม่เกิน 512 KB');
      const parsed = parseParcelBoundaryFile(await file.text(), file.name);
      if (!alive.current) return;
      callbacks.current.onPreviewChange(null);
      callbacks.current.onChange(parsed);
      setNotice(`นำเข้า ${parsed.features.length} แปลงจาก ${file.name} แล้ว กรุณาตรวจพิกัดและแหล่งที่มาก่อนบันทึก`);
    } catch (problem) {
      if (alive.current) setError(problem instanceof Error ? problem.message : 'อ่านไฟล์แนวเขตไม่สำเร็จ');
    } finally {
      importingRef.current = false;
      if (alive.current) setImporting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function showOfficialData() {
    if (loading || saving || datasetLoading || importingRef.current) return;
    if (previewActive) { callbacks.current.onPreviewChange(null); return; }
    setDatasetLoading(true); setError(''); setNotice('');
    try {
      if (!dataset.current) {
        const response = await fetch('/data/dol-nam-ron-parcels.geojson');
        if (!response.ok) throw new Error('โหลดชุดข้อมูลเปิดไม่สำเร็จ กรุณาลองใหม่');
        dataset.current = validateParcelBoundaries(await response.json());
      }
      if (alive.current) callbacks.current.onPreviewChange(dataset.current);
    } catch (problem) {
      if (alive.current) setError(problem instanceof Error ? problem.message : 'โหลดชุดข้อมูลเปิดไม่สำเร็จ');
    } finally { if (alive.current) setDatasetLoading(false); }
  }

  async function save() {
    if (loading || readFailed || saving || previewActive || datasetLoading || importingRef.current) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await saveLandBoundaries(recordId, collection);
      if (!alive.current) return;
      callbacks.current.onLoaded(collection);
      setNotice(dataBackend === 'local' ? 'เก็บแนวเขตชั่วคราวระหว่างเปิดเว็บนี้แล้ว ข้อมูลจะหายเมื่อรีเฟรช' : 'บันทึกแนวเขตสำหรับพนักงานแล้ว');
    } catch { if (alive.current) setError('บันทึกแนวเขตไม่สำเร็จ กรุณาตรวจการเข้าสู่ระบบและสิทธิ์ฐานข้อมูล'); }
    finally { if (alive.current) setSaving(false); }
  }

  const disabled = loading || readFailed || saving || importing || datasetLoading;
  return <section className="rounded-2xl border border-red-200 bg-red-50/50 p-4 space-y-3" aria-labelledby="parcel-boundaries-title">
    <h3 id="parcel-boundaries-title" className="flex items-center gap-2 text-sm font-bold text-navy-950"><Layers size={16} className="text-red-600" />แนวเขตแปลงที่ดิน · เส้นแดง</h3>
    <p className="text-xs leading-relaxed text-gray-600">ใช้ปุ่ม “วาดแนวเขต” บนแผนที่เพื่อเพิ่มหลายแปลง หรือนำเข้าไฟล์ GeoJSON พิกัด WGS84 แนวที่วาดเองเป็นร่าง ต้องตรวจกับเอกสารโฉนดก่อนใช้</p>
    <div className="flex flex-wrap gap-2">
      <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-medium ${disabled ? 'pointer-events-none opacity-40' : ''}`}><FileUp size={14} />นำเข้า GeoJSON<input ref={inputRef} type="file" accept=".geojson,.json" disabled={disabled} className="sr-only" aria-label="นำเข้าไฟล์แนวเขต GeoJSON" onChange={event => { void importFile(event.target.files?.[0]); }} /></label>
      <button type="button" disabled={disabled || previewActive || !dirty} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Save size={14} />{saving ? 'กำลังบันทึก…' : 'บันทึกแนวเขต'}</button>
      <button type="button" disabled={disabled || previewActive || collection.features.length === 0} onClick={() => { if (window.confirm('ล้างแนวเขตที่วาดหรือนำเข้าในรายการนี้หรือไม่? กดบันทึกเพื่อยืนยันการเปลี่ยนแปลง')) { callbacks.current.onChange(EMPTY_PARCEL_BOUNDARIES); setNotice('ล้างแนวเขตในแบบร่างแล้ว'); } }} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs disabled:opacity-40"><Trash2 size={14} />ล้างแนวเขต</button>
    </div>
    <p className="text-xs text-gray-500">แนวเขตของรายการนี้ {collection.features.length} แปลง{dirty ? ' · ยังไม่ได้บันทึก' : ''} · {dataBackend === 'local' ? 'เก็บชั่วคราวในหน่วยความจำ ข้อมูลหายเมื่อรีเฟรช' : 'บันทึกส่วนตัวสำหรับพนักงาน'}</p>
    <div className="space-y-2 border-t border-red-200 pt-3">
      <button type="button" disabled={loading || datasetLoading || saving || importing} onClick={() => void showOfficialData()} className="rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-800 disabled:opacity-40">{datasetLoading ? 'กำลังโหลดรูปแปลงจริง…' : previewActive ? 'กลับไปแนวเขตของรายการนี้' : 'ดูรูปแปลงจริงจากข้อมูลเปิดกรมที่ดิน'}</button>
      <p className="text-xs leading-relaxed text-gray-600">ชุดข้อมูลพื้นที่ ต.น้ำร้อน อ.เมืองเพชรบูรณ์ จ.เพชรบูรณ์ เผยแพร่ พ.ศ. 2564 แสดงเฉพาะส่วนที่นำมาจากไฟล์ทางการ ยังไม่ครอบคลุมสงขลาและไม่ใช่ข้อมูลล่าสุดของ LandsMaps</p>
      <a className="inline-flex items-center gap-1 text-xs text-blue-700 underline" href="https://data.go.th/dataset/parcel_phetchaboon" target="_blank" rel="noopener noreferrer">แหล่งข้อมูลกรมที่ดิน / data.go.th <ExternalLink size={12} /></a>
      {previewActive && <p className="rounded-xl bg-white p-2 text-xs font-medium text-red-800">กำลังดูรูปแปลงข้อมูลเปิดในเพชรบูรณ์ หมุดและข้อมูลประเมินของทรัพย์ยังเป็นรายการเดิม</p>}
    </div>
    {loading && <p role="status" className="text-xs text-gray-500">กำลังอ่านแนวเขตที่บันทึกไว้…</p>}
    {importing && <p role="status" className="text-xs text-gray-500">กำลังอ่านไฟล์แนวเขต…</p>}
    {readFailed && <button type="button" onClick={() => setRetry(value => value + 1)} className="text-xs text-blue-700 underline">ลองอ่านแนวเขตอีกครั้ง</button>}
    {notice && <p role="status" className="text-xs text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </section>;
}
