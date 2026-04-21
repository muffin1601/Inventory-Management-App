"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import styles from './Login.module.css';
import { LockKeyhole, LogIn, ShieldCheck } from 'lucide-react';
import { modulesService } from '@/lib/services/modules';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('admin@nexusims.com');
  const [password, setPassword] = React.useState('Admin@123');
  const [error, setError] = React.useState('');

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    const user = await modulesService.login(email, password);
    if (!user) {
      setError('Invalid email or password. Please use an active user account.');
      return;
    }

    setError('');
    router.replace('/dashboard');
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
          <h1 className={styles.title}>Login</h1>
          <p className={styles.subtitle}>Sign in with your assigned work email and password to access the system.</p>
        </div>

        <form className={styles.form} onSubmit={handleLogin}>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input className={styles.input} value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <div className={styles.passwordWrap}>
              <LockKeyhole size={16} className={styles.passwordIcon} />
              <input
                className={styles.passwordInput}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}

          <button type="submit" className={styles.primaryAction}>
            <LogIn size={16} />
            Login
          </button>
        </form>

        <div className={styles.helpBox}>
          <strong>Demo admin login</strong>
          <span>Email: `admin@nexusims.com`</span>
          <span>Password: `Admin@123`</span>
        </div>
      </div>
    </div>
  );
}
