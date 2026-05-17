import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, KeyRound, Mail, Plus, RefreshCw, Shield, UserCog, UserPlus, UserRoundX, Users } from 'lucide-react';
import AdminLayout, { ActionButton, EmptyState, Field, Modal, StatCard, inputCls, selectCls } from '../AdminLayout.jsx';
import { supabase } from '../../../config/supabase.js';
import { getRoleDisplayName } from '../../../utils/roles.js';

const DEFAULT_PAGE_SIZE = 50;
const USER_MANAGEMENT_PREFS_KEY = 'stadione.userManagementPrefs';
const EXPORT_MAX_ROWS = 1000;
const DEFAULT_PREFS = {
  search: '',
  statusFilter: 'all',
  sortConfig: { key: 'created_at', direction: 'desc' },
};

const DEFAULT_CREATE_FORM = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'member',
};

const MODERATION_DISABLE_OPTIONS = [
  { hours: 24, label: 'Nonaktifkan 1x24 jam' },
  { hours: 72, label: 'Nonaktifkan 3x24 jam' },
  { hours: 168, label: 'Nonaktifkan 7x24 jam' },
];

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function mapUserStatus(user) {
  if (user?.is_disabled) return 'Nonaktif';
  if (user?.is_blocked) return 'Diblokir';
  return 'Aktif';
}

function isNeverLoggedIn(user) {
  return !user?.last_sign_in_at;
}

function getInitialPrefs() {
  if (typeof window === 'undefined') {
    return DEFAULT_PREFS;
  }

  try {
    const raw = window.localStorage.getItem(USER_MANAGEMENT_PREFS_KEY);
    if (!raw) {
      return DEFAULT_PREFS;
    }

    const parsed = JSON.parse(raw);
    const sortKey = ['created_at', 'name', 'email', 'role', 'status'].includes(parsed?.sortConfig?.key)
      ? parsed.sortConfig.key
      : 'created_at';
    const sortDirection = parsed?.sortConfig?.direction === 'asc' ? 'asc' : 'desc';
    const nextStatusFilter = ['all', 'active', 'blocked', 'disabled', 'never_logged_in'].includes(parsed?.statusFilter)
      ? parsed.statusFilter
      : 'all';

    return {
      search: String(parsed?.search || ''),
      statusFilter: nextStatusFilter,
      sortConfig: { key: sortKey, direction: sortDirection },
    };
  } catch (err) {
    console.warn('Failed to parse user management prefs:', err);
    return DEFAULT_PREFS;
  }
}

function normalizeRoleLabel(role) {
  return getRoleDisplayName(role);
}

function getModerationOptions(user) {
  const isBlocked = Boolean(user?.is_blocked);
  const isDisabled = Boolean(user?.is_disabled);

  if (isBlocked || isDisabled) {
    return [{ value: 'reactivate', label: 'Aktifkan kembali' }];
  }

  return [
    { value: 'block', label: 'Blokir' },
    ...MODERATION_DISABLE_OPTIONS.map((option) => ({
      value: `disable-${option.hours}`,
      label: option.label,
    })),
  ];
}

export default function UserManagementPage({ auth, onBack, onNav }) {
  const initialPrefs = useMemo(() => getInitialPrefs(), []);
  const isSuperAdmin = useMemo(
    () => (auth?.roles || []).some((role) => String(role || '').trim().toLowerCase() === 'super_admin'),
    [auth?.roles],
  );
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [search, setSearch] = useState(initialPrefs.search);
  const [statusFilter, setStatusFilter] = useState(initialPrefs.statusFilter);
  const [hasMore, setHasMore] = useState(true);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [roleDraftByUser, setRoleDraftByUser] = useState({});
  const [savingRoleUserId, setSavingRoleUserId] = useState('');
  const [moderationTarget, setModerationTarget] = useState(null);
  const [moderationReason, setModerationReason] = useState('');
  const [moderationLoading, setModerationLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [changedUserIds, setChangedUserIds] = useState([]);
  const [sortConfig, setSortConfig] = useState(initialPrefs.sortConfig);
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [createLoading, setCreateLoading] = useState(false);
  const [verificationReviewTarget, setVerificationReviewTarget] = useState(null);
  const [verificationApprovalLoading, setVerificationApprovalLoading] = useState(false);
  const [verificationApprovalNotes, setVerificationApprovalNotes] = useState('');
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const applyUserSnapshot = useCallback((nextUsers = [], options = {}) => {
    setUsers((prevUsers) => {
      if (options.trackChanges) {
        const prevById = new Map(prevUsers.map((user) => [user.user_id, user]));
        const changed = nextUsers
          .filter((user) => {
            const prev = prevById.get(user.user_id);
            if (!prev) return true;

            const prevRole = Array.isArray(prev.roles) && prev.roles.length > 0 ? prev.roles[0] : '';
            const nextRole = Array.isArray(user.roles) && user.roles.length > 0 ? user.roles[0] : '';

            return prevRole !== nextRole
              || Boolean(prev.is_blocked) !== Boolean(user.is_blocked)
              || Boolean(prev.is_disabled) !== Boolean(user.is_disabled)
              || String(prev.moderation_reason || '') !== String(user.moderation_reason || '');
          })
          .map((user) => user.user_id);

        setChangedUserIds(changed);
      }

      return nextUsers;
    });

    setRoleDraftByUser((prev) => {
      const next = { ...prev };
      nextUsers.forEach((user) => {
        const currentRole = Array.isArray(user.roles) && user.roles.length > 0 ? user.roles[0] : '';
        if (typeof next[user.user_id] === 'undefined') {
          next[user.user_id] = currentRole;
        }
      });
      return next;
    });
  }, []);

  const appendUserSnapshot = useCallback((nextUsers = []) => {
    setUsers((prev) => {
      const merged = [...prev];
      const existingIds = new Set(prev.map((item) => item.user_id));

      nextUsers.forEach((item) => {
        if (!existingIds.has(item.user_id)) {
          merged.push(item);
          existingIds.add(item.user_id);
        }
      });

      return merged;
    });

    setRoleDraftByUser((prev) => {
      const next = { ...prev };
      nextUsers.forEach((user) => {
        const currentRole = Array.isArray(user.roles) && user.roles.length > 0 ? user.roles[0] : '';
        if (typeof next[user.user_id] === 'undefined') {
          next[user.user_id] = currentRole;
        }
      });
      return next;
    });
  }, []);

  const requestUsers = useCallback(async (keyword = '', offset = 0, limit = DEFAULT_PAGE_SIZE) => {
    const { data, error } = await supabase.rpc('admin_list_users', {
      p_search: keyword,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) throw error;
    return data || [];
  }, []);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_roles')
        .select('role,display_name,hierarchy_level')
        .order('hierarchy_level', { ascending: true })
        .order('display_name', { ascending: true });

      if (error) throw error;
      setRoles(data || []);
    } catch (err) {
      console.error('Failed to load roles:', err);
      setRoles([]);
    } finally {
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!roles.length) return;
    setCreateForm((prev) => {
      const roleExists = roles.some((role) => role.role === prev.role);
      if (roleExists) return prev;
      const preferredRole = roles.some((role) => role.role === 'member')
        ? 'member'
        : roles[0]?.role || '';
      return { ...prev, role: preferredRole };
    });
  }, [roles]);

  const loadUsers = useCallback(async (keyword = '') => {
    setLoading(true);
    try {
      const data = await requestUsers(keyword, 0, DEFAULT_PAGE_SIZE);
      applyUserSnapshot(data);
      setHasMore(data.length === DEFAULT_PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsers([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [applyUserSnapshot, requestUsers]);

  const loadUsersSilent = useCallback(async (keyword = '', options = {}) => {
    if (options.showSpinner) {
      setRefreshing(true);
    }

    try {
      const limit = Math.max(users.length, DEFAULT_PAGE_SIZE);
      const data = await requestUsers(keyword, 0, limit);
      applyUserSnapshot(data, { trackChanges: Boolean(options.trackChanges) });
      setHasMore(data.length === limit);
      if (options.showFeedback) {
        setFeedback({ type: 'success', message: 'Data user berhasil diperbarui.' });
      }
    } catch (err) {
      console.error('Silent refresh failed:', err);
      if (options.showFeedback) {
        setFeedback({ type: 'error', message: `Gagal refresh data: ${err.message || 'Terjadi kesalahan.'}` });
      }
    } finally {
      if (options.showSpinner) {
        setRefreshing(false);
      }
    }
  }, [applyUserSnapshot, requestUsers, users.length]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const data = await requestUsers(search, users.length, DEFAULT_PAGE_SIZE);
      appendUserSnapshot(data);
      setHasMore(data.length === DEFAULT_PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load more users:', err);
      setFeedback({ type: 'error', message: `Gagal memuat user tambahan: ${err.message || 'Terjadi kesalahan.'}` });
    } finally {
      setLoadingMore(false);
    }
  }, [appendUserSnapshot, hasMore, loadingMore, requestUsers, search, users.length]);

  const handleManualRefresh = useCallback(() => {
    loadUsersSilent(search, { trackChanges: true, showFeedback: true, showSpinner: true });
  }, [loadUsersSilent, search]);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }

      return {
        key,
        direction: key === 'created_at' ? 'desc' : 'asc',
      };
    });
  }, []);

  const handleResetView = useCallback(() => {
    setSearch(DEFAULT_PREFS.search);
    setStatusFilter(DEFAULT_PREFS.statusFilter);
    setSortConfig(DEFAULT_PREFS.sortConfig);
    setChangedUserIds([]);

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(USER_MANAGEMENT_PREFS_KEY);
    }

    loadUsers(DEFAULT_PREFS.search);
    setFeedback({ type: 'success', message: 'Tampilan user management di-reset ke default.' });
  }, [loadUsers]);

  const getSortMarker = useCallback((key) => {
    if (sortConfig.key !== key) return '-';
    return sortConfig.direction === 'asc' ? '^' : 'v';
  }, [sortConfig.direction, sortConfig.key]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      loadUsers(search);
    }, 400);

    return () => clearTimeout(debounceTimer);
  }, [loadUsers, search]);

  useEffect(() => {
    const timer = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (!changedUserIds.length) return undefined;
    const timer = setTimeout(() => setChangedUserIds([]), 4000);
    return () => clearTimeout(timer);
  }, [changedUserIds]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      loadUsersSilent(search);
    }, 20000);

    return () => clearInterval(intervalId);
  }, [loadUsersSilent, search]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = {
      search,
      statusFilter,
      sortConfig,
    };
    window.localStorage.setItem(USER_MANAGEMENT_PREFS_KEY, JSON.stringify(payload));
  }, [search, sortConfig, statusFilter]);

  async function handleApplyRole(userId) {
    const selectedRole = roleDraftByUser[userId];
    if (!selectedRole) return;

    setSavingRoleUserId(userId);
    try {
      const { error } = await supabase.rpc('admin_set_user_role', {
        p_user_id: userId,
        p_role: selectedRole,
        p_replace_existing: true,
      });

      if (error) throw error;

      setUsers((prev) => prev.map((user) => (
        user.user_id === userId
          ? { ...user, roles: [selectedRole] }
          : user
      )));
      setFeedback({ type: 'success', message: 'Role user berhasil diperbarui.' });
    } catch (err) {
      console.error('Failed to update role:', err);
      setFeedback({ type: 'error', message: `Gagal mengubah role: ${err.message || 'Terjadi kesalahan.'}` });
    } finally {
      setSavingRoleUserId('');
    }
  }

  async function handleSubmitModeration() {
    if (!moderationTarget) return;
    if (moderationTarget.user_id === auth?.id) {
      setFeedback({ type: 'error', message: 'Akun sendiri tidak bisa diblokir atau dinonaktifkan dari halaman ini.' });
      return;
    }

    setModerationLoading(true);
    try {
      const { error } = await supabase.rpc('admin_set_user_moderation', {
        p_user_id: moderationTarget.user_id,
        p_is_blocked: moderationTarget.mode === 'block',
        p_is_disabled: moderationTarget.mode === 'disable',
        p_disabled_hours: moderationTarget.mode === 'disable' ? moderationTarget.disabledHours : null,
        p_reason: moderationTarget.mode === 'reactivate' ? null : moderationReason,
      });

      if (error) throw error;

      setUsers((prev) => prev.map((user) => {
        if (user.user_id !== moderationTarget.user_id) return user;
        return {
          ...user,
          is_blocked: moderationTarget.mode === 'block',
          is_disabled: moderationTarget.mode === 'disable',
          moderation_reason: moderationTarget.mode === 'reactivate' ? null : moderationReason.trim() || null,
          disabled_until: moderationTarget.mode === 'disable'
            ? new Date(Date.now() + (moderationTarget.disabledHours * 60 * 60 * 1000)).toISOString()
            : null,
        };
      }));

      setModerationTarget(null);
      setModerationReason('');
      setFeedback({
        type: 'success',
        message:
          moderationTarget.mode === 'block'
            ? 'Akun berhasil diblokir sampai super admin mengaktifkan kembali.'
            : moderationTarget.mode === 'disable'
              ? `Akun berhasil dinonaktifkan selama ${moderationTarget.durationLabel}.`
              : 'Akun berhasil diaktifkan kembali.',
      });
    } catch (err) {
      console.error('Failed to update moderation status:', err);
      setFeedback({ type: 'error', message: `Gagal memperbarui status akun: ${err.message || 'Terjadi kesalahan.'}` });
    } finally {
      setModerationLoading(false);
    }
  }

  async function handleVerificationApproval(approve = true) {
    if (!verificationReviewTarget) return;

    setVerificationApprovalLoading(true);
    try {
      const newStatus = approve ? 'verified' : 'rejected';
      const notes = verificationApprovalNotes.trim();

      // Update user metadata dengan status verifikasi baru
      const { error } = await supabase.auth.admin.updateUserById(verificationReviewTarget.user_id, {
        user_metadata: {
          ...verificationReviewTarget.user_metadata,
          verification_status: newStatus,
          verification_reviewed_at: new Date().toISOString(),
          verification_reviewed_by: auth?.id || '',
          verification_admin_notes: notes,
        },
      });

      if (error) throw error;

      // Update user di state
      setUsers((prev) => prev.map((user) => {
        if (user.user_id !== verificationReviewTarget.user_id) return user;
        return {
          ...user,
          user_metadata: {
            ...user.user_metadata,
            verification_status: newStatus,
            verification_reviewed_at: new Date().toISOString(),
            verification_reviewed_by: auth?.id || '',
            verification_admin_notes: notes,
          },
        };
      }));

      setVerificationReviewTarget(null);
      setVerificationApprovalNotes('');
      setFeedback({
        type: 'success',
        message: approve ? 'Member berhasil di-verifikasi.' : 'Verifikasi member berhasil ditolak.',
      });
    } catch (err) {
      console.error('Failed to update verification status:', err);
      setFeedback({
        type: 'error',
        message: `Gagal memperbarui status verifikasi: ${err.message || 'Terjadi kesalahan.'}`,
      });
    } finally {
      setVerificationApprovalLoading(false);
    }
  }

  async function handleDeleteUser() {
    if (!deleteConfirmTarget) return;

    if (deleteConfirmTarget.user_id === auth?.id) {
      setFeedback({ type: 'error', message: 'Akun sendiri tidak bisa dihapus dari halaman ini.' });
      return;
    }

    setDeleteLoading(true);
    try {
      const { error } = await supabase.rpc('admin_delete_user_account', {
        p_user_id: deleteConfirmTarget.user_id,
      });

      if (error) throw error;

      setUsers((prev) => prev.filter((user) => user.user_id !== deleteConfirmTarget.user_id));

      setDeleteConfirmTarget(null);
      setFeedback({ type: 'success', message: `User ${deleteConfirmTarget.full_name || deleteConfirmTarget.email} berhasil dihapus.` });
    } catch (err) {
      console.error('Failed to delete user:', err);
      setFeedback({
        type: 'error',
        message: `Gagal menghapus user: ${err.message || 'Terjadi kesalahan.'}`,
      });
    } finally {
      setDeleteLoading(false);
    }
  }

  const openModerationAction = useCallback((user, actionValue) => {
    const userName = user.full_name || user.email || 'User';

    if (actionValue === 'block') {
      setModerationTarget({
        user_id: user.user_id,
        user_name: userName,
        mode: 'block',
        actionLabel: 'Blokir Akun',
        actionSummary: 'Akun akan diblokir sampai super admin mengaktifkan kembali.',
      });
      setModerationReason('');
      return;
    }

    if (actionValue === 'reactivate') {
      setModerationTarget({
        user_id: user.user_id,
        user_name: userName,
        mode: 'reactivate',
        actionLabel: 'Aktifkan Kembali',
        actionSummary: 'Akun akan kembali aktif dan status blokir/nonaktif dihapus.',
      });
      setModerationReason('');
      return;
    }

    if (actionValue.startsWith('disable-')) {
      const disabledHours = Number(actionValue.replace('disable-', ''));
      const selectedOption = MODERATION_DISABLE_OPTIONS.find((option) => option.hours === disabledHours);

      setModerationTarget({
        user_id: user.user_id,
        user_name: userName,
        mode: 'disable',
        disabledHours,
        durationLabel: selectedOption?.label || `${Math.round(disabledHours / 24)}x24 jam`,
        actionLabel: selectedOption?.label || 'Nonaktifkan Akun',
        actionSummary: `Akun akan dinonaktifkan selama ${selectedOption?.label || `${Math.round(disabledHours / 24)}x24 jam`} dan aktif kembali otomatis setelah waktu habis.`,
      });
      setModerationReason('');
    }
  }, []);

  async function handleCreateUser(event) {
    event.preventDefault();

    if (!isSuperAdmin) {
      setFeedback({ type: 'error', message: 'Hanya super admin yang dapat membuat user baru.' });
      return;
    }

    const fullName = String(createForm.fullName || '').trim();
    const email = String(createForm.email || '').trim().toLowerCase();
    const password = String(createForm.password || '');
    const confirmPassword = String(createForm.confirmPassword || '');
    const role = String(createForm.role || '').trim();

    if (!fullName) {
      setFeedback({ type: 'error', message: 'Nama lengkap wajib diisi.' });
      return;
    }

    if (!email || !email.includes('@')) {
      setFeedback({ type: 'error', message: 'Email tidak valid.' });
      return;
    }

    if (password.length < 8) {
      setFeedback({ type: 'error', message: 'Password minimal 8 karakter.' });
      return;
    }

    if (password !== confirmPassword) {
      setFeedback({ type: 'error', message: 'Konfirmasi password tidak cocok.' });
      return;
    }

    if (!roles.some((item) => item.role === role)) {
      setFeedback({ type: 'error', message: 'Role yang dipilih tidak tersedia.' });
      return;
    }

    setCreateLoading(true);
    try {
      const { error } = await supabase.rpc('admin_create_user_account', {
        p_email: email,
        p_password: password,
        p_full_name: fullName,
        p_role: role,
      });

      if (error) throw error;

      setCreateForm(DEFAULT_CREATE_FORM);
      await loadUsers(search);
      setFeedback({ type: 'success', message: `User ${fullName} berhasil dibuat dengan role ${normalizeRoleLabel(role)}.` });
    } catch (err) {
      console.error('Failed to create user:', err);
      setFeedback({ type: 'error', message: `Gagal membuat user: ${err.message || 'Terjadi kesalahan.'}` });
    } finally {
      setCreateLoading(false);
    }
  }

  const stats = useMemo(() => {
    const total = users.length;
    const blocked = users.filter((user) => user.is_blocked).length;
    const disabled = users.filter((user) => user.is_disabled).length;
    const neverLoggedIn = users.filter((user) => isNeverLoggedIn(user)).length;
    const active = total - blocked - disabled;
    return { total, blocked, disabled, active: Math.max(active, 0), neverLoggedIn };
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (statusFilter === 'active') {
      return users.filter((user) => !user.is_blocked && !user.is_disabled);
    }
    if (statusFilter === 'blocked') {
      return users.filter((user) => user.is_blocked);
    }
    if (statusFilter === 'disabled') {
      return users.filter((user) => user.is_disabled);
    }
    if (statusFilter === 'never_logged_in') {
      return users.filter((user) => isNeverLoggedIn(user));
    }
    return users;
  }, [statusFilter, users]);

  const visibleUsers = useMemo(() => {
    const next = [...filteredUsers];
    const multiplier = sortConfig.direction === 'asc' ? 1 : -1;

    next.sort((a, b) => {
      if (sortConfig.key === 'name') {
        const aValue = String(a.full_name || '').toLowerCase();
        const bValue = String(b.full_name || '').toLowerCase();
        return aValue.localeCompare(bValue) * multiplier;
      }

      if (sortConfig.key === 'email') {
        const aValue = String(a.email || '').toLowerCase();
        const bValue = String(b.email || '').toLowerCase();
        return aValue.localeCompare(bValue) * multiplier;
      }

      if (sortConfig.key === 'role') {
        const aRole = Array.isArray(a.roles) && a.roles.length > 0 ? String(a.roles[0]) : '';
        const bRole = Array.isArray(b.roles) && b.roles.length > 0 ? String(b.roles[0]) : '';
        return aRole.localeCompare(bRole) * multiplier;
      }

      if (sortConfig.key === 'status') {
        const mapStatus = (row) => {
          if (row.is_disabled) return 2;
          if (row.is_blocked) return 1;
          return 0;
        };
        return (mapStatus(a) - mapStatus(b)) * multiplier;
      }

      if (sortConfig.key === 'last_sign_in_at') {
        const aTime = new Date(a.last_sign_in_at || 0).getTime();
        const bTime = new Date(b.last_sign_in_at || 0).getTime();
        return (aTime - bTime) * multiplier;
      }

      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return (aTime - bTime) * multiplier;
    });

    return next;
  }, [filteredUsers, sortConfig]);

  const handleExportCsv = useCallback(() => {
    if (!visibleUsers.length) {
      setFeedback({ type: 'error', message: 'Tidak ada data untuk diekspor.' });
      return;
    }

    const exportRows = visibleUsers.slice(0, EXPORT_MAX_ROWS);
    const headers = ['Nama', 'Email', 'Role', 'Status', 'Alasan Moderasi', 'Last Sign In', 'Created At'];
    const rows = exportRows.map((user) => {
      const role = Array.isArray(user.roles) && user.roles.length > 0 ? normalizeRoleLabel(user.roles[0]) : '-';
      const lastSignIn = user.last_sign_in_at
        ? new Date(user.last_sign_in_at).toLocaleString('id-ID')
        : '-';

      return [
        user.full_name || '-',
        user.email || '-',
        role,
        mapUserStatus(user),
        user.moderation_reason || '',
        lastSignIn,
        user.created_at || '',
      ];
    });

    const csvContent = [headers, ...rows]
      .map((cols) => cols.map(csvEscape).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    link.href = url;
    link.download = `user-management-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const truncated = visibleUsers.length > EXPORT_MAX_ROWS;
    setFeedback({
      type: 'success',
      message: truncated
        ? `Export CSV berhasil. Data dibatasi ${EXPORT_MAX_ROWS} baris dari ${visibleUsers.length} baris.`
        : 'Export CSV berhasil.',
    });
  }, [visibleUsers]);

  return (
    <AdminLayout
      variant="platform"
      kicker="/ PLATFORM - USER MANAGEMENT"
      title={<>USER<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>management.</span></>}
      subtitle="Super admin dapat melihat user terdaftar, mengubah role, dan memblokir atau menonaktifkan akun."
      onBack={onBack}
      breadcrumbs={[{ label: 'Platform Console', onClick: () => onNav('platform-console') }, { label: 'User Management' }]}
    >
      {feedback && (
        <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {feedback.message}
        </div>
      )}

      <div className="rounded-3xl border border-neutral-200 bg-white p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] font-black text-neutral-500">Tambah user manual</div>
            <div className="font-display text-2xl text-neutral-900 mt-1">Buat akun baru dari console</div>
            <p className="text-sm text-neutral-500 mt-2 max-w-2xl leading-relaxed">
              Akun akan dibuat di Auth, email langsung terkonfirmasi, lalu role awal dipasang ke user_roles.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700 w-fit">
            <UserPlus size={14} /> Hanya untuk super admin
          </div>
        </div>

        {!isSuperAdmin ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Fitur tambah user manual hanya tersedia untuk akun super admin.
          </div>
        ) : (
          <form onSubmit={handleCreateUser} className="grid lg:grid-cols-2 gap-4">
            <Field label="Nama lengkap" hint="Nama yang akan tampil di profil pengguna.">
              <input
                className={inputCls}
                value={createForm.fullName}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, fullName: event.target.value }))}
                placeholder="Contoh: Andi Pratama"
              />
            </Field>

            <Field label="Email" hint="Email login utama user.">
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                <input
                  className={`${inputCls} pl-10`}
                  type="email"
                  value={createForm.email}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="user@domain.com"
                />
              </div>
            </Field>

            <Field label="Password awal" hint="Minimal 8 karakter. Simpan dan bagikan secara aman ke user.">
              <div className="relative">
                <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                <input
                  className={`${inputCls} pl-10`}
                  type="password"
                  value={createForm.password}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Password sementara"
                />
              </div>
            </Field>

            <Field label="Konfirmasi password" hint="Harus sama dengan password awal.">
              <div className="relative">
                <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                <input
                  className={`${inputCls} pl-10`}
                  type="password"
                  value={createForm.confirmPassword}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                  placeholder="Ulangi password"
                />
              </div>
            </Field>

            <Field label="Role awal" hint="Role ini menentukan hak akses user setelah dibuat.">
              <select
                className={selectCls}
                value={createForm.role}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, role: event.target.value }))}
                disabled={rolesLoading}
              >
                {roles.length === 0 ? (
                  <option value="">Memuat role...</option>
                ) : roles.map((roleItem) => (
                  <option key={roleItem.role} value={roleItem.role}>
                    {roleItem.display_name || normalizeRoleLabel(roleItem.role)}
                  </option>
                ))}
              </select>
            </Field>

            <div className="lg:col-span-2 flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
              <ActionButton type="submit" loading={createLoading} disabled={rolesLoading || roles.length === 0}>
                <Plus size={14} /> Buat User
              </ActionButton>
              <div className="text-xs text-neutral-400 leading-relaxed">
                Jika email sudah terdaftar, sistem akan menolak pembuatan akun.
              </div>
            </div>
          </form>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total User" value={loading ? '-' : stats.total} icon={Users} accent="violet" />
        <StatCard label="Aktif" value={loading ? '-' : stats.active} icon={Shield} accent="emerald" />
        <StatCard label="Diblokir" value={loading ? '-' : stats.blocked} icon={Ban} accent="amber" />
        <StatCard label="Dinonaktifkan" value={loading ? '-' : stats.disabled} icon={UserRoundX} accent="red" />
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white p-5 mb-6">
        <Field label="Cari User" hint="Cari berdasarkan nama atau email.">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className={inputCls}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="contoh: taradfworkspace@gmail.com"
            />
            <ActionButton onClick={() => loadUsers(search)} loading={loading}>Cari</ActionButton>
            <ActionButton variant="outline" onClick={handleManualRefresh} loading={refreshing}>
              <RefreshCw size={14} /> Refresh
            </ActionButton>
            <ActionButton variant="outline" onClick={handleResetView}>
              Reset
            </ActionButton>
            <ActionButton variant="outline" onClick={handleExportCsv} title={`Maksimal ${EXPORT_MAX_ROWS} baris per export`}>
              Export CSV
            </ActionButton>
          </div>
        </Field>

        <div className="mt-2 text-[11px] text-neutral-400">
          Export CSV dibatasi maksimal {EXPORT_MAX_ROWS} baris per file.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'Semua', count: users.length },
            { key: 'active', label: 'Aktif', count: stats.active },
            { key: 'blocked', label: 'Diblokir', count: stats.blocked },
            { key: 'disabled', label: 'Nonaktif', count: stats.disabled },
            { key: 'never_logged_in', label: 'Belum Pernah Login', count: stats.neverLoggedIn },
          ].map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold border transition ${active ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}
              >
                {tab.label} <span className={`ml-1 text-xs ${active ? 'text-white/80' : 'text-neutral-400'}`}>({tab.count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
      ) : users.length === 0 ? (
        <EmptyState icon={Users} title="User tidak ditemukan" description="Coba kata kunci lain atau cek kembali data user." />
      ) : filteredUsers.length === 0 ? (
        <EmptyState icon={Users} title="Tidak ada user di filter ini" description="Coba pilih filter status lain." />
      ) : (
        <div className="rounded-3xl border border-neutral-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr className="text-left text-neutral-500 uppercase tracking-[0.12em] text-[11px]">
                  <th className="px-4 py-3">
                    <button onClick={() => handleSort('name')} className="inline-flex items-center gap-1 hover:text-neutral-900 transition">
                      User <span className="text-[10px] opacity-60">{getSortMarker('name')}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button onClick={() => handleSort('role')} className="inline-flex items-center gap-1 hover:text-neutral-900 transition">
                      Role <span className="text-[10px] opacity-60">{getSortMarker('role')}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button onClick={() => handleSort('status')} className="inline-flex items-center gap-1 hover:text-neutral-900 transition">
                      Status <span className="text-[10px] opacity-60">{getSortMarker('status')}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3">Verifikasi Member</th>
                  <th className="px-4 py-3">
                    <button onClick={() => handleSort('last_sign_in_at')} className="inline-flex items-center gap-1 hover:text-neutral-900 transition">
                      Last Sign In <span className="text-[10px] opacity-60">{getSortMarker('last_sign_in_at')}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => {
                  const draftRole = roleDraftByUser[user.user_id] || '';
                  const currentRole = Array.isArray(user.roles) && user.roles.length > 0 ? user.roles[0] : '-';
                  const isBlocked = Boolean(user.is_blocked);
                  const isDisabled = Boolean(user.is_disabled);
                  const isSelf = user.user_id === auth?.id;
                  const isChanged = changedUserIds.includes(user.user_id);

                  return (
                    <tr key={user.user_id} className={`border-b border-neutral-100 align-top transition-colors ${isChanged ? 'bg-amber-50' : ''}`}>
                      <td className="px-4 py-4 min-w-[260px]">
                        <div className="font-semibold text-neutral-900">{user.full_name || '-'}</div>
                        <div className="text-xs text-neutral-500 mt-0.5">{user.email || '-'}</div>
                        {isSelf && (
                          <div className="text-[11px] text-blue-600 font-semibold mt-1">Akun Anda</div>
                        )}
                      </td>
                      <td className="px-4 py-4 min-w-[260px]">
                        <div className="text-xs text-neutral-500 mb-2">Saat ini: <span className="font-semibold text-neutral-700">{normalizeRoleLabel(currentRole)}</span></div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            className={selectCls}
                            value={draftRole}
                            onChange={(event) => setRoleDraftByUser((prev) => ({ ...prev, [user.user_id]: event.target.value }))}
                            disabled={rolesLoading || savingRoleUserId === user.user_id}
                          >
                            <option value="">Pilih role...</option>
                            {roles.map((roleItem) => (
                              <option key={roleItem.role} value={roleItem.role}>
                                {roleItem.display_name || normalizeRoleLabel(roleItem.role)}
                              </option>
                            ))}
                          </select>
                          <ActionButton
                            size="sm"
                            onClick={() => handleApplyRole(user.user_id)}
                            loading={savingRoleUserId === user.user_id}
                            disabled={!draftRole || draftRole === currentRole || rolesLoading}
                          >
                            <UserCog size={14} /> Simpan Role
                          </ActionButton>
                        </div>
                      </td>
                      <td className="px-4 py-4 min-w-[170px]">
                        {isDisabled ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] border bg-red-100 text-red-700 border-red-200">Nonaktif</span>
                        ) : isBlocked ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] border bg-amber-100 text-amber-700 border-amber-200">Diblokir</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] border bg-emerald-100 text-emerald-700 border-emerald-200">Aktif</span>
                        )}
                        {user.moderation_reason && (
                          <p className="text-xs text-neutral-500 mt-2">Alasan: {user.moderation_reason}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 min-w-[200px]">
                        {(() => {
                          const verificationStatus = user.user_metadata?.verification_status || 'none';
                          const verificationBadgeColor = 
                            verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            verificationStatus === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' :
                            verificationStatus === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            'bg-gray-100 text-gray-700 border-gray-200';
                          
                          const verificationLabel =
                            verificationStatus === 'verified' ? 'Terverifikasi' :
                            verificationStatus === 'rejected' ? 'Ditolak' :
                            verificationStatus === 'pending' ? 'Pending' :
                            'Belum Upload';

                          return (
                            <>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] border ${verificationBadgeColor}`}>
                                {verificationLabel}
                              </span>
                              {verificationStatus === 'pending' && (
                                <ActionButton
                                  size="sm"
                                  className="mt-2"
                                  onClick={() => {
                                    setVerificationReviewTarget(user);
                                    setVerificationApprovalNotes('');
                                  }}
                                >
                                  Review
                                </ActionButton>
                              )}
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-4 min-w-[180px] text-xs text-neutral-500">
                        {user.last_sign_in_at
                          ? new Date(user.last_sign_in_at).toLocaleString('id-ID')
                          : '-'}
                      </td>
                      <td className="px-4 py-4 min-w-[220px]">
                        <select
                          className={selectCls}
                          value=""
                          disabled={isSelf}
                          onChange={(event) => {
                            const actionValue = event.target.value;
                            event.target.value = '';

                            if (!actionValue) return;
                            if (actionValue === 'delete') {
                              setDeleteConfirmTarget(user);
                              return;
                            }

                            openModerationAction(user, actionValue);
                          }}
                        >
                          <option value="">{isSelf ? 'Aksi tidak tersedia' : 'Pilih aksi...'}</option>
                          {getModerationOptions(user).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                          <option value="delete">Hapus permanen</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-neutral-200 bg-neutral-50">
            <div className="text-xs text-neutral-500">
              Menampilkan {visibleUsers.length} dari {users.length} user yang sudah dimuat.
            </div>
            {hasMore ? (
              <ActionButton variant="outline" size="sm" onClick={handleLoadMore} loading={loadingMore}>
                Muat Lagi
              </ActionButton>
            ) : (
              <span className="text-xs text-neutral-400">Semua data sudah dimuat</span>
            )}
          </div>
        </div>
      )}

      <Modal
        open={Boolean(moderationTarget)}
        onClose={() => {
          if (moderationLoading) return;
          setModerationTarget(null);
          setModerationReason('');
        }}
        title={moderationTarget?.actionLabel || 'Update Status User'}
      >
        {moderationTarget && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Anda akan melakukan aksi <span className="font-semibold text-neutral-900">{moderationTarget.actionLabel}</span> untuk user
              <span className="font-semibold text-neutral-900"> {moderationTarget.user_name}</span>.
            </p>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
              {moderationTarget.actionSummary}
            </div>
            <Field label="Alasan" hint="Opsional, tetapi disarankan untuk audit.">
              <textarea
                className={inputCls}
                rows={4}
                value={moderationReason}
                onChange={(event) => setModerationReason(event.target.value)}
                placeholder="Masukkan alasan perubahan status akun"
              />
            </Field>
            <div className="flex gap-2 justify-end">
              <ActionButton
                variant="outline"
                onClick={() => {
                  if (moderationLoading) return;
                  setModerationTarget(null);
                  setModerationReason('');
                }}
              >
                Batal
              </ActionButton>
              <ActionButton onClick={handleSubmitModeration} loading={moderationLoading}>
                Konfirmasi
              </ActionButton>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(verificationReviewTarget)}
        onClose={() => {
          if (verificationApprovalLoading) return;
          setVerificationReviewTarget(null);
          setVerificationApprovalNotes('');
        }}
        title="Review Verifikasi Member"
      >
        {verificationReviewTarget && (
          <div className="space-y-6">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Data Member</div>
              <div className="mt-3 space-y-2 text-sm">
                <div><span className="text-neutral-600">Nama:</span> <span className="font-semibold">{verificationReviewTarget.full_name || '-'}</span></div>
                <div><span className="text-neutral-600">Email:</span> <span className="font-semibold">{verificationReviewTarget.email || '-'}</span></div>
                <div><span className="text-neutral-600">Status Akun:</span> <span className="font-semibold">{mapUserStatus(verificationReviewTarget)}</span></div>
              </div>
            </div>

            {verificationReviewTarget.user_metadata?.submission_data && (
              <div>
                <div className="text-sm font-semibold text-neutral-900 mb-3">Data Form yang Disubmit</div>
                <div className="bg-neutral-50 rounded-lg p-4 space-y-2 text-sm">
                  {Object.entries(verificationReviewTarget.user_metadata.submission_data).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-neutral-600 capitalize">{String(key).replace(/_/g, ' ')}:</span>
                      <span className="font-semibold text-neutral-900">{String(value || '-')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {verificationReviewTarget.user_metadata?.ktp_url && (
              <div>
                <div className="text-sm font-semibold text-neutral-900 mb-3">Foto KTP</div>
                <div className="rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50">
                  <img src={verificationReviewTarget.user_metadata.ktp_url} alt="KTP" className="w-full h-auto max-h-[300px] object-cover" />
                </div>
              </div>
            )}

            {verificationReviewTarget.user_metadata?.selfie_url && (
              <div>
                <div className="text-sm font-semibold text-neutral-900 mb-3">Foto Selfie</div>
                <div className="rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50">
                  <img src={verificationReviewTarget.user_metadata.selfie_url} alt="Selfie" className="w-full h-auto max-h-[300px] object-cover" />
                </div>
              </div>
            )}

            <Field label="Catatan Approval" hint="Opsional, untuk dokumentasi keputusan verifikasi.">
              <textarea
                className={inputCls}
                rows={3}
                value={verificationApprovalNotes}
                onChange={(event) => setVerificationApprovalNotes(event.target.value)}
                placeholder="Masukkan catatan untuk verifikasi ini..."
              />
            </Field>

            <div className="flex gap-2 justify-end">
              <ActionButton
                variant="outline"
                onClick={() => {
                  if (verificationApprovalLoading) return;
                  setVerificationReviewTarget(null);
                  setVerificationApprovalNotes('');
                }}
                disabled={verificationApprovalLoading}
              >
                Batal
              </ActionButton>
              <ActionButton
                variant="danger"
                onClick={() => handleVerificationApproval(false)}
                loading={verificationApprovalLoading}
              >
                Tolak
              </ActionButton>
              <ActionButton
                onClick={() => handleVerificationApproval(true)}
                loading={verificationApprovalLoading}
              >
                Setujui
              </ActionButton>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(deleteConfirmTarget)}
        onClose={() => {
          if (deleteLoading) return;
          setDeleteConfirmTarget(null);
        }}
        title="Hapus User"
      >
        {deleteConfirmTarget && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-900">
                <span className="font-semibold">Perhatian!</span> Anda akan menghapus user <span className="font-semibold">{deleteConfirmTarget.full_name || deleteConfirmTarget.email}</span> secara permanen.
              </p>
              <p className="text-xs text-red-800 mt-2">
                Tindakan ini tidak dapat dibatalkan. Semua data pengguna dan riwayatnya akan dihapus dari sistem.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <ActionButton
                variant="outline"
                onClick={() => {
                  if (deleteLoading) return;
                  setDeleteConfirmTarget(null);
                }}
                disabled={deleteLoading}
              >
                Batal
              </ActionButton>
              <ActionButton
                variant="danger"
                onClick={handleDeleteUser}
                loading={deleteLoading}
              >
                Hapus Selamanya
              </ActionButton>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
