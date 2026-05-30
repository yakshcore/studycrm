'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/context/ToastContext';
import type { StudentUser } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const { toast } = useToast();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post<{ token: string; user: StudentUser; studentId?: string }>('/auth/login', { email, password });
      setAuth(data.user, data.token, data.studentId);
      router.push('/home');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Login failed';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-sky-950 to-cyan-900 p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-cyan-400/5 blur-3xl" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-sky-400" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="text-white font-bold text-xl">StudyPortal</span>
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-4">
            Your study abroad<br />
            <span className="text-sky-300">journey starts here.</span>
          </h1>
          <p className="text-sky-200/70 text-lg leading-relaxed">
            Track every step — from your first inquiry<br />to your departure day and beyond.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4">
            {[
              { icon: '📊', label: 'Live Progress', desc: '10-stage tracker' },
              { icon: '📄', label: 'Documents',     desc: 'Upload & track status' },
              { icon: '🏫', label: 'Applications',  desc: 'All universities in one place' },
              { icon: '💬', label: 'Direct Chat',   desc: 'Talk to your counsellor' },
            ].map(f => (
              <div key={f.label} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xl">{f.icon}</span>
                <div>
                  <p className="text-white text-sm font-semibold">{f.label}</p>
                  <p className="text-sky-200/60 text-xs">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sky-200/40 text-xs relative z-10">© {new Date().getFullYear()} StudyCRM. All rights reserved.</p>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-base">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-accent" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="font-bold text-t1 text-lg">StudyPortal</span>
          </div>

          <h2 className="text-2xl font-bold text-t1 mb-1">Welcome back</h2>
          <p className="text-t3 text-sm mb-8">Sign in to track your journey</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-t2 mb-1.5 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@example.com"
                className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-sm text-t1 placeholder:text-t3 focus:outline-none focus:border-accent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-t2 mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-surface border border-line rounded-xl px-4 py-3 pr-11 text-sm text-t1 placeholder:text-t3 focus:outline-none focus:border-accent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-t3 hover:text-t2 transition"
                  tabIndex={-1}
                >
                  {showPass ? (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5">
                      <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z" clipRule="evenodd"/>
                      <path d="M10.748 13.93l2.523 2.524a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5">
                      <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/>
                      <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 text-white font-semibold text-sm hover:from-sky-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/>
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-t3">
            Don't have an account?{' '}
            <Link href="/register" className="text-accent hover:underline font-semibold">
              Register here
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-t3">
            Need help? Contact your counsellor or{' '}
            <a href="mailto:support@studycrm.com" className="text-accent hover:underline">support@studycrm.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
