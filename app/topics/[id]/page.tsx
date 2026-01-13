"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Topic = {
  id: string;
  title: string;
  created_by: string;
  created_at: string;
};

type CommentRow = {
  id: string;
  topic_id: string;
  body: string;
  created_by: string;
  created_at: string;
};

type FileRow = {
  id: string;
  topic_id: string;
  file_name: string;
  file_url: string;
  stored_name: string;
  created_by: string;
  created_at: string;
};

export default function TopicDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const topicId = params.id;

  const [topic, setTopic] = useState<Topic | null>(null);

  const [me, setMe] = useState<{
    email: string;
    userId: string;
    shortId: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);

  // comments
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [newBody, setNewBody] = useState("");
  const [sending, setSending] = useState(false);

  // ✅ コメント編集モーダル
  const [showEditCommentModal, setShowEditCommentModal] = useState(false);
  const [editTargetComment, setEditTargetComment] = useState<CommentRow | null>(
    null
  );
  const [editBody, setEditBody] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // files
  const [files, setFiles] = useState<FileRow[]>([]);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileUrl, setNewFileUrl] = useState("");
  const [fileBusy, setFileBusy] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);

  // file picker
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Drag UI
  const [dragOver, setDragOver] = useState(false);

  const displayName = (id: string) => {
    if (id === "katsu") return "勝";
    if (id === "kimi") return "竜";
    return id;
  };

  const headerTitle = useMemo(() => topic?.title ?? "Data", [topic]);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  async function init() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      router.push("/login");
      return;
    }

    const shortId = user.email.split("@")[0] ?? "unknown";
    setMe({ email: user.email, userId: user.id, shortId });

    const { data: topicData, error: topicErr } = await supabase
      .from("topics")
      .select("*")
      .eq("id", topicId)
      .single();

    if (topicErr || !topicData) {
      console.error(topicErr);
      setLoading(false);
      return;
    }
    setTopic(topicData);

    await Promise.all([fetchComments(), fetchFiles()]);

    setLoading(false);
  }

  async function fetchComments() {
    const { data, error } = await supabase
      .from("topic_comments")
      .select("*")
      .eq("topic_id", topicId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }
    setComments(data ?? []);

    requestAnimationFrame(() => {
      if (!listRef.current) return;
      listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }

  async function fetchFiles() {
    const { data, error } = await supabase
      .from("topic_files")
      .select("*")
      .eq("topic_id", topicId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }
    setFiles(data ?? []);
  }

  async function sendComment() {
    if (!me) return;
    if (!newBody.trim()) return;

    setSending(true);

    const { error } = await supabase.from("topic_comments").insert({
      topic_id: topicId,
      body: newBody.trim(),
      created_by: me.shortId,
    });

    setSending(false);

    if (error) {
      alert(error.message);
      return;
    }

    setNewBody("");
    fetchComments();
  }

  async function deleteComment(commentId: string) {
    const ok = confirm("このコメントを削除しますか？");
    if (!ok) return;

    const { error } = await supabase
      .from("topic_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      alert(error.message);
      return;
    }
    fetchComments();
  }

  // ✅ コメント編集モーダルを開く
  function openEditCommentModal(c: CommentRow) {
    setEditTargetComment(c);
    setEditBody(c.body);
    setEditError(null);
    setShowEditCommentModal(true);
  }

  // ✅ コメント更新
  async function confirmEditComment() {
    if (!editTargetComment) return;

    const nextBody = editBody.trim();
    if (!nextBody) {
      setEditError("本文を入力してください");
      return;
    }

    setEditLoading(true);
    setEditError(null);

    // 成功/失敗を判定しやすいように select を付ける
    const { data, error } = await supabase
      .from("topic_comments")
      .update({ body: nextBody })
      .eq("id", editTargetComment.id)
      .select("id,body");

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

    // ✅ 画面即反映
    setComments((prev) =>
      prev.map((x) =>
        x.id === editTargetComment.id ? { ...x, body: nextBody } : x
      )
    );

    setShowEditCommentModal(false);
    setEditTargetComment(null);
    setEditBody("");
    setEditError(null);
  }

  // URL登録でファイルを増やす
  async function addFileByUrl() {
    if (!me) return;
    if (!newFileName.trim() || !newFileUrl.trim()) return;

    setFileBusy(true);

    const { error } = await supabase.from("topic_files").insert({
      topic_id: topicId,
      file_name: newFileName.trim(),
      file_url: newFileUrl.trim(),
      created_by: me.shortId,
    });

    setFileBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    setNewFileName("");
    setNewFileUrl("");
    setShowUrlModal(false);
    fetchFiles();
  }

  async function deleteFile(fileId: string) {
    const ok = confirm(
      "このファイルを削除しますか？（サーバー上の実ファイルも消えます）"
    );
    if (!ok) return;

    const target = files.find((f) => f.id === fileId);
    if (!target) return;

    const res = await fetch("/api/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stored_name: target.stored_name }),
    });

    const json = await res.json();
    if (!res.ok || !json.ok) {
      alert("サーバー側の削除に失敗: " + (json.error ?? "unknown"));
      return;
    }

    const { error } = await supabase
      .from("topic_files")
      .delete()
      .eq("id", fileId);

    if (error) {
      alert("Supabase側の削除に失敗: " + error.message);
      return;
    }

    fetchFiles();
  }

  async function handlePickedFile(file: File) {
    if (!me) return;

    try {
      setFileBusy(true);

      const fd = new FormData();
      fd.append("file", file);

      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const upJson = await upRes.json();

      if (!upRes.ok || !upJson?.ok) {
        alert(upJson?.error ?? "upload failed");
        return;
      }

      const storedName: string = upJson.stored_name;

      const fileUrl = `https://promiseasync.sakura.ne.jp/communication-board/endpoint/download.php?name=${encodeURIComponent(
        storedName
      )}`;

      const originalNameFromServer = upJson.file_name ?? file.name;

      const { error } = await supabase.from("topic_files").insert({
        topic_id: topicId,
        file_name: originalNameFromServer,
        file_url: fileUrl,
        stored_name: storedName,
        created_by: me.shortId,
      });

      if (error) {
        alert(error.message);
        return;
      }

      fetchFiles();
    } finally {
      setFileBusy(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    handlePickedFile(file);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    handlePickedFile(file);
    e.target.value = "";
  }

  function onKeyDownSend(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendComment();
    }
  }

  async function downloadFile(fileUrlOrName: string, fileName: string) {
    let name = fileUrlOrName;

    if (fileUrlOrName.includes("name=")) {
      try {
        const u = new URL(fileUrlOrName);
        name = u.searchParams.get("name") || fileUrlOrName;
      } catch {}
    }

    const res = await fetch(
      `/api/download?name=${encodeURIComponent(
        name
      )}&filename=${encodeURIComponent(fileName || "download")}`
    );

    if (!res.ok) {
      const t = await res.text();
      alert("ダウンロード失敗: " + t);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ background: "#666", minHeight: "100vh" }}>
      <header style={{ color: "#fff", textAlign: "center", fontSize: 20 }}>
        <div className="header-inner">
          <img
            src="/images/back.svg"
            alt=""
            onClick={() => history.back()}
            className="backlink"
            style={{ cursor: "pointer" }}
          />
          <img
            src="/images/data-icon.svg"
            alt=""
            style={{ width: 32, height: 32 }}
          />
          <span className="first-letter">D</span>ata
        </div>
      </header>

      <div
        className="header-title-pill"
        style={{
          display: "grid",
          placeItems: "center",
          padding: "18px 12px 8px",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 999,
            padding: "6px 20px",
            fontSize: 14,
            minWidth: 140,
            textAlign: "center",
          }}
        >
          {headerTitle}
        </div>
      </div>

      {loading && (
        <div style={{ color: "#fff", textAlign: "center", padding: 20 }}>
          Loading...
        </div>
      )}

      {!loading && (
        <div
          style={{
            maxWidth: 1000,
            margin: "0 auto",
            padding: 14,
            display: "grid",
            gap: 14,
            gridTemplateColumns: "1fr",
          }}
          className="topic-detail-grid"
        >
          {/* LEFT: comments */}
          <section
            className="left"
            style={{ background: "#8a8a8a", borderRadius: 12, padding: 12 }}
          >
            <div
              className="board"
              ref={listRef}
              style={{
                background: "#bdbdbd",
                borderRadius: 10,
                padding: 10,
                height: 260,
                overflow: "auto",
              }}
            >
              {comments.length === 0 && (
                <div style={{ color: "#333", opacity: 0.8 }}>
                  まだコメントがありません
                </div>
              )}

              {comments.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: "10px 8px",
                    borderBottom: "1px solid rgba(0,0,0,0.25)",
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <img
                      src="/images/user-icon.svg"
                      alt=""
                      style={{ width: 24, height: 24 }}
                    />
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                      {displayName(c.created_by)}
                      <span
                        style={{
                          fontWeight: 400,
                          marginLeft: 10,
                          fontSize: 12,
                        }}
                      >
                        {new Date(c.created_at)
                          .toISOString()
                          .slice(0, 10)
                          .replace(/-/g, ".")}
                      </span>
                    </div>

                    {/* ✅ 自分のコメントだけ 編集 + 削除 */}
                    {me?.shortId === c.created_by && (
                      <div
                        style={{ marginLeft: "auto", display: "flex", gap: 6 }}
                      >
                        {/* 編集 */}
                        <button
                          className="edit-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditCommentModal(c);
                          }}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            opacity: 0.85,
                            padding: "2px 4px 0",
                          }}
                          title="編集"
                        >
                          <img
                            src="/images/edit-icon.svg"
                            alt="edit"
                            style={{ width: 16, height: 16 }}
                          />
                        </button>

                        {/* 削除 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteComment(c.id);
                          }}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            opacity: 0.85,
                            padding: 4,
                          }}
                          title="削除"
                        >
                          <img
                            src="/images/trash-can.svg"
                            alt="delete"
                            style={{ width: 18, height: 18 }}
                          />
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>{c.body}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 10,
                alignItems: "flex-end",
              }}
            >
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                onKeyDown={onKeyDownSend}
                placeholder="ここにコメントを入力"
                style={{
                  width: "100%",
                  minHeight: 90,
                  resize: "none",
                  borderRadius: 8,
                  border: "none",
                  padding: 12,
                  fontSize: 14,
                  outline: "none",
                  backgroundColor: "#fff",
                }}
              />
              <button
                onClick={sendComment}
                disabled={sending || !newBody.trim()}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 10,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  opacity: sending ? 0.6 : 1,
                }}
                title="送信"
              >
                <img
                  src="/images/send.svg"
                  alt="send"
                  style={{ width: 40, height: 40 }}
                />
              </button>
            </div>
          </section>

          {/* RIGHT: files（あなたのまま） */}
          <section className="right" style={{ display: "grid", gap: 14 }}>
            <div
              style={{ background: "#8a8a8a", borderRadius: 12, padding: 12 }}
            >
              <div
                style={{ background: "#bdbdbd", borderRadius: 10, padding: 10 }}
              >
                <div
                  style={{
                    background: "#dcdcdc",
                    borderRadius: 8,
                    padding: "8px 10px",
                    textAlign: "center",
                    fontWeight: 700,
                    marginBottom: 10,
                  }}
                >
                  DATA
                </div>

                {files.length === 0 && (
                  <div style={{ opacity: 0.85 }}>まだファイルがありません</div>
                )}

                <div style={{ display: "grid", gap: 10 }}>
                  {files.map((f) => (
                    <div
                      key={f.id}
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <button
                        onClick={() => downloadFile(f.file_url, f.file_name)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          textDecoration: "none",
                          color: "#000",
                          flex: 1,
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                        title="ダウンロード"
                      >
                        <img
                          src="/images/folder.svg"
                          alt=""
                          style={{ width: 50, height: 50 }}
                        />
                        <div style={{ display: "grid" }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>
                            {f.file_name}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>
                            {displayName(f.created_by)}{" "}
                            {new Date(f.created_at)
                              .toISOString()
                              .slice(0, 10)
                              .replace(/-/g, ".")}
                          </div>
                        </div>
                      </button>

                      {me?.shortId === f.created_by && (
                        <button
                          onClick={() => deleteFile(f.id)}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            opacity: 0.85,
                          }}
                          title="削除"
                        >
                          <img
                            src="/images/trash-can.svg"
                            alt="delete"
                            style={{ width: 18, height: 18 }}
                          />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: 12,
                  }}
                >
                  <button
                    className="add-url"
                    onClick={() => setShowUrlModal(true)}
                    disabled={fileBusy}
                    style={{
                      border: "none",
                      background: "#000",
                      color: "#fff",
                      padding: "8px 14px",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontWeight: 700,
                      opacity: fileBusy ? 0.7 : 1,
                    }}
                  >
                    URLで追加
                  </button>
                </div>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              style={{ display: "none" }}
              onChange={onFileChange}
            />

            <div
              className="drop-area"
              role="button"
              tabIndex={0}
              onClick={openFilePicker}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openFilePicker();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              style={{
                borderRadius: 14,
                border: dragOver
                  ? "2px solid #fff"
                  : "2px dashed rgba(255,255,255,0.65)",
                padding: 22,
                minHeight: 120,
                display: "grid",
                placeItems: "center",
                color: "#fff",
                opacity: 0.9,
                background: dragOver ? "rgba(255,255,255,0.08)" : "transparent",
                cursor: "pointer",
                userSelect: "none",
              }}
              title="クリックしてファイルを選択 / ここにドラッグ＆ドロップ"
            >
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700 }}>
                  {fileBusy ? "アップロード中..." : "Drag&Drop Files Here!"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                  またはクリックしてファイルを選択
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ✅ コメント編集モーダル */}
      {showEditCommentModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 10,
          }}
          onClick={() => {
            if (!editLoading) setShowEditCommentModal(false);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 16,
              width: 360,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, marginBottom: 12 }}>コメントを編集</h3>

            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              style={{
                width: "100%",
                minHeight: 120,
                resize: "vertical",
                borderRadius: 8,
                border: "1px solid #ddd",
                padding: 10,
                fontSize: 14,
              }}
              disabled={editLoading}
            />

            {editError && (
              <div style={{ color: "crimson", marginTop: 10, fontSize: 13 }}>
                {editError}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 14,
              }}
            >
              <button
                onClick={() => setShowEditCommentModal(false)}
                disabled={editLoading}
              >
                キャンセル
              </button>
              <button
                onClick={confirmEditComment}
                disabled={editLoading}
                style={{
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: 10,
                  cursor: "pointer",
                  opacity: editLoading ? 0.7 : 1,
                }}
              >
                {editLoading ? "..." : "更新"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* URL追加モーダル（あなたのまま） */}
      {showUrlModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 10,
          }}
          onClick={() => setShowUrlModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 16,
              width: 320,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, marginBottom: 12 }}>ファイルURLを登録</h3>

            <div style={{ display: "grid", gap: 8 }}>
              <input
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="表示名（例: app01）"
                style={{ height: 40, padding: "0 10px" }}
              />
              <input
                value={newFileUrl}
                onChange={(e) => setNewFileUrl(e.target.value)}
                placeholder="URL（https://...）"
                style={{ height: 40, padding: "0 10px" }}
              />
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                ※ URL追加のリンク先が download.php
                ではない場合、ダウンロード時に失敗します。
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 14,
              }}
            >
              <button onClick={() => setShowUrlModal(false)}>キャンセル</button>
              <button
                onClick={addFileByUrl}
                disabled={fileBusy || !newFileName.trim() || !newFileUrl.trim()}
                style={{
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: 10,
                  cursor: "pointer",
                  opacity: fileBusy ? 0.7 : 1,
                }}
              >
                {fileBusy ? "..." : "登録"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media (min-width: 880px) {
          .topic-detail-grid {
            grid-template-columns: 1.6fr 1fr !important;
            align-items: start;
          }
        }
      `}</style>
    </main>
  );
}
