'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [obscurePassword, setObscurePassword] = useState(true);
  const [obscureConfirmPassword, setObscureConfirmPassword] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const router = useRouter();

  useEffect(() => {
    setFadeIn(true);
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log('🔐 Found existing session');
      // Check server health or set auth token in your PostManager equivalent
      router.push('/home');
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!isLogin) {
      if (!fullName.trim()) {
        newErrors.fullName = 'Please enter your full name';
      }
      if (!username.trim()) {
        newErrors.username = 'Please enter a username';
      } else if (username.length < 3) {
        newErrors.username = 'Username must be at least 3 characters';
      }
    }

    if (!email.trim()) {
      newErrors.email = 'Please enter your email';
    } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Please enter your password';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!isLogin) {
      if (!confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const signInWithEmail = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      console.log('🔐 Attempting sign in...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) throw error;

      if (data.user && data.session) {
        console.log('✅ Sign in successful');
        // Set token in your PostManager equivalent here
        router.push('/home');
      }
    } catch (error: any) {
      console.error('❌ Sign in failed:', error.message);
      showErrorDialog(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithEmail = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      console.log('📝 Attempting sign up...');
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            full_name: fullName.trim(),
            username: username.trim(),
            role: 'client',
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        console.log('✅ Sign up successful');
        await createUserProfile(data.user);

        showSuccessDialog(
          `Account created successfully! ${
            data.session ? 'You are now logged in.' : 'Check your email for verification.'
          }`
        );

        if (data.session) {
          setTimeout(() => {
            router.push('/home');
          }, 2000);
        }
      }
    } catch (error: any) {
      console.error('❌ Sign up failed:', error.message);
      showErrorDialog(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const createUserProfile = async (user: any) => {
    try {
      console.log('👤 Creating user profile...');
      const { error } = await supabase.from('profiles').insert({
        id: user.id,
        full_name: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        role: 'client',
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
      console.log('✅ User profile created');
    } catch (error) {
      console.error('❌ Profile creation error:', error);
    }
  };

  const signInWithGoogle = async () => {
    setIsLoading(true);

    try {
      console.log('🔐 Attempting Google sign in...');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('❌ Google sign in failed:', error.message);
      showErrorDialog(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const showErrorDialog = (message: string) => {
    alert(`Error: ${message}`);
  };

  const showSuccessDialog = (message: string) => {
    alert(`Success: ${message}`);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 dark:from-blue-500 dark:via-purple-500 dark:to-pink-500" />

      {/* Content */}
      <div className="relative min-h-screen w-full">
        <div
          className={`min-h-screen flex flex-col items-center justify-start px-6 py-10 transition-all duration-1000 ${
            fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
          }`}
        >
          {/* Header */}
          <div className="flex flex-col items-center mt-10 mb-10">
            <div className="w-[90px] h-[90px] rounded-full bg-white/15 border-2 border-white/40 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.1)] mb-4">
              <svg
                className="w-11 h-11 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h1 className="text-[32px] font-bold text-white -tracking-wider mb-2 drop-shadow-md">
              FineTake
            </h1>
            <p className="text-white/90 text-base tracking-wide font-light">
              Capture. Create. Share.
            </p>
          </div>

          {/* Form Card */}
          <div className="w-full max-w-md bg-white/98 dark:bg-gray-800/95 rounded-[20px] shadow-[0_15px_25px_rgba(0,0,0,0.15)] border border-transparent dark:border-white/10 p-7">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                isLogin ? signInWithEmail() : signUpWithEmail();
              }}
            >
              {/* Toggle Buttons */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-[14px] p-1 flex mb-6">
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-3.5 rounded-[14px] text-base font-semibold transition-all duration-250 ${
                    isLogin
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-[0_4px_8px_rgba(59,130,246,0.3)]'
                      : 'text-blue-500'
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-3.5 rounded-[14px] text-base font-semibold transition-all duration-250 ${
                    !isLogin
                      ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-[0_4px_8px_rgba(139,92,246,0.3)]'
                      : 'text-purple-600'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                {!isLogin && (
                  <>
                    <div>
                      <div className="relative">
                        <svg
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        <input
                          type="text"
                          placeholder="Enter your full name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 border-blue-500/30 focus:border-blue-500"
                        />
                      </div>
                      {errors.fullName && (
                        <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>
                      )}
                    </div>

                    <div>
                      <div className="relative">
                        <svg
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                          />
                        </svg>
                        <input
                          type="text"
                          placeholder="Choose a username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-600 border-purple-600/30 focus:border-purple-600"
                        />
                      </div>
                      {errors.username && (
                        <p className="text-red-500 text-sm mt-1">{errors.username}</p>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 border-pink-500/30 focus:border-pink-500"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <input
                      type={obscurePassword ? 'password' : 'text'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600 border-green-600/30 focus:border-green-600"
                    />
                    <button
                      type="button"
                      onClick={() => setObscurePassword(!obscurePassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600"
                    >
                      {obscurePassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-500 text-sm mt-1">{errors.password}</p>
                  )}
                </div>

                {!isLogin && (
                  <div>
                    <div className="relative">
                      <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                      <input
                        type={obscureConfirmPassword ? 'password' : 'text'}
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-12 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 border-red-600/30 focus:border-red-600"
                      />
                      <button
                        type="button"
                        onClick={() => setObscureConfirmPassword(!obscureConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-red-600"
                      >
                        {obscureConfirmPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[52px] mt-7 bg-gradient-to-r from-blue-500 via-purple-600 to-pink-500 text-white font-semibold text-base tracking-wide rounded-xl shadow-[0_6px_12px_rgba(59,130,246,0.3)] hover:shadow-[0_8px_16px_rgba(59,130,246,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-5.5 h-5.5 border-2.5 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : (
                  isLogin ? 'Login' : 'Create Account'
                )}
              </button>

              {/* Switch Text */}
              <div className="text-center mt-5">
                <span className="text-gray-600 text-sm">
                  {isLogin ? "Don't have an account? " : 'Already have an account? '}
                </span>
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-blue-500 text-sm font-semibold hover:underline"
                >
                  {isLogin ? 'Sign Up' : 'Login'}
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center my-5">
                <div className="flex-1 h-px bg-gray-400/40" />
                <span className="px-4 text-gray-500/70 text-xs font-medium tracking-widest">OR</span>
                <div className="flex-1 h-px bg-gray-400/40" />
              </div>

              {/* Google Sign In */}
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={isLoading}
                className="w-full h-12 bg-white border-[1.5px] border-blue-500/30 rounded-xl shadow-[0_4px_8px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_12px_rgba(0,0,0,0.15)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <img
                  src="https://developers.google.com/identity/images/g-logo.png"
                  alt="Google"
                  className="w-5 h-5"
                />
                <span className="text-gray-700 font-semibold text-[15px] tracking-wide">
                  Continue with Google
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}