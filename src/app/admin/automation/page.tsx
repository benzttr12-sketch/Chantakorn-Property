'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Sparkles, 
  Share2, 
  Copy, 
  Check, 
  Send, 
  FileText, 
  Printer, 
  Download, 
  TrendingUp, 
  Users, 
  Building2, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Coins, 
  Percent, 
  Calculator, 
  ShieldCheck, 
  ChevronRight, 
  ExternalLink, 
  Phone, 
  MessageCircle, 
  Sliders, 
  Wand2, 
  Zap, 
  Flame, 
  Globe2, 
  Video, 
  RefreshCw,
  Search,
  CheckCheck,
  Clock,
  Calendar,
  CalendarCheck,
  BarChart2,
  Bell,
  Activity
} from 'lucide-react';
import { fetchAdminProperties, fetchInquiries } from '@/lib/store/properties-store';
import { Property, Inquiry } from '@/lib/types';
import { formatPrice, getPropertyTypeName, formatLineUrl } from '@/lib/utils';
import { 
  generateLocalSocialPost, 
  MarketingChannel, 
  MarketingTone, 
  SocialMediaPostResult,
  matchLeadToProperties,
  LeadMatchScore,
  calculatePropertyValuationAndYield,
  ValuationAndYieldResult,
  generateLegalContractDraft,
  ContractType,
  ContractDraftResult,
  getQuickClosingScripts,
  QuickClosingScript
} from '@/lib/automation-engine';
import SocialBestTimeD3Chart from '@/components/admin/SocialBestTimeD3Chart';
import { 
  calculateBestTimeSlot, 
  getCurrentPostingHealth, 
  BestTimeRecommendation 
} from '@/lib/social-engagement-engine';

function AutomationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'marketing';
  const initialPropId = searchParams.get('propertyId') || '';
  const initialInquiryId = searchParams.get('inquiryId') || '';

  const [activeTab, setActiveTab] = useState<'marketing' | 'best_time' | 'leads' | 'valuation' | 'contracts' | 'scripts'>(
    (initialTab as any) || 'marketing'
  );

  const [properties, setProperties] = useState<Property[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected Property for single-property tools
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(initialPropId);
  const selectedProperty = useMemo(() => {
    return properties.find(p => p.id === selectedPropertyId) || properties[0] || null;
  }, [properties, selectedPropertyId]);

  // Selected Inquiry for lead matcher
  const [selectedInquiryId, setSelectedInquiryId] = useState<string>(initialInquiryId);
  const selectedInquiry = useMemo(() => {
    return inquiries.find(i => i.id === selectedInquiryId) || inquiries[0] || null;
  }, [inquiries, selectedInquiryId]);

  // Copy indicator state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Tab 1: Marketing State
  const [selectedChannel, setSelectedChannel] = useState<MarketingChannel>('facebook');
  const [selectedTone, setSelectedTone] = useState<MarketingTone>('hot_deal');
  const [generatedPost, setGeneratedPost] = useState<SocialMediaPostResult | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Best Time State
  const [selectedScheduleSlot, setSelectedScheduleSlot] = useState<{
    dayName: string;
    timeLabel: string;
    hour: number;
    score: number;
  } | null>(null);

  const bestTimeRec = useMemo(() => {
    return calculateBestTimeSlot(selectedProperty, selectedChannel);
  }, [selectedProperty, selectedChannel]);

  const postingHealth = useMemo(() => {
    return getCurrentPostingHealth(selectedChannel, selectedProperty?.property_type);
  }, [selectedChannel, selectedProperty?.property_type]);

  // Tab 4: Contract State
  const [contractType, setContractType] = useState<ContractType>('sale_agreement');
  const [buyerName, setBuyerName] = useState('');
  const [buyerIdCard, setBuyerIdCard] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [depositAmount, setDepositAmount] = useState<number>(50000);
  const [generatedContract, setGeneratedContract] = useState<ContractDraftResult | null>(null);

  // Load Data
  useEffect(() => {
    const load = async () => {
      try {
        const [props, inqs] = await Promise.all([
          fetchAdminProperties(),
          fetchInquiries()
        ]);
        setProperties(props);
        setInquiries(inqs);
        if (initialPropId && props.some(p => p.id === initialPropId)) {
          setSelectedPropertyId(initialPropId);
        } else if (props.length > 0) {
          setSelectedPropertyId(prev => prev || props[0].id);
        }

        if (initialInquiryId && inqs.some(i => i.id === initialInquiryId)) {
          setSelectedInquiryId(initialInquiryId);
        } else if (inqs.length > 0) {
          setSelectedInquiryId(prev => prev || inqs[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'โหลดข้อมูลล้มเหลว');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [initialPropId, initialInquiryId]);

  // Generate marketing post automatically when property, channel or tone changes
  useEffect(() => {
    if (selectedProperty) {
      const result = generateLocalSocialPost(selectedProperty, selectedChannel, selectedTone);
      setGeneratedPost(result);
    }
  }, [selectedProperty, selectedChannel, selectedTone]);

  // Generate contract automatically when inputs change
  useEffect(() => {
    if (selectedProperty) {
      const draft = generateLegalContractDraft(
        selectedProperty,
        contractType,
        buyerName || '..........................................................',
        buyerIdCard || '....................................',
        buyerPhone || '.........................',
        depositAmount || 50000
      );
      setGeneratedContract(draft);
    }
  }, [selectedProperty, contractType, buyerName, buyerIdCard, buyerPhone, depositAmount]);

  const handleCopyText = (text: string, key: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  const handleAiDeepEnhance = async () => {
    if (!selectedProperty) return;
    setIsAiGenerating(true);
    try {
      const res = await fetch('/api/ai/automate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-social-post',
          payload: {
            property: selectedProperty,
            channel: selectedChannel,
            tone: selectedTone,
          },
        }),
      });
      const data = await res.json();
      if (data.success && data.text) {
        setGeneratedPost(prev => ({
          headline: prev?.headline || 'AI Generated Post',
          body: data.text,
          hashtags: prev?.hashtags || [],
          callToAction: prev?.callToAction || '',
          fullPost: data.text,
        }));
      }
    } catch {
      // Fallback already active
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Matched leads calculation
  const matchedLeads: LeadMatchScore[] = useMemo(() => {
    if (!selectedInquiry || properties.length === 0) return [];
    return matchLeadToProperties(selectedInquiry, properties);
  }, [selectedInquiry, properties]);

  // Valuation calculation
  const valuationData: ValuationAndYieldResult | null = useMemo(() => {
    if (!selectedProperty) return null;
    return calculatePropertyValuationAndYield(selectedProperty);
  }, [selectedProperty]);

  // Scripts
  const quickScripts = useMemo(() => {
    return getQuickClosingScripts(selectedProperty || undefined);
  }, [selectedProperty]);

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-gray-600">กำลังเชื่อมต่อศูนย์ระบบอัตโนมัติอัจฉริยะ...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hero Automation Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-950 via-slate-900 to-navy-900 text-white p-6 sm:p-8 shadow-xl border border-navy-800">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-gold-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 -mb-20 w-60 h-60 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-gold-500/20 border border-gold-500/40 text-gold-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-gold-400" />
              <span>AI Automation Super Suite 2.0</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              ศูนย์ระบบอัตโนมัติอัจฉริยะ <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-300 to-amber-500">Chantakorn AI</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              ชุดเครื่องมืออัตโนมัติระดับพระกาฬ ยกระดับการตลาดอสังหาฯ หาดใหญ่–สงขลา 
              ผลิตคอนเทนต์ทุกแพลตฟอร์ม จับคู่ผู้ซื้ออัตโนมัติ ออกสัญญาพร้อมพิมพ์ และวิเคราะห์ผลตอบแทนการลงทุนใน 1 วินาที
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="px-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center">
              <span className="block text-xl font-black text-gold-400">{properties.length}</span>
              <span className="text-[11px] text-gray-300 font-medium">ทรัพย์ในระบบ</span>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center">
              <span className="block text-xl font-black text-emerald-400">{inquiries.length}</span>
              <span className="text-[11px] text-gray-300 font-medium">ผู้ติดต่อ/ฝากขาย</span>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center">
              <span className="block text-xl font-black text-amber-300">5 ใน 1</span>
              <span className="text-[11px] text-gray-300 font-medium">ระบบอัจฉริยะ</span>
            </div>
          </div>
        </div>

        {/* Global Property Selector Bar */}
        <div className="mt-6 pt-5 border-t border-navy-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs text-gray-300">
            <Building2 className="w-4 h-4 text-gold-400 flex-shrink-0" />
            <span className="font-semibold text-white whitespace-nowrap">เลือกทรัพย์ที่ต้องการทำงาน:</span>
          </div>

          <div className="flex-grow max-w-xl">
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-gold-500 shadow-inner"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} — [{getPropertyTypeName(p.property_type)}] {formatPrice(p.price)} บ. ({p.district})
                </option>
              ))}
            </select>
          </div>

          {selectedProperty && (
            <Link
              href={`/properties/${selectedProperty.slug}`}
              target="_blank"
              className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-navy-800 hover:bg-navy-700 text-gold-300 text-xs font-semibold rounded-xl border border-navy-700 transition-colors whitespace-nowrap"
            >
              <span>เปิดดูหน้าเว็บ</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 p-1.5 bg-white rounded-2xl border border-gray-200 shadow-xs">
        <button
          onClick={() => setActiveTab('marketing')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'marketing'
              ? 'bg-navy-950 text-gold-400 shadow-md scale-102'
              : 'text-gray-600 hover:bg-gray-100 hover:text-navy-950'
          }`}
        >
          <Sparkles className="w-4 h-4 text-gold-500" />
          <span>1. ผลิตคอนเทนต์โซเชียล AI</span>
        </button>

        <button
          onClick={() => setActiveTab('best_time')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'best_time'
              ? 'bg-navy-950 text-gold-400 shadow-md scale-102'
              : 'text-gray-600 hover:bg-gray-100 hover:text-navy-950'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-500" />
          <span>2. วิเคราะห์เวลาโพสต์ AI (D3 Heatmap)</span>
        </button>

        <button
          onClick={() => setActiveTab('leads')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'leads'
              ? 'bg-navy-950 text-gold-400 shadow-md scale-102'
              : 'text-gray-600 hover:bg-gray-100 hover:text-navy-950'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-500" />
          <span>3. จับคู่ลูกค้าอัตโนมัติ (Smart Matcher)</span>
        </button>

        <button
          onClick={() => setActiveTab('valuation')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'valuation'
              ? 'bg-navy-950 text-gold-400 shadow-md scale-102'
              : 'text-gray-600 hover:bg-gray-100 hover:text-navy-950'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-blue-500" />
          <span>4. ประเมินราคา & ผลตอบแทน (Yield AI)</span>
        </button>

        <button
          onClick={() => setActiveTab('contracts')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'contracts'
              ? 'bg-navy-950 text-gold-400 shadow-md scale-102'
              : 'text-gray-600 hover:bg-gray-100 hover:text-navy-950'
          }`}
        >
          <FileText className="w-4 h-4 text-amber-500" />
          <span>5. ร่างสัญญา & เอกสารกฎหมาย</span>
        </button>

        <button
          onClick={() => setActiveTab('scripts')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'scripts'
              ? 'bg-navy-950 text-gold-400 shadow-md scale-102'
              : 'text-gray-600 hover:bg-gray-100 hover:text-navy-950'
          }`}
        >
          <MessageCircle className="w-4 h-4 text-rose-500" />
          <span>6. สคริปต์ตอบด่วนปิดการขาย</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SOCIAL MARKETING CONTENT GENERATOR */}
      {/* ========================================================================= */}
      {activeTab === 'marketing' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Settings Panel */}
            <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-gray-200 shadow-xs space-y-5">
              <div className="flex items-center space-x-2 pb-3 border-b border-gray-100">
                <Wand2 className="w-5 h-5 text-gold-600" />
                <h2 className="font-extrabold text-sm text-navy-950">เลือกช่องทาง & โทนเสียง</h2>
              </div>

              {/* Platform Channel Options */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 block">แพลตฟอร์มปลายทาง:</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'facebook', label: 'Facebook / Market', icon: '📘' },
                    { id: 'tiktok', label: 'TikTok / Reels Script', icon: '🎬' },
                    { id: 'line', label: 'LINE OA Broadcast', icon: '💬' },
                    { id: 'instagram', label: 'Instagram Aesthetic', icon: '📸' },
                    { id: 'english', label: 'English (Expat)', icon: '🌍' },
                    { id: 'chinese', label: '中文房产 (Chinese)', icon: '🇨🇳' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedChannel(item.id as MarketingChannel)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold flex items-center space-x-2 transition-all ${
                        selectedChannel === item.id
                          ? 'border-gold-500 bg-gold-50/70 text-navy-950 shadow-xs'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-gray-50/50'
                      }`}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone of Voice */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 block">อารมณ์ & สไตล์การเขียน (Tone):</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'hot_deal', label: '🔥 ดีลเด็ด / ด่วนหลุดจอง', desc: 'กระตุ้นให้ตัดสินใจทันที' },
                    { id: 'luxury', label: '💎 หรูหราพรีเมียม', desc: 'เน้นคุณค่า สไตล์ ระดับสูง' },
                    { id: 'friendly', label: '🏡 เป็นกันเอง อบอุ่น', desc: 'บ้านในฝัน จับต้องง่าย' },
                    { id: 'investor', label: '📈 เชิงลงทุน กำไรสูง', desc: 'เน้น Yield และโอกาสเติบโต' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTone(t.id as MarketingTone)}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        selectedTone === t.id
                          ? 'border-navy-950 bg-navy-950 text-white'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                      }`}
                    >
                      <span className="block text-xs font-bold">{t.label}</span>
                      <span className={`block text-[10px] ${selectedTone === t.id ? 'text-gray-300' : 'text-gray-500'}`}>
                        {t.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Preview of Target Property */}
              {selectedProperty && (
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-2 text-xs">
                  <span className="font-bold text-gray-600 block">ทรัพย์ที่เลือก:</span>
                  <div className="flex items-center space-x-3">
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                      {selectedProperty.cover_image ? (
                        <Image
                          src={selectedProperty.cover_image}
                          alt={selectedProperty.title}
                          fill
                          className="object-cover"
                          unoptimized
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 m-auto text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-navy-950 truncate">{selectedProperty.title}</p>
                      <p className="text-gold-700 font-extrabold">{formatPrice(selectedProperty.price)} บาท</p>
                      <p className="text-[11px] text-gray-500">{selectedProperty.district}, {selectedProperty.province}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Deep Generate Button */}
              <button
                onClick={handleAiDeepEnhance}
                disabled={isAiGenerating}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-navy-950 to-blue-900 hover:from-navy-900 hover:to-blue-800 text-gold-400 font-extrabold text-xs shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                {isAiGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-gold-400" />
                    <span>AI กำลังประพันธ์เนื้อหาการตลาดชั้นยอด...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-gold-400" />
                    <span>✨ ยกระดับคำโฆษณาด้วย Gemini 3.8 AI</span>
                  </>
                )}
              </button>
            </div>

            {/* Result Output Panel */}
            <div className="lg:col-span-8 bg-white p-5 sm:p-6 rounded-3xl border border-gray-200 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
                <div>
                  <span className="text-[11px] font-bold text-gold-700 uppercase tracking-wider block">
                    ผลลัพธ์ข้อความพร้อมใช้งาน (Ready-to-use Content)
                  </span>
                  <h3 className="font-extrabold text-navy-950 text-base">
                    {generatedPost?.headline || 'ข้อความโพสต์โซเชียล'}
                  </h3>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleCopyText(generatedPost?.fullPost || '', 'post')}
                    className="px-4 py-2 rounded-xl bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all active:scale-95"
                  >
                    {copiedKey === 'post' ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-white">คัดลอกสำเร็จ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>คัดลอกข้อความ</span>
                      </>
                    )}
                  </button>

                  <a
                    href={`https://line.me/R/msg/text/?${encodeURIComponent(generatedPost?.fullPost || '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>แชร์ไป LINE</span>
                  </a>
                </div>
              </div>

              {/* AI Best Time Suggestion Badge Box */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-navy-950 via-slate-900 to-navy-900 border border-gold-500/40 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-gold-500/20 text-gold-400 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-gold-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-gold-400">
                        ช่วงเวลาที่ AI แนะนำให้โพสต์ข้อความนี้:
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                        {bestTimeRec.conversionProbability}
                      </span>
                    </div>
                    <p className="text-xs font-black text-white mt-0.5">
                      {selectedScheduleSlot ? `${selectedScheduleSlot.dayName} เวลา ${selectedScheduleSlot.timeLabel}` : `${bestTimeRec.dayName} เวลา ${bestTimeRec.timeLabel}`}
                      <span className="text-gold-300 font-bold ml-2">({bestTimeRec.expectedEngagementMultiplier}x ยอดตอบรับ)</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => {
                      const timeStr = selectedScheduleSlot
                        ? `${selectedScheduleSlot.dayName} เวลา ${selectedScheduleSlot.timeLabel}`
                        : `${bestTimeRec.dayName} เวลา ${bestTimeRec.timeLabel}`;
                      const textWithSchedule = `[⏰ กำหนดการโพสต์แนะนำ: ${timeStr} บน ${selectedChannel.toUpperCase()}]\n\n${generatedPost?.fullPost || ''}`;
                      handleCopyText(textWithSchedule, 'post_with_schedule');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-navy-950 font-black text-xs flex items-center space-x-1 transition-all active:scale-95"
                  >
                    {copiedKey === 'post_with_schedule' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-800" />
                        <span>คัดลอกพร้อมเวลาแล้ว!</span>
                      </>
                    ) : (
                      <>
                        <CalendarCheck className="w-3.5 h-3.5" />
                        <span>คัดลอกพร้อมเวลาแนะนำ</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('best_time')}
                    className="px-3 py-1.5 rounded-xl bg-navy-800 hover:bg-navy-700 text-gold-300 font-bold text-xs border border-navy-700 flex items-center space-x-1"
                  >
                    <span>ดู D3 Analytics</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* The Text Box */}
              <div className="relative">
                <textarea
                  readOnly
                  value={generatedPost?.fullPost || ''}
                  rows={14}
                  className="w-full bg-slate-900 text-slate-100 rounded-2xl p-4 font-mono text-xs leading-relaxed border border-slate-800 focus:outline-none focus:ring-2 focus:ring-gold-500 shadow-inner resize-y"
                />
              </div>

              {/* Quick Tips */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl text-xs text-blue-900 flex items-start space-x-2.5">
                <Zap className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>เคล็ดลับนักขายมือโปร:</strong> โพสต์ในช่วงเวลาที่ D3 Heatmap แสดงสีทอง/เขียว ({bestTimeRec.dayName} เวลา {bestTimeRec.timeLabel}) จะเพิ่มอัตราการคลิกดูทรัพย์และการทักแชทสอบถามค่างวดสูงกว่าเวลาปกติถึง <strong>{bestTimeRec.expectedEngagementMultiplier} เท่า</strong>!
                </p>
              </div>
            </div>
          </div>

          {/* Embedded Interactive D3 Visualization for Real-Time Reference */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-navy-950 flex items-center space-x-2">
                <BarChart2 className="w-4 h-4 text-gold-600" />
                <span>ฮีตแมปความร้อน & สถิติเวลาโพสต์ (D3 Interactive Engagement Heatmap)</span>
              </h3>
              <span className="text-xs text-gray-500">
                ข้อมูลเจาะลึกเฉพาะช่องทาง: <strong className="text-navy-950">{selectedChannel.toUpperCase()}</strong>
              </span>
            </div>

            <SocialBestTimeD3Chart
              property={selectedProperty}
              channel={selectedChannel}
              onSelectTimeSlot={(slot) => setSelectedScheduleSlot(slot)}
              selectedTimeSlot={selectedScheduleSlot ? { day: bestTimeRec.dayIndex, hour: selectedScheduleSlot.hour } : null}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DEDICATED AI BEST TIME TO POST OPTIMIZER & D3 VISUALIZATION */}
      {/* ========================================================================= */}
      {activeTab === 'best_time' && (
        <div className="space-y-6">
          {/* Real-Time Posting Pulse Gauge Banner */}
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-navy-950 via-slate-900 to-navy-900 text-white border border-navy-800 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-gold-500/20 border border-gold-500/30 text-gold-300 text-xs font-bold">
                <Activity className="w-3.5 h-3.5 text-gold-400" />
                <span>Live Real-Time Engagement Monitor (หาดใหญ่-สงขลา)</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                สถานะผู้สนใจอสังหาฯ ขณะนี้: <span className={postingHealth.status === 'hot' ? 'text-emerald-400' : postingHealth.status === 'good' ? 'text-gold-400' : 'text-blue-300'}>{postingHealth.badgeText}</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                {postingHealth.advice}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center min-w-[140px]">
                <span className="block text-2xl font-black text-gold-400">{postingHealth.currentScore}/100</span>
                <span className="text-[11px] text-gray-300 font-medium">ดัชนี Active ตอนนี้</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center min-w-[150px]">
                <span className="block text-sm font-black text-emerald-400">{postingHealth.nextPeakSlot.timeLabel}</span>
                <span className="text-[11px] text-gray-300 font-medium">รอบ Prime Time ถัดไป</span>
              </div>
            </div>
          </div>

          {/* Interactive Channel & Property Filtering Bar */}
          <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Wand2 className="w-5 h-5 text-gold-600 flex-shrink-0" />
              <div>
                <h3 className="font-extrabold text-sm text-navy-950">เลือกช่องทางโซเชียลเพื่อวิเคราะห์เวลา:</h3>
                <p className="text-xs text-gray-500">พฤติกรรมผู้ซื้อและช่วงเวลาเสพสื่อมีความแตกต่างกันในแต่ละแพลตฟอร์ม</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'all', label: 'ทุกช่องทางรวมกัน', icon: '🌐' },
                { id: 'facebook', label: 'Facebook', icon: '📘' },
                { id: 'line', label: 'LINE OA', icon: '💬' },
                { id: 'tiktok', label: 'TikTok / Reels', icon: '🎬' },
                { id: 'instagram', label: 'Instagram', icon: '📸' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedChannel(item.id as MarketingChannel)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                    selectedChannel === item.id
                      ? 'bg-navy-950 text-gold-400 shadow-sm scale-102 font-black'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* D3 Chart Component */}
          <SocialBestTimeD3Chart
            property={selectedProperty}
            channel={selectedChannel}
            onSelectTimeSlot={(slot) => setSelectedScheduleSlot(slot)}
            selectedTimeSlot={selectedScheduleSlot ? { day: bestTimeRec.dayIndex, hour: selectedScheduleSlot.hour } : null}
          />

          {/* Scheduled Action & Workflow Tips */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs space-y-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-gold-600" />
                <h4 className="font-extrabold text-sm text-navy-950">การตั้งเวลาโพสต์อัตโนมัติ (Publishing Strategy)</h4>
              </div>
              <ul className="space-y-2 text-xs text-gray-600 leading-relaxed">
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span><strong>Facebook Meta Business Suite:</strong> เข้าไปที่ Meta Planner แล้วกำหนดเวลาล่วงหน้าตามเวลาที่ D3 แนะนำ</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span><strong>LINE Official Account:</strong> ตั้งเวลาบรอดแคสต์ช่วง 08:30 น. หรือ 12:15 น. เพื่อให้อัตรา Open Rate สูงสุด</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span><strong>TikTok / Shorts:</strong> แนะนำปล่อยคลิประหว่าง 19:30 - 21:45 น. เป็นช่วงที่มีการส่งต่อและคอมเมนต์สูงสุด</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-gold-600" />
                  <h4 className="font-extrabold text-sm text-navy-950">สร้างคอนเทนต์สำหรับรอบเวลานี้</h4>
                </div>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  ใช้ระบบ AI Content Generator สร้างข้อความที่ปรับโทนเสียงและจุดเด่นให้เหมาะกับกลุ่มเป้าหมายที่จะออนไลน์ในรอบเวลานี้โดยเฉพาะ
                </p>
              </div>

              <button
                onClick={() => setActiveTab('marketing')}
                className="w-full py-3 px-4 rounded-xl bg-navy-950 hover:bg-navy-900 text-gold-400 font-extrabold text-xs shadow-md transition-all flex items-center justify-center space-x-2"
              >
                <span>ไปยังเครื่องมือสร้างข้อความโพสต์ AI</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SMART LEAD-PROPERTY MATCHER */}
      {/* ========================================================================= */}
      {activeTab === 'leads' && (
        <div className="space-y-6">
          {/* Header & Selector */}
          <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-extrabold text-sm text-navy-950 flex items-center space-x-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>เลือกลูกค้าเพื่อจับคู่ทรัพย์ที่ใช่ที่สุด:</span>
              </h2>
              <p className="text-xs text-gray-500">
                ระบบคำนวณคะแนนความเข้ากันได้ (Match Score %) โดยวิเคราะห์งบประมาณ, ประเภท, ทำเล, และจำนวนห้อง
              </p>
            </div>

            <div className="w-full md:w-80">
              <select
                value={selectedInquiryId}
                onChange={(e) => setSelectedInquiryId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {inquiries.map((inq) => (
                  <option key={inq.id} value={inq.id}>
                    คุณ {inq.name} ({inq.phone}) — {inq.inquiry_type === 'consignment_sell' ? 'ฝากขาย' : 'ติดต่อสอบถาม'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected Inquiry Details Card */}
          {selectedInquiry && (
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-3xl p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="w-8 h-8 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                    {selectedInquiry.name.charAt(0)}
                  </span>
                  <div>
                    <h3 className="font-black text-emerald-950 text-sm">คุณ {selectedInquiry.name}</h3>
                    <p className="text-[11px] text-emerald-800">
                      เบอร์โทร: <a href={`tel:${selectedInquiry.phone}`} className="underline font-bold">{selectedInquiry.phone}</a>
                      {selectedInquiry.line_id && ` | LINE: ${selectedInquiry.line_id}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <a
                    href={`tel:${selectedInquiry.phone}`}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1 shadow-xs transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>โทรหาลูกค้า</span>
                  </a>
                  {selectedInquiry.line_id && (
                    <a
                      href={formatLineUrl(selectedInquiry.line_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-xs flex items-center space-x-1 shadow-xs transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>ทัก LINE</span>
                    </a>
                  )}
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 text-xs text-gray-700 space-y-1">
                <span className="font-bold text-gray-500 block">ข้อความที่ลูกค้าส่งมา:</span>
                <p className="italic font-medium text-navy-950">
                  &ldquo;{selectedInquiry.message || 'ไม่มีข้อความเพิ่มเติม'}&rdquo;
                </p>
                {selectedInquiry.consignment_details && (
                  <div className="pt-2 mt-2 border-t border-gray-100 flex flex-wrap gap-2 text-[11px]">
                    <span className="bg-gray-100 px-2 py-0.5 rounded-md font-semibold">
                      ประเภท: {selectedInquiry.consignment_details.property_type || '-'}
                    </span>
                    <span className="bg-gray-100 px-2 py-0.5 rounded-md font-semibold">
                      ทำเล: {selectedInquiry.consignment_details.district || '-'}
                    </span>
                    {selectedInquiry.consignment_details.expected_price > 0 && (
                      <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md font-bold">
                        งบประมาณ: {formatPrice(selectedInquiry.consignment_details.expected_price)} บาท
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Matched Properties Ranking List */}
          <div className="space-y-3">
            <h3 className="font-extrabold text-sm text-navy-950 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-gold-500" />
              <span>รายการทรัพย์ที่จับคู่อัตโนมัติ (เรียงจากตรงโจทย์ที่สุด):</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {matchedLeads.slice(0, 6).map((match, idx) => {
                const prop = match.property;
                const isTopMatch = idx === 0;

                return (
                  <div
                    key={prop.id}
                    className={`bg-white rounded-3xl border overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                      isTopMatch ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-gray-200'
                    }`}
                  >
                    <div>
                      {/* Image + Match Badge */}
                      <div className="relative h-40 w-full bg-gray-200">
                        {prop.cover_image ? (
                          <Image
                            src={prop.cover_image}
                            alt={prop.title}
                            fill
                            className="object-cover"
                            unoptimized
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Building2 className="w-10 h-10 m-auto text-gray-400" />
                        )}
                        <div className="absolute top-3 left-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-black shadow-md flex items-center space-x-1 ${
                            match.score >= 85 
                              ? 'bg-emerald-500 text-white' 
                              : match.score >= 70 
                              ? 'bg-amber-500 text-white' 
                              : 'bg-blue-600 text-white'
                          }`}>
                            <Zap className="w-3.5 h-3.5" />
                            <span>ความเข้ากันได้ {match.score}%</span>
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-2.5">
                        <div>
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                            {getPropertyTypeName(prop.property_type)} • {prop.district}
                          </span>
                          <h4 className="font-bold text-navy-950 text-sm leading-snug line-clamp-2">
                            {prop.title}
                          </h4>
                          <p className="text-gold-700 font-extrabold text-base mt-1">
                            {formatPrice(prop.price)} บาท {prop.status === 'rent' ? '/เดือน' : ''}
                          </p>
                        </div>

                        {/* Match Reasons */}
                        <div className="p-2.5 bg-gray-50 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-gray-600 block">ทำไมถึงตรงโจทย์:</span>
                          <ul className="text-[11px] text-gray-700 space-y-0.5">
                            {match.matchingFactors.slice(0, 3).map((f, i) => (
                              <li key={i} className="flex items-start space-x-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                                <span className="line-clamp-1">{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-4 pt-0 space-y-2">
                      <a
                        href={`https://line.me/R/msg/text/?${encodeURIComponent(match.recommendedLinePitch)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>ส่งข้อความแนะนำทาง LINE ทันที</span>
                      </a>

                      <button
                        onClick={() => handleCopyText(match.recommendedLinePitch, `pitch_${prop.id}`)}
                        className="w-full py-1.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs flex items-center justify-center space-x-1 transition-colors"
                      >
                        {copiedKey === `pitch_${prop.id}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>คัดลอกข้อความแล้ว</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-gray-500" />
                            <span>คัดลอกข้อความทักทาย</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AUTO VALUATION & INVESTMENT YIELD */}
      {/* ========================================================================= */}
      {activeTab === 'valuation' && valuationData && (
        <div className="space-y-6">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-gray-500 block">Gross Rental Yield</span>
              <p className="text-2xl sm:text-3xl font-black text-emerald-600">
                {valuationData.rentalYield.grossYieldPercent}%
                <span className="text-xs text-gray-500 font-semibold"> /ปี</span>
              </p>
              <span className="text-[10px] text-gray-500 block">Net Yield ~{valuationData.rentalYield.netYieldPercent}%</span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-gray-500 block">คาดการณ์ค่าเช่า</span>
              <p className="text-2xl sm:text-3xl font-black text-navy-950">
                ~{formatPrice(valuationData.rentalYield.estimatedMonthlyRent)}
                <span className="text-xs text-gray-500 font-semibold"> บ./ด.</span>
              </p>
              <span className="text-[10px] text-gray-500 block">{formatPrice(valuationData.rentalYield.estimatedAnnualRent)} บาท/ปี</span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-gray-500 block">ระยะเวลาคืนทุน (Payback)</span>
              <p className="text-2xl sm:text-3xl font-black text-blue-600">
                ~{valuationData.rentalYield.paybackYears}
                <span className="text-xs text-gray-500 font-semibold"> ปี</span>
              </p>
              <span className="text-[10px] text-gray-500 block">คำนวณจาก Net Rental Yield</span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-gray-500 block">ผ่อนธนาคาร 30 ปี</span>
              <p className="text-2xl sm:text-3xl font-black text-amber-600">
                ~{formatPrice(valuationData.mortgageEstimate.monthlyPayment)}
                <span className="text-xs text-gray-500 font-semibold"> บ./ด.</span>
              </p>
              <span className="text-[10px] text-gray-500 block">ยอดกู้ 90% ดอกเบี้ย ~5.5%</span>
            </div>
          </div>

          {/* Deep Market Analysis Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-white p-5 sm:p-6 rounded-3xl border border-gray-200 shadow-xs space-y-4">
              <h3 className="font-extrabold text-navy-950 text-sm flex items-center space-x-2">
                <Calculator className="w-4 h-4 text-gold-600" />
                <span>การประเมินราคาเทียบค่าเฉลี่ยตลาดหาดใหญ่–สงขลา</span>
              </h3>

              <div className="space-y-3">
                <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/80 flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-600">ราคาเฉลี่ยต่อ ตร.ม. (พื้นที่ใช้สอย):</span>
                  <span className="font-black text-navy-950 text-sm">
                    {valuationData.pricePerSqMeter > 0 ? `${formatPrice(valuationData.pricePerSqMeter)} บ./ตร.ม.` : 'ไม่มีข้อมูล ตร.ม.'}
                  </span>
                </div>

                <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/80 flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-600">ราคาเฉลี่ยต่อ ตร.ว. (ที่ดิน):</span>
                  <span className="font-black text-navy-950 text-sm">
                    {valuationData.pricePerSqWa > 0 ? `${formatPrice(valuationData.pricePerSqWa)} บ./ตร.ว.` : 'ไม่มีข้อมูล ตร.ว.'}
                  </span>
                </div>

                <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/80 flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-600">เกณฑ์อ้างอิงทำเลเดียวกัน:</span>
                  <span className="font-bold text-gray-700">~{formatPrice(valuationData.marketBenchmark.avgPricePerSqMeter)} บ./ตร.ม.</span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1">
                  <span className="font-bold text-amber-900 text-xs block">บทวิเคราะห์ตำแหน่งราคา:</span>
                  <p className="text-xs text-amber-950 leading-relaxed font-semibold">
                    {valuationData.marketBenchmark.positionDescription}
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {valuationData.rentalYield.verdict}
                  </p>
                </div>
              </div>
            </div>

            {/* Mortgage & Financial Readiness */}
            <div className="lg:col-span-6 bg-white p-5 sm:p-6 rounded-3xl border border-gray-200 shadow-xs space-y-4">
              <h3 className="font-extrabold text-navy-950 text-sm flex items-center space-x-2">
                <Coins className="w-4 h-4 text-emerald-600" />
                <span>การวางแผนสินเชื่อธนาคาร (Bank Mortgage Blueprint)</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">ราคาเสนอขายสุทธิ</span>
                  <span className="font-bold text-navy-950">{formatPrice(selectedProperty?.price || 0)} บาท</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">เงินดาวน์แนะนำ (10%)</span>
                  <span className="font-bold text-navy-950">{formatPrice(valuationData.mortgageEstimate.downPayment)} บาท</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">วงเงินกู้ธนาคาร (90%)</span>
                  <span className="font-bold text-emerald-700">{formatPrice(valuationData.mortgageEstimate.loanAmount)} บาท</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">ค่างวดผ่อนชำระต่อเดือน (30 ปี)</span>
                  <span className="font-extrabold text-amber-600 text-sm">~{formatPrice(valuationData.mortgageEstimate.monthlyPayment)} บ./ด.</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">ฐานเงินเดือนขั้นต่ำของผู้กู้</span>
                  <span className="font-bold text-blue-700">~{formatPrice(valuationData.mortgageEstimate.minIncomeRequired)} บ./ด. (กู้ร่วมได้)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Investment Teaser Pitch Card */}
          <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-gold-400 uppercase tracking-wider block">Investor Pitch Card</span>
                <h3 className="font-extrabold text-white text-base">สรุปย่อสำหรับส่งให้นักลงทุน (1-Click Teaser)</h3>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleCopyText(valuationData.investorPitchCard, 'pitch_card')}
                  className="px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-navy-950 font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
                >
                  {copiedKey === 'pitch_card' ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>คัดลอกสำเร็จ!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>คัดลอกส่งลูกค้านักลงทุน</span>
                    </>
                  )}
                </button>

                <a
                  href={`https://line.me/R/msg/text/?${encodeURIComponent(valuationData.investorPitchCard)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>แชร์ LINE</span>
                </a>
              </div>
            </div>

            <pre className="bg-slate-950 p-4 rounded-2xl text-xs font-mono text-gray-200 overflow-x-auto whitespace-pre-wrap leading-relaxed border border-slate-800">
              {valuationData.investorPitchCard}
            </pre>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: LEGAL CONTRACT & DOCUMENT GENERATOR */}
      {/* ========================================================================= */}
      {activeTab === 'contracts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Contract Config Form */}
          <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-gray-200 shadow-xs space-y-4">
            <h3 className="font-extrabold text-navy-950 text-sm flex items-center space-x-2 pb-2 border-b border-gray-100">
              <FileText className="w-4 h-4 text-amber-600" />
              <span>กำหนดข้อมูลสัญญา</span>
            </h3>

            {/* Contract Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block">ประเภทเอกสารสัญญา:</label>
              <select
                value={contractType}
                onChange={(e) => setContractType(e.target.value as ContractType)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="sale_agreement">สัญญาจะซื้อจะขายที่ดินและสิ่งปลูกสร้าง (มาตรฐาน)</option>
                <option value="lease_agreement">สัญญาเช่าอสังหาริมทรัพย์ (Residential Lease)</option>
                <option value="brokerage_exclusive">สัญญาแต่งตั้งตัวแทนนายหน้า (Brokerage)</option>
              </select>
            </div>

            {/* Buyer/Tenant Info */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-gray-700 block">ชื่อ-นามสกุล คู่สัญญา (ผู้จะซื้อ/ผู้เช่า):</label>
                <input
                  type="text"
                  placeholder="เช่น นายสมศักดิ์ สุขใจ"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full mt-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block">เลขบัตรประจำตัวประชาชน:</label>
                <input
                  type="text"
                  placeholder="1-9098-00000-00-0"
                  value={buyerIdCard}
                  onChange={(e) => setBuyerIdCard(e.target.value)}
                  className="w-full mt-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block">เบอร์โทรศัพท์ติดต่อ:</label>
                <input
                  type="text"
                  placeholder="081-234-5678"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="w-full mt-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {contractType === 'sale_agreement' && (
                <div>
                  <label className="text-xs font-semibold text-gray-700 block">เงินวางมัดจำ (บาท):</label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Number(e.target.value))}
                    className="w-full mt-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-950 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-gray-500 mt-0.5 block">
                    คงเหลือจ่ายวันโอน: {formatPrice((selectedProperty?.price || 0) - depositAmount)} บาท
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={() => window.print()}
                className="w-full py-2.5 px-4 rounded-xl bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs flex items-center justify-center space-x-2 shadow-xs transition-colors"
              >
                <Printer className="w-4 h-4 text-gold-400" />
                <span>สั่งพิมพ์สัญญาเป็นกระดาษ A4</span>
              </button>
            </div>
          </div>

          {/* Contract Document Preview */}
          <div className="lg:col-span-8 bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-200">
              <div>
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                  เลขที่เอกสาร: {generatedContract?.contractNumber}
                </span>
                <h3 className="font-extrabold text-navy-950 text-base">
                  {generatedContract?.title}
                </h3>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleCopyText(generatedContract?.content || '', 'contract')}
                  className="px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center space-x-1.5 transition-colors"
                >
                  {copiedKey === 'contract' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>คัดลอกสำเร็จ!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>คัดลอกเนื้อหา</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-xl bg-navy-950 hover:bg-navy-900 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-gold-400" />
                  <span>พิมพ์สัญญา</span>
                </button>
              </div>
            </div>

            {/* Printable A4 Paper Effect */}
            <div className="p-6 bg-amber-50/20 border border-gray-300 rounded-2xl shadow-inner font-serif text-xs text-gray-800 leading-relaxed whitespace-pre-wrap max-h-[600px] overflow-y-auto">
              {generatedContract?.content}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: FAST-CLOSING SCRIPTS BOT */}
      {/* ========================================================================= */}
      {activeTab === 'scripts' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-navy-950 text-sm">
                คลังสคริปต์ตอบกลับด่วนเพื่อปิดการขาย (Instant Closing Scripts)
              </h3>
              <p className="text-xs text-gray-500">
                ข้อมูลชื่อทรัพย์ ราคา ทำเล และเบอร์โทรนายหน้าถูกแทนที่ลงในสคริปต์อัตโนมัติแล้ว พร้อมกดคัดลอกส่งได้ทันที
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickScripts.map((script) => (
              <div
                key={script.id}
                className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs hover:border-navy-900 transition-all flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
                      {script.category}
                    </span>
                    <button
                      onClick={() => handleCopyText(script.recommendedResponse, script.id)}
                      className="px-3 py-1 rounded-xl bg-navy-950 hover:bg-navy-900 text-gold-400 font-bold text-xs flex items-center space-x-1 shadow-xs transition-all active:scale-95"
                    >
                      {copiedKey === script.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-white">คัดลอกแล้ว</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>คัดลอกคำตอบ</span>
                        </>
                      )}
                    </button>
                  </div>

                  <h4 className="font-bold text-navy-950 text-xs">
                    {script.title}
                  </h4>

                  <div className="p-2 bg-gray-50 rounded-xl text-[11px] text-gray-600 italic">
                    &ldquo;{script.customerTrigger}&rdquo;
                  </div>

                  <div className="p-3 bg-slate-900 text-slate-100 rounded-2xl text-xs leading-relaxed font-mono whitespace-pre-wrap">
                    {script.recommendedResponse}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminAutomationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AutomationContent />
    </Suspense>
  );
}
