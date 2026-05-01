import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES, useI18n, type Lang } from "@/lib/i18n";
import { Globe } from "lucide-react";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();
  return (
    <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
      <SelectTrigger className={compact ? "h-8 w-[120px] text-xs" : "w-[160px]"}>
        <Globe className="h-3.5 w-3.5 mr-1 opacity-70" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map((l) => (
          <SelectItem key={l.code} value={l.code}>
            <span className="mr-2">{l.flag}</span>{l.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
