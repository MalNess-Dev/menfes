import { NextRequest, NextResponse } from "next/server";
import { prisma, ensureWalMode } from "@/lib/prisma";
import { hashIp, checkRateLimit } from "@/lib/ratelimit";
import { splitMessageIntoSlides } from "@/lib/slides";

export async function POST(request: NextRequest) {
  try {
    await ensureWalMode();

    // 1. Extract and Hash IP for Rate Limiting
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const rawIp = (forwardedFor ? forwardedFor.split(",")[0] : realIp) || "127.0.0.1";
    const hashedIp = hashIp(rawIp);

    // 2. Check Rate Limit (3 messages / 10 minutes)
    const rateLimit = checkRateLimit(hashedIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak permintaan. Silakan coba lagi dalam ${Math.ceil(
            rateLimit.resetInSeconds / 60
          )} menit.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimit.resetInSeconds.toString(),
          },
        }
      );
    }

    // 3. Parse JSON Body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: "Permintaan tidak valid." },
        { status: 400 }
      );
    }

    const { recipient, sender, message, turnstileToken } = body;

    // 4. Validate Message
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

    // 5. Cloudflare Turnstile CAPTCHA Verification
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
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
        formData.append("remoteip", rawIp);

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

    // 6. Calculate Estimated Slides
    const slides = splitMessageIntoSlides(trimmedMessage);
    const slideCount = Math.min(slides.length, 10);

    // 7. Save to Database (Status: pending)
    const newMenfess = await prisma.menfess.create({
      data: {
        recipient: recipient?.trim() || null,
        sender: sender?.trim() || null,
        message: trimmedMessage,
        status: "pending",
        slideCount,
      },
    });

    return NextResponse.json(
      {
        success: true,
        id: newMenfess.id,
        slideCount,
        message: "Pesan menfess berhasil dikirim dan masuk antrean posting!",
        data: {
          id: newMenfess.id,
          slideCount,
          createdAt: newMenfess.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating menfess:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Terjadi kesalahan internal saat menyimpan pesan.",
      },
      { status: 500 }
    );
  }
}
