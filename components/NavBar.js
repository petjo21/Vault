'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
          <a href="/share" className={pathname === '/share' ? 'active' : ''}>Share</a>
        </>
      )}
      {loggedIn ? (
        <div className="settings-menu" ref={menuRef} style={{ marginLeft: 'auto' }}>
          <button className="settings-icon-btn" onClick={() => setMenuOpen((prev) => !prev)} title="Settings">Settings</button>
          {menuOpen && (
            <div className="settings-dropdown">
              <a href="/change-password" className="settings-dropdown-item" onClick={() => setMenuOpen(false)}>Change Password</a>
              <button className="settings-dropdown-item settings-dropdown-danger" onClick={handleLogout}>Log out</button>
            </div>
          )}
        </div>
      ) : (
        <a href="/login" style={{ marginLeft: 'auto' }}>Login</a>
      )}
    </nav>
  );
}
