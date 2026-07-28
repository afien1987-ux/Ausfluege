import { buildPushHTTPRequest } from "@pushforge/builder";

const NOTIFY_KEYS = {
  destinations: { body: (item) => `Neues Ziel vorgeschlagen: ${item.name}` },
  rounds: { body: (item) => `Neue Runde gestartet: ${item.alias}` },
  termine: { body: () => `Neue Terminfindung wurde angelegt` },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/notify" && request.method === "POST") {
      return handleNotify(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};

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

  if (!dataKey || !NOTIFY_KEYS[dataKey] || !roomCode) {
    return new Response("ignored (not a notifiable key)", { status: 200 });
  }

  const newArr = Array.isArray(record.data_value) ? record.data_value : [];
  const oldArr = Array.isArray(oldRecord && oldRecord.data_value) ? oldRecord.data_value : [];
  const oldIds = new Set(oldArr.map((x) => x.id));
  const added = newArr.filter((x) => !oldIds.has(x.id));

  if (added.length === 0) {
    return new Response("no additions detected", { status: 200 });
  }

  const subs = await fetchSubscriptions(env, roomCode);
  if (subs.length === 0) {
    return new Response("no subscribers", { status: 200 });
  }

  let privateJWK;
  try {
    privateJWK = JSON.parse(env.VAPID_PRIVATE_KEY);
  } catch (e) {
    return new Response("Server misconfigured: VAPID_PRIVATE_KEY invalid", { status: 500 });
  }

  for (const item of added) {
    const title = "Ausflugs-Pool";
    const body = NOTIFY_KEYS[dataKey].body(item);

    for (const { name, subscription } of subs) {
      try {
        const { endpoint, headers, body: reqBody } = await buildPushHTTPRequest({
          privateJWK,
          subscription,
          message: {
            payload: { title, body },
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

  return new Response("ok", { status: 200 });
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
    .map((r) => ({ name: r.data_key.slice("pushsub:".length), subscription: r.data_value }));
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
