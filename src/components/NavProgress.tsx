"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const START_EVENT = "cb:nav-start";
// 行き先が表示されないまま残り続けないよう、この時間で打ち切る
const GIVE_UP_MS = 12000;

/** ページ移動を始める直前に呼ぶ。画面上端のローディングバーが動き出す。 */
export function startNavProgress() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(START_EVENT));
  }
}

/**
 * ページを移動している間、画面の上端に細いローディングバーを出す。
 * 始まり: startNavProgress() が呼ばれたとき、またはブラウザの戻る／進むが押されたとき。
 * 終わり: 行き先のページに切り替わったとき（pathname が変わったとき）。
 * 移動の途中経過は取れないので、進み具合は目安。
 */
export default function NavProgress() {
  const pathname = usePathname();
  const [percent, setPercent] = useState<number | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const giveUp = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hide = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const finish = useCallback(() => {
    clearInterval(ticker.current);
    clearTimeout(giveUp.current);
    setPercent((p) => (p === null ? null : 100));
    hide.current = setTimeout(() => setPercent(null), 280);
  }, []);

  useEffect(() => {
    const start = () => {
      clearInterval(ticker.current);
      clearTimeout(giveUp.current);
      clearTimeout(hide.current);
      setPercent(12);
      ticker.current = setInterval(() => {
        setPercent((p) => (p === null ? p : Math.min(92, p + (94 - p) * 0.12)));
      }, 150);
      giveUp.current = setTimeout(finish, GIVE_UP_MS);
    };
    window.addEventListener(START_EVENT, start);
    window.addEventListener("popstate", start);
    return () => {
      window.removeEventListener(START_EVENT, start);
      window.removeEventListener("popstate", start);
      clearInterval(ticker.current);
      clearTimeout(giveUp.current);
      clearTimeout(hide.current);
    };
  }, [finish]);

  // 行き先のページが表示されたら、100% にして消す
  useEffect(() => {
    finish();
  }, [pathname, finish]);

  if (percent === null) return null;
  return (
    <div
      className="nav-progress"
      role="progressbar"
      aria-label="ページを読み込み中"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <div className="nav-progress-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}
