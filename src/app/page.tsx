import React from 'react';
import HeroSection from '@/components/home/HeroSection';
import FeaturedProperties from '@/components/home/FeaturedProperties';
import PropertyCategories from '@/components/home/PropertyCategories';
import WhyChooseUs from '@/components/home/WhyChooseUs';
import LocationHighlights from '@/components/home/LocationHighlights';
import FeaturedAgents from '@/components/home/FeaturedAgents';
import CustomerReviewsSection from '@/components/home/CustomerReviewsSection';
import MarketIntelligenceSection from '@/components/home/MarketIntelligenceSection';
import ViewingBookingSection from '@/components/home/ViewingBookingSection';
import SellPropertyCTA from '@/components/home/SellPropertyCTA';
import ContactCTA from '@/components/home/ContactCTA';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* 1: LUXURY HERO & SMART FLOATING SEARCH ENGINE */}
      <HeroSection />

      {/* 2: FEATURED PROPERTIES SHOWCASE (ทรัพย์เด่นคัดสรรระดับพรีเมียม) */}
      <FeaturedProperties />

      {/* 3: PROPERTY CATEGORIES (หมวดหมู่อสังหาริมทรัพย์) */}
      <PropertyCategories />

      {/* 4: WHY CHOOSE US (มาตรฐานการบริการระดับมืออาชีพ 4 ประการ) */}
      <WhyChooseUs />

      {/* 5: LOCATION HIGHLIGHTS (ทำเลศักยภาพ หาดใหญ่–สงขลา) */}
      <LocationHighlights />

      {/* 6: LIVE MARKET INTELLIGENCE (เจาะลึกทิศทางอสังหาฯ หาดใหญ่ ด้วย Google Search Grounding) */}
      <MarketIntelligenceSection />

      {/* 7: FEATURED AGENTS (ทีมงานที่ปรึกษาอสังหาริมทรัพย์มืออาชีพ) */}
      <FeaturedAgents />

      {/* 7: REAL CLIENT TESTIMONIALS (ความประทับใจจากลูกค้าตัวจริง) */}
      <CustomerReviewsSection />

      {/* 8: PRIVATE VIEWING APPOINTMENT (จองคิวนัดชมทรัพย์ส่วนตัว) */}
      <ViewingBookingSection />

      {/* 9: SELL PROPERTY CTA (ฝากขายอสังหาฯ รวดเร็ว มั่นใจ) */}
      <SellPropertyCTA />

      {/* 10: CONTACT CTA (ปรึกษาเราได้ตลอด 24 ชั่วโมง) */}
      <ContactCTA />
    </div>
  );
}
