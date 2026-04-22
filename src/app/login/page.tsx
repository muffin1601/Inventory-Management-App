"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import styles from './Login.module.css';
import { LockKeyhole, LogIn, ShieldCheck, Eye, EyeOff, AlertCircle, Loader } from 'lucide-react';
import { modulesService } from '@/lib/services/modules';

type LoginState = 'idle' | 'loading' | 'error' | 'success';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [state, setState] = React.useState<LoginState>('idle');
  const [error, setError] = React.useState('');
  const [attempts, setAttempts] = React.useState(0);

  // Lock account after 5 failed attempts
  const isLocked = attempts >= 5;

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    
    // Validation
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    if (isLocked) {
      setError('Account temporarily locked. Please try again after 15 minutes or contact support.');
      return;
    }

    setState('loading');
    setError('');

    try {
      const user = await modulesService.login(email, password);
      
      if (!user) {
        setAttempts(prev => prev + 1);
        setError(isLocked 
          ? 'Account temporarily locked due to multiple failed attempts.' 
          : `Invalid email or password. (Attempt ${attempts + 1}/5)`
        );
        setState('error');
        return;
      }

      // Check if password needs to be changed
      if (user.requires_password_change) {
        // Redirect to password change page
        router.replace('/auth/change-password');
        return;
      }

      setState('success');
      setError('');
      setAttempts(0);
      
      // Small delay to show success state
      setTimeout(() => {
        router.replace('/dashboard');
      }, 500);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setState('error');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brandRow}>
          <div className={styles.brandIcon}>
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className={styles.brandTitle}>Watcon Inventory System</div>
            <div className={styles.brandSubtitle}>Role-based access for operations, procurement, stores, and accounts.</div>
          </div>
        </div>

        <div className={styles.header}>
          <h1 className={styles.title}>Sign In</h1>
          <p className={styles.subtitle}>Enter your credentials to access the system.</p>
        </div>

        <form className={styles.form} onSubmit={handleLogin}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Email Address</label>
            <input
              id="email"
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              disabled={state === 'loading' || isLocked}
              autoComplete="email"
              required
            />
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="password">Password</label>
            </div>
            <div className={styles.passwordWrap}>
              <LockKeyhole size={16} className={styles.passwordIcon} />
              <input
                id="password"
                className={styles.passwordInput}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={state === 'loading' || isLocked}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword(!showPassword)}
                disabled={state === 'loading' || isLocked}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className={styles.errorBox}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className={styles.primaryAction}
            disabled={state === 'loading' || isLocked}
          >
            {state === 'loading' ? (
              <>
                <Loader size={16} className={styles.spinner} />
                Signing in...
              </>
            ) : (
              <>
                <LogIn size={16} />
                Sign In
              </>
            )}
          </button>

          {attempts > 0 && attempts < 5 && (
            <div className={styles.warningBox}>
              <span>Failed attempts: {attempts}/5</span>
            </div>
          )}
        </form>

        <div className={styles.footer}>
          <p className={styles.footerText}>
            Having trouble signing in? Contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
