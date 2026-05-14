import React, { useState, useEffect, useCallback } from 'react';
import { Newspaper, Plus, Edit3, Trash2, Star, BookOpen, HelpCircle, Check, X, Eye, Search, Sparkles, History, Clock3, Wand2, ExternalLink, PlayCircle } from 'lucide-react';
import AdminLayout, { StatCard, EmptyState, StatusBadge, Modal, Field, ActionButton, inputCls, textareaCls, selectCls } from '../AdminLayout.jsx';
import { supabase } from '../../../config/supabase.js';

const NEWSROOM_TIMEOUT_MS = 15000;
const NEWSROOM_LOCAL_DRAFT_KEY = 'stadione_newsroom_local_draft_v1';
const NEWSROOM_PAGE_SIZE = 8;
const NEWSROOM_SCHEDULE_KEY = 'stadione_newsroom_schedule_v1';
const NEWSROOM_VERSION_KEY = 'stadione_newsroom_versions_v1';
const NEWSROOM_SOURCE_LIMIT = 8;
const NEWS_SELECT_EXTENDED = 'id,title,category,excerpt,author,date,featured,published,image_url,tags,updated_at,body,read_time,color';
const NEWS_SELECT_LEGACY = 'id,title,category,excerpt,author,date,featured,read_time,color';

function withTimeout(promise, timeoutMs = NEWSROOM_TIMEOUT_MS, fallbackMessage = 'Request timeout') {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(fallbackMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function isMissingColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('column') || message.includes('schema cache') || message.includes('does not exist');
}

function safeReadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeWriteJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore local storage write errors
  }
}

function slugifyTitle(value = '') {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function plainText(value = '') {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarizeForOpinion(source, query) {
  const sourceTitle = plainText(source?.title || 'Isu global olahraga');
  const sourceDesc = plainText(source?.description || '');
  const sourceSite = plainText(source?.sourceName || 'media internasional');
  const keyTopic = plainText(query || 'tren olahraga global');
  const opinionTitle = `Yang Bisa Kita Pelajari dari ${sourceTitle}`;
  const excerpt = `Sudut pandang santai dari redaksi Stadione tentang ${keyTopic}, dengan fokus ke pelajaran jangka panjang yang relevan buat ekosistem olahraga kita.`;

  const body = [
    `Ringkasan sumber: ${sourceTitle} (${sourceSite}).`,
    sourceDesc ? `Poin utama yang terlihat: ${sourceDesc}.` : 'Poin utama yang terlihat: ada perubahan ritme dan prioritas di level global yang patut kita perhatikan.',
    '',
    'Opini Stadione:',
    'Kadang kita terlalu sibuk mengejar momentum jangka pendek, padahal nilai terbesar biasanya datang dari konsistensi. Ketika lanskap olahraga global berubah, yang paling penting bukan sekadar ikut tren, tapi memahami prinsip yang bertahan lama.',
    'Prinsip itu sederhana: kualitas fondasi, kejelasan peran, dan eksekusi yang disiplin. Tim yang menang dalam jangka panjang hampir selalu punya kebiasaan baik yang membosankan, tapi dijalankan terus menerus.',
    'Untuk konteks lokal, pelajarannya jelas. Daripada menunggu sistem sempurna, lebih baik mulai dari hal kecil yang rutin: pembinaan, pencatatan performa, dan komunikasi yang rapi antar peran. Ini terlihat sederhana, tapi dampaknya menumpuk.',
    '',
    'Takeaway timeless:',
    '1) Bangun sistem sebelum mengejar sorotan.',
    '2) Pilih metrik yang benar-benar menggambarkan progres.',
    '3) Ulangi proses yang bekerja, evaluasi yang tidak bekerja.',
    '',
    'Catatan editorial: Artikel ini merupakan tulisan ulang berbasis ringkasan sumber publik, dengan sudut pandang opini orisinal redaksi Stadione.',
    `Sumber referensi: ${source?.link || '-'}`,
  ].join('\n');

  const tags = ['opini', 'timeless', 'global sports', keyTopic].join(', ');

  return {
    title: opinionTitle,
    excerpt,
    body,
    category: 'Analisis',
    author: 'Redaksi Stadione',
    featured: false,
    published: false,
    tags,
    image_url: '',
    slug: slugifyTitle(opinionTitle),
    meta_title: opinionTitle,
    meta_description: excerpt,
    scheduled_publish_at: '',
  };
}

function normalizeNewsRow(row, schemaMode) {
  if (!row) return row;
  if (schemaMode === 'extended') {
    return {
      ...row,
      published: row.published !== false,
      body: row.body || '',
      image_url: row.image_url || '',
      tags: Array.isArray(row.tags) ? row.tags : (row.tags || []),
    };
  }

  return {
    ...row,
    published: true,
    body: '',
    image_url: '',
    tags: [],
    updated_at: null,
  };
}

function getSortableDate(article) {
  const candidate = article?.updated_at || article?.date || '';
  const ts = new Date(candidate).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

const EMPTY_ARTICLE = {
  title: '', category: 'Berita', excerpt: '', body: '', author: '', image_url: '', featured: false, published: true, tags: '', slug: '', meta_title: '', meta_description: '', scheduled_publish_at: '',
};

const EMPTY_QUIZ = {
  question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', explanation: '',
};

const CATEGORIES = ['Berita', 'Analisis', 'Turnamen', 'Komunitas', 'Pelatihan', 'Venue', 'Sponsor', 'Lainnya'];

export default function NewsroomPage({ auth, onBack, onNav }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [updatingArticleId, setUpdatingArticleId] = useState(null);
  const [requestError, setRequestError] = useState('');
  const [newsSchemaMode, setNewsSchemaMode] = useState('extended');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [scheduleMap, setScheduleMap] = useState({});
  const [showVersionsModal, setShowVersionsModal] = useState(false);
  const [versionArticleId, setVersionArticleId] = useState(null);
  const [versionList, setVersionList] = useState([]);
  const [infoMessage, setInfoMessage] = useState('');
  const [runningSchedule, setRunningSchedule] = useState(false);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [sourceQuery, setSourceQuery] = useState('global football trends');
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState('');
  const [sourceItems, setSourceItems] = useState([]);

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editArticle, setEditArticle] = useState(null);
  const [form, setForm] = useState(EMPTY_ARTICLE);
  const [hasLocalDraft, setHasLocalDraft] = useState(false);
  const [selectedArticleIds, setSelectedArticleIds] = useState([]);
  const [previewArticle, setPreviewArticle] = useState(null);

  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizArticle, setQuizArticle] = useState(null);
  const [quizList, setQuizList] = useState([]);
  const [quizForm, setQuizForm] = useState(EMPTY_QUIZ);
  const [savingQuiz, setSavingQuiz] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    setScheduleMap(safeReadJson(NEWSROOM_SCHEDULE_KEY, {}));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setRequestError('');
    setInfoMessage('');
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('news')
          .select(NEWS_SELECT_EXTENDED)
          .order('date', { ascending: false }),
        NEWSROOM_TIMEOUT_MS,
        'Gagal memuat artikel: koneksi timeout.'
      );

      if (error) throw error;
      setNewsSchemaMode('extended');
      setArticles((data || []).map((row) => normalizeNewsRow(row, 'extended')));
    } catch (err) {
      if (!isMissingColumnError(err)) {
        console.error('Newsroom load error:', err);
        setRequestError(err?.message || 'Gagal memuat artikel.');
      } else {
        try {
          const { data: legacyData, error: legacyError } = await withTimeout(
            supabase
              .from('news')
              .select(NEWS_SELECT_LEGACY)
              .order('date', { ascending: false }),
            NEWSROOM_TIMEOUT_MS,
            'Gagal memuat artikel: koneksi timeout.'
          );

          if (legacyError) throw legacyError;
          setNewsSchemaMode('legacy');
          setArticles((legacyData || []).map((row) => normalizeNewsRow(row, 'legacy')));
          setRequestError('');
        } catch (legacyErr) {
          console.error('Newsroom load legacy fallback error:', legacyErr);
          setRequestError(legacyErr?.message || 'Gagal memuat artikel.');
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditArticle(null);
    let nextForm = EMPTY_ARTICLE;
    let draftLoaded = false;

    try {
      const raw = localStorage.getItem(NEWSROOM_LOCAL_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        nextForm = {
          ...EMPTY_ARTICLE,
          ...parsed,
        };
        draftLoaded = true;
      }
    } catch (err) {
      console.warn('Failed to read newsroom local draft:', err?.message || err);
    }

    setForm(nextForm);
    setHasLocalDraft(draftLoaded);
    setShowForm(true);
  }

  function openEdit(article) {
    setEditArticle(article);
    setForm({
      title: article.title || '',
      category: article.category || 'Berita',
      excerpt: article.excerpt || '',
      body: article.body || '',
      author: article.author || '',
      image_url: article.image_url || '',
      featured: article.featured || false,
      published: article.published !== false,
      tags: Array.isArray(article.tags) ? article.tags.join(', ') : (article.tags || ''),
      slug: article.slug || '',
      meta_title: article.meta_title || '',
      meta_description: article.meta_description || '',
      scheduled_publish_at: scheduleMap[String(article.id)] || '',
    });
    setHasLocalDraft(false);
    setShowForm(true);
  }

  function openVersions(article) {
    const versionStore = safeReadJson(NEWSROOM_VERSION_KEY, {});
    const list = versionStore[String(article.id)] || [];
    setVersionArticleId(article.id);
    setVersionList(list);
    setShowVersionsModal(true);
  }

  function saveVersionSnapshot(articleId, snapshot) {
    if (!articleId) return;

    const store = safeReadJson(NEWSROOM_VERSION_KEY, {});
    const current = store[String(articleId)] || [];
    const next = [
      {
        id: `${articleId}-${Date.now()}`,
        saved_at: new Date().toISOString(),
        data: snapshot,
      },
      ...current,
    ].slice(0, 20);

    const updatedStore = {
      ...store,
      [String(articleId)]: next,
    };

    safeWriteJson(NEWSROOM_VERSION_KEY, updatedStore);
  }

  function restoreVersion(item) {
    if (!item?.data) return;
    setForm({
      ...EMPTY_ARTICLE,
      ...item.data,
      scheduled_publish_at: scheduleMap[String(versionArticleId)] || '',
    });
    setShowVersionsModal(false);
    setShowForm(true);
  }

  function clearLocalDraft() {
    try {
      localStorage.removeItem(NEWSROOM_LOCAL_DRAFT_KEY);
    } catch (err) {
      console.warn('Failed to clear newsroom local draft:', err?.message || err);
    }
    setHasLocalDraft(false);
  }

  useEffect(() => {
    if (!showForm || editArticle) return;

    try {
      localStorage.setItem(NEWSROOM_LOCAL_DRAFT_KEY, JSON.stringify(form));
      setHasLocalDraft(true);
    } catch (err) {
      console.warn('Failed to save newsroom local draft:', err?.message || err);
    }
  }, [showForm, editArticle, form]);

  async function handleSaveArticle() {
    if (!form.title.trim() || !form.author.trim()) return;
    setSaving(true);
    setRequestError('');
    setInfoMessage('');
    try {
      const basePayload = {
        title: form.title.trim(),
        category: form.category,
        excerpt: form.excerpt.trim(),
        author: form.author.trim(),
        featured: form.featured,
        date: editArticle?.date || new Date().toISOString().split('T')[0],
        read_time: editArticle?.read_time || '5 min',
      };

      const extendedPayload = {
        ...basePayload,
        body: form.body.trim(),
        image_url: form.image_url.trim() || null,
        published: form.published,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        slug: form.slug.trim() || slugifyTitle(form.title),
        meta_title: form.meta_title.trim() || form.title.trim(),
        meta_description: form.meta_description.trim() || form.excerpt.trim(),
        updated_at: new Date().toISOString(),
        created_by: auth?.id || null,
      };

      const payload = newsSchemaMode === 'extended' ? extendedPayload : basePayload;
      const hasSchedule = Boolean(form.scheduled_publish_at);
      const scheduleIso = hasSchedule ? new Date(form.scheduled_publish_at).toISOString() : '';

      if (editArticle) {
        if (hasSchedule && newsSchemaMode === 'extended') {
          payload.published = false;
        }
        const { error } = await withTimeout(
          supabase.from('news').update(payload).eq('id', editArticle.id),
          NEWSROOM_TIMEOUT_MS,
          'Gagal menyimpan artikel: koneksi timeout.'
        );
        if (error) throw error;

        if (hasSchedule) {
          const nextSchedule = {
            ...safeReadJson(NEWSROOM_SCHEDULE_KEY, {}),
            [String(editArticle.id)]: scheduleIso,
          };
          safeWriteJson(NEWSROOM_SCHEDULE_KEY, nextSchedule);
          setScheduleMap(nextSchedule);
        } else {
          const currentSchedule = safeReadJson(NEWSROOM_SCHEDULE_KEY, {});
          if (currentSchedule[String(editArticle.id)]) {
            delete currentSchedule[String(editArticle.id)];
            safeWriteJson(NEWSROOM_SCHEDULE_KEY, currentSchedule);
            setScheduleMap(currentSchedule);
          }
        }

        saveVersionSnapshot(editArticle.id, {
          title: form.title,
          category: form.category,
          excerpt: form.excerpt,
          body: form.body,
          author: form.author,
          image_url: form.image_url,
          featured: form.featured,
          published: form.published,
          tags: form.tags,
          slug: form.slug,
          meta_title: form.meta_title,
          meta_description: form.meta_description,
        });
      } else {
        let insertPayload = payload;
        if (newsSchemaMode === 'legacy') {
          const { data: latestData, error: latestError } = await withTimeout(
            supabase
              .from('news')
              .select('id')
              .order('id', { ascending: false })
              .limit(1),
            NEWSROOM_TIMEOUT_MS,
            'Gagal menyiapkan ID artikel baru: koneksi timeout.'
          );
          if (latestError) throw latestError;

          const currentMaxId = Number(latestData?.[0]?.id || 0);
          insertPayload = {
            ...payload,
            id: currentMaxId + 1,
          };
        }

        if (hasSchedule && newsSchemaMode === 'extended') {
          insertPayload.published = false;
        }

        const { error } = await withTimeout(
          supabase.from('news').insert(insertPayload),
          NEWSROOM_TIMEOUT_MS,
          'Gagal publish artikel: koneksi timeout.'
        );
        if (error) throw error;

        if (hasSchedule) {
          const nextId = newsSchemaMode === 'legacy'
            ? insertPayload.id
            : Number(articles.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0)) + 1;

          const nextSchedule = {
            ...safeReadJson(NEWSROOM_SCHEDULE_KEY, {}),
            [String(nextId)]: scheduleIso,
          };
          safeWriteJson(NEWSROOM_SCHEDULE_KEY, nextSchedule);
          setScheduleMap(nextSchedule);
        }
      }
      setShowForm(false);
      clearLocalDraft();
      await load();
    } catch (err) {
      console.error('Save article error:', err);
      setRequestError(err?.message || 'Gagal menyimpan artikel.');
    } finally {
      setSaving(false);
    }
  }

  async function runScheduledPublish() {
    if (newsSchemaMode !== 'extended') return;

    const now = Date.now();
    const dueIds = Object.entries(scheduleMap)
      .filter(([, iso]) => {
        const ts = new Date(iso).getTime();
        return Number.isFinite(ts) && ts <= now;
      })
      .map(([id]) => Number(id))
      .filter((id) => Number.isFinite(id));

    if (dueIds.length === 0) {
      setInfoMessage('Tidak ada artikel terjadwal yang jatuh tempo saat ini.');
      return;
    }

    try {
      const { error } = await withTimeout(
        supabase
          .from('news')
          .update({ published: true, updated_at: new Date().toISOString() })
          .in('id', dueIds),
        NEWSROOM_TIMEOUT_MS,
        'Gagal menjalankan publish terjadwal: koneksi timeout.'
      );

      if (error) throw error;

      const nextSchedule = { ...scheduleMap };
      dueIds.forEach((id) => {
        delete nextSchedule[String(id)];
      });
      safeWriteJson(NEWSROOM_SCHEDULE_KEY, nextSchedule);
      setScheduleMap(nextSchedule);
      setInfoMessage(`${dueIds.length} artikel terjadwal berhasil dipublish.`);
      await load();
    } catch (err) {
      console.error('Scheduled publish error:', err);
      setRequestError(err?.message || 'Gagal menjalankan publish terjadwal.');
    }
  }

  async function handleRunScheduledNow() {
    setRunningSchedule(true);
    await runScheduledPublish();
    setRunningSchedule(false);
  }

  async function handleSearchSources() {
    if (!sourceQuery.trim()) return;

    setSourceLoading(true);
    setSourceError('');
    setSourceItems([]);

    try {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(sourceQuery.trim())}&hl=en-US&gl=US&ceid=US:en`;
      const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

      const response = await withTimeout(
        fetch(endpoint),
        NEWSROOM_TIMEOUT_MS,
        'Gagal mencari sumber berita: koneksi timeout.'
      );

      if (!response.ok) {
        throw new Error('Gagal mengambil sumber berita luar negeri.');
      }

      const json = await response.json();
      const items = (json?.items || [])
        .slice(0, NEWSROOM_SOURCE_LIMIT)
        .map((item) => ({
          title: plainText(item?.title || ''),
          description: plainText(item?.description || ''),
          link: item?.link || '',
          pubDate: item?.pubDate || '',
          sourceName: plainText(item?.author || item?.source || 'Global Source'),
        }))
        .filter((item) => item.title && item.link);

      if (items.length === 0) {
        throw new Error('Sumber tidak ditemukan untuk kata kunci tersebut.');
      }

      setSourceItems(items);
      setInfoMessage(`Menemukan ${items.length} sumber berita luar negeri.`);
    } catch (err) {
      setSourceError(err?.message || 'Gagal memuat sumber berita.');
    } finally {
      setSourceLoading(false);
    }
  }

  function handleGenerateFromSource(source) {
    const generated = summarizeForOpinion(source, sourceQuery);
    setEditArticle(null);
    setForm(generated);
    setHasLocalDraft(false);
    setShowGeneratorModal(false);
    setShowForm(true);
    setInfoMessage('Draft artikel otomatis berhasil dibuat. Mohon review sebelum publish.');
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setRequestError('');
    setInfoMessage('');
    try {
      const { error } = await withTimeout(
        supabase.from('news').delete().eq('id', deleteTarget.id),
        NEWSROOM_TIMEOUT_MS,
        'Gagal menghapus artikel: koneksi timeout.'
      );
      if (error) throw error;
      setDeleteTarget(null);
      await load();
    } catch (err) {
      console.error('Delete article error:', err);
      setRequestError(err?.message || 'Gagal menghapus artikel.');
    }
  }

  function toggleSelectArticle(articleId) {
    setSelectedArticleIds((prev) => (
      prev.includes(articleId)
        ? prev.filter((id) => id !== articleId)
        : [...prev, articleId]
    ));
  }

  function toggleSelectAll(filteredArticles) {
    const visibleIds = filteredArticles.map((article) => article.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedArticleIds.includes(id));

    if (allVisibleSelected) {
      setSelectedArticleIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedArticleIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  }

  async function handleBulkUpdate(partialPayload, timeoutMessage) {
    if (selectedArticleIds.length === 0) return;

    setBulkSaving(true);
    setRequestError('');
    setInfoMessage('');
    try {
      const updatePayload = newsSchemaMode === 'extended'
        ? { ...partialPayload, updated_at: new Date().toISOString() }
        : partialPayload;

      const { error } = await withTimeout(
        supabase
          .from('news')
          .update(updatePayload)
          .in('id', selectedArticleIds),
        NEWSROOM_TIMEOUT_MS,
        timeoutMessage
      );

      if (error) throw error;

      setSelectedArticleIds([]);
      await load();
    } catch (err) {
      console.error('Bulk update article error:', err);
      setRequestError(err?.message || 'Gagal memperbarui artikel terpilih.');
    } finally {
      setBulkSaving(false);
    }
  }

  async function handleQuickUpdate(article, partialPayload, timeoutMessage) {
    if (!article?.id) return;

    setUpdatingArticleId(article.id);
    setRequestError('');
    setInfoMessage('');
    try {
      const updatePayload = newsSchemaMode === 'extended'
        ? { ...partialPayload, updated_at: new Date().toISOString() }
        : partialPayload;

      const { data, error } = await withTimeout(
        supabase
          .from('news')
          .update(updatePayload)
          .eq('id', article.id)
          .select(NEWS_SELECT_EXTENDED)
          .maybeSingle(),
        NEWSROOM_TIMEOUT_MS,
        timeoutMessage
      );

      if (error && isMissingColumnError(error)) {
        const { data: legacyData, error: legacyError } = await withTimeout(
          supabase
            .from('news')
            .update(updatePayload)
            .eq('id', article.id)
            .select(NEWS_SELECT_LEGACY)
            .maybeSingle(),
          NEWSROOM_TIMEOUT_MS,
          timeoutMessage
        );

        if (legacyError) throw legacyError;
        const normalizedLegacyRow = normalizeNewsRow(legacyData, 'legacy');
        setArticles((prev) => prev.map((item) => (item.id === article.id ? normalizedLegacyRow : item)));
        return;
      }

      if (error) throw error;

      const normalizedRow = normalizeNewsRow(data, newsSchemaMode);
      setArticles((prev) => prev.map((item) => (item.id === article.id ? normalizedRow : item)));
    } catch (err) {
      console.error('Quick update article error:', err);
      setRequestError(err?.message || 'Gagal memperbarui artikel.');
    } finally {
      setUpdatingArticleId(null);
    }
  }

  async function handleDuplicateArticle(article) {
    if (!article?.id) return;

    setRequestError('');
    setSaving(true);
    try {
      const basePayload = {
        title: `${article.title || 'Artikel'} (Copy)`,
        category: article.category || 'Berita',
        excerpt: article.excerpt || '',
        author: article.author || '',
        featured: false,
        date: new Date().toISOString().split('T')[0],
        read_time: article.read_time || '5 min',
      };

      const extendedPayload = {
        ...basePayload,
        body: article.body || '',
        image_url: article.image_url || null,
        published: false,
        tags: Array.isArray(article.tags) ? article.tags : [],
        updated_at: new Date().toISOString(),
        created_by: auth?.id || null,
      };

      const payload = newsSchemaMode === 'extended' ? extendedPayload : basePayload;
      let insertPayload = payload;

      if (newsSchemaMode === 'legacy') {
        const { data: latestData, error: latestError } = await withTimeout(
          supabase.from('news').select('id').order('id', { ascending: false }).limit(1),
          NEWSROOM_TIMEOUT_MS,
          'Gagal menyalin artikel: koneksi timeout.'
        );
        if (latestError) throw latestError;
        insertPayload = {
          ...payload,
          id: Number(latestData?.[0]?.id || 0) + 1,
        };
      }

      const { error } = await withTimeout(
        supabase.from('news').insert(insertPayload),
        NEWSROOM_TIMEOUT_MS,
        'Gagal menyalin artikel: koneksi timeout.'
      );
      if (error) throw error;

      await load();
    } catch (err) {
      console.error('Duplicate article error:', err);
      setRequestError(err?.message || 'Gagal menduplikasi artikel.');
    } finally {
      setSaving(false);
    }
  }

  async function openQuizManager(article) {
    setQuizArticle(article);
    setShowQuizModal(true);
    setQuizForm(EMPTY_QUIZ);
    const { data } = await supabase.from('article_quiz').select('*').eq('article_id', article.id);
    setQuizList(data || []);
  }

  async function handleAddQuiz() {
    if (!quizForm.question.trim() || !quizArticle) return;
    setSavingQuiz(true);
    try {
      await supabase.from('article_quiz').insert({
        article_id: quizArticle.id,
        question: quizForm.question.trim(),
        option_a: quizForm.option_a.trim(),
        option_b: quizForm.option_b.trim(),
        option_c: quizForm.option_c.trim(),
        option_d: quizForm.option_d.trim(),
        correct_answer: quizForm.correct_answer,
        explanation: quizForm.explanation.trim(),
      });
      setQuizForm(EMPTY_QUIZ);
      const { data } = await supabase.from('article_quiz').select('*').eq('article_id', quizArticle.id);
      setQuizList(data || []);
    } catch (err) {
      console.error('Add quiz error:', err);
    } finally {
      setSavingQuiz(false);
    }
  }

  async function handleDeleteQuiz(quizId) {
    await supabase.from('article_quiz').delete().eq('id', quizId);
    const { data } = await supabase.from('article_quiz').select('*').eq('article_id', quizArticle.id);
    setQuizList(data || []);
  }

  const published = articles.filter((a) => a.published !== false);
  const drafts = articles.filter((a) => a.published === false);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredArticles = articles.filter((article) => {
    const statusPass = statusFilter === 'all'
      ? true
      : statusFilter === 'published'
        ? article.published !== false
        : article.published === false;

    const categoryPass = categoryFilter === 'all' ? true : article.category === categoryFilter;

    const searchPass = !normalizedQuery
      ? true
      : [article.title, article.author, article.excerpt]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));

    return statusPass && categoryPass && searchPass;
  });

  const sortedArticles = [...filteredArticles].sort((a, b) => {
    if (sortBy === 'title-az') return String(a.title || '').localeCompare(String(b.title || ''), 'id');
    if (sortBy === 'title-za') return String(b.title || '').localeCompare(String(a.title || ''), 'id');
    if (sortBy === 'oldest') return getSortableDate(a) - getSortableDate(b);
    return getSortableDate(b) - getSortableDate(a);
  });

  const totalPages = Math.max(1, Math.ceil(sortedArticles.length / NEWSROOM_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * NEWSROOM_PAGE_SIZE;
  const pagedArticles = sortedArticles.slice(startIndex, startIndex + NEWSROOM_PAGE_SIZE);

  const visibleIds = pagedArticles.map((article) => article.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedArticleIds.includes(id));
  const selectedCount = selectedArticleIds.length;
  const metaTitleLength = (form.meta_title || '').trim().length;
  const metaDescriptionLength = (form.meta_description || '').trim().length;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, categoryFilter, sortBy]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!Object.keys(scheduleMap || {}).length) return;
    runScheduledPublish();
  }, [scheduleMap]);

  return (
    <AdminLayout
      variant="platform"
      kicker="/ PLATFORM — NEWSROOM"
      title={<>NEWSROOM<br /><span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400 }}>& konten.</span></>}
      subtitle="Tulis, edit, dan kelola semua artikel berita, highlight, dan konten publik STADIONE."
      onBack={onBack}
      breadcrumbs={[{ label: 'Platform Console', onClick: () => onNav('platform-console') }, { label: 'Newsroom' }]}
    >
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Artikel" value={loading ? '—' : articles.length} icon={Newspaper} accent="violet" />
        <StatCard label="Dipublish" value={loading ? '—' : published.length} icon={Eye} accent="emerald" />
        <StatCard label="Draft" value={loading ? '—' : drafts.length} icon={BookOpen} accent="amber" />
      </div>

      {/* Header + create button */}
      <div className="flex items-center justify-between mb-5">
        <div className="font-display text-2xl text-neutral-900">Semua Artikel</div>
        <ActionButton onClick={openCreate} size="sm">
          <Plus size={14} /> Artikel Baru
        </ActionButton>
      </div>

      {requestError && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {requestError}
        </div>
      )}

      {infoMessage && (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {infoMessage}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_180px_180px_180px] gap-3 mb-5">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            className={`${inputCls} pl-10`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul, penulis, atau ringkasan..."
          />
        </div>
        <select className={selectCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Semua Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <select className={selectCls} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">Semua Kategori</option>
          {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <select className={selectCls} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="newest">Urut: Terbaru</option>
          <option value="oldest">Urut: Terlama</option>
          <option value="title-az">Urut: Judul A-Z</option>
          <option value="title-za">Urut: Judul Z-A</option>
        </select>
      </div>

      <div className="mb-4 rounded-2xl border border-neutral-200 bg-white px-4 py-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => toggleSelectAll(pagedArticles)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-neutral-200 hover:border-neutral-400 text-neutral-700"
        >
          {allVisibleSelected ? 'Batal Pilih Halaman' : 'Pilih Semua (Halaman Ini)'}
        </button>
        <span className="text-xs text-neutral-500">{selectedCount} artikel terpilih</span>
        {newsSchemaMode === 'extended' && (
          <button
            onClick={() => handleBulkUpdate({ published: true }, 'Gagal publish massal: koneksi timeout.')}
            disabled={selectedCount === 0 || bulkSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-200 hover:border-emerald-400 text-emerald-700 disabled:opacity-60"
          >
            Publish Terpilih
          </button>
        )}
        {newsSchemaMode === 'extended' && (
          <button
            onClick={() => handleBulkUpdate({ published: false }, 'Gagal unpublish massal: koneksi timeout.')}
            disabled={selectedCount === 0 || bulkSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-200 hover:border-amber-400 text-amber-700 disabled:opacity-60"
          >
            Unpublish Terpilih
          </button>
        )}
        <button
          onClick={() => handleBulkUpdate({ featured: true }, 'Gagal set featured massal: koneksi timeout.')}
          disabled={selectedCount === 0 || bulkSaving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-violet-200 hover:border-violet-400 text-violet-700 disabled:opacity-60"
        >
          Featured Terpilih
        </button>
        <span className="text-xs text-neutral-400 ml-auto">
          {Object.keys(scheduleMap || {}).length} artikel terjadwal
        </span>
        <button
          onClick={handleRunScheduledNow}
          disabled={runningSchedule || newsSchemaMode !== 'extended'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-blue-200 hover:border-blue-400 text-blue-700 disabled:opacity-60"
        >
          <PlayCircle size={12} /> Jalankan Schedule
        </button>
        <button
          onClick={() => setShowGeneratorModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-violet-200 hover:border-violet-400 text-violet-700"
        >
          <Wand2 size={12} /> Auto Generate
        </button>
      </div>

      {/* Article list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />)}
        </div>
      ) : sortedArticles.length === 0 ? (
        <EmptyState icon={Newspaper} title="Belum ada artikel" description="Mulai buat artikel pertama untuk newsroom." action={<ActionButton onClick={openCreate}><Plus size={14} /> Buat Artikel</ActionButton>} />
      ) : (
        <div className="space-y-3">
          {pagedArticles.map((article) => (
            <div key={article.id} className="flex items-start gap-4 p-4 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-300 transition">
              <label className="pt-1">
                <input
                  type="checkbox"
                  checked={selectedArticleIds.includes(article.id)}
                  onChange={() => toggleSelectArticle(article.id)}
                  className="w-4 h-4 rounded"
                />
              </label>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[11px] uppercase tracking-[0.16em] font-black text-neutral-400">{article.category}</span>
                  {article.featured && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                      <Star size={9} fill="currentColor" /> Featured
                    </span>
                  )}
                  <StatusBadge status={article.published !== false ? 'published' : 'draft'} />
                </div>
                <div className="font-semibold text-neutral-900 leading-snug truncate">{article.title}</div>
                <div className="text-sm text-neutral-500 mt-0.5 truncate">{article.excerpt}</div>
                <div className="text-xs text-neutral-400 mt-1">{article.author} · {article.date}</div>
                {scheduleMap[String(article.id)] && (
                  <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                    <Clock3 size={11} /> Publish: {new Date(scheduleMap[String(article.id)]).toLocaleString('id-ID')}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {newsSchemaMode === 'extended' && (
                    <button
                      onClick={() => handleQuickUpdate(article, { published: article.published === false }, 'Gagal mengubah status publish: koneksi timeout.')}
                      disabled={updatingArticleId === article.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border border-neutral-200 hover:border-neutral-400 text-neutral-700 disabled:opacity-60"
                    >
                      <Eye size={12} /> {article.published === false ? 'Publish Cepat' : 'Unpublish'}
                    </button>
                  )}
                  <button
                    onClick={() => handleQuickUpdate(article, { featured: !article.featured }, 'Gagal mengubah status featured: koneksi timeout.')}
                    disabled={updatingArticleId === article.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border border-amber-200 hover:border-amber-400 text-amber-700 disabled:opacity-60"
                  >
                    <Sparkles size={12} /> {article.featured ? 'Hapus Featured' : 'Jadikan Featured'}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setPreviewArticle(article)} title="Preview" className="w-8 h-8 rounded-xl hover:bg-blue-50 text-neutral-400 hover:text-blue-600 flex items-center justify-center transition">
                  <Eye size={15} />
                </button>
                <button onClick={() => openQuizManager(article)} title="Kelola Quiz" className="w-8 h-8 rounded-xl hover:bg-violet-50 text-neutral-400 hover:text-violet-600 flex items-center justify-center transition">
                  <HelpCircle size={15} />
                </button>
                <button onClick={() => openEdit(article)} title="Edit" className="w-8 h-8 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 flex items-center justify-center transition">
                  <Edit3 size={15} />
                </button>
                <button onClick={() => openVersions(article)} title="Riwayat Versi" className="w-8 h-8 rounded-xl hover:bg-indigo-50 text-neutral-400 hover:text-indigo-600 flex items-center justify-center transition">
                  <History size={15} />
                </button>
                <button onClick={() => handleDuplicateArticle(article)} title="Duplicate" className="w-8 h-8 rounded-xl hover:bg-emerald-50 text-neutral-400 hover:text-emerald-600 flex items-center justify-center transition">
                  <BookOpen size={15} />
                </button>
                <button onClick={() => setDeleteTarget(article)} title="Hapus" className="w-8 h-8 rounded-xl hover:bg-red-50 text-neutral-400 hover:text-red-600 flex items-center justify-center transition">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-neutral-500">
                Halaman {safeCurrentPage} dari {totalPages} • Total {sortedArticles.length} artikel
              </div>
              <div className="flex items-center gap-2">
                <ActionButton
                  variant="outline"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={safeCurrentPage <= 1}
                  size="sm"
                >
                  Sebelumnya
                </ActionButton>
                <ActionButton
                  variant="outline"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  size="sm"
                >
                  Berikutnya
                </ActionButton>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ARTICLE FORM MODAL */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editArticle ? 'Edit Artikel' : 'Artikel Baru'} width="max-w-2xl">
        <div className="space-y-4">
          {!editArticle && hasLocalDraft && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800 flex items-center justify-between gap-3">
              <span>Draft lokal aktif. Perubahan tersimpan otomatis di browser ini.</span>
              <button onClick={clearLocalDraft} className="text-xs font-bold underline">Hapus Draft Lokal</button>
            </div>
          )}
          {newsSchemaMode === 'legacy' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Database newsroom masih schema lama. Opsi draft/publish lanjutan, body panjang, tags, dan image_url belum tersimpan di tabel news.
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Judul Artikel">
              <input className={inputCls} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Judul artikel..." />
            </Field>
            <Field label="Kategori">
              <select className={selectCls} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Author / Penulis">
            <input className={inputCls} value={form.author} onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))} placeholder="Nama penulis..." />
          </Field>
          <Field label="Ringkasan (Excerpt)">
            <textarea className={textareaCls} rows={2} value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} placeholder="Ringkasan singkat artikel..." />
          </Field>
          <Field label="Isi Artikel (Body)" hint="Mendukung teks panjang. Format bebas.">
            <textarea className={textareaCls} rows={8} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder="Tulis isi lengkap artikel di sini..." />
          </Field>
          <Field label="URL Gambar (opsional)">
            <input className={inputCls} value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
          </Field>
          <Field label="Tags (pisah dengan koma)">
            <input className={inputCls} value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="futsal, turnamen, liga garuda" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Slug URL">
              <input className={inputCls} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="judul-artikel" />
            </Field>
            <Field label="Jadwal Publish (opsional)">
              <input className={inputCls} type="datetime-local" value={form.scheduled_publish_at} onChange={(e) => setForm((f) => ({ ...f, scheduled_publish_at: e.target.value }))} />
            </Field>
          </div>
          <Field label="SEO Meta Title (opsional)">
            <input className={inputCls} value={form.meta_title} onChange={(e) => setForm((f) => ({ ...f, meta_title: e.target.value }))} placeholder="Judul untuk mesin pencari" />
          </Field>
          <Field label="SEO Meta Description (opsional)">
            <textarea className={textareaCls} rows={2} value={form.meta_description} onChange={(e) => setForm((f) => ({ ...f, meta_description: e.target.value }))} placeholder="Ringkasan SEO artikel" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div className={`rounded-xl border px-3 py-2 ${metaTitleLength >= 35 && metaTitleLength <= 65 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
              Meta title: {metaTitleLength} karakter (ideal 35-65)
            </div>
            <div className={`rounded-xl border px-3 py-2 ${metaDescriptionLength >= 120 && metaDescriptionLength <= 160 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
              Meta description: {metaDescriptionLength} karakter (ideal 120-160)
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm font-semibold text-neutral-700 cursor-pointer">
              <input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} className="w-4 h-4 rounded" />
              Featured / Highlight
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-neutral-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.published}
                disabled={newsSchemaMode !== 'extended'}
                onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
                className="w-4 h-4 rounded"
              />
              Publish langsung
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <ActionButton variant="outline" onClick={() => setShowForm(false)}>Batal</ActionButton>
            <ActionButton onClick={handleSaveArticle} loading={saving} disabled={!form.title.trim() || !form.author.trim()}>
              <Check size={14} /> {editArticle ? 'Simpan Perubahan' : 'Buat Artikel'}
            </ActionButton>
          </div>
        </div>
      </Modal>

      {/* QUIZ MANAGER MODAL */}
      <Modal open={showQuizModal} onClose={() => setShowQuizModal(false)} title={`Quiz — ${quizArticle?.title || ''}`} width="max-w-2xl">
        <div className="space-y-5">
          {quizList.length > 0 && (
            <div className="space-y-2 mb-4">
              <div className="text-xs uppercase tracking-[0.18em] font-black text-neutral-500 mb-2">Pertanyaan yang ada ({quizList.length})</div>
              {quizList.map((q, i) => (
                <div key={q.id} className="flex items-start gap-3 p-3 rounded-2xl border border-neutral-200 bg-neutral-50">
                  <span className="text-xs font-bold text-neutral-400 mt-0.5">{i + 1}.</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-neutral-900">{q.question}</div>
                    <div className="text-xs text-neutral-500 mt-1">Jawaban benar: <span className="font-bold text-emerald-600">{q.correct_answer}</span></div>
                  </div>
                  <button onClick={() => handleDeleteQuiz(q.id)} className="w-7 h-7 rounded-xl hover:bg-red-50 text-neutral-400 hover:text-red-500 flex items-center justify-center">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-neutral-200 pt-4">
            <div className="text-xs uppercase tracking-[0.18em] font-black text-neutral-500 mb-3">Tambah Pertanyaan Baru</div>
            <div className="space-y-3">
              <Field label="Pertanyaan">
                <input className={inputCls} value={quizForm.question} onChange={(e) => setQuizForm((q) => ({ ...q, question: e.target.value }))} placeholder="Tulis pertanyaan..." />
              </Field>
              <div className="grid sm:grid-cols-2 gap-3">
                {['A','B','C','D'].map((opt) => (
                  <Field key={opt} label={`Opsi ${opt}`}>
                    <input className={inputCls} value={quizForm[`option_${opt.toLowerCase()}`]} onChange={(e) => setQuizForm((q) => ({ ...q, [`option_${opt.toLowerCase()}`]: e.target.value }))} placeholder={`Pilihan ${opt}...`} />
                  </Field>
                ))}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Jawaban Benar">
                  <select className={selectCls} value={quizForm.correct_answer} onChange={(e) => setQuizForm((q) => ({ ...q, correct_answer: e.target.value }))}>
                    {['A','B','C','D'].map((o) => <option key={o}>{o}</option>)}
                  </select>
                </Field>
                <Field label="Penjelasan (opsional)">
                  <input className={inputCls} value={quizForm.explanation} onChange={(e) => setQuizForm((q) => ({ ...q, explanation: e.target.value }))} placeholder="Penjelasan singkat..." />
                </Field>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <ActionButton variant="outline" onClick={() => setShowQuizModal(false)}>Tutup</ActionButton>
            <ActionButton onClick={handleAddQuiz} loading={savingQuiz} disabled={!quizForm.question.trim()}>
              <Plus size={14} /> Tambah Pertanyaan
            </ActionButton>
          </div>
        </div>
      </Modal>

      <Modal open={!!previewArticle} onClose={() => setPreviewArticle(null)} title={`Preview — ${previewArticle?.title || ''}`} width="max-w-3xl">
        {previewArticle && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={previewArticle.published !== false ? 'published' : 'draft'} />
              {previewArticle.featured && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">
                  <Star size={10} fill="currentColor" /> Featured
                </span>
              )}
              <span className="text-xs text-neutral-400">{previewArticle.author} · {previewArticle.date}</span>
            </div>
            <div className="font-display text-3xl text-neutral-900 leading-tight">{previewArticle.title}</div>
            <div className="text-sm text-neutral-600">{previewArticle.excerpt || 'Tidak ada ringkasan.'}</div>
            {previewArticle.image_url && (
              <img src={previewArticle.image_url} alt={previewArticle.title} className="w-full max-h-80 object-cover rounded-2xl border border-neutral-200" />
            )}
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 whitespace-pre-wrap">
              {previewArticle.body || 'Konten body belum tersedia di schema lama.'}
            </div>
            <div className="flex justify-end">
              <ActionButton variant="outline" onClick={() => setPreviewArticle(null)}>Tutup</ActionButton>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={showVersionsModal} onClose={() => setShowVersionsModal(false)} title="Riwayat Versi (Lokal)" width="max-w-2xl">
        {versionList.length === 0 ? (
          <div className="text-sm text-neutral-600">Belum ada riwayat versi untuk artikel ini.</div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {versionList.map((item) => (
              <div key={item.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs text-neutral-500 mb-2">{new Date(item.saved_at).toLocaleString('id-ID')}</div>
                <div className="text-sm font-semibold text-neutral-900 mb-1">{item.data?.title || 'Untitled'}</div>
                <div className="text-xs text-neutral-500 line-clamp-2 mb-3">{item.data?.excerpt || 'Tanpa ringkasan'}</div>
                <div className="flex justify-end">
                  <ActionButton variant="outline" size="sm" onClick={() => restoreVersion(item)}>Restore ke Form</ActionButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={showGeneratorModal} onClose={() => setShowGeneratorModal(false)} title="Auto Generate Artikel" width="max-w-3xl">
        <div className="space-y-4">
          <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs text-violet-800">
            Draft otomatis dibuat dari ringkasan sumber publik luar negeri dan ditulis ulang menjadi opini orisinal bergaya Stadione. Selalu review fakta sebelum publish.
          </div>
          <div className="grid sm:grid-cols-[1fr_auto] gap-3">
            <input
              className={inputCls}
              value={sourceQuery}
              onChange={(e) => setSourceQuery(e.target.value)}
              placeholder="Contoh: global football trends"
            />
            <ActionButton onClick={handleSearchSources} loading={sourceLoading}>
              <Search size={14} /> Cari Sumber
            </ActionButton>
          </div>
          {sourceError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {sourceError}
            </div>
          )}
          {sourceItems.length > 0 && (
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {sourceItems.map((source, idx) => (
                <div key={`${source.link}-${idx}`} className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="text-[11px] text-neutral-500 mb-1">{source.sourceName} • {source.pubDate ? new Date(source.pubDate).toLocaleString('id-ID') : '-'}</div>
                  <div className="font-semibold text-neutral-900 mb-2">{source.title}</div>
                  <div className="text-sm text-neutral-600 mb-3 line-clamp-3">{source.description || 'Tanpa deskripsi ringkas dari feed.'}</div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <a href={source.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">
                      <ExternalLink size={12} /> Buka Sumber
                    </a>
                    <ActionButton size="sm" onClick={() => handleGenerateFromSource(source)}>
                      <Wand2 size={12} /> Generate Draft
                    </ActionButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* DELETE CONFIRM */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Hapus Artikel?">
        <p className="text-sm text-neutral-600 mb-5">Artikel <span className="font-semibold text-neutral-900">"{deleteTarget?.title}"</span> akan dihapus permanen beserta seluruh quiz-nya.</p>
        <div className="flex justify-end gap-3">
          <ActionButton variant="outline" onClick={() => setDeleteTarget(null)}>Batal</ActionButton>
          <ActionButton variant="danger" onClick={handleDelete}><Trash2 size={14} /> Hapus</ActionButton>
        </div>
      </Modal>
    </AdminLayout>
  );
}
