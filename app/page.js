'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewingOwnerId = searchParams.get('vault');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [myUserId, setMyUserId] = useState(null);
  const [memories, setMemories] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [activeTag, setActiveTag] = useState(null);
  const [activeAlbum, setActiveAlbum] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingAlbumId, setDeletingAlbumId] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
      } else {
        setCheckingAuth(false);
        setMyUserId(session.user.id);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login');
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (checkingAuth) return;
    loadTags();
    loadAlbums();
    loadMemories();
  }, [activeTag, activeAlbum, checkingAuth, viewingOwnerId, myUserId, searchTerm]);

  async function loadTags() {
    const ownerId = viewingOwnerId || myUserId;
    let q = supabase.from('tags').select('*').order('name');
    if (ownerId) q = q.eq('user_id', ownerId);
    const { data } = await q;
    setAllTags(data || []);
  }

  async function loadAlbums() {
    const ownerId = viewingOwnerId || myUserId;
    let q = supabase.from('albums').select('*').order('name');
    if (ownerId) q = q.eq('user_id', ownerId);
    const { data } = await q;
    setAlbums(data || []);
  }

  async function loadMemories() {
    setLoading(true);
    let query = supabase
      .from('memories')
      .select('*, memory_tags(tag_id, tags(name))')
      .order('taken_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    const ownerId = viewingOwnerId || myUserId;
    if (ownerId) query = query.eq('user_id', ownerId);
    if (activeAlbum) query = query.eq('album_id', activeAlbum);

    const { data, error } = await query;
    if (!error && data) {
      let filtered = data;
      if (activeTag) {
        filtered = data.filter((m) =>
          m.memory_tags.some((mt) => mt.tags?.name === activeTag)
        );
      }
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        filtered = filtered.filter((m) => (m.caption || '').toLowerCase().includes(q));
      }
      const withUrls = await Promise.all(
        filtered.map(async (m) => {
          const { data: signed } = await supabase.storage
            .from('memories')
            .createSignedUrl(m.storage_path, 3600);
          return { ...m, url: signed?.signedUrl };
        })
      );
      setMemories(withUrls);
    }
    setLoading(false);
  }

  async function handleDelete(memory) {
    const confirmed = window.confirm('Delete this memory? This cannot be undone.');
    if (!confirmed) return;

    setDeletingId(memory.id);

    const { error: storageError } = await supabase.storage
      .from('memories')
      .remove([memory.storage_path]);

    if (storageError) {
      alert(`Could not delete file: ${storageError.message}`);
      setDeletingId(null);
      return;
    }

    const { error: dbError } = await supabase
      .from('memories')
      .delete()
      .eq('id', memory.id);

    if (dbError) {
      alert(`File deleted, but failed to remove record: ${dbError.message}`);
      setDeletingId(null);
      return;
    }

    setMemories((prev) => prev.filter((m) => m.id !== memory.id));
    setDeletingId(null);
  }

  async function handleDeleteAlbum(e, album) {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Delete the folder "${album.name}"? Memories inside it are kept — they'll just no longer be in a folder.`
    );
    if (!confirmed) return;

    setDeletingAlbumId(album.id);

    const { error } = await supabase.from('albums').delete().eq('id', album.id);

    if (error) {
      alert(`Could not delete folder: ${error.message}`);
      setDeletingAlbumId(null);
      return;
    }

    if (activeAlbum === album.id) setActiveAlbum(null);
    setAlbums((prev) => prev.filter((a) => a.id !== album.id));
    setDeletingAlbumId(null);
  }

  async function handleDeleteTag(e, tag) {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Delete the tag "${tag.name}"? It will be removed from any memories that have it.`
    );
    if (!confirmed) return;

    const { error } = await supabase.from('tags').delete().eq('id', tag.id);

    if (error) {
      alert(`Could not delete tag: ${error.message}`);
      return;
    }

    if (activeTag === tag.name) setActiveTag(null);
    setAllTags((prev) => prev.filter((t) => t.id !== tag.id));
  }

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(
      `Delete ${selectedIds.size} selected memor${selectedIds.size === 1 ? 'y' : 'ies'}? This cannot be undone.`
    );
    if (!confirmed) return;

    setBulkDeleting(true);
    const toDelete = memories.filter((m) => selectedIds.has(m.id));
    const paths = toDelete.map((m) => m.storage_path);

    const { error: storageError } = await supabase.storage.from('memories').remove(paths);
    if (storageError) {
      alert(`Could not delete files: ${storageError.message}`);
      setBulkDeleting(false);
      return;
    }

    const { error: dbError } = await supabase
      .from('memories')
      .delete()
      .in('id', Array.from(selectedIds));

    if (dbError) {
      alert(`Files deleted, but failed to remove records: ${dbError.message}`);
      setBulkDeleting(false);
      return;
    }

    setMemories((prev) => prev.filter((m) => !selectedIds.has(m.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    setBulkDeleting(false);
  }

  const groups = memories.reduce((acc, m) => {
    const day = (m.taken_at || m.created_at || '').slice(0, 10) || 'Undated';
    acc[day] = acc[day] || [];
    acc[day].push(m);
    return acc;
  }, {});

  if (checkingAuth) return <p>Loading...</p>;

  const isReadOnly = !!viewingOwnerId && viewingOwnerId !== myUserId;

  return (
    <div>
      <div className="search-bar">
        <span className="search-icon">⌕</span>
        <input
          type="text"
          placeholder="Search captions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {!isReadOnly && memories.length > 0 && (
        <div className="select-toolbar">
          <button type="button" className="select-toggle" onClick={toggleSelectMode}>
            {selectMode ? 'Cancel' : 'Select'}
          </button>
          {selectMode && (
            <button
              type="button"
              className="bulk-delete-btn"
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0 || bulkDeleting}
            >
              {bulkDeleting ? 'Deleting...' : `Delete selected (${selectedIds.size})`}
            </button>
          )}
        </div>
      )}

      {albums.length > 0 && (
        <div className="tag-search">
          <span
            className={`tag-pill folder-pill ${!activeAlbum ? 'active' : ''}`}
            onClick={() => setActiveAlbum(null)}
          >
            All folders
          </span>
          {albums.map((a) => (
            <span
              key={a.id}
              className={`tag-pill folder-pill ${activeAlbum === a.id ? 'active' : ''}`}
              onClick={() => setActiveAlbum(a.id)}
            >
              📁 {a.name}
              <button
                className="pill-delete"
                onClick={(e) => handleDeleteAlbum(e, a)}
                disabled={deletingAlbumId === a.id}
                title="Delete this folder"
              >
                {deletingAlbumId === a.id ? '...' : '✕'}
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="tag-search">
        <span
          className={`tag-pill ${!activeTag ? 'active' : ''}`}
          onClick={() => setActiveTag(null)}
        >
          All tags
        </span>
        {allTags.map((t) => (
          <span
            key={t.id}
            className={`tag-pill folder-pill ${activeTag === t.name ? 'active' : ''}`}
            onClick={() => setActiveTag(t.name)}
          >
            {t.name}
            <button
              className="pill-delete"
              onClick={(e) => handleDeleteTag(e, t)}
              title="Delete this tag"
            >
              ✕
            </button>
          </span>
        ))}
      </div>

      {loading && <p>Loading...</p>}
      {!loading && memories.length === 0 && (
        <div className="empty-state">
          <h2>The vault is empty.</h2>
          <p>Every archive starts with one print. Upload your first memory to begin the timeline.</p>
          <a href="/upload" className="empty-cta">Add a memory →</a>
        </div>
      )}

      {Object.entries(groups).map(([day, items]) => (
        <div key={day} className="day-group">
          <div className="day-heading">
            {day}
            <span className="day-count">{items.length} {items.length === 1 ? 'photo' : 'photos'}</span>
          </div>
          <div className="grid">
            {items.map((m) => (
              <div
                className={`memory-item ${selectMode && selectedIds.has(m.id) ? 'selected' : ''}`}
                key={m.id}
                onClick={() => { if (selectMode) toggleSelected(m.id); }}
              >
                {m.media_type === 'video' ? (
                  <video src={m.url} controls={!selectMode} title={m.caption} />
                ) : (
                  <img src={m.url} alt={m.caption || ''} title={m.caption} />
                )}
                {selectMode ? (
                  <span className="select-checkbox">
                    {selectedIds.has(m.id) ? '✓' : ''}
                  </span>
                ) : (
                  !isReadOnly && (
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(m)}
                      disabled={deletingId === m.id}
                      title="Delete this memory"
                    >
                      {deletingId === m.id ? '...' : '✕'}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}