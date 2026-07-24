'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function Upload() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [items, setItems] = useState([]);
  const [caption, setCaption] = useState('');
  const [takenAt, setTakenAt] = useState('');
  const [tags, setTags] = useState('');
  const [albums, setAlbums] = useState([]);
  const [albumChoice, setAlbumChoice] = useState('');
  const [newAlbumName, setNewAlbumName] = useState('');
  const [status, setStatus] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
      } else {
        setCheckingAuth(false);
        loadAlbums();
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login');
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  async function loadAlbums() {
    const { data } = await supabase.from('albums').select('*').order('name');
    setAlbums(data || []);
  }

  function addFiles(fileList) {
    const newItems = Array.from(fileList).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setItems((prev) => [...prev, ...newItems]);
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  async function resolveAlbumId(user) {
    if (newAlbumName.trim()) {
      const { data: created, error } = await supabase
        .from('albums')
        .insert({ name: newAlbumName.trim(), user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return created.id;
    }
    return albumChoice || null;
  }

  async function uploadOne(file, user, albumId) {
    const mediaType = file.type.startsWith('video') ? 'video' : 'photo';
    const path = `${user.id}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage.from('memories').upload(path, file);
    if (uploadError) throw new Error(`${file.name}: ${uploadError.message}`);

    const { data: memory, error: insertError } = await supabase
      .from('memories')
      .insert({
        storage_path: path,
        media_type: mediaType,
        caption,
        taken_at: takenAt || null,
        album_id: albumId,
      })
      .select()
      .single();
    if (insertError) throw new Error(`${file.name}: ${insertError.message}`);

    const tagNames = tags.split(',').map((t) => t.trim()).filter(Boolean);
    for (const name of tagNames) {
      const { data: tag } = await supabase
        .from('tags')
        .upsert({ name, user_id: user.id }, { onConflict: 'user_id,name' })
        .select()
        .single();
      if (tag) {
        await supabase.from('memory_tags').insert({ memory_id: memory.id, tag_id: tag.id });
      }
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (items.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStatus('Please log in first.');
      return;
    }

    let albumId = null;
    try {
      albumId = await resolveAlbumId(user);
    } catch (err) {
      setStatus(`Could not create album: ${err.message}`);
      return;
    }

    setUploading(true);
    let succeeded = 0;
    for (let i = 0; i < items.length; i++) {
      setStatus(`Uploading ${i + 1} of ${items.length}...`);
      try {
        await uploadOne(items[i].file, user, albumId);
        succeeded++;
      } catch (err) {
        setStatus(`Stopped at file ${i + 1}: ${err.message}`);
        setUploading(false);
        return;
      }
    }

    setStatus(`Uploaded ${succeeded} item${succeeded === 1 ? '' : 's'}!`);
    setItems([]);
    setCaption('');
    setTakenAt('');
    setTags('');
    setAlbumChoice('');
    setNewAlbumName('');
    setFileInputKey((k) => k + 1);
    setUploading(false);
    loadAlbums();
  }

  if (checkingAuth) return <p>Loading...</p>;

  return (
    <form className="form" onSubmit={handleUpload}>
      <div className="form-header">
        <span className="form-icon">🖼️</span>
        <h2>Add memories</h2>
      </div>

      <label
        className={`dropzone ${dragActive ? 'active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <div className="dropzone-hint">
          <span className="dropzone-emoji">📷</span>
          <span>Drag photos or videos here</span>
          <span className="dropzone-sub">or click to browse — you can select several at once</span>
        </div>
        <input
          key={fileInputKey}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => addFiles(e.target.files)}
          style={{ display: 'none' }}
        />
      </label>

      {items.length > 0 && (
        <div className="thumb-strip">
          {items.map((item, i) => (
            <div className="thumb" key={i}>
              {item.file.type.startsWith('video') ? (
                <video src={item.previewUrl} muted />
              ) : (
                <img src={item.previewUrl} alt="" />
              )}
              <button type="button" className="thumb-remove" onClick={() => removeItem(i)}>✕</button>
            </div>
          ))}
        </div>
      )}
<label className="field-label">📝 Caption</label>
      <input type="text" placeholder="What's happening in this memory?" value={caption} onChange={(e) => setCaption(e.target.value)} />
      <label className="field-label">📅 Date</label>
      <input type="date" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
      <label className="field-label">🏷️ Tags</label>
      <input type="text" placeholder="beach, family, summer" value={tags} onChange={(e) => setTags(e.target.value)} />

      <label className="field-label">📁 Folder / Album</label>
      <select
        value={albumChoice}
        onChange={(e) => { setAlbumChoice(e.target.value); setNewAlbumName(''); }}
        disabled={!!newAlbumName.trim()}
      >
        <option value="">No folder</option>
        {albums.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      <input
        type="text"
        placeholder="...or create a new folder"
        value={newAlbumName}
        onChange={(e) => { setNewAlbumName(e.target.value); if (e.target.value.trim()) setAlbumChoice(''); }}
      />

      <button type="submit" disabled={items.length === 0 || uploading}>
        {uploading ? 'Uploading...' : `Upload ${items.length || ''}`.trim()}
      </button>
      {status && <p>{status}</p>}
    </form>
  );
}