'use client';

import React, { useState } from 'react';
import { Sidebar } from '../../components/layout/Sidebar';
import { BottomNav } from '../../components/layout/BottomNav';
import { TopHeader } from '../../components/layout/TopHeader';
import { VendorSplitTab } from '../../components/trips/VendorSplitTab';
import { ScanMerchantQrModal } from '../../components/modals/ScanMerchantQrModal';
import { AiBillScanModal } from '../../components/modals/AiBillScanModal';
import { defaultMembers } from '../../data/mockData';

export default function QrSplitPage() {
  const [vendorName, setVendorName] = useState('Cafe 1947 Manali');
  const [vendorUpi, setVendorUpi] = useState('cafe1947@okicici');
  const [amount, setAmount] = useState(4000);

  const [isScanMerchantOpen, setIsScanMerchantOpen] = useState(false);
  const [isAiBillScanOpen, setIsAiBillScanOpen] = useState(false);

  const handleVendorDetected = (v: { name: string; upiId: string; amount?: number }) => {
    setVendorName(v.name);
    setVendorUpi(v.upiId);
    if (v.amount) setAmount(v.amount);
  };

  const handleAiBillApplied = (billData: {
    merchantName: string;
    totalAmount: number;
    items: { name: string; price: number }[];
  }) => {
    setVendorName(billData.merchantName);
    setAmount(billData.totalAmount);
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col lg:flex-row">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-12">
        <TopHeader
          title="Direct-to-Vendor QR Split"
          onScanClick={() => setIsScanMerchantOpen(true)}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
          <VendorSplitTab
            members={defaultMembers}
            initialVendorName={vendorName}
            initialVendorUpiId={vendorUpi}
            initialAmount={amount}
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
