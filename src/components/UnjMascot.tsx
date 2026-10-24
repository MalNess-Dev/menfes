"use client";

import React, { useState, useEffect, useRef } from "react";

interface UnjMascotProps {
  mood?: "idle" | "typing" | "happy" | "submitting";
  messageText?: string;
  recipientText?: string;
  onMascotClick?: () => void;
}

const UNJ_QUOTES = [
  "Hai anak UNJ! Mau titip salam atau curhat nih? 🐥💛",
  "Tarik & geser aku ke mana aja ya, aku bisa terbang! ✨",
  "Tenang, identitas aslimu aman terenkripsi rahasia! 🔒",
  "Salam buat anak FBS, FT, FMIPA, FIP, FIS, FE, FIK, FPPsi? 🎓",
  "Ketik panjang juga boleh, otomatis jadi carousel rapi! 📑",
  "Semoga crush kamu di kampus Rawamangun peka ya! 💛",
];

export default function UnjMascot({
  mood = "idle",
  messageText = "",
  recipientText = "",
  onMascotClick,
}: UnjMascotProps) {
  // Mascot screen position (fixed floating)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tilt, setTilt] = useState(0);
  const [scale, setScale] = useState(1);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [speechText, setSpeechText] = useState(UNJ_QUOTES[0]);
  const [showSpeech, setShowSpeech] = useState(true);

  // Eye pupil tracking
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });

  // Drag physics tracking
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const lastXRef = useRef(0);

  // Initialize initial position on mount (clearly visible, floating comfortably)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isMobile = window.innerWidth < 640;
      // Position clearly visible: mobile ~110px from right, desktop ~185px from right
      const defaultX = isMobile
        ? Math.max(15, window.innerWidth - 115)
        : Math.max(30, window.innerWidth - 190);
      const defaultY = isMobile
        ? Math.max(80, window.innerHeight - 195)
        : Math.max(100, window.innerHeight - 250);

      setPosition({ x: defaultX, y: defaultY });
      lastXRef.current = defaultX;
    }
  }, []);

  // Pupil eye tracking towards mouse
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!mascotRef.current) return;
      const rect = mascotRef.current.getBoundingClientRect();
      const mascotCenterX = rect.left + rect.width / 2;
      const mascotCenterY = rect.top + rect.height / 2;

      const deltaX = e.clientX - mascotCenterX;
      const deltaY = e.clientY - mascotCenterY;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance > 0) {
        const maxOffset = 4;
        const normalizedX = (deltaX / distance) * Math.min(distance / 50, maxOffset);
        const normalizedY = (deltaY / distance) * Math.min(distance / 50, maxOffset);
        setPupilOffset({ x: normalizedX, y: normalizedY });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Dynamic reactions to typing
  useEffect(() => {
    if (mood === "submitting") {
      setSpeechText("Bungkus surat menfessmu rapi-rapi... ⏳");
      setShowSpeech(true);
    } else if (mood === "happy") {
      setSpeechText("YAY! Menfess kamu masuk antrean IG! 🎉✨");
      setShowSpeech(true);
    } else if (messageText.trim().length > 450) {
      setSpeechText("Wah curhatannya panjang! Jadi carousel rapi nih! 📑");
      setShowSpeech(true);
    } else if (messageText.trim().length > 10) {
      setSpeechText("Lanjutin ngetik ya! Nanti aku antar ke IG~ 💌");
      setShowSpeech(true);
    } else if (recipientText.trim().length > 2) {
      setSpeechText(`Cieee, buat "${recipientText.trim()}" ya? 🤫💛`);
      setShowSpeech(true);
    }
  }, [messageText, recipientText, mood]);

  // Pointer drag handlers (touch & mouse)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!position) return;
    setIsDragging(true);
    setScale(1.08);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const deltaY = e.clientY - dragStartRef.current.mouseY;

    let newX = dragStartRef.current.startX + deltaX;
    let newY = dragStartRef.current.startY + deltaY;

    // Viewport bounds (safe bounds on mobile and desktop)
    const isMobile = window.innerWidth < 640;
    const maxX = window.innerWidth - (isMobile ? 85 : 105);
    const maxY = window.innerHeight - (isMobile ? 95 : 120);
    newX = Math.max(12, Math.min(newX, maxX));
    newY = Math.max(50, Math.min(newY, maxY));

    // Calculate drag velocity tilt
    const velocityX = newX - lastXRef.current;
    lastXRef.current = newX;
    const newTilt = Math.max(-16, Math.min(16, velocityX * 1.5));
    setTilt(newTilt);

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      setScale(1);
      setTilt(0);
      dragStartRef.current = null;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }
  };

  const handleClick = () => {
    if (!isDragging) {
      setQuoteIdx((prev) => (prev + 1) % UNJ_QUOTES.length);
      setSpeechText(UNJ_QUOTES[(quoteIdx + 1) % UNJ_QUOTES.length]);
      setShowSpeech(true);
      if (onMascotClick) onMascotClick();
    }
  };

  if (!position) return null;

  return (
    <div
      ref={mascotRef}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0px) rotate(${tilt}deg) scale(${scale})`,
        touchAction: "none",
        transition: isDragging ? "transform 0.05s ease-out" : "transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      }}
      className="fixed top-0 left-0 z-50 select-none cursor-grab active:cursor-grabbing flex flex-col items-center"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      title="Chirpy UNJ • Tarik & geser aku! Klik untuk ngobrol 🐥"
    >
      {/* Interactive Speech Bubble */}
      {showSpeech && (
        <div className="relative mb-2 bg-white/95 backdrop-blur-md border border-[#006569]/30 rounded-2xl p-2.5 px-3.5 shadow-xl text-[10.5px] sm:text-xs font-bold text-slate-800 max-w-[160px] sm:max-w-[200px] text-center pointer-events-auto cursor-pointer animate-bubble leading-snug">
          <p>{speechText}</p>
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-b border-r border-[#006569]/30 rotate-45" />
        </div>
      )}

      {/* Dragging Motion Dust/Stars (visible while dragging) */}
      {isDragging && (
        <div className="absolute -bottom-2 flex items-center gap-0.5 opacity-80 animate-pulse text-[10px]">
          <span className="text-[#FFDD00]">✦</span>
          <span>💨</span>
          <span className="text-[#FFDD00]">✦</span>
        </div>
      )}

      {/* PURE VECTOR SVG MASCOT — PROMINENT & CUTE (w-16 h-18 on mobile, w-20 sm:h-24 on desktop) */}
      <div className={`relative w-16 h-18 sm:w-20 sm:h-24 drop-shadow-[0_10px_22px_rgba(0,101,105,0.32)] group ${!isDragging ? "animate-float" : ""}`}>
        <svg
          viewBox="0 0 160 180"
          className="w-full h-full overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Body Teal Gradient */}
            <radialGradient id="tealGradCompact" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#008F94" />
              <stop offset="65%" stopColor="#006569" />
              <stop offset="100%" stopColor="#004548" />
            </radialGradient>

            {/* Belly Yellow Gradient */}
            <linearGradient id="yellowBellyCompact" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFF275" />
              <stop offset="100%" stopColor="#FFDD00" />
            </linearGradient>

            {/* Gold Shimmer */}
            <linearGradient id="goldCapCompact" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#004548" />
              <stop offset="50%" stopColor="#006569" />
              <stop offset="100%" stopColor="#008F94" />
            </linearGradient>

            <filter id="shadowFilterCompact" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#004548" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Feet */}
          <ellipse cx="62" cy="165" rx="12" ry="6" fill="#FFB703" />
          <ellipse cx="98" cy="165" rx="12" ry="6" fill="#FFB703" />

          {/* Tail Feathers */}
          <path d="M 28 120 C 10 125, 5 145, 20 152 C 30 148, 38 135, 38 122 Z" fill="#004548" />
          <path d="M 22 135 C 5 142, 5 158, 22 160 C 32 154, 38 142, 38 132 Z" fill="#FFDD00" />

          {/* Main Fluffy Round Body (#006569) */}
          <ellipse cx="80" cy="100" rx="55" ry="58" fill="url(#tealGradCompact)" filter="url(#shadowFilterCompact)" />

          {/* Cheeks Tuffs */}
          <path d="M 26 95 C 18 100, 16 110, 28 112 C 22 115, 20 124, 32 122 Z" fill="#008F94" />
          <path d="M 134 95 C 142 100, 144 110, 132 112 C 138 115, 140 124, 128 122 Z" fill="#008F94" />

          {/* Yellow Tummy (#FFDD00) */}
          <ellipse cx="80" cy="115" rx="36" ry="38" fill="url(#yellowBellyCompact)" />

          {/* Left Wing */}
          <path
            d="M 32 95 C 18 110, 22 135, 45 138 C 50 135, 48 115, 35 98 Z"
            fill="#006569"
            stroke="#004548"
            strokeWidth="1.5"
          />
          <path d="M 26 115 C 32 125, 40 130, 44 135" stroke="#FFDD00" strokeWidth="2.5" strokeLinecap="round" />

          {/* Right Wing */}
          <path
            d="M 128 95 C 142 110, 138 135, 115 138 C 110 135, 112 115, 125 98 Z"
            fill="#006569"
            stroke="#004548"
            strokeWidth="1.5"
          />
          <path d="M 134 115 C 128 125, 120 130, 116 135" stroke="#FFDD00" strokeWidth="2.5" strokeLinecap="round" />

          {/* Glowing Secret Love Letter Envelope in Hands */}
          <g transform="translate(56, 110)">
            <rect x="0" y="0" width="48" height="34" rx="4" fill="#FFFFFF" stroke="#006569" strokeWidth="1.5" />
            <path d="M 0 0 L 24 18 L 48 0" fill="none" stroke="#D4ECE4" strokeWidth="1.5" />
            <path d="M 0 34 L 18 14" stroke="#E2E8F0" strokeWidth="1" />
            <path d="M 48 34 L 30 14" stroke="#E2E8F0" strokeWidth="1" />
            <path
              d="M 24 16 C 24 12, 19 10, 19 14 C 19 17, 24 21, 24 21 C 24 21, 29 17, 29 14 C 29 10, 24 12, 24 16 Z"
              fill="#FF3366"
            />
          </g>

          {/* Rosy Cheeks */}
          <ellipse cx="50" cy="88" rx="8" ry="5" fill="#FF8DA1" opacity="0.75" />
          <ellipse cx="110" cy="88" rx="8" ry="5" fill="#FF8DA1" opacity="0.75" />

          {/* Left Eye */}
          <g transform="translate(58, 76)">
            <ellipse cx="0" cy="0" rx="13" ry="15" fill="#FFFFFF" stroke="#004548" strokeWidth="1.5" />
            <ellipse cx={pupilOffset.x} cy={pupilOffset.y} rx="9" ry="11" fill="#0F172A" />
            <circle cx={pupilOffset.x - 3} cy={pupilOffset.y - 4} r="3.5" fill="#FFFFFF" />
            <circle cx={pupilOffset.x + 3} cy={pupilOffset.y + 3} r="1.5" fill="#FFFFFF" />
            <path d="M -10 -12 Q -2 -17 8 -13" fill="none" stroke="#004548" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Right Eye */}
          <g transform="translate(102, 76)">
            <ellipse cx="0" cy="0" rx="13" ry="15" fill="#FFFFFF" stroke="#004548" strokeWidth="1.5" />
            <ellipse cx={pupilOffset.x} cy={pupilOffset.y} rx="9" ry="11" fill="#0F172A" />
            <circle cx={pupilOffset.x - 3} cy={pupilOffset.y - 4} r="3.5" fill="#FFFFFF" />
            <circle cx={pupilOffset.x + 3} cy={pupilOffset.y + 3} r="1.5" fill="#FFFFFF" />
            <path d="M -8 -13 Q 2 -17 10 -12" fill="none" stroke="#004548" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Cute Golden Beak (#FFDD00) */}
          <path
            d="M 72 82 Q 80 77 88 82 Q 80 97 72 82 Z"
            fill="#FFDD00"
            stroke="#D4A000"
            strokeWidth="1.5"
          />
          <path d="M 76 84 Q 80 88 84 84" fill="none" stroke="#E65100" strokeWidth="1.5" strokeLinecap="round" />

          {/* UNJ Collegiate Cap (Teal #006569 + Yellow Accent #FFDD00) */}
          <g transform="translate(80, 42)">
            <path
              d="M -34 10 C -32 -8, 32 -8, 34 10 Z"
              fill="url(#goldCapCompact)"
              stroke="#004548"
              strokeWidth="1.5"
            />
            <path
              d="M -38 10 C -20 18, 20 18, 38 10 C 30 16, -30 16, -38 10 Z"
              fill="#FFDD00"
              stroke="#D4A000"
              strokeWidth="1.5"
            />
            <path d="M -33 8 Q 0 13 33 8" fill="none" stroke="#FFDD00" strokeWidth="3" />
            <rect x="-14" y="-3" width="28" height="11" rx="3" fill="#FFDD00" />
            <text
              x="0"
              y="5.5"
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize="7.5"
              fontWeight="900"
              fill="#006569"
              textAnchor="middle"
            >
              UNJ
            </text>
          </g>

          {/* Feather tuft on top */}
          <path d="M 77 28 Q 74 15 80 12 Q 86 18 83 28 Z" fill="#FFDD00" />
        </svg>

        {/* Small Floating Pill on Hover */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#006569] text-[#FFDD00] text-[8.5px] font-black px-2 py-0.2 rounded-full shadow border border-[#FFDD00]/50 whitespace-nowrap opacity-90">
          Chirpy UNJ
        </div>
      </div>
    </div>
  );
}
