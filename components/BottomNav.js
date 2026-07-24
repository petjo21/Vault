'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setLoggedIn(!!session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => setLoggedIn(!!session));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!loggedIn) return null;

  const items = [
    { href: '/', label: 'Home', icon: '⌂' },
    { href: '/upload', label: 'Add', icon: '＋' },
    { href: '/share', label: 'Share', icon: '◎' },
  ];

  return (
    <div className="bottom-nav">
      {items.map((item) => (
        <button
          key={item.href}
          className={`bottom-nav-item ${pathname === item.href ? 'active' : ''}`}
          onClick={() => router.push(item.href)}
          title={item.label}
        >
          <span className="bottom-nav-icon">{item.icon}</span>
        </button>
      ))}
    </div>
  );
}