"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";

type Topic = {
  id: string;
  title: string;
  created_by: string;
  created_at: string;
  last_activity_at?: string; // ✅ 追加
  categories: Category[]; // ✅ 追加（必ず配列で持つ）
};

// ✅ カテゴリ型
type Category = { id: string; name: string };

export default function TopicsPage() {
  const router = useRouter();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);

  // ✅ ログイン中ユーザーの短縮ID（katsu / kimi）
  const [myId, setMyId] = useState<string | null>(null);

  // ✅ カテゴリ一覧 & 選択中カテゴリ（フィルタ用）
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  // ✅ カテゴリ削除 UI（管理モード & 確認モーダル）
  const [categoryManageMode, setCategoryManageMode] = useState(false);
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [deleteCategoryTarget, setDeleteCategoryTarget] =
    useState<Category | null>(null);
  const [deleteCategoryLoading, setDeleteCategoryLoading] = useState(false);
  const [deleteCategoryError, setDeleteCategoryError] = useState<string | null>(
    null,
  );

  // ✅ カテゴリ新規作成UI用
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryCreating, setCategoryCreating] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // ✅ 新規作成モーダル用（トピックに付けるカテゴリ）
  const [createCategoryIds, setCreateCategoryIds] = useState<string[]>([]);

  // ✅ モーダル内カテゴリ新規作成UI用
  const [showModalCategoryInput, setShowModalCategoryInput] = useState(false);
  const [newModalCategoryName, setNewModalCategoryName] = useState("");
  const [modalCategoryCreating, setModalCategoryCreating] = useState(false);
  const [modalCategoryError, setModalCategoryError] = useState<string | null>(
    null,
  );

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
  // ✅ 編集モーダル：カテゴリ付け替え用
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);

  function toggleEditCategory(id: string) {
    setEditCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const displayName = (id: string) => {
    if (id === "katsu") return "Fanio";
    if (id === "kimi") return "Nantoka";
    return id;
  };

  // ✅ “更新日時” を返す（無い場合は created_at）
  const activityTime = (t: Topic) => t.last_activity_at ?? t.created_at;

  // ✅ カテゴリ選択トグル
  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  function toggleCreateCategory(id: string) {
    setCreateCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  // ✅ カテゴリ取得
  async function fetchCategories() {
    const { data, error } = await supabase
      .from("categories")
      .select("id,name")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      // categories テーブルがまだ無い場合もありえるので alert は出さない
      return;
    }

    setCategories((data ?? []) as Category[]);
  }
  // ✅ カテゴリ削除
  function openDeleteCategoryModal(category: Category) {
    setDeleteCategoryTarget(category);
    setDeleteCategoryError(null);
    setShowDeleteCategoryModal(true);
  }

  async function createCategory() {
    const name = newCategoryName.trim();
    if (!name) return;

    setCategoryCreating(true);
    setCategoryError(null);

    const { error } = await supabase.from("categories").insert({ name });

    setCategoryCreating(false);

    if (error) {
      // unique制約がある想定：同名カテゴリはエラーになる
      setCategoryError("作成できませんでした: " + error.message);
      return;
    }

    setNewCategoryName("");
    setShowCategoryInput(false);
    fetchCategories();
  }

  // 初回：ログイン中ユーザーID取得 → トピック一覧取得 → カテゴリ取得
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const id = user?.email?.split("@")[0] ?? null; // katsu / kimi
      setMyId(id);

      fetchTopics();
      fetchCategories(); // ✅ 追加
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ 一覧を「最新更新が上」にする
  async function fetchTopics() {
    setLoading(true);

    const { data, error } = await supabase
      .from("topics")
      .select(
        `
      id,title,created_by,created_at,last_activity_at,
      topic_categories(
        categories(id,name)
      )
    `,
      )
      .order("last_activity_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("取得に失敗: " + error.message);
      setLoading(false);
      return;
    }

    const normalized: Topic[] = (data ?? []).map((t: any) => ({
      id: t.id,
      title: t.title,
      created_by: t.created_by,
      created_at: t.created_at,
      last_activity_at: t.last_activity_at,
      categories: (t.topic_categories ?? [])
        .map((tc: any) => tc.categories)
        .filter(Boolean),
    }));

    setTopics(normalized);
    setLoading(false);
  }

  // ✅ 画面復帰時にも最新に（詳細→戻る等）
  useEffect(() => {
    const onFocus = () => {
      fetchTopics();
      fetchCategories(); // ✅ ついでにカテゴリも更新
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Realtimeで topics 変更が来たら更新（あると気持ちいい）
  useEffect(() => {
    const ch = supabase
      .channel("topics-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "topics" },
        () => {
          fetchTopics();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 新規トピック作成
  async function createTopic() {
    if (!newTitle.trim()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const created_by = user.email?.split("@")[0] ?? "unknown";

    // 1) topics を作成して id を受け取る
    const { data: inserted, error: e1 } = await supabase
      .from("topics")
      .insert({
        title: newTitle.trim(),
        created_by,
      })
      .select("id")
      .single();

    if (e1) {
      alert("作成に失敗: " + e1.message);
      return;
    }

    // 2) 選択カテゴリがあれば topic_categories に保存
    if (createCategoryIds.length > 0) {
      const rows = createCategoryIds.map((cid) => ({
        topic_id: inserted.id,
        category_id: cid,
      }));

      const { error: e2 } = await supabase
        .from("topic_categories")
        .insert(rows);

      if (e2) {
        alert("カテゴリ紐付けに失敗: " + e2.message);
        // topics自体は作成済みなので、ここでreturnしてもOK（今回はreturn）
        return;
      }
    }

    setNewTitle("");
    setCreateCategoryIds([]); // ✅ リセット
    setShowCreateModal(false);
    fetchTopics();
  }

  // ✅ カテゴリ削除
  async function confirmDeleteCategory() {
    if (!deleteCategoryTarget) return;

    setDeleteCategoryLoading(true);
    setDeleteCategoryError(null);

    const categoryId = deleteCategoryTarget.id;

    // 1) 中間テーブルから先に削除（FKがある場合ここが必須）
    const { error: e1 } = await supabase
      .from("topic_categories")
      .delete()
      .eq("category_id", categoryId);

    if (e1) {
      setDeleteCategoryLoading(false);
      setDeleteCategoryError("紐付け削除に失敗: " + e1.message);
      return;
    }

    // 2) categories から削除
    const { error: e2 } = await supabase
      .from("categories")
      .delete()
      .eq("id", categoryId);

    setDeleteCategoryLoading(false);

    if (e2) {
      setDeleteCategoryError("カテゴリ削除に失敗: " + e2.message);
      return;
    }

    // 3) UI側の選択状態も整合させる
    setSelectedCategoryIds((prev) => prev.filter((x) => x !== categoryId));
    setCreateCategoryIds((prev) => prev.filter((x) => x !== categoryId));

    setShowDeleteCategoryModal(false);
    setDeleteCategoryTarget(null);

    // 4) 再取得
    fetchCategories();
    fetchTopics();
  }

  async function createCategoryInModal() {
    const name = newModalCategoryName.trim();
    if (!name) return;

    setModalCategoryCreating(true);
    setModalCategoryError(null);

    // 1) categories に insert（id も欲しいので select）
    const { data: inserted, error } = await supabase
      .from("categories")
      .insert({ name })
      .select("id,name")
      .single();

    setModalCategoryCreating(false);

    if (error) {
      setModalCategoryError("作成できませんでした: " + error.message);
      return;
    }

    // 2) カテゴリ一覧を更新
    await fetchCategories();

    // 3) 作成したカテゴリを自動で選択状態にする
    setCreateCategoryIds((prev) =>
      prev.includes(inserted.id) ? prev : [...prev, inserted.id],
    );

    // 4) 入力を閉じる
    setNewModalCategoryName("");
    setShowModalCategoryInput(false);
  }

  // ✅ HOT 判定：3日以内＆最新2件
  const hotIds = useMemo(() => {
    const now = Date.now();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

    const sorted = [...topics].sort(
      (a, b) =>
        new Date(activityTime(b)).getTime() -
        new Date(activityTime(a)).getTime(),
    );

    const top2 = sorted.slice(0, 2);
    const ids = new Set<string>();

    top2.forEach((t) => {
      const diff = now - new Date(activityTime(t)).getTime();
      if (diff <= THREE_DAYS) ids.add(t.id);
    });

    return ids;
  }, [topics]);

  // ✅ フィルタ適用した topics を作る（現段階では Topic に categories が無いので“仮”）
  // まずUIだけ動かすため、今は selectedCategoryIds が空なら全件表示。
  // 実データの紐付けを入れた段階で、ここを本フィルタにします。
  const filteredTopics = useMemo(() => {
    if (selectedCategoryIds.length === 0) return topics;

    return topics.filter((t) => {
      const ids = t.categories.map((c) => c.id);
      return selectedCategoryIds.every((x) => ids.includes(x));
    });
  }, [topics, selectedCategoryIds]);

  // 日付グループ化（✅ “更新日” 基準に変更）
  // ✅ JST基準で YYYY.MM.DD を作る
  const formatDateJST = (iso: string) => {
    const d = new Date(iso);
    const y = d.toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
    });
    const m = d.toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "2-digit",
    });
    const day = d.toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      day: "2-digit",
    });
    return `${y}.${m}.${day}`;
  };

  const groupByDate = (items: Topic[]) => {
    const groups: { [date: string]: Topic[] } = {};
    items.forEach((topic) => {
      const date = formatDateJST(activityTime(topic));
      if (!groups[date]) groups[date] = [];
      groups[date].push(topic);
    });

    // 各グループ内も更新降順に
    Object.keys(groups).forEach((k) => {
      groups[k].sort(
        (a, b) =>
          new Date(activityTime(b)).getTime() -
          new Date(activityTime(a)).getTime(),
      );
    });

    return groups;
  };

  // ✅ grouped は filteredTopics から作る（ここが“絞り込み反映”ポイント）
  const grouped = useMemo(() => groupByDate(filteredTopics), [filteredTopics]);

  function openDeleteModal(topic: Topic) {
    setDeleteTarget(topic);
    setDeletePassword("");
    setDeleteError(null);
    setShowDeleteModal(true);
  }

  function openEditModal(topic: Topic) {
    setEditTarget(topic);
    setEditTitle(topic.title);
    setEditCategoryIds(topic.categories?.map((c) => c.id) ?? []);
    setEditError(null);
    setShowEditModal(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (!deletePassword) {
      setDeleteError("パスワードを入力してください");
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user?.email) {
      setDeleteLoading(false);
      setDeleteError(
        "ログイン情報が取得できませんでした。再ログインしてください。",
      );
      return;
    }

    const { error: loginErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: deletePassword,
    });

    if (loginErr) {
      setDeleteLoading(false);
      setDeleteError("パスワードが違います。");
      return;
    }

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

  // ✅ 更新処理（タイトル変更→ topics が更新されるので last_activity_at も更新される）
  async function confirmEdit() {
    if (!editTarget) return;

    const nextTitle = editTitle.trim();
    if (!nextTitle) {
      setEditError("タイトルを入力してください");
      return;
    }

    setEditLoading(true);
    setEditError(null);

    // ✅ 1) topics を更新（カテゴリ変更だけでも更新扱いにしたいので last_activity_at も更新）
    const { data: updated, error: e1 } = await supabase
      .from("topics")
      .update({
        title: nextTitle,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", editTarget.id)
      .select("id,title,last_activity_at");

    if (e1) {
      setEditLoading(false);
      console.error(e1);
      setEditError("更新できませんでした: " + e1.message);
      return;
    }

    if (!updated || updated.length === 0) {
      setEditLoading(false);
      setEditError(
        "更新が反映されませんでした（RLS/権限の可能性）。SupabaseのUPDATEポリシーを確認してください。",
      );
      return;
    }

    // ✅ 2) topic_categories を同期（いったん全削除 → 選択分を再insert）
    //    （FK/RLSがあるなら、この順が一番事故りにくい）
    const topicId = editTarget.id;

    const { error: e2 } = await supabase
      .from("topic_categories")
      .delete()
      .eq("topic_id", topicId);

    if (e2) {
      setEditLoading(false);
      console.error(e2);
      setEditError("カテゴリの付け替え（既存削除）に失敗: " + e2.message);
      return;
    }

    if (editCategoryIds.length > 0) {
      const rows = editCategoryIds.map((cid) => ({
        topic_id: topicId,
        category_id: cid,
      }));

      const { error: e3 } = await supabase
        .from("topic_categories")
        .insert(rows);

      if (e3) {
        setEditLoading(false);
        console.error(e3);
        setEditError("カテゴリの付け替え（再登録）に失敗: " + e3.message);
        return;
      }
    }

    // ✅ 3) 後処理
    setEditLoading(false);
    setShowEditModal(false);
    setEditTarget(null);
    setEditTitle("");
    setEditCategoryIds([]);
    setEditError(null);

    // ✅ 並び替え・カテゴリ表示にも効かせる
    fetchTopics();
  }

  return (
    <main style={{ padding: 20, background: "#666", minHeight: "100vh" }}>
      <header style={{ color: "#fff", textAlign: "center", fontSize: 20 }}>
        <div className="header-inner">
          <BackButton className="backlink" fallbackHref="/login" />
          <img src="/images/topic-icon.svg" className="top-icon" alt="" />{" "}
          <span className="first-letter">T</span>opics
        </div>
      </header>

      {/* ✅ カテゴリチップUI（ここから追加） */}
      <div className="list-wrap" style={{ marginTop: 10 }}>
        <div
          style={{
            background: "#fff",
            padding: 16,
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 700 }} className="cat-title">
              カテゴリー
            </div>

            {/* 何も選んでない＝全件 */}
            <button
              type="button"
              onClick={() => setSelectedCategoryIds([])}
              style={{
                border: "1px solid #bbb",
                background:
                  selectedCategoryIds.length === 0 ? "#111" : "transparent",
                color: selectedCategoryIds.length === 0 ? "#fff" : "#111",
                padding: "4px 10px",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              すべて
            </button>
            {/* ✅ カテゴリ管理モード切替 */}
            <button
              type="button"
              onClick={() => setCategoryManageMode((v) => !v)}
              style={{
                border: "1px solid #bbb",
                background: categoryManageMode ? "#111" : "transparent",
                color: categoryManageMode ? "#fff" : "#111",
                padding: "4px 10px",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 12,
              }}
              title="カテゴリの削除など管理操作"
            >
              {categoryManageMode ? "管理中" : "管理"}
            </button>

            {/* ✅ カテゴリ追加ボタン */}
            <button
              type="button"
              onClick={() => {
                setShowCategoryInput((v) => !v);
                setCategoryError(null);
                setNewCategoryName("");
              }}
              style={{
                marginLeft: "auto",
                border: "1px solid #bbb",
                background: "transparent",
                width: 28,
                height: 28,
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 18,
                lineHeight: "26px",
              }}
              title={
                showCategoryInput ? "カテゴリ作成を閉じる" : "カテゴリを追加"
              }
            >
              {showCategoryInput ? "−" : "+"}
            </button>
          </div>
          {/* ✅ カテゴリ新規作成入力 */}
          {showCategoryInput && (
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="新しいカテゴリ名"
                style={{
                  flex: 1,
                  height: 34,
                  padding: "0 10px",
                  border: "1px solid #bbb",
                  borderRadius: 8,
                }}
                disabled={categoryCreating}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createCategory();
                }}
              />
              <button
                type="button"
                onClick={createCategory}
                disabled={categoryCreating}
                style={{
                  height: 34,
                  padding: "0 12px",
                  border: "1px solid #bbb",
                  borderRadius: 8,
                  background: "#111",
                  color: "#fff",
                  cursor: "pointer",
                  opacity: categoryCreating ? 0.6 : 1,
                }}
              >
                {categoryCreating ? "作成中..." : "作成"}
              </button>
            </div>
          )}

          {categoryError && (
            <div style={{ marginTop: 8, fontSize: 12, color: "crimson" }}>
              {categoryError}
            </div>
          )}

          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {categories.length === 0 && (
              <div style={{ fontSize: 12, color: "#666" }}>
                （カテゴリがありません）
              </div>
            )}

            {categories.map((c) => {
              const active = selectedCategoryIds.includes(c.id);

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  style={{
                    border: "1px solid #bbb",
                    background: active ? "#ffe94d" : "transparent",
                    padding: "4px 10px",
                    borderRadius: 999,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  title="クリックで絞り込み（複数選択可）"
                >
                  <span>{c.name}</span>

                  {/* ✅ 管理モード時だけ削除ボタン */}
                  {categoryManageMode && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation(); // ✅ 絞り込みクリックを止める
                        openDeleteCategoryModal(c);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDeleteCategoryModal(c);
                        }
                      }}
                      style={{
                        width: 16,
                        height: 16,
                        lineHeight: "16px",
                        textAlign: "center",
                        borderRadius: 999,
                        border: "1px solid #999",
                        fontSize: 11,
                        cursor: "pointer",
                        background: "#fff",
                      }}
                      title="カテゴリを削除"
                    >
                      ×
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedCategoryIds.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#444" }}>
              絞り込み中：{selectedCategoryIds.length}件
            </div>
          )}
        </div>

        {/* ✅ トピック一覧 */}
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
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 8,
                      margin: "1em 0",
                      cursor: "pointer",
                    }}
                    onClick={() => router.push(`/topics/${topic.id}`)}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
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
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span>
                          {topic.title}{" "}
                          <span className={displayName(topic.created_by)}>
                            {displayName(topic.created_by)}
                          </span>
                        </span>
                        {/* ✅ Categories */}
                        {topic.categories?.map((c) => (
                          <span
                            key={c.id}
                            style={{
                              border: "1px solid #bbb",
                              borderRadius: 999,
                              padding: "2px 8px",
                              fontSize: 11,
                              background: "#ffe94d",
                              fontWeight: 700,
                              lineHeight: 1.4,
                            }}
                          >
                            {c.name}
                          </span>
                        ))}
                        {/* ✅ HOT */}
                        {hotIds.has(topic.id) && (
                          <span
                            style={{
                              background: "#ff3b30",
                              color: "#fff",
                              fontWeight: 800,
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 999,
                              lineHeight: 1.4,
                            }}
                          >
                            HOT
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                      className="btns-wrap"
                    >
                      {/* ✅ 編集は誰でもOK：常に表示 */}
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

                      {/* ✅ 削除は作成者のみ：今まで通り */}
                      {myId === topic.created_by && (
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
                          title="削除"
                        >
                          <img
                            src="/images/trash-can.svg"
                            alt=""
                            style={{ width: 18, height: 18, opacity: 0.9 }}
                          />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>

      {/* ＋ボタン */}
      <button
        onClick={() => {
          setCreateCategoryIds([]);
          setShowModalCategoryInput(false); // ✅ 追加
          setNewModalCategoryName(""); // ✅ 追加
          setModalCategoryError(null); // ✅ 追加
          setShowCreateModal(true);
        }}
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
          onClick={() => {
            setShowCreateModal(false);
            setCreateCategoryIds([]);
          }}
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
            {/* ✅ カテゴリ選択（複数可） */}
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700 }}>
                  カテゴリー（複数選択）
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowModalCategoryInput((v) => !v);
                    setModalCategoryError(null);
                    setNewModalCategoryName("");
                  }}
                  style={{
                    border: "1px solid #bbb",
                    background: "transparent",
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    cursor: "pointer",
                    fontSize: 18,
                    lineHeight: "24px",
                  }}
                  title={
                    showModalCategoryInput
                      ? "カテゴリ作成を閉じる"
                      : "カテゴリを追加"
                  }
                >
                  {showModalCategoryInput ? "−" : "+"}
                </button>
              </div>

              {/* ✅ モーダル内：カテゴリ新規作成入力 */}
              {showModalCategoryInput && (
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    value={newModalCategoryName}
                    onChange={(e) => setNewModalCategoryName(e.target.value)}
                    placeholder="新しいカテゴリ名"
                    style={{
                      flex: 1,
                      height: 34,
                      padding: "0 10px",
                      border: "1px solid #bbb",
                      borderRadius: 8,
                      width: "70%",
                    }}
                    disabled={modalCategoryCreating}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createCategoryInModal();
                    }}
                  />
                  <button
                    type="button"
                    onClick={createCategoryInModal}
                    disabled={modalCategoryCreating}
                    style={{
                      height: 34,
                      padding: "0 12px",
                      border: "1px solid #bbb",
                      borderRadius: 8,
                      background: "#111",
                      color: "#fff",
                      cursor: "pointer",
                      opacity: modalCategoryCreating ? 0.6 : 1,
                    }}
                  >
                    {modalCategoryCreating ? "作成中..." : "作成"}
                  </button>
                </div>
              )}

              {modalCategoryError && (
                <div
                  style={{ marginBottom: 8, fontSize: 12, color: "crimson" }}
                >
                  {modalCategoryError}
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {categories.length === 0 && (
                  <div style={{ fontSize: 12, color: "#666" }}>
                    （カテゴリがありません）
                  </div>
                )}

                {categories.map((c) => {
                  const active = createCategoryIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCreateCategory(c.id)}
                      style={{
                        border: "1px solid #bbb",
                        background: active ? "#ffe94d" : "transparent",
                        padding: "4px 10px",
                        borderRadius: 999,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: active ? 700 : 500,
                      }}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 15, textAlign: "right" }}>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateCategoryIds([]);
                }}
              >
                キャンセル
              </button>
              <button onClick={createTopic} style={{ marginLeft: 10 }}>
                作成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
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
            {/* ✅ 編集モーダル：カテゴリ付け替え（複数可） */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                カテゴリー（複数選択）
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {categories.length === 0 && (
                  <div style={{ fontSize: 12, color: "#666" }}>
                    （カテゴリがありません）
                  </div>
                )}

                {categories.map((c) => {
                  const active = editCategoryIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleEditCategory(c.id)}
                      disabled={editLoading}
                      style={{
                        border: "1px solid #bbb",
                        background: active ? "#ffe94d" : "transparent",
                        padding: "4px 10px",
                        borderRadius: 999,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: active ? 700 : 500,
                        opacity: editLoading ? 0.7 : 1,
                      }}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

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
      {/* ✅ カテゴリ削除モーダル */}
      {showDeleteCategoryModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
          }}
          onClick={() => {
            if (!deleteCategoryLoading) setShowDeleteCategoryModal(false);
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 12,
              width: 340,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 10 }}>カテゴリを削除しますか？</h3>

            <div style={{ fontSize: 14, marginBottom: 12, lineHeight: 1.6 }}>
              対象：<b>{deleteCategoryTarget?.name}</b>
              <br />
              このカテゴリが付いているトピックからも外れます。
            </div>

            {deleteCategoryError && (
              <p style={{ color: "crimson", marginTop: 10, lineHeight: 1.4 }}>
                {deleteCategoryError}
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
                onClick={() => setShowDeleteCategoryModal(false)}
                disabled={deleteCategoryLoading}
              >
                キャンセル
              </button>

              <button
                onClick={confirmDeleteCategory}
                disabled={deleteCategoryLoading}
                style={{
                  background: "#111",
                  color: "#fff",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                  opacity: deleteCategoryLoading ? 0.6 : 1,
                }}
              >
                {deleteCategoryLoading ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
