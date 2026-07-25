'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function Profile() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
      } else {
        setCheckingAuth(false);
        loadProfile(session.user.id);
      }
    });
  }, [router]);

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setDisplayName(data.display_name || '');
      if (data.avatar_path) {
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(data.avatar_path);
        setAvatarUrl(pub.publicUrl);
      }
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setStatus('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let avatarPath = null;
    if (avatarFile) {
      avatarPath = `${user.id}/avatar-${Date.now()}-${avatarFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(avatarPath, avatarFile);
      if (uploadError) {
        setStatus(`Could not upload avatar: ${uploadError.message}`);
        setSaving(false);
        return;
      }
    }

    const updates = { id: user.id, display_name: displayName.trim(), updated_at: new Date() };
    if (avatarPath) updates.avatar_path = avatarPath;

    const { error } = await supabase.from('profiles').upsert(updates);
    setSaving(false);

    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus('Saved!');
    if (avatarPath) {
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
      setAvatarUrl(pub.publicUrl);
    }
    setAvatarFile(null);
  }

  if (checkingAuth) return <p>Loading...</p>;

  return (
    <form className="form" onSubmit={handleSave} style={{ maxWidth: 420, margin: '0 auto' }}>
      <h2>Your profile</h2>

      <div className="avatar-picker">
        <img
          src={avatarFile ? URL.createObjectURL(avatarFile) : (avatarUrl || '/default-avatar.png')}
          alt="Avatar"
          className="avatar-preview"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <label className="avatar-upload-btn">
          Change photo
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => setAvatarFile(e.target.files[0])}
          />
        </label>
      </div>

      <label className="field-label">Display name</label>
      <input
        type="text"
        placeholder="What should others call you?"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />

      <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
      {status && <p>{status}</p>}
    </form>
  );
}