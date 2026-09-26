'use client';

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Building2, 
  MessageSquare, 
  ShieldCheck, 
  Users, 
  Sparkles, 
  Clock, 
  RefreshCw, 
  Search, 
  Filter, 
  UserCircle, 
  ChevronRight,
  CheckCircle2,
  Tag,
  Calendar
} from 'lucide-react';
import { SystemActivity, SystemActivityCategory } from '@/lib/types';
import { fetchSystemActivities } from '@/lib/store/activity-store';
import { formatThaiDate } from '@/lib/utils';

export default function SystemActivityFeed() {
  const [activities, setActivities] = useState<SystemActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<'all' | SystemActivityCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const data = await fetchSystemActivities(30);
      setActivities(data);
    } catch (err) {
      console.error('Failed to load activity feed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadActivities();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const getRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) return 'เมื่อสักครู่นี้';
      if (diffMinutes < 60) return `${diffMinutes} นาทีที่แล้ว`;
      if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
      if (diffDays === 1) return 'เมื่อวานนี้';
      if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
      return formatThaiDate(isoString);
    } catch {
      return isoString;
    }
  };

  const filtered = activities.filter((act) => {
    if (categoryFilter !== 'all' && act.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        act.title.toLowerCase().includes(q) ||
        act.description.toLowerCase().includes(q) ||
        (act.target_name && act.target_name.toLowerCase().includes(q)) ||
        (act.actor_name && act.actor_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getCategoryBadge = (category: SystemActivityCategory) => {
    switch (category) {
      case 'property':
        return {
          label: 'ทรัพย์อสังหาฯ',
          color: 'bg-amber-100 text-amber-900 border-amber-300',
          icon: <Building2 className="w-3.5 h-3.5 text-amber-700" />,
          nodeBg: 'bg-amber-500 text-white ring-amber-200'
        };
      case 'inquiry':
        return {
          label: 'ผู้ติดต่อ/ฝากขาย',
          color: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          icon: <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />,
          nodeBg: 'bg-emerald-600 text-white ring-emerald-200'
        };
      case 'user_role':
        return {
          label: 'สิทธิ์สมาชิก',
          color: 'bg-blue-100 text-blue-900 border-blue-300',
          icon: <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />,
          nodeBg: 'bg-navy-900 text-gold-400 ring-blue-200'
        };
      case 'system':
      default:
        return {
          label: 'ระบบอัตโนมัติ',
          color: 'bg-purple-100 text-purple-900 border-purple-300',
          icon: <Sparkles className="w-3.5 h-3.5 text-purple-700" />,
          nodeBg: 'bg-purple-600 text-white ring-purple-200'
        };
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-surface-border shadow-card p-6 sm:p-7 space-y-6">
      {/* Feed Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-navy-950 to-blue-900 text-gold-400 flex items-center justify-center font-bold shadow-md border border-gold-500/30 flex-shrink-0">
            <Activity className="w-5 h-5 text-gold-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-extrabold text-navy-950">
                System Activity Feed
              </h2>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              ไทม์ไลน์บันทึกกิจกรรมสำคัญของระบบ (เพิ่มทรัพย์ใหม่, เปลี่ยนสถานะผู้ติดต่อ, อัปเดตสิทธิ์ผู้ใช้)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isRefreshing || loading}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-navy-950 text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer border border-gray-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-navy-800 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'กำลังอัปเดต...' : 'รีเฟรชไทม์ไลน์'}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all flex-shrink-0 cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-navy-950 text-gold-400 shadow-xs'
                : 'bg-white text-gray-600 hover:bg-gray-200/70 border border-gray-200'
            }`}
          >
            <span>ทั้งหมด</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-extrabold">
              {activities.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter('property')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all flex-shrink-0 cursor-pointer ${
              categoryFilter === 'property'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-gray-600 hover:bg-gray-200/70 border border-gray-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>ประกาศทรัพย์</span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter('inquiry')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all flex-shrink-0 cursor-pointer ${
              categoryFilter === 'inquiry'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-gray-600 hover:bg-gray-200/70 border border-gray-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>ผู้ติดต่อ</span>
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter('user_role')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all flex-shrink-0 cursor-pointer ${
              categoryFilter === 'user_role'
                ? 'bg-navy-900 text-gold-300 shadow-xs'
                : 'bg-white text-gray-600 hover:bg-gray-200/70 border border-gray-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>สิทธิ์สมาชิก</span>
          </button>
        </div>

        {/* Search Field */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหากิจกรรมระบบ..."
            className="w-full pl-8 pr-3 py-1.5 text-xs font-medium bg-white rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Chronological Timeline Stream */}
      {loading ? (
        <div className="py-12 text-center text-gray-400 space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gold-600" />
          <p className="text-xs font-medium">กำลังโหลดไทม์ไลน์กิจกรรมระบบ...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-500 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50 space-y-2">
          <Activity className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="text-xs font-bold text-gray-700">ไม่พบรายการกิจกรรมตามเงื่อนไขที่เลือก</p>
          <p className="text-[11px] text-gray-400">ลองเปลี่ยนตัวกรองหมวดหมู่หรือคำค้นหา</p>
        </div>
      ) : (
        <div className="relative pl-4 sm:pl-6 space-y-6 before:absolute before:left-2.5 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gray-200">
          {filtered.map((act) => {
            const badge = getCategoryBadge(act.category);
            return (
              <div key={act.id} className="relative group">
                {/* Chronological Timeline Node */}
                <div 
                  className={`absolute -left-[19px] sm:-left-[23px] top-1 w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ring-4 shadow-sm transition-transform group-hover:scale-110 ${badge.nodeBg}`}
                >
                  {badge.icon}
                </div>

                {/* Activity Event Card */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs hover:border-gold-300 hover:shadow-md transition-all space-y-2.5">
                  {/* Top Meta Line */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border flex items-center gap-1 ${badge.color}`}>
                        {badge.label}
                      </span>
                      <h3 className="font-extrabold text-navy-950 text-xs sm:text-sm">
                        {act.title}
                      </h3>
                    </div>

                    <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-gray-500">
                      <Clock className="w-3 h-3 text-gold-600" />
                      <span>{getRelativeTime(act.created_at)}</span>
                    </div>
                  </div>

                  {/* Description Detail */}
                  <p className="text-xs sm:text-sm text-gray-800 leading-relaxed font-normal">
                    {act.description}
                  </p>

                  {/* Actor and Target Metadata Tag */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/70 text-gray-600">
                    <div className="flex items-center space-x-1.5">
                      <UserCircle className="w-3.5 h-3.5 text-navy-800 flex-shrink-0" />
                      <span>ผู้ดำเนินการ: <strong className="text-navy-950">{act.actor_name}</strong></span>
                      {act.actor_role && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-navy-100 text-navy-900 uppercase">
                          {act.actor_role}
                        </span>
                      )}
                    </div>

                    {act.target_name && (
                      <div className="flex items-center space-x-1 text-gold-700 font-bold">
                        <span>เป้าหมาย:</span>
                        <span className="truncate max-w-[180px] sm:max-w-xs">{act.target_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
