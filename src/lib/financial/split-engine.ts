/**
 * TripSplit Core Financial Engine
 * All calculations use integer paise-based arithmetic to eliminate floating-point drift.
 * 1 Rupee = 100 Paise.
 */

export function toPaise(rupees: number): number {
  return Math.round((rupees + Number.EPSILON) * 100);
}

export function toRupees(paise: number): number {
  return Math.round(paise) / 100;
}

export interface EqualSplitInput {
  totalAmount: number;
  memberIds: string[];
}

export interface SplitResultShare {
  memberId: string;
  amount: number; // in Rupees
  amountPaise: number; // in Paise
}

/**
 * Calculates equal split distributing remainder paise to ensure
 * Sum of shares === totalAmount EXACTLY.
 * e.g. ₹100 among 3 people -> [₹33.34, ₹33.33, ₹33.33] (sum = 100.00).
 */
export function calculateEqualSplit(input: EqualSplitInput): SplitResultShare[] {
  const { totalAmount, memberIds } = input;
  if (!memberIds || memberIds.length === 0) {
    throw new Error('Cannot split among zero members');
  }
  if (totalAmount < 0) {
    throw new Error('Total amount cannot be negative');
  }

  const totalPaise = toPaise(totalAmount);
  const count = memberIds.length;
  const baseSharePaise = Math.floor(totalPaise / count);
  const remainderPaise = totalPaise % count;

  return memberIds.map((memberId, index) => {
    // Distribute remainder 1 paise to the first 'remainderPaise' members
    const sharePaise = baseSharePaise + (index < remainderPaise ? 1 : 0);
    return {
      memberId,
      amount: toRupees(sharePaise),
      amountPaise: sharePaise,
    };
  });
}

export interface ExactSplitInput {
  totalAmount: number;
  shares: { memberId: string; amount: number }[];
}

/**
 * Validates and normalizes exact custom shares, checking for over or under-allocation.
 */
export function validateAndCalculateExactSplit(input: ExactSplitInput): {
  isValid: boolean;
  difference: number;
  shares: SplitResultShare[];
  error?: string;
} {
  const totalPaise = toPaise(input.totalAmount);
  let allocatedPaise = 0;

  const shares: SplitResultShare[] = [];

  for (const s of input.shares) {
    if (s.amount < 0) {
      return {
        isValid: false,
        difference: 0,
        shares: [],
        error: `Negative share not allowed for member ${s.memberId}`,
      };
    }
    const sharePaise = toPaise(s.amount);
    allocatedPaise += sharePaise;
    shares.push({
      memberId: s.memberId,
      amount: toRupees(sharePaise),
      amountPaise: sharePaise,
    });
  }

  const diffPaise = totalPaise - allocatedPaise;

  if (diffPaise !== 0) {
    return {
      isValid: false,
      difference: toRupees(diffPaise),
      shares,
      error:
        diffPaise > 0
          ? `Under-allocated by ₹${toRupees(diffPaise)}`
          : `Over-allocated by ₹${toRupees(Math.abs(diffPaise))}`,
    };
  }

  return {
    isValid: true,
    difference: 0,
    shares,
  };
}

export interface ItemizedBillItem {
  id: string;
  name: string;
  price: number; // in Rupees
  assignedMemberIds: string[];
}

export interface ItemizedSplitInput {
  items: ItemizedBillItem[];
  gstPercentage?: number; // e.g. 5 for 5%
  serviceCharge?: number; // flat in Rupees
  discount?: number; // flat in Rupees
}

/**
 * Itemized split calculation distributing taxes/charges proportionally to item consumptions.
 */
export function calculateItemizedSplit(input: ItemizedSplitInput): {
  subtotal: number;
  gstAmount: number;
  serviceCharge: number;
  discount: number;
  grandTotal: number;
  memberShares: { [memberId: string]: SplitResultShare };
} {
  const memberItemPaise: { [memberId: string]: number } = {};
  let subtotalPaise = 0;

  for (const item of input.items) {
    const itemPaise = toPaise(item.price);
    subtotalPaise += itemPaise;

    if (!item.assignedMemberIds || item.assignedMemberIds.length === 0) {
      throw new Error(`Item "${item.name}" must be assigned to at least one member`);
    }

    const perMemberBase = Math.floor(itemPaise / item.assignedMemberIds.length);
    const remainder = itemPaise % item.assignedMemberIds.length;

    item.assignedMemberIds.forEach((mId, idx) => {
      const share = perMemberBase + (idx < remainder ? 1 : 0);
      memberItemPaise[mId] = (memberItemPaise[mId] || 0) + share;
    });
  }

  const gstPercentage = input.gstPercentage || 0;
  const gstPaise = Math.round((subtotalPaise * gstPercentage) / 100);
  const serviceChargePaise = toPaise(input.serviceCharge || 0);
  const discountPaise = toPaise(input.discount || 0);

  const grandTotalPaise = Math.max(0, subtotalPaise + gstPaise + serviceChargePaise - discountPaise);
  const netExtraPaise = gstPaise + serviceChargePaise - discountPaise;

  // Pro-rate extra charges/discounts based on member's share of subtotal
  const allMemberIds = Object.keys(memberItemPaise);
  let totalDistributedPaise = 0;
  const result: { [memberId: string]: SplitResultShare } = {};

  allMemberIds.forEach((mId) => {
    const memberBase = memberItemPaise[mId];
    const ratio = subtotalPaise > 0 ? memberBase / subtotalPaise : 1 / allMemberIds.length;
    const extraShare = Math.round(netExtraPaise * ratio);
    const finalMemberPaise = Math.max(0, memberBase + extraShare);

    totalDistributedPaise += finalMemberPaise;
    result[mId] = {
      memberId: mId,
      amount: toRupees(finalMemberPaise),
      amountPaise: finalMemberPaise,
    };
  });

  // Distribute any rounding drift to match grandTotalPaise strictly
  const driftPaise = grandTotalPaise - totalDistributedPaise;
  if (driftPaise !== 0 && allMemberIds.length > 0) {
    const targetMember = allMemberIds[0];
    const adjustedPaise = result[targetMember].amountPaise + driftPaise;
    result[targetMember] = {
      memberId: targetMember,
      amount: toRupees(adjustedPaise),
      amountPaise: adjustedPaise,
    };
  }

  return {
    subtotal: toRupees(subtotalPaise),
    gstAmount: toRupees(gstPaise),
    serviceCharge: toRupees(serviceChargePaise),
    discount: toRupees(discountPaise),
    grandTotal: toRupees(grandTotalPaise),
    memberShares: result,
  };
}

export interface RawExpense {
  id: string;
  paidBy: string;
  totalAmount: number;
}

export interface RawSplit {
  expenseId: string;
  userId: string;
  amountOwed: number;
  status: string; // 'pending' | 'paid' etc.
}

export interface RawSettlement {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  status: string; // 'verified_paid' | 'manually_reported_paid' etc.
}

export interface MemberNetBalance {
  userId: string;
  totalPaid: number; // What they paid out of pocket
  totalShare: number; // Their total consumed share
  settlementsPaid: number; // Money they paid to settle
  settlementsReceived: number; // Money they received as settlement
  netBalance: number; // Positive = owed money, Negative = owes money
}

/**
 * Computes individual member net balances across all trip expenses and settlements.
 * Core invariant: Sum of all net balances === 0.
 */
export function calculateNetBalances(params: {
  memberIds: string[];
  expenses: RawExpense[];
  splits: RawSplit[];
  settlements: RawSettlement[];
}): {
  balances: { [userId: string]: MemberNetBalance };
  isZeroSum: boolean;
  totalTripSpend: number;
} {
  const { memberIds, expenses, splits, settlements } = params;

  const paidPaise: { [uid: string]: number } = {};
  const sharePaise: { [uid: string]: number } = {};
  const settPaidPaise: { [uid: string]: number } = {};
  const settRecvPaise: { [uid: string]: number } = {};

  memberIds.forEach((id) => {
    paidPaise[id] = 0;
    sharePaise[id] = 0;
    settPaidPaise[id] = 0;
    settRecvPaise[id] = 0;
  });

  let totalTripSpendPaise = 0;

  // Add payments by payer
  for (const exp of expenses) {
    const amtPaise = toPaise(exp.totalAmount);
    totalTripSpendPaise += amtPaise;
    paidPaise[exp.paidBy] = (paidPaise[exp.paidBy] || 0) + amtPaise;
  }

  // Add consumption shares
  for (const sp of splits) {
    const amtPaise = toPaise(sp.amountOwed);
    sharePaise[sp.userId] = (sharePaise[sp.userId] || 0) + amtPaise;
  }

  // Add settlements (only consider settled / verified / reported paid)
  for (const st of settlements) {
    if (['verified_paid', 'manually_reported_paid', 'SETTLED', 'settled'].includes(st.status)) {
      const amtPaise = toPaise(st.amount);
      settPaidPaise[st.fromUserId] = (settPaidPaise[st.fromUserId] || 0) + amtPaise;
      settRecvPaise[st.toUserId] = (settRecvPaise[st.toUserId] || 0) + amtPaise;
    }
  }

  const balances: { [userId: string]: MemberNetBalance } = {};
  let netSumPaise = 0;

  for (const uid of memberIds) {
    const p = paidPaise[uid] || 0;
    const s = sharePaise[uid] || 0;
    const sp = settPaidPaise[uid] || 0;
    const sr = settRecvPaise[uid] || 0;

    const netPaise = (p - s) + (sp - sr);
    netSumPaise += netPaise;

    balances[uid] = {
      userId: uid,
      totalPaid: toRupees(p),
      totalShare: toRupees(s),
      settlementsPaid: toRupees(sp),
      settlementsReceived: toRupees(sr),
      netBalance: toRupees(netPaise),
    };
  }

  return {
    balances,
    isZeroSum: Math.abs(netSumPaise) <= 1, // Within 1 paise float tolerance
    totalTripSpend: toRupees(totalTripSpendPaise),
  };
}

export interface OptimizedTransfer {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

/**
 * Greedy minimum cash flow settlement optimization algorithm.
 * Minimizes the number of peer-to-peer transactions required to settle all debts.
 */
export function optimizeSettlements(
  balances: { [userId: string]: MemberNetBalance }
): OptimizedTransfer[] {
  // Collect debtors (negative net) and creditors (positive net) in paise
  const debtors: { userId: string; amountPaise: number }[] = [];
  const creditors: { userId: string; amountPaise: number }[] = [];

  for (const uid of Object.keys(balances)) {
    const netPaise = toPaise(balances[uid].netBalance);
    if (netPaise < -1) {
      debtors.push({ userId: uid, amountPaise: Math.abs(netPaise) });
    } else if (netPaise > 1) {
      creditors.push({ userId: uid, amountPaise: netPaise });
    }
  }

  debtors.sort((a, b) => b.amountPaise - a.amountPaise);
  creditors.sort((a, b) => b.amountPaise - a.amountPaise);

  const transfers: OptimizedTransfer[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settledPaise = Math.min(debtor.amountPaise, creditor.amountPaise);

    if (settledPaise > 0) {
      transfers.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amount: toRupees(settledPaise),
      });
    }

    debtor.amountPaise -= settledPaise;
    creditor.amountPaise -= settledPaise;

    if (debtor.amountPaise <= 1) dIdx++;
    if (creditor.amountPaise <= 1) cIdx++;
  }

  return transfers;
}
