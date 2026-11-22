'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { formatInr } from '../../lib/upi';
import { toast } from 'sonner';

interface BillItem {
  name: string;
  price: number;
}

interface AiBillScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyBill: (billData: {
    merchantName: string;
    totalAmount: number;
    items: BillItem[];
  }) => void;
}

export const AiBillScanModal: React.FC<AiBillScanModalProps> = ({
  isOpen,
  onClose,
  onApplyBill,
}) => {
  const [scanning, setScanning] = useState(false);
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);

  // Editable bill state
  const [merchantName, setMerchantName] = useState('Cafe 1947 Riverside Manali');
  const [invoiceNumber, setInvoiceNumber] = useState('INV-8821');
  const [items, setItems] = useState<BillItem[]>([
    { name: 'Woodfired Funghi Pizza', price: 950 },
    { name: 'Grilled Rainbow Trout', price: 1100 },
    { name: 'Penne Alfredo Pasta', price: 650 },
    { name: 'Apple Cider & Drinks', price: 900 },
  ]);
  const [gstPercent, setGstPercent] = useState<number>(5);
  const [serviceCharge, setServiceCharge] = useState<number>(200);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const subtotal = items.reduce((sum, it) => sum + (it.price || 0), 0);
  const gstAmount = Math.round((subtotal * gstPercent) / 100);
  const totalAmount = subtotal + gstAmount + (serviceCharge || 0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setOcrWarning(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const res = await fetch('/api/ocr/parse-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        });

        const data = await res.json();

        if (!data.configured) {
          setOcrWarning(
            data.error ||
              'GEMINI_API_KEY is not configured in .env.local. Please review or manually enter bill items below.'
          );
        } else if (data.items && data.items.length > 0) {
          if (data.merchantName) setMerchantName(data.merchantName);
          if (data.invoiceNumber) setInvoiceNumber(data.invoiceNumber);
          setItems(data.items);
          if (data.serviceCharge !== undefined) setServiceCharge(data.serviceCharge);
          toast.success('Receipt scanned & parsed successfully! 🧾');
        } else if (data.error) {
          setOcrWarning(data.error);
        }
      } catch (err: unknown) {
        const error = err as Error;
        setOcrWarning(`OCR request failed: ${error.message}`);
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, { name: '', price: 0 }]);
  };

  const handleUpdateItem = (index: number, field: 'name' | 'price', value: string | number) => {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== index) return it;
        return {
          ...it,
          [field]: field === 'price' ? Number(value) || 0 : value,
        };
      })
    );
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((_, idx) => idx !== index));
    }
  };

  const handleConfirm = () => {
    if (items.length === 0 || totalAmount <= 0) {
      toast.error('Bill must contain at least one item with a valid price.');
      return;
    }

    onApplyBill({
      merchantName: merchantName.trim() || 'Merchant Bill',
      totalAmount,
      items: items.filter((it) => it.name.trim() && it.price > 0),
    });
    toast.success(`Applied ${items.length} bill items totaling ${formatInr(totalAmount)}!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-xl max-h-[90vh] bg-white border border-[#E5EAF1] rounded-xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5EAF1] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#173B70]/10 text-[#173B70] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#1685D4]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#172B4D]">Bill OCR & Itemized Parser</h3>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-[#1685D4] font-semibold border border-blue-200">
                  Smart Parser
                </span>
              </div>
              <p className="text-xs text-[#64748B]">
                Upload physical receipt photo or edit bill line items
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#172B4D] hover:bg-[#F4F7FB] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Upload Button Banner */}
          <div className="p-4 rounded-xl bg-[#F4F7FB] border border-dashed border-[#CBD5E1] hover:border-[#1685D4] transition-colors flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white border border-[#E5EAF1] flex items-center justify-center text-[#1685D4] shrink-0">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#172B4D]">Scan Physical Bill</p>
                <p className="text-[11px] text-[#64748B]">
                  Select receipt photo for automated extraction
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={scanning}
              className="px-3 py-1.5 rounded-lg bg-[#1685D4] hover:bg-[#126bb0] text-white font-medium text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0 disabled:opacity-50"
            >
              {scanning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Parsing...</span>
                </>
              ) : (
                <span>Upload Bill Photo</span>
              )}
            </button>
          </div>

          {/* OCR Notice */}
          {ocrWarning && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-[#172B4D]">Vision Processing Notice</p>
                <p className="text-[11px] text-[#64748B] leading-relaxed">{ocrWarning}</p>
                <p className="text-[11px] text-[#64748B]">
                  You can edit the line items below manually to calculate the exact split.
                </p>
              </div>
            </div>
          )}

          {/* Merchant & Invoice Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#172B4D] uppercase tracking-wider block mb-1">
                Merchant / Restaurant Name
              </label>
              <input
                type="text"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className="w-full bg-[#F4F7FB] border border-[#E5EAF1] focus:border-[#1685D4] rounded-lg px-3 py-2 text-xs text-[#172B4D]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#172B4D] uppercase tracking-wider block mb-1">
                Invoice / Bill Ref
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full bg-[#F4F7FB] border border-[#E5EAF1] focus:border-[#1685D4] rounded-lg px-3 py-2 text-xs text-[#172B4D] font-mono"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#172B4D] uppercase tracking-wider">
                Bill Items ({items.length})
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-[#1685D4] hover:text-[#126bb0] font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleUpdateItem(index, 'name', e.target.value)}
                    placeholder="Item description"
                    className="flex-1 bg-[#F4F7FB] border border-[#E5EAF1] rounded-lg px-2.5 py-1.5 text-xs text-[#172B4D]"
                  />
                  <div className="relative w-28">
                    <span className="absolute left-2 top-1.5 text-[#64748B] text-xs">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={item.price || ''}
                      onChange={(e) => handleUpdateItem(index, 'price', e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#F4F7FB] border border-[#E5EAF1] rounded-lg pl-5 pr-2 py-1.5 text-xs text-[#172B4D] font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="p-1.5 text-[#64748B] hover:text-[#DC3545] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Taxes & Charges Breakdown */}
          <div className="p-3.5 rounded-lg bg-[#F4F7FB] border border-[#E5EAF1] space-y-2 text-xs">
            <div className="flex justify-between text-[#64748B]">
              <span>Items Subtotal:</span>
              <span className="font-mono text-[#172B4D]">₹{subtotal}</span>
            </div>

            <div className="flex items-center justify-between text-[#64748B]">
              <div className="flex items-center gap-1.5">
                <span>GST ({gstPercent}%):</span>
                <input
                  type="number"
                  value={gstPercent}
                  onChange={(e) => setGstPercent(Number(e.target.value) || 0)}
                  className="w-12 bg-white border border-[#E5EAF1] rounded px-1.5 py-0.5 text-[11px] text-[#172B4D] font-mono"
                />
              </div>
              <span className="font-mono text-[#172B4D]">₹{gstAmount}</span>
            </div>

            <div className="flex items-center justify-between text-[#64748B]">
              <div className="flex items-center gap-1.5">
                <span>Service Charge (₹):</span>
                <input
                  type="number"
                  value={serviceCharge}
                  onChange={(e) => setServiceCharge(Number(e.target.value) || 0)}
                  className="w-16 bg-white border border-[#E5EAF1] rounded px-1.5 py-0.5 text-[11px] text-[#172B4D] font-mono"
                />
              </div>
              <span className="font-mono text-[#172B4D]">₹{serviceCharge}</span>
            </div>

            <div className="pt-2 border-t border-[#E5EAF1] flex justify-between font-bold text-sm">
              <span className="text-[#172B4D]">Total Bill:</span>
              <span className="text-[#047857] num-inr font-bold">
                {formatInr(totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#E5EAF1] flex items-center justify-end gap-3 bg-[#F4F7FB]/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#172B4D]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-lg bg-[#173B70] hover:bg-[#1685D4] text-white font-medium text-xs flex items-center gap-1.5 shadow-xs transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Apply to Direct UPI Split</span>
          </button>
        </div>
      </div>
    </div>
  );
};
