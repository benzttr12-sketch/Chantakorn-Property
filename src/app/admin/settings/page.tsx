'use client';

import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, Loader2, Check, ExternalLink, Send, MessageCircle, Info, Copy, Globe, RefreshCw, Sparkles, Terminal } from 'lucide-react';
import { dataBackend } from '@/lib/backend';

export default function AdminSettingsPage() {
  const [channelId, setChannelId] = useState('2011760874');
  const [lineToken, setLineToken] = useState('');
  const [lineSecret, setLineSecret] = useState('');
  const [lineNotifyToken, setLineNotifyToken] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [autoNotify, setAutoNotify] = useState(true);
  const [autoNotifyConsignment, setAutoNotifyConsignment] = useState(true);
  const [systemConfig, setSystemConfig] = useState<any>(null);

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
      setWebhookUrl(`${window.location.origin}/api/line/webhook`);
    }
  }, []);

  // Load config on mount
  useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      try {
        const res = await fetch('/api/line/notify');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setSystemConfig(data);
            if (data.channelId) setChannelId(data.channelId);
            if (data.channelAccessToken) setLineToken(data.channelAccessToken);
            if (data.channelSecret) setLineSecret(data.channelSecret);
            if (data.targetUserId) setTargetUserId(data.targetUserId);
            if (data.lineNotifyToken) setLineNotifyToken(data.lineNotifyToken);
            if (data.autoNotifyNewProperty !== undefined) setAutoNotify(data.autoNotifyNewProperty);
            if (data.autoNotifyConsignment !== undefined) setAutoNotifyConsignment(data.autoNotifyConsignment);
          }
        }
      } catch (err) {
        console.warn('Could not fetch LINE settings from server:', err);
      } finally {
        if (isMounted) {
          // Check local storage fallback
          if (typeof window !== 'undefined') {
            const localChannelId = localStorage.getItem('line_channel_id');
            const localToken = localStorage.getItem('line_channel_access_token');
            const localSecret = localStorage.getItem('line_channel_secret');
            const localNotify = localStorage.getItem('line_notify_token');
            const localTarget = localStorage.getItem('line_target_user_id');
            if (localChannelId) setChannelId(localChannelId);
            if (localToken) setLineToken(localToken);
            if (localSecret) setLineSecret(localSecret);
            if (localNotify) setLineNotifyToken(localNotify);
            if (localTarget) setTargetUserId(localTarget);
          }
          setLoadingConfig(false);
        }
      }
    }
    loadConfig();
    return () => { isMounted = false; };
  }, []);

  const handleFillDefaultCredentials = () => {
    setChannelId('2011760874');
    setLineSecret('f0bf93dfa53dfdb33c7a81b0b2a80a44');
    setTargetUserId('');
    setSaveSuccess(false);
  };

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
      if (typeof window !== 'undefined') {
        localStorage.setItem('line_channel_id', channelId.trim());
        localStorage.setItem('line_channel_access_token', lineToken.trim());
        localStorage.setItem('line_channel_secret', lineSecret.trim());
        localStorage.setItem('line_notify_token', lineNotifyToken.trim());
        localStorage.setItem('line_target_user_id', targetUserId.trim());
        localStorage.setItem('line_auto_notify', String(autoNotify));
        localStorage.setItem('line_auto_notify_consignment', String(autoNotifyConsignment));
      }

      const res = await fetch('/api/line/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_settings',
          channelId: channelId.trim(),
          channelAccessToken: lineToken.trim(),
          channelSecret: lineSecret.trim(),
          lineNotifyToken: lineNotifyToken.trim(),
          targetUserId: targetUserId.trim(),
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
      const res = await fetch('/api/line/notify', {
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
          cover_image: '/api/properties/sample/image',
          overrideToken: lineToken.trim() || undefined,
          overrideNotifyToken: lineNotifyToken.trim() || undefined,
          overrideTargetId: targetUserId.trim() || undefined,
          agent: {
            name: 'คุณเบนซ์ (แอดมิน Chantakorn)',
            phone: '081-604-0097',
            line_id: '@chantakorn'
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          isRealSent: data.isRealSent,
          message: data.isRealSent 
            ? '🚀 ส่งแจ้งเตือน Flex Message ไปยัง LINE OA จริงสำเร็จเรียบร้อย!' 
            : '✨ ระบบได้ประมวลผลข้อความและสร้างลิงก์แจ้งเตือนด่วนเข้า LINE OA เรียบร้อยแล้ว (สามารถคลิกปุ่มแชร์เข้า LINE ได้ทันที)',
          shareUrl: data.shareUrl,
          lineOaUrl: data.lineOaUrl || 'https://lin.ee/NMSe28T3',
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

  // 1. Webhook Verify Test Handler (Simulates LINE Developers Console Verify Button)
  const handleTestWebhookVerify = async () => {
    setTestWebhookRunning(true);
    setWebhookTestResult(null);

    try {
      const res = await fetch('/api/line/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-line-signature': 'simulated_test_signature'
        },
        body: JSON.stringify({
          destination: 'U93b6e8d9cb5b76f9a9a4a4fda959bd9a',
          events: []
        })
      });

      const data = await res.json();
      setWebhookTestResult({
        type: 'verify_ping',
        status: res.status,
        data,
        isSuccess: res.status === 200 && data.success,
        message: res.status === 200 && data.success
          ? '✅ สัญญาณ Verify ตอบรับ HTTP 200 OK สมบูรณ์! (LINE Developers Console จะแสดง Verified สำเร็จ)'
          : `❌ สัญญาณ Verify ผิดพลาด (HTTP ${res.status})`,
        timestamp: new Date().toLocaleTimeString('th-TH')
      });
    } catch (err: any) {
      setWebhookTestResult({
        type: 'verify_ping',
        status: 'error',
        error: err.message || String(err),
        timestamp: new Date().toLocaleTimeString('th-TH')
      });
    } finally {
      setTestWebhookRunning(false);
    }
  };

  // 2. Webhook Chat Message Simulator Test Handler
  const handleTestWebhookSimulator = async () => {
    setTestWebhookRunning(true);
    setWebhookTestResult(null);

    try {
      const mockEvent = {
        destination: 'U93b6e8d9cb5b76f9a9a4a4fda959bd9a',
        events: [
          {
            type: 'message',
            replyToken: '00000000000000000000000000000000',
            source: {
              type: 'user',
              userId: targetUserId.trim() || 'U_test_admin_user'
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

      const res = await fetch('/api/line/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-line-signature': 'simulated_test_signature'
        },
        body: JSON.stringify(mockEvent)
      });

      const data = await res.json();
      setWebhookTestResult({
        type: 'chat_keyword',
        status: res.status,
        data,
        simulatedKeyword: webhookSimKeyword,
        isSuccess: res.status === 200,
        message: `✅ จำลองข้อความคำค้นหา "${webhookSimKeyword}" สำเร็จ! ระบบประมวลผลการตอบกลับเรียบร้อย`,
        timestamp: new Date().toLocaleTimeString('th-TH')
      });
    } catch (err: any) {
      setWebhookTestResult({
        type: 'chat_keyword',
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
                  พร้อมใช้งาน (Active)
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
            <li>เข้าสู่ <a href="https://developers.line.biz" target="_blank" rel="noreferrer" className="text-[#06C755] font-bold underline">LINE Developers Console</a> แล้วเลือก Messaging API Channel ของ <strong>@chantakorn</strong></li>
            <li>ไปที่แท็บ <strong>&quot;Messaging API&quot;</strong> แล้วเลื่อนลงมาที่ส่วน <strong>&quot;Webhook settings&quot;</strong></li>
            <li>วาง URL ด้านบนลงในช่อง <strong>&quot;Webhook URL&quot;</strong> แล้วกดปุ่ม <strong>&quot;Update&quot;</strong></li>
            <li>เปิดใช้งานสวิตช์ <strong>&quot;Use webhook&quot;</strong> ให้เป็น <strong>&quot;Enabled&quot;</strong></li>
            <li>กดปุ่ม <strong>&quot;Verify&quot;</strong> — ระบบจะตอบรับสถานะ <strong>Success 200 OK</strong> ทันที</li>
          </ol>
        </div>
      </section>

      {/* 2. Webhook Simulator / Test Console */}
      <section className="space-y-4 rounded-2xl border border-surface-border bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-gold-600" />
            <h2 className="text-base font-bold text-navy-950">ทดสอบและตรวจสอบการทำงานของ Webhook (Test & Verify)</h2>
          </div>
          <button
            type="button"
            disabled={testWebhookRunning}
            onClick={handleTestWebhookVerify}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 self-start sm:self-auto"
            title="ส่งคำสั่ง Verify เหมือนปุ่ม Verify ใน LINE Developers Console"
          >
            {testWebhookRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-white" />}
            <span>⚡ ทดสอบส่งคำสั่งเชื่อมต่อ (Verify Webhook)</span>
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-gray-600">
            จำลองการพิมพ์ข้อความจากลูกค้า LINE OA เพื่อตรวจสอบว่าระบบตอบกลับอัตโนมัติ (Flex Message / Carousel) ทำงานได้ถูกต้อง:
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {['สวัสดี', 'บ้านเดี่ยว หาดใหญ่', 'ที่ดิน สิงหนคร', 'ฝากขายบ้าน', 'ติดต่อแอดมิน', 'ประเมินราคา'].map((keyword) => (
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
              <span>{testWebhookRunning ? 'กำลังประมวลผล...' : 'ทดสอบจำลองแชท'}</span>
            </button>
          </div>

          {webhookTestResult && (
            <div className={`mt-3 p-4 rounded-2xl font-mono text-[11px] space-y-2 overflow-x-auto shadow-inner border ${
              webhookTestResult.isSuccess ? 'bg-gray-950 text-emerald-400 border-emerald-500/50' : 'bg-red-950/80 text-red-200 border-red-500/50'
            }`}>
              <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
                <span className="font-sans font-bold">
                  {webhookTestResult.type === 'verify_ping' ? '📡 ผลการทดสอบ Verify Webhook' : '💬 ผลการทดสอบจำลองข้อความแชท'} ({webhookTestResult.timestamp})
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${webhookTestResult.isSuccess ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                  HTTP Status: {webhookTestResult.status}
                </span>
              </div>
              {webhookTestResult.message && (
                <p className="font-sans text-xs font-semibold text-white/90">
                  {webhookTestResult.message}
                </p>
              )}
              <pre className="whitespace-pre-wrap text-[10px] opacity-80">{JSON.stringify(webhookTestResult.data || webhookTestResult.error, null, 2)}</pre>
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
                LINE OA URL: <a href="https://lin.ee/NMSe28T3" target="_blank" rel="noreferrer" className="text-[#06C755] hover:underline font-bold">https://lin.ee/NMSe28T3</a> · LINE Basic ID: <strong>@930xzcyi</strong> (@chantakorn)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleFillDefaultCredentials}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
              title="เติมค่า Channel ID, Channel Secret และ Target User ID เริ่มต้นสำเร็จ"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>⚡ ใช้ค่าพารามิเตอร์ระบบมาตรฐาน (1-Click Presets)</span>
            </button>
            <a 
              href="https://lin.ee/NMSe28T3" 
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-2 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>เปิดดู LINE OA (NMSe28T3)</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
          </div>
        </div>

        {/* User ID Auto-Registration Instructions */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs space-y-2 text-emerald-950">
          <div className="flex items-center gap-2 font-bold text-sm text-[#059669]">
            <Sparkles className="w-4 h-4" />
            <span>วิธีผูกและลงทะเบียนผู้รับการแจ้งเตือนส่วนตัว (Admin LINE User ID Auto-Detection):</span>
          </div>
          <p className="leading-relaxed text-gray-700">
            ระบบสามารถตรวจจับและลงทะเบียนผู้รับแจ้งเตือนส่วนตัวให้อัตโนมัติ โดยที่ไม่ต้องพิมพ์คีย์ User ID เอง:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-semibold">
            <div className="bg-white p-3 rounded-xl border border-emerald-200 text-center space-y-1">
              <span className="block font-bold text-emerald-700 text-xs">ขั้นตอนที่ 1</span>
              <span className="text-[11px] text-gray-700 block">เปิดแชทกับ LINE OA <a href="https://lin.ee/NMSe28T3" target="_blank" rel="noreferrer" className="text-[#06C755] underline font-bold">@930xzcyi</a></span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-200 text-center space-y-1">
              <span className="block font-bold text-emerald-700 text-xs">ขั้นตอนที่ 2</span>
              <span className="text-[11px] text-gray-700 block">พิมพ์คำว่า <code className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded font-bold">#admin</code> หรือ <code className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded font-bold">รับแจ้งเตือน</code></span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-200 text-center space-y-1">
              <span className="block font-bold text-emerald-700 text-xs">ขั้นตอนที่ 3</span>
              <span className="text-[11px] text-gray-700 block">ระบบบันทึก User ID เป็นผู้รับการแจ้งเตือนเด้งส่วนตัวทันที!</span>
            </div>
          </div>
        </div>

        {/* LINE Notification Settings Form */}
        <form onSubmit={handleSaveLineSettings} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-700">
                LINE Channel ID (10 หลัก)
              </label>
              <input
                type="text"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                placeholder="2011760874"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-navy-950 focus:bg-white focus:ring-2 focus:ring-[#06C755] outline-none font-mono"
              />
              <p className="text-[10px] text-gray-500 leading-relaxed">
                * Channel ID จากแท็บ Basic settings
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-700">
                LINE Channel Secret (32 หลัก)
              </label>
              <input
                type="password"
                value={lineSecret}
                onChange={(e) => setLineSecret(e.target.value)}
                placeholder={systemConfig?.maskedSecret ? `คงค่าเดิม (${systemConfig.maskedSecret})` : "วาง Channel Secret"}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-navy-950 focus:bg-white focus:ring-2 focus:ring-[#06C755] outline-none font-mono"
              />
              <p className="text-[10px] text-gray-500 leading-relaxed">
                * ตรวจสอบความถูกต้องปลอดภัยของ Webhook
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-700">
                Channel Access Token (ทางเลือก)
              </label>
              <input
                type="password"
                value={lineToken}
                onChange={(e) => setLineToken(e.target.value)}
                placeholder="เว้นว่างได้ (ระบบต่ออายุอัตโนมัติ)"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-navy-950 focus:bg-white focus:ring-2 focus:ring-[#06C755] outline-none font-mono"
              />
              <p className="text-[10px] text-emerald-600 font-semibold leading-relaxed">
                ✓ ระบบแลกเปลี่ยน Token จาก Channel ID อัตโนมัติ
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-700">
                Target User ID / Group ID (Messaging API Push Target)
              </label>
              <input
                type="text"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder="ระบุ User ID เช่น U123... หรือ Group ID"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-navy-950 focus:bg-white focus:ring-2 focus:ring-[#06C755] outline-none font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-700">
                LINE Notify Token (ทางเลือกสำหรับกลุ่มทีมงาน)
              </label>
              <input
                type="password"
                value={lineNotifyToken}
                onChange={(e) => setLineNotifyToken(e.target.value)}
                placeholder="วาง Token ของ LINE Notify (ถ้ามี)"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-navy-950 focus:bg-white focus:ring-2 focus:ring-[#06C755] outline-none font-mono"
              />
            </div>
          </div>

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
                ✓ บันทึกการตั้งค่าลงระบบเรียบร้อยแล้ว!
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
                  Real API Push / Broadcast
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
