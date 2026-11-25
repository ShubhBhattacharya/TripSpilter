import { DESTINATIONS, type Destination } from './destinations';

export type BookingCategoryId =
  | 'flights'
  | 'hotels'
  | 'homestays'
  | 'packages'
  | 'trains'
  | 'buses'
  | 'cabs'
  | 'activities'
  | 'insurance';

export interface PortalNavCategory {
  id: BookingCategoryId;
  label: string;
  shortLabel: string;
  badge?: string;
  description: string;
  searchSupported: boolean;
}

export const PORTAL_NAV_CATEGORIES: PortalNavCategory[] = [
  {
    id: 'flights',
    label: 'Flights',
    shortLabel: 'Flights',
    description: 'Domestic & international routes via connected Amadeus provider adapter.',
    searchSupported: true,
  },
  {
    id: 'hotels',
    label: 'Hotels',
    shortLabel: 'Hotels',
    description: 'Hotel inventory adapter & destination stay discovery across India.',
    searchSupported: true,
  },
  {
    id: 'homestays',
    label: 'Villas & Homestays',
    shortLabel: 'Homestays',
    description: 'Boutique hills villas, coastal homestays, and family suites.',
    searchSupported: true,
  },
  {
    id: 'packages',
    label: 'Holiday Packages',
    shortLabel: 'Packages',
    badge: 'Popular',
    description: 'Multi-day itinerary & expense baseline packages from our 60-city catalog.',
    searchSupported: true,
  },
  {
    id: 'trains',
    label: 'Trains',
    shortLabel: 'Trains',
    description: 'Station search with official IRCTC booking redirection.',
    searchSupported: true,
  },
  {
    id: 'buses',
    label: 'Buses',
    shortLabel: 'Buses',
    description: 'Intercity corridor search with official operator links.',
    searchSupported: true,
  },
  {
    id: 'cabs',
    label: 'Cabs',
    shortLabel: 'Cabs',
    description: 'Route distance & estimated driving duration calculator.',
    searchSupported: true,
  },
  {
    id: 'activities',
    label: 'Tours & Activities',
    shortLabel: 'Activities',
    badge: '360°',
    description: '240+ curated heritage, nature & adventure spots with 3D previews.',
    searchSupported: true,
  },
  {
    id: 'insurance',
    label: 'Travel Insurance',
    shortLabel: 'Insurance',
    badge: 'Soon',
    description: 'Regulated travel cover partner integration planned — coming soon.',
    searchSupported: false,
  },
];

export type OfferCategoryFilter =
  | 'all'
  | 'flights'
  | 'hotels'
  | 'holidays'
  | 'trains'
  | 'buses'
  | 'packages'
  | 'partners';

export interface PlatformOfferItem {
  id: string;
  category: Exclude<OfferCategoryFilter, 'all'>;
  categoryLabel: string;
  title: string;
  description: string;
  validityText: string;
  termsSummary: string;
  imageUrl: string;
  actionLabel: string;
  actionHref: string;
  isLiveProgram: boolean;
}

/**
 * Strictly grounded TripSplitter platform programs and adapter status cards.
 * Never fabricates coupon codes, percentage discounts, or commercial bank tie-ups.
 */
export const PLATFORM_OFFERS: PlatformOfferItem[] = [
  {
    id: 'offer-upi-zero-fee',
    category: 'packages',
    categoryLabel: 'Zero-Escrow Payments',
    title: '0% Wallet Float on Direct-to-Vendor UPI Bill Splits',
    description:
      'Every group member pays merchants directly from their own UPI app without wallet holding fees.',
    validityText: 'Active Platform Standard',
    termsSummary: 'Direct UPI intents open your installed UPI PSP app; bank/NPCI limits apply.',
    imageUrl: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=900&q=80',
    actionLabel: 'Open Direct QR Split',
    actionHref: '/qr-split',
    isLiveProgram: true,
  },
  {
    id: 'offer-3d-ai-tour',
    category: 'holidays',
    categoryLabel: '360° & AI Guide',
    title: 'Explore 60 Indian Cities in 360° with Bilingual Audio Guide',
    description:
      'Preview curated sights across Manali, Jaipur, Goa, Kerala & Northeast in Hindi and English before booking.',
    validityText: 'Available Always',
    termsSummary: 'Includes 240 curated destination spots with Wikipedia-grounded explanations.',
    imageUrl: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=900&q=80',
    actionLabel: 'Launch 3D Travel HQ',
    actionHref: '/3d-experience',
    isLiveProgram: true,
  },
  {
    id: 'offer-flights-adapter',
    category: 'flights',
    categoryLabel: 'Flight Search',
    title: 'Compare Live Domestic & International Flight Fares',
    description:
      'Connected to our Amadeus Flight Offers adapter when FLIGHT_PROVIDER_API_KEY is active on your deployment.',
    validityText: 'Adapter Integration Ready',
    termsSummary: 'Live fares load directly from provider APIs; zero mock prices displayed.',
    imageUrl: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&q=80',
    actionLabel: 'Search Flights',
    actionHref: '#booking-search-panel',
    isLiveProgram: true,
  },
  {
    id: 'offer-hotels-adapter',
    category: 'hotels',
    categoryLabel: 'Hotel Discovery',
    title: 'Transparent Stay Search Across Boutique Resorts & Homestays',
    description:
      'Query real hotel availability via LiteAPI/Hotelbeds adapters or inspect catalog baseline trip costs.',
    validityText: 'Adapter Integration Ready',
    termsSummary: 'Live room rates require HOTEL_PROVIDER_API_KEY; external search redirects supported.',
    imageUrl: 'https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&w=900&q=80',
    actionLabel: 'Browse Stay Styles',
    actionHref: '#stays-showcase',
    isLiveProgram: true,
  },
  {
    id: 'offer-trains-irctc',
    category: 'trains',
    categoryLabel: 'Rail Transit',
    title: 'Official IRCTC Rail Lookup & Group Split Tracking',
    description:
      'Plan intercity train legs and log shared ticket costs cleanly inside your TripSplit Bookings Vault.',
    validityText: 'External Provider Link',
    termsSummary: 'Seat inventory opens directly on official IRCTC rail portal; zero fabricated PNR status.',
    imageUrl: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=900&q=80',
    actionLabel: 'Plan Train Route',
    actionHref: '#booking-search-panel',
    isLiveProgram: true,
  },
  {
    id: 'offer-buses-corridor',
    category: 'buses',
    categoryLabel: 'Intercity Buses',
    title: 'Overnight Volvo & Hill Corridor Bus Planning',
    description:
      'Jump straight to intercity bus operator searches for Himalayan, Coastal, and Desert routes.',
    validityText: 'External Provider Link',
    termsSummary: 'Redirects to official bus operators; never fabricates bus timings or seat counts.',
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=900&q=80',
    actionLabel: 'Plan Bus Travel',
    actionHref: '#booking-search-panel',
    isLiveProgram: true,
  },
  {
    id: 'offer-fx-weather',
    category: 'partners',
    categoryLabel: 'Live Travel Feeds',
    title: 'Bank & Card Partner Offers Not Active — Use Live FX Reference',
    description:
      'No unverified bank discounts are displayed. Check real ECB currency conversion & 3-day Open-Meteo weather telemetry anytime.',
    validityText: 'Honest Disclosure',
    termsSummary: 'Bank/card promotions will appear only after signed commercial partner agreements.',
    imageUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=900&q=80',
    actionLabel: 'Ask AI Currency Tool',
    actionHref: '/ai-assistant',
    isLiveProgram: true,
  },
];

export interface EcosystemPartnerItem {
  id: string;
  name: string;
  category: 'Airlines' | 'Hotels' | 'Maps & Places' | 'Telemetry' | 'Rail & Bus';
  statusLabel: 'Live Public Feed' | 'Adapter Ready (Key Required)' | 'Official External Redirect';
  detail: string;
}

export const TRAVEL_ECOSYSTEM_INTEGRATIONS: EcosystemPartnerItem[] = [
  {
    id: 'open-meteo',
    name: 'Open-Meteo Weather',
    category: 'Telemetry',
    statusLabel: 'Live Public Feed',
    detail: 'Real-time temperature, wind & 3-day forecasts per city coordinates.',
  },
  {
    id: 'frankfurter',
    name: 'ECB Frankfurter FX',
    category: 'Telemetry',
    statusLabel: 'Live Public Feed',
    detail: 'Live multi-currency reference conversion for INR, USD, EUR & GBP.',
  },
  {
    id: 'google-places',
    name: 'Google Places & Routes',
    category: 'Maps & Places',
    statusLabel: 'Adapter Ready (Key Required)',
    detail: 'Verified POI details, opening hours & driving route durations.',
  },
  {
    id: 'amadeus',
    name: 'Amadeus Self-Service',
    category: 'Airlines',
    statusLabel: 'Adapter Ready (Key Required)',
    detail: 'API adapter for airline flight offers (`FLIGHT_PROVIDER_API_KEY`).',
  },
  {
    id: 'liteapi',
    name: 'LiteAPI / Hotelbeds',
    category: 'Hotels',
    statusLabel: 'Adapter Ready (Key Required)',
    detail: 'API adapter for hotel availability (`HOTEL_PROVIDER_API_KEY`).',
  },
  {
    id: 'irctc-redbus',
    name: 'IRCTC & RedBus Portals',
    category: 'Rail & Bus',
    statusLabel: 'Official External Redirect',
    detail: 'Verified direct operator redirect workflow without synthetic schedules.',
  },
];

export type StayStyleId =
  | 'featured'
  | 'luxury'
  | 'budget'
  | 'resorts'
  | 'villas'
  | 'homestays'
  | 'family'
  | 'weekend';

export interface CuratedStayCollection {
  id: string;
  style: Exclude<StayStyleId, 'featured'>;
  destinationId: string;
  title: string;
  destinationLabel: string;
  facilities: string[];
  imageUrl: string;
  externalSearchUrl: string;
}

export const STAY_STYLE_TABS: Array<{ id: StayStyleId; label: string }> = [
  { id: 'featured', label: 'Featured' },
  { id: 'luxury', label: 'Luxury Stays' },
  { id: 'budget', label: 'Budget Stays' },
  { id: 'resorts', label: 'Resorts' },
  { id: 'villas', label: 'Villas' },
  { id: 'homestays', label: 'Homestays' },
  { id: 'family', label: 'Family' },
  { id: 'weekend', label: 'Weekend Stays' },
];

export const CURATED_STAY_COLLECTIONS: CuratedStayCollection[] = [
  {
    id: 'stay-manali-chalets',
    style: 'homestays',
    destinationId: 'manali',
    title: 'Pine Valley Cabins & Old Manali Cafes',
    destinationLabel: 'Manali, Himachal Pradesh',
    facilities: ['Mountain Views', 'Bonfire Patio', 'Split Bill Ready'],
    imageUrl: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=900&q=80',
    externalSearchUrl: 'https://www.booking.com/searchresults.html?ss=Manali',
  },
  {
    id: 'stay-udaipur-lakeside',
    style: 'luxury',
    destinationId: 'udaipur',
    title: 'Pichola Lake Heritage Havellis',
    destinationLabel: 'Udaipur, Rajasthan',
    facilities: ['Lakeside Rooftop', 'Heritage Courtyards', 'Airport Transfer'],
    imageUrl: 'https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&w=900&q=80',
    externalSearchUrl: 'https://www.booking.com/searchresults.html?ss=Udaipur',
  },
  {
    id: 'stay-goa-villas',
    style: 'villas',
    destinationId: 'goa',
    title: 'Assagao & Anjuna Group Pool Villas',
    destinationLabel: 'North & South Goa',
    facilities: ['Group Living Room', 'Kitchenette', 'Beach Access'],
    imageUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=900&q=80',
    externalSearchUrl: 'https://www.booking.com/searchresults.html?ss=Goa',
  },
  {
    id: 'stay-munnar-resorts',
    style: 'resorts',
    destinationId: 'munnar',
    title: 'Tea Estate Mist View Retreats',
    destinationLabel: 'Munnar, Kerala',
    facilities: ['Tea Plantation Walk', 'Breakfast', 'Balcony Seating'],
    imageUrl: 'https://images.unsplash.com/photo-1596895111956-bf1cf0599ce5?auto=format&fit=crop&w=900&q=80',
    externalSearchUrl: 'https://www.booking.com/searchresults.html?ss=Munnar',
  },
  {
    id: 'stay-rishikesh-budget',
    style: 'budget',
    destinationId: 'rishikesh',
    title: 'Tapovan River Backpacker Stays',
    destinationLabel: 'Rishikesh, Uttarakhand',
    facilities: ['High-Speed WiFi', 'Co-work Cafe', 'Rafting Desk'],
    imageUrl: 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=900&q=80',
    externalSearchUrl: 'https://www.booking.com/searchresults.html?ss=Rishikesh',
  },
  {
    id: 'stay-jaipur-family',
    style: 'family',
    destinationId: 'jaipur',
    title: 'Pink City Family Courtyard Suites',
    destinationLabel: 'Jaipur, Rajasthan',
    facilities: ['Connected Suites', 'Parking', 'Concierge Tours'],
    imageUrl: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=900&q=80',
    externalSearchUrl: 'https://www.booking.com/searchresults.html?ss=Jaipur',
  },
  {
    id: 'stay-lonavala-weekend',
    style: 'weekend',
    destinationId: 'lonavala',
    title: 'Western Ghats Weekend Bungalows',
    destinationLabel: 'Lonavala, Maharashtra',
    facilities: ['Valley Lawn', 'Day-Trip Friendly', 'Easy Drive'],
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
    externalSearchUrl: 'https://www.booking.com/searchresults.html?ss=Lonavala',
  },
];

export interface HandpickedCollectionGroup {
  id: string;
  label: string;
  subtitle: string;
  destinationIds: string[];
}

export const HANDPICKED_COLLECTIONS: HandpickedCollectionGroup[] = [
  {
    id: 'weekend',
    label: 'Weekend Getaways',
    subtitle: 'Easy 2–3 day road & rail escapes from major metros.',
    destinationIds: ['rishikesh', 'jaipur', 'lonavala', 'coorg', 'pondicherry', 'agra'],
  },
  {
    id: 'hills',
    label: 'Hill Stations',
    subtitle: 'Cool pine ridges, toy trains & Himalayan overlooks.',
    destinationIds: ['manali', 'shimla', 'darjeeling', 'munnar', 'ooty', 'gangtok'],
  },
  {
    id: 'beaches',
    label: 'Beach Destinations',
    subtitle: 'Sunlit coastlines, lagoons, and island snorkeling reefs.',
    destinationIds: ['goa', 'gokarna', 'andaman', 'varkala', 'pondicherry', 'puri'],
  },
  {
    id: 'heritage',
    label: 'Heritage & Romantic',
    subtitle: 'Lakeside palaces, stepped wells, and UNESCO stone art.',
    destinationIds: ['udaipur', 'jaisalmer', 'hampi', 'varanasi', 'khajuraho', 'jodhpur'],
  },
  {
    id: 'snow-adventure',
    label: 'Snow & Adventure',
    subtitle: 'High-altitude passes, river rafting, and alpine treks.',
    destinationIds: ['leh', 'spiti', 'auli', 'gulmarg', 'tawang', 'sikkim'],
  },
  {
    id: 'monsoon',
    label: 'Monsoon & Backwaters',
    subtitle: 'Living root bridges, misty waterfalls & palm backwaters.',
    destinationIds: ['cherrapunji', 'shillong', 'alleppey', 'kaziranga', 'pachmarhi', 'wayanad'],
  },
];

export function resolveCollectionDestinations(ids: string[]): Destination[] {
  const byId = new Map(DESTINATIONS.map((d) => [d.id, d]));
  const resolved: Destination[] = [];
  for (const id of ids) {
    const match = byId.get(id);
    if (match) resolved.push(match);
  }
  // Backfill if any ID variant differs cleanly without empty arrays
  if (resolved.length < 4) {
    for (const d of DESTINATIONS) {
      if (!resolved.some((r) => r.id === d.id)) {
        resolved.push(d);
        if (resolved.length >= 6) break;
      }
    }
  }
  return resolved;
}

export const HIDDEN_WONDER_IDS = new Set([
  'spiti',
  'hampi',
  'gokarna',
  'cherrapunji',
  'shillong',
  'khajuraho',
  'pachmarhi',
  'kaziranga',
  'tawang',
  'auli',
  'jaisalmer',
  'varkala',
  'andaman',
  'gangtok',
  'munnar',
  'puri',
  'dharamshala',
  'ujjain',
]);

export function getDestinationById(id: string): Destination | undefined {
  const target = id.toLowerCase().trim();
  return DESTINATIONS.find((d) => d.id.toLowerCase() === target);
}
