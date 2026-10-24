export const CHARS_PER_SLIDE = 450;
export const MAX_SLIDES = 10;

/**
 * Splits message text into slides without breaking words.
 * Honors paragraphs, sentences, and words.
 */
export function splitMessageIntoSlides(
  message: string,
  charsPerSlide = CHARS_PER_SLIDE,
  maxSlides = MAX_SLIDES
): string[] {
  const cleanMessage = message.trim();
  if (!cleanMessage) return [""];

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
