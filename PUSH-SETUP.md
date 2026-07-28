# Push-Benachrichtigungen einrichten (Cloudflare Workers)

Diese Datei beschreibt die einmalige Einrichtung. Ohne diese Schritte erscheint
zwar der "🔔 Benachrichtigungen aktivieren"-Button in der App, aber es werden
keine Nachrichten verschickt.

## Was dazugekommen ist

- `worker.js` – ein einzelner Worker, der sowohl die Seite ausliefert als auch
  unter `/api/notify` die eigentlichen Push-Nachrichten verschickt
- `wrangler.jsonc` – Konfigurationsdatei, die Cloudflare sagt, wie der Worker
  aufgebaut ist (nötig, weil dein Projekt als "Workers"-Projekt läuft, nicht
  als klassisches "Pages"-Projekt)
- `.assetsignore` – sorgt dafür, dass Config-Dateien nicht versehentlich als
  Webseite ausgeliefert werden
- `sw.js` – Service Worker im Browser, zeigt die Benachrichtigung an
- `package.json` – nötig, damit Cloudflare die Versand-Bibliothek installiert
- In der App: 🔔-Menüpunkt zum Aktivieren/Deaktivieren

## 1. Cloudflare: Build-Command (schon erledigt)

Build command: `npm install` — hast du schon eingestellt, bleibt so.

## 2. Cloudflare: Umgebungsvariablen setzen

Cloudflare-Dashboard → dein Projekt → **Settings → Variables and secrets** →
folgende **vier** Variablen hinzufügen:

| Name | Wert |
|---|---|
| `VAPID_PRIVATE_KEY` | `{"kty":"EC","crv":"P-256","x":"16O3ydRIsqclGVd_u-cKfW36FNiGONeEX_EoDLJAwBI","y":"KuCl45qAUDtfmBk6y_igzEbERzryJeUDk2OqNyVhhCs","d":"KElsT_0uuqYwYs6UYFL7t4QyZg-qd1Nk87Btkpq3Lto"}` |
| `SUPABASE_URL` | `https://esfmotvtrkucoewovaep.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | dein **service_role**-Schlüssel aus Supabase → Project Settings → API (NICHT der publishable/anon-Key!) |
| `WEBHOOK_SECRET` | ein selbst ausgedachtes, langes Zufalls-Passwort |

⚠️ Diese Werte niemals im Code/Repo speichern, nur hier als Variable.

Nach dem Speichern: einmal neu deployen (z. B. kleinen Commit hochladen).

## 3. Supabase: Database Webhook einrichten

1. Supabase-Dashboard → dein Projekt → **Database → Webhooks** → **Create a new hook**
2. **Table:** `pool_data`
3. **Events:** ✅ Insert, ✅ Update
4. **Type:** HTTP Request
5. **URL:** `https://DEINE-CLOUDFLARE-URL/api/notify`
6. **HTTP Headers:** `x-webhook-secret` → derselbe Wert wie `WEBHOOK_SECRET`
7. Speichern

## 4. Testen

1. ☰-Menü → **🔔 Benachrichtigungen** → aktivieren
2. Neues Ziel/Runde/Termin anlegen
3. Benachrichtigung sollte innerhalb weniger Sekunden ankommen

**iPhone:** nur nach "Zum Startbildschirm hinzufügen" (iOS 16.4+), nicht im normalen Safari-Tab.

## Fehlersuche

- Cloudflare-Dashboard → **Deployments** → Build-Log prüfen, ob `wrangler deploy` jetzt durchläuft
- **Observability/Logs** im Worker zeigt Fehler beim Ausführen von `/api/notify`
- Supabase → **Database → Webhooks** → Verlauf zeigt, ob der Webhook ausgelöst wurde und mit welchem Status
- 401 → `x-webhook-secret` und `WEBHOOK_SECRET` stimmen nicht überein
