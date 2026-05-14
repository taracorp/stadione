// ============ TEAM WORKSPACE ============
// Dashboard untuk team coordinator: Roster, Invites, Payment, Schedule, Lineup

import React, { useState, useEffect } from 'react';
import {
  Users, Plus, Mail, MessageSquare, Share2, Settings, Trophy,
  Clock, CheckCircle, AlertCircle, Copy, Send, Loader
} from 'lucide-react';
import {
  fetchTeamRoster,
  addTeamMember,
  acceptTeamMemberInvite,
  verifyTeamMember,
  checkRosterCompleteness,
} from '../services/registrationService.js';

const formatRupiah = (amount) => {
  if (!amount) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

const TeamWorkspaceModal = ({
  isOpen,
  registration,
  team,
  tournament,
  auth,
  onClose,
}) => {
  const [tab, setTab] = useState('roster'); // roster, invite, payment, schedule, lineup
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNo, setNewPlayerNo] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [rosterStatus, setRosterStatus] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!team?.id || !registration?.id) return;
    loadRoster();
    checkRosterStatus();
  }, [team?.id, registration?.id]);

  const loadRoster = async () => {
    setLoading(true);
    const data = await fetchTeamRoster(team.id);
    setRoster(data || []);
    setLoading(false);
  };

  const checkRosterStatus = async () => {
    const status = await checkRosterCompleteness({
      registrationId: registration.id,
      teamId: team.id,
      tournamentId: tournament?.id || registration?.tournament_id,
    });
    setRosterStatus(status);
  };

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) {
      setError('Masukkan nama pemain');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await addTeamMember({
      teamId: team.id,
      userId: auth?.id,
      playerName: newPlayerName,
      playerIdentifier: newPlayerNo,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess('Pemain berhasil ditambahkan');
    setNewPlayerName('');
    setNewPlayerNo('');
    loadRoster();
  };

  const handleInvitePlayer = async () => {
    if (!inviteEmail.trim()) {
      setError('Masukkan email pemain');
      return;
    }

    setLoading(true);
    setError(null);

    // TODO: Send invite via email/WhatsApp using backend service
    // For now, just show confirmation
    setSuccess(`Undangan dikirim ke ${inviteEmail}`);
    setInviteEmail('');
    setInviteMessage('');
    setLoading(false);
  };

  const minRoster = tournament?.min_roster || 11;
  const requiredPlayersLeft = Math.max(0, minRoster - roster.length);
  const rosterComplete = roster.length >= minRoster;
  const inviteLink = `${window.location.origin}?join_team=${team?.id || ''}`;

  const tabs = [
    { id: 'roster', label: 'Roster', icon: Users },
    { id: 'invite', label: 'Undang Pemain', icon: Plus },
    { id: 'payment', label: 'Pembayaran', icon: Trophy },
    { id: 'schedule', label: 'Jadwal', icon: Clock },
    { id: 'lineup', label: 'Lineup Match', icon: CheckCircle },
  ];

  if (!isOpen || !registration || !team) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest font-bold text-neutral-500">/ WORKSPACE TIM</div>
            <h2 className="font-display text-2xl text-neutral-900">{team.name}</h2>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900">
            ✕
          </button>
        </div>

        {/* Status Bar */}
        <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-200 flex items-center gap-4 flex-wrap">
          <div className={`flex items-center gap-2 text-sm font-bold ${rosterComplete ? 'text-green-700' : 'text-amber-700'}`}>
            {rosterComplete ? (
              <>
                <CheckCircle size={16} /> Roster Lengkap ({roster.length}/{minRoster})
              </>
            ) : (
              <>
                <AlertCircle size={16} /> Perlu {requiredPlayersLeft} pemain lagi
              </>
            )}
          </div>
          <div className="flex-1" />
          <div className="text-xs text-neutral-600">
            Status Pembayaran:{' '}
            <span className="font-bold text-green-700">
              {registration?.payment_status === 'confirmed' ? 'Terkonfirmasi' : 'Menunggu Verifikasi'}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-neutral-200 px-6 flex gap-2 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition shrink-0 ${
                  tab === t.id
                    ? 'border-[#E11D2E] text-neutral-900'
                    : 'border-transparent text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6 lg:p-8">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 flex items-center gap-2">
              <CheckCircle size={16} />
              {success}
            </div>
          )}

          {/* Roster Tab */}
          {tab === 'roster' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 mb-3">Daftar Pemain ({roster.length}/{minRoster})</h3>
                <div className="space-y-2">
                  {roster.length > 0 ? (
                    roster.map((player) => (
                      <div key={player.id} className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                        <div className="flex-1">
                          <div className="font-bold text-neutral-900">{player.player_name}</div>
                          <div className="text-xs text-neutral-500">
                            {player.player_identifier && `No ${player.player_identifier}`}
                            {player.status && ` · Status: ${player.status}`}
                          </div>
                        </div>
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full ${
                            player.status === 'verified'
                              ? 'bg-green-100 text-green-800'
                              : player.status === 'accepted'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {player.status === 'verified' ? '✓ Terverifikasi' : player.status === 'accepted' ? 'Diterima' : 'Pending'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-neutral-600">
                      Belum ada pemain terdaftar
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
                <h4 className="font-bold text-neutral-900 mb-4">Tambah Pemain</h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="Nama pemain"
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm"
                  />
                  <input
                    type="text"
                    value={newPlayerNo}
                    onChange={(e) => setNewPlayerNo(e.target.value)}
                    placeholder="Nomor punggung (opsional)"
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm"
                  />
                  <button
                    onClick={handleAddPlayer}
                    disabled={loading}
                    className="w-full py-2.5 rounded-full font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: '#E11D2E' }}
                  >
                    {loading ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
                    Tambah Pemain
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Invite Tab */}
          {tab === 'invite' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
                <h4 className="font-bold text-neutral-900 mb-4">Bagikan Link Undangan</h4>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-300 text-sm font-mono bg-white"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(inviteLink)}
                    className="p-2.5 rounded-full border border-neutral-300 hover:border-neutral-900 text-neutral-700"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button className="px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 bg-green-100 text-green-700 hover:bg-green-200">
                    <MessageSquare size={12} /> WhatsApp
                  </button>
                  <button className="px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 bg-blue-100 text-blue-700 hover:bg-blue-200">
                    <Mail size={12} /> Email
                  </button>
                  <button className="px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200">
                    <Share2 size={12} /> Bagikan
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
                <h4 className="font-bold text-neutral-900 mb-4">Undang via Email</h4>
                <div className="space-y-3">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@pemain.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm"
                  />
                  <textarea
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    placeholder="Pesan (opsional)"
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-300 outline-none focus:border-neutral-900 text-sm resize-none"
                  />
                  <button
                    onClick={handleInvitePlayer}
                    disabled={loading}
                    className="w-full py-2.5 rounded-full font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: '#E11D2E' }}
                  >
                    {loading ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
                    Kirim Undangan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Payment Tab */}
          {tab === 'payment' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-sm font-bold text-green-900 mb-1">Status Pembayaran</div>
                    <div className="font-display text-2xl text-green-900">Terkonfirmasi</div>
                  </div>
                  <CheckCircle size={32} className="text-green-700" />
                </div>
                <div className="text-sm text-green-800">
                  Pembayaran sudah diterima. Tim siap untuk diverifikasi.
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 space-y-3">
                <div className="text-xs uppercase tracking-widest font-bold text-neutral-500">Detail Transaksi</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-neutral-600">Metode Pembayaran</span>
                    <div className="font-bold text-neutral-900">{registration?.payment_method || '—'}</div>
                  </div>
                  <div>
                    <span className="text-neutral-600">Tanggal Pembayaran</span>
                    <div className="font-bold text-neutral-900">
                      {registration?.payment_proof_uploaded_at ? new Date(registration.payment_proof_uploaded_at).toLocaleDateString('id-ID') : '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-600">Nominal Pembayaran</span>
                    <div className="font-bold text-neutral-900">{formatRupiah(registration?.base_fee)}</div>
                  </div>
                  <div>
                    <span className="text-neutral-600">Nominal Unik</span>
                    <div className="font-bold text-neutral-900">Rp {registration?.unique_transfer_amount?.toLocaleString('id-ID')}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Schedule Tab */}
          {tab === 'schedule' && (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center">
              <Clock size={32} className="mx-auto mb-3 text-neutral-400" />
              <div className="font-bold text-neutral-900 mb-1">Jadwal akan tampil di sini</div>
              <p className="text-sm text-neutral-600">Setelah tim diverifikasi, jadwal pertandingan akan muncul</p>
            </div>
          )}

          {/* Lineup Tab */}
          {tab === 'lineup' && (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center">
              <Trophy size={32} className="mx-auto mb-3 text-neutral-400" />
              <div className="font-bold text-neutral-900 mb-1">Lineup akan tersedia sebelum pertandingan</div>
              <p className="text-sm text-neutral-600">Atur formasi dan pemain starter H-6 jam sebelum kickoff</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-full font-bold text-sm border-2 border-neutral-300 hover:border-neutral-900"
          >
            Tutup
          </button>
          <div className="text-xs text-neutral-500">
            Slot terjamin hingga pembayaran diverifikasi admin
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamWorkspaceModal;
