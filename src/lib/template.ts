import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import React from "react";

import { splitMessageIntoSlides, CHARS_PER_SLIDE, MAX_SLIDES } from "./slides";

export { splitMessageIntoSlides, CHARS_PER_SLIDE, MAX_SLIDES };
export const TEMPLATE_WIDTH = 1080;
export const TEMPLATE_HEIGHT = 1080; // Standard 1:1 Instagram square

// Load font buffer for Satori
let fontBufferCache: Buffer | null = null;
function getFontBuffer(): Buffer {
  if (fontBufferCache) return fontBufferCache;
  const fontPath = path.join(process.cwd(), "public", "fonts", "Inter.ttf");
  if (fs.existsSync(fontPath)) {
    fontBufferCache = fs.readFileSync(fontPath);
    return fontBufferCache;
  }
  throw new Error(`Font file not found at: ${fontPath}`);
}

/**
 * Remove or sanitize characters that are not in Inter.ttf (e.g. color emojis)
 * to prevent missing-glyph boxes (tofu) from appearing on Instagram slides.
 */
function cleanTextForSatori(text: string): string {
  return text
    // Replace emoji variation selectors and modifiers
    .replace(/[\uFE00-\uFE0F]/g, "")
    // Remove emojis in surrogate pairs and common pictograph blocks
    .replace(
      /([\uD800-\uDBFF][\uDC00-\uDFFF])|[\u2600-\u27BF\uE000-\uF8FF]/g,
      ""
    )
    .trim();
}

export interface RenderSlideOptions {
  recipient?: string | null;
  sender?: string | null;
  messageText: string;
  slideIndex: number; // 1-based index (e.g. 1)
  totalSlides: number; // e.g. 3
}

/**
 * Generates an SVG string using Satori and JSX
 * Color scheme: dominant green #006569 (R0 G101 B105) with elegant dark modern aesthetics
 */
export async function generateSlideSvg(options: RenderSlideOptions): Promise<string> {
  const { recipient, sender, messageText, slideIndex, totalSlides } = options;
  const fontData = getFontBuffer();

  const isFirstSlide = slideIndex === 1;
  const cleanTo = cleanTextForSatori(recipient?.trim() || "") || "Anyone";
  const cleanFrom = cleanTextForSatori(sender?.trim() || "") || "Secret";
  const cleanMsg = cleanTextForSatori(messageText) || messageText;

  // Responsive font size based on text length to keep layout balanced
  const textLength = cleanMsg.length;
  let fontSize = 32;
  let lineHeight = 1.6;
  if (textLength < 120) {
    fontSize = 38;
    lineHeight = 1.65;
  } else if (textLength < 250) {
    fontSize = 33;
    lineHeight = 1.6;
  } else {
    fontSize = 28;
    lineHeight = 1.55;
  }

  // Modern Satori element tree — dominant #006569 (R0, G101, B105)
  const element = React.createElement(
    "div",
    {
      style: {
        width: `${TEMPLATE_WIDTH}px`,
        height: `${TEMPLATE_HEIGHT}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#050f11",
        backgroundImage:
          "radial-gradient(circle at 18% 18%, rgba(0, 101, 105, 0.45) 0%, transparent 55%), radial-gradient(circle at 82% 82%, rgba(0, 140, 130, 0.35) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(0, 70, 72, 0.20) 0%, transparent 70%)",
        color: "#ffffff",
        fontFamily: "Inter",
        padding: "76px 80px",
        boxSizing: "border-box",
      },
    },
    // Top Bar
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "10px",
            backgroundColor: "rgba(0, 101, 105, 0.35)",
            padding: "10px 22px",
            borderRadius: "9999px",
            border: "1px solid rgba(0, 180, 180, 0.45)",
          },
        },
        React.createElement(
          "span",
          {
            style: {
              color: "#3ee8df",
              fontSize: "18px",
              fontWeight: 700,
            },
          },
          "✦"
        ),
        React.createElement(
          "span",
          {
            style: {
              fontSize: "16px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "#ffffff",
              textTransform: "uppercase",
            },
          },
          "MENFESS"
        )
      ),
      totalSlides > 1
        ? React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                backgroundColor: "rgba(0, 101, 105, 0.30)",
                padding: "8px 18px",
                borderRadius: "9999px",
                border: "1px solid rgba(0, 180, 180, 0.35)",
                fontSize: "16px",
                fontWeight: 600,
                color: "#7eece4",
              },
            },
            `${slideIndex} / ${totalSlides}`
          )
        : null
    ),
    // Center Content Area
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          flexGrow: 1,
          justifyContent: "center",
          margin: "44px 0",
        },
      },
      // To & From on Slide 1
      isFirstSlide
        ? React.createElement(
            "div",
            {
              style: {
                display: "flex",
                flexWrap: "wrap",
                gap: "14px",
                marginBottom: "32px",
              },
            },
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "rgba(0, 101, 105, 0.35)",
                  border: "1px solid rgba(0, 190, 190, 0.50)",
                  borderRadius: "14px",
                  padding: "10px 22px",
                },
              },
              React.createElement(
                "span",
                {
                  style: {
                    color: "#4ee4db",
                    fontSize: "17px",
                    fontWeight: 700,
                    marginRight: "8px",
                  },
                },
                "To:"
              ),
              React.createElement(
                "span",
                {
                  style: {
                    color: "#ffffff",
                    fontSize: "19px",
                    fontWeight: 600,
                  },
                },
                cleanTo
              )
            ),
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "rgba(0, 50, 52, 0.40)",
                  border: "1px solid rgba(0, 140, 140, 0.40)",
                  borderRadius: "14px",
                  padding: "10px 22px",
                },
              },
              React.createElement(
                "span",
                {
                  style: {
                    color: "#80cbc4",
                    fontSize: "17px",
                    fontWeight: 700,
                    marginRight: "8px",
                  },
                },
                "From:"
              ),
              React.createElement(
                "span",
                {
                  style: {
                    color: "#ffffff",
                    fontSize: "19px",
                    fontWeight: 600,
                  },
                },
                cleanFrom
              )
            )
          )
        : null,
      // Message Box
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            backgroundColor: "rgba(7, 20, 22, 0.85)",
            border: "1.5px solid rgba(0, 140, 140, 0.32)",
            borderRadius: "28px",
            padding: "52px 48px",
            boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 101, 105, 0.15)",
          },
        },
        React.createElement(
          "p",
          {
            style: {
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight,
              fontWeight: 400,
              color: "#f8fafc",
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            },
          },
          cleanMsg
        )
      )
    ),
    // Bottom Footer
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid rgba(0, 160, 160, 0.20)",
          paddingTop: "24px",
          width: "100%",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            fontSize: "15px",
            color: "#6b9698",
            fontWeight: 500,
          },
        },
        "Pesan bersifat publik • Dikirim tanpa moderasi"
      ),
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "15px",
            color: "#4ee4db",
            fontWeight: 700,
          },
        },
        React.createElement("span", { style: { color: "#008f94" } }, "●"),
        "Simple IG Menfess"
      )
    )
  );

  const svg = await satori(element, {
    width: TEMPLATE_WIDTH,
    height: TEMPLATE_HEIGHT,
    fonts: [
      {
        name: "Inter",
        data: fontData,
        weight: 400,
        style: "normal",
      },
    ],
  });

  return svg;
}

/**
 * Converts a slide SVG into a final JPEG Buffer using Resvg and Sharp
 * Output is high quality JPEG ready for Instagram (1080x1080)
 */
export async function renderSlideToJpeg(options: RenderSlideOptions): Promise<Buffer> {
  const svg = await generateSlideSvg(options);
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: TEMPLATE_WIDTH,
    },
  });

  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  // Convert to JPEG format with Sharp
  const jpegBuffer = await sharp(pngBuffer)
    .jpeg({
      quality: 95,
      chromaSubsampling: "4:4:4",
    })
    .toBuffer();

  return jpegBuffer;
}

/**
 * Renders all slides for a given menfess into an array of JPEG buffers.
 */
export async function renderAllSlides(
  recipient: string | null | undefined,
  sender: string | null | undefined,
  message: string
): Promise<Buffer[]> {
  const slides = splitMessageIntoSlides(message);
  const totalSlides = slides.length;
  const buffers: Buffer[] = [];

  for (let i = 0; i < totalSlides; i++) {
    const buffer = await renderSlideToJpeg({
      recipient,
      sender,
      messageText: slides[i],
      slideIndex: i + 1,
      totalSlides,
    });
    buffers.push(buffer);
  }

  return buffers;
}
