// public/sw.js

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: "更新があります",
      message: "アプリを開いて確認してください",
      url: "/topics",
    };
  }

  const title = data.title || "更新があります";
  const options = {
    body: data.message || "アプリを開いて確認してください",
    data: { url: data.url || "/topics" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // ✅ 文法ミス修正（ここ重要）
  const url =
    event &&
    event.notification &&
    event.notification.data &&
    event.notification.data.url
      ? event.notification.data.url
      : "/topics";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          try {
            if ("navigate" in client) {
              await client.navigate(url);
            }
          } catch (e) {}
          return;
        }
      }

      await clients.openWindow(url);
    })(),
  );
});
