'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sidebar } from '../../components/layout/Sidebar';
import { BottomNav } from '../../components/layout/BottomNav';
import { TopHeader } from '../../components/layout/TopHeader';
import { VendorSplitTab } from '../../components/trips/VendorSplitTab';
import { ScanMerchantQrModal } from '../../components/modals/ScanMerchantQrModal';
import { AiBillScanModal, BillData } from '../../components/modals/AiBillScanModal';
import { defaultMembers } from '../../data/mockData';
import { useAuth } from '../../components/auth/AuthProvider';
import { TripMember, ItemizedBillItem } from '../../types/trip';

function QrSplitContent() {
  const searchParams = useSearchParams();
  const { user, profile, isConfigured } = useAuth();

  const initialVendor = searchParams.get('vendor') || '';
  const initialUpi = searchParams.get('upi') || '';
  const initialAmt = Number(searchParams.get('am') || 0) || 0;

  const [vendorName, setVendorName] = useState(initialVendor);
  const [vendorUpi, setVendorUpi] = useState(initialUpi);
  const [amount, setAmount] = useState(initialAmt);
  const [scannedItems, setScannedItems] = useState<ItemizedBillItem[]>([]);

  const [isScanMerchantOpen, setIsScanMerchantOpen] = useState(false);
  const [isAiBillScanOpen, setIsAiBillScanOpen] = useState(false);

  const activeMembers: TripMember[] =
    isConfigured && user
      ? [
          {
            id: user.id,
            name: profile?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'You',
            upiId: profile?.upi_id || '',
            avatar:
              profile?.avatar_url ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
            isCurrentUser: true,
          },
        ]
      : defaultMembers;

  const handleVendorDetected = (v: { name: string; upiId: string; amount?: number }) => {
    setVendorName(v.name);
    setVendorUpi(v.upiId);
    if (v.amount) setAmount(v.amount);
  };

  const handleAiBillApplied = (billData: BillData) => {
    setVendorName(billData.merchantName);
    setAmount(billData.totalAmount);
    setScannedItems(
      billData.items.map((it, i) => ({
        id: `ocr-${i + 1}`,
        name: it.name,
        price: it.price,
        assignedMemberIds: activeMembers.map((m) => m.id),
      }))
    );
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#172B4D] flex flex-col lg:flex-row">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-12">
        <TopHeader
          title="Direct-to-Vendor QR Split"
          onScanClick={() => setIsScanMerchantOpen(true)}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
          <VendorSplitTab
            key={`${vendorUpi}-${amount}-${scannedItems.length}`}
            members={activeMembers}
            initialVendorName={vendorName}
            initialVendorUpiId={vendorUpi}
            initialAmount={amount}
            initialItems={scannedItems}
            onOpenAiScanner={() => setIsAiBillScanOpen(true)}
          />
        </main>
      </div>

      <BottomNav onOpenQuickSplit={() => setIsScanMerchantOpen(true)} />

      <ScanMerchantQrModal
        isOpen={isScanMerchantOpen}
        onClose={() => setIsScanMerchantOpen(false)}
        onSelectVendor={handleVendorDetected}
      />

      <AiBillScanModal
        isOpen={isAiBillScanOpen}
        onClose={() => setIsAiBillScanOpen(false)}
        onApplyBill={handleAiBillApplied}
      />
    </div>
  );
}

export default function QrSplitPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F4F7FB]" />}>
      <QrSplitContent />
    </Suspense>
  );
}
