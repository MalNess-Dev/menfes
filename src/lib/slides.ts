export const CHARS_PER_SLIDE = 350;
export const MAX_SLIDES = 5;

/**
 * Splits message text into slides without breaking words.
 * Supports explicit slide separators (---slide--- or \n---\n) or auto-splits by character count.
 * Honors paragraphs, sentences, and words. Capped at max 5 slides.
 */
export function splitMessageIntoSlides(
  message: string,
  charsPerSlide = CHARS_PER_SLIDE,
  maxSlides = MAX_SLIDES
): string[] {
  const cleanMessage = message.trim();
  if (!cleanMessage) return [""];

  // 1. Explicit multi-slide separator (e.g. ---slide--- or \n---\n)
  if (cleanMessage.includes("---slide---") || /\n\s*---\s*\n/.test(cleanMessage)) {
    const rawSegments = cleanMessage.includes("---slide---")
      ? cleanMessage.split(/---slide---/)
      : cleanMessage.split(/\n\s*---\s*\n/);

    const segments = rawSegments
      .map((seg) => seg.trim())
      .filter((seg) => seg.length > 0);

    if (segments.length > 0) {
      return segments.slice(0, maxSlides);
    }
  }

  // 2. Auto-split if length exceeds charsPerSlide
  if (cleanMessage.length <= charsPerSlide) {
    return [cleanMessage];
  }

  const slides: string[] = [];
  const words = cleanMessage.split(/(\s+)/);
  let currentSlide = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if ((currentSlide + word).length > charsPerSlide && currentSlide.trim().length > 0) {
      slides.push(currentSlide.trim());
      currentSlide = word;

      if (slides.length >= maxSlides - 1) {
        const remaining = words.slice(i).join("");
        slides.push(remaining.trim());
        currentSlide = "";
        break;
      }
    } else {
      currentSlide += word;
    }
  }

  if (currentSlide.trim()) {
    slides.push(currentSlide.trim());
  }

  return slides.slice(0, maxSlides);
}
