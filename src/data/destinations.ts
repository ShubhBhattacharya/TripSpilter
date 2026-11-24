export interface FloatingBadge {
  id: string;
  label: string;
  cost: number;
  type: 'itinerary' | 'activity';
  top: string;
  left: string;
}

export interface Spot {
  id: string;
  name: string;
  subtitle: string;
  cost: number;
  category: 'Heritage' | 'Fort' | 'Scenic' | 'Culture' | 'Beach' | 'Adventure';
  rating: number;
  reviewsCount: number;
  duration: string;
  bestTime: string;
  description: string;
  highlights: string[];
  wikiTitle: string;
  realPhotoUrl: string;
  lat: number;
  lng: number;
  speechQuote: string;
  nextSpotName: string;
  floatingBadges: FloatingBadge[];
  panorama: {
    ambientColor: string;
    skyTop: string;
    skyHorizon: string;
    groundColor: string;
    accentGlow: string;
    monumentName: string;
    atmosphere: string;
  };
}

export interface Destination {
  id: string;
  name: string;
  state: string;
  tagline: string;
  description: string;
  heroImage: string;
  startingPrice: number;
  spots: Spot[];
}

export const DESTINATIONS: Destination[] = [
  {
    id: 'jaipur',
    name: 'Jaipur, Rajasthan',
    state: 'Pink City of India',
    tagline: 'Royal Palaces, Grand Forts & Regal Splendor',
    description: 'Immerse your group in timeless Rajput royalty, bustling bazaars, and world heritage architecture.',
    heroImage: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?q=80&w=800&auto=format&fit=crop',
    startingPrice: 1000,
    spots: [
      {
        id: 'hawa-mahal',
        name: 'Hawa Mahal',
        subtitle: 'Palace of Winds • 953 Jharokhas',
        cost: 200,
        category: 'Heritage',
        rating: 4.8,
        reviewsCount: 1420,
        duration: '1.5 Hours',
        bestTime: 'Morning (Golden Sunrise)',
        description: 'Iconic five-story pink sandstone palace with intricate latticework windows designed for royal breezes.',
        highlights: ['953 Casements', 'Rooftop City View', 'Pink Sandstone Façade'],
        wikiTitle: 'Hawa Mahal',
        realPhotoUrl: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?q=85&w=2400&auto=format&fit=crop',
        lat: 26.923936,
        lng: 75.826744,
        speechQuote: 'Welcome to Hawa Mahal! 953 jharokhon wala iconic palace. Settle inside view aur explore karein.',
        nextSpotName: 'Amer Fort',
        floatingBadges: [
          { id: 'hawa-itinerary', label: '+ Add to Itinerary', cost: 0, type: 'itinerary', top: '64%', left: '18%' },
          { id: 'hawa-heritage-walk', label: '+ Book Heritage Walk (₹500)', cost: 500, type: 'activity', top: '68%', left: '58%' },
        ],
        panorama: {
          ambientColor: '#ffe4cc',
          skyTop: '#ff7e5f',
          skyHorizon: '#feb47b',
          groundColor: '#78350f',
          accentGlow: '#f59e0b',
          monumentName: 'Hawa Mahal 360° Courtyard',
          atmosphere: 'Warm Desert Sunset with Amber Jharokha Glow',
        },
      },
      {
        id: 'amer-fort',
        name: 'Amer Fort',
        subtitle: 'Hilltop Fortress & Sheesh Mahal',
        cost: 500,
        category: 'Fort',
        rating: 4.9,
        reviewsCount: 2850,
        duration: '3.5 Hours',
        bestTime: 'Early Afternoon',
        description: 'Majestic fortress overlooking Maota Lake, famous for its mirror-tiled Sheesh Mahal and royal courtyards.',
        highlights: ['Sheesh Mahal Glasswork', 'Maota Lake Vista', 'Diwan-e-Khas Archways'],
        wikiTitle: 'Amber Fort',
        realPhotoUrl: 'https://images.unsplash.com/photo-1603288940300-47020e50e93a?q=85&w=2400&auto=format&fit=crop',
        lat: 26.985487,
        lng: 75.851345,
        speechQuote: 'Ye hai Amer Fort! Sheesh Mahal aur Maota Lake ka royal view. Elephant path aur ramparts check out karein.',
        nextSpotName: 'Jal Mahal',
        floatingBadges: [
          { id: 'amer-itinerary', label: '+ Add to Itinerary', cost: 0, type: 'itinerary', top: '55%', left: '25%' },
          { id: 'amer-sheesh-guide', label: '+ Sheesh Mahal Audio Guide (₹250)', cost: 250, type: 'activity', top: '60%', left: '62%' },
        ],
        panorama: {
          ambientColor: '#fef3c7',
          skyTop: '#1e3a8a',
          skyHorizon: '#60a5fa',
          groundColor: '#451a03',
          accentGlow: '#fbbf24',
          monumentName: 'Amer Fort High Ramparts',
          atmosphere: 'Clear Azure Skies over Golden Sandstone Battlements',
        },
      },
      {
        id: 'jal-mahal',
        name: 'Jal Mahal',
        subtitle: 'Water Palace in Man Sagar Lake',
        cost: 0,
        category: 'Scenic',
        rating: 4.7,
        reviewsCount: 1890,
        duration: '1 Hour',
        bestTime: 'Sunset & Dusk',
        description: 'Serene four-story submerged palace sitting in the center of tranquil Man Sagar Lake with Aravalli hills backdrop.',
        highlights: ['Water Mirror Reflections', 'Illuminated Evening Lights', 'Aravalli Hills Panorama'],
        wikiTitle: 'Jal Mahal',
        realPhotoUrl: 'https://images.unsplash.com/photo-1605649487212-47bdab064df7?q=85&w=2400&auto=format&fit=crop',
        lat: 26.953444,
        lng: 75.846206,
        speechQuote: 'Jal Mahal Man Sagar Lake ke beech mein tairta hua mehsus hota hai. Zero entry fee landmark for your group!',
        nextSpotName: 'Nahargarh Fort',
        floatingBadges: [
          { id: 'jal-itinerary', label: '+ Add to Itinerary', cost: 0, type: 'itinerary', top: '58%', left: '22%' },
          { id: 'jal-boat-ride', label: '+ Sunset Promenade Pass (₹150)', cost: 150, type: 'activity', top: '65%', left: '60%' },
        ],
        panorama: {
          ambientColor: '#dbeafe',
          skyTop: '#4c1d95',
          skyHorizon: '#ec4899',
          groundColor: '#1e293b',
          accentGlow: '#38bdf8',
          monumentName: 'Man Sagar Promenade Lakefront',
          atmosphere: 'Twilight Violet & Magenta Reflection on Rippling Water',
        },
      },
      {
        id: 'nahargarh-fort',
        name: 'Nahargarh Fort',
        subtitle: 'Panoramic Cliffside Sunset Bastion',
        cost: 300,
        category: 'Fort',
        rating: 4.8,
        reviewsCount: 1620,
        duration: '2.5 Hours',
        bestTime: 'Evening Sunset',
        description: 'Perched on the edge of the Aravalli hills, Nahargarh offers the ultimate panoramic viewpoint of Jaipur city lights.',
        highlights: ['360° Skyline View', 'Padao Open-air Bistro', 'Historic Stepwell (Baori)'],
        wikiTitle: 'Nahargarh Fort',
        realPhotoUrl: 'https://images.unsplash.com/photo-1609137144813-7d9921338f24?q=85&w=2400&auto=format&fit=crop',
        lat: 26.937233,
        lng: 75.815617,
        speechQuote: 'Nahargarh cliffside bastions se poori Jaipur city ka sunset aur night skyline dikhta hai. Perfect for squad pictures!',
        nextSpotName: 'Hawa Mahal',
        floatingBadges: [
          { id: 'nahar-itinerary', label: '+ Add to Itinerary', cost: 0, type: 'itinerary', top: '52%', left: '24%' },
          { id: 'nahar-padao-entry', label: '+ Padao Sunset Bistro Table (₹350)', cost: 350, type: 'activity', top: '62%', left: '65%' },
        ],
        panorama: {
          ambientColor: '#fed7aa',
          skyTop: '#0f172a',
          skyHorizon: '#ea580c',
          groundColor: '#1c1917',
          accentGlow: '#f97316',
          monumentName: 'Nahargarh Summit Ridge',
          atmosphere: 'Dusk Golden Hour over the Twinkling Pink City Basin',
        },
      },
    ],
  },
  {
    id: 'manali',
    name: 'Manali, Himachal',
    state: 'Himalayan Highlands',
    tagline: 'Snowcapped Peaks, Pine Valleys & Rohtang Pass',
    description: 'Crisp alpine air, apple orchards, and adrenaline-pumping mountain expeditions for your travel crew.',
    heroImage: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?q=80&w=800&auto=format&fit=crop',
    startingPrice: 1200,
    spots: [
      {
        id: 'solang-valley',
        name: 'Solang Valley',
        subtitle: 'Adventure Hub • Paragliding & Zipline',
        cost: 600,
        category: 'Adventure',
        rating: 4.8,
        reviewsCount: 1200,
        duration: '3 Hours',
        bestTime: 'Morning',
        description: 'Sprawling alpine meadows nestled amidst glaciers and snow-crowned peaks with soaring paragliders.',
        highlights: ['Paragliding Views', 'Snow Quad Biking', 'Cable Car Ropeway'],
        wikiTitle: 'Solang Valley',
        realPhotoUrl: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?q=85&w=2400&auto=format&fit=crop',
        lat: 32.316667,
        lng: 77.158333,
        speechQuote: 'Welcome to Solang Valley! Paragliding aur snow adventures ke liye best spot. Chaliye fly karein!',
        nextSpotName: 'Hadimba Temple',
        floatingBadges: [
          { id: 'solang-itinerary', label: '+ Add to Itinerary', cost: 0, type: 'itinerary', top: '50%', left: '20%' },
          { id: 'solang-cable-car', label: '+ Cable Car Ropeway Ticket (₹500)', cost: 500, type: 'activity', top: '65%', left: '60%' },
        ],
        panorama: {
          ambientColor: '#e0f2fe',
          skyTop: '#0284c7',
          skyHorizon: '#bae6fd',
          groundColor: '#0f172a',
          accentGlow: '#38bdf8',
          monumentName: 'Solang Alpine Glade 360°',
          atmosphere: 'High Alpine Crisp Atmosphere with Snow Glint',
        },
      },
      {
        id: 'hadimba-temple',
        name: 'Hadimba Devi Temple',
        subtitle: 'Ancient Cedar Forest Sanctuary',
        cost: 100,
        category: 'Culture',
        rating: 4.7,
        reviewsCount: 980,
        duration: '1.5 Hours',
        bestTime: 'Late Morning',
        description: 'Pagoda-style wooden temple built in 1553 surrounded by towering centuries-old deodar trees.',
        highlights: ['Carved Deodar Wood', 'Cedar Grove Trails', 'Himachali Architecture'],
        wikiTitle: 'Hidimba Devi Temple',
        realPhotoUrl: 'https://images.unsplash.com/photo-1597074866923-dc0589150358?q=85&w=2400&auto=format&fit=crop',
        lat: 32.2492,
        lng: 77.1709,
        speechQuote: 'Dhungri Van ke ghane cedar deodar jangal mein Hadimba Temple ki wooden carving dekhiye.',
        nextSpotName: 'Atal Tunnel & Sissu',
        floatingBadges: [
          { id: 'hadimba-itinerary', label: '+ Add to Itinerary', cost: 0, type: 'itinerary', top: '55%', left: '22%' },
          { id: 'hadimba-forest-guide', label: '+ Cedar Forest Guided Walk (₹200)', cost: 200, type: 'activity', top: '62%', left: '62%' },
        ],
        panorama: {
          ambientColor: '#dcfce7',
          skyTop: '#064e3b',
          skyHorizon: '#10b981',
          groundColor: '#14532d',
          accentGlow: '#22c55e',
          monumentName: 'Dhungri Pine Forest Glade',
          atmosphere: 'Evergreen Canopy Shafts of Sunlight',
        },
      },
      {
        id: 'atal-tunnel',
        name: 'Atal Tunnel & Sissu',
        subtitle: 'Trans-Himalayan Gateway to Lahaul',
        cost: 400,
        category: 'Scenic',
        rating: 4.9,
        reviewsCount: 1540,
        duration: '4 Hours',
        bestTime: 'Midday',
        description: 'Engineering marvel emerging into the dramatic barren moonscapes and hanging waterfalls of Sissu valley.',
        highlights: ['Sissu Waterfall', 'Lahaul Riverbed', 'Dramatic Valley Shift'],
        wikiTitle: 'Atal Tunnel',
        realPhotoUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=85&w=2400&auto=format&fit=crop',
        lat: 32.4417,
        lng: 77.1667,
        speechQuote: 'World longest highway tunnel cross karte hi Lahaul valley aur Sissu waterfall ka breathtaking scene!',
        nextSpotName: 'Solang Valley',
        floatingBadges: [
          { id: 'atal-itinerary', label: '+ Add to Itinerary', cost: 0, type: 'itinerary', top: '52%', left: '20%' },
          { id: 'sissu-waterfall-pass', label: '+ Sissu Waterfall Zip Access (₹300)', cost: 300, type: 'activity', top: '60%', left: '65%' },
        ],
        panorama: {
          ambientColor: '#ede9fe',
          skyTop: '#1e1b4b',
          skyHorizon: '#818cf8',
          groundColor: '#312e81',
          accentGlow: '#a78bfa',
          monumentName: 'Sissu Glacier Valley Basin',
          atmosphere: 'Crystalline Himalayan Panorama & Glacier Stream',
        },
      },
    ],
  },
  {
    id: 'goa',
    name: 'Goa Coastline',
    state: 'Sun, Sand & Arabian Sea',
    tagline: 'Golden Beaches, Sunset Shacks & Portuguese Heritage',
    description: 'Vibrant coastal escapes, watersports, and lively beachside dining shared among friends.',
    heroImage: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?q=80&w=800&auto=format&fit=crop',
    startingPrice: 900,
    spots: [
      {
        id: 'vagator-cliff',
        name: 'Vagator Cliff & Chapora Fort',
        subtitle: 'Dramatic Rocky Coves & "Dil Chahta Hai" Bastion',
        cost: 200,
        category: 'Beach',
        rating: 4.8,
        reviewsCount: 2200,
        duration: '2 Hours',
        bestTime: 'Golden Sunset',
        description: 'Iconic red laterite cliff fort overlooking crashing turquoise waves and Ozran beach sands.',
        highlights: ['Panoramic Sea Horizon', 'Iconic Photo Points', 'Sunset Breeze'],
        wikiTitle: 'Chapora Fort',
        realPhotoUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?q=85&w=2400&auto=format&fit=crop',
        lat: 15.6053,
        lng: 73.7381,
        speechQuote: 'Dil Chahta Hai iconic fort bastions! Arabian sea ka grand 360 view friends ke sath experience karein.',
        nextSpotName: 'Palolem Crescent Bay',
        floatingBadges: [
          { id: 'vagator-itinerary', label: '+ Add to Itinerary', cost: 0, type: 'itinerary', top: '55%', left: '22%' },
          { id: 'chapora-sunset-entry', label: '+ Bastion Sunset Reserved Spot (₹200)', cost: 200, type: 'activity', top: '65%', left: '60%' },
        ],
        panorama: {
          ambientColor: '#fef08a',
          skyTop: '#ea580c',
          skyHorizon: '#facc15',
          groundColor: '#7c2d12',
          accentGlow: '#eab308',
          monumentName: 'Chapora Red Bastion Overlook',
          atmosphere: 'Tropical Ocean Sunset with Crimson Cloud Wisps',
        },
      },
      {
        id: 'palolem-bay',
        name: 'Palolem Crescent Bay',
        subtitle: 'Tranquil South Goa Lagoon & Kayaking',
        cost: 350,
        category: 'Beach',
        rating: 4.9,
        reviewsCount: 1780,
        duration: '3 Hours',
        bestTime: 'Early Morning',
        description: 'Crescent-shaped calm bay lined with coconut palms, vibrant beach huts, and gentle dolphin waters.',
        highlights: ['Sea Kayaking', 'Monkey Island View', 'Palm-fringed Coast'],
        wikiTitle: 'Palolem Beach',
        realPhotoUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=85&w=2400&auto=format&fit=crop',
        lat: 15.0101,
        lng: 74.0232,
        speechQuote: 'Palolem Crescent bay ki calm waves aur sea kayaking vibes. Perfect relaxing day with squad!',
        nextSpotName: 'Vagator Cliff',
        floatingBadges: [
          { id: 'palolem-itinerary', label: '+ Add to Itinerary', cost: 0, type: 'itinerary', top: '54%', left: '20%' },
          { id: 'palolem-kayak-rental', label: '+ Twin Sea Kayak 1hr (₹350)', cost: 350, type: 'activity', top: '63%', left: '65%' },
        ],
        panorama: {
          ambientColor: '#ccfbf1',
          skyTop: '#0d9488',
          skyHorizon: '#5eead4',
          groundColor: '#134e4a',
          accentGlow: '#14b8a6',
          monumentName: 'Palolem Coconut Cove 360°',
          atmosphere: 'Warm Tropical Turquoise Shallows & Palm Shadows',
        },
      },
    ],
  },
];
