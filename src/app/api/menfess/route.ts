import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { menfess } from "@/lib/schema";
import { hashIp, checkSessionAndIpLimit } from "@/lib/ratelimit";
import { splitMessageIntoSlides } from "@/lib/slides";
import { getClientIp, parseDeviceType } from "@/lib/security";

export async function POST(request: NextRequest) {
  try {
    // 1. Extract Real Client IP (Spoof-resistant)
    const clientIp = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || "";
    const deviceType = parseDeviceType(userAgent);

    // 2. Extract or Generate Anonymous Anti-Spam Session ID
    let sessionId = request.cookies.get("menfess_session_id")?.value;
    let isNewSession = false;
    if (!sessionId || sessionId.length < 10) {
      sessionId = crypto.randomUUID();
      isNewSession = true;
    }

    // 3. Parse JSON Body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: "Permintaan data tidak valid." },
        { status: 400 }
      );
    }

    const { recipient, sender, message, turnstileToken, template } = body;

    // 4. Validate Message Content
    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { success: false, error: "Pesan menfess tidak boleh kosong." },
        { status: 400 }
      );
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 3000) {
      return NextResponse.json(
        {
          success: false,
          error: "Panjang pesan melebihi batas maksimal 3.000 karakter.",
        },
        { status: 400 }
      );
    }

    // 5. Anti-Spam Session & Hashed IP Rate Limiting (Free menfess, Max 3 per 10 mins)
    const hashedIp = hashIp(clientIp);
    const rateLimit = checkSessionAndIpLimit(sessionId, hashedIp, 3);

    if (!rateLimit.allowed) {
      const waitMinutes = Math.ceil(rateLimit.resetInSeconds / 60);
      return NextResponse.json(
        {
          success: false,
          error: `Batas anti-spam tercapai (maksimal 3 pesan per 10 menit). Silakan tunggu sekitar ${waitMinutes} menit lagi sebelum mengirim pesan berikutnya.`,
          remaining: 0,
          resetInSeconds: rateLimit.resetInSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimit.resetInSeconds.toString(),
          },
        }
      );
    }

    // 6. Cloudflare Turnstile CAPTCHA Verification (Optional layer if configured in .env)
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY?.trim();
    if (turnstileSecret) {
      if (!turnstileToken) {
        return NextResponse.json(
          { success: false, error: "Verifikasi CAPTCHA diperlukan." },
          { status: 400 }
        );
      }

      try {
        const formData = new URLSearchParams();
        formData.append("secret", turnstileSecret);
        formData.append("response", turnstileToken);
        formData.append("remoteip", clientIp);

        const verifyRes = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            body: formData,
          }
        );

        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          return NextResponse.json(
            { success: false, error: "Verifikasi CAPTCHA gagal. Silakan coba lagi." },
            { status: 400 }
          );
        }
      } catch (captchaErr) {
        console.error("Turnstile verification error:", captchaErr);
        return NextResponse.json(
          { success: false, error: "Terjadi kesalahan saat verifikasi CAPTCHA." },
          { status: 500 }
        );
      }
    }

    // 7. Calculate Slide Segmentation for Carousel (Max 10 slides)
    const slides = splitMessageIntoSlides(trimmedMessage);
    const slideCount = Math.min(slides.length, 10);

    // 8. Save Menfess to SQLite Queue (Raw IP encrypted via HMAC-SHA256)
    const selectedTemplate = ["comic", "unj-classic", "cyber", "scrapbook"].includes(template)
      ? template
      : "unj-classic";

    const [newMenfess] = await db
      .insert(menfess)
      .values({
        recipient: recipient?.trim() || null,
        sender: sender?.trim() || null, // Display alias on Instagram (e.g. Secret Admirer)
        message: trimmedMessage,
        status: "pending",
        slideCount,
        senderIp: hashedIp, // Encrypted salted hash to protect sender privacy and owner data
        senderDevice: `${deviceType} | template:${selectedTemplate}`,
        senderUserAgent: userAgent.slice(0, 300),
      })
      .returning();

    if (!newMenfess) {
      throw new Error("Menfess tidak dapat disimpan ke database.");
    }

    const response = NextResponse.json(
      {
        success: true,
        id: newMenfess.id,
        slideCount,
        remaining: rateLimit.remaining,
        resetInSeconds: rateLimit.resetInSeconds,
        message: "Pesan menfess berhasil dikirim dan masuk antrean posting!",
        data: {
          id: newMenfess.id,
          slideCount,
          createdAt: newMenfess.createdAt,
        },
      },
      { status: 201 }
    );

    // 9. Persist Session Cookie for Rate Limiting
    if (isNewSession || !request.cookies.get("menfess_session_id")) {
      response.cookies.set("menfess_session_id", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
    }

    return response;
  } catch (error) {
    console.error("Error creating menfess:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Terjadi kesalahan internal saat memproses pesan.",
      },
      { status: 500 }
    );
  }
}
