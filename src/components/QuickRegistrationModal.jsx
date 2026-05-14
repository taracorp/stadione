// ============ QUICK REGISTRATION MODAL ============
// 3-step registration flow: Info → Payment → Confirmation

import React, { useState, useCallback } from 'react';
import { ArrowRight, Check, ArrowLeft, AlertCircle } from 'lucide-react';
import { 
  attachTeamToRegistration,
  createTournamentRegistration, 
  confirmRegistrationPayment,
  createTeam,
} from '../services/registrationService.js';

const formatRupiah = (amount) => {
  if (!amount) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

const isMissingTeamsTableError = (message) => {
  const normalized = String(message || '').toLowerCase();
  return normalized.includes('public.teams')
    && (normalized.includes('schema cache') || normalized.includes('could not find the table'));
};

export const QuickRegistrationModal = ({
  isOpen,
  tournament,
  auth,
  onClose,
  onSuccess,
  onError,
}) => {
  const [step, setStep] = useState(1); // 1 = Info, 2 = Payment, 3 = Confirmation
  const [teamName, setTeamName] = useState('');
  const [agreeRules, setAgreeRules] = useState(false);
  const [agreeData, setAgreeData] = useState(false);
  const [agreeRegulation, setAgreeRegulation] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [registrationData, setRegistrationData] = useState(null);
  const [teamData, setTeamData] = useState(null);

  const regFee = Number(tournament?.regFee || tournament?.registrationFee || 0);
  const serviceFee = 5000;
  const total = regFee + serviceFee;
  const allChecked = agreeRules && agreeData && agreeRegulation;
  const canProceedPayment = paymentMethod && registrationData;

  const handleStep1Submit = useCallback(async () => {
    if (!teamName.trim() || !allChecked) {
      setError('Isi nama tim dan lengkapi semua checklist');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await createTournamentRegistration({
      tournamentId: tournament.id,
      userId: auth.id,
      registrantName: auth.name || auth.email,
      registrantEmail: auth.email,
      registrationType: tournament.sport === 'Esports' ? 'individual' : 'team',
      baseFee: regFee,
      slotLockMinutes: tournament.slotLockMinutes || 15,
      requiresReview: tournament.classification === 'official',
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    let createdRegistration = result.data;

    // Create team right away for team-based tournaments so workspace can open immediately.
    const isTeamRegistration = String(tournament.sport || '').toLowerCase() !== 'esports';
    if (isTeamRegistration) {
      const teamResult = await createTeam({
        tournamentId: tournament.id,
        coordinatorId: auth.id,
        teamName: teamName.trim(),
      });

      if (teamResult.error || !teamResult.data) {
        if (!isMissingTeamsTableError(teamResult.error)) {
          setLoading(false);
          setError(teamResult.error || 'Gagal membuat tim');
          return;
        }

        setTeamData(null);
      } else {
        setTeamData(teamResult.data);

        const linkedRegistration = await attachTeamToRegistration(createdRegistration.id, teamResult.data.id);
        if (!linkedRegistration.error && linkedRegistration.data) {
          createdRegistration = linkedRegistration.data;
        }
      }
    }

    setRegistrationData(createdRegistration);
    setStep(2);
  }, [teamName, allChecked, auth, tournament]);

  const handleStep2Submit = useCallback(async () => {
    if (!paymentMethod) {
      setError('Pilih metode pembayaran');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await confirmRegistrationPayment(
      registrationData.id,
      paymentMethod,
      null // No proof URL for mock payment
    );

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setRegistrationData(result.data || registrationData);
    setStep(3);
  }, [paymentMethod, registrationData]);

  const handleConfirmation = useCallback(() => {
    onSuccess?.({
      registration: registrationData,
      team: teamData,
      registrationId: registrationData.id,
      tournamentId: tournament.id,
      teamName,
      paymentMethod,
      uniqueTransferAmount: registrationData.unique_transfer_amount,
    });
    resetForm();
  }, [registrationData, teamData, tournament, teamName, paymentMethod, onSuccess]);

  const resetForm = () => {
    setStep(1);
    setTeamName('');
    setAgreeRules(false);
    setAgreeData(false);
    setAgreeRegulation(false);
    setPaymentMethod(null);
    setError(null);
    setRegistrationData(null);
    setTeamData(null);
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  const paymentMethods = [
    { id: 'qris', name: 'QRIS', desc: 'Scan dari semua e-wallet & m-banking', logo: 'QR' },
    { id: 'va_bca', name: 'Virtual Account BCA', logo: 'BCA', desc: 'Transfer via m-banking' },
    { id: 'va_mandiri', name: 'Virtual Account Mandiri', logo: 'MDR', desc: 'Transfer via m-banking' },
    { id: 'gopay', name: 'GoPay', logo: 'G', desc: 'Instant payment' },
    { id: 'ovo', name: 'OVO', logo: 'O', desc: 'Instant payment' },
  ];

  if (!isOpen || !tournament) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest font-bold text-neutral-500">/ PENDAFTARAN CEPAT</div>
            <h2 className="font-display text-2xl text-neutral-900">
              {step === 1 && 'Informasi Tim'}
              {step === 2 && 'Pilih Pembayaran'}
              {step === 3 && 'Slot Secured!'}
            </h2>
          </div>
          <button onClick={handleClose} className="text-neutral-500 hover:text-neutral-900">
            ✕
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-4 border-b border-neutral-200 flex gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? 'bg-[#E11D2E]' : 'bg-neutral-200'}`} />
          ))}
        </div>

        {/* Content */}
        <div className="p-6 lg:p-8">
          {error && (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 flex gap-3 text-sm text-rose-800">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-neutral-900 mb-2">Nama Tim</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder={`cth: ${tournament.host || 'FC Senayan'} United`}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900"
                />
                <div className="text-xs text-neutral-500 mt-1">Nama tim akan tampil di turnamen dan papan peringkat</div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-bold text-neutral-900">Persetujuan</div>
                <label className="flex items-start gap-3 p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeRules}
                    onChange={(e) => setAgreeRules(e.target.checked)}
                    className="w-5 h-5 rounded mt-0.5"
                  />
                  <span className="text-sm text-neutral-700">
                    Saya setuju dengan peraturan turnamen <span className="font-bold">{tournament.name}</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeData}
                    onChange={(e) => setAgreeData(e.target.checked)}
                    className="w-5 h-5 rounded mt-0.5"
                  />
                  <span className="text-sm text-neutral-700">
                    Data tim saya sudah valid dan akurat
                  </span>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeRegulation}
                    onChange={(e) => setAgreeRegulation(e.target.checked)}
                    className="w-5 h-5 rounded mt-0.5"
                  />
                  <span className="text-sm text-neutral-700">
                    Saya memahami sanksi jika melakukan pelanggaran atau fraud
                  </span>
                </label>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2">Ringkasan</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Biaya Daftar</span>
                    <span className="font-bold">{formatRupiah(regFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Biaya Layanan</span>
                    <span className="font-bold">{formatRupiah(serviceFee)}</span>
                  </div>
                  <div className="border-t border-neutral-200 pt-1 flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-[#E11D2E] text-lg">{formatRupiah(total)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Payment */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <div className="text-sm font-bold text-neutral-900 mb-3">Pilih Metode Pembayaran</div>
                <div className="space-y-2">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition text-left ${
                        paymentMethod?.id === method.id
                          ? 'border-[#E11D2E] bg-red-50'
                          : 'border-neutral-200 hover:border-neutral-900'
                      }`}
                    >
                      <div className="w-12 h-9 rounded-lg flex items-center justify-center font-bold text-white shrink-0 bg-neutral-900">
                        {method.logo}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{method.name}</div>
                        <div className="text-xs text-neutral-500">{method.desc}</div>
                      </div>
                      {paymentMethod?.id === method.id && (
                        <Check size={20} className="text-[#E11D2E] shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-2">Nominal Pembayaran</div>
                <div className="font-display text-3xl text-neutral-900 mb-1">{formatRupiah(total)}</div>
                {registrationData?.unique_transfer_amount && (
                  <div className="text-xs text-neutral-600 mt-3">
                    <strong>Nominal Unik:</strong> Rp {registrationData.unique_transfer_amount.toLocaleString('id-ID')}
                    <div className="text-[10px] text-neutral-500 mt-1">
                      (gunakan nominal ini untuk verifikasi manual)
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{ background: '#E11D2E' }}>
                <Check size={40} className="text-white" strokeWidth={3} />
              </div>

              <div>
                <h3 className="font-display text-3xl text-neutral-900 mb-2">Slot Aman!</h3>
                <p className="text-neutral-600">Tim "{teamName}" sudah tercatat. Slot terjamin selama 15 menit.</p>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 space-y-3 text-left">
                <div>
                  <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-1">Nama Tim</div>
                  <div className="font-bold text-lg text-neutral-900">{teamName}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-1">Turnamen</div>
                  <div className="font-bold text-lg text-neutral-900">{tournament.name}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-1">Total Pembayaran</div>
                  <div className="font-display text-2xl text-neutral-900">{formatRupiah(total)}</div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left">
                <div className="text-sm font-bold text-blue-900 mb-2">Langkah Selanjutnya:</div>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Lakukan pembayaran ke nominal unik yang sudah diberikan</li>
                  <li>Upload bukti pembayaran ke dashboard</li>
                  <li>Tambahkan anggota tim ke roster</li>
                  <li>Tunggu verifikasi admin (maksimal 24 jam)</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => {
              if (step === 1) handleClose();
              else setStep(step - 1);
            }}
            className="px-4 py-2.5 rounded-full font-bold text-sm border-2 border-neutral-300 hover:border-neutral-900 flex items-center gap-2"
          >
            <ArrowLeft size={14} /> {step === 1 ? 'Tutup' : 'Kembali'}
          </button>

          {step < 3 ? (
            <button
              onClick={step === 1 ? handleStep1Submit : handleStep2Submit}
              disabled={loading || (step === 1 && !allChecked) || (step === 2 && !paymentMethod)}
              className="px-6 py-2.5 rounded-full font-bold text-sm text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#E11D2E' }}
            >
              {loading ? 'Memproses...' : <>Lanjut <ArrowRight size={14} /></>}
            </button>
          ) : (
            <button
              onClick={handleConfirmation}
              className="px-6 py-2.5 rounded-full font-bold text-sm text-white flex items-center gap-2"
              style={{ background: '#E11D2E' }}
            >
              <Check size={14} /> Lanjut ke Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickRegistrationModal;
