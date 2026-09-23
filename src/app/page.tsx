import React from 'react';
import HeroSection from '@/components/home/HeroSection';
import PropertyCategories from '@/components/home/PropertyCategories';
import FeaturedProperties from '@/components/home/FeaturedProperties';
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

      {/* 5: INTERACTIVE MORTGAGE & AFFORDABILITY CALCULATOR */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white border-y border-surface-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <MortgageCalculator />
        </div>
      </section>

      {/* 6: WHY CHOOSE US */}
      <WhyChooseUs />

      {/* 7: LOCATION HIGHLIGHTS (Hat Yai - Songkhla) */}
      <LocationHighlights />

      {/* 8: SELL PROPERTY CTA */}
      <SellPropertyCTA />

      {/* 9: CONTACT CTA */}
      <ContactCTA />
    </div>
  );
}

