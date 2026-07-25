# Ausflugs-Pool – Netlify + Supabase Setup

## 1. Supabase-Projekt anlegen (kostenlos)
1. Auf https://supabase.com registrieren, "New project" klicken
2. Name, Passwort, Region wählen -> "Create new project" (dauert ~1 Min.)

## 2. Datenbank-Tabelle anlegen
1. Im Projekt links auf **SQL Editor** klicken
2. Inhalt von `supabase-setup.sql` einfügen und **Run** klicken

## 3. Zugangsdaten holen
1. Links auf **Project Settings -> API**
2. Kopiere **Project URL** und den **anon public** Key

## 4. In der App eintragen
Öffne `index.html`, finde diesen Block ganz oben im `<body>`:

```html
<script>
  window.SUPABASE_URL = "DEINE_SUPABASE_PROJECT_URL";
  window.SUPABASE_ANON_KEY = "DEIN_SUPABASE_ANON_KEY";
</script>
```

Ersetze beide Platzhalter mit deinen Werten aus Schritt 3.

## 5. Auf Netlify veröffentlichen
**Einfachster Weg (kein Account-Setup nötig):**
1. Gehe auf https://app.netlify.com/drop
2. Ziehe den ganzen Ordner (mit der bearbeiteten `index.html`) in das Browserfenster
3. Netlify gibt dir sofort eine Live-URL, z. B. `https://zufälliger-name.netlify.app`

**Alternative (mit Netlify-Account, für spätere Updates per Git):**
1. Ordner in ein GitHub-Repo pushen
2. Auf netlify.com -> "Add new site" -> "Import an existing project" -> Repo auswählen
3. Kein Build-Command nötig, Publish-Verzeichnis ist der Projekt-Root

## 6. Link teilen
Schick die Netlify-URL an deine Familie. Jeder öffnet sie auf seinem Handy,
gibt denselben Familien-Code + eigenen Namen ein – fertig.

## Sicherheitshinweis
Es gibt keinen Login. Der Familien-Code ist der einzige Schutz gegen
fremden Zugriff auf eure Daten – wähle etwas Individuelles statt "TEST" oder "FAMILIE".
