'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <nav className="nav">
      <span className="wordmark">Sam & Bella Vault</span>
      {loggedIn && (
        <>
          <a href="/" className={pathname === '/' ? 'active' : ''}>Timeline</a>
          <a href="/upload" className={pathname === '/upload' ? 'active' : ''}>Upload</a>
        </>
      )}
      {loggedIn ? (
        <button onClick={handleLogout} style={{ marginLeft: 'auto' }}>
          Log out
        </button>
      ) : (
        <a href="/login" style={{ marginLeft: 'auto' }}>Login</a>
      )}
    </nav>
  );
}