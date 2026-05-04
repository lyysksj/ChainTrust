"use client";

import { useI18n } from "@/lib/i18n";

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div
      role="group"
      aria-label={t("lang.toggleAria")}
      className="lang-toggle"
    >
      <button
        type="button"
        className={`lang-toggle-btn ${lang === "en" ? "active" : ""}`}
        aria-pressed={lang === "en"}
        onClick={() => setLang("en")}
      >
        {t("lang.en")}
      </button>
      <span className="lang-toggle-sep">·</span>
      <button
        type="button"
        className={`lang-toggle-btn ${lang === "zh" ? "active" : ""}`}
        aria-pressed={lang === "zh"}
        onClick={() => setLang("zh")}
      >
        {t("lang.zh")}
      </button>
    </div>
  );
}
