import { create } from 'zustand';
import { DESTINATIONS, Destination, Spot } from '@/data/destinations';

export type ExperienceStage = 'entrance' | 'walking' | 'desk' | 'virtual-tour' | 'bill';
export type GuideAnimation = 'Idle' | 'Waving' | 'Walking' | 'Pointing' | 'Thankful';

export interface ExtraActivity {
  id: string;
  name: string;
  cost: number;
}

interface Trip3DState {
  stage: ExperienceStage;
  guideAnimation: GuideAnimation;
  selectedCityId: string;
  currentSpotIndex: number;
  selectedSpotIds: string[];
  addedActivities: ExtraActivity[];
  friendsCount: number;
  isAudioEnabled: boolean;
  isOrbiting: boolean;
  activeHotspot: string | null;

  // Actions
  setStage: (stage: ExperienceStage) => void;
  setGuideAnimation: (animation: GuideAnimation) => void;
  setSelectedCityId: (cityId: string) => void;
  setCurrentSpotIndex: (index: number) => void;
  toggleSpot: (spotId: string) => void;
  toggleActivity: (activity: ExtraActivity) => void;
  selectAllCitySpots: () => void;
  setFriendsCount: (count: number) => void;
  toggleAudio: () => void;
  setActiveHotspot: (hotspot: string | null) => void;
  resetExperience: () => void;

  // Computed Helpers
  getSelectedCity: () => Destination;
  getCurrentSpot: () => Spot;
  getSelectedSpots: () => Spot[];
  getTotalItemsCount: () => number;
  getTotalCost: () => number;
  getPerPersonCost: () => number;
}

const defaultCity = DESTINATIONS[0];
const initialSpotIds = defaultCity.spots.map((s) => s.id);

export const useTrip3DStore = create<Trip3DState>((set, get) => ({
  stage: 'entrance',
  guideAnimation: 'Waving',
  selectedCityId: 'jaipur',
  currentSpotIndex: 0,
  selectedSpotIds: initialSpotIds,
  addedActivities: [],
  friendsCount: 4,
  isAudioEnabled: false,
  isOrbiting: false,
  activeHotspot: null,

  setStage: (stage) => {
    let anim: GuideAnimation = 'Idle';
    if (stage === 'entrance') anim = 'Waving';
    else if (stage === 'walking') anim = 'Walking';
    else if (stage === 'desk') anim = 'Pointing';
    else if (stage === 'virtual-tour') anim = 'Pointing';
    else if (stage === 'bill') anim = 'Thankful';

    set({ stage, guideAnimation: anim });
  },

  setGuideAnimation: (guideAnimation) => set({ guideAnimation }),

  setSelectedCityId: (cityId) => {
    const city = DESTINATIONS.find((d) => d.id === cityId) || DESTINATIONS[0];
    set({
      selectedCityId: cityId,
      currentSpotIndex: 0,
      selectedSpotIds: city.spots.map((s) => s.id),
      addedActivities: [],
    });
  },

  setCurrentSpotIndex: (currentSpotIndex) => set({ currentSpotIndex }),

  toggleSpot: (spotId) => {
    const current = get().selectedSpotIds;
    if (current.includes(spotId)) {
      if (current.length > 1) {
        set({ selectedSpotIds: current.filter((id) => id !== spotId) });
      }
    } else {
      set({ selectedSpotIds: [...current, spotId] });
    }
  },

  toggleActivity: (activity) => {
    const current = get().addedActivities;
    const exists = current.some((a) => a.id === activity.id);
    if (exists) {
      set({ addedActivities: current.filter((a) => a.id !== activity.id) });
    } else {
      set({ addedActivities: [...current, activity] });
    }
  },

  selectAllCitySpots: () => {
    const city = get().getSelectedCity();
    set({ selectedSpotIds: city.spots.map((s) => s.id) });
  },

  setFriendsCount: (friendsCount) => set({ friendsCount: Math.max(1, Math.min(20, friendsCount)) }),

  toggleAudio: () => set((s) => ({ isAudioEnabled: !s.isAudioEnabled })),

  setActiveHotspot: (activeHotspot) => set({ activeHotspot }),

  resetExperience: () => {
    set({
      stage: 'entrance',
      guideAnimation: 'Waving',
      selectedCityId: 'jaipur',
      currentSpotIndex: 0,
      selectedSpotIds: DESTINATIONS[0].spots.map((s) => s.id),
      addedActivities: [],
      friendsCount: 4,
      activeHotspot: null,
    });
  },

  getSelectedCity: () => {
    const id = get().selectedCityId;
    return DESTINATIONS.find((d) => d.id === id) || DESTINATIONS[0];
  },

  getCurrentSpot: () => {
    const city = get().getSelectedCity();
    const idx = get().currentSpotIndex;
    return city.spots[idx] || city.spots[0];
  },

  getSelectedSpots: () => {
    const city = get().getSelectedCity();
    const ids = get().selectedSpotIds;
    return city.spots.filter((s) => ids.includes(s.id));
  },

  getTotalItemsCount: () => {
    return get().selectedSpotIds.length + get().addedActivities.length;
  },

  getTotalCost: () => {
    const spots = get().getSelectedSpots();
    const spotCost = spots.reduce((acc, s) => acc + s.cost, 0);
    const activityCost = get().addedActivities.reduce((acc, a) => acc + a.cost, 0);
    return spotCost + activityCost;
  },

  getPerPersonCost: () => {
    const total = get().getTotalCost();
    const count = get().friendsCount || 1;
    return Math.ceil(total / count);
  },
}));
