"use client";

import { useEffect, useState } from "react";
import { MODE_STORAGE_KEY, THEME_STORAGE_KEY } from "@/lib/theme";

type SwitchProps = {
  on: boolean;
  icon: string;
  label: string;
  title: string;
  onToggle: () => void;
};

function Switch({ on, icon, label, title, onToggle }: SwitchProps) {
  return (
    <button
      type="button"
      className="theme-switch"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={title}
      onClick={onToggle}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="theme-switch-track">
        <span className="theme-switch-knob" />
      </span>
    </button>
  );
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できない環境では、その場だけ切り替わる
  }
}

/**
 * 見た目を切り替える2つの小さなスイッチ。
 *   ☾：ライト（標準）／ダーク         … <html data-mode="dark"> の有無
 *   ◐：ソフト（標準）／スキューモーフ … <html data-theme="skeuo"> の有無
 * どのスタイルが効くかは、app/css/theme-soft.css と theme-skeuo.css がこの2つの属性で決める。
 *
 * vertical を付けると縦並び（☾ が上）、付けなければ横並びになる。
 * ヘッダーに高さのある一覧では縦、高さのないトピックの中では横にして、ヘッダーを広げない。
 */
export default function ThemeSwitch({ vertical = false }: { vertical?: boolean }) {
  const [dark, setDark] = useState(false);
  const [skeuo, setSkeuo] = useState(false);

  // 表示前に layout 側のスクリプトが付けた状態を、スイッチの見た目に反映する
  useEffect(() => {
    setDark(document.documentElement.dataset.mode === "dark");
    setSkeuo(document.documentElement.dataset.theme === "skeuo");
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.dataset.mode = "dark";
    } else {
      delete document.documentElement.dataset.mode;
    }
    save(MODE_STORAGE_KEY, next ? "dark" : "light");
  };

  const toggleSkeuo = () => {
    const next = !skeuo;
    setSkeuo(next);
    if (next) {
      document.documentElement.dataset.theme = "skeuo";
    } else {
      delete document.documentElement.dataset.theme;
    }
    save(THEME_STORAGE_KEY, next ? "skeuo" : "soft");
  };

  return (
    <div className={vertical ? "switches vertical" : "switches"}>
      <Switch
        on={dark}
        icon="☾"
        label="ダークモードを切り替え"
        title={
          dark
            ? "ダークモード（押すとライトに戻す）"
            : "ライトモード（押すとダークにする）"
        }
        onToggle={toggleDark}
      />
      <Switch
        on={skeuo}
        icon="◐"
        label="テーマを切り替え"
        title={
          skeuo
            ? "テーマ：スキューモーフ（押すとソフトに戻す）"
            : "テーマ：ソフト（押すとスキューモーフにする）"
        }
        onToggle={toggleSkeuo}
      />
    </div>
  );
}
