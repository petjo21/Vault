'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function Share() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState('');
  const [myShares, setMyShares] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
      } else {
        setCheckingAuth(false);
        loadShares();
      }
    });
  }, [router]);

  async function loadShares() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: mine } = await supabase
      .from('shares')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    setMyShares(mine || []);

    const { data: withMe } = await supabase
      .from('shares')
      .select('*')
      .eq('shared_with_user_id', user.id);
    setSharedWithMe(withMe || []);
  }

  async function handleInvite(e) {
    e.preventDefault();
    setStatus('Sending invite...');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (email.trim().toLowerCase() === user.email.toLowerCase()) {
      setStatus("You can't invite yourself.");
      return;
    }

    const { error } = await supabase
      .from('shares')
      .insert({ owner_id: user.id, shared_with_email: email.trim().toLowerCase() });

    if (error) {
      setStatus(error.message.includes('duplicate') ? 'Already invited.' : error.message);
      return;
    }
    setStatus('Invited! They can now see your vault once they log in with that email.');
    setEmail('');
    loadShares();
  }

  async function revoke(shareId) {
    const confirmed = window.confirm('Remove this person\'s access to your vault?');
    if (!confirmed) return;
    await supabase.from('shares').delete().eq('id', shareId);
    loadShares();
  }

  if (checkingAuth) return <p>Loading...</p>;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <h2>People with access to your vault</h2>
      <form className="form" onSubmit={handleInvite} style={{ maxWidth: '100%' }}>
        <input
          type="email"
          placeholder="Invite by email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit">Invite</button>
        {status && <p>{status}</p>}
      </form>

      {myShares.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          {myShares.map((s) => (
            <div key={s.id} className="share-row">
              <span>{s.shared_with_email}</span>
              <span className={`share-status ${s.shared_with_user_id ? 'accepted' : 'pending'}`}>
                {s.shared_with_user_id ? 'Active' : 'Pending'}
              </span>
              {s.shared_with_user_id && (
                <a href={`/chat?with=${s.shared_with_user_id}`} className="chat-link">💬 Chat</a>
              )}
              <button className="pill-delete" onClick={() => revoke(s.id)} title="Remove access">✕</button>
            </div>
          ))}
        </div>
      )}

      {sharedWithMe.length > 0 && (
        <>
          <h2 style={{ marginTop: '2.5rem' }}>Vaults shared with you</h2>
          {sharedWithMe.map((s) => (
            <div key={s.id} className="share-row">
              <span>Owner ID: {s.owner_id.slice(0, 8)}...</span>
              <a href={`/chat?with=${s.owner_id}`} className="chat-link">💬 Chat</a>
              <a href={`/?vault=${s.owner_id}`} className="empty-cta" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}>
                View
              </a>
            </div>
          ))}
        </>
      )}
    </div>
  );
}