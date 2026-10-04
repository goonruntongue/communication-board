"use client";

import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * 見た目のテーマを切り替える小さなスイッチ。
 *   オフ（標準）: ソフト          … app/css/theme-soft.css
 *   オン        : スキューモーフ  … app/css/theme-skeuo.css
 * <html data-theme="skeuo"> の有無で、どちらのスタイルシートが効くかが決まる。
 */
export default function ThemeSwitch() {
  const [skeuo, setSkeuo] = useState(false);

  // 表示前に layout 側のスクリプトが付けた状態を、スイッチの見た目に反映する
  useEffect(() => {
    setSkeuo(document.documentElement.dataset.theme === "skeuo");
  }, []);

  const toggle = () => {
    const next = !skeuo;
    setSkeuo(next);
    if (next) {
      document.documentElement.dataset.theme = "skeuo";
    } else {
      delete document.documentElement.dataset.theme;
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "skeuo" : "soft");
    } catch {
      // 保存できない環境では、その場だけ切り替わる
    }
  };

  return (
    <button
      type="button"
      className="theme-switch"
      role="switch"
      aria-checked={skeuo}
      aria-label="テーマを切り替え"
      title={
        skeuo
          ? "テーマ：スキューモーフ（押すとソフトに戻す）"
          : "テーマ：ソフト（押すとスキューモーフにする）"
      }
      onClick={toggle}
    >
      <span aria-hidden="true">◐</span>
      <span className="theme-switch-track">
        <span className="theme-switch-knob" />
      </span>
    </button>
  );
}
