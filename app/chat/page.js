'use client';
import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const partnerId = searchParams.get('with');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [myUserId, setMyUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
      } else {
        setCheckingAuth(false);
        setMyUserId(session.user.id);
      }
    });
  }, [router]);

  useEffect(() => {
    if (!myUserId || !partnerId) return;
    loadMessages();

    const channel = supabase
      .channel(`chat-${[myUserId, partnerId].sort().join('-')}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const m = payload.new;
          const isThisConversation =
            (m.sender_id === myUserId && m.recipient_id === partnerId) ||
            (m.sender_id === partnerId && m.recipient_id === myUserId);
          if (isThisConversation) {
            setMessages((prev) => [...prev, m]);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [myUserId, partnerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${myUserId},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${myUserId})`
      )
      .order('created_at', { ascending: true });
    setMessages(data || []);
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    const { error } = await supabase
      .from('messages')
      .insert({ recipient_id: partnerId, content: text.trim() });
    setSending(false);
    if (!error) setText('');
  }

  if (checkingAuth) return <p>Loading...</p>;

  if (!partnerId) {
    return (
      <div className="empty-state">
        <h2>No conversation selected</h2>
        <p>Go to the Share page and click "Chat" next to someone you're sharing your vault with.</p>
        <a href="/share" className="empty-cta">Go to Share →</a>
      </div>
    );
  }

  return (
    <div className="chat-wrap">
      <div className="chat-thread">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`chat-bubble ${m.sender_id === myUserId ? 'mine' : 'theirs'}`}
          >
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input-row" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" disabled={sending || !text.trim()}>Send</button>
      </form>
    </div>
  );
}

export default function Chat() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <ChatContent />
    </Suspense>
  );
}