"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Send,
  Sparkles,
  Layers,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Eye,
  Info,
  RefreshCw,
} from "lucide-react";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const CHARS_PER_SLIDE = 450;
const MAX_CHARS = 3000;
const MAX_SLIDES = 10;

export default function MenfessPage() {
  const [recipient, setRecipient] = useState("");
  const [sender, setSender] = useState("");
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    id: number;
    slideCount: number;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  // Split message into preview slides
  const slides = useMemo(() => {
    const clean = message.trim();
    if (!clean) return [];
    if (clean.length <= CHARS_PER_SLIDE) return [clean];

    const result: string[] = [];
    const words = clean.split(/(\s+)/);
    let current = "";

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if ((current + w).length > CHARS_PER_SLIDE && current.trim().length > 0) {
        result.push(current.trim());
        current = w;
        if (result.length >= MAX_SLIDES - 1) {
          result.push(words.slice(i).join("").trim());
          current = "";
          break;
        }
      } else {
        current += w;
      }
    }
    if (current.trim()) result.push(current.trim());
    return result.slice(0, MAX_SLIDES);
  }, [message]);

  const slideCount = Math.max(1, slides.length);

  // Initialize Turnstile widget if site key is configured
  useEffect(() => {
    if (!turnstileSiteKey || !turnstileContainerRef.current) return;

    const interval = setInterval(() => {
      if (window.turnstile && turnstileContainerRef.current) {
        clearInterval(interval);
        try {
          const id = window.turnstile.render(turnstileContainerRef.current, {
            sitekey: turnstileSiteKey,
            callback: (token: string) => {
              setTurnstileToken(token);
            },
          });
          widgetIdRef.current = id;
        } catch (err) {
          console.warn("Turnstile render error:", err);
        }
      }
    }, 300);

    return () => clearInterval(interval);
  }, [turnstileSiteKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessData(null);

    const trimmedMsg = message.trim();
    if (!trimmedMsg) {
      setErrorMsg("Isi pesan menfess tidak boleh kosong.");
      return;
    }

    if (trimmedMsg.length > MAX_CHARS) {
      setErrorMsg(`Pesan melebihi batas maksimal ${MAX_CHARS.toLocaleString()} karakter.`);
      return;
    }

    if (turnstileSiteKey && !turnstileToken) {
      setErrorMsg("Harap selesaikan verifikasi Cloudflare Turnstile terlebih dahulu.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/menfess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: recipient.trim() || undefined,
          sender: sender.trim() || undefined,
          message: trimmedMsg,
          turnstileToken: turnstileToken || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal mengirim pesan menfess.");
      }

      const createdId = data.id ?? data.data?.id;
      const createdSlideCount = data.slideCount ?? data.data?.slideCount ?? 1;

      setSuccessData({
        id: createdId,
        slideCount: createdSlideCount,
      });

      // Reset form on success
      setMessage("");
      setRecipient("");
      setSender("");
      setTurnstileToken("");

      // Safely reset Turnstile only if widget was actually rendered
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {
          // Ignore turnstile reset exceptions
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || "Terjadi kesalahan koneksi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className="relative min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 md:p-10 overflow-hidden"
      style={{
        backgroundColor: "#060e10",
        color: "#f1f5f9",
      }}
    >
      {/* Dynamic Background Glows with #006569 */}
      <div
        className="absolute top-[-10%] left-[-10%] w-[550px] h-[550px] rounded-full blur-[130px] pointer-events-none opacity-40"
        style={{ backgroundColor: "#006569" }}
      />
      <div
        className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full blur-[150px] pointer-events-none opacity-30"
        style={{ backgroundColor: "#008f94" }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[180px] pointer-events-none opacity-20"
        style={{ backgroundColor: "#004548" }}
      />

      {/* Main Content Area */}
      <div className="w-full max-w-2xl z-10 my-8">
        {/* Header Branding */}
        <header className="text-center mb-8">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase mb-4"
            style={{
              backgroundColor: "rgba(0, 101, 105, 0.25)",
              border: "1px solid rgba(0, 143, 148, 0.45)",
              color: "#3ee8df",
              boxShadow: "0 0 20px rgba(0, 101, 105, 0.2)",
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#3ee8df]" />
            <span>Anonymous Instagram Menfess</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-3">
            Kirim Pesan{" "}
            <span
              style={{
                backgroundImage: "linear-gradient(135deg, #3ee8df 0%, #008f94 50%, #006569 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Menfess
            </span>
          </h1>

          <p className="text-zinc-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            Sampaikan isi hatimu secara anonim. Pesan akan diproses dan diunggah otomatis ke feed &amp; carousel Instagram.
          </p>
        </header>

        {/* Success Alert Modal / Card */}
        {successData && (
          <div
            className="mb-8 p-6 rounded-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300 shadow-2xl"
            style={{
              backgroundColor: "rgba(0, 101, 105, 0.20)",
              border: "1px solid rgba(0, 143, 148, 0.45)",
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="p-3 rounded-xl shrink-0"
                style={{
                  backgroundColor: "rgba(0, 143, 148, 0.25)",
                  color: "#3ee8df",
                  border: "1px solid rgba(0, 143, 148, 0.4)",
                }}
              >
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-1">
                  Menfess Terkirim! {successData.id ? `(#${successData.id})` : ""}
                </h3>
                <p className="text-zinc-300 text-sm leading-relaxed mb-3">
                  Pesan Anda telah berhasil disimpan dan masuk ke antrean worker. Pesan akan dibuat menjadi{" "}
                  <strong style={{ color: "#3ee8df" }}>{successData.slideCount} slide</strong> dan diposting ke Instagram sesuai jadwal jeda posting akun.
                </p>
                <div
                  className="flex items-center gap-2 text-xs px-3.5 py-2.5 rounded-lg border"
                  style={{
                    backgroundColor: "rgba(6, 14, 16, 0.8)",
                    borderColor: "rgba(0, 101, 105, 0.3)",
                    color: "#94a3b8",
                  }}
                >
                  <Clock className="w-4 h-4 text-[#3ee8df]" />
                  <span>Antrean posting diproses berurutan dengan jeda aman 5–15 menit.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccessData(null)}
                  className="mt-4 text-xs font-semibold underline transition-colors"
                  style={{ color: "#3ee8df" }}
                >
                  Kirim pesan menfess lain →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 backdrop-blur-md flex items-start gap-3 text-rose-200 text-sm animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-rose-300">Gagal Mengirim</p>
              <p className="text-rose-200/90 text-xs sm:text-sm mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Menfess Form Card */}
        <div
          className="backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-2xl relative"
          style={{
            backgroundColor: "rgba(10, 22, 25, 0.82)",
            border: "1px solid rgba(0, 101, 105, 0.40)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 35px rgba(0, 101, 105, 0.15)",
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Row: To & From */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* To field */}
              <div>
                <label
                  htmlFor="recipient-input"
                  className="block text-xs font-semibold uppercase tracking-wider mb-2 text-zinc-300"
                >
                  To (Penerima) <span className="text-zinc-500 font-normal lowercase">(opsional)</span>
                </label>
                <input
                  id="recipient-input"
                  type="text"
                  placeholder="Contoh: @crush / Anak TI 23"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  maxLength={50}
                  className="w-full rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all"
                  style={{
                    backgroundColor: "rgba(6, 14, 16, 0.75)",
                    border: "1px solid rgba(0, 101, 105, 0.35)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#3ee8df";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 101, 105, 0.35)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(0, 101, 105, 0.35)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* From field */}
              <div>
                <label
                  htmlFor="sender-input"
                  className="block text-xs font-semibold uppercase tracking-wider mb-2 text-zinc-300"
                >
                  From (Pengirim) <span className="text-zinc-500 font-normal lowercase">(opsional)</span>
                </label>
                <input
                  id="sender-input"
                  type="text"
                  placeholder="Contoh: Secret Admirer / Anon"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  maxLength={50}
                  className="w-full rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all"
                  style={{
                    backgroundColor: "rgba(6, 14, 16, 0.75)",
                    border: "1px solid rgba(0, 101, 105, 0.35)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#3ee8df";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 101, 105, 0.35)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(0, 101, 105, 0.35)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            {/* Message field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="message-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-zinc-300"
                >
                  Message (Isi Pesan) <span className="text-[#3ee8df]">*</span>
                </label>
                {/* Character Counter */}
                <div className="text-xs font-mono">
                  <span
                    className={
                      message.length > MAX_CHARS
                        ? "text-rose-400 font-bold"
                        : message.length > MAX_CHARS * 0.8
                        ? "text-amber-400"
                        : "text-zinc-400"
                    }
                  >
                    {message.length.toLocaleString()}
                  </span>
                  <span className="text-zinc-600"> / {MAX_CHARS.toLocaleString()}</span>
                </div>
              </div>

              <textarea
                id="message-input"
                rows={6}
                required
                placeholder="Tuliskan pesan menfess kamu di sini... Pesan yang panjang akan dipecah otomatis ke dalam beberapa slide carousel Instagram secara rapi."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={MAX_CHARS}
                className="w-full rounded-2xl p-4 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all resize-y leading-relaxed"
                style={{
                  backgroundColor: "rgba(6, 14, 16, 0.75)",
                  border: "1px solid rgba(0, 101, 105, 0.35)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#3ee8df";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 101, 105, 0.35)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(0, 101, 105, 0.35)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />

              {/* Slide Estimator Bar */}
              <div
                className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs p-3.5 rounded-xl border"
                style={{
                  backgroundColor: "rgba(6, 14, 16, 0.8)",
                  borderColor: "rgba(0, 101, 105, 0.3)",
                }}
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#3ee8df]" />
                  <span className="text-zinc-300 font-medium">
                    {message.trim().length === 0 ? (
                      "Estimasi slide: 1 slide"
                    ) : (
                      <>
                        Pesan ini akan menjadi{" "}
                        <strong className="text-[#3ee8df] font-bold">
                          {slideCount} slide {slideCount > 1 ? "(Carousel)" : "(Single Post)"}
                        </strong>
                      </>
                    )}
                  </span>
                </div>

                {message.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors py-1 px-2.5 rounded-lg hover:bg-zinc-800/60"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#3ee8df]" />
                    <span>{showPreview ? "Tutup Preview" : "Lihat Preview Template"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Live Interactive Instagram Template Preview */}
            {showPreview && (
              <div
                className="p-5 rounded-2xl space-y-4 animate-in fade-in duration-200"
                style={{
                  backgroundColor: "rgba(6, 14, 16, 0.95)",
                  border: "1.5px solid rgba(0, 143, 148, 0.4)",
                }}
              >
                <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2 font-semibold text-zinc-200">
                    <InstagramIcon className="w-4 h-4 text-[#3ee8df]" />
                    <span>Live Mockup Instagram Slide 1 (Dominan Hijau #006569)</span>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500">1080 × 1080 Aspect Ratio</span>
                </div>

                {/* Miniature Instagram Slide Preview Card */}
                <div
                  className="rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden"
                  style={{
                    backgroundColor: "#050f11",
                    backgroundImage:
                      "radial-gradient(circle at 18% 18%, rgba(0, 101, 105, 0.5) 0%, transparent 60%), radial-gradient(circle at 82% 82%, rgba(0, 140, 130, 0.4) 0%, transparent 55%)",
                    border: "1px solid rgba(0, 143, 148, 0.35)",
                    minHeight: "260px",
                  }}
                >
                  {/* Top Bar of Template */}
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider text-white"
                      style={{
                        backgroundColor: "rgba(0, 101, 105, 0.4)",
                        border: "1px solid rgba(0, 180, 180, 0.45)",
                      }}
                    >
                      <span className="text-[#3ee8df]">✦</span>
                      <span>MENFESS</span>
                    </div>
                    {slideCount > 1 && (
                      <span
                        className="text-xs px-2.5 py-0.5 rounded-full font-mono text-[#7eece4]"
                        style={{
                          backgroundColor: "rgba(0, 101, 105, 0.3)",
                          border: "1px solid rgba(0, 180, 180, 0.35)",
                        }}
                      >
                        1 / {slideCount}
                      </span>
                    )}
                  </div>

                  {/* Badges To & From */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <div
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs"
                      style={{
                        backgroundColor: "rgba(0, 101, 105, 0.35)",
                        border: "1px solid rgba(0, 190, 190, 0.50)",
                      }}
                    >
                      <span className="font-bold text-[#4ee4db]">To:</span>
                      <span className="text-white font-medium">{recipient.trim() || "Anyone"}</span>
                    </div>
                    <div
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs"
                      style={{
                        backgroundColor: "rgba(0, 50, 52, 0.40)",
                        border: "1px solid rgba(0, 140, 140, 0.40)",
                      }}
                    >
                      <span className="font-bold text-[#80cbc4]">From:</span>
                      <span className="text-white font-medium">{sender.trim() || "Secret"}</span>
                    </div>
                  </div>

                  {/* Message Bubble Preview */}
                  <div
                    className="p-4 rounded-xl flex-1 mb-4 flex items-center"
                    style={{
                      backgroundColor: "rgba(7, 20, 22, 0.85)",
                      border: "1px solid rgba(0, 140, 140, 0.3)",
                    }}
                  >
                    <p className="text-sm text-zinc-100 leading-relaxed font-sans line-clamp-4">
                      {slides[0] || message || "Isi pesan akan tampil di sini..."}
                    </p>
                  </div>

                  {/* Footer of Template */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-teal-900/40 pt-2.5">
                    <span className="text-zinc-500">Pesan bersifat publik • Dikirim tanpa moderasi</span>
                    <span className="text-[#4ee4db] font-semibold flex items-center gap-1">
                      <span className="text-[#008f94]">●</span> Simple IG Menfess
                    </span>
                  </div>
                </div>

                {/* Carousel Slides List */}
                {slides.length > 1 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-xs text-zinc-400 font-semibold">
                      Daftar Slide Carousel ({slides.length} Slide):
                    </span>
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {slides.map((sText, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg text-xs border"
                          style={{
                            backgroundColor: "rgba(7, 20, 22, 0.6)",
                            borderColor: "rgba(0, 101, 105, 0.25)",
                          }}
                        >
                          <div className="flex justify-between text-[11px] font-mono text-[#3ee8df] mb-1">
                            <span>Slide {idx + 1} / {slides.length}</span>
                            <span className="text-zinc-500">{sText.length} char</span>
                          </div>
                          <p className="text-zinc-300 line-clamp-2 leading-relaxed">{sText}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CAPTCHA Container */}
            {turnstileSiteKey ? (
              <div className="flex justify-center py-2">
                <div ref={turnstileContainerRef} id="turnstile-widget" />
              </div>
            ) : (
              <div
                className="flex items-center gap-2 p-3 rounded-xl text-xs border"
                style={{
                  backgroundColor: "rgba(6, 14, 16, 0.7)",
                  borderColor: "rgba(0, 101, 105, 0.25)",
                  color: "#94a3b8",
                }}
              >
                <Info className="w-4 h-4 text-[#3ee8df] shrink-0" />
                <span>
                  Proteksi Turnstile CAPTCHA siap dikonfigurasi melalui{" "}
                  <code className="text-[#3ee8df]">.env</code>.
                </span>
              </div>
            )}

            {/* Submit Button with Rich #006569 Palette */}
            <button
              id="submit-menfess-btn"
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="w-full py-4 px-6 rounded-xl font-bold text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-xl transition-all flex items-center justify-center gap-2 transform active:scale-[0.99] cursor-pointer"
              style={{
                backgroundImage: "linear-gradient(135deg, #006569 0%, #008f94 50%, #007377 100%)",
                boxShadow: "0 10px 25px -5px rgba(0, 101, 105, 0.5), 0 0 15px rgba(0, 143, 148, 0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundImage =
                  "linear-gradient(135deg, #008f94 0%, #00a8ad 50%, #008f94 100%)";
                e.currentTarget.style.boxShadow =
                  "0 12px 30px -5px rgba(0, 143, 148, 0.6), 0 0 20px rgba(0, 180, 180, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundImage =
                  "linear-gradient(135deg, #006569 0%, #008f94 50%, #007377 100%)";
                e.currentTarget.style.boxShadow =
                  "0 10px 25px -5px rgba(0, 101, 105, 0.5), 0 0 15px rgba(0, 143, 148, 0.2)";
              }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Mengirim Menfess...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-white" />
                  <span>Kirim Menfess Sekarang</span>
                </>
              )}
            </button>

            {/* Mandatory PRD Disclaimer */}
            <div className="pt-1 text-center">
              <p className="text-xs text-zinc-500 leading-relaxed italic">
                &ldquo;Pesan bersifat publik dan pengirim bertanggung jawab atas isinya.&rdquo;
              </p>
            </div>
          </form>
        </div>

        {/* Footer Info */}
        <footer className="mt-8 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <InstagramIcon className="w-3.5 h-3.5 text-[#3ee8df]" />
              <span>Auto-post via Background Worker</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#3ee8df]" />
              <span>Tanpa Filter Konten</span>
            </span>
          </div>
          <p className="text-zinc-600">
            Simple IG Menfess • Dominan Hijau (#006569) Sesuai PRD
          </p>
        </footer>
      </div>
    </main>
  );
}
