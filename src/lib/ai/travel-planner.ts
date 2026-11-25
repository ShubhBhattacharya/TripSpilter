import { DESTINATIONS, type Destination } from '../../data/destinations';
import type { ItineraryDayPlan, StructuredCard } from './types';

export function findBestDestination(query: string): Destination | null {
  const cleaned = query.toLowerCase().trim();
  if (!cleaned) return null;

  const exact = DESTINATIONS.find(
    (d) =>
      d.id.toLowerCase() === cleaned ||
      d.name.toLowerCase() === cleaned ||
      d.name.toLowerCase().split(',')[0].trim() === cleaned
  );
  if (exact) return exact;

  // Check full city name presence inside longer user sentences (handles multi-word cities like Port Blair / Mount Abu)
  const sentenceCityMatch = DESTINATIONS.find((d) => {
    const cityBase = d.name.toLowerCase().split(',')[0].split('(')[0].trim();
    return cityBase.length >= 3 && cleaned.includes(cityBase);
  });
  if (sentenceCityMatch) return sentenceCityMatch;

  const matches = DESTINATIONS.filter(
    (d) =>
      d.name.toLowerCase().includes(cleaned) ||
      d.state.toLowerCase().includes(cleaned) ||
      d.region.toLowerCase().includes(cleaned) ||
      d.tagline.toLowerCase().includes(cleaned) ||
      d.spots.some((s) => s.name.toLowerCase().includes(cleaned))
  );
  if (matches.length > 0) return matches[0];

  // Token match across multi-word prompts
  const tokens = cleaned
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  for (const dest of DESTINATIONS) {
    const cityFirst = dest.name.toLowerCase().split(',')[0].trim();
    if (tokens.some((tok) => cityFirst === tok || dest.id.toLowerCase() === tok)) {
      return dest;
    }
  }

  for (const dest of DESTINATIONS) {
    const haystack = `${dest.name} ${dest.state} ${dest.region}`.toLowerCase();
    if (tokens.some((tok) => haystack.includes(tok))) {
      return dest;
    }
  }

  return null;
}

export function buildDestinationItineraryPlan(params: {
  destinationQuery: string;
  days?: number;
  travelers?: number;
  language?: 'hi' | 'en';
}): {
  card: Extract<StructuredCard, { type: 'itinerary' }>;
  summaryText: string;
} {
  const days = Math.min(7, Math.max(1, Math.round(params.days || 3)));
  const travelers = Math.min(20, Math.max(1, Math.round(params.travelers || 2)));
  const dest = findBestDestination(params.destinationQuery) || DESTINATIONS[0];
  const spots = dest.spots;

  const schedule: ItineraryDayPlan[] = [];
  let totalActivitiesInr = 0;

  for (let day = 1; day <= days; day++) {
    const spotA = spots[(day - 1) % spots.length];
    const spotB = spots[day % spots.length];
    const spotCost = (spotA?.cost || 0) + (spotB?.cost || 0);
    const stayAndFoodPerPerson = dest.startingPrice;
    const dayCost = Math.round(stayAndFoodPerPerson * travelers + spotCost * travelers);
    totalActivitiesInr += dayCost;

    const isLastDay = day === days && days > 1;
    schedule.push({
      day,
      title:
        day === 1
          ? `Arrival & ${spotA?.name || dest.name}`
          : isLastDay
            ? `Final Exploration & Departure (${spotA?.name || dest.state})`
            : `${spotA?.name || 'Local Sightseeing'} & ${spotB?.name || 'Cultural Evening'}`,
      morning: spotA
        ? `${spotA.name} (${spotA.bestTime}) — ${spotA.highlights.slice(0, 2).join(', ') || spotA.subtitle}.`
        : `Explore local markets in ${dest.name}.`,
      afternoon: spotB && spotB.id !== spotA?.id
        ? `Visit ${spotB.name} (${spotB.duration}) & regional lunch (${spotB.category}).`
        : `Relaxed local dining and scenic viewpoint walk.`,
      evening: isLastDay
        ? `Collect souvenirs, finalize group expense splits on TripSplit, and depart.`
        : `Local cafe trail, heritage walk, and settle day expenses with your group.`,
      estimatedCostInr: dayCost,
    });
  }

  const card: Extract<StructuredCard, { type: 'itinerary' }> = {
    type: 'itinerary',
    destinationId: dest.id,
    destinationName: dest.name,
    state: dest.state,
    days,
    travelers,
    budgetEstimateInr: totalActivitiesInr,
    heroImage: dest.heroImage,
    schedule,
    disclaimer:
      'Catalog Estimate built from curated destination spot prices & starting daily baselines in TripSplit. Not a live hotel/flight booking quote.',
  };

  const summaryText =
    params.language === 'hi'
      ? `${dest.name} ke liye ${days}-din ka itinerary (${travelers} travelers) taiyar hai. Estimated total ~₹${totalActivitiesInr.toLocaleString('en-IN')} (catalog baseline — live hotel/flight rates alag se API credentials se load honge).`
      : `Built a ${days}-day itinerary for ${dest.name} (${travelers} travelers) grounded in TripSplit's destination catalog. Estimated catalog baseline: ₹${totalActivitiesInr.toLocaleString('en-IN')}.`;

  return { card, summaryText };
}

export function buildTravelSafetyCard(params: {
  destination?: string;
  temperatureC?: number | null;
  rainProbPercent?: number | null;
  language?: 'hi' | 'en';
}): Extract<StructuredCard, { type: 'safety' }> {
  const helplines = [
    { label: 'National Emergency (Police / Fire / Ambulance)', number: '112', note: '24x7 pan-India toll-free' },
    { label: 'Ministry of Tourism Helpline', number: '1363', note: 'Multilingual tourist support across India' },
    { label: 'Indian Railways Helpline', number: '139', note: 'Train inquiry, security & medical help' },
    { label: 'Women Helpline', number: '1091', note: '24x7 emergency assistance' },
  ];

  const tips: string[] = [
    'Keep offline ID copies, emergency contacts, and TripSplit booking references saved locally.',
    'Confirm official UPI handle inside verified merchant QR receipts before authorizing group payments.',
  ];

  let weatherAlert: string | null = null;
  if (typeof params.rainProbPercent === 'number' && params.rainProbPercent >= 50) {
    weatherAlert = `High precipitation chance (${params.rainProbPercent}%). Carry rain gear and allow buffer travel time.`;
    tips.push('Pack waterproof footwear, poncho/umbrella, and avoid landslide-prone night drives in hill regions.');
  }
  if (typeof params.temperatureC === 'number' && params.temperatureC <= 10) {
    weatherAlert = `${weatherAlert ? `${weatherAlert} ` : ''}Low temperature (${params.temperatureC}°C) expected. Pack layered thermal clothing.`;
    tips.push('Carry thermal layers, gloves, and keep batteries warm in cold weather.');
  }

  return {
    type: 'safety',
    destination: params.destination,
    helplines,
    weatherAlert,
    packingTips: tips,
    source: 'Official Indian Emergency Directory & Open-Meteo Telemetry',
  };
}

export function buildTransitLinksCard(
  origin: string,
  destination: string
): Extract<StructuredCard, { type: 'provider_status' }> {
  const origClean = origin.trim() || 'New Delhi';
  const destClean = destination.trim() || 'Manali';

  return {
    type: 'provider_status',
    category: 'transit',
    title: `Transit Search Links: ${origClean} → ${destClean}`,
    status: 'redirect_only',
    message:
      'Live rail/bus seat inventory APIs are not connected. Use official provider links below ("Continue to provider to book") — TripSplit never invents train/bus schedules or fares.',
    links: [
      {
        label: 'Google Maps Directions & Transit',
        url: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origClean)}&destination=${encodeURIComponent(destClean)}&travelmode=transit`,
      },
      {
        label: 'IRCTC Rail Connect (Continue to provider)',
        url: 'https://www.irctc.co.in/nget/train-search',
      },
      {
        label: 'RedBus Intercity Buses (Continue to provider)',
        url: 'https://www.redbus.in/',
      },
    ],
  };
}
