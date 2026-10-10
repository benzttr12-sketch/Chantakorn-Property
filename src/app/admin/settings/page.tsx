'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, ChevronDown, Copy, Database, Loader2, MessageCircle, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { fetchStaffApi } from '@/lib/staff-api';
import { apiUrl } from '@/lib/api-url';
import { dataBackend } from '@/lib/backend';
import { LinePreferences, saveLinePreferences } from '@/lib/line-admin-settings';

interface LineConfig extends LinePreferences {
  isChannelTokenConfigured: boolean;
  isRecipientConfigured: boolean;
}
interface ConnectionResult {
  ready: boolean;
  message: string;
  checks: Array<{ name: string; ok: boolean; message: string }>;
}
interface SimulationResult {
  success: boolean;
  simulation?: boolean;
  simulatedReplies?: number;
  unavailableSearches?: number;
  errorCodes?: string[];
  error?: string;
}

const oaUrl = 'https://lin.ee/NMSe28T3';

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<LineConfig | null>(null);
  const [preferences, setPreferences] = useState<LinePreferences>({ autoNotifyNewProperty: true, autoNotifyConsignment: true });
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [checking, setChecking] = useState(false);
  const [connection, setConnection] = useState<ConnectionResult | null>(null);
  const [keyword, setKeyword] = useState('ดูทรัพย์');
  const [simulating, setSimulating] = useState(false);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [testConfirmation, setTestConfirmation] = useState(false);
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setConfigError('');
    try {
      const response = await fetchStaffApi('/api/line/notify', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'โหลดการตั้งค่าไม่สำเร็จ');
      const next: LineConfig = {
        isChannelTokenConfigured: result.isChannelTokenConfigured === true,
        isRecipientConfigured: result.isRecipientConfigured === true,
        autoNotifyNewProperty: result.autoNotifyNewProperty !== false,
        autoNotifyConsignment: result.autoNotifyConsignment !== false,
      };
      setConfig(next);
      setPreferences({ autoNotifyNewProperty: next.autoNotifyNewProperty, autoNotifyConsignment: next.autoNotifyConsignment });
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : 'โหลดการตั้งค่าไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setWebhookUrl(new URL(apiUrl('/api/line/webhook'), window.location.origin).toString());
    try {
      for (const key of ['line_channel_access_token', 'line_channel_secret', 'line_notify_token']) localStorage.removeItem(key);
    } catch { /* Legacy credentials are never used as a fallback. */ }
    void loadConfig();
  }, [loadConfig]);

  const dirty = Boolean(config && (preferences.autoNotifyNewProperty !== config.autoNotifyNewProperty || preferences.autoNotifyConsignment !== config.autoNotifyConsignment));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !config || !dirty) return;
    setSaving(true);
    setSaveMessage('');
    setSaveError('');
    const submitted = { ...preferences };
    try {
      await saveLinePreferences(fetchStaffApi, submitted);
      setConfig(previous => previous ? { ...previous, ...submitted } : previous);
      setSaveMessage('บันทึกการแจ้งเตือนแล้ว');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ');
    } finally { setSaving(false); }
  }

  async function copyWebhook() {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
    } catch { setCopyError('คัดลอกไม่สำเร็จ กรุณาเลือกข้อความในช่อง URL แล้วคัดลอก'); }
  }

  async function checkConnection() {
    setChecking(true);
    setConnection(null);
    try {
      const response = await fetchStaffApi('/api/line/diagnostics', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'ตรวจการเชื่อมต่อไม่สำเร็จ');
      setConnection({ ready: result.ready === true, message: result.message, checks: result.checks || [] });
    } catch (error) {
      setConnection({ ready: false, message: error instanceof Error ? error.message : 'ตรวจการเชื่อมต่อไม่สำเร็จ', checks: [] });
    } finally { setChecking(false); }
  }

  async function simulate() {
    if (!keyword.trim() || simulating) return;
    setSimulating(true);
    setSimulation(null);
    try {
      const response = await fetchStaffApi('/api/line/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-line-simulation': 'true' },
        body: JSON.stringify({ events: [{ type: 'message', replyToken: 'test_simulated_token_123', source: { type: 'user', userId: 'U_test_admin_user' }, timestamp: Date.now(), message: { type: 'text', id: 'msg_sim_123456', text: keyword.trim() } }] }),
      });
      const result: SimulationResult = await response.json();
      setSimulation({ ...result, success: response.ok && result.success === true && result.simulation === true });
    } catch (error) {
      setSimulation({ success: false, error: error instanceof Error ? error.message : 'ทดสอบไม่สำเร็จ' });
    } finally { setSimulating(false); }
  }

  async function sendTest() {
    if (sending) return;
    setSending(true);
    setTestResult(null);
    try {
      const response = await fetchStaffApi('/api/line/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTest: true, title: 'ทดสอบระบบแจ้งเตือน Chantakorn Property', slug: 'test-property', price: 3890000, status: 'sale', district: 'หาดใหญ่', subdistrict: 'คอหงส์' }),
      });
      const result = await response.json();
      const success = response.ok && result.isRealSent === true;
      setTestResult({ success, message: success ? 'LINE รับคำขอส่งแล้ว กรุณาตรวจข้อความในบัญชีเจ้าหน้าที่' : result.error || result.message || 'ส่งข้อความทดสอบไม่สำเร็จ' });
    } catch (error) {
      setTestResult({ success: false, message: error instanceof Error ? error.message : 'ส่งข้อความทดสอบไม่สำเร็จ' });
    } finally { setSending(false); setTestConfirmation(false); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold-700">การเชื่อมต่อและการแจ้งเตือน</p><h1 className="text-2xl font-bold text-navy-950 sm:text-3xl">ตั้งค่าระบบ</h1><p className="mt-2 text-sm text-slate-500">ดูสถานะ LINE และเลือกการแจ้งเตือนที่ทีมต้องการ</p></div>
        <a href={oaUrl} target="_blank" rel="noreferrer" className="admin-secondary"><MessageCircle className="h-4 w-4 text-emerald-600" />เปิด LINE OA <ArrowUpRight className="h-4 w-4" /></a>
      </header>

      <section className="overflow-hidden rounded-3xl border border-navy-800 bg-navy-950 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-7">
          <div className="flex items-center gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400"><MessageCircle className="h-6 w-6" /></div><div><h2 className="text-lg font-semibold">Chantakorn Property</h2><p className="mt-1 text-sm text-slate-400">LINE OA · @930xzcyi</p></div></div>
          <button type="button" onClick={checkConnection} disabled={checking} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold-500 px-4 text-sm font-semibold text-navy-950 disabled:opacity-50">{checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{checking ? 'กำลังตรวจ...' : 'ตรวจการเชื่อมต่อ'}</button>
        </div>
        <div className="grid gap-px border-t border-white/10 bg-white/10 sm:grid-cols-2">
          {[['การส่งข้อความ', config?.isChannelTokenConfigured], ['ผู้รับแจ้งเตือนในทีม', config?.isRecipientConfigured]].map(([label, configured]) => <div key={String(label)} className="bg-navy-950 px-5 py-4 sm:px-7"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-sm font-medium">{loading ? 'กำลังโหลด...' : configError ? 'ตรวจสถานะไม่สำเร็จ' : configured ? 'มีการตั้งค่าแล้ว' : 'ยังไม่ได้ตั้งค่า'}</p></div>)}
        </div>
      </section>
      {configError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700"><span>{configError}</span><button type="button" onClick={loadConfig} disabled={loading} className="inline-flex items-center gap-2 font-semibold"><RefreshCw className="h-4 w-4" />ลองใหม่</button></div>}
      {connection && <div role="status" className={`rounded-2xl border p-5 text-sm ${connection.ready ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}><p className="font-semibold">{connection.message}</p><ul className="mt-3 space-y-2">{connection.checks.map(item => <li key={item.name}>{item.ok ? '✓' : '•'} {item.message}</li>)}</ul><p className="mt-4 text-xs">ยืนยันการตอบกลับจริงโดยส่ง “ดูทรัพย์” จาก LINE ของลูกค้า แล้วตรวจว่าได้รับการ์ดทรัพย์</p></div>}

      <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="admin-panel">
          <h2 className="text-lg font-semibold text-navy-950">แจ้งเตือนทีมงาน</h2><p className="mt-2 text-sm leading-relaxed text-slate-500">ส่งถึงบัญชีเจ้าหน้าที่ที่กำหนดไว้ เพื่อให้ทีมติดตามงานใหม่ได้ทันที</p>
          <form onSubmit={save} className="mt-5 space-y-4">
            {[{ key: 'autoNotifyNewProperty' as const, title: 'เมื่อเพิ่มทรัพย์ใหม่', description: 'แจ้งทีมเมื่อมีประกาศใหม่ในระบบ' }, { key: 'autoNotifyConsignment' as const, title: 'เมื่อมีลูกค้าติดต่อหรือฝากขาย', description: 'แจ้งทีมเมื่อได้รับข้อมูลจากลูกค้า' }].map(item => <label key={item.key} className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-slate-200 p-4"><span><span className="block text-sm font-medium text-navy-950">{item.title}</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{item.description}</span></span><input type="checkbox" checked={preferences[item.key]} disabled={!config || loading || saving || Boolean(configError)} onChange={event => { setPreferences(previous => ({ ...previous, [item.key]: event.target.checked })); setSaveMessage(''); }} className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-navy-950 focus:ring-gold-500" /></label>)}
            <button type="submit" disabled={!dirty || saving || loading || Boolean(configError)} className="admin-primary w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{saving ? 'กำลังบันทึก...' : dirty ? 'บันทึกการเปลี่ยนแปลง' : 'บันทึกการแจ้งเตือน'}</button>
            {saveMessage && <p role="status" className="text-sm text-emerald-700">{saveMessage}</p>}{saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
          </form>
        </section>
        <section className="admin-panel">
          <h2 className="text-lg font-semibold text-navy-950">ส่งทรัพย์ให้ลูกค้า</h2><p className="mt-2 text-sm leading-relaxed text-slate-500">เปิดรายการทรัพย์ แล้วกด “ส่ง LINE” เพื่อส่งถึงผู้ติดตาม OA ทั้งหมด คุณจะได้ตรวจการ์ดก่อนยืนยันส่ง</p>
          <Link href="/admin/properties" className="admin-secondary mt-5 w-full">ไปหน้าจัดการทรัพย์<ArrowUpRight className="h-4 w-4" /></Link>
          <div className="mt-5 border-t border-slate-100 pt-5"><p className="text-sm font-medium text-navy-950">ทดสอบแจ้งเตือนทีม</p><p className="mt-1 text-xs leading-relaxed text-slate-500">การทดสอบนี้จะส่งข้อความจริงถึงเจ้าหน้าที่ที่กำหนดไว้</p>{!testConfirmation ? <button type="button" disabled={loading || Boolean(configError) || !config?.isChannelTokenConfigured || !config.isRecipientConfigured} onClick={() => { setTestConfirmation(true); setTestResult(null); }} className="admin-secondary mt-3 w-full"><Send className="h-4 w-4" />ทดสอบส่งถึงเจ้าหน้าที่</button> : <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-600">ยืนยันส่งข้อความทดสอบ 1 ครั้งถึงบัญชีเจ้าหน้าที่?</p><div className="flex flex-wrap gap-2"><button type="button" disabled={sending} onClick={sendTest} className="admin-primary">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}ยืนยันส่ง</button><button type="button" disabled={sending} onClick={() => setTestConfirmation(false)} className="admin-secondary">ยกเลิก</button></div></div>}{testResult && <p role={testResult.success ? 'status' : 'alert'} className={`mt-3 text-sm ${testResult.success ? 'text-emerald-700' : 'text-red-700'}`}>{testResult.message}</p>}</div>
        </section>
      </div>

      <details className="admin-panel group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-navy-950">การเชื่อมต่อขั้นสูงและทดสอบคำสั่ง<ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" /></summary>
        <div className="mt-6 space-y-6">
          <div><label htmlFor="line-webhook-url" className="text-sm font-medium text-navy-950">Webhook URL</label><div className="mt-2 flex flex-wrap gap-2"><input id="line-webhook-url" readOnly value={webhookUrl} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs" /><button type="button" disabled={!webhookUrl} onClick={copyWebhook} className="admin-secondary"><Copy className="h-4 w-4" />{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</button></div>{copyError && <p role="alert" className="mt-2 text-sm text-red-700">{copyError}</p>}<p className="mt-3 text-xs leading-relaxed text-slate-500">นำ URL ไปตั้งใน <a href="https://developers.line.biz/console/" target="_blank" rel="noreferrer" className="font-medium text-navy-950 underline">LINE Developers</a> ที่ Messaging API → Webhook settings แล้วเปิด Use webhook และกด Verify</p></div>
          <div className="border-t border-slate-100 pt-5"><h3 className="text-sm font-semibold text-navy-950">ทดสอบคำสั่งแบบจำลอง</h3><p className="mt-1 text-xs text-slate-500">ตรวจการประมวลผลคำสั่ง โดยไม่ส่งข้อความจริงและไม่บันทึกผู้ติดต่อ</p><div className="mt-3 flex flex-wrap gap-2">{['ดูทรัพย์', 'สวัสดี', 'ฝากขาย', 'ติดต่อ'].map(text => <button type="button" key={text} aria-pressed={keyword === text} onClick={() => setKeyword(text)} className={`rounded-lg border px-3 py-2 text-xs ${keyword === text ? 'border-navy-950 bg-navy-950 text-white' : 'border-slate-200 text-slate-600'}`}>{text}</button>)}</div><label htmlFor="line-simulation-keyword" className="mt-4 block text-xs font-medium text-slate-600">ข้อความที่ต้องการทดสอบ</label><div className="mt-2 flex flex-wrap gap-2"><input id="line-simulation-keyword" value={keyword} onChange={event => setKeyword(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-3 text-sm" /><button type="button" disabled={simulating || !keyword.trim()} onClick={simulate} className="admin-secondary">{simulating && <Loader2 className="h-4 w-4 animate-spin" />}ทดสอบคำสั่ง</button></div>{simulation && <div role="status" className="mt-4 rounded-xl bg-slate-50 p-4 text-sm"><p className="font-medium text-navy-950">{simulation.success && !simulation.unavailableSearches ? 'ประมวลผลคำสั่งจำลองแล้ว' : 'ยังประมวลผลคำสั่งได้ไม่ครบ'}</p><p className="mt-1 text-slate-500">จำลองการตอบ {simulation.simulatedReplies || 0} ข้อความ</p>{simulation.error && <p className="mt-2 text-red-700">{simulation.error}</p>}{Boolean(simulation.unavailableSearches) && <p className="mt-2 text-amber-700">ยังโหลดรายการทรัพย์ไม่ได้ กรุณาตรวจการเชื่อมต่อข้อมูล</p>}<details className="mt-3"><summary className="cursor-pointer text-xs text-slate-500">รายละเอียดผลทดสอบ</summary><pre className="mt-2 whitespace-pre-wrap break-all text-xs text-slate-600">{JSON.stringify(simulation, null, 2)}</pre></details></div>}</div>
          <div className="rounded-2xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">ค่าเชื่อมต่อและผู้รับอยู่บนเซิร์ฟเวอร์ หากต้องเปลี่ยนบัญชี ให้ผู้ดูแลปรับค่าที่ระบบโฮสต์</div>
        </div>
      </details>
      <footer className="flex flex-wrap items-center gap-2 px-1 text-xs text-slate-400"><Database className="h-4 w-4" />ฐานข้อมูล: {dataBackend === 'firebase' ? 'Firebase Firestore' : dataBackend === 'supabase' ? 'Supabase' : 'โหมดข้อมูลในเครื่อง'}<span className="mx-1">·</span>CHANTAKORN PROPERTY</footer>
    </div>
  );
}
