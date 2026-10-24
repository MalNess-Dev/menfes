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
 * Remove or sanitize characters that are not in Inter.ttf (e.g. emojis)
 * to prevent missing-glyph boxes (tofu) from appearing on Instagram slides.
 */
function cleanTextForSatori(text: string): string {
  return text
    .replace(/[\uFE00-\uFE0F]/g, "")
    .replace(
      /([\uD800-\uDBFF][\uDC00-\uDFFF])|[\u2600-\u27BF\uE000-\uF8FF]/g,
      ""
    )
    .trim();
}

export type TemplateStyle = "comic" | "unj-classic" | "cyber" | "scrapbook";

export interface RenderSlideOptions {
  recipient?: string | null;
  sender?: string | null;
  messageText: string;
  slideIndex: number; // 1-based index (e.g. 1)
  totalSlides: number; // e.g. 3
  templateStyle?: TemplateStyle;
}

/**
 * Generates an SVG string using Satori and JSX according to chosen template style
 */
export async function generateSlideSvg(options: RenderSlideOptions): Promise<string> {
  const { recipient, sender, messageText, slideIndex, totalSlides, templateStyle = "unj-classic" } = options;
  const fontData = getFontBuffer();

  const isFirstSlide = slideIndex === 1;
  const cleanTo = cleanTextForSatori(recipient?.trim() || "") || "Anyone @ UNJ";
  const cleanFrom = cleanTextForSatori(sender?.trim() || "") || "Secret Admirer";
  const cleanMsg = cleanTextForSatori(messageText) || messageText;

  // Responsive typography scaling so short & long messages both fill the slide harmoniously
  const textLength = cleanMsg.length;
  let fontSize = 32;
  let lineHeight = 1.55;
  if (textLength < 80) {
    fontSize = 50;
    lineHeight = 1.45;
  } else if (textLength < 180) {
    fontSize = 40;
    lineHeight = 1.5;
  } else if (textLength < 320) {
    fontSize = 32;
    lineHeight = 1.55;
  } else {
    fontSize = 28;
    lineHeight = 1.5;
  }

  const slideIndicatorText = `SLIDE ${slideIndex} / ${totalSlides}`;

  // =========================================================================
  // 1. UNJ EMERALD & GOLD CLASSIC (#menfessunj: #006569 + #FFDD00)
  // =========================================================================
  if (templateStyle === "unj-classic") {
    const unjTree = React.createElement(
      "div",
      {
        style: {
          width: `${TEMPLATE_WIDTH}px`,
          height: `${TEMPLATE_HEIGHT}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#006569",
          backgroundImage: "linear-gradient(150deg, #005053 0%, #006569 45%, #00373a 100%)",
          color: "#FFFFFF",
          fontFamily: "Inter",
          padding: "38px",
          boxSizing: "border-box",
        },
      },
      // Inner Decorative Frame
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            border: "2px solid rgba(255, 221, 0, 0.45)",
            borderRadius: "32px",
            padding: "36px 44px",
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
          // Brand Cluster
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
              },
            },
            React.createElement(
              "div",
              {
                style: {
                  width: "48px",
                  height: "48px",
                  borderRadius: "24px",
                  backgroundColor: "#00484b",
                  border: "2px solid #FFDD00",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFDD00",
                  fontWeight: 900,
                  fontSize: "24px",
                },
              },
              "U"
            ),
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  marginLeft: "14px",
                },
              },
              React.createElement(
                "span",
                {
                  style: {
                    color: "#FFDD00",
                    fontWeight: 900,
                    fontSize: "21px",
                    letterSpacing: "0.06em",
                  },
                },
                "UNJ MENFESS"
              ),
              React.createElement(
                "span",
                {
                  style: {
                    color: "#D1FAE5",
                    fontSize: "13px",
                    fontWeight: 600,
                  },
                },
                "Universitas Negeri Jakarta • Rawamangun"
              )
            )
          ),
          // Slide / Confession Badge
          totalSlides > 1
            ? React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "#FFDD00",
                    color: "#006569",
                    padding: "8px 22px",
                    borderRadius: "9999px",
                    fontWeight: 900,
                    fontSize: "16px",
                  },
                },
                slideIndicatorText
              )
            : React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "#FFDD00",
                    color: "#006569",
                    padding: "8px 22px",
                    borderRadius: "9999px",
                    fontWeight: 900,
                    fontSize: "15px",
                    letterSpacing: "0.05em",
                  },
                },
                "OFFICIAL CONFESSION"
              )
        ),

        // Center Message Card (taking full height)
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              backgroundColor: "rgba(0, 26, 28, 0.78)",
              border: "2px solid rgba(255, 221, 0, 0.40)",
              borderRadius: "26px",
              padding: "36px 42px",
              margin: "24px 0",
              flexGrow: 1,
            },
          },
          // Header Row inside Card
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                borderBottom: "1px solid rgba(255, 221, 0, 0.25)",
                paddingBottom: "16px",
              },
            },
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  gap: "14px",
                  alignItems: "center",
                },
              },
              React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "rgba(255, 221, 0, 0.15)",
                    padding: "5px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 221, 0, 0.50)",
                  },
                },
                React.createElement(
                  "span",
                  {
                    style: {
                      color: "#FFDD00",
                      fontWeight: 900,
                      fontSize: "13px",
                      marginRight: "8px",
                    },
                  },
                  "TO:"
                ),
                React.createElement(
                  "span",
                  {
                    style: {
                      color: "#FFFFFF",
                      fontWeight: 800,
                      fontSize: "16px",
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
                    backgroundColor: "rgba(0, 101, 105, 0.50)",
                    padding: "5px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(126, 236, 228, 0.40)",
                  },
                },
                React.createElement(
                  "span",
                  {
                    style: {
                      color: "#7eece4",
                      fontWeight: 900,
                      fontSize: "13px",
                      marginRight: "8px",
                    },
                  },
                  "FROM:"
                ),
                React.createElement(
                  "span",
                  {
                    style: {
                      color: "#D1FAE5",
                      fontWeight: 700,
                      fontSize: "16px",
                    },
                  },
                  cleanFrom
                )
              )
            ),
            React.createElement(
              "span",
              {
                style: {
                  color: "#FFDD00",
                  fontSize: "46px",
                  fontWeight: 900,
                  lineHeight: 1,
                  opacity: 0.8,
                },
              },
              "“"
            )
          ),

          // Message Paragraph
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                flexGrow: 1,
                padding: "20px 0",
              },
            },
            React.createElement(
              "p",
              {
                style: {
                  fontSize: `${fontSize}px`,
                  lineHeight: `${lineHeight}`,
                  color: "#FFFFFF",
                  fontWeight: 600,
                  margin: 0,
                  letterSpacing: "0.01em",
                },
              },
              cleanMsg
            )
          ),

          // Card Footer Note
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid rgba(255, 255, 255, 0.15)",
                paddingTop: "14px",
                width: "100%",
              },
            },
            React.createElement(
              "span",
              {
                style: {
                  color: "#94e8db",
                  fontSize: "14px",
                  fontWeight: 600,
                },
              },
              "Suara Mahasiswa UNJ • #menfessunj"
            ),
            React.createElement(
              "span",
              {
                style: {
                  color: "#FFDD00",
                  fontSize: "36px",
                  fontWeight: 900,
                  lineHeight: 1,
                  opacity: 0.8,
                },
              },
              "”"
            )
          )
        ),

        // Bottom Bar
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
            "span",
            {
              style: {
                color: "#D4ECE4",
                fontSize: "14px",
                fontWeight: 800,
                letterSpacing: "0.06em",
              },
            },
            "UNJ MENFESS • RAWAMANGUN"
          ),
          React.createElement(
            "span",
            {
              style: {
                color: "#FFDD00",
                fontSize: "14px",
                fontWeight: 800,
              },
            },
            "@unj_menfess • 100% Anonim"
          )
        )
      )
    );

    return satori(unjTree, {
      width: TEMPLATE_WIDTH,
      height: TEMPLATE_HEIGHT,
      fonts: [{ name: "Inter", data: fontData, weight: 700, style: "normal" }],
    });
  }

  // =========================================================================
  // 2. COMIC POP-ART STYLE (Yellow #FFDD00 + Pine Teal #006569 + Chunky Black Borders)
  // =========================================================================
  if (templateStyle === "comic") {
    const comicTree = React.createElement(
      "div",
      {
        style: {
          width: `${TEMPLATE_WIDTH}px`,
          height: `${TEMPLATE_HEIGHT}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#FFDD00",
          backgroundImage: "linear-gradient(135deg, #FFE53B 0%, #FFDD00 50%, #FFCC00 100%)",
          color: "#0F172A",
          fontFamily: "Inter",
          padding: "36px",
          boxSizing: "border-box",
        },
      },
      // Inner Frame with Bold Black Outline
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            border: "5px solid #000000",
            borderRadius: "32px",
            padding: "34px 40px",
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
                backgroundColor: "#006569",
                padding: "12px 28px",
                borderRadius: "14px",
                border: "4px solid #000000",
                borderRight: "9px solid #000000",
                borderBottom: "9px solid #000000",
                color: "#FFDD00",
                fontWeight: 900,
                fontSize: "22px",
                letterSpacing: "0.08em",
              },
            },
            "UNJ MENFESS!"
          ),
          totalSlides > 1
            ? React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "#FFFFFF",
                    padding: "10px 24px",
                    borderRadius: "12px",
                    border: "3px solid #000000",
                    borderRight: "7px solid #000000",
                    borderBottom: "7px solid #000000",
                    fontSize: "17px",
                    fontWeight: 900,
                    color: "#000000",
                  },
                },
                slideIndicatorText
              )
            : React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "#FFFFFF",
                    padding: "8px 22px",
                    borderRadius: "10px",
                    border: "3px solid #000000",
                    borderRight: "6px solid #000000",
                    borderBottom: "6px solid #000000",
                    fontSize: "17px",
                    fontWeight: 900,
                    color: "#000000",
                  },
                },
                "POW!"
              )
        ),

        // Center Content (Full Height Comic Dialogue Box)
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              backgroundColor: "#FFFFFF",
              padding: "36px 42px",
              borderRadius: "26px",
              border: "5px solid #000000",
              borderRight: "14px solid #000000",
              borderBottom: "14px solid #000000",
              margin: "24px 0",
              flexGrow: 1,
            },
          },
          // Header inside panel
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                borderBottom: "3px solid #000000",
                paddingBottom: "14px",
              },
            },
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  gap: "14px",
                  alignItems: "center",
                },
              },
              React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                  },
                },
                React.createElement(
                  "span",
                  {
                    style: {
                      backgroundColor: "#FFDD00",
                      color: "#000000",
                      fontWeight: 900,
                      padding: "3px 10px",
                      borderRadius: "6px",
                      border: "2px solid #000000",
                      marginRight: "10px",
                      fontSize: "13px",
                    },
                  },
                  "TO:"
                ),
                React.createElement(
                  "span",
                  { style: { fontWeight: 900, color: "#0F172A", fontSize: "17px" } },
                  cleanTo
                )
              ),
              React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                  },
                },
                React.createElement(
                  "span",
                  {
                    style: {
                      backgroundColor: "#006569",
                      color: "#FFFFFF",
                      fontWeight: 900,
                      padding: "3px 10px",
                      borderRadius: "6px",
                      border: "2px solid #000000",
                      marginRight: "10px",
                      fontSize: "13px",
                    },
                  },
                  "FROM:"
                ),
                React.createElement(
                  "span",
                  { style: { fontWeight: 800, color: "#334155", fontSize: "17px" } },
                  cleanFrom
                )
              )
            ),
            React.createElement(
              "span",
              {
                style: {
                  backgroundColor: "#FFDD00",
                  color: "#000000",
                  fontWeight: 900,
                  fontSize: "13px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "2px solid #000000",
                },
              },
              "CONFESSION"
            )
          ),

          // Message Body
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                flexGrow: 1,
                padding: "20px 0",
              },
            },
            React.createElement(
              "p",
              {
                style: {
                  fontSize: `${fontSize}px`,
                  lineHeight: `${lineHeight}`,
                  color: "#0F172A",
                  fontWeight: 800,
                  margin: 0,
                },
              },
              cleanMsg
            )
          ),

          // Footer inside comic box
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "3px solid #000000",
                paddingTop: "12px",
                width: "100%",
              },
            },
            React.createElement(
              "span",
              {
                style: {
                  color: "#006569",
                  fontWeight: 900,
                  fontSize: "14px",
                  letterSpacing: "0.04em",
                },
              },
              "#MENFESSUNJ SECRET CONFESSION"
            ),
            React.createElement(
              "span",
              {
                style: {
                  color: "#000000",
                  fontWeight: 900,
                  fontSize: "13px",
                },
              },
              "#UNJMenfess"
            )
          )
        ),

        // Bottom Bar
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
            "span",
            {
              style: {
                backgroundColor: "#006569",
                color: "#FFFFFF",
                fontWeight: 900,
                fontSize: "15px",
                padding: "6px 16px",
                borderRadius: "8px",
                border: "2px solid #000000",
                letterSpacing: "0.06em",
              },
            },
            "#MENFESSUNJ COMIC EDITION"
          ),
          React.createElement(
            "span",
            {
              style: {
                backgroundColor: "#FFFFFF",
                color: "#000000",
                fontWeight: 900,
                fontSize: "15px",
                padding: "6px 16px",
                borderRadius: "8px",
                border: "2px solid #000000",
              },
            },
            totalSlides > 1 ? "SWIPE >>" : "UNJ RAWAMANGUN"
          )
        )
      )
    );

    return satori(comicTree, {
      width: TEMPLATE_WIDTH,
      height: TEMPLATE_HEIGHT,
      fonts: [{ name: "Inter", data: fontData, weight: 700, style: "normal" }],
    });
  }

  // =========================================================================
  // 3. CYBERPUNK Y2K TERMINAL STYLE (#061214 + #3ee8df + #FFDD00)
  // =========================================================================
  if (templateStyle === "cyber") {
    const cyberTree = React.createElement(
      "div",
      {
        style: {
          width: `${TEMPLATE_WIDTH}px`,
          height: `${TEMPLATE_HEIGHT}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#061214",
          backgroundImage: "linear-gradient(135deg, #091f22 0%, #061214 60%, #020708 100%)",
          color: "#FFDD00",
          fontFamily: "Inter",
          padding: "36px",
          boxSizing: "border-box",
        },
      },
      // Inner Frame
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            border: "2px solid #008F94",
            borderRadius: "26px",
            padding: "34px 42px",
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
                backgroundColor: "#00282b",
                padding: "10px 22px",
                borderRadius: "8px",
                border: "2px solid #008F94",
                color: "#3ee8df",
                fontWeight: 900,
                fontSize: "18px",
              },
            },
            "[UNJ_TERMINAL // SECURE_CHANNEL]"
          ),
          React.createElement(
            "div",
            {
              style: {
                fontSize: "15px",
                color: "#94a3b8",
                fontWeight: 800,
              },
            },
            totalSlides > 1 ? slideIndicatorText : "STATUS: 200 OK [BROADCAST]"
          )
        ),

        // Center Content (Terminal Output Box)
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              backgroundColor: "rgba(0, 36, 40, 0.88)",
              border: "2px solid #3ee8df",
              borderRadius: "20px",
              padding: "34px 40px",
              margin: "24px 0",
              flexGrow: 1,
            },
          },
          // Terminal Top Row
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                borderBottom: "1px solid #008F94",
                paddingBottom: "14px",
              },
            },
            React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  gap: "16px",
                  alignItems: "center",
                },
              },
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", fontSize: "16px" } },
                React.createElement(
                  "span",
                  { style: { color: "#94a3b8", fontWeight: 700, marginRight: "8px" } },
                  "> TARGET:"
                ),
                React.createElement(
                  "span",
                  { style: { fontWeight: 800, color: "#FFFFFF" } },
                  cleanTo
                )
              ),
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", fontSize: "16px" } },
                React.createElement(
                  "span",
                  { style: { color: "#94a3b8", fontWeight: 700, marginRight: "8px" } },
                  "> SENDER:"
                ),
                React.createElement(
                  "span",
                  { style: { fontWeight: 800, color: "#FFDD00" } },
                  cleanFrom
                )
              )
            ),
            React.createElement(
              "span",
              {
                style: {
                  color: "#3ee8df",
                  fontWeight: 900,
                  fontSize: "13px",
                },
              },
              "ENCRYPTED"
            )
          ),

          // Message Body
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                flexGrow: 1,
                padding: "20px 0",
              },
            },
            React.createElement(
              "span",
              {
                style: {
                  color: "#FFDD00",
                  fontWeight: 800,
                  fontSize: "14px",
                  marginBottom: "12px",
                },
              },
              "// MESSAGE_DECRYPTED:"
            ),
            React.createElement(
              "p",
              {
                style: {
                  fontSize: `${fontSize}px`,
                  lineHeight: `${lineHeight}`,
                  color: "#c2fff5",
                  fontWeight: 600,
                  margin: 0,
                },
              },
              cleanMsg
            )
          ),

          // Terminal Footer inside
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid #008F94",
                paddingTop: "12px",
                width: "100%",
                fontSize: "13px",
              },
            },
            React.createElement(
              "span",
              { style: { color: "#94a3b8", fontWeight: 700 } },
              "PACKET_VERIFIED // HMAC-SHA256"
            ),
            React.createElement(
              "span",
              { style: { color: "#3ee8df", fontWeight: 800 } },
              "CHANNEL_OPEN"
            )
          )
        ),

        // Bottom Bar
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
            "span",
            { style: { color: "#94a3b8", fontSize: "14px", fontWeight: 700 } },
            "CIPHER: HMAC-SHA256 • UNJ_ANON_NET"
          ),
          React.createElement(
            "span",
            { style: { color: "#3ee8df", fontSize: "14px", fontWeight: 800 } },
            "@unj_menfess • BROADCAST FEED"
          )
        )
      )
    );

    return satori(cyberTree, {
      width: TEMPLATE_WIDTH,
      height: TEMPLATE_HEIGHT,
      fonts: [{ name: "Inter", data: fontData, weight: 700, style: "normal" }],
    });
  }

  // =========================================================================
  // 4. PASTEL SCRAPBOOK / POLAROID STYLE (#EAF2EC + Soft Mint & Peach)
  // =========================================================================
  const scrapbookTree = React.createElement(
    "div",
    {
      style: {
        width: `${TEMPLATE_WIDTH}px`,
        height: `${TEMPLATE_HEIGHT}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#EBF5F0",
        backgroundImage: "linear-gradient(135deg, #F3FAF6 0%, #EBF5F0 50%, #DEECE3 100%)",
        color: "#1e293b",
        fontFamily: "Inter",
        padding: "36px",
        boxSizing: "border-box",
      },
    },
    // Inner Frame
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          border: "2px dashed #9fc4b5",
          borderRadius: "28px",
          padding: "34px 42px",
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
              backgroundColor: "#FED7AA",
              padding: "8px 22px",
              borderRadius: "6px",
              border: "1px solid #FDBA74",
              color: "#7C2D12",
              fontWeight: 900,
              fontSize: "17px",
              letterSpacing: "0.04em",
            },
          },
          "UNJ CAMPUS NOTES"
        ),
        React.createElement(
          "div",
          {
            style: {
              fontSize: "15px",
              color: "#475569",
              fontWeight: 700,
            },
          },
          totalSlides > 1 ? slideIndicatorText : "CATATAN MAHASISWA"
        )
      ),

      // Center Content (Polaroid Note Paper)
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            backgroundColor: "#FFFFFF",
            padding: "36px 42px",
            borderRadius: "24px",
            border: "2px solid #cbdad3",
            margin: "24px 0",
            flexGrow: 1,
          },
        },
        // Header inside note
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              borderBottom: "1px dashed #cbdad3",
              paddingBottom: "14px",
            },
          },
          React.createElement(
            "div",
            {
              style: {
                display: "flex",
                gap: "14px",
                alignItems: "center",
              },
            },
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", fontSize: "16px" } },
              React.createElement(
                "span",
                { style: { color: "#64748b", fontWeight: 700, marginRight: "8px" } },
                "Dear:"
              ),
              React.createElement(
                "span",
                { style: { fontWeight: 800, color: "#006569" } },
                cleanTo
              )
            ),
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", fontSize: "16px" } },
              React.createElement(
                "span",
                { style: { color: "#64748b", fontWeight: 700, marginRight: "8px" } },
                "From:"
              ),
              React.createElement(
                "span",
                { style: { fontWeight: 700, color: "#475569" } },
                cleanFrom
              )
            )
          ),
          React.createElement(
            "span",
            {
              style: {
                backgroundColor: "#E2E8F0",
                color: "#475569",
                fontWeight: 800,
                fontSize: "12px",
                padding: "4px 10px",
                borderRadius: "9999px",
              },
            },
            "MEMORIES"
          )
        ),

        // Message Body
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flexGrow: 1,
              padding: "20px 0",
            },
          },
          React.createElement(
            "p",
            {
              style: {
                fontSize: `${fontSize}px`,
                lineHeight: `${lineHeight}`,
                color: "#1e293b",
                fontWeight: 600,
                margin: 0,
              },
            },
            cleanMsg
          )
        ),

        // Footer inside note
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "1px dashed #cbdad3",
              paddingTop: "12px",
              width: "100%",
              fontSize: "13px",
            },
          },
          React.createElement(
            "span",
            { style: { color: "#64748b", fontWeight: 700 } },
            "Ditulis dengan tulus dari hati"
          ),
          React.createElement(
            "span",
            { style: { color: "#006569", fontWeight: 800 } },
            "#Menfessunj"
          )
        )
      ),

      // Bottom Bar
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
          "span",
          { style: { color: "#64748b", fontSize: "14px", fontWeight: 700 } },
          "UNJ MENFESS • RAWAMANGUN MEMORIES"
        ),
        React.createElement(
          "span",
          { style: { color: "#006569", fontSize: "14px", fontWeight: 900 } },
          "#UNJMenfess"
        )
      )
    )
  );

  return satori(scrapbookTree, {
    width: TEMPLATE_WIDTH,
    height: TEMPLATE_HEIGHT,
    fonts: [{ name: "Inter", data: fontData, weight: 700, style: "normal" }],
  });
}

/**
 * Converts a generated SVG string into a JPEG Buffer using resvg-js and Sharp.
 */
export async function renderSlideToJpeg(options: RenderSlideOptions): Promise<Buffer> {
  const svg = await generateSlideSvg(options);

  // Render SVG to raw PNG buffer using resvg-js (Rust-based, fast)
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: TEMPLATE_WIDTH,
    },
    font: {
      loadSystemFonts: false,
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
  message: string,
  templateStyle: TemplateStyle = "unj-classic"
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
      templateStyle,
    });
    buffers.push(buffer);
  }

  return buffers;
}
