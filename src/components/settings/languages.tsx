import type { Language } from "@/server/settings/settings";

/** Drawn, not emoji: Windows has no flag emoji. */
function FlagBrazil({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 28 20" className={className} aria-hidden>
      <rect width="28" height="20" fill="#009c3b" />
      <path d="M14 2.5 25.5 10 14 17.5 2.5 10Z" fill="#ffdf00" />
      <circle cx="14" cy="10" r="4.6" fill="#002776" />
      <path d="M9.6 9.1c2.9-.6 6.1-.2 8.7 1.3" stroke="#fff" strokeWidth="0.8" fill="none" />
    </svg>
  );
}

function FlagUSA({ className }: { className: string }) {
  const stripes = Array.from({ length: 7 }, (_, i) => <rect key={i} y={(i * 2 * 20) / 13} width="28" height={20 / 13} fill="#b22234" />);
  return (
    <svg viewBox="0 0 28 20" className={className} aria-hidden>
      <rect width="28" height="20" fill="#fff" />
      {stripes}
      <rect width="11.2" height={(7 * 20) / 13} fill="#3c3b6e" />
    </svg>
  );
}

/** Each language is named in itself, so it reads right whatever the current language is. */
export const LANGUAGE_OPTIONS: { key: Language; label: string; region: string; Flag: (props: { className: string }) => React.ReactNode }[] = [
  { key: "en-US", label: "English", region: "United States", Flag: FlagUSA },
  { key: "pt-BR", label: "Português", region: "Brasil", Flag: FlagBrazil },
];
