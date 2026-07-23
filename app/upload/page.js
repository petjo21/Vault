'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function Upload() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [takenAt, setTakenAt] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
      } else {
        setCheckingAuth(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login');
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  function pickFile(f) {
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) pickFile(e.dataTransfer.files[0]);
  }

  async function handleUpload(e) {
    e.preventDefault();
    setStatus('Uploading...');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStatus('Please log in first.');
      return;
    }

    const mediaType = file.type.startsWith('video') ? 'video' : 'photo';
    const path = `${user.id}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('memories')
      .upload(path, file);

    if (uploadError) {
      setStatus(`Upload failed: ${uploadError.message}`);
      return;
    }

    const { data: memory, error: insertError } = await supabase
      .from('memories')
      .insert({
        storage_path: path,
        media_type: mediaType,
        caption,
        taken_at: takenAt || null,
      })
      .select()
      .single();

    if (insertError) {
      setStatus(`Saved file, but failed to save details: ${insertError.message}`);
      return;
    }

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

    setStatus('Uploaded!');
    setFile(null);
    setPreviewUrl(null);
    setCaption('');
    setTakenAt('');
    setTags('');
    setFileInputKey((k) => k + 1);
  }

  if (checkingAuth) return <p>Loading...</p>;

  return (
    <form className="form" onSubmit={handleUpload}>
      <h2>Add a memory</h2>

      <label
        className={`dropzone ${dragActive ? 'active' : ''} ${previewUrl ? 'has-file' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        {previewUrl ? (
          file.type.startsWith('video') ? (
            <video src={previewUrl} className="dropzone-preview" muted />
          ) : (
            <img src={previewUrl} className="dropzone-preview" alt="Preview" />
          )
        ) : (
          <div className="dropzone-hint">
            <span>Drag a photo or video here</span>
            <span className="dropzone-sub">or click to browse</span>
          </div>
        )}
        <input
          key={fileInputKey}
          type="file"
          accept="image/*,video/*"
          onChange={(e) => pickFile(e.target.files[0])}
          required
          style={{ display: 'none' }}
        />
      </label>

      <input type="text" placeholder="Caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
      <input type="date" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
      <input type="text" placeholder="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
      <button type="submit">Upload</button>
      {status && <p>{status}</p>}
    </form>
  );
}