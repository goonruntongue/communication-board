"use client";

import { useRouter } from "next/navigation";

type Props = {
  className?: string;
  fallbackHref: string; // 戻れないときの遷移先
  alt?: string;
};

export default function BackButton({
  className,
  fallbackHref,
  alt = "",
}: Props) {
  const router = useRouter();

  const handleBack = () => {
    // 履歴があるなら戻る。なければフォールバックへ。
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back(); // history.back() 相当（Next推奨）
      return;
    }
    router.push(fallbackHref);
  };

  return (
    <img
      src="/images/back.svg"
      alt={alt}
      onClick={handleBack}
      className={className}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleBack();
      }}
    />
  );
}
