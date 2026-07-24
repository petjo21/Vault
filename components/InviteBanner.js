'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function InviteBanner() {
  const [invites, setInvites] = useState([]);
  const [accepting, setAccepting] = useState(null);
  const [dismissed, setDismissed] = useState([]);

  useEffect(() => {
    checkInvites();
  }, []);

  async function checkInvites() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('shares')
      .select('*')
      .eq('shared_with_email', session.user.email)
      .is('shared_with_user_id', null);

    if (!error && data) {
      setInvites(data);
    }
  }

  async function handleAccept(invite) {
    setAccepting(invite.id);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from('shares')
      .update({ shared_with_user_id: session.user.id })
      .eq('id', invite.id);

    setAccepting(null);
    if (!error) {
      setDismissed((prev) => [...prev, invite.id]);
    }
  }

  function handleDismiss(inviteId) {
    setDismissed((prev) => [...prev, inviteId]);
  }

  const visibleInvites = invites.filter((inv) => !dismissed.includes(inv.id));

  if (visibleInvites.length === 0) return null;

  return (
    <div>
      {visibleInvites.map((invite) => (
        <div
          key={invite.id}
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 8,
            padding: '12px 16px',
            margin: '0 0 16px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>You&apos;ve been invited to view a shared vault.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleAccept(invite)}
              disabled={accepting === invite.id}
              style={{
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                cursor: 'pointer',
              }}
            >
              {accepting === invite.id ? 'Accepting...' : 'Accept'}
            </button>
            <button
              onClick={() => handleDismiss(invite.id)}
              style={{
                background: 'transparent',
                border: '1px solid #ccc',
                borderRadius: 6,
                padding: '6px 14px',
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}