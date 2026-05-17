'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';

function LoginForm() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(false);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/admin/home';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(false);
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, remember }),
            });

            if (res.ok) {
                router.push(callbackUrl);
            } else {
                setError(true);
            }
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
            <div>
                <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
                    Admin Access
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Enter your credentials to continue
                </p>
            </div>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="username" className="sr-only">Username</label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => { setUsername(e.target.value); setError(false); }}
                        required
                        autoFocus
                        autoComplete="username"
                        className={`appearance-none rounded-md relative block w-full px-3 py-2 border
                            placeholder-gray-500 text-gray-900 focus:outline-none
                            focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm
                            ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                        placeholder="Username"
                    />
                </div>

                <div>
                    <label htmlFor="password" className="sr-only">Password</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(false); }}
                        required
                        autoComplete="current-password"
                        className={`appearance-none rounded-md relative block w-full px-3 py-2 border
                            placeholder-gray-500 text-gray-900 focus:outline-none
                            focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm
                            ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                        placeholder="Password"
                    />
                    {error && (
                        <p className="mt-1.5 text-xs text-red-600">Incorrect username or password.</p>
                    )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                    <input
                        id="remember"
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer select-none">
                        Remember this device
                    </label>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="group relative w-full flex justify-center py-2 px-4 border
                        border-transparent text-sm font-medium rounded-md text-white
                        bg-blue-600 hover:bg-blue-700 transition-colors duration-200
                        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                        disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {loading ? 'Signing in...' : 'Sign in'}
                </button>
            </form>
        </div>
    );
}

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <Suspense fallback={
                <div className="flex justify-center items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                </div>
            }>
                <LoginForm />
            </Suspense>
        </div>
    );
}
