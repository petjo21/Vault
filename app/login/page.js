'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
async function claimPendingShares(user) {
  await supabase
    .from('shares')
    .update({ shared_with_user_id: user.id })
    .eq('shared_with_email', user.email)
    .is('shared_with_user_id', null);
}

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: username.trim() } },
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      if (!data.session) {
        setInfo('Check your email for a verification link. After that, just log in with your email and password.');
        setMode('login');
        return;
      }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await claimPendingShares(user);
    router.replace('/');
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace('/');
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
       <div className="auth-brand">
          <span className="auth-logo">S&B</span>
          <span className="wordmark" style={{ margin: 0 }}>Sam & Bella Vault</span>
        </div>
        <p className="auth-tagline">Your photos and videos, all in one place.</p>

        <form className="form auth-form" onSubmit={handleSubmit}>
          <h2>{mode === 'login' ? 'Log in' : 'Create account'}</h2>
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
            />
          )}
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
          {error && <p className="auth-message error">{error}</p>}
          {info && <p className="auth-message success">{info}</p>}
          <p className="auth-switch">
            {mode === 'login' ? (
              <>
                No account?{' '}
                <span onClick={() => setMode('signup')}>Sign up</span>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <span onClick={() => setMode('login')}>Log in</span>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}