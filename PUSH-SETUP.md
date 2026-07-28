# Push-Benachrichtigungen einrichten

Diese Datei beschreibt die einmalige Einrichtung. Ohne diese Schritte erscheint
zwar der "🔔 Benachrichtigungen aktivieren"-Button in der App, aber es werden
keine Nachrichten verschickt (der Server-Teil fehlt dann noch).

## Was dazugekommen ist

- `sw.js` – Service Worker, empfängt und zeigt Push-Nachrichten im Browser
- `functions/api/notify.js` – Cloudflare-Funktion, die die Nachrichten verschickt
- `package.json` – nötig, damit Cloudflare die Versand-Bibliothek installiert
- In der App: 🔔-Menüpunkt zum Aktivieren/Deaktivieren

## 1. Cloudflare: Build-Command setzen

Bisher war der Build-Command leer (kein Build nötig). Das ändert sich jetzt,
weil die Funktion eine Bibliothek braucht:

1. Cloudflare-Dashboard → dein Projekt → **Settings → Builds & deployments**
2. **Build command** auf `npm install` setzen
3. Speichern, dann einmal neu deployen (z. B. kleine Änderung committen)

## 2. Cloudflare: Umgebungsvariablen setzen

Cloudflare-Dashboard → dein Projekt → **Settings → Environment variables** →
folgende **vier** Variablen hinzufügen (Production und Preview):

| Name | Wert |
|---|---|
| `VAPID_PRIVATE_KEY` | `{"kty":"EC","crv":"P-256","x":"16O3ydRIsqclGVd_u-cKfW36FNiGONeEX_EoDLJAwBI","y":"KuCl45qAUDtfmBk6y_igzEbERzryJeUDk2OqNyVhhCs","d":"KElsT_0uuqYwYs6UYFL7t4QyZg-qd1Nk87Btkpq3Lto"}` |
| `SUPABASE_URL` | `https://esfmotvtrkucoewovaep.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | dein **service_role**-Schlüssel aus Supabase → Project Settings → API (NICHT der publishable/anon-Key!) |
| `WEBHOOK_SECRET` | ein selbst ausgedachtes, langes Zufalls-Passwort, z. B. 32 zufällige Zeichen |

⚠️ **Wichtig:** `VAPID_PRIVATE_KEY` und `SUPABASE_SERVICE_ROLE_KEY` sind echte
Geheimnisse. Sie dürfen NUR hier als Umgebungsvariable stehen, niemals in der
`index.html` oder im Git-Repo.

Nach dem Speichern der Variablen: einmal neu deployen, damit sie wirksam werden.

## 3. Supabase: Database Webhook einrichten

1. Supabase-Dashboard → dein Projekt → **Database → Webhooks** → **Create a new hook**
2. **Table:** `pool_data`
3. **Events:** ✅ Insert, ✅ Update
4. **Type:** HTTP Request
5. **URL:** `https://DEINE-CLOUDFLARE-URL/api/notify` (deine echte Pages-URL einsetzen)
6. **HTTP Headers:** einen Header hinzufügen:
   - Name: `x-webhook-secret`
   - Wert: derselbe Wert wie `WEBHOOK_SECRET` aus Schritt 2
7. Speichern

## 4. Testen

1. In der App: ☰-Menü → **🔔 Benachrichtigungen** → aktivieren (Standort-/Benachrichtigungs-Erlaubnis bestätigen)
2. Ein neues Ziel, eine neue Runde oder eine neue Terminfindung anlegen
3. Benachrichtigung sollte innerhalb weniger Sekunden ankommen

**iPhone-Hinweis:** Push funktioniert nur, wenn die App zuvor über "Zum
Startbildschirm hinzufügen" installiert und von dort geöffnet wurde (iOS 16.4+).
Im normalen Safari-Tab geht das auf iOS grundsätzlich nicht.

## Fehlersuche

- Kommt nichts an? Cloudflare-Dashboard → **Functions** → Logs des `/api/notify`-Aufrufs prüfen
- Supabase-Dashboard → **Database → Webhooks** → Verlauf zeigt, ob der Webhook überhaupt ausgelöst und mit welchem Status er beantwortet wurde
- 401-Fehler → `x-webhook-secret`-Header und `WEBHOOK_SECRET`-Variable stimmen nicht überein
