"use client";

import { useCallback, useEffect, useState } from "react";

type Busy = { label: string; percent: number };

// 一瞬で終わる処理（入力チェックで戻る、確認ダイアログでキャンセルする等）では出さない
const SHOW_AFTER_MS = 120;
// 100% になったことが見えるよう、終わってから少しだけ残す
const HOLD_DONE_MS = 320;

/** 画面中央に出す、進み具合つきの「処理中」表示。 */
export function BusyModal({ label, percent }: Busy) {
  return (
    <div className="busy-overlay" role="alertdialog" aria-modal="true">
      <div className="busy-card" aria-live="assertive">
        <div className="busy-label">{label}</div>
        <ProgressBar percent={percent} />
      </div>
    </div>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <>
      <div
        className="upload-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="upload-progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="upload-progress-text">{percent}%</div>
    </>
  );
}

/**
 * ページのデータを読み込んでいる間、その場所に出す表示。
 * 読み込みは途中経過を返さないので、％は目安（表示されている間、95% 手前までゆっくり進む）。
 */
export function PageLoading({ label = "読み込み中" }: { label?: string }) {
  const [percent, setPercent] = useState(8);

  useEffect(() => {
    const ticker = setInterval(() => {
      setPercent((p) => Math.min(95, Math.round(p + (96 - p) * 0.12)));
    }, 140);
    return () => clearInterval(ticker);
  }, []);

  return (
    <div className="page-loading" role="status">
      <div className="busy-label">{label}</div>
      <ProgressBar percent={percent} />
    </div>
  );
}

/**
 * サーバーとやり取りしている間、画面中央に「処理中」のモーダルを出す。
 *
 *   const { overlay, withBusy } = useBusyOverlay();
 *   <button onClick={() => withBusy("削除しています", confirmDelete)} />
 *   {overlay}
 *
 * Supabase などの呼び出しは途中経過を返さないので、％は実測ではなく目安。
 * 終わるまでは 95% 手前までゆっくり進み、終わった時点で 100% にする。
 */
export function useBusyOverlay() {
  const [busy, setBusy] = useState<Busy | null>(null);

  const withBusy = useCallback(
    async <T,>(label: string, task: () => Promise<T> | T): Promise<T> => {
      let ticker: ReturnType<typeof setInterval> | undefined;
      const opener = setTimeout(() => {
        setBusy({ label, percent: 6 });
        ticker = setInterval(() => {
          setBusy(
            (b) =>
              b && {
                ...b,
                percent: Math.min(
                  95,
                  Math.round(b.percent + (96 - b.percent) * 0.1),
                ),
              },
          );
        }, 120);
      }, SHOW_AFTER_MS);

      try {
        return await task();
      } finally {
        clearTimeout(opener);
        if (ticker) {
          clearInterval(ticker);
          setBusy((b) => b && { ...b, percent: 100 });
          await new Promise((resolve) => setTimeout(resolve, HOLD_DONE_MS));
        }
        setBusy(null);
      }
    },
    [],
  );

  const overlay = busy && <BusyModal {...busy} />;

  return { overlay, withBusy };
}
