"use client";

import React, { useState } from "react";
import { X, RefreshCw, AlertCircle } from "lucide-react";
import { useAuth } from "./AuthContext";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, login } = useAuth();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  // Handle Continue with Google
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Google User",
          email: "google.user@gmail.com",
          avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=GoogleUser",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Google Sign-In failed.");
      }
      login(data.user, data.session_token);
      closeAuthModal();
    } catch (err: any) {
      setErrorMessage(err.message || "Google Sign-In failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Continue with Apple
  const handleAppleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/apple`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Apple User",
          email: "apple.user@icloud.com",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Apple Sign-In failed.");
      }
      login(data.user, data.session_token);
      closeAuthModal();
    } catch (err: any) {
      setErrorMessage(err.message || "Apple Sign-In failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Continue with Email
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/email-direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed.");
      }
      login(data.user, data.session_token);
      closeAuthModal();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to continue with email.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-[420px] rounded-[32px] bg-[#121212] p-8 shadow-2xl border border-zinc-800/80 text-white overflow-hidden">
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-5 right-5 rounded-full p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-4 pt-2">
          {/* Continue with Google Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-[#212121] hover:bg-[#2a2a2a] text-zinc-100 font-medium text-sm sm:text-base py-3.5 px-4 border border-zinc-700/40 transition-all shadow-xs disabled:opacity-50"
          >
            {/* Google "G" Icon */}
            <svg
              style={{ width: "18px", height: "18px", minWidth: "18px", minHeight: "18px" }}
              viewBox="0 0 24 24"
            >
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Continue with Apple Button */}
          <button
            type="button"
            onClick={handleAppleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-[#212121] hover:bg-[#2a2a2a] text-zinc-100 font-medium text-sm sm:text-base py-3.5 px-4 border border-zinc-700/40 transition-all shadow-xs disabled:opacity-50"
          >
            {/* Apple Logo */}
            <svg
              style={{ width: "18px", height: "18px", minWidth: "18px", minHeight: "18px" }}
              className="fill-white"
              viewBox="0 0 170 170"
            >
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.08-7.7-7.93-12.04-14.54-6.08-9.27-10.87-19.86-14.38-31.76-3.51-11.9-5.26-23.2-5.26-33.89 0-14.9 3.65-27.42 10.96-37.58 7.31-10.16 16.59-15.34 27.84-15.54 4.35 0 9.28 1.13 14.8 3.38 5.51 2.26 9.4 3.44 11.66 3.55 2.05-.11 6.04-1.32 11.97-3.64 5.92-2.31 10.6-3.41 14.03-3.29 10.87.53 19.85 4.77 26.96 12.73-9.58 5.82-14.28 13.97-14.1 24.46.22 8.35 3.36 15.37 9.43 21.05 6.07 5.68 13.24 9.05 21.52 10.12-2.12 6.53-4.77 13.3-7.95 20.32zM119.22 31.84c0-7.39 2.65-14.43 7.95-21.13 5.3-6.7 11.89-10.71 19.78-12.04.11.85.16 1.69.16 2.53 0 7.39-2.73 14.5-8.2 21.32-5.46 6.82-12.18 10.79-20.15 11.9-.22-.85-.33-1.74-.33-2.68z" />
            </svg>
            <span>Continue with Apple</span>
          </button>

          {/* OR Divider */}
          <div className="py-2 text-center">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              OR
            </span>
          </div>

          {/* Email Input & Submit Form */}
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div>
              <input
                type="email"
                required
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl bg-[#1d1d1f] px-5 py-3.5 text-sm sm:text-base text-zinc-100 placeholder:text-zinc-500 border border-zinc-700/60 focus:border-zinc-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-center gap-2 text-xs text-red-400 px-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Continue with email button (Solid White with dark text) */}
            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full rounded-2xl bg-white hover:bg-zinc-100 text-black font-semibold text-sm sm:text-base py-3.5 px-4 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin text-black" />
              ) : (
                <span>Continue with email</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
