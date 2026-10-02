'use client';

import { fetchStaffApi } from '@/lib/staff-api';
import { apiUrl } from '@/lib/api-url';

import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, Loader2, Check, ExternalLink, Send, MessageCircle, Info, Copy, Globe, RefreshCw, Sparkles, Terminal } from 'lucide-react';
import { dataBackend } from '@/lib/backend';

export default function AdminSettingsPage() {
  const [autoNotify, setAutoNotify] = useState(true);
  const [autoNotifyConsignment, setAutoNotifyConsignment] = useState(true);

  const [saving, setSaving] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [testing, setTesting] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [testWebhookRunning, setTestWebhookRunning] = useState(false);
  const [webhookSimKeyword, setWebhookSimKeyword] = useState('สวัสดี');
  const [webhookTestResult, setWebhookTestResult] = useState<any>(null);

  const [testResult, setTestResult] = useState<{
    success: boolean;
    isRealSent?: boolean;
    message: string;
    shareUrl?: string;
    lineOaUrl?: string;
    error?: string | null;
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Dynamic Webhook URL based on current host
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWebhookUrl(new URL(apiUrl('/api/line/webhook'), window.location.origin).toString());
    }
  }, []);

  // Load config on mount
  useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      try {
        const res = await fetchStaffApi('/api/line/notify');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data.autoNotifyNewProperty !== undefined) setAutoNotify(data.autoNotifyNewProperty);
            if (data.autoNotifyConsignment !== undefined) setAutoNotifyConsignment(data.autoNotifyConsignment);
          }
        }
      } catch (err) {
        console.warn('Could not fetch LINE settings from server:', err);
      } finally {
        if (isMounted) {
          setLoadingConfig(false);
        }
      }
    }
    loadConfig();
    return () => { isMounted = false; };
  }, []);

  const handleCopyWebhookUrl = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 3000);
  };

  const handleSaveLineSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetchStaffApi('/api/line/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_settings',
          autoNotifyNewProperty: autoNotify,
          autoNotifyConsignment: autoNotifyConsignment,
        })
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestMessage = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetchStaffApi('/api/line/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'ทดสอบระบบแจ้งเตือน Chantakorn Property',
          slug: 'test-property',
          price: 3890000,
          status: 'sale',
          district: 'หาดใหญ่',
          subdistrict: 'คอหงส์',
          cover_image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
          agent: {
            name: 'คุณเบนซ์ (แอดมิน Chantakorn)',
            phone: '081-604-0097',
            line_id: '@chantakorn'
          }
        })
      });

      const data = await res.json();
      if (res.ok && data.isRealSent) {
        setTestResult({
          success: true,
          isRealSent: data.isRealSent,
          message: data.message || 'LINE รับคำขอส่งข้อความถึงเจ้าของบัญชีแล้ว',
          error: data.error
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'เกิดข้อผิดพลาดในการส่งข้อความทดสอบ',
          error: data.error
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'ไม่สามารถติดต่อเซิร์ฟเวอร์ระบบแจ้งเตือนได้'
      });
    } finally {
      setTesting(false);
    }
  };

  // Webhook Simulator Test Handler
  const handleTestWebhookSimulator = async () => {
    setTestWebhookRunning(true);
    setWebhookTestResult(null);

    try {
      const mockEvent = {
        events: [
          {
            type: 'message',
            replyToken: 'test_simulated_token_123',
            source: {
              type: 'user',
              userId: 'U_test_admin_user'
            },
            timestamp: Date.now(),
            message: {
              type: 'text',
              id: 'msg_sim_123456',
              text: webhookSimKeyword
            }
          }
        ]
      };

      const res = await fetchStaffApi('/api/line/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-line-simulation': 'true'
        },
        body: JSON.stringify(mockEvent)
      });

      const data = await res.json();
      setWebhookTestResult({
        success: res.ok && data.success === true,
        status: res.status,
        data,
        simulatedKeyword: webhookSimKeyword,
        timestamp: new Date().toLocaleTimeString('th-TH')
      });
    } catch (err: any) {
      setWebhookTestResult({
        success: false,
        status: 'error',
        error: err.message || String(err),
        timestamp: new Date().toLocaleTimeString('th-TH')
      });
    } finally {
      setTestWebhookRunning(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Page Title */}
      <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold text-navy-950">ตั้งค่าระบบและการเชื่อมต่อ LINE OA & Messaging API Webhook</h1>
        <p className="mt-2 text-sm text-brand-muted">
          กำหนดค่าการเชื่อมโยง LINE Official Account (<a href="https://lin.ee/NMSe28T3" target="_blank" rel="noreferrer" className="text-[#06C755] font-bold underline">https://lin.ee/NMSe28T3</a>) และติดตั้ง Webhook เพื่อให้บอทโต้ตอบ ตอบคำถามลูกค้า และส่งการแจ้งเตือนอัตโนมัติ
        </p>
      </div>

      {/* 1. Webhook Endpoint Configuration Banner */}
      <section className="space-y-4 rounded-2xl border-2 border-emerald-400 bg-emerald-50/50 p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-emerald-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#06C755] text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-navy-950">LINE Messaging API Webhook URL</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-200 text-emerald-900 font-bold">
                  ต้องยืนยันการรับข้อความใน LINE
                </span>
              </div>
              <p className="text-xs text-emerald-900 mt-0.5">
                ปลายทางสำหรับรับ Event จาก LINE Platform (ค้นหาทรัพย์, ฝากขาย, ติดต่อนายหน้า, เพิ่มเพื่อน)
              </p>
            </div>
          </div>
        </div>

        {/* Webhook URL Input & Copy button */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-navy-950">
            URL ปลายทางสำหรับตั้งค่าใน LINE Developers Console:
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white border-2 border-emerald-300 rounded-xl px-3.5 py-2.5 text-xs text-navy-950 font-mono font-bold select-all overflow-x-auto shadow-xs">
              {webhookUrl || '/api/line/webhook'}
            </div>
            <button
              type="button"
              onClick={handleCopyWebhookUrl}
              className="px-4 py-2.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 flex-shrink-0"
            >
              {copiedWebhook ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedWebhook ? 'คัดลอกแล้ว!' : 'คัดลอก URL'}</span>
            </button>
          </div>
        </div>

        {/* Setup Steps Guide */}
        <div className="bg-white/90 border border-emerald-200 rounded-xl p-4 text-xs text-gray-800 space-y-2">
          <p className="font-bold text-navy-950 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-[#06C755]" />
            <span>ขั้นตอนการนำ Webhook URL ไปเปิดใช้งานใน LINE Developers:</span>
          </p>
          <ol className="list-decimal list-inside space-y-1 text-gray-700 pl-1 leading-relaxed text-[11px]">
            <li>เข้าสู่ <a href="https://developers.line.biz" target="_blank" rel="noreferrer" className="text-[#06C755] font-bold underline">LINE Developers Console</a> แล้วเลือก Messaging API Channel ของ <strong>@930xzcyi</strong></li>
            <li>ไปที่แท็บ <strong>&quot;Messaging API&quot;</strong> แล้วเลื่อนลงมาที่ส่วน <strong>&quot;Webhook settings&quot;</strong></li>
            <li>วาง URL ด้านบนลงในช่อง <strong>&quot;Webhook URL&quot;</strong> แล้วกดปุ่ม <strong>&quot;Update&quot;</strong></li>
            <li>เปิดใช้งานสวิตช์ <strong>&quot;Use webhook&quot;</strong> ให้เป็น <strong>&quot;Enabled&quot;</strong></li>
            <li>กดปุ่ม <strong>&quot;Verify&quot;</strong> และตรวจว่าได้ <strong>Success</strong></li>
            <li>ส่ง <strong>ดูทรัพย์</strong> จากบัญชี LINE ผู้ใช้ แล้วตรวจว่าได้รับการ์ดทรัพย์และเปิดรายละเอียดได้</li>
          </ol>
        </div>
      </section>

      {/* 2. Webhook Simulator / Test Console */}
      <section className="space-y-4 rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-gold-600" />
            <h2 className="text-base font-bold text-navy-950">ทดสอบจำลองส่งคำสั่ง Webhook (Event Simulator)</h2>
          </div>
          <span className="text-xs text-gray-500 font-medium">จำลองการพิมพ์ข้อความจากลูกค้า LINE OA</span>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-gray-600">
            เลือกหรือพิมพ์ข้อความเพื่อทดสอบการประมวลผลเท่านั้น การจำลองไม่ส่งข้อความเข้า LINE และไม่บันทึกข้อมูลลงกล่องข้อความลูกค้า:
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {['ดูทรัพย์', 'สวัสดี', 'บ้านเดี่ยว หาดใหญ่', 'ที่ดิน สิงหนคร', 'ฝากขายบ้าน', 'ติดต่อแอดมิน', 'ประเมินราคา'].map((keyword) => (
              <button
                key={keyword}
                type="button"
                onClick={() => setWebhookSimKeyword(keyword)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  webhookSimKeyword === keyword
                    ? 'bg-navy-950 text-gold-400 font-bold shadow-xs'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {keyword}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={webhookSimKeyword}
              onChange={(e) => setWebhookSimKeyword(e.target.value)}
              placeholder="พิมพ์ข้อความที่ต้องการทดสอบ..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-navy-950 focus:bg-white focus:ring-2 focus:ring-[#06C755] outline-none"
            />
            <button
              type="button"
              disabled={testWebhookRunning}
              onClick={handleTestWebhookSimulator}
              className="px-5 py-2.5 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
            >
              {testWebhookRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{testWebhookRunning ? 'กำลังประมวลผล...' : 'ทดสอบ Webhook'}</span>
            </button>
          </div>

          {webhookTestResult && (
            <div className="mt-3 p-3.5 bg-gray-900 text-emerald-400 rounded-xl font-mono text-[11px] space-y-1.5 overflow-x-auto shadow-inner">
              <div className="flex items-center justify-between text-gray-400 border-b border-gray-800 pb-1">
                <span>ผลการทดสอบ Webhook (เวลา {webhookTestResult.timestamp})</span>
                <span className={webhookTestResult.success ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                  Status: {webhookTestResult.status} ({webhookTestResult.success ? 'จำลองสำเร็จ' : 'ไม่สำเร็จ'})
                </span>
              </div>
              <pre className="whitespace-pre-wrap">{JSON.stringify(webhookTestResult.data || { error: webhookTestResult.error }, null, 2)}</pre>
            </div>
          )}
        </div>
      </section>

      {/* 3. LINE Credentials Form */}
      <section className="space-y-5 rounded-2xl border border-surface-border bg-white p-6 shadow-sm relative overflow-hidden">
        {/* LINE OA Header Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#06C755] text-white flex items-center justify-center font-bold text-2xl shadow-md flex-shrink-0">
              💬
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-navy-950">LINE Messaging API Credentials</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold flex items-center gap-1.5 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  ระบบพร้อมเชื่อมต่อ
                </span>
              </div>
              <p className="text-xs text-brand-muted mt-0.5">
                LINE OA URL: <a href="https://lin.ee/NMSe28T3" target="_blank" rel="noreferrer" className="text-[#06C755] hover:underline font-bold">https://lin.ee/NMSe28T3</a> · LINE ID: <strong>@chantakorn</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a 
              href="https://lin.ee/NMSe28T3" 
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-2.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>เปิดดู LINE OA (NMSe28T3)</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
          </div>
        </div>

        {/* LINE Notification Settings Form */}
        <form onSubmit={handleSaveLineSettings} className="space-y-4 pt-1">
          <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
            แจ้งเตือนถึง LINE ส่วนตัวของเจ้าของบัญชีที่ตั้งค่าไว้ กดทดสอบเพื่อส่งข้อความจริง หากต้องเปลี่ยนบัญชีหรือผู้รับ ให้ผู้ดูแลปรับค่าใน Cloudflare
          </p>

          {/* Autonotify toggles */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <label className="flex items-center space-x-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoNotify}
                onChange={(e) => setAutoNotify(e.target.checked)}
                className="w-4 h-4 rounded text-[#06C755] focus:ring-[#06C755] cursor-pointer"
              />
              <span className="text-xs font-semibold text-gray-800">
                🔔 แจ้งเตือนเข้า LINE OA อัตโนมัติทันทีที่มีการ <strong>&quot;ลงประกาศทรัพย์ใหม่&quot;</strong> บนเว็บไซต์
              </span>
            </label>

            <label className="flex items-center space-x-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoNotifyConsignment}
                onChange={(e) => setAutoNotifyConsignment(e.target.checked)}
                className="w-4 h-4 rounded text-[#06C755] focus:ring-[#06C755] cursor-pointer"
              />
              <span className="text-xs font-semibold text-gray-800">
                📩 แจ้งเตือนเข้า LINE OA อัตโนมัติเมื่อมีลูกค้า <strong>&quot;ส่งข้อมูลฝากขาย/ติดต่อสอบถาม&quot;</strong> ทางหน้าเว็บ
              </span>
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-gray-100 flex-wrap">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า LINE'}</span>
            </button>

            <button
              type="button"
              disabled={testing}
              onClick={handleSendTestMessage}
              className="px-5 py-2.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Send className="w-3.5 h-3.5" />}
              <span>ทดสอบส่งแจ้งเตือนเด้งเข้า LINE OA</span>
            </button>

            {saveSuccess && (
              <span className="text-xs text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-in fade-in">
                ✓ บันทึกสถานะการแจ้งเตือนแล้ว; LINE credentials ต้องตั้งใน Cloudflare Workers
              </span>
            )}
          </div>
        </form>

        {/* Test Result Display */}
        {testResult && (
          <div className={`p-4 rounded-xl text-xs font-medium border leading-relaxed space-y-2 animate-in fade-in ${
            testResult.success 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : 'bg-red-50 border-red-200 text-red-900'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5">
                {testResult.success ? '✅ ผลการทดสอบแจ้งเตือน:' : '❌ เกิดข้อผิดพลาด:'}
              </span>
              {testResult.isRealSent && (
                <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 text-[10px] rounded-full font-bold">
                  ส่งถึงเจ้าของบัญชี
                </span>
              )}
            </div>
            <p>{testResult.message}</p>

            {testResult.shareUrl && (
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <a
                  href={testResult.shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-current" />
                  <span>กดเพื่อเด้งแชร์เข้าห้องแชท LINE ทันที (1-Click)</span>
                </a>

                <a
                  href={testResult.lineOaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-800 font-bold rounded-lg border border-gray-200 flex items-center gap-1.5"
                >
                  <span>เปิดหน้า LINE Official Account</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Database & System Info */}
      <section className="space-y-4 rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-bold text-navy-950">
          <Database className="h-5 w-5 text-gold-600 flex-shrink-0" />
          <span>ระบบฐานข้อมูลและการบันทึกข้อมูล</span>
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">ฐานข้อมูลหลัก:</span>
          <strong className="text-gray-700 font-bold uppercase">{dataBackend === 'supabase' ? 'Supabase' : 'Firebase Firestore (Cloud Production)'}</strong>
        </div>
        <p className="text-xs leading-relaxed text-gray-500">
          เว็บไซต์เชื่อมต่อและบันทึกข้อมูลแบบเรียลไทม์ผ่านคลาวด์ ป้องกันการสูญหายของข้อมูล ประกาศอสังหาริมทรัพย์ กล่องข้อความผู้ติดต่อ และการตั้งค่า LINE Official Account จะถูกจัดเก็บอย่างปลอดภัย
        </p>
      </section>

      {/* Business Details */}
      <section className="space-y-3 rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-navy-950 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-gold-600" />
          <span>ข้อมูลหน่วยงานเจ้าของลิขสิทธิ์</span>
        </h2>
        <div className="text-xs space-y-1.5 text-gray-700">
          <p><span className="text-gray-400 font-medium">ชื่อโครงการ:</span> <strong>CHANTAKORN PROPERTY (ฉันทากร พร็อพเพอร์ตี้ หาดใหญ่สงขลา)</strong></p>
          <p><span className="text-gray-400 font-medium">โทรศัพท์ผู้บริหาร:</span> <strong>081-604-0097</strong></p>
          <p><span className="text-gray-400 font-medium">ไลน์ออฟฟิเชียล:</span> <strong>@chantakorn (<a href="https://lin.ee/NMSe28T3" target="_blank" rel="noreferrer" className="text-[#06C755] hover:underline">https://lin.ee/NMSe28T3</a>)</strong></p>
        </div>
        <p className="text-xs leading-relaxed text-gray-500 pt-1">
          ระบบควบคุมความปลอดภัย (Access Control) ได้รับการเข้ารหัสและดูแลอย่างเข้มงวด สิทธิ์ผู้ใช้งานทั่วไปจะถูกบล็อกจากการเข้าถึงหน้าควบคุมหลังบ้านโดยอัตโนมัติ
        </p>
      </section>
    </div>
  );
}
