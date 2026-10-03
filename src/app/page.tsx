import React from 'react';
import HeroSection from '@/components/home/HeroSection';
import FeaturedProperties from '@/components/home/FeaturedProperties';
import PropertyCategories from '@/components/home/PropertyCategories';
import WhyChooseUs from '@/components/home/WhyChooseUs';
import LocationHighlights from '@/components/home/LocationHighlights';
import FeaturedAgents from '@/components/home/FeaturedAgents';
import CustomerReviewsSection from '@/components/home/CustomerReviewsSection';
import SmartPropertyMatchmaker from '@/components/home/SmartPropertyMatchmaker';
import MortgageCalculator from '@/components/tools/MortgageCalculator';
import MarketIntelligenceSection from '@/components/home/MarketIntelligenceSection';
import ViewingBookingSection from '@/components/home/ViewingBookingSection';
import RealEstateFAQ from '@/components/home/RealEstateFAQ';
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

      {/* 5.1: SMART PROPERTY MATCHMAKER (เครื่องมือค้นหาอสังหาริมทรัพย์และฮวงจุ้ยแมตช์ตามความต้องการ) */}
      <SmartPropertyMatchmaker />

      {/* 6: LIVE MARKET INTELLIGENCE (เจาะลึกทิศทางอสังหาฯ หาดใหญ่ ด้วย Google Search Grounding) */}
      <MarketIntelligenceSection />

      {/* 7: FEATURED AGENTS (ทีมงานที่ปรึกษาอสังหาริมทรัพย์มืออาชีพ) */}
      <FeaturedAgents />

      {/* 8: REAL CLIENT TESTIMONIALS (ความประทับใจจากลูกค้าตัวจริง) */}
      <CustomerReviewsSection />

      {/* 9: PRIVATE VIEWING APPOINTMENT (จองคิวนัดชมทรัพย์ส่วนตัว) */}
      <ViewingBookingSection />

      {/* 10: REAL ESTATE FAQ (คำถามที่พบบ่อย ขับเคลื่อนด้วย Gemini AI) */}
      <RealEstateFAQ />

      {/* 10.1: CONSIGNMENT & PROPERTY VALUATION CALCULATOR (เครื่องมือประเมินมูลค่าทรัพย์สิน & วงเงินขายฝาก-จำนอง) */}
      <section className="bg-slate-50 py-12 px-4 border-t border-slate-200">
        <div className="max-w-7xl mx-auto">
          <MortgageCalculator
            initialPrice={3500000}
            title="เครื่องมือประเมินมูลค่าอสังหาริมทรัพย์ & คำนวณวงเงินขายฝาก-จำนอง"
            subtitle="คำนวณราคาประเมินเบื้องต้น วงเงินรับขายฝาก ดอกเบี้ยรายเดือน และประมาณการค่าใช้จ่าย ณ กรมที่ดิน"
          />
        </div>
      </section>

      {/* 11: SELL PROPERTY CTA (ฝากขายอสังหาฯ รวดเร็ว มั่นใจ) */}
      <SellPropertyCTA />

      {/* 12: CONTACT CTA (ปรึกษาเราได้ตลอด 24 ชั่วโมง) */}
      <ContactCTA />
    </div>
  );
}
