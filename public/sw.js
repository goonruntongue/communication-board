// public/sw.js

self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { title: "更新があります", message: "アプリを開いて確認してください", url: "/topics" };
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
    const url = event.notification ? .data ? .url || "/topics";

    event.waitUntil(
        (async() => {
            const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
            for (const client of allClients) {
                if ("focus" in client) {
                    client.focus();
                    client.navigate(url);
                    return;
                }
            }
            clients.openWindow(url);
        })(),
    );
});