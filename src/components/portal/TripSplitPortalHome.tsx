'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TravelTopNav } from './TravelTopNav';
import { HeroBookingSearch } from './HeroBookingSearch';
import { OffersDealsCarousel } from './OffersDealsCarousel';
import { StaysAndPartnersSection } from './StaysAndPartnersSection';
import { DestinationCollections } from './DestinationCollections';
import { PlatformTrustFooter } from './PlatformTrustFooter';
import { BottomNav } from '../layout/BottomNav';
import { usePortalWishlist } from './usePortalWishlist';
import type { BookingCategoryId } from '../../data/travelCatalog';

export const TripSplitPortalHome: React.FC = () => {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<BookingCategoryId>('flights');
  const { savedIds, savedDestinations, toggleWishlist, isWishlisted } = usePortalWishlist();

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#172B4D] flex flex-col font-sans selection:bg-[#1666F2]/15 selection:text-[#173B70]">
      {/* 1. Sticky Travel Navigation Bar */}
      <TravelTopNav
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        wishlistCount={savedIds.length}
        wishlistDestinations={savedDestinations}
        onRemoveWishlist={toggleWishlist}
      />

      {/* 2. Multi-Mode Booking Search Panel & Explore Utility Bar */}
      <main className="flex-1 space-y-6">
        <HeroBookingSearch
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
        />

        {/* 3. Offers & Exclusive Programs Carousel */}
        <OffersDealsCarousel />

        {/* 4. Travel Supplier Integrations + 5. Flagship Hotels & Stays */}
        <StaysAndPartnersSection
          isWishlisted={isWishlisted}
          onToggleWishlist={toggleWishlist}
        />

        {/* 6. Handpicked Collections + 7. Hidden Wonders + 8. Trending + 9. Packages + 10. Guides */}
        <DestinationCollections
          isWishlisted={isWishlisted}
          onToggleWishlist={toggleWishlist}
        />

        {/* 11. Benefits & Expense HQ Bridge + 12. Support + 13. Footer */}
        <PlatformTrustFooter />
      </main>

      {/* Mobile Persistent Bottom Navigation */}
      <BottomNav
        onOpenQuickSplit={() => router.push('/qr-split')}
        onScanClick={() => router.push('/qr-split')}
      />
    </div>
  );
};
