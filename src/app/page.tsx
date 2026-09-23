import React from 'react';
import HeroSection from '@/components/home/HeroSection';
import PropertyCategories from '@/components/home/PropertyCategories';
import FeaturedProperties from '@/components/home/FeaturedProperties';
import SmartPropertyMatchmaker from '@/components/home/SmartPropertyMatchmaker';
import ViewingBookingSection from '@/components/home/ViewingBookingSection';
import FeaturedAgents from '@/components/home/FeaturedAgents';
import CustomerReviewsSection from '@/components/home/CustomerReviewsSection';
import WhyChooseUs from '@/components/home/WhyChooseUs';
import LocationHighlights from '@/components/home/LocationHighlights';
import MortgageCalculator from '@/components/tools/MortgageCalculator';
import SellPropertyCTA from '@/components/home/SellPropertyCTA';
import ContactCTA from '@/components/home/ContactCTA';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* 1 & 2: HERO & FLOATING SEARCH BOX */}
      <HeroSection />

      {/* 3: PROPERTY CATEGORIES */}
      <PropertyCategories />

      {/* 4: FEATURED PROPERTIES */}
      <FeaturedProperties />

      {/* 5: FEATURED AGENTS (ระบบนายหน้าแนะนำ & ที่ปรึกษาประจำหาดใหญ่-สงขลา แบบสไลด์กะทัดรัด) */}
      <FeaturedAgents />

      {/* 6: VIEWING APPOINTMENT BOOKING (ระบบจองคิวนัดชมทรัพย์ล่วงหน้า) */}
      <ViewingBookingSection />

      {/* 7: INTERACTIVE SMART PROPERTY MATCHMAKER (ค้นหาอสังหาฯ ที่ตรงใจใน 3 คลิก) */}
      <section className="py-16 md:py-20 bg-slate-100/60 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SmartPropertyMatchmaker />
        </div>
      </section>

      {/* 8: INTERACTIVE MORTGAGE & AFFORDABILITY CALCULATOR */}
      <section className="py-16 md:py-24 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <MortgageCalculator />
        </div>
      </section>

      {/* 9: REAL CLIENT TESTIMONIALS & REVIEWS SYSTEM (ระบบรีวิวและความประทับใจจากลูกค้าจริง) */}
      <CustomerReviewsSection />

      {/* 10: WHY CHOOSE US */}
      <WhyChooseUs />

      {/* 11: LOCATION HIGHLIGHTS (Hat Yai - Songkhla) */}
      <LocationHighlights />

      {/* 12: SELL PROPERTY CTA */}
      <SellPropertyCTA />

      {/* 13: CONTACT CTA */}
      <ContactCTA />
    </div>
  );
}
