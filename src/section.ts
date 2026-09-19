export const SECTION_NAMES = [
  "intro",
  "call",
  "response",
  "march",
  "finale",
] as const;

export type SectionName = (typeof SECTION_NAMES)[number];

export type SectionMarker = {
  section: SectionName;
  time: number;
};

const sectionNames = new Set<string>(SECTION_NAMES);
const SECTION_PREFIX = "section:";

export function parseSectionMarker(text: string): SectionName | undefined {
  const normalizedText = text.trim().toLowerCase();
  if (!normalizedText.startsWith(SECTION_PREFIX)) {
    return undefined;
  }

  const section = normalizedText.slice(SECTION_PREFIX.length);
  return sectionNames.has(section) ? section as SectionName : undefined;
}
