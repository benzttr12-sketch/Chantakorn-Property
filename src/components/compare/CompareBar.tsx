'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Scale, X, ArrowRight, Trash2 } from 'lucide-react';
import { Property } from '@/lib/types';
import { 
  getCompareIds, 
  toggleCompareId, 
  clearCompareList,
  getCompareProperties 
} from '@/lib/store/compare-store';
import { fetchProperties } from '@/lib/store/properties-store';
import { formatPrice } from '@/lib/utils';
import CompareModal from './CompareModal';

export default function CompareBar() {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Initial sync
    setCompareIds(getCompareIds());

    // Load properties to resolve details
    fetchProperties().then((data) => {
      setAllProperties(data);
    }).catch(() => {});

    // Listen to updates
    const handleUpdate = () => {
      setCompareIds(getCompareIds());
    };

    window.addEventListener('compare-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('compare-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const selectedProperties = getCompareProperties(allProperties);

  if (compareIds.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:bottom-8 z-40 max-w-2xl bg-navy-950 text-white rounded-3xl p-3.5 sm:p-4 shadow-2xl border border-navy-800 animate-in slide-in-from-bottom duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Info & Thumbnails */}
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-10 h-10 rounded-2xl bg-gold-500 text-navy-950 font-black flex items-center justify-center flex-shrink-0 shadow-sm">
              <Scale className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white">เปรียบเทียบทรัพย์</span>
                <span className="text-[10px] bg-gold-500/20 text-gold-400 font-extrabold px-2 py-0.5 rounded-full border border-gold-400/30">
                  {compareIds.length} / 4 หลัง
                </span>
              </div>
              <p className="text-[10px] text-gray-400 truncate max-w-[200px] sm:max-w-xs">
                {selectedProperties.map(p => p.title).join(' vs ')}
              </p>
            </div>

            {/* Micro Thumbnails */}
            <div className="hidden sm:flex items-center -space-x-2 pl-2">
              {selectedProperties.map((p) => (
                <div
                  key={p.id}
                  className="relative w-8 h-8 rounded-full border-2 border-navy-950 overflow-hidden bg-gray-700 shadow"
                  title={p.title}
                >
                  <Image
                    src={p.cover_image || p.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=100&q=80'}
                    alt={p.title}
                    fill
                    className="object-cover"
                    sizes="32px"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center space-x-2 ml-auto">
            <button
              type="button"
              onClick={() => clearCompareList()}
              className="p-2 text-gray-400 hover:text-red-400 rounded-xl hover:bg-white/10 transition-colors"
              title="ล้างรายการเปรียบเทียบทั้งหมด"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-navy-950 font-black text-xs rounded-xl shadow-md flex items-center space-x-1.5 transition-all hover:scale-105 active:scale-95"
            >
              <span>ดูตารางเปรียบเทียบ</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <CompareModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        properties={selectedProperties}
        onRemove={(id) => toggleCompareId(id)}
        onClear={() => {
          clearCompareList();
          setIsModalOpen(false);
        }}
      />
    </>
  );
}
