"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type State = 'idle' | 'loading' | 'error' | 'success';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [state, setState] = React.useState<State>('idle');
  const [error, setError] = React.useState<string>('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!oldPassword || !newPassword) {
      setError('Please enter your current password and a new password.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setState('loading');

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setState('error');
      setError('Your session expired. Please sign in again.');
      router.replace('/login');
      return;
    }

    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState('error');
      setError(json?.error || 'Failed to change password.');
      return;
    }

    setState('success');
    setTimeout(() => router.replace('/dashboard'), 400);
  }

  return (
    <div style={{ maxWidth: 520, margin: '40px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 650, marginBottom: 6 }}>Change password</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>
        For security, please set a new password before continuing.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Current password</span>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            disabled={state === 'loading'}
            autoComplete="current-password"
            style={{
              height: 42,
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              padding: '0 12px',
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>New password</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={state === 'loading'}
            autoComplete="new-password"
            style={{
              height: 42,
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              padding: '0 12px',
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Confirm new password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={state === 'loading'}
            autoComplete="new-password"
            style={{
              height: 42,
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              padding: '0 12px',
            }}
          />
        </label>

        {error ? (
          <div style={{ color: '#b91c1c', fontSize: 13, marginTop: 4 }}>{error}</div>
        ) : null}

        <button
          type="submit"
          disabled={state === 'loading'}
          style={{
            height: 44,
            borderRadius: 12,
            border: '1px solid #111827',
            background: '#111827',
            color: 'white',
            fontWeight: 650,
            marginTop: 6,
            cursor: state === 'loading' ? 'default' : 'pointer',
          }}
        >
          {state === 'loading' ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}

