'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Sparkles,
  Receipt,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl max-h-[90vh] bg-[#111827] border border-[#1F2937] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#1F2937] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">Bill OCR & Itemized Parser</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  SMART PARSER
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Upload physical receipt photo or edit bill line items
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Upload Button Banner */}
          <div className="p-4 rounded-xl bg-slate-950 border border-dashed border-slate-800 hover:border-emerald-500/50 transition-colors flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Scan Physical Receipt</p>
                <p className="text-[11px] text-slate-400">
                  Select a receipt photo for automatic parsing
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
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 disabled:opacity-50"
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

          {/* OCR Config Warning Alert (No Fake Mock) */}
          {ocrWarning && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-white">Vision API Notice</p>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">{ocrWarning}</p>
                <p className="text-[10px] text-slate-400">
                  You can edit the line items below manually to calculate the exact split.
                </p>
              </div>
            </div>
          )}

          {/* Merchant & Invoice Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                Merchant / Restaurant Name
              </label>
              <input
                type="text"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                Invoice / Bill Ref
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Bill Items ({items.length})
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
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
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                  <div className="relative w-28">
                    <span className="absolute left-2 top-1.5 text-slate-500 text-xs">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={item.price || ''}
                      onChange={(e) => handleUpdateItem(index, 'price', e.target.value)}
                      placeholder="0"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-5 pr-2 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Taxes & Charges Breakdown */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Items Subtotal:</span>
              <span className="font-mono text-white">₹{subtotal}</span>
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <div className="flex items-center gap-1.5">
                <span>GST ({gstPercent}%):</span>
                <input
                  type="number"
                  value={gstPercent}
                  onChange={(e) => setGstPercent(Number(e.target.value) || 0)}
                  className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-white font-mono"
                />
              </div>
              <span className="font-mono text-white">₹{gstAmount}</span>
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <div className="flex items-center gap-1.5">
                <span>Service Charge (₹):</span>
                <input
                  type="number"
                  value={serviceCharge}
                  onChange={(e) => setServiceCharge(Number(e.target.value) || 0)}
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-white font-mono"
                />
              </div>
              <span className="font-mono text-white">₹{serviceCharge}</span>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm">
              <span className="text-white">Total Bill:</span>
              <span className="text-emerald-400 num-inr font-black">
                {formatInr(totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#1F2937] flex items-center justify-end gap-3 bg-slate-950/40 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Apply to Direct-to-Vendor Split</span>
          </button>
        </div>
      </div>
    </div>
  );
};
