'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  X,
  QrCode,
  Camera,
  CheckCircle2,
  Upload,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { parseUpiQrPayload, UPI_VPA_REGEX } from '../../lib/financial/upi-engine';
import { toast } from 'sonner';

interface ScanMerchantQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVendor: (vendor: { name: string; upiId: string; amount?: number }) => void;
}

export const ScanMerchantQrModal: React.FC<ScanMerchantQrModalProps> = ({
  isOpen,
  onClose,
  onSelectVendor,
}) => {
  const [activeMode, setActiveMode] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedSuccess, setScannedSuccess] = useState(false);

  // Manual fallback inputs
  const [manualUpi, setManualUpi] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Video & Canvas references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  const handleQrDetected = useCallback(
    (rawContent: string) => {
      const parsed = parseUpiQrPayload(rawContent);
      if (parsed.isValid && parsed.payeeVpa) {
        const detectedVpa = parsed.payeeVpa;
        const detectedName = parsed.payeeName || detectedVpa.split('@')[0].toUpperCase();
        const detectedAmount = parsed.amount;

        setScannedSuccess(true);
        stopCamera();
        toast.success(`Merchant QR Detected: ${detectedName}! ⚡`, {
          description: `VPA: ${detectedVpa}${detectedAmount ? ` • ₹${detectedAmount}` : ''}`,
        });
        setTimeout(() => {
          onSelectVendor({
            name: detectedName,
            upiId: detectedVpa,
            amount: detectedAmount,
          });
          onClose();
          setScannedSuccess(false);
        }, 500);
      } else {
        toast.error('Scanned QR is not a valid UPI Payment code', {
          description: parsed.error || 'Please point at a BharatPe, Paytm, PhonePe, or GPay standee.',
        });
      }
    },
    [onClose, onSelectVendor, stopCamera]
  );

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      handleQrDetected(code.data);
      return;
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }, [handleQrDetected]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setIsScanning(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setCameraError(
        error.name === 'NotAllowedError'
          ? 'Camera permission denied. Please enable camera access in your browser or upload a photo.'
          : error.message || 'Unable to start camera preview.'
      );
      setIsScanning(false);
    }
  }, [scanFrame]);

  useEffect(() => {
    if (isOpen && activeMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeMode, startCamera, stopCamera]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          handleQrDetected(code.data);
        } else {
          toast.error('No UPI QR Code found in image', {
            description: 'Ensure the QR code is clearly visible and well-lit.',
          });
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedVpa = manualUpi.trim().toLowerCase();
    if (!UPI_VPA_REGEX.test(trimmedVpa)) {
      setManualError('Please enter a valid UPI VPA (e.g. cafe1947@okicici or merchant@upi)');
      return;
    }

    const name = manualName.trim() || trimmedVpa.split('@')[0].toUpperCase();
    const amountNum = manualAmount ? parseFloat(manualAmount) : undefined;

    onSelectVendor({
      name,
      upiId: trimmedVpa,
      amount: amountNum && !isNaN(amountNum) ? amountNum : undefined,
    });
    toast.success(`Merchant Set: ${name} (${trimmedVpa})`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white border border-[#E5EAF1] rounded-xl shadow-xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5EAF1] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#173B70]/10 text-[#173B70] flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#172B4D]">Merchant UPI Scanner</h3>
              <p className="text-xs text-[#64748B]">Scan counter standee or UPI QR code</p>
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

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-[#E5EAF1] bg-[#F4F7FB] p-1">
          <button
            type="button"
            onClick={() => {
              setActiveMode('camera');
              setCameraError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all ${
              activeMode === 'camera'
                ? 'bg-white text-[#173B70] shadow-xs'
                : 'text-[#64748B] hover:text-[#172B4D]'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Live Camera</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveMode('upload');
              stopCamera();
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all ${
              activeMode === 'upload'
                ? 'bg-white text-[#173B70] shadow-xs'
                : 'text-[#64748B] hover:text-[#172B4D]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveMode('manual');
              stopCamera();
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all ${
              activeMode === 'manual'
                ? 'bg-white text-[#173B70] shadow-xs'
                : 'text-[#64748B] hover:text-[#172B4D]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Manual Entry</span>
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* Viewport Area */}
        <div className="p-5 flex flex-col items-center">
          {activeMode === 'camera' && (
            <div className="w-full flex flex-col items-center">
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-xl bg-slate-900 border border-[#E5EAF1] overflow-hidden flex items-center justify-center shadow-inner">
                {/* Corner markers */}
                <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-white rounded-tl z-20" />
                <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-white rounded-tr z-20" />
                <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-white rounded-bl z-20" />
                <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-white rounded-br z-20" />

                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />

                {scannedSuccess && (
                  <div className="absolute inset-0 bg-white/95 z-30 flex flex-col items-center justify-center p-4">
                    <CheckCircle2 className="w-10 h-10 text-[#0A9B78] animate-bounce mb-2" />
                    <span className="text-sm font-bold text-[#172B4D]">Merchant Detected!</span>
                    <span className="text-xs text-[#64748B]">Applying details...</span>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 bg-white/95 z-30 flex flex-col items-center justify-center p-4 text-center">
                    <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
                    <p className="text-xs text-[#172B4D] font-medium mb-3">{cameraError}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs text-[#172B4D] font-medium flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveMode('upload')}
                        className="px-3 py-1.5 rounded-lg bg-[#1685D4] text-white text-xs font-semibold"
                      >
                        Upload Photo
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-[#64748B] mt-3 text-center">
                Point at any Indian UPI QR standee (BharatPe, Paytm, PhonePe, Google Pay)
              </p>
            </div>
          )}

          {activeMode === 'upload' && (
            <div className="w-full flex flex-col items-center py-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-sm h-48 border-2 border-dashed border-[#CBD5E1] hover:border-[#1685D4] rounded-xl flex flex-col items-center justify-center p-6 cursor-pointer bg-[#F4F7FB] hover:bg-slate-100 transition-all text-center group"
              >
                <div className="w-10 h-10 rounded-xl bg-white border border-[#E5EAF1] text-[#1685D4] flex items-center justify-center mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-[#172B4D]">
                  Click to select QR photo or screenshot
                </p>
                <p className="text-[11px] text-[#64748B] mt-1">PNG, JPG, or WebP</p>
              </div>
            </div>
          )}

          {activeMode === 'manual' && (
            <form onSubmit={handleManualSubmit} className="w-full space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#172B4D] block mb-1">
                  Merchant UPI ID (VPA) *
                </label>
                <input
                  type="text"
                  value={manualUpi}
                  onChange={(e) => {
                    setManualUpi(e.target.value);
                    setManualError(null);
                  }}
                  placeholder="e.g. cafe1947@okicici or zostel@hdfcbank"
                  className="w-full bg-[#F4F7FB] border border-[#E5EAF1] focus:border-[#1685D4] rounded-lg px-3 py-2 text-xs font-mono text-[#172B4D] placeholder-slate-400"
                  required
                />
                {manualError && (
                  <p className="text-[11px] text-[#DC3545] mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{manualError}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-[#172B4D] block mb-1">
                  Merchant / Shop Name (Optional)
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Cafe 1947 Riverside"
                  className="w-full bg-[#F4F7FB] border border-[#E5EAF1] focus:border-[#1685D4] rounded-lg px-3 py-2 text-xs text-[#172B4D] placeholder-slate-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#172B4D] block mb-1">
                  Bill Amount in ₹ (Optional)
                </label>
                <input
                  type="number"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="e.g. 4000"
                  className="w-full bg-[#F4F7FB] border border-[#E5EAF1] focus:border-[#1685D4] rounded-lg px-3 py-2 text-xs text-[#172B4D] placeholder-slate-400 font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#173B70] hover:bg-[#1685D4] text-white font-medium text-xs transition-colors shadow-xs"
              >
                Apply Merchant Details
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
