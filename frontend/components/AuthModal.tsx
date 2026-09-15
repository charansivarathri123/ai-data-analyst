"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, RefreshCw, AlertCircle, Mail, Phone, ArrowLeft, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useAuth } from "./AuthContext";

import { API_BASE } from "../lib/config";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

type AuthChannel = "email" | "mobile";
type AuthStep = "input" | "otp";

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, login } = useAuth();

  // Channel & Step State
  const [channel, setChannel] = useState<AuthChannel>("email");
  const [step, setStep] = useState<AuthStep>("input");

  // Form Fields
  const [destination, setDestination] = useState("");
  const [fullName, setFullName] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);

  // Status & Timer State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(300); // 5 minutes

  // Refs for 6-box OTP input
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for OTP
  useEffect(() => {
    let timer: any = null;
    if (step === "otp" && countdown > 0) {
      timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, countdown]);

  // Dynamically load and initialize Google Identity Services (GSI)
  useEffect(() => {
    if (!isAuthModalOpen) return;

    const scriptId = "google-jssdk";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initGoogleSignIn();
      };
      document.body.appendChild(script);
    } else {
      initGoogleSignIn();
    }
  }, [isAuthModalOpen]);

  const initGoogleSignIn = () => {
    if (typeof window === "undefined" || !(window as any).google?.accounts?.id) return;
    if (!GOOGLE_CLIENT_ID) return;

    try {
      (window as any).google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialResponse,
      });

      // Render official Google button if target div exists
      const targetDiv = document.getElementById("googleSignInButtonDiv");
      if (targetDiv) {
        (window as any).google.accounts.id.renderButton(targetDiv, {
          theme: "filled_black",
          size: "large",
          width: 350,
          text: "continue_with",
          shape: "pill",
        });
      }
    } catch (err) {
      console.warn("Google Sign-In initialization note:", err);
    }
  };

  // Handle Google OAuth Credential Token
  const handleGoogleCredentialResponse = async (response: any) => {
    if (!response?.credential) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: response.credential,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Google authentication failed.");
      }

      login(data.user, data.session_token);
      resetModal();
      closeAuthModal();
    } catch (err: any) {
      setErrorMessage(err.message || "Google Sign-In failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fallback Google Sign-In when Client ID is not in env
  const handleGooglePromptOrFallback = async () => {
    if ((window as any).google?.accounts?.id && GOOGLE_CLIENT_ID) {
      (window as any).google.accounts.id.prompt();
      return;
    }

    // Prompt user for their real Google account email
    const realEmail = window.prompt("Enter your Google Account email to connect:", "yourname@gmail.com");
    if (!realEmail || !realEmail.includes("@")) return;

    const realName = realEmail.split("@")[0].replace(".", " ");
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: realName.charAt(0).toUpperCase() + realName.slice(1),
          email: realEmail.trim().toLowerCase(),
          avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(realEmail)}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Google Sign-In failed.");
      }

      login(data.user, data.session_token);
      resetModal();
      closeAuthModal();
    } catch (err: any) {
      setErrorMessage(err.message || "Google Sign-In failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Send OTP to destination (email or phone)
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const dest = destination.trim();
    if (!dest) {
      setErrorMessage(`Please enter a valid ${channel === "email" ? "email address" : "mobile number"}.`);
      return;
    }

    if (channel === "email" && !dest.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          destination: dest,
          name: fullName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to dispatch verification code.");
      }

      // Transition to OTP verification step
      setStep("otp");
      setCountdown(data.expires_in_seconds || 300);
      setSuccessMessage(`Verification code sent to ${dest}`);

      if (data.dev_code) {
        setDevCodeHint(data.dev_code);
      }

      // Focus first digit box
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to send verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Handle OTP input typing & auto-advance
  const handleDigitChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = val.slice(-1);
    setOtpDigits(newDigits);

    // Auto focus next box
    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto verify if all 6 digits entered
    const fullCode = newDigits.join("");
    if (fullCode.length === 6 && !newDigits.includes("")) {
      verifyOTPCode(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pasted)) {
      const digits = pasted.split("");
      setOtpDigits(digits);
      inputRefs.current[5]?.focus();
      verifyOTPCode(pasted);
    }
  };

  // Step 2: Submit OTP verification code
  const verifyOTPCode = async (codeToVerify?: string) => {
    const code = codeToVerify || otpDigits.join("");
    if (code.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          destination: destination.trim(),
          code: code.trim(),
          name: fullName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Invalid or expired verification code.");
      }

      login(data.user, data.session_token);
      resetModal();
      closeAuthModal();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to verify code.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetModal = () => {
    setStep("input");
    setDestination("");
    setFullName("");
    setOtpDigits(["", "", "", "", "", ""]);
    setErrorMessage(null);
    setSuccessMessage(null);
    setDevCodeHint(null);
    setCountdown(300);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isAuthModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-[440px] rounded-[32px] bg-[#121212] p-8 shadow-2xl border border-zinc-800 text-white overflow-hidden">
        {/* Close Button */}
        <button
          onClick={() => {
            resetModal();
            closeAuthModal();
          }}
          className="absolute top-5 right-5 rounded-full p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20 mb-3">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {step === "input" ? "Sign in or Register" : "Enter Verification Code"}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {step === "input"
              ? "Access your autonomous AI data studio, projects, and queries"
              : `A 6-digit passcode was dispatched to ${destination}`}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-950/50 border border-red-800/60 p-3 text-red-200 text-xs sm:text-sm animate-in fade-in">
            <AlertCircle className="w-4 h-4 mt-0.5 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 p-3 text-emerald-200 text-xs sm:text-sm animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* STEP 1: INITIAL SELECTION & INPUT */}
        {step === "input" && (
          <div className="space-y-4">
            {/* Google Sign-In Button */}
            <div id="googleSignInButtonDiv" className="w-full flex justify-center"></div>
            <button
              type="button"
              onClick={handleGooglePromptOrFallback}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 rounded-2xl bg-[#212121] hover:bg-[#2a2a2a] text-zinc-100 font-medium text-sm sm:text-base py-3.5 px-4 border border-zinc-700/50 transition-all shadow-xs disabled:opacity-50"
            >
              <svg style={{ width: "18px", height: "18px" }} viewBox="0 0 24 24">
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

            {/* Divider */}
            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <span className="relative bg-[#121212] px-3 text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                Or with Passcode (OTP)
              </span>
            </div>

            {/* Channel Tabs: Email / Mobile */}
            <div className="flex rounded-xl bg-zinc-900/80 p-1 border border-zinc-800/80">
              <button
                type="button"
                onClick={() => {
                  setChannel("email");
                  setDestination("");
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                  channel === "email"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                Email OTP
              </button>
              <button
                type="button"
                onClick={() => {
                  setChannel("mobile");
                  setDestination("");
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                  channel === "mobile"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                Mobile OTP
              </button>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendOTP} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  {channel === "email" ? "Email Address" : "Mobile Phone Number"}
                </label>
                <input
                  type={channel === "email" ? "email" : "tel"}
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder={channel === "email" ? "you@company.com" : "+1 (555) 000-0000"}
                  required
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700/60 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Full Name <span className="text-zinc-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Miller"
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700/60 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm py-3 px-4 transition-all shadow-md shadow-purple-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <span>Send 6-Digit Code</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: 6-DIGIT OTP VERIFICATION SCREEN */}
        {step === "otp" && (
          <div className="space-y-5">


            {/* 6-Box OTP Inputs */}
            <div className="flex justify-between gap-2 on-paste" onPaste={handlePaste}>
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="w-12 h-14 text-center text-xl font-bold font-mono rounded-xl bg-zinc-900 border border-zinc-700/80 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all shadow-inner"
                />
              ))}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => verifyOTPCode()}
                disabled={isLoading || otpDigits.join("").length !== 6}
                className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm py-3 px-4 transition-all shadow-md shadow-purple-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify & Continue</span>
                )}
              </button>

              {/* Timer & Resend */}
              <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
                <span>Code expires in: <strong className="text-white font-mono">{formatTimer(countdown)}</strong></span>
                <button
                  type="button"
                  disabled={countdown > 0 || isLoading}
                  onClick={handleSendOTP}
                  className="text-purple-400 hover:text-purple-300 font-medium disabled:opacity-40 disabled:hover:text-purple-400 cursor-pointer"
                >
                  Resend Code
                </button>
              </div>

              {/* Back to Edit Destination */}
              <button
                type="button"
                onClick={() => {
                  setStep("input");
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setOtpDigits(["", "", "", "", "", ""]);
                }}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors py-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change {channel === "email" ? "Email Address" : "Phone Number"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
