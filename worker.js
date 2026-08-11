import { buildPushHTTPRequest } from "@pushforge/builder";

const NOTIFY_KEYS = {
  destinations: { body: (item) => `Neues Ziel vorgeschlagen: ${item.name}`, tab: "ziele" },
  rounds: { body: (item) => `Neue Runde gestartet: ${item.alias}`, tab: "runden" },
  termine: { body: () => `Neue Terminfindung wurde angelegt`, tab: "termine" },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/notify" && request.method === "POST") {
      return handleNotify(request, env);
    }
    if (url.pathname === "/api/admin-auth" && request.method === "POST") {
      return handleAdminAuth(request, env);
    }
    const response = await env.ASSETS.fetch(request);
    // HTML nie hart cachen lassen (Browser/PWA sonst auf altem Stand
    // hängen bleiben, z. B. nach Bugfixes wie am Kalender-Export) - Assets
    // wie Icons dürfen wie gehabt normal gecacht werden.
    if (request.method === "GET" && (response.headers.get("content-type") || "").includes("text/html")) {
      const fresh = new Response(response.body, response);
      fresh.headers.set("Cache-Control", "no-cache, must-revalidate");
      return fresh;
    }
    return response;
  },
};

async function handleAdminAuth(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return new Response("Bad request", { status: 400 });
  }
  if (!env.ADMIN_PASSWORD || payload.password !== env.ADMIN_PASSWORD) {
    return new Response("Unauthorized", { status: 401 });
  }
  return new Response("ok", { status: 200 });
}

async function handleNotify(request, env) {
  if (request.headers.get("x-webhook-secret") !== env.WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return new Response("Bad request", { status: 400 });
  }

  if (payload.table !== "pool_data") {
    return new Response("ignored (wrong table)", { status: 200 });
  }

  const record = payload.record;
  const oldRecord = payload.old_record;
  const dataKey = record && record.data_key;
  const roomCode = record && record.room_code;
  if (!dataKey || !roomCode) {
    return new Response("ignored (no key/room)", { status: 200 });
  }

  let privateJWK;
  try {
    privateJWK = JSON.parse(env.VAPID_PRIVATE_KEY);
  } catch (e) {
    return new Response("Server misconfigured: VAPID_PRIVATE_KEY invalid", { status: 500 });
  }

  // --- Fall 1: neues Ziel / neue Runde / neue Terminfindung ---
  if (NOTIFY_KEYS[dataKey]) {
    const newArr = Array.isArray(record.data_value) ? record.data_value : [];
    const oldArr = Array.isArray(oldRecord && oldRecord.data_value) ? oldRecord.data_value : [];
    const oldIds = new Set(oldArr.map((x) => x.id));
    const added = newArr.filter((x) => !oldIds.has(x.id));
    if (added.length === 0) return new Response("no additions detected", { status: 200 });

    const subs = await fetchSubscriptions(env, roomCode);
    if (subs.length === 0) return new Response("no subscribers", { status: 200 });

    for (const item of added) {
      await sendToAll(env, privateJWK, subs, "Ausflugs-Pool", NOTIFY_KEYS[dataKey].body(item), NOTIFY_KEYS[dataKey].tab);
    }
    return new Response("ok", { status: 200 });
  }

  // --- Fall 2: jemand hat bei einer Runde abgestimmt (Ziel-Bewertung) ---
  let m = dataKey.match(/^votes:([^:]+):(.+)$/);
  if (m) {
    const [, roundId, voterName] = m;
    const round = await fetchArrayItem(env, roomCode, "rounds", roundId);
    if (!round) return new Response("round not found", { status: 200 });
    const subs = (await fetchSubscriptions(env, roomCode)).filter((s) => s.name !== voterName);
    if (subs.length === 0) return new Response("no subscribers", { status: 200 });
    await sendToAll(env, privateJWK, subs, "Ausflugs-Pool", `${voterName} hat bei "${round.alias}" abgestimmt`, "runden");
    return new Response("ok", { status: 200 });
  }

  // --- Fall 3: jemand hat bei der Terminumfrage einer Runde geantwortet ---
  m = dataKey.match(/^dayvotes:([^:]+):(.+)$/);
  if (m) {
    const [, roundId, voterName] = m;
    const round = await fetchArrayItem(env, roomCode, "rounds", roundId);
    if (!round) return new Response("round not found", { status: 200 });
    const subs = (await fetchSubscriptions(env, roomCode)).filter((s) => s.name !== voterName);
    if (subs.length === 0) return new Response("no subscribers", { status: 200 });
    await sendToAll(env, privateJWK, subs, "Ausflugs-Pool", `${voterName} hat bei "${round.alias}" die Terminumfrage beantwortet`, "runden");
    return new Response("ok", { status: 200 });
  }

  // --- Fall 4: jemand hat bei einer Terminfindung geantwortet ---
  m = dataKey.match(/^termintage:([^:]+):(.+)$/);
  if (m) {
    const [, terminId, voterName] = m;
    const termin = await fetchArrayItem(env, roomCode, "termine", terminId);
    if (!termin) return new Response("termin not found", { status: 200 });
    const dest = await fetchArrayItem(env, roomCode, "destinations", termin.destinationId);
    const destName = dest ? dest.name : "eurem Ziel";
    const subs = (await fetchSubscriptions(env, roomCode)).filter((s) => s.name !== voterName);
    if (subs.length === 0) return new Response("no subscribers", { status: 200 });
    await sendToAll(env, privateJWK, subs, "Ausflugs-Pool", `${voterName} hat bei der Terminfindung für "${destName}" geantwortet`, "termine");
    return new Response("ok", { status: 200 });
  }

  return new Response("ignored (not a notifiable key)", { status: 200 });
}

async function sendToAll(env, privateJWK, subs, title, body, tab) {
  const url = tab ? `/?tab=${encodeURIComponent(tab)}` : "/";
  for (const { name, subscription, roomCode } of subs) {
    try {
      const { endpoint, headers, body: reqBody } = await buildPushHTTPRequest({
        privateJWK,
        subscription,
        message: {
          payload: { title, body, url },
          adminContact: env.VAPID_CONTACT || "mailto:example@example.com",
        },
      });
      const res = await fetch(endpoint, { method: "POST", headers, body: reqBody });
      if (res.status === 404 || res.status === 410) {
        await deleteSubscription(env, roomCode, name);
      }
    } catch (e) {
      // einzelner Versand fehlgeschlagen: ignorieren, weiter mit den anderen
    }
  }
}

async function fetchArrayItem(env, roomCode, dataKey, itemId) {
  const url =
    `${env.SUPABASE_URL}/rest/v1/pool_data` +
    `?room_code=eq.${encodeURIComponent(roomCode)}` +
    `&data_key=eq.${encodeURIComponent(dataKey)}` +
    `&select=data_value`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  if (!rows[0] || !Array.isArray(rows[0].data_value)) return null;
  return rows[0].data_value.find((x) => x.id === itemId) || null;
}

async function fetchSubscriptions(env, roomCode) {
  const url =
    `${env.SUPABASE_URL}/rest/v1/pool_data` +
    `?room_code=eq.${encodeURIComponent(roomCode)}` +
    `&data_key=like.pushsub:*` +
    `&select=data_key,data_value`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) return [];
  const rows = await res.json();
  return rows
    .filter((r) => r.data_value)
    .map((r) => ({ name: r.data_key.slice("pushsub:".length), subscription: r.data_value, roomCode }));
}

async function deleteSubscription(env, roomCode, name) {
  const url =
    `${env.SUPABASE_URL}/rest/v1/pool_data` +
    `?room_code=eq.${encodeURIComponent(roomCode)}` +
    `&data_key=eq.pushsub:${encodeURIComponent(name)}`;
  await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
}
