export const CHARS_PER_SLIDE = 350;
export const MAX_SLIDES = 10;

/**
 * Splits message text into slides without breaking words whenever possible.
 * Supports explicit slide separators (---slide--- or \n---\n) or auto-splits by character count.
 * Honors paragraphs, sentences, and words. Capped at max 10 slides (Instagram carousel limit).
 * GUARANTEED: No single slide will exceed charsPerSlide (350 characters).
 */
export function splitMessageIntoSlides(
  message: string,
  charsPerSlide = CHARS_PER_SLIDE,
  maxSlides = MAX_SLIDES
): string[] {
  const cleanMessage = message.trim();
  if (!cleanMessage) return [""];

  // Internal helper to split any arbitrary text block into chunks <= charsPerSlide
  const splitBlock = (text: string, remainingSlots: number): string[] => {
    const trimmed = text.trim();
    if (!trimmed || remainingSlots <= 0) return [];
    if (trimmed.length <= charsPerSlide) return [trimmed];

    const chunks: string[] = [];
    const paragraphs = trimmed.split(/(\n\s*\n)/);
    let current = "";

    const addTokens = (para: string) => {
      const tokens = para.split(/(\s+)/);
      for (const token of tokens) {
        if (!token) continue;

        // If appending token exceeds limit, push current chunk
        if ((current + token).length > charsPerSlide && current.trim().length > 0) {
          chunks.push(current.trim());
          current = "";
          if (chunks.length >= remainingSlots) return;
        }

        // If a single unbroken token (e.g. very long URL or word) exceeds limit, force split
        if (token.length > charsPerSlide) {
          let remainder = token;
          while (remainder.length > charsPerSlide && chunks.length < remainingSlots) {
            chunks.push(remainder.slice(0, charsPerSlide));
            remainder = remainder.slice(charsPerSlide);
          }
          current = remainder;
          if (chunks.length >= remainingSlots) return;
        } else {
          current += token;
        }
      }
    };

    for (const part of paragraphs) {
      if (chunks.length >= remainingSlots) break;

      if ((current + part).length > charsPerSlide && current.trim().length > 0) {
        chunks.push(current.trim());
        current = "";
      }

      if (part.length > charsPerSlide) {
        addTokens(part);
      } else {
        current += part;
      }
    }

    if (current.trim() && chunks.length < remainingSlots) {
      chunks.push(current.trim());
    }

    return chunks;
  };

  // 1. Explicit multi-slide separator (e.g. ---slide--- or \n---\n)
  if (cleanMessage.includes("---slide---") || /\n\s*---\s*\n/.test(cleanMessage)) {
    const rawSegments = cleanMessage.includes("---slide---")
      ? cleanMessage.split(/---slide---/)
      : cleanMessage.split(/\n\s*---\s*\n/);

    const segments = rawSegments
      .map((seg) => seg.trim())
      .filter((seg) => seg.length > 0);

    const allSlides: string[] = [];
    for (const seg of segments) {
      if (allSlides.length >= maxSlides) break;
      const slotsLeft = maxSlides - allSlides.length;
      if (seg.length > charsPerSlide) {
        const sub = splitBlock(seg, slotsLeft);
        allSlides.push(...sub);
      } else {
        allSlides.push(seg);
      }
    }

    return allSlides.length > 0 ? allSlides.slice(0, maxSlides) : [""];
  }

  // 2. Auto-split standard text by character limit (350 chars/slide)
  const autoSlides = splitBlock(cleanMessage, maxSlides);
  return autoSlides.length > 0 ? autoSlides.slice(0, maxSlides) : [cleanMessage.slice(0, charsPerSlide)];
}
