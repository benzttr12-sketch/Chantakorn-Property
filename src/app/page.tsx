import React from 'react';
import HeroSection from '@/components/home/HeroSection';
import PropertyCategories from '@/components/home/PropertyCategories';
import FeaturedProperties from '@/components/home/FeaturedProperties';
import WhyChooseUs from '@/components/home/WhyChooseUs';
import LocationHighlights from '@/components/home/LocationHighlights';
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

      {/* 5: WHY CHOOSE US */}
      <WhyChooseUs />

      {/* 6: LOCATION HIGHLIGHTS (Hat Yai - Songkhla) */}
      <LocationHighlights />

      {/* 7: SELL PROPERTY CTA */}
      <SellPropertyCTA />

      {/* 8: CONTACT CTA */}
      <ContactCTA />
    </div>
  );
}

