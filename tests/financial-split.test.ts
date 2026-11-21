import { describe, it, expect } from 'vitest';
import {
  toPaise,
  toRupees,
  calculateEqualSplit,
  validateAndCalculateExactSplit,
  calculateItemizedSplit,
  calculateNetBalances,
  optimizeSettlements,
} from '../src/lib/financial/split-engine';

describe('Financial Engine — Integer Paise Arithmetic', () => {
  it('converts Rupees to Paise with float precision protection', () => {
    expect(toPaise(100)).toBe(10000);
    expect(toPaise(33.33)).toBe(3333);
    expect(toPaise(33.34)).toBe(3334);
    expect(toPaise(0.01)).toBe(1);
    expect(toPaise(0)).toBe(0);
  });

  it('converts Paise back to Rupees', () => {
    expect(toRupees(10000)).toBe(100);
    expect(toRupees(3333)).toBe(33.33);
    expect(toRupees(3334)).toBe(33.34);
    expect(toRupees(1)).toBe(0.01);
  });
});

describe('calculateEqualSplit — Remainder Paise Distribution', () => {
  it('splits ₹100 among 3 people without losing 1 paise (zero remainder drift)', () => {
    const shares = calculateEqualSplit({
      totalAmount: 100,
      memberIds: ['m1', 'm2', 'm3'],
    });

    expect(shares).toHaveLength(3);
    expect(shares[0].amount).toBe(33.34);
    expect(shares[1].amount).toBe(33.33);
    expect(shares[2].amount).toBe(33.33);

    const totalSum = shares.reduce((acc, s) => acc + s.amount, 0);
    expect(Math.round(totalSum * 100) / 100).toBe(100.0);

    const paiseSum = shares.reduce((acc, s) => acc + s.amountPaise, 0);
    expect(paiseSum).toBe(10000);
  });

  it('splits ₹1,000 among 7 people with exact sum invariant', () => {
    const members = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'];
    const shares = calculateEqualSplit({
      totalAmount: 1000,
      memberIds: members,
    });

    const paiseSum = shares.reduce((acc, s) => acc + s.amountPaise, 0);
    expect(paiseSum).toBe(100000);

    const rupeeSum = shares.reduce((acc, s) => acc + s.amount, 0);
    expect(Math.round(rupeeSum * 100) / 100).toBe(1000.0);
  });

  it('throws on zero members', () => {
    expect(() => calculateEqualSplit({ totalAmount: 500, memberIds: [] })).toThrow(
      'Cannot split among zero members'
    );
  });

  it('throws on negative amount', () => {
    expect(() => calculateEqualSplit({ totalAmount: -50, memberIds: ['m1'] })).toThrow(
      'Total amount cannot be negative'
    );
  });
});

describe('validateAndCalculateExactSplit — Allocation Bounds', () => {
  it('validates perfectly allocated shares', () => {
    const result = validateAndCalculateExactSplit({
      totalAmount: 1000,
      shares: [
        { memberId: 'm1', amount: 500 },
        { memberId: 'm2', amount: 300 },
        { memberId: 'm3', amount: 200 },
      ],
    });

    expect(result.isValid).toBe(true);
    expect(result.difference).toBe(0);
    expect(result.shares).toHaveLength(3);
  });

  it('detects under-allocation with residual amount', () => {
    const result = validateAndCalculateExactSplit({
      totalAmount: 1000,
      shares: [
        { memberId: 'm1', amount: 400 },
        { memberId: 'm2', amount: 400 },
      ],
    });

    expect(result.isValid).toBe(false);
    expect(result.difference).toBe(200);
    expect(result.error).toContain('Under-allocated by ₹200');
  });

  it('detects over-allocation with excess amount', () => {
    const result = validateAndCalculateExactSplit({
      totalAmount: 1000,
      shares: [
        { memberId: 'm1', amount: 600 },
        { memberId: 'm2', amount: 500 },
      ],
    });

    expect(result.isValid).toBe(false);
    expect(result.difference).toBe(-100);
    expect(result.error).toContain('Over-allocated by ₹100');
  });

  it('rejects negative share amounts', () => {
    const result = validateAndCalculateExactSplit({
      totalAmount: 500,
      shares: [{ memberId: 'm1', amount: -100 }],
    });

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Negative share not allowed');
  });
});

describe('calculateItemizedSplit — Pro-Rated Taxes & Service Charges', () => {
  it('pro-rates 5% GST and service charge across consumed items exactly', () => {
    const result = calculateItemizedSplit({
      items: [
        { id: 'i1', name: 'Pizza', price: 1000, assignedMemberIds: ['m1'] },
        { id: 'i2', name: 'Trout', price: 1000, assignedMemberIds: ['m2'] },
      ],
      gstPercentage: 5, // 5% = ₹100 total
      serviceCharge: 100, // ₹100 total
    });

    expect(result.subtotal).toBe(2000);
    expect(result.gstAmount).toBe(100);
    expect(result.serviceCharge).toBe(100);
    expect(result.grandTotal).toBe(2200);

    const m1Share = result.memberShares['m1'];
    const m2Share = result.memberShares['m2'];

    expect(m1Share.amount).toBe(1100);
    expect(m2Share.amount).toBe(1100);

    const totalCalculated = m1Share.amount + m2Share.amount;
    expect(totalCalculated).toBe(2200);
  });
});

describe('calculateNetBalances — Zero-Sum Invariant', () => {
  it('guarantees sum(netBalances) === 0 across all expenses', () => {
    const memberIds = ['aarav', 'priya', 'rohan', 'kabir'];
    const expenses = [
      {
        id: 'e1',
        paidBy: 'aarav',
        totalAmount: 4000,
      },
      {
        id: 'e2',
        paidBy: 'priya',
        totalAmount: 1500,
      },
    ];
    const splits = [
      { id: 's1', expenseId: 'e1', userId: 'aarav', amountOwed: 1000, status: 'pending' },
      { id: 's2', expenseId: 'e1', userId: 'priya', amountOwed: 1000, status: 'pending' },
      { id: 's3', expenseId: 'e1', userId: 'rohan', amountOwed: 1000, status: 'pending' },
      { id: 's4', expenseId: 'e1', userId: 'kabir', amountOwed: 1000, status: 'pending' },
      { id: 's5', expenseId: 'e2', userId: 'rohan', amountOwed: 750, status: 'pending' },
      { id: 's6', expenseId: 'e2', userId: 'kabir', amountOwed: 750, status: 'pending' },
    ];

    const { balances, isZeroSum } = calculateNetBalances({
      memberIds,
      expenses,
      splits,
      settlements: [],
    });

    expect(isZeroSum).toBe(true);

    // Aarav paid 4000, owes 1000 -> +3000
    expect(balances['aarav'].netBalance).toBe(3000);
    // Priya paid 1500, owes 1000 -> +500
    expect(balances['priya'].netBalance).toBe(500);
    // Rohan paid 0, owes 1000 + 750 -> -1750
    expect(balances['rohan'].netBalance).toBe(-1750);
    // Kabir paid 0, owes 1000 + 750 -> -1750
    expect(balances['kabir'].netBalance).toBe(-1750);

    // Sum of all net balances in paise MUST be strictly 0
    const sumPaise = Object.values(balances).reduce((acc, b) => acc + toPaise(b.netBalance), 0);
    expect(sumPaise).toBe(0);
  });
});

describe('optimizeSettlements — Minimum Cash Flow Algorithm', () => {
  it('reduces peer-to-peer debt cycles into minimal transfers', () => {
    // A owes B 100, B owes C 100 -> A should just pay C 100
    const balances = {
      userA: {
        userId: 'userA',
        totalPaid: 0,
        totalShare: 100,
        settlementsPaid: 0,
        settlementsReceived: 0,
        netBalance: -100,
      },
      userB: {
        userId: 'userB',
        totalPaid: 100,
        totalShare: 100,
        settlementsPaid: 0,
        settlementsReceived: 0,
        netBalance: 0,
      },
      userC: {
        userId: 'userC',
        totalPaid: 100,
        totalShare: 0,
        settlementsPaid: 0,
        settlementsReceived: 0,
        netBalance: 100,
      },
    };

    const settlements = optimizeSettlements(balances);

    expect(settlements).toHaveLength(1);
    expect(settlements[0].fromUserId).toBe('userA');
    expect(settlements[0].toUserId).toBe('userC');
    expect(settlements[0].amount).toBe(100);
  });
});
