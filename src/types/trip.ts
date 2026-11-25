export type Currency = 'INR';

export interface DbProfile {
  id: string;
  display_name: string | null;
  upi_id: string | null;
  avatar_url: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  upiId: string;
  avatar: string;
  email: string;
  phone: string;
}

export interface TripMember {
  id: string;
  name: string;
  upiId: string;
  avatar: string;
  isCurrentUser?: boolean;
  color?: string;
}

export type TimelineCategory = 'Transport' | 'Stay' | 'Food' | 'Activity' | 'Sightseeing';

export interface ItineraryItem {
  id: string;
  day: number;
  time: string;
  title: string;
  location: string;
  category: TimelineCategory;
  notes?: string;
  mapsUrl: string;
  estimatedCost?: number;
  paidBy?: string;
  isCompleted?: boolean;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // member ids who voted
}

export interface GroupPoll {
  id: string;
  question: string;
  createdBy: string;
  createdAt: string;
  options: PollOption[];
  isClosed?: boolean;
}

export interface BookingVaultItem {
  id: string;
  title: string;
  category: 'Hotel' | 'Bus' | 'Flight' | 'Train' | 'Table Reservation' | 'Activity Pass';
  vendorName: string;
  bookingRef: string;
  date: string;
  totalAmount: number;
  bookedBy: string;
  status: 'Confirmed' | 'Pending Split' | 'Settled';
  documentType: 'PDF' | 'PNG' | 'Pass';
  attachmentUrl?: string;
  notes?: string;
}

export type SplitMode = 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'ITEMIZED';

export interface ItemizedBillItem {
  id: string;
  name: string;
  price: number;
  assignedMemberIds: string[];
}

export interface MemberSplitShare {
  memberId: string;
  name: string;
  upiId: string;
  avatar: string;
  shareAmount: number;
  isPaid: boolean;
  paidAt?: string;
  transactionRef?: string;
}

export interface VendorSplitBill {
  id: string;
  vendorName: string;
  vendorUpiId: string;
  billAmount: number;
  billNumber?: string;
  splitMode: SplitMode;
  notes?: string;
  createdAt: string;
  shares: MemberSplitShare[];
}

export interface DebtSettlement {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  status: 'PENDING' | 'SETTLED';
  settledAt?: string;
  notes?: string;
}

export interface Trip {
  id: string;
  title: string;
  tagline: string;
  destination: string;
  coverImage: string;
  startDate: string;
  endDate: string;
  budget: number;
  totalSpend: number;
  status: 'ACTIVE' | 'UPCOMING' | 'COMPLETED';
  members: TripMember[];
  itinerary: ItineraryItem[];
  polls: GroupPoll[];
  bookings: BookingVaultItem[];
  vendorSplits: VendorSplitBill[];
  debts: DebtSettlement[];
}
