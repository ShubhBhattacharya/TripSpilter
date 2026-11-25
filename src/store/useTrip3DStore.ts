import { create } from 'zustand';
import { DESTINATIONS, Destination, Spot } from '@/data/destinations';

export type ExperienceStage = 'entrance' | 'walking' | 'desk' | 'virtual-tour' | 'bill';
export type GuideAnimation = 'Idle' | 'Waving' | 'Walking' | 'Pointing' | 'Thankful';
export type GuideLanguage = 'hi' | 'en';
export type SpeechStatus =
  | 'idle'
  | 'preparing'
  | 'generating'
  | 'playing'
  | 'paused'
  | 'completed'
  | 'blocked'
  | 'unavailable';

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
  destinationIntroOpen: boolean;

  // Voice & AI Guide state
  guideLanguage: GuideLanguage;
  autoNarrate: boolean;
  isSpeaking: boolean;
  speechStatus: SpeechStatus;
  currentExplanation: string;
  lastSpeechError: string | null;

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
  setAudioEnabled: (enabled: boolean) => void;
  setActiveHotspot: (hotspot: string | null) => void;
  setDestinationIntroOpen: (open: boolean) => void;
  setGuideLanguage: (lang: GuideLanguage) => void;
  setAutoNarrate: (enabled: boolean) => void;
  setSpeechState: (patch: {
    isSpeaking?: boolean;
    speechStatus?: SpeechStatus;
    currentExplanation?: string;
    lastSpeechError?: string | null;
  }) => void;
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
  selectedCityId: defaultCity.id,
  currentSpotIndex: 0,
  selectedSpotIds: initialSpotIds,
  addedActivities: [],
  friendsCount: 4,
  isAudioEnabled: true,
  isOrbiting: false,
  activeHotspot: null,
  destinationIntroOpen: false,

  guideLanguage: 'hi',
  autoNarrate: true,
  isSpeaking: false,
  speechStatus: 'idle',
  currentExplanation: '',
  lastSpeechError: null,

  setStage: (stage) => {
    let anim: GuideAnimation = 'Idle';
    if (stage === 'entrance') anim = 'Waving';
    else if (stage === 'walking') anim = 'Walking';
    else if (stage === 'desk') anim = 'Pointing';
    else if (stage === 'virtual-tour') anim = 'Pointing';
    else if (stage === 'bill') anim = 'Thankful';

    set({
      stage,
      guideAnimation: anim,
      ...(stage !== 'desk' ? { destinationIntroOpen: false } : {}),
    });
  },

  setGuideAnimation: (guideAnimation) => set({ guideAnimation }),

  setSelectedCityId: (cityId) => {
    const prevId = get().selectedCityId;
    const city = DESTINATIONS.find((d) => d.id === cityId) || DESTINATIONS[0];
    if (prevId === city.id) {
      return;
    }
    set({
      selectedCityId: city.id,
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

  setAudioEnabled: (isAudioEnabled) => set({ isAudioEnabled }),

  setActiveHotspot: (activeHotspot) => set({ activeHotspot }),

  setDestinationIntroOpen: (destinationIntroOpen) => set({ destinationIntroOpen }),

  setGuideLanguage: (guideLanguage) => set({ guideLanguage }),

  setAutoNarrate: (autoNarrate) => set({ autoNarrate }),

  setSpeechState: (patch) => set((s) => ({ ...s, ...patch })),

  resetExperience: () => {
    const firstCity = DESTINATIONS[0];
    set({
      stage: 'entrance',
      guideAnimation: 'Waving',
      selectedCityId: firstCity.id,
      currentSpotIndex: 0,
      selectedSpotIds: firstCity.spots.map((s) => s.id),
      addedActivities: [],
      friendsCount: 4,
      activeHotspot: null,
      destinationIntroOpen: false,
      isSpeaking: false,
      speechStatus: 'idle',
      currentExplanation: '',
      lastSpeechError: null,
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
