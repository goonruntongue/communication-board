"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Topic = {
  id: string;
  title: string;
  created_by: string;
  created_at: string;
};

export default function TopicsPage() {
  const router = useRouter();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);

  // --- 新規作成モーダル ---
  const [showCreateModal, setShowCreateModal] = useState(false);

  // --- 削除モーダル ---
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Topic | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 作成者ID → 表示名変換
  const displayName = (id: string) => {
    if (id === "katsu") return "勝";
    if (id === "kimi") return "竜";
    return id;
  };

  // 初回：トピック一覧取得
  useEffect(() => {
    fetchTopics();
  }, []);

  async function fetchTopics() {
    setLoading(true);
    const { data, error } = await supabase
      .from("topics")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setTopics(data);
    setLoading(false);
  }

  // 新規トピック作成
  async function createTopic() {
    if (!newTitle.trim()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const created_by = user.email?.split("@")[0] ?? "unknown";

    await supabase.from("topics").insert({
      title: newTitle,
      created_by,
    });

    setNewTitle("");
    setShowCreateModal(false);
    fetchTopics();
  }

  // 日付グループ化関数
  const groupByDate = (items: Topic[]) => {
    const groups: { [date: string]: Topic[] } = {};
    items.forEach((topic) => {
      const date = new Date(topic.created_at)
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, ".");
      if (!groups[date]) groups[date] = [];
      groups[date].push(topic);
    });
    return groups;
  };

  const grouped = useMemo(() => groupByDate(topics), [topics]);

  // --- 削除モーダルを開く ---
  function openDeleteModal(topic: Topic) {
    setDeleteTarget(topic);
    setDeletePassword("");
    setDeleteError(null);
    setShowDeleteModal(true);
  }

  // --- 削除処理（パス確認 → delete） ---
  async function confirmDelete() {
    if (!deleteTarget) return;
    if (!deletePassword) {
      setDeleteError("パスワードを入力してください");
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    // 1) ログイン中ユーザー取得
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user?.email) {
      setDeleteLoading(false);
      setDeleteError(
        "ログイン情報が取得できませんでした。再ログインしてください。"
      );
      return;
    }

    // 2) パスワード確認（再ログイン）
    const { error: loginErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: deletePassword,
    });

    if (loginErr) {
      setDeleteLoading(false);
      setDeleteError("パスワードが違います。");
      return;
    }

    // 3) 削除（RLSで「作成者のみ」許可される想定）
    const { error: delErr } = await supabase
      .from("topics")
      .delete()
      .eq("id", deleteTarget.id);

    setDeleteLoading(false);

    if (delErr) {
      // 例：RLSで弾かれた場合もここに来る
      setDeleteError(`削除できませんでした: ${delErr.message}`);
      return;
    }

    // 成功
    setShowDeleteModal(false);
    setDeleteTarget(null);
    setDeletePassword("");
    fetchTopics();
  }

  return (
    <main style={{ padding: 20, background: "#666", minHeight: "100vh" }}>
      {/* ヘッダー */}
      <header style={{ color: "#fff", textAlign: "center", fontSize: 20 }}>
        <img src="/images/topic-icon.svg" className="top-icon" alt="" />{" "}
        <span className="first-letter">T</span>opics
      </header>

      {/* 一覧 */}
      <div className="list-wrap">
        <div
          style={{
            background: "#ccc",
            padding: 20,
            borderRadius: 12,
            position: "relative",
          }}
        >
          {loading && <p>Loading...</p>}

          {!loading &&
            Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <div
                  style={{
                    background: "#fff",
                    display: "inline-block",
                    padding: "4px 10px",
                    borderRadius: 20,
                    marginBottom: 10,
                    fontSize: 13,
                  }}
                >
                  {date}
                </div>

                {items.map((topic) => (
                  <div
                    className="goto-topic"
                    key={topic.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      margin: "1em 0",
                      cursor: "pointer",
                    }}
                    onClick={() => router.push(`/topics/${topic.id}`)}
                  >
                    {/* 左：アイコン + タイトル */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        minWidth: 0,
                      }}
                    >
                      <img
                        src="/images/door-icon.svg"
                        alt=""
                        className="door"
                      />
                      <div
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {topic.title} | {displayName(topic.created_by)}
                      </div>
                    </div>

                    {/* 右：ゴミ箱（クリックしても遷移しないように stopPropagation） */}
                    <button
                      type="button"
                      className="del-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteModal(topic);
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: 6,
                      }}
                      aria-label="delete topic"
                      title="削除"
                    >
                      <img
                        src="/images/trash-can.svg"
                        alt=""
                        style={{ width: 22, height: 22, opacity: 0.9 }}
                      />
                    </button>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>

      {/* ＋ボタン */}
      <button
        onClick={() => setShowCreateModal(true)}
        style={{
          position: "fixed",
          bottom: 30,
          right: 30,
          width: 60,
          height: 60,
          borderRadius: 30,
          background: "#000",
          color: "#fff",
          fontSize: 30,
          border: "none",
        }}
      >
        +
      </button>

      {/* 新規作成モーダル */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "grid",
            placeItems: "center",
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 12,
              width: 300,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>新規トピックを作成</h3>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="トピック名を入力"
              style={{
                width: "100%",
                height: 40,
                marginTop: 10,
                padding: "0 10px",
              }}
            />
            <div style={{ marginTop: 15, textAlign: "right" }}>
              <button onClick={() => setShowCreateModal(false)}>
                キャンセル
              </button>
              <button onClick={createTopic} style={{ marginLeft: 10 }}>
                作成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除モーダル */}
      {showDeleteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "grid",
            placeItems: "center",
          }}
          onClick={() => {
            if (!deleteLoading) setShowDeleteModal(false);
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 12,
              width: 320,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 10 }}>このトピックを削除しますか？</h3>

            <div style={{ fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
              対象：<b>{deleteTarget?.title}</b>
              <br />
              削除するにはログイン中アカウントのパスワードを入力してください。
            </div>

            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="パスワード"
              style={{
                width: "100%",
                height: 40,
                padding: "0 10px",
              }}
              disabled={deleteLoading}
            />

            {deleteError && (
              <p style={{ color: "crimson", marginTop: 10, lineHeight: 1.4 }}>
                {deleteError}
              </p>
            )}

            <div
              style={{
                marginTop: 15,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
              >
                キャンセル
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteLoading}
                style={{
                  background: "#111",
                  color: "#fff",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                  opacity: deleteLoading ? 0.6 : 1,
                }}
              >
                {deleteLoading ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
