import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { initiateDokuPayment, getDokuTransaction, getDokuVenueConfig } from '../../services/supabaseService.js';

/**
 * DOKU Payment Modal Component
 * Initiates online payment through DOKU gateway
 * Shows payment status and redirects to checkout URL
 */
export default function DokuPaymentModal({
  isOpen,
  booking,
  venueId,
  onClose,
  onPaymentSuccess,
  onPaymentFailed,
  auth,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dokuOrderId, setDokuOrderId] = useState(null);
  const [transactionId, setTransactionId] = useState(null);
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle | initiating | awaiting | completed | failed
  const [dokuConfig, setDokuConfig] = useState(null);
  const [pollCount, setPollCount] = useState(0);

  // Fetch DOKU config on mount
  useEffect(() => {
    if (!isOpen || !venueId) return;

    const loadConfig = async () => {
      const { data, error: err } = await getDokuVenueConfig(venueId);
      if (err) {
        setError('DOKU payment tidak tersedia untuk venue ini');
        console.error('Error loading DOKU config:', err);
      } else {
        setDokuConfig(data);
      }
    };

    loadConfig();
  }, [isOpen, venueId]);

  // Initiate DOKU payment
  const handleInitiatePayment = useCallback(async () => {
    if (!booking?.id || !venueId || !auth?.id) {
      setError('Data booking tidak lengkap');
      return;
    }

    setLoading(true);
    setError('');
    setPaymentStatus('initiating');

    try {
      const { data: transaction, error: err, dokuOrderId: orderId } = await initiateDokuPayment(
        booking.id,
        venueId,
        {
          customer_email: auth.email || `customer_${booking.id}@stadione.id`,
          customer_phone: booking.customer_phone,
          court_info: booking.court_name,
          initiated_by: auth.id,
        }
      );

      if (err) throw new Error(err);
      if (!transaction) throw new Error('Failed to create transaction');

      setDokuOrderId(orderId);
      setTransactionId(transaction.id);

      // In production, call DOKU API here to create checkout session
      // For now, we simulate checkout URL
      const checkoutUrlSimulated = `https://doku.gateway.sandbox.com/checkout?order_id=${orderId}`;
      setCheckoutUrl(checkoutUrlSimulated);
      setPaymentStatus('awaiting');

      // Start polling for payment status every 5 seconds (max 2 minutes)
      setPollCount(0);
    } catch (err) {
      console.error('Error initiating DOKU payment:', err.message);
      setError(`Gagal memulai pembayaran: ${err.message}`);
      setPaymentStatus('failed');
    } finally {
      setLoading(false);
    }
  }, [booking, venueId, auth]);

  // Poll for payment status
  useEffect(() => {
    if (!transactionId || paymentStatus !== 'awaiting' || pollCount >= 24) return; // 24 * 5s = 120s max

    const timer = setInterval(async () => {
      try {
        const { data: transaction, error: err } = await getDokuTransaction(dokuOrderId);
        if (err) {
          console.error('Error polling payment status:', err);
          return;
        }

        if (transaction?.status === 'completed') {
          setPaymentStatus('completed');
          if (onPaymentSuccess) onPaymentSuccess(transaction);
          setPollCount(0);
          clearInterval(timer);
        } else if (transaction?.status === 'failed' || transaction?.status === 'expired') {
          setPaymentStatus('failed');
          setError(`Pembayaran ${transaction.status === 'failed' ? 'gagal' : 'kadaluarsa'}`);
          if (onPaymentFailed) onPaymentFailed(transaction);
          setPollCount(0);
          clearInterval(timer);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }

      setPollCount((prev) => prev + 1);
    }, 5000);

    return () => clearInterval(timer);
  }, [transactionId, paymentStatus, dokuOrderId, onPaymentSuccess, onPaymentFailed, pollCount]);

  if (!isOpen) return null;

  const isConfigValid = dokuConfig?.is_enabled && dokuConfig?.doku_merchant_id;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-600 text-white p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">Pembayaran Online</h2>
          <button
            onClick={onClose}
            disabled={paymentStatus === 'initiating' || paymentStatus === 'awaiting'}
            className="text-white hover:bg-emerald-700 p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Config Warning */}
          {!isConfigValid && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  DOKU tidak terkonfigurasi untuk venue ini
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Hubungi owner venue untuk mengaktifkan pembayaran online
                </p>
              </div>
            </div>
          )}

          {/* Payment Status */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-gray-900">Ringkasan Pembayaran</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Booking ID:</span>
                <span className="font-mono text-gray-900">{booking?.id?.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Pembayaran:</span>
                <span className="font-bold text-lg text-emerald-600">
                  Rp {(booking?.total_price || 0).toLocaleString('id-ID')}
                </span>
              </div>
              {booking?.customer_name && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Nama Pelanggan:</span>
                  <span className="text-gray-900">{booking.customer_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Status Message */}
          {paymentStatus === 'idle' && !error && (
            <div className="text-center py-4">
              <p className="text-gray-600 text-sm">
                Klik tombol di bawah untuk memulai pembayaran melalui DOKU
              </p>
            </div>
          )}

          {paymentStatus === 'initiating' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-gray-600 text-sm">Memproses pembayaran...</p>
            </div>
          )}

          {paymentStatus === 'awaiting' && checkoutUrl && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex gap-3">
                <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900 text-sm">
                    Menunggu pembayaran...
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Silakan selesaikan pembayaran dalam 15 menit
                  </p>
                </div>
              </div>
            </div>
          )}

          {paymentStatus === 'completed' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-900 text-sm">
                  Pembayaran Berhasil!
                </p>
                <p className="text-xs text-green-700 mt-1">
                  Booking Anda telah dikonfirmasi
                </p>
              </div>
            </div>
          )}

          {paymentStatus === 'failed' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-900 text-sm">
                  {error || 'Pembayaran Gagal'}
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Silakan coba lagi atau hubungi support
                </p>
              </div>
            </div>
          )}

          {error && paymentStatus === 'idle' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* DOKU Order ID Display */}
          {dokuOrderId && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Order ID</p>
              <p className="text-sm font-mono text-gray-900 break-all">{dokuOrderId}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="bg-gray-50 border-t p-6 flex gap-3">
          {paymentStatus === 'idle' || paymentStatus === 'failed' ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleInitiatePayment}
                disabled={loading || !isConfigValid}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {paymentStatus === 'failed' ? 'Coba Lagi' : 'Bayar Sekarang'}
              </button>
            </>
          ) : paymentStatus === 'initiating' ? (
            <button
              disabled
              className="w-full px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed font-medium flex items-center justify-center gap-2"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses...
            </button>
          ) : paymentStatus === 'awaiting' ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Tutup
              </button>
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-center"
              >
                Lanjut Bayar
              </a>
            </>
          ) : paymentStatus === 'completed' ? (
            <button
              onClick={() => {
                onClose();
                // Reset modal state for next use
                setPaymentStatus('idle');
                setDokuOrderId(null);
                setTransactionId(null);
                setCheckoutUrl(null);
              }}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
            >
              Selesai
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
