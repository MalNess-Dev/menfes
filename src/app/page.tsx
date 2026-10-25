"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Send,
  Layers,
  Sparkles,
  Lock,
  RefreshCw,
  Clock,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
  Palette,
  Eye,
  PenTool,
  Plus,
  Megaphone,
  Lightbulb,
} from "lucide-react";
import UnjMascot from "@/components/UnjMascot";
import { splitMessageIntoSlides, CHARS_PER_SLIDE, MAX_SLIDES } from "@/lib/slides";

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

const MAX_CHARS = 3500; // 10 slides * 350 characters

type TemplateType = "comic" | "unj-classic" | "cyber" | "scrapbook";

interface TemplateOption {
  id: TemplateType;
  name: string;
  tag: string;
  icon: string;
  desc: string;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: "comic",
    name: "Comic Pop",
    tag: "Komik Seru",
    icon: "💥",
    desc: "Gaya komik seru: Kuning cerah, outline hitam tebal & stiker ekspresif",
  },
  {
    id: "unj-classic",
    name: "UNJ Classic",
    tag: "Emerald & Gold",
    icon: "🏛️",
    desc: "Elegan khas #menfessunj: Deep Pine Teal (#006569) & Sunshine Gold (#FFDD00)",
  },
  {
    id: "cyber",
    name: "Cyberpunk",
    tag: "Retro Terminal",
    icon: "⚡",
    desc: "Gaya retro terminal, scanlines futuristik dan tanda kurung neon",
  },
  {
    id: "scrapbook",
    name: "Scrapbook",
    tag: "Cute Polaroid",
    icon: "🎨",
    desc: "Estetika polaroid dengan selotip washi tape, stiker pin & kertas diary",
  },
];

export default function MenfessPage() {
  const [recipient, setRecipient] = useState("");
  const [sender, setSender] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>("unj-classic");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewSlideIdx, setPreviewSlideIdx] = useState(0);

  // Mobile segmented tab: "form" or "preview"
  const [mobileTab, setMobileTab] = useState<"form" | "preview">("form");

  const [mascotMood, setMascotMood] = useState<"idle" | "typing" | "happy" | "submitting">("idle");

  interface QueueInfo {
    todayPublishedCount: number;
    maxDailyPosts: number;
    remainingToday: number;
    isDailyLimitReached: boolean;
    pendingCount: number;
  }

  const [queueInfo, setQueueInfo] = useState<QueueInfo | null>(null);

  const [successData, setSuccessData] = useState<{
    id: number;
    slideCount: number;
    queuePosition?: number;
    pendingAhead?: number;
    isDailyLimitReached?: boolean;
    todayPublishedCount?: number;
    maxDailyPosts?: number;
    remaining?: number;
    resetInSeconds?: number;
    template: TemplateType;
  } | null>(null);

  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  // Fetch current queue and daily limit info on mount
  const fetchQueueInfo = async () => {
    try {
      const res = await fetch("/api/menfess");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setQueueInfo(data);
        }
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchQueueInfo();
  }, []);

  // Auto-split message into clean slides strictly <= 350 characters
  const slides = useMemo(() => {
    return splitMessageIntoSlides(message, CHARS_PER_SLIDE, MAX_SLIDES);
  }, [message]);

  const slideCount = Math.max(1, slides.length);

  // Validate preview slide index
  useEffect(() => {
    if (previewSlideIdx >= slideCount) {
      setPreviewSlideIdx(Math.max(0, slideCount - 1));
    }
  }, [slideCount, previewSlideIdx]);

  // Mascot mood management
  useEffect(() => {
    const hasAnyContent = message.trim().length > 0;
    if (isSubmitting) {
      setMascotMood("submitting");
    } else if (successData) {
      setMascotMood("happy");
    } else if (hasAnyContent || recipient.trim().length > 0) {
      setMascotMood("typing");
    } else {
      setMascotMood("idle");
    }
  }, [message, recipient, isSubmitting, successData]);

  // Insert explicit slide separator at cursor position
  const handleInsertSlideBreak = () => {
    if (!messageTextareaRef.current) return;
    const textarea = messageTextareaRef.current;
    const start = textarea.selectionStart ?? message.length;
    const end = textarea.selectionEnd ?? message.length;
    const separator = "\n\n---slide---\n\n";
    const newMessage = message.slice(0, start) + separator + message.slice(end);
    setMessage(newMessage);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + separator.length, start + separator.length);
    }, 50);
  };

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
      setErrorMsg("Silakan ketik isi pesan menfess terlebih dahulu.");
      messageTextareaRef.current?.focus();
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
          template: selectedTemplate,
          turnstileToken: turnstileToken || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal mengirim pesan menfess.");
      }

      const createdId = data.id ?? data.data?.id;
      const createdSlideCount = data.slideCount ?? data.data?.slideCount ?? slideCount;

      setSuccessData({
        id: createdId,
        slideCount: createdSlideCount,
        queuePosition: data.queuePosition ?? data.data?.queuePosition,
        pendingAhead: data.pendingAhead ?? data.data?.pendingAhead,
        isDailyLimitReached: data.isDailyLimitReached ?? data.data?.isDailyLimitReached,
        todayPublishedCount: data.todayPublishedCount ?? data.data?.todayPublishedCount,
        maxDailyPosts: data.maxDailyPosts ?? data.data?.maxDailyPosts ?? 15,
        remaining: data.remaining,
        resetInSeconds: data.resetInSeconds,
        template: selectedTemplate,
      });

      // Refresh queue counts
      fetchQueueInfo();

      // Reset form on success
      setMessage("");
      setPreviewSlideIdx(0);
      setRecipient("");
      setSender("");
      setTurnstileToken("");
      setMobileTab("form");

      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {
          // Ignore
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || "Terjadi kesalahan koneksi saat mengirim.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const currentPreviewText =
    slides[previewSlideIdx]?.trim() ||
    (message.trim().length > 0
      ? `(Slide ${previewSlideIdx + 1} belum terisi)`
      : "Tuliskan pesan menfess kamu di form... Pesanmu akan tampil rapi sesuai template yang kamu pilih di sini!");

  // Dynamic typography scale for preview cards to prevent vertical overflow and scrolling
  const getPreviewFontSize = (text: string) => {
    const len = text.length;
    if (len < 80) return "text-sm sm:text-base font-bold leading-relaxed";
    if (len < 180) return "text-xs sm:text-sm font-semibold leading-relaxed";
    if (len < 280) return "text-[11.5px] sm:text-xs font-medium leading-relaxed";
    return "text-[10px] sm:text-[11px] font-medium leading-snug";
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans antialiased selection:bg-[#006569] selection:text-white flex flex-col justify-between relative overflow-x-hidden">

      {/* ========================================================================= */}
      {/* INTERACTIVE DRAGGABLE SVG MASCOT (COMPACT FOR DESKTOP & MOBILE)          */}
      {/* ========================================================================= */}
      <UnjMascot
        mood={mascotMood}
        messageText={slides[previewSlideIdx] || message}
        recipientText={recipient}
      />

      {/* ========================================================================= */}
      {/* TOP NAVBAR (CLEAN, MINIMAL & MOBILE OPTIMIZED)                            */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-15 sm:h-16 flex items-center">
          
          {/* Brand Logo: UNJ MENFESS */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#006569] text-[#FFDD00] flex items-center justify-center font-black text-lg sm:text-xl shadow-md shadow-[#006569]/25 shrink-0">
              U
            </div>
            <div>
              <span className="font-black text-base sm:text-lg tracking-wider text-[#006569] uppercase block leading-none">
                UNJ MENFESS<span className="text-[#FFDD00]">.</span>
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium tracking-tight block mt-0.5">
                Universitas Negeri Jakarta • Rawamangun
              </span>
            </div>
          </div>

        </div>
      </header>

      {/* ========================================================================= */}
      {/* 1. LAYAR 1: JUDUL UTAMA UNJ MENFESS (HERO VIEW)                           */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 1. LAYAR 1: JUDUL UTAMA UNJ MENFESS (HERO VIEW)                           */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 1. LAYAR 1: JUDUL UTAMA UNJ MENFESS (HERO VIEW)                           */}
      {/* ========================================================================= */}
      <section id="hero-section" className="min-h-[calc(100vh-64px)] flex flex-col justify-center items-center text-center px-6 sm:px-8 max-w-4xl mx-auto py-12 sm:py-20 space-y-6 sm:space-y-8 relative z-10">
        
        {/* Main Headline (Prominent, Structured & Grand) */}
        <h1 className="flex flex-col items-center justify-center font-black tracking-tight max-w-4xl mx-auto">
          <span className="text-[44px] xs:text-[50px] sm:text-6xl md:text-7xl lg:text-8xl text-slate-950 font-black leading-[1.05] tracking-tight">
            Kirim Menfess
          </span>
          <span className="text-xl xs:text-2xl sm:text-3xl md:text-4xl text-slate-500 font-extrabold tracking-tight my-1 sm:my-2">
            Sesukamu di
          </span>
          <span className="text-[40px] xs:text-[46px] sm:text-6xl md:text-7xl lg:text-8xl text-[#006569] font-black leading-[1.05] tracking-tight">
            UNJ Menfess<span className="text-[#FFDD00]">.</span>
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-slate-600 text-sm sm:text-base md:text-lg max-w-xl leading-relaxed font-normal">
          Wadah aspirasi, curahan hati, dan salam rahasia untuk seluruh mahasiswa dan civitas akademika Universitas Negeri Jakarta. Suarakan apapun tanpa rasa takut!
        </p>

        {/* CTA Buttons */}
        <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto max-w-xs sm:max-w-none">
          <button
            type="button"
            onClick={() => scrollToSection("pesan-section")}
            className="w-full sm:w-auto px-8 py-3.5 sm:py-4 rounded-full bg-[#006569] hover:bg-[#004f52] active:scale-95 text-[#FFDD00] font-black text-sm sm:text-base shadow-lg shadow-[#006569]/20 flex items-center justify-center gap-2.5 transition cursor-pointer group"
          >
            <span>Lanjut ke Pesan &amp; Motivasi</span>
            <ArrowDown className="w-4 h-4 group-hover:translate-y-1 transition text-[#FFDD00]" />
          </button>

          <button
            type="button"
            onClick={() => scrollToSection("form-section")}
            className="w-full sm:w-auto px-8 py-3.5 sm:py-4 rounded-full bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-800 font-bold text-sm sm:text-base border border-slate-200 transition cursor-pointer"
          >
            <span>Langsung Buat</span>
          </button>
        </div>

        {/* Downward Animated Prompt */}
        <div
          onClick={() => scrollToSection("pesan-section")}
          className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold cursor-pointer animate-bounce mt-3 hover:text-[#006569] transition"
        >
          <span>Scroll ke bawah untuk membaca pesan</span>
          <ChevronRight className="w-3.5 h-3.5 rotate-90 text-[#006569]" />
        </div>

      </section>

      {/* ========================================================================= */}
      {/* 2. LAYAR 2: PAS DI-SCROLL -> PESAN JANGAN TAKUT                           */}
      {/* ========================================================================= */}
      <section
        id="pesan-section"
        className="min-h-screen flex flex-col justify-center items-center text-center px-6 sm:px-8 max-w-4xl mx-auto py-20 sm:py-32 space-y-6 sm:space-y-8 border-t border-slate-100 relative z-10"
      >
        <div className="space-y-4 sm:space-y-6 max-w-3xl">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#006569]/10 text-[#006569] font-black text-xs sm:text-sm border border-[#006569]/20 shadow-xs">
            <Megaphone className="w-4 h-4 text-[#006569]" />
            <span>Kamu Takut Bersuara di UNJ? Send Menfess Aja!</span>
          </div>

          {/* Headline */}
          <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.18] break-words">
            Jangan Takut untuk Keluarkan{" "}
            <span className="text-[#006569] inline-block">Uneg-Uneg Kamu</span>{" "}
            di UNJFess
          </h2>

          {/* Subtext */}
          <p className="text-slate-600 text-sm sm:text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
            Punya unek-unek soal fasilitas kampus, kebijakan birokrasi, dosen, UKT, atau struggle perkuliahan tapi takut diintimidasi? <strong className="text-slate-900 font-bold">Jangan dipendam sendiri!</strong> Suarakan aspirasimu secara 100% anonim, aman tanpa registrasi, dan otomatis tayang rapi ke carousel Instagram UNJ.
          </p>

        </div>

        {/* CTA Button */}
        <div className="pt-2 sm:pt-4 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => scrollToSection("form-section")}
            className="px-9 py-4 rounded-full bg-[#FFDD00] hover:bg-[#ffe333] active:scale-95 text-[#006569] font-black text-sm sm:text-base shadow-xl shadow-[#FFDD00]/30 flex items-center justify-center gap-3 transition cursor-pointer group border-2 border-[#006569]/10"
          >
            <span>Tulis Menfess Sekarang</span>
            <ArrowDown className="w-4 h-4 group-hover:translate-y-1 transition text-[#006569]" />
          </button>

          <div
            onClick={() => scrollToSection("form-section")}
            className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold cursor-pointer animate-bounce mt-1 hover:text-[#006569] transition"
          >
            <span>Scroll ke bawah untuk form &amp; preview</span>
            <ChevronRight className="w-3.5 h-3.5 rotate-90 text-[#006569]" />
          </div>
        </div>

      </section>

      {/* ========================================================================= */}
      {/* 3. LAYAR 3: PAS DI-SCROLL LAGI -> FORM TULIS & LIVE PREVIEW INSTAGRAM     */}
      {/* ========================================================================= */}
      <section id="form-section" className="min-h-screen py-16 sm:py-28 px-5 sm:px-8 lg:px-12 max-w-6xl mx-auto w-full border-t border-slate-100 relative z-10 flex flex-col justify-center">

        {/* Section Header */}
        <div className="text-center space-y-2 mb-8 sm:mb-12">
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
            Formulir &amp; Live Preview Menfess
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Ketik pesanmu di kiri dan lihat hasilnya langsung pada mockup feed Instagram di kanan.
          </p>
        </div>

        {/* MOBILE VIEW SWITCHER (Segmented control) */}
        <div className="lg:hidden grid grid-cols-2 p-1 bg-slate-200/90 rounded-2xl mb-8 border border-slate-300/70 shadow-inner">
          <button
            type="button"
            onClick={() => setMobileTab("form")}
            className={`py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mobileTab === "form"
                ? "bg-white text-[#006569] shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <PenTool className="w-3.5 h-3.5 text-[#006569]" />
            <span>Tulis Pesan</span>
            {message.trim().length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("preview")}
            className={`py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mobileTab === "preview"
                ? "bg-[#006569] text-[#FFDD00] shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview Post</span>
            <span className="font-mono text-[9.5px] bg-[#FFDD00] text-[#006569] px-1.5 py-0.2 rounded-full font-bold shrink-0">
              {slideCount}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ===================================================================== */}
          {/* LEFT COLUMN: THE FORM                                                 */}
          {/* ===================================================================== */}
          <div
            className={`lg:col-span-7 bg-white rounded-3xl p-5 sm:p-8 border border-slate-200 shadow-sm space-y-5 ${
              mobileTab === "form" ? "block" : "hidden lg:block"
            }`}
          >
            
            {/* Form Title & Top Controls */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Tulis Menfess / Uneg-Uneg
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    Pilih template postingan dan ketik pesanmu di bawah.
                  </p>
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-[#006569] bg-[#E6F4F1] px-2.5 py-1 rounded-full border border-[#006569]/20 shrink-0">
                  {slideCount} Slide IG
                </span>
              </div>

              {/* 1. TEMPLATE PICKER (Comic, UNJ Classic, Cyberpunk, Scrapbook) */}
              <div className="space-y-2">
                <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-[#006569]">
                  Pilih Template Instagram:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                  {TEMPLATES.map((tmpl) => {
                    const isSelected = selectedTemplate === tmpl.id;
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => setSelectedTemplate(tmpl.id)}
                        className={`p-2.5 sm:p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "bg-[#006569] text-white border-[#006569] shadow-sm shadow-[#006569]/25 scale-[1.01]"
                            : "bg-[#f8faf9] text-slate-800 border-slate-200/90 hover:border-[#006569]/40 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-base sm:text-lg">{tmpl.icon}</span>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-[#FFDD00] animate-pulse" />
                          )}
                        </div>
                        <div className="mt-1.5">
                          <span
                            className={`block font-extrabold text-[11.5px] sm:text-xs leading-tight ${
                              isSelected ? "text-white" : "text-slate-900"
                            }`}
                          >
                            {tmpl.name}
                          </span>
                          <span
                            className={`text-[9.5px] block mt-0.5 truncate ${
                              isSelected ? "text-[#FFDD00]" : "text-slate-400"
                            }`}
                          >
                            {tmpl.tag}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Daily Limit Notice Banner (When 15/15 posts reached) */}
            {queueInfo?.isDailyLimitReached && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/90 flex items-start gap-3 text-amber-900 text-xs animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-extrabold text-amber-950 text-xs sm:text-sm">
                    Kuota Upload Harian Instagram Telah Mencapai Batas ({queueInfo.todayPublishedCount}/{queueInfo.maxDailyPosts} Postingan)
                  </p>
                  <p className="text-amber-800 text-[11px] sm:text-xs leading-relaxed">
                    Batas aman 15 postingan/hari untuk akun Instagram telah tercapai hari ini. <b>Pesan baru tetap diterima dan masuk antrean</b> untuk otomatis diunggah besok sesuai urutan (dari yang terlama ke yang terbaru).
                  </p>
                </div>
              </div>
            )}

            {/* Success Box */}
            {successData && (
              <div className="p-5 rounded-2xl bg-[#E6F4F1] border-2 border-[#006569]/40 flex items-start gap-3.5 text-xs text-[#006569] animate-in fade-in shadow-sm">
                <CheckCircle2 className="w-6 h-6 text-[#006569] shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black text-sm sm:text-base text-slate-900">
                      Menfess Berhasil Masuk Antrean UNJ! (#{successData.id})
                    </p>
                    {typeof successData.queuePosition === "number" && (
                      <span className="bg-[#006569] text-[#FFDD00] font-black text-xs px-3 py-1 rounded-full shadow-sm">
                        Antrean ke-#{successData.queuePosition}
                      </span>
                    )}
                  </div>

                  {/* Queue Position Card */}
                  <div className="bg-white/90 rounded-xl p-3 border border-[#006569]/20 space-y-1">
                    <p className="font-extrabold text-xs text-[#006569] flex items-center gap-1.5">
                      <span>🏷️</span>
                      <span>
                        Posisi Antrean: <b>Antrean ke-{successData.queuePosition ?? 1}</b>
                        {typeof successData.pendingAhead === "number" && (
                          <span className="font-normal text-slate-600">
                            {" "}(ada {successData.pendingAhead} pesan lain di depanmu)
                          </span>
                        )}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Urutan posting diproses secara berurutan: <b>dari pesan yang terlama ke yang terbaru (FIFO)</b>.
                    </p>
                  </div>

                  {/* Daily Limit Info */}
                  {successData.isDailyLimitReached ? (
                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-300 text-amber-900 space-y-1">
                      <p className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                        <span>⚠️</span>
                        <span>Kuota Upload Instagram Hari Ini Penuh ({successData.todayPublishedCount ?? 15}/{successData.maxDailyPosts ?? 15})</span>
                      </p>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Pesanmu tetap <b>aman tersimpan di antrean</b> dan akan otomatis diunggah ke Instagram besok hari saat kuota harian dimulai kembali.
                      </p>
                    </div>
                  ) : (
                    <p className="text-slate-600 leading-relaxed text-xs">
                      Pesanmu akan diposting sebagai <b>{successData.slideCount} slide carousel</b> dengan template <b>{(successData.template || selectedTemplate).toUpperCase()}</b>.
                    </p>
                  )}

                  {typeof successData.remaining === "number" && (
                    <p className="font-mono text-[11px] font-bold text-[#006569]">
                      Sisa Kuota Sesi Anda: {successData.remaining} pesan lagi (Reset 10 menit)
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setSuccessData(null)}
                    className="text-[#006569] font-bold text-xs underline cursor-pointer pt-1 block"
                  >
                    Kirim pesan lain lagi →
                  </button>
                </div>
              </div>
            )}

            {/* Error Box */}
            {errorMsg && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-700 animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-rose-800">Perhatian</p>
                  <p className="mt-0.5 text-rose-600 text-xs">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Main Form Fields */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* To & From Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* To Field */}
                <div className="bg-[#f8faf9] rounded-2xl p-2.5 sm:p-3 px-3.5 sm:px-4 border border-slate-200 focus-within:border-[#006569] focus-within:bg-white transition">
                  <label htmlFor="to-input" className="block text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">
                    To (Penerima)
                  </label>
                  <input
                    id="to-input"
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="@crush / Kating FE / Si Dia"
                    className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
                  />
                  <span className="text-[9.5px] text-slate-400 block mt-0.5">
                    Opsional • Tercetak di poster IG
                  </span>
                </div>

                {/* From Field */}
                <div className="bg-[#f8faf9] rounded-2xl p-2.5 sm:p-3 px-3.5 sm:px-4 border border-slate-200 focus-within:border-[#006569] focus-within:bg-white transition">
                  <label htmlFor="from-input" className="block text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">
                    From (Samaran Publik)
                  </label>
                  <input
                    id="from-input"
                    type="text"
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                    placeholder="Secret Admirer / Maba UNJ"
                    className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
                  />
                  <span className="text-[9.5px] text-slate-400 block mt-0.5">
                    Alias samaran (identitasmu tetap rahasia)
                  </span>
                </div>
              </div>

              {/* Multi-Slide Authoring Header & Dynamic Slide Tabs (Auto-Split after 350 chars) */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="message-textarea" className="font-extrabold uppercase tracking-wider text-[10.5px] sm:text-[11px] text-slate-700 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#006569]" />
                      <span>Halaman Slide ({slideCount} Slide IG)</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] font-bold text-[#006569] bg-[#E6F4F1] px-2 py-0.5 rounded-full border border-[#006569]/20">
                      Otomatis 350 Karakter/Slide
                    </span>
                  </div>

                  {/* Insert manual slide break button */}
                  <button
                    type="button"
                    onClick={handleInsertSlideBreak}
                    title="Sisipkan pemisah slide manual (---slide---) di posisi kursor"
                    className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer border border-slate-300/70"
                  >
                    <Plus className="w-3 h-3 text-[#006569]" />
                    <span>Pisah Slide Manual</span>
                  </button>
                </div>

                {/* Auto Slide Badges & Preview Switcher */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {slides.map((sText, idx) => {
                    const isActive = previewSlideIdx === idx;
                    const charLen = sText.trim().length;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPreviewSlideIdx(idx)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-all ${
                          isActive
                            ? "bg-[#006569] text-white border-[#006569] shadow-sm shadow-[#006569]/30 scale-[1.02]"
                            : "bg-[#f8faf9] text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <span>Slide {idx + 1}</span>
                        <span
                          className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                            isActive
                              ? "bg-[#FFDD00] text-[#006569] font-black"
                              : "bg-slate-200/80 text-slate-600"
                          }`}
                        >
                          {charLen}/350
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message Textarea with Live Auto-Paging */}
              <div className="bg-[#f8faf9] rounded-2xl p-3 sm:p-3.5 px-3.5 sm:px-4 border border-slate-200 focus-within:border-[#006569] focus-within:bg-white transition space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold uppercase tracking-wider text-[10px] sm:text-[10.5px] text-slate-700">
                      Isi Pesan Menfess
                    </span>
                    {slideCount > 1 && (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.2 rounded border border-emerald-200">
                        Slide {previewSlideIdx + 1} aktif di preview
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10.5px]">
                    <span className="text-slate-400">Total: {message.length}/{MAX_CHARS}</span>
                  </div>
                </div>

                <textarea
                  ref={messageTextareaRef}
                  id="message-textarea"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ketik curhatan, uneg-uneg, salam kenal, atau pesan rahasiamu di sini... Jika pesanmu lebih dari 350 karakter, sistem akan OTOMATIS memotongnya menjadi slide baru rapi tanpa kata terpotong!"
                  className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none resize-none leading-relaxed"
                />

                {/* Auto-Slide Info / Helper Banner */}
                {slideCount > 1 ? (
                  <div className="p-2.5 rounded-xl bg-[#E6F4F1] border border-[#006569]/30 text-[#006569] text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#006569] shrink-0" />
                      <span className="text-[11px] font-semibold leading-tight">
                        Otomatis dibagi menjadi <b>{slideCount} Slide Carousel</b> (maks. 350 karakter/slide).
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={previewSlideIdx === 0}
                        onClick={() => setPreviewSlideIdx((prev) => Math.max(0, prev - 1))}
                        className="p-1 rounded bg-white border border-[#006569]/20 disabled:opacity-30 cursor-pointer text-[#006569]"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <span className="text-[10.5px] font-bold px-1 text-[#006569]">
                        {previewSlideIdx + 1}/{slideCount}
                      </span>
                      <button
                        type="button"
                        disabled={previewSlideIdx === slideCount - 1}
                        onClick={() => setPreviewSlideIdx((prev) => Math.min(slideCount - 1, prev + 1))}
                        className="p-1 rounded bg-white border border-[#006569]/20 disabled:opacity-30 cursor-pointer text-[#006569]"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
                    <span>✨ Otomatis membuat slide baru jika melebihi 350 karakter</span>
                    <span>{message.length} / 350 (Slide 1)</span>
                  </div>
                )}
              </div>

              {/* Mobile Quick Switcher to Preview */}
              <button
                type="button"
                onClick={() => setMobileTab("preview")}
                className="lg:hidden w-full p-3 rounded-2xl bg-[#E6F4F1] hover:bg-[#d4ede7] text-[#006569] border border-[#006569]/20 flex items-center justify-between transition cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-[#006569] text-[#FFDD00] flex items-center justify-center font-bold text-xs shrink-0">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="block font-black text-xs leading-none text-[#006569]">
                      Lihat Preview Instagram
                    </span>
                    <span className="text-[10.5px] text-slate-500 block mt-1">
                      {TEMPLATES.find((t) => t.id === selectedTemplate)?.name || "UNJ Classic"} • {slideCount} Slide
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[#006569] font-black text-xs bg-white px-3 py-1 rounded-full border border-[#006569]/20 shadow-2xs group-hover:translate-x-0.5 transition shrink-0">
                  <span>Buka</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>

              {/* Turnstile Container */}
              {turnstileSiteKey && (
                <div className="flex justify-center py-1">
                  <div ref={turnstileContainerRef} id="turnstile-widget" />
                </div>
              )}

              {/* Submit Button in Sunshine Yellow (#FFDD00) with Pine Teal (#006569) */}
              <button
                id="submit-menfess-btn"
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#FFDD00] hover:bg-[#ffe333] active:scale-[0.99] text-[#006569] font-black text-sm sm:text-base py-4 rounded-2xl shadow-lg shadow-[#FFDD00]/40 transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 border-2 border-[#006569]/10"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin text-[#006569]" />
                    <span>Mempersiapkan Postingan Menfess...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 text-[#006569]" />
                    <span>Kirim Menfess Sekarang</span>
                    <ArrowRight className="w-4 h-4 text-[#006569]" />
                  </>
                )}
              </button>

            </form>

          </div>

          {/* ===================================================================== */}
          {/* RIGHT COLUMN: LIVE INSTAGRAM POST PREVIEW                             */}
          {/* ===================================================================== */}
          <div
            className={`lg:col-span-5 space-y-4 ${
              mobileTab === "preview" ? "block" : "hidden lg:block"
            }`}
          >
            
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden sticky top-24">
              
              {/* Preview Header Bar */}
              <div className="p-3.5 px-5 bg-[#006569] text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FFDD00] animate-ping" />
                  <span className="font-black text-xs uppercase tracking-wider text-[#FFDD00]">
                    Live Preview IG Slide
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {slideCount > 1 && (
                    <span className="text-[11px] font-mono font-bold bg-white/20 px-2.5 py-0.5 rounded-full text-white">
                      Slide {previewSlideIdx + 1} / {slideCount}
                    </span>
                  )}
                  {/* Mobile Back Button */}
                  <button
                    type="button"
                    onClick={() => setMobileTab("form")}
                    className="lg:hidden text-[10px] font-black bg-[#FFDD00] text-[#006569] px-2.5 py-0.5 rounded-full cursor-pointer"
                  >
                    ← Form
                  </button>
                </div>
              </div>

              {/* Instagram Card Mockup */}
              <div className="p-3.5 sm:p-4 bg-slate-100/70">
                
                {/* IG Top Profile Header */}
                <div className="bg-white p-3 rounded-t-2xl border-x border-t border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#006569] text-[#FFDD00] flex items-center justify-center font-black text-xs border border-[#FFDD00]">
                      U
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-xs text-slate-900">unj_menfess</span>
                        <div className="w-3.5 h-3.5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[8px] font-bold">
                          ✓
                        </div>
                      </div>
                      <span className="text-[9.5px] text-slate-400 block -mt-0.5">Rawamangun, Jakarta</span>
                    </div>
                  </div>
                  <span className="text-slate-400 text-xs">•••</span>
                </div>

                {/* =============================================================== */}
                {/* DYNAMIC TEMPLATE SLIDE RENDERER (100% Matching Satori Output)   */}
                {/* =============================================================== */}
                <div className="aspect-square w-full rounded-b-2xl overflow-hidden border-x border-b border-slate-200 relative shadow-inner">
                  
                  {/* STYLE 1: UNJ EMERALD & GOLD CLASSIC (Official UNJ) */}
                  {selectedTemplate === "unj-classic" && (
                    <div
                      className="w-full h-full p-2.5 sm:p-3.5 flex flex-col justify-between text-white relative"
                      style={{
                        backgroundColor: "#006569",
                        backgroundImage: "linear-gradient(150deg, #005053 0%, #006569 45%, #00373a 100%)",
                      }}
                    >
                      {/* Inner Decorative Frame */}
                      <div className="w-full h-full border-2 border-[#FFDD00]/45 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between">
                        {/* Top Bar */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#00484b] border border-[#FFDD00] flex items-center justify-center text-[#FFDD00] font-black text-[10px]">
                              U
                            </div>
                            <div>
                              <span className="font-black text-[10px] sm:text-[11px] text-[#FFDD00] tracking-wider leading-none block">
                                UNJ MENFESS
                              </span>
                              <span className="text-[8px] text-[#D1FAE5] hidden sm:block">
                                Universitas Negeri Jakarta • Rawamangun
                              </span>
                            </div>
                          </div>
                          <span className="font-bold text-[8.5px] sm:text-[9.5px] bg-[#FFDD00] text-[#006569] px-2.5 py-0.5 rounded-full shadow-xs">
                            {slideCount > 1 ? `SLIDE ${previewSlideIdx + 1}/${slideCount}` : "OFFICIAL"}
                          </span>
                        </div>

                        {/* Center Card */}
                        <div className="bg-[#001a1c]/80 border border-[#FFDD00]/40 rounded-xl p-2.5 sm:p-3 my-1.5 sm:my-2 flex-1 flex flex-col justify-between overflow-hidden">
                          {/* Top Meta (Responsive pill badges without truncate/ellipsis) */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-[#FFDD00]/25 text-[11px] sm:text-xs">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <div className="flex items-center gap-1 bg-[#FFDD00] text-black px-2 py-0.5 rounded font-black text-[10px] sm:text-[11px] shrink-0">
                                <span>TO:</span>
                                <span className="font-bold text-slate-900">{recipient.trim() || "Anyone @ UNJ"}</span>
                              </div>
                              <div className="flex items-center gap-1 bg-[#006569] text-[#7eece4] border border-[#7eece4]/40 px-2 py-0.5 rounded font-black text-[10px] sm:text-[11px] shrink-0">
                                <span>FROM:</span>
                                <span className="font-bold text-[#D1FAE5]">{sender.trim() || "Secret Admirer"}</span>
                              </div>
                            </div>
                            <span className="text-[#FFDD00] font-serif text-lg leading-none opacity-80 shrink-0">“</span>
                          </div>

                          {/* Message Body (Auto-fitting without overflow or scrollbars) */}
                          <div className="my-auto py-2 flex-1 flex flex-col justify-center min-h-0 overflow-hidden">
                            <p className={`${getPreviewFontSize(currentPreviewText)} font-semibold text-white break-words whitespace-pre-line`}>
                              {currentPreviewText}
                            </p>
                          </div>

                          {/* Card Footer */}
                          <div className="pt-1 border-t border-white/15 flex items-center justify-between text-[8px] sm:text-[9px]">
                            <span className="text-[#94e8db] font-semibold">Suara Mahasiswa UNJ • #menfessunj</span>
                            <span className="text-[#FFDD00] font-serif text-sm leading-none opacity-80">”</span>
                          </div>
                        </div>

                        {/* Bottom Bar */}
                        <div className="flex items-center justify-between text-[8.5px] sm:text-[9.5px] font-bold">
                          <span className="text-[#D4ECE4]">UNJ MENFESS • RAWAMANGUN</span>
                          <span className="text-[#FFDD00]">@unj_menfess • 100% Anonim</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STYLE 2: COMIC POP-ART STYLE */}
                  {selectedTemplate === "comic" && (
                    <div
                      className="w-full h-full p-2.5 sm:p-3.5 flex flex-col justify-between text-slate-900 relative"
                      style={{
                        backgroundColor: "#FFDD00",
                        backgroundImage: "linear-gradient(135deg, #FFE53B 0%, #FFDD00 50%, #FFCC00 100%)",
                      }}
                    >
                      {/* Inner Frame */}
                      <div className="w-full h-full border-3 border-black rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between">
                        {/* Top Bar */}
                        <div className="flex items-center justify-between">
                          <div className="bg-[#006569] text-[#FFDD00] font-black text-[10px] sm:text-xs px-2.5 py-0.5 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] tracking-wider uppercase">
                            UNJ MENFESS!
                          </div>
                          <div className="bg-white text-black font-mono font-black text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md border-2 border-black shadow-[2px_2px_0px_#000]">
                            {slideCount > 1 ? `SLIDE ${previewSlideIdx + 1}/${slideCount}` : "POW!"}
                          </div>
                        </div>

                        {/* Center Card */}
                        <div className="bg-white border-2 border-black shadow-[3px_3px_0px_#000] rounded-xl p-2.5 sm:p-3 my-1.5 sm:my-2 flex-1 flex flex-col justify-between overflow-hidden">
                          {/* Top Meta (Responsive pill badges without truncate/ellipsis) */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b-2 border-black text-[11px] sm:text-xs">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <div className="flex items-center gap-1 bg-[#FFDD00] text-black px-2 py-0.5 rounded border-2 border-black font-black text-[10px] sm:text-[11px] shadow-[1px_1px_0px_#000] shrink-0">
                                <span>TO:</span>
                                <span className="font-black text-slate-900">{recipient.trim() || "Anyone @ UNJ"}</span>
                              </div>
                              <div className="flex items-center gap-1 bg-[#006569] text-white px-2 py-0.5 rounded border-2 border-black font-black text-[10px] sm:text-[11px] shadow-[1px_1px_0px_#000] shrink-0">
                                <span className="text-[#FFDD00]">FROM:</span>
                                <span className="font-extrabold text-white">{sender.trim() || "Secret Admirer"}</span>
                              </div>
                            </div>
                            <span className="bg-[#FFDD00] text-black font-black text-[9px] px-1.5 py-0.5 rounded border-2 border-black shrink-0">CONFESSION</span>
                          </div>

                          {/* Message Body */}
                          <div className="my-auto py-2 flex-1 flex flex-col justify-center min-h-0 overflow-hidden">
                            <p className={`${getPreviewFontSize(currentPreviewText)} font-black text-slate-900 break-words whitespace-pre-line`}>
                              {currentPreviewText}
                            </p>
                          </div>

                          {/* Card Footer */}
                          <div className="pt-1 border-t-2 border-black flex items-center justify-between text-[8px] sm:text-[9px] font-black">
                            <span className="text-[#006569]">#MENFESSUNJ SECRET CONFESSION</span>
                            <span>#UNJMenfess</span>
                          </div>
                        </div>

                        {/* Bottom Bar */}
                        <div className="flex items-center justify-between text-[8.5px] sm:text-[9.5px] font-black">
                          <span className="bg-[#006569] text-white px-2 py-0.5 rounded border border-black">
                            #MENFESSUNJ COMIC
                          </span>
                          <span className="bg-white text-black px-2 py-0.5 rounded border border-black">
                            {slideCount > 1 ? "SWIPE >>" : "UNJ RAWAMANGUN"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STYLE 3: CYBERPUNK Y2K RETRO TERMINAL */}
                  {selectedTemplate === "cyber" && (
                    <div
                      className="w-full h-full p-2.5 sm:p-3.5 flex flex-col justify-between text-[#FFDD00] font-mono relative"
                      style={{
                        backgroundColor: "#061214",
                        backgroundImage: "linear-gradient(135deg, #091f22 0%, #061214 60%, #020708 100%)",
                      }}
                    >
                      {/* Inner Frame */}
                      <div className="w-full h-full border border-[#008F94] rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between">
                        {/* Top Bar */}
                        <div className="flex items-center justify-between pb-1 border-b border-[#006569] text-[9.5px] sm:text-[10px]">
                          <span className="text-[#3ee8df] font-bold bg-[#00282b] px-2 py-0.5 rounded border border-[#008F94]">
                            [UNJ_TERMINAL]
                          </span>
                          <span className="text-slate-400">
                            {slideCount > 1 ? `SLIDE ${previewSlideIdx + 1}/${slideCount}` : "BROADCAST [OK]"}
                          </span>
                        </div>

                        {/* Center Card */}
                        <div className="bg-[#002428]/90 border border-[#3ee8df] rounded-xl p-2.5 sm:p-3 my-1.5 sm:my-2 flex-1 flex flex-col justify-between overflow-hidden">
                          {/* Top Meta (Responsive pill badges without truncate/ellipsis) */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-[#008F94] text-[11px] sm:text-xs font-mono">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <div className="flex items-center gap-1 bg-[#002428] border border-[#3ee8df] px-2 py-0.5 rounded text-[10px] sm:text-[11px] shrink-0">
                                <span className="text-[#3ee8df] font-bold">&gt; TARGET:</span>
                                <span className="text-white font-bold">{recipient.trim() || "UNKNOWN"}</span>
                              </div>
                              <div className="flex items-center gap-1 bg-[#002428] border border-[#FFDD00] px-2 py-0.5 rounded text-[10px] sm:text-[11px] shrink-0">
                                <span className="text-[#FFDD00] font-bold">&gt; SENDER:</span>
                                <span className="text-[#FFDD00] font-bold">{sender.trim() || "ENCRYPTED"}</span>
                              </div>
                            </div>
                            <span className="text-[#3ee8df] text-[9px] font-bold border border-[#008F94] px-1 rounded shrink-0">SECURE</span>
                          </div>

                          {/* Message Body */}
                          <div className="my-auto py-2 flex-1 flex flex-col justify-center min-h-0 overflow-hidden font-mono">
                            <span className="text-[#FFDD00] font-bold block mb-0.5 text-[8.5px]">
                              // MESSAGE_DECRYPTED:
                            </span>
                            <p className={`${getPreviewFontSize(currentPreviewText)} text-[#c2fff5] break-words whitespace-pre-line`}>
                              {currentPreviewText}
                            </p>
                          </div>

                          {/* Card Footer */}
                          <div className="pt-1 border-t border-[#008F94] flex items-center justify-between text-[8px]">
                            <span className="text-slate-400">PACKET_VERIFIED // HMAC-SHA256</span>
                            <span className="text-[#3ee8df] font-bold">CHANNEL_OPEN</span>
                          </div>
                        </div>

                        {/* Bottom Bar */}
                        <div className="flex items-center justify-between text-[8px] sm:text-[9px] text-slate-400 font-bold">
                          <span>CIPHER: HMAC-SHA256</span>
                          <span className="text-[#3ee8df]">@unj_menfess FEED</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STYLE 4: PASTEL SCRAPBOOK / POLAROID */}
                  {selectedTemplate === "scrapbook" && (
                    <div
                      className="w-full h-full p-2.5 sm:p-3.5 flex flex-col justify-between text-slate-800 relative"
                      style={{
                        backgroundColor: "#EBF5F0",
                        backgroundImage: "linear-gradient(135deg, #F3FAF6 0%, #EBF5F0 50%, #DEECE3 100%)",
                      }}
                    >
                      {/* Inner Frame */}
                      <div className="w-full h-full border border-dashed border-[#9fc4b5] rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between">
                        {/* Top Bar */}
                        <div className="flex items-center justify-between">
                          <div className="bg-[#FED7AA] text-[#7C2D12] font-black text-[9.5px] sm:text-[10.5px] px-2 py-0.5 rounded border border-[#FDBA74]">
                            UNJ CAMPUS NOTES
                          </div>
                          <span className="text-[9px] bg-white px-2 py-0.5 rounded-full border border-slate-300 font-mono text-[#006569] font-bold">
                            {slideCount > 1 ? `SLIDE ${previewSlideIdx + 1}/${slideCount}` : "Uneg-Uneg"}
                          </span>
                        </div>

                        {/* Center Card */}
                        <div className="bg-white rounded-xl p-2.5 sm:p-3 my-1.5 sm:my-2 border border-[#cbdad3] shadow-sm flex-1 flex flex-col justify-between overflow-hidden">
                          {/* Top Meta (Responsive pill badges without truncate/ellipsis) */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-dashed border-[#cbdad3] text-[11px] sm:text-xs">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <div className="flex items-center gap-1 bg-white border border-[#cbdad3] px-2 py-0.5 rounded text-[10px] sm:text-[11px] shrink-0">
                                <span className="text-slate-500 font-extrabold">Dear:</span>
                                <span className="font-black text-[#006569]">{recipient.trim() || "Anyone @ UNJ"}</span>
                              </div>
                              <div className="flex items-center gap-1 bg-[#EBF5F0] border border-[#9fc4b5] px-2 py-0.5 rounded text-[10px] sm:text-[11px] shrink-0">
                                <span className="text-slate-500 font-extrabold">From:</span>
                                <span className="font-bold text-slate-700">{sender.trim() || "Secret Admirer"}</span>
                              </div>
                            </div>
                            <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold shrink-0">NOTES</span>
                          </div>

                          {/* Message Body */}
                          <div className="my-auto py-2 flex-1 flex flex-col justify-center min-h-0 overflow-hidden">
                            <p className={`${getPreviewFontSize(currentPreviewText)} text-slate-800 break-words whitespace-pre-line font-medium`}>
                              {currentPreviewText}
                            </p>
                          </div>

                          {/* Card Footer */}
                          <div className="pt-1 border-t border-dashed border-[#cbdad3] flex items-center justify-between text-[8px] text-slate-500">
                            <span>Ditulis dengan tulus dari hati</span>
                            <span className="font-bold text-[#006569]">#menfessunj</span>
                          </div>
                        </div>

                        {/* Bottom Bar */}
                        <div className="flex items-center justify-between text-[8.5px] sm:text-[9.5px] text-slate-500 font-bold">
                          <span>UNJ MEMORIES</span>
                          <span className="text-[#006569]">#UNJMenfess</span>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Carousel Controller (if > 1 slide) */}
                {slideCount > 1 && (
                  <div className="mt-3 flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      disabled={previewSlideIdx === 0}
                      onClick={() => setPreviewSlideIdx((prev) => Math.max(0, prev - 1))}
                      className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {slides.map((_, i) => (
                        <div
                          key={i}
                          onClick={() => setPreviewSlideIdx(i)}
                          className={`h-2 rounded-full cursor-pointer transition-all ${
                            previewSlideIdx === i
                              ? "w-6 bg-[#006569]"
                              : "w-2 bg-slate-300 hover:bg-slate-400"
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={previewSlideIdx === slideCount - 1}
                      onClick={() => setPreviewSlideIdx((prev) => Math.min(slideCount - 1, prev + 1))}
                      className="px-3 py-1 rounded-lg bg-[#006569] text-white disabled:opacity-30 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* IG Action Likes & Comments Mock */}
                <div className="mt-3 bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-700">
                    <div className="flex items-center gap-3">
                      <Heart className="w-4 h-4 text-rose-500 fill-rose-500 cursor-pointer" />
                      <MessageCircle className="w-4 h-4 cursor-pointer" />
                      <Share2 className="w-4 h-4 cursor-pointer" />
                    </div>
                    <Bookmark className="w-4 h-4 cursor-pointer" />
                  </div>
                  <div className="text-[11px] text-slate-600 font-medium">
                    Disukai oleh <span className="font-bold text-slate-900">chirpy_unj</span> dan mahasiswa lainnya
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>

        {/* Scroll CTA Button & Prompt to Keunggulan & Footer */}
        <div className="pt-10 sm:pt-14 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => scrollToSection("keunggulan-section")}
            className="px-6 py-3 rounded-full bg-white/90 hover:bg-white text-[#006569] font-bold text-xs sm:text-sm border border-[#006569]/20 shadow-xs hover:shadow-md flex items-center gap-2 transition cursor-pointer group"
          >
            <span>Scroll ke Bawah: Keunggulan &amp; Footer</span>
            <ArrowDown className="w-4 h-4 text-[#006569] group-hover:translate-y-0.5 transition" />
          </button>
          <div
            onClick={() => scrollToSection("keunggulan-section")}
            className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold cursor-pointer animate-bounce mt-0.5"
          >
            <span>Scroll ke bawah untuk keunggulan</span>
            <ChevronRight className="w-3.5 h-3.5 rotate-90 text-[#006569]" />
          </div>
        </div>

      </section>

      {/* ========================================================================= */}
      {/* 4. LAYAR 4: KALO DI-SCROLL LAGI -> KEUNGGULAN DAN FOOTER                  */}
      {/* ========================================================================= */}
      <div id="keunggulan-section">
        {/* Keunggulan Content */}
        <section className="py-24 sm:py-36 border-t border-slate-100 bg-white relative z-10">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12">
            
            <div className="text-center space-y-2 mb-10 sm:mb-14">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#006569] bg-[#E6F4F1] px-4 py-1.5 rounded-full border border-[#006569]/20">
                Keamanan &amp; Kemudahan Layanan
              </span>
              <h3 className="text-2xl sm:text-4xl font-black text-slate-900">
                3 Keunggulan Utama UNJ Menfess
              </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto">
              Dibangun dengan standar keamanan privasi tertinggi agar seluruh civitas akademika UNJ dapat bercerita dengan nyaman.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            
            {/* KATEGORI 1: BEBAS TANPA LOGIN */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-[#006569]/20 shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300 space-y-4 relative overflow-hidden group">
              <div className="w-14 h-14 rounded-2xl bg-[#E6F4F1] text-[#006569] flex items-center justify-center font-black shadow-sm group-hover:scale-110 transition duration-300">
                <Zap className="w-7 h-7 text-[#006569]" />
              </div>
              <div className="space-y-1.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#006569] bg-[#E6F4F1] px-2.5 py-1 rounded-md">
                  100% Frictionless
                </span>
                <h4 className="text-lg font-black text-slate-900 pt-1">
                  Bebas Tanpa Login
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Tidak perlu membuat akun, menghafal password, atau memasukkan email. Siapapun mahasiswa UNJ bisa langsung menulis pesan dan mengirimkannya secara bebas.
                </p>
              </div>
            </div>

            {/* KATEGORI 2: ANTI-SPAM SESI AKTIF */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-[#FFDD00] shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300 space-y-4 relative overflow-hidden group">
              <div className="w-14 h-14 rounded-2xl bg-[#FFF9D6] text-amber-700 flex items-center justify-center font-black shadow-sm group-hover:scale-110 transition duration-300">
                <ShieldCheck className="w-7 h-7 text-amber-600" />
              </div>
              <div className="space-y-1.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-800 bg-[#FFF9D6] px-2.5 py-1 rounded-md border border-[#FFDD00]">
                  Kuota 3 Pesan / 10 Menit
                </span>
                <h4 className="text-lg font-black text-slate-900 pt-1">
                  Anti-Spam Sesi Aktif
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Perlindungan cerdas berbasis session cookie dan IP hash untuk membatasi flooding dan bot spam. Pesan diposting tertib dan adil bagi seluruh pengirim.
                </p>
              </div>
            </div>

            {/* KATEGORI 3: PRIVASI TERENKRIPSI */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-[#006569]/20 shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300 space-y-4 relative overflow-hidden group">
              <div className="w-14 h-14 rounded-2xl bg-[#E6F4F1] text-[#006569] flex items-center justify-center font-black shadow-sm group-hover:scale-110 transition duration-300">
                <Lock className="w-7 h-7 text-[#006569]" />
              </div>
              <div className="space-y-1.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#006569] bg-[#E6F4F1] px-2.5 py-1 rounded-md">
                  HMAC-SHA256 Salted
                </span>
                <h4 className="text-lg font-black text-slate-900 pt-1">
                  Privasi Terenkripsi
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Kredensial tersimpan aman di server, dan alamat IP pengirim di-hash dengan kunci rahasia. Identitas pengirim terjamin aman dan tidak dapat dilacak pihak luar.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. SECTION 4: FOOTER (JARAK LEGA DI BAGIAN BAWAH)                         */}
      {/* ========================================================================= */}
      <footer className="bg-white border-t border-[#006569]/15">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-16">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-slate-100">
            {/* Brand column */}
            <div className="md:col-span-6 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#006569] text-[#FFDD00] flex items-center justify-center font-black text-base shadow-sm">
                  U
                </div>
                <span className="font-black text-lg text-[#006569] tracking-wider uppercase">
                  UNJ MENFESS
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm leading-relaxed">
                Platform aspirasi dan suara bebas mahasiswa Universitas Negeri Jakarta (UNJ). Dilengkapi auto carousel Instagram, anti-spam cerdas, dan enkripsi privasi 100% anonim.
              </p>
            </div>

            {/* Quick Features */}
            <div className="md:col-span-3 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Fitur Unggulan
              </h4>
              <ul className="text-xs text-slate-500 space-y-1.5">
                <li>• Kategori Aspirasi Kampus &amp; Fasilitas</li>
                <li>• Template Comic Pop-Art &amp; UNJ Gold</li>
                <li>• Auto Slide Carousel hingga 5 Slide</li>
                <li>• Maskot Interaktif Chirpy UNJ</li>
                <li>• 100% Anonim Tanpa Login</li>
              </ul>
            </div>

            {/* Security */}
            <div className="md:col-span-3 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Keamanan &amp; Etika
              </h4>
              <ul className="text-xs text-slate-500 space-y-1.5">
                <li>• Salted HMAC-SHA256 IP Protection</li>
                <li>• Anti-Spam Kuota 3 Pesan / 10 Menit</li>
                <li>• Bijak dalam Menyampaikan Pesan</li>
                <li>• Menjaga Nama Baik Almamater UNJ</li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <p>© 2026 UNJ Menfess. Dibuat untuk seluruh civitas akademika Universitas Negeri Jakarta.</p>
            <div className="flex items-center gap-2 font-semibold text-[#006569]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFDD00] border border-[#006569]" />
              <span>Palet Resmi: Deep Pine Teal (#006569) &amp; Sunshine Gold (#FFDD00)</span>
            </div>
          </div>

        </div>
      </footer>

      </div>

    </div>
  );
}
