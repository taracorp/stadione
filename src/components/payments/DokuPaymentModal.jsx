import React, { useEffect, useState, useMemo } from 'react';
import { XCircle, ExternalLink, RefreshCcw, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  getDokuVenueConfig,
  initiateDokuPayment,
  fetchDokuTransactionByBooking,
} from '../../services/supabaseService.js';

const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-neutral-200">
          <div className="text-lg font-semibold text-neutral-900">{title}</div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900">
            <XCircle size={24} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default function DokuPaymentModal({ open, onClose, booking, venueId, onSuccess, onError }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [transaction, setTransaction] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState(null);

  const amount = useMemo(() => {
    if (!booking) return 0;
    return Number(booking.total_price || 0);
  }, [booking]);

  const configValidation = useMemo(() => {
    if (!config) return { ready: false, missing: [] };

    const normalizedEnvironment = config.environment === 'production' ? 'production' : 'sandbox';
    const missing = [];

    if (!String(config.checkout_base_url || '').trim()) missing.push('Checkout Base URL');
    if (normalizedEnvironment === 'production') {
      if (!String(config.business_id || '').trim()) missing.push('Business ID');
      if (!String(config.brand_id || '').trim()) missing.push('Brand ID');
      if (!String(config.merchant_id || '').trim()) missing.push('Merchant ID');
      if (!String(config.api_key || '').trim()) missing.push('API Key');
      if (!String(config.client_id || '').trim()) missing.push('Client ID');
      if (!String(config.secret_key || '').trim()) missing.push('Secret Key');
    }

    return {
      ready: missing.length === 0,
      missing,
    };
  }, [config]);

  useEffect(() => {
    if (!open || !booking || !venueId) return;
    setConfig(null);
    setCheckoutUrl('');
    setTransaction(null);
    setStatusMessage('Memuat konfigurasi DOKU...');
    setError(null);

    const loadConfig = async () => {
      try {
        const [configResponse, transactionResponse] = await Promise.all([
          getDokuVenueConfig(venueId),
          fetchDokuTransactionByBooking(booking.id),
        ]);

        if (configResponse.error) {
          setError(configResponse.error);
          setStatusMessage('Konfigurasi DOKU tidak ditemukan atau belum aktif.');
          return;
        }

        const resolvedConfig = configResponse.data || null;
        if (!resolvedConfig?.checkout_base_url) {
          setConfig(resolvedConfig);
          setError('Checkout Base URL DOKU belum dikonfigurasi.');
          setStatusMessage('Periksa konfigurasi DOKU di halaman pengaturan venue.');
          return;
        }

        setConfig(resolvedConfig);

        if (!transactionResponse.error && transactionResponse.data) {
          setTransaction(transactionResponse.data);
          setCheckoutUrl(transactionResponse.data.checkout_url || '');

          if (transactionResponse.data.status === 'completed') {
            setStatusMessage('Pembayaran DOKU untuk booking ini sudah selesai.');
          } else if (transactionResponse.data.status === 'pending') {
            setStatusMessage('Ditemukan transaksi DOKU pending. Anda bisa lanjutkan checkout.');
          } else {
            setStatusMessage(`Transaksi terakhir berstatus ${transactionResponse.data.status}. Anda bisa membuat checkout baru.`);
          }
          return;
        }

        setStatusMessage('Konfigurasi DOKU siap. Klik tombol untuk memulai checkout.');
      } catch (err) {
        console.error('Doku config load failed:', err);
        setError(err.message || 'Gagal memuat konfigurasi DOKU');
        setStatusMessage('Gagal memuat konfigurasi DOKU.');
      }
    };

    loadConfig();
  }, [open, booking, venueId]);

  useEffect(() => {
    if (!checkoutUrl || !transaction || !open) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetchDokuTransactionByBooking(booking.id);
        if (response.error) {
          console.warn('Polling DOKU transaction failed', response.error);
          return;
        }
        setTransaction(response.data);
        if (response.data?.status === 'completed') {
          setStatusMessage('Pembayaran DOKU berhasil terkonfirmasi.');
          clearInterval(interval);
          onSuccess?.(response.data);
        } else if (['failed', 'expired', 'cancelled'].includes(response.data?.status)) {
          setStatusMessage('Status pembayaran DOKU: ' + response.data.status);
          clearInterval(interval);
          onError?.(response.data);
        }
      } catch (err) {
        console.error('Polling DOKU transaction error:', err);
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [checkoutUrl, transaction, booking, open, onSuccess, onError]);

  const handleStartCheckout = async () => {
    if (!booking || !venueId) return;
    if (!configValidation.ready) {
      setError(`Konfigurasi DOKU belum lengkap: ${configValidation.missing.join(', ')}.`);
      setStatusMessage('Periksa konfigurasi DOKU di halaman pengaturan venue.');
      return;
    }

    if (!config?.checkout_base_url) {
      setError('DOKU checkout base URL belum dikonfigurasi.');
      setStatusMessage('Periksa konfigurasi DOKU di halaman pengaturan venue.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await initiateDokuPayment(booking.id, venueId, {
        amount,
        currency: 'IDR',
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone,
        return_url: typeof window !== 'undefined' ? window.location.href : null,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const transactionData = response.data?.transaction || response.data || null;
      const resolvedCheckoutUrl = response.checkout_url || response.data?.checkout_url || transactionData?.checkout_url || '';
      setCheckoutUrl(resolvedCheckoutUrl);
      setTransaction(transactionData);
      setStatusMessage('Checkout DOKU dibuat. Silakan selesaikan pembayaran di tab baru.');
      if (resolvedCheckoutUrl) {
        window.open(resolvedCheckoutUrl, '_blank');
      }
    } catch (err) {
      setError(err.message || 'Gagal memulai pembayaran DOKU.');
      setStatusMessage('Gagal memulai pembayaran DOKU.');
      onError?.({ message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleManualConfirm = async () => {
    if (!booking) return;
    onSuccess?.({
      booking_id: booking.id,
      status: 'completed',
      doku_order_id: transaction?.doku_order_id || null,
      checkout_url: checkoutUrl || null,
    });
  };

  const handleRefreshStatus = async () => {
    if (!booking) return;
    setStatusMessage('Memeriksa status transaksi...');
    const response = await fetchDokuTransactionByBooking(booking.id);
    if (response.error) {
      setError(response.error);
      return;
    }

    setError(null);
    setTransaction(response.data);
    setCheckoutUrl(response.data?.checkout_url || checkoutUrl);

    if (response.data?.status === 'completed') {
      setStatusMessage('Pembayaran DOKU berhasil terkonfirmasi.');
      onSuccess?.(response.data);
      return;
    }

    if (['failed', 'expired', 'cancelled'].includes(response.data?.status)) {
      setStatusMessage('Status pembayaran DOKU: ' + response.data.status);
      onError?.(response.data);
      return;
    }

    setStatusMessage('Status transaksi diperbarui.');
  };

  return (
    <Modal open={open} onClose={onClose} title="Pembayaran DOKU">
      <div className="space-y-4">
        <div className="text-sm text-neutral-500">
          Gunakan DOKU untuk memproses pembayaran online. Jika checkout aktif, link akan terbuka di tab baru.
        </div>

        <div className="grid gap-3">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Booking</div>
            <div className="font-semibold text-neutral-900">{booking?.customer_name || 'Tanpa nama'}</div>
            <div className="text-sm text-neutral-500">Rp {Number(amount).toLocaleString('id-ID')}</div>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-neutral-400 uppercase tracking-wide">Status</div>
              <span className="text-xs font-semibold text-neutral-600">{transaction?.status || 'Belum dimulai'}</span>
            </div>
            <div className="text-sm text-neutral-700">{statusMessage}</div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle size={18} />
              <div>{error}</div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {transaction?.status === 'pending' && checkoutUrl ? (
              <button
                type="button"
                onClick={() => window.open(checkoutUrl, '_blank')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white py-3 px-4 text-sm font-semibold hover:bg-indigo-700"
              >
                <ExternalLink size={16} /> Lanjutkan Checkout
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleStartCheckout}
              disabled={loading || !configValidation.ready}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white py-3 px-4 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              <ExternalLink size={16} />
              {transaction?.status === 'pending' ? 'Buat Checkout Baru' : 'Mulai Checkout DOKU'}
            </button>
            <button
              type="button"
              onClick={handleRefreshStatus}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white text-neutral-900 py-3 px-4 text-sm font-semibold hover:border-neutral-300"
            >
              <RefreshCcw size={16} /> Perbarui Status
            </button>
          </div>

          <button
            type="button"
            onClick={handleManualConfirm}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white py-3 px-4 text-sm font-semibold hover:bg-emerald-700"
          >
            <CheckCircle2 size={16} /> Konfirmasi Pembayaran Secara Manual
          </button>
        </div>
      </div>
    </Modal>
  );
}
