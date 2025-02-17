const STYLE_OPTIONS = [
  "minimalist and modern",
  "vibrant and energetic",
  "professional and sleek",
  "tech-inspired and futuristic",
  "warm and inviting",
  "bold and dynamic",
  "clean and sophisticated",
  "creative and innovative"
];

export const getRandomStyle = (): string => {
  return STYLE_OPTIONS[Math.floor(Math.random() * STYLE_OPTIONS.length)];
}; 