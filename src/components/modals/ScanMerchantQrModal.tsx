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
        throw new Error('Camera access is not supported in this browser environment.');
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
      console.warn('Camera access denied or unavailable:', error);
      setCameraError(
        error.name === 'NotAllowedError'
          ? 'Camera permission denied. Please enable camera access in your browser or upload an image.'
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
          toast.error('No UPI QR Code found in the uploaded image', {
            description: 'Ensure the QR code is clearly visible and well lit.',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#111827] border border-[#1F2937] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#1F2937] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Merchant UPI Scanner</h3>
              <p className="text-xs text-slate-400">Scan standee or counter QR for direct split</p>
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

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-[#1F2937] bg-slate-950/60 p-1">
          <button
            type="button"
            onClick={() => {
              setActiveMode('camera');
              setCameraError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeMode === 'camera'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
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
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeMode === 'upload'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
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
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeMode === 'manual'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Manual Entry</span>
          </button>
        </div>

        {/* Hidden Canvas for QR Extraction */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Viewport Area */}
        <div className="p-5 flex flex-col items-center">
          {activeMode === 'camera' && (
            <div className="w-full flex flex-col items-center">
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl bg-black border-2 border-slate-700 overflow-hidden flex items-center justify-center shadow-inner">
                {/* Corner reticle markers */}
                <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl z-20" />
                <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr z-20" />
                <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl z-20" />
                <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br z-20" />

                {/* Laser scan line animation */}
                {isScanning && !cameraError && !scannedSuccess && (
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse shadow-md shadow-emerald-400/80 z-20 top-1/2 -translate-y-1/2" />
                )}

                {/* Camera Video Stream */}
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* Scanned Success Overlay */}
                {scannedSuccess && (
                  <div className="absolute inset-0 bg-slate-950/90 z-30 flex flex-col items-center justify-center p-4">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce mb-2" />
                    <span className="text-sm font-bold text-white">Merchant QR Detected!</span>
                    <span className="text-xs text-emerald-300">Applying merchant details...</span>
                  </div>
                )}

                {/* Camera Error Overlay */}
                {cameraError && (
                  <div className="absolute inset-0 bg-slate-950/95 z-30 flex flex-col items-center justify-center p-4 text-center">
                    <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
                    <p className="text-xs text-slate-300 font-medium mb-3">{cameraError}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveMode('upload')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold"
                      >
                        Upload Photo
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-3 text-center">
                Point at any Indian UPI standee (BharatPe, Paytm, PhonePe, Google Pay)
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
                className="w-full max-w-sm h-52 border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl flex flex-col items-center justify-center p-6 cursor-pointer bg-slate-950/50 hover:bg-slate-900/50 transition-all text-center group"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-800 group-hover:bg-emerald-500/20 text-slate-400 group-hover:text-emerald-400 flex items-center justify-center transition-colors mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                  Click to select merchant QR screenshot
                </p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG, or WebP photo of standee</p>
              </div>
            </div>
          )}

          {activeMode === 'manual' && (
            <form onSubmit={handleManualSubmit} className="w-full space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
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
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500"
                  required
                />
                {manualError && (
                  <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{manualError}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Merchant / Shop Name (Optional)
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Cafe 1947 Riverside"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Bill Amount in ₹ (Optional)
                </label>
                <input
                  type="number"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="e.g. 4000"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-lg shadow-emerald-500/20"
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
