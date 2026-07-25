'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function Profile() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
      } else {
        setCheckingAuth(false);
        setEmail(session.user.email || '');
        loadProfile(session.user.id);
      }
    });
  }, [router]);

  async function loadProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', userId)
      .single();
    if (data) {
      setUsername(data.username || '');
      setAvatarUrl(data.avatar_url || null);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setStatus('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let newAvatarUrl = avatarUrl;
    if (avatarFile) {
      const path = `${user.id}/avatar-${Date.now()}-${avatarFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true });
      if (uploadError) {
        setStatus(`Could not upload photo: ${uploadError.message}`);
        setSaving(false);
        return;
      }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      newAvatarUrl = pub.publicUrl;
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        username: username.trim(),
        avatar_url: newAvatarUrl,
        updated_at: new Date(),
      });

    setSaving(false);

    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus('Saved!');
    setAvatarUrl(newAvatarUrl);
    setAvatarFile(null);
  }

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (checkingAuth) return <p>Loading...</p>;

  const initials = (username || email || '?').trim().slice(0, 1).toUpperCase();
  const previewSrc = avatarFile ? URL.createObjectURL(avatarFile) : avatarUrl;

  return (
    <div className="profile-page">
      <form className="profile-header-card" onSubmit={handleSave}>
        <div className="profile-avatar-wrap">
          <div className="profile-avatar-lg">
            {previewSrc ? <img src={previewSrc} alt="Your avatar" /> : initials}
          </div>
          <label className="avatar-edit-badge" title="Change photo">
            📷
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => setAvatarFile(e.target.files[0])}
            />
          </label>
        </div>

        <input
          className="profile-name-input"
          type="text"
          placeholder="Your name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <p className="profile-email">{email}</p>

        <button type="submit" disabled={saving} className="profile-save-btn">
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        {status && <p className="profile-status">{status}</p>}
      </form>

      <div className="settings-list">
        <a href="/change-password" className="settings-row">
          <span className="settings-row-icon">🔒</span>
          <span className="settings-row-label">Change password</span>
          <span className="settings-row-chevron">›</span>
        </a>
        <a href="/share" className="settings-row">
          <span className="settings-row-icon">👥</span>
          <span className="settings-row-label">People with access</span>
          <span className="settings-row-chevron">›</span>
        </a>
        <button type="button" className="settings-row settings-row-danger" onClick={handleLogout} disabled={loggingOut}>
          <span className="settings-row-icon">↪</span>
          <span className="settings-row-label">{loggingOut ? 'Logging out...' : 'Log out'}</span>
        </button>
      </div>
    </div>
  );
}