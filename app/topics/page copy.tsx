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

  // ✅ ログイン中ユーザーの短縮ID（katsu / kimi）
  const [myId, setMyId] = useState<string | null>(null);

  // --- 新規作成モーダル ---
  const [showCreateModal, setShowCreateModal] = useState(false);

  // --- 削除モーダル ---
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Topic | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ✅ 編集モーダル ---
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Topic | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const displayName = (id: string) => {
    if (id === "katsu") return "Fanio";
    if (id === "kimi") return "Nantoka";
    return id;
  };

  // 初回：ログイン中ユーザーID取得 → トピック一覧取得
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const id = user?.email?.split("@")[0] ?? null; // katsu / kimi
      setMyId(id);

      fetchTopics();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchTopics() {
    setLoading(true);

    const { data, error } = await supabase
      .from("topics")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("取得に失敗: " + error.message);
      setLoading(false);
      return;
    }

    setTopics(data ?? []);
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

    const { error } = await supabase.from("topics").insert({
      title: newTitle.trim(),
      created_by,
    });

    if (error) {
      alert("作成に失敗: " + error.message);
      return;
    }

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

  // ✅ 編集モーダルを開く
  function openEditModal(topic: Topic) {
    setEditTarget(topic);
    setEditTitle(topic.title);
    setEditError(null);
    setShowEditModal(true);
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
      setDeleteError(`削除できませんでした: ${delErr.message}`);
      return;
    }

    setShowDeleteModal(false);
    setDeleteTarget(null);
    setDeletePassword("");
    fetchTopics();
  }

  // ✅ 更新処理（selectを付けて反映可否を確実に判定）
  async function confirmEdit() {
    if (!editTarget) return;

    const nextTitle = editTitle.trim();
    if (!nextTitle) {
      setEditError("タイトルを入力してください");
      return;
    }

    setEditLoading(true);
    setEditError(null);

    const { data, error } = await supabase
      .from("topics")
      .update({ title: nextTitle })
      .eq("id", editTarget.id)
      .select("id,title");

    setEditLoading(false);

    if (error) {
      console.error(error);
      setEditError("更新できませんでした: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      setEditError(
        "更新が反映されませんでした（RLS/権限の可能性）。SupabaseのUPDATEポリシーを確認してください。"
      );
      return;
    }

    // 画面側も即反映
    setTopics((prev) =>
      prev.map((t) => (t.id === editTarget.id ? { ...t, title: nextTitle } : t))
    );

    setShowEditModal(false);
    setEditTarget(null);
    setEditTitle("");
    setEditError(null);
  }

  return (
    <main style={{ padding: 20, background: "#666", minHeight: "100vh" }}>
      {/* ヘッダー */}
      <header style={{ color: "#fff", textAlign: "center", fontSize: 20 }}>
        <div className="header-inner">
          <img
            src="/images/back.svg"
            alt=""
            onClick={() => history.back()}
            className="backlink"
          />
          <img src="/images/topic-icon.svg" className="top-icon" alt="" />{" "}
          <span className="first-letter">T</span>opics
        </div>
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
                        {topic.title}{" "}
                        <span className={displayName(topic.created_by)}>
                          {displayName(topic.created_by)}
                        </span>
                      </div>
                    </div>

                    {/* ✅ 自分の投稿だけ：編集 + 削除 */}
                    {myId === topic.created_by && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <button
                          className="edit-btn"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(topic);
                          }}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            padding: "4px 4px 0",
                          }}
                          title="編集"
                        >
                          <img
                            src="/images/edit-icon.svg"
                            alt=""
                            style={{
                              width: 16,
                              height: 16,
                              opacity: 0.9,
                              filter: "invert(0)",
                            }}
                          />
                        </button>

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
                            style={{ width: 18, height: 18, opacity: 0.9 }}
                          />
                        </button>
                      </div>
                    )}
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

      {/* ✅ 編集モーダル */}
      {showEditModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "grid",
            placeItems: "center",
          }}
          onClick={() => {
            if (!editLoading) setShowEditModal(false);
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
            <h3 style={{ marginBottom: 10 }}>トピック名を編集</h3>

            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="新しいトピック名"
              style={{ width: "100%", height: 40, padding: "0 10px" }}
              disabled={editLoading}
            />

            {editError && (
              <p style={{ color: "crimson", marginTop: 10, lineHeight: 1.4 }}>
                {editError}
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
                onClick={() => setShowEditModal(false)}
                disabled={editLoading}
              >
                キャンセル
              </button>
              <button
                onClick={confirmEdit}
                disabled={editLoading}
                style={{
                  background: "#111",
                  color: "#fff",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                  opacity: editLoading ? 0.6 : 1,
                }}
              >
                {editLoading ? "更新中..." : "更新する"}
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
              style={{ width: "100%", height: 40, padding: "0 10px" }}
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
