import { useState } from 'react';
import { Building2, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { login } from '../../services/api';
import { decodeJwtPayload } from '../../utils/auth';

interface AuthViewProps {
  onAuthenticate: () => void;
}

export function AuthView({ onAuthenticate }: AuthViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { token } = await login(email, password);
      // Store token
      localStorage.setItem('access_token', token);
      // Extract roles from token if not provided by backend
      let roles: string[] = [];
      try {
        const payload = decodeJwtPayload(token);
        roles = (payload.roles || payload.authorities || []) as string[];
      } catch (e) {
        console.error('Failed to decode JWT payload', e);
      }
      localStorage.setItem('roles', JSON.stringify(roles));
      onAuthenticate();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="size-full p-5 md:p-7 bg-[radial-gradient(circle_at_0%_0%,#f5f7f8_0,#e9ecef_55%,#e0e7eb_100%)]">
      <div className="size-full rounded-[34px] bg-white/45 backdrop-blur-xl border border-white/80 shadow-[0_30px_70px_rgba(0,0,0,0.12)] overflow-hidden grid grid-cols-1 lg:grid-cols-2">
        <section className="p-8 md:p-12 flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/70 border border-white/80 shadow-sm">
              <div className="size-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-white grid place-items-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Welcome back to</p>
                <h1 className="text-lg font-semibold text-zinc-700">Smart Building</h1>
              </div>
            </div>

            <h2 className="mt-8 text-4xl text-zinc-700">Sign In</h2>
            <p className="mt-2 text-zinc-500">Access your dashboard and monitor every zone in real time.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4 max-w-md">
              <label className="block">
                <span className="text-sm text-zinc-600 mb-2 block">Email</span>
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/75 border border-zinc-200/80">
                  <Mail className="w-4 h-4 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-transparent outline-none text-zinc-700 placeholder:text-zinc-400"
                    disabled={isLoading}
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-sm text-zinc-600 mb-2 block">Password</span>
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/75 border border-zinc-200/80">
                  <Lock className="w-4 h-4 text-zinc-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="********"
                    className="w-full bg-transparent outline-none text-zinc-700 placeholder:text-zinc-400"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="text-zinc-500 hover:text-zinc-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </label>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-xl border border-red-200">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-zinc-500">
                  <input type="checkbox" className="rounded border-zinc-300" />
                  Remember me
                </label>
                <button type="button" className="text-amber-600 hover:text-amber-700">
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-2xl bg-[#f4b400] hover:bg-[#e2a800] text-white shadow-[0_12px_24px_rgba(244,180,0,0.35)] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </section>

        <section className="hidden lg:flex p-8 md:p-12">
          <div className="size-full rounded-3xl bg-gradient-to-br from-[#efe1bc]/80 via-white/70 to-[#f5e7c5]/70 border border-white/80 shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-8 flex flex-col justify-between">
            <div>
              <p className="text-sm text-zinc-500">Secure Access</p>
              <h3 className="text-3xl text-zinc-700 mt-2">Control your building from one place</h3>
            </div>

            <div className="space-y-4">
              {[
                'Real-time monitoring and alerts',
                'Energy and occupancy analytics',
                'Centralized HVAC and lighting control',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 p-4 rounded-2xl bg-white/65 border border-white/90">
                  <ShieldCheck className="w-5 h-5 text-amber-500" />
                  <p className="text-zinc-600">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
