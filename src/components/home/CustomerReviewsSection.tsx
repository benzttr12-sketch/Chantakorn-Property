'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Star,
  MessageSquare,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  UserRound,
  Loader2,
} from 'lucide-react';
import { Review, fetchReviews } from '@/lib/store/reviews-store';

const serviceLabels: Record<Review['serviceType'], string> = {
  buy: 'ซื้อทรัพย์',
  sell: 'ฝากขายทรัพย์',
  rent: 'เช่า / ปล่อยเช่า',
  consignment: 'ขายฝาก',
};

export default function CustomerReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    fetchReviews()
      .then((list) => {
        if (active) setReviews(list.filter((review) => review.published));
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const checkScroll = () => {
      setCanScrollLeft(element.scrollLeft > 4);
      setCanScrollRight(element.scrollLeft < element.scrollWidth - element.clientWidth - 4);
    };
    checkScroll();
    element.addEventListener('scroll', checkScroll, { passive: true });
    const observer = new ResizeObserver(checkScroll);
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', checkScroll);
      observer.disconnect();
    };
  }, [reviews, loading]);

  const scroll = (direction: 'left' | 'right') => {
    const element = scrollRef.current;
    if (!element) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollBy({
      left: (direction === 'left' ? -1 : 1) * Math.min(370, element.clientWidth),
      behavior: reducedMotion ? 'instant' : 'smooth',
    });
  };

  return (
    <section
      aria-labelledby="customer-reviews-title"
      className="relative overflow-hidden border-b border-slate-200/80 bg-[#FAFAFA] py-16 md:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end md:mb-10">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gold-700">
              CUSTOMER STORIES
            </p>
            <h2
              id="customer-reviews-title"
              className="text-3xl font-bold tracking-tight text-navy-950 sm:text-4xl"
            >
              เสียงจากลูกค้าของเรา
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-500 sm:text-base">
              ประสบการณ์ซื้อ เช่า และฝากขาย ผ่านความคิดเห็นที่ลูกค้ามอบให้ทีมฉันทากร
            </p>
          </div>
          {!loading && !error && reviews.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="mr-2 text-sm text-slate-500">{reviews.length} รีวิว</span>
              <button
                type="button"
                onClick={() => scroll('left')}
                disabled={!canScrollLeft}
                aria-label="ดูรีวิวก่อนหน้า"
                aria-controls="customer-reviews-list"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-navy-950 transition hover:border-gold-300 hover:bg-gold-50 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => scroll('right')}
                disabled={!canScrollRight}
                aria-label="ดูรีวิวถัดไป"
                aria-controls="customer-reviews-list"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-navy-950 transition hover:border-gold-300 hover:bg-gold-50 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
        {loading ? (
          <div
            role="status"
            className="flex items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500"
          >
            <Loader2 className="h-5 w-5 animate-spin text-gold-600" />
            กำลังโหลดรีวิว…
          </div>
        ) : error ? (
          <div
            role="status"
            className="flex flex-col items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-6 text-center sm:flex-row sm:text-left"
          >
            <p className="text-sm text-slate-500">ขณะนี้ยังโหลดรีวิวไม่ได้</p>
            <button
              type="button"
              onClick={() => setReload((value) => value + 1)}
              className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-navy-950 hover:bg-gold-50"
            >
              ลองโหลดใหม่
            </button>
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex items-start gap-4 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-50 text-gold-700">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-navy-950">ยังไม่มีรีวิวที่เผยแพร่</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                คุณสามารถสอบถามข้อมูลและพูดคุยกับทีมงานก่อนตัดสินใจใช้บริการได้เสมอ
              </p>
            </div>
          </div>
        ) : (
          <div
            id="customer-reviews-list"
            ref={scrollRef}
            tabIndex={0}
            aria-label="รีวิวจากลูกค้า เลื่อนเพื่อดูเพิ่มเติม"
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 pt-1 focus-visible:rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
          >
            {reviews.map((review) => (
              <article
                key={review.id}
                className="flex w-[min(340px,85vw)] shrink-0 snap-start flex-col justify-between gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:w-[350px] sm:p-6"
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div
                      role="img"
                      aria-label={`${review.rating} จาก 5 ดาว`}
                      className="flex items-center gap-1"
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          aria-hidden="true"
                          className={`h-4 w-4 ${star <= review.rating ? 'fill-gold-400 text-gold-400' : 'text-slate-200'}`}
                        />
                      ))}
                    </div>
                    <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                      {serviceLabels[review.serviceType]}
                    </span>
                  </div>
                  <blockquote className="whitespace-pre-line break-words text-sm leading-7 text-navy-950">
                    “{review.comment}”
                  </blockquote>
                  {review.propertyTitleOrZone && (
                    <p className="break-words text-xs leading-relaxed text-slate-500">
                      {review.propertyTitleOrZone}
                    </p>
                  )}
                  {review.agentName && (
                    <p className="break-words text-xs text-slate-500">
                      ผู้ดูแล: {review.agentName}
                    </p>
                  )}
                </div>
                <footer className="border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400">
                      {review.avatarUrl ? (
                        <Image
                          src={review.avatarUrl}
                          alt={review.customerName}
                          fill
                          sizes="44px"
                          unoptimized
                          referrerPolicy="no-referrer"
                          className="object-cover"
                        />
                      ) : (
                        <UserRound className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-semibold text-navy-950">
                        {review.customerName}
                      </h3>
                      {review.customerRole && (
                        <p className="mt-1 break-words text-xs text-slate-500">
                          {review.customerRole}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    {review.verifiedBuyer && (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        ยืนยันการใช้บริการ
                      </span>
                    )}
                    {review.date && <time>{review.date}</time>}
                  </div>
                </footer>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
