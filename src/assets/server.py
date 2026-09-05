"""
server.py — Morphological Analyser backend (SQLite-only, JSON-backed corpus)

Run:   python server.py
Listens on http://localhost:5556

There is no MongoDB anywhere in this project. Storage is split cleanly
in two:

  1. CORPUS CONTENT (proof text / sandhi split / precomputed morph
     output) lives in plain JSON files under CHAPTERS_DIR and is read
     straight off disk on every request. It is never imported or
     duplicated into SQLite — the JSON files themselves are the single
     source of truth, and every account sees exactly the same content.
     See CHAPTER JSON FORMAT below.

  2. PER-USER DATA (accounts, each user's own proof/sandhi/morph edits,
     and progress) lives in a single SQLite file (vanmayi.db) sitting
     next to this script, keyed by the user's email. This is the ONLY
     thing SQLite is used for — edits from one account are never mixed
     into another account's view, and are never written back into the
     JSON files.

When a chapter is requested, the server reads the JSON fresh from disk
and — if an email is supplied — overlays that one user's saved edits on
top before sending the merged result to the browser. Everyone is always
looking at the same base JSON; only the overlay differs per login.

─── CHAPTER JSON FORMAT (one file per chapter under chapters/) ───────
{
  "slug":      "kalpastanam_ch1",           // stable id, unique per chapter
  "sthana":    "Charaka Saṃhitā",           // used to group the file tree
  "subfolder": "Kalpa Sthānam",
  "name":      "Adhyāya 1",
  "title":     "कल्पस्थानम् · प्रथमोऽध्यायः",
  "content": [
    {
      "proof":  "प्रथमोऽध्यायः",
      "sandhi": "प्रथम:+अध्यायः",
      // Optional. Two shapes are supported:
      //   (a) grouped (recommended -- enables per-word display/editing
      //       exactly like a live lt-proc run):
      //       "output": [ { "word": "प्रथमः", "analyses": ["प्रथम नाम पुं १ एक"] }, ... ]
      //   (b) flat list of strings (older exports) -- shown as a
      //       read-only reference list under the sentence, since the
      //       original word boundaries were not preserved when it was
      //       exported this way.
      "output": [
        { "word": "प्रथमः",  "analyses": ["प्रथम नाम पुं १ एक"] },
        { "word": "अध्यायः", "analyses": ["अध्याय नाम पुं १ एक"] }
      ]
    }
  ]
}
"""

import re
import subprocess
import json
import os
import io
import cgi
import sqlite3
import threading
import hashlib
import hmac
import secrets
from http.server import HTTPServer, ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
from datetime import datetime

try:
    from google.oauth2.service_account import Credentials as _GCreds
    from googleapiclient.discovery import build as _gbuild
    _GOOGLE_SHEETS_LIBS_AVAILABLE = True
except ImportError:
    _GOOGLE_SHEETS_LIBS_AVAILABLE = False

# ─── CONFIG ────────────────────────────────────────────────
# Change the port here (or set VANMAYI_PORT before starting the server)
# -- and update APP_SERVER_PORT in db.js to match. morph.html reads its
# server URL from db.js's DB_SERVER, so that's the only other place a
# port change needs to be mirrored.
PORT = int(os.environ.get("VANMAYI_PORT", 5556))

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vanmayi.db")

# ─── GOOGLE SHEETS SYNC (morph corrections) ───────────────────
# Every morph-word correction a user saves is still written to SQLite
# (that stays the source of truth the app reads from), and is now ALSO
# mirrored into a Google Sheet, kept fully in sync with SQLite:
#
#   - New correction  -> a new row is APPENDED to today's tab.
#   - Edited correction (same email+slug+word saved again) -> the
#     EXISTING row is updated in place -- no duplicate row.
#   - Deleted correction -> the existing row is REMOVED from the sheet.
#
# A tab ("subsheet") named with the date (YYYY-MM-DD) the correction
# was FIRST created is used to hold it for its whole lifetime -- so a
# correction created on 2026-08-27 and edited on 2026-08-29 still lives
# in the 2026-08-27 tab, just with its row updated. That keeps "which
# tab is this in" stable and avoids ever moving rows between tabs.
#
# To make edit/delete reliable regardless of Devanagari text or which
# tab a row lives in, each correction gets a short deterministic ID
# (derived from email+slug+word) stored in column A. A hidden "_index"
# tab maps ID -> which date-tab currently holds that row, so an edit or
# delete only ever has to open the one tab it actually needs.
#
# Setup (one-time):
#   1. pip install google-api-python-client google-auth
#   2. In Google Cloud Console: create a project (or reuse one), enable
#      the "Google Sheets API", then create a Service Account and
#      download its JSON key.
#   3. Save that key file next to server.py as "google-credentials.json"
#      (or point VANMAYI_GOOGLE_CREDS at wherever you saved it).
#   4. Open the key file, copy the "client_email" address
#      (looks like ...@...iam.gserviceaccount.com), and share your
#      "morph_corrections" Google Sheet with that address as Editor.
#      Without this share step, every write will fail with a 403.
#   5. VANMAYI_SHEET_ID below is already set to the sheet you shared —
#      override it with an env var if you ever point this at a
#      different spreadsheet.
GOOGLE_SHEET_ID = os.environ.get("VANMAYI_SHEET_ID", "1krwisJ1plDWx7a9IHOFjwmV6SFvxNkfwZK9VZoEhTDg")
GOOGLE_SERVICE_ACCOUNT_FILE = os.environ.get(
    "VANMAYI_GOOGLE_CREDS",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "google-credentials.json"),
)
_SHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
_SHEET_HEADER_ROW = ["ID", "Timestamp", "User", "Email", "Slug", "Word", "Proof", "Sandhi", "Anvaya", "Original", "Edited"]
_INDEX_TAB_TITLE = "_index"
_INDEX_HEADER_ROW = ["ID", "Tab"]

_sheets_service = None
_sheets_service_lock = threading.Lock()
_sheets_write_lock = threading.Lock()   # serializes ALL sheet mutations per process
_tab_sheet_ids = {}                     # tab title -> numeric grid sheetId (cache)
_sheets_warned_missing_creds = False


def _correction_id(email, slug, word):
    """Short, deterministic ID for one (email, slug, word) correction, so
    the same correction always maps to the same sheet row no matter what
    the Devanagari text looks like."""
    raw = f"{email}|{slug}|{word}".encode("utf-8")
    return hashlib.sha1(raw).hexdigest()[:12]


def _get_sheets_service():
    """Lazily build (and cache) the Sheets API client. Returns None —
    and logs why, once — if the libraries or credentials aren't set up,
    so a missing Google Sheets integration never breaks saving to
    SQLite, which remains the source of truth."""
    global _sheets_service, _sheets_warned_missing_creds
    if not _GOOGLE_SHEETS_LIBS_AVAILABLE:
        if not _sheets_warned_missing_creds:
            print("[Sheets] google-api-python-client / google-auth not installed — "
                  "run: pip install google-api-python-client google-auth. "
                  "Corrections will still be saved to SQLite.")
            _sheets_warned_missing_creds = True
        return None
    if _sheets_service is not None:
        return _sheets_service
    with _sheets_service_lock:
        if _sheets_service is not None:
            return _sheets_service
        if not os.path.exists(GOOGLE_SERVICE_ACCOUNT_FILE):
            if not _sheets_warned_missing_creds:
                print(f"[Sheets] No credentials file at {GOOGLE_SERVICE_ACCOUNT_FILE} — "
                      f"Google Sheets sync is disabled (SQLite save still works). "
                      f"See the GOOGLE SHEETS SYNC setup notes near the top of server.py.")
                _sheets_warned_missing_creds = True
            return None
        try:
            creds = _GCreds.from_service_account_file(GOOGLE_SERVICE_ACCOUNT_FILE, scopes=_SHEETS_SCOPES)
            _sheets_service = _gbuild("sheets", "v4", credentials=creds, cache_discovery=False)
            print("[Sheets] Google Sheets client ready.")
            return _sheets_service
        except Exception as e:
            print(f"[Sheets] Failed to initialize Google Sheets client: {e}")
            return None


def _refresh_tab_map(service):
    meta = service.spreadsheets().get(spreadsheetId=GOOGLE_SHEET_ID).execute()
    _tab_sheet_ids.clear()
    for s in meta.get("sheets", []):
        props = s["properties"]
        _tab_sheet_ids[props["title"]] = props["sheetId"]


def _ensure_tab(service, tab_title, header_row, hidden=False):
    """Make sure a tab named tab_title exists, with a header row, creating
    it if needed. Caller must hold _sheets_write_lock. Returns the tab's
    numeric sheetId."""
    if tab_title not in _tab_sheet_ids:
        _refresh_tab_map(service)
    if tab_title not in _tab_sheet_ids:
        add_props = {"title": tab_title}
        if hidden:
            add_props["hidden"] = True
        service.spreadsheets().batchUpdate(
            spreadsheetId=GOOGLE_SHEET_ID,
            body={"requests": [{"addSheet": {"properties": add_props}}]},
        ).execute()
        service.spreadsheets().values().update(
            spreadsheetId=GOOGLE_SHEET_ID,
            range=f"'{tab_title}'!A1",
            valueInputOption="RAW",
            body={"values": [header_row]},
        ).execute()
        print(f"[Sheets] Created tab '{tab_title}'.")
        _refresh_tab_map(service)
    return _tab_sheet_ids[tab_title]


def _find_row_by_id(service, tab_title, cid):
    """Search column A of tab_title for cid. Returns the 1-indexed sheet
    row number (>=2, since row 1 is the header) or None if not found."""
    result = service.spreadsheets().values().get(
        spreadsheetId=GOOGLE_SHEET_ID, range=f"'{tab_title}'!A2:A"
    ).execute()
    for i, row in enumerate(result.get("values", [])):
        if row and row[0] == cid:
            return i + 2
    return None


def _index_get(service, cid):
    """Which date-tab currently holds this correction's ID, if any."""
    _ensure_tab(service, _INDEX_TAB_TITLE, _INDEX_HEADER_ROW, hidden=True)
    row_num = _find_row_by_id(service, _INDEX_TAB_TITLE, cid)
    if row_num is None:
        return None
    result = service.spreadsheets().values().get(
        spreadsheetId=GOOGLE_SHEET_ID, range=f"'{_INDEX_TAB_TITLE}'!B{row_num}"
    ).execute()
    values = result.get("values", [])
    return values[0][0] if values and values[0] else None


def _index_set(service, cid, tab_title):
    row_num = _find_row_by_id(service, _INDEX_TAB_TITLE, cid)
    if row_num is not None:
        service.spreadsheets().values().update(
            spreadsheetId=GOOGLE_SHEET_ID, range=f"'{_INDEX_TAB_TITLE}'!A{row_num}:B{row_num}",
            valueInputOption="RAW", body={"values": [[cid, tab_title]]},
        ).execute()
    else:
        service.spreadsheets().values().append(
            spreadsheetId=GOOGLE_SHEET_ID, range=f"'{_INDEX_TAB_TITLE}'!A1",
            valueInputOption="RAW", insertDataOption="INSERT_ROWS",
            body={"values": [[cid, tab_title]]},
        ).execute()


def _delete_row(service, tab_title, row_num):
    sheet_id = _tab_sheet_ids.get(tab_title)
    if sheet_id is None:
        _refresh_tab_map(service)
        sheet_id = _tab_sheet_ids.get(tab_title)
    if sheet_id is None:
        return
    service.spreadsheets().batchUpdate(
        spreadsheetId=GOOGLE_SHEET_ID,
        body={"requests": [{"deleteDimension": {"range": {
            "sheetId": sheet_id, "dimension": "ROWS",
            "startIndex": row_num - 1, "endIndex": row_num,
        }}}]},
    ).execute()


def _index_delete(service, cid):
    row_num = _find_row_by_id(service, _INDEX_TAB_TITLE, cid)
    if row_num is not None:
        _delete_row(service, _INDEX_TAB_TITLE, row_num)


def upsert_correction_in_sheet(email, slug, word, original, edited, proof="", sandhi="", anvaya="", username=""):
    """Create-or-update the one row for this correction. New corrections
    are appended to today's tab; corrections that already have a row
    (i.e. were edited) get that existing row updated in place instead of
    a duplicate being added. Safe to call from a background thread;
    never raises."""
    try:
        service = _get_sheets_service()
        if not service:
            return
        cid = _correction_id(email, slug, word)
        row_values = [
            cid, datetime.now().isoformat(), username or "", email, slug, word,
            proof or "", sandhi or "", anvaya or "", original or "", edited or "",
        ]
        with _sheets_write_lock:
            existing_tab = _index_get(service, cid)
            if existing_tab is not None:
                row_num = _find_row_by_id(service, existing_tab, cid)
                if row_num is not None:
                    service.spreadsheets().values().update(
                        spreadsheetId=GOOGLE_SHEET_ID, range=f"'{existing_tab}'!A{row_num}:K{row_num}",
                        valueInputOption="RAW", body={"values": [row_values]},
                    ).execute()
                    return
                # Index pointed at a tab/row that no longer exists (e.g. the
                # tab or row was deleted by hand) -- fall through and treat
                # this as a new row instead of losing the correction.
            tab_title = datetime.now().strftime("%Y-%m-%d")
            _ensure_tab(service, tab_title, _SHEET_HEADER_ROW)
            service.spreadsheets().values().append(
                spreadsheetId=GOOGLE_SHEET_ID, range=f"'{tab_title}'!A1",
                valueInputOption="RAW", insertDataOption="INSERT_ROWS",
                body={"values": [row_values]},
            ).execute()
            _index_set(service, cid, tab_title)
    except Exception as e:
        print(f"[Sheets] Save/update failed (correction is still saved in SQLite): {e}")


def delete_correction_from_sheet(email, slug, word):
    """Remove this correction's row from wherever it currently lives, and
    clean up its index entry. Safe to call from a background thread;
    never raises."""
    try:
        service = _get_sheets_service()
        if not service:
            return
        cid = _correction_id(email, slug, word)
        with _sheets_write_lock:
            tab_title = _index_get(service, cid)
            if tab_title is None:
                return  # never synced to Sheets (e.g. created before creds were set up)
            row_num = _find_row_by_id(service, tab_title, cid)
            if row_num is not None:
                _delete_row(service, tab_title, row_num)
            _index_delete(service, cid)
    except Exception as e:
        print(f"[Sheets] Delete failed (correction is still deleted in SQLite): {e}")

# A short-lived write lock — SQLite handles concurrent reads fine in WAL
# mode, but serializing writes avoids "database is locked" errors when
# several accounts save edits/progress at the same moment.
_db_write_lock = threading.Lock()


def get_db():
    """Open a fresh connection for this request/thread.
    check_same_thread=False is safe here because every call site opens
    its own short-lived connection rather than sharing one across threads."""
    conn = sqlite3.connect(DB_PATH, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _lookup_username(email):
    """Best-effort fallback: look up the account's display name from the
    users table when the frontend didn't already send one along with a
    save. Returns '' (never raises) if the account can't be found."""
    if not email:
        return ""
    try:
        conn = get_db()
        try:
            row = conn.execute("SELECT username FROM users WHERE email = ?", (email,)).fetchone()
        finally:
            conn.close()
        return row["username"] if row else ""
    except Exception as e:
        print(f"[WARN] username lookup failed for {email}: {e}")
        return ""


def init_db():
    conn = get_db()
    try:
        conn.executescript("""
            -- Basic account table.
            CREATE TABLE IF NOT EXISTS users (
                email       TEXT PRIMARY KEY,
                username    TEXT NOT NULL,
                password    TEXT NOT NULL,
                created_at  TEXT NOT NULL
            );

            -- PER-USER: the full proof-text edit a user has made for a
            -- chapter (the proof editor works on the whole text, so this
            -- stores one override string per (email, slug) rather than
            -- per line). The underlying chapter JSON is untouched.
            CREATE TABLE IF NOT EXISTS user_proof_edits (
                email       TEXT NOT NULL,
                slug        TEXT NOT NULL,
                content     TEXT NOT NULL,
                updated_at  TEXT NOT NULL,
                PRIMARY KEY (email, slug)
            );

            -- PER-USER: a single sandhi-split token override, addressed
            -- by (line_index, token_index) within the chapter's content
            -- array. Lets one user pick a different split for one token
            -- without touching anyone else's view of the chapter.
            CREATE TABLE IF NOT EXISTS user_sandhi_edits (
                email       TEXT NOT NULL,
                slug        TEXT NOT NULL,
                line_index  INTEGER NOT NULL,
                token_index INTEGER NOT NULL,
                edited      TEXT NOT NULL,
                updated_at  TEXT NOT NULL,
                PRIMARY KEY (email, slug, line_index, token_index)
            );

            -- PER-USER: each account's own morph-analysis word edits,
            -- scoped by (email, slug, word) so editing never overwrites
            -- another account's correction for the same word.
            CREATE TABLE IF NOT EXISTS user_morph_corrections (
                email       TEXT NOT NULL,
                slug        TEXT NOT NULL,
                word        TEXT NOT NULL,
                edited      TEXT,
                original    TEXT,
                updated_at  TEXT NOT NULL,
                PRIMARY KEY (email, slug, word)
            );

            -- PER-USER: progress tracking per (email, slug, tool).
            CREATE TABLE IF NOT EXISTS user_progress (
                email       TEXT NOT NULL,
                slug        TEXT NOT NULL,
                tool        TEXT NOT NULL,
                status      TEXT,
                updated_at  TEXT NOT NULL,
                PRIMARY KEY (email, slug, tool)
            );

            -- PER-USER: caches the raw computed proof/sandhi/lt-proc
            -- output for a chapter that was analysed live (no
            -- precomputed corpus JSON), so reopening it doesn't need
            -- to re-run lt-proc. Replaces what used to be a
            -- localStorage cache -- this is SQLite-only, like
            -- everything else per-user.
            CREATE TABLE IF NOT EXISTS user_analysis_cache (
                email        TEXT NOT NULL,
                slug         TEXT NOT NULL,
                full_output  TEXT NOT NULL,
                proof_lines  TEXT NOT NULL,
                sandhi_lines TEXT NOT NULL,
                input_text   TEXT NOT NULL,
                updated_at   TEXT NOT NULL,
                PRIMARY KEY (email, slug)
            );

            -- Login sessions. The browser only ever holds an opaque,
            -- HttpOnly cookie token pointing at a row here -- no user
            -- data or identity lives in the browser's own storage.
            CREATE TABLE IF NOT EXISTS sessions (
                token       TEXT PRIMARY KEY,
                email       TEXT NOT NULL,
                created_at  TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_user_morph_email_slug
                ON user_morph_corrections(email, slug);
            CREATE INDEX IF NOT EXISTS idx_user_progress_email
                ON user_progress(email, slug, tool);
        """)
        conn.commit()
        print("✓ SQLite schema ready (accounts + per-user edits only):", DB_PATH)
    finally:
        conn.close()


# ─── PASSWORD HASHING ───────────────────────────────────────
# PBKDF2-HMAC-SHA256 with a random per-user salt. Stored in the
# users.password column as "salt_hex$hash_hex" so no plaintext
# password is ever written to SQLite.
_PBKDF2_ITERATIONS = 200_000


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), _PBKDF2_ITERATIONS)
    return f"{salt}${digest.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt, hex_digest = stored.split("$", 1)
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), _PBKDF2_ITERATIONS)
    return hmac.compare_digest(digest.hex(), hex_digest)


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ─── CHAPTERS: read straight from JSON files on disk ───────────────
# No import step, no caching into SQLite. Every request that needs
# corpus content re-reads the JSON files directly, so editing/adding a
# file on disk takes effect immediately for every account -- no restart.
#
# CHAPTERS_DIR can be anywhere on disk (it does NOT have to live next to
# server.py). To point it at your own folder, either:
#   - set the environment variable VANMAYI_CHAPTERS_DIR before starting
#     the server, e.g. (WSL/Linux):
#         export VANMAYI_CHAPTERS_DIR="/mnt/c/Users/sinch/OneDrive/Desktop/morph/output"
#     or (Windows):
#         set VANMAYI_CHAPTERS_DIR=C:\Users\sinch\OneDrive\Desktop\morph\output
#   - or just edit _CHAPTERS_DIR_CANDIDATES below.
#
# Chapters can be organised in nested folders, e.g.:
#     output/
#       Charaka Samhita/
#         Kalpa Sthana/
#           kalpastanam_ch1.json
#           kalpastanam_ch2.json
#         Cikitsa Sthana/
#           cikitsa_ch1.json
# The folder names become the file-tree grouping (sthana → subfolder)
# automatically -- a chapter's JSON only needs to declare "sthana"/
# "subfolder" itself if you want to override what the folder name would
# otherwise produce.
_CHAPTERS_DIR_CANDIDATES = [
    os.environ.get("VANMAYI_CHAPTERS_DIR"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "chapters"),
    r"C:\Users\sinch\OneDrive\Desktop\morph\output",
    "/mnt/c/Users/sinch/OneDrive/Desktop/morph/output",
]
CHAPTERS_DIR = next(
    (p for p in _CHAPTERS_DIR_CANDIDATES if p and os.path.isdir(p)),
    _CHAPTERS_DIR_CANDIDATES[1],
)

# Folder-name → display-name map, used only when a chapter's own JSON
# doesn't declare "subfolder" itself. Extend this as you add more
# sthana folders.
_SUBFOLDER_DISPLAY_NAMES = {
    "kalpa": "Kalpa Sthānam",
    "kalpasthana": "Kalpa Sthānam",
    "cikitsa": "Cikitsā Sthānam",
    "chikitsa": "Cikitsā Sthānam",
    "indriya": "Indriya Sthānam",
    "sutra": "Sūtra Sthānam",
    "sutrasthana": "Sūtra Sthānam",
    "nidhana": "Nidāna Sthānam",
    "vimana": "Vimāna Sthānam",
    "sharira": "Śārīra Sthānam",
    "sarira": "Śārīra Sthānam",
    "siddi": "Siddhi Sthānam",
}

# Top-level ("sthana") folder-name -> display-name map. Same idea as
# _SUBFOLDER_DISPLAY_NAMES above, but for path_parts[0] -- which used to
# be shown completely raw (whatever the folder is literally named on
# disk), so "ashtangahrudaya" / "vivekachudamani" / "yoga" showed up
# lowercase and un-transliterated in the sidebar instead of properly
# formatted. Extend this as you add more top-level corpora.
_STHANA_DISPLAY_NAMES = {
    "ashtangahrudaya": "Ashtangahrudaya",
    "ashtanga": "Ashtangahrudaya",
    "vivekachudamani": "Vivekachudamani",
    "yoga": "Yoga",
}


def _derive_subfolder_name(folder_name):
    key = folder_name.strip().lower().replace(" ", "").replace("_", "").replace("-", "")
    return _SUBFOLDER_DISPLAY_NAMES.get(key, folder_name.strip())


def _derive_sthana_name(folder_name):
    key = folder_name.strip().lower().replace(" ", "").replace("_", "").replace("-", "")
    return _STHANA_DISPLAY_NAMES.get(key, folder_name.strip())


def _derive_sthana_and_subfolder(path_parts):
    """path_parts is the list of folder names between CHAPTERS_DIR and a
    chapter file. No folders -> ungrouped. One folder -> that folder is
    the subfolder, sthana defaults to Charaka Saṃhitā. Two or more ->
    the first is the sthana, the second is the subfolder."""
    if not path_parts:
        return "Charaka Saṃhitā", "General"
    if len(path_parts) == 1:
        return "Charaka Saṃhitā", _derive_subfolder_name(path_parts[0])
    return _derive_sthana_name(path_parts[0]), _derive_subfolder_name(path_parts[1])


def _walk_chapter_files():
    """Yield (abs_path, path_parts, filename) for every .json file
    anywhere under CHAPTERS_DIR, at any folder depth."""
    if not os.path.isdir(CHAPTERS_DIR):
        return
    for root, _dirs, files in sorted(os.walk(CHAPTERS_DIR)):
        rel_root = os.path.relpath(root, CHAPTERS_DIR)
        path_parts = [] if rel_root == "." else rel_root.split(os.sep)
        for fname in sorted(files):
            if fname.lower().endswith(".json"):
                yield os.path.join(root, fname), path_parts, fname


def _load_chapter_file(abs_path):
    with open(abs_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _walk_chapter_files_with_slugs():
    """Like _walk_chapter_files(), but also resolves each file's slug --
    and, critically, de-duplicates slugs that collide across files.

    Several exported chapter JSONs (e.g. multiple files that each declare
    "slug": "yoga") share the exact same slug. Because both list_chapters()
    (sidebar) and get_chapter_by_slug() (fetch-on-click) used to derive the
    slug independently and trust the JSON's own value verbatim, every
    sidebar entry with a colliding slug ended up resolving to whichever
    one of those files os.walk() happened to reach first -- so of three
    "yoga" entries in the tree, only one file's content was ever reachable,
    no matter which entry you clicked.

    This is the single place both functions now go through, so the slug
    each one computes for a given file is always the same. The first file
    encountered for a given base slug keeps that slug unchanged (so any
    already-saved per-user edits for it keep working); later files with
    the same base slug get "_2", "_3", ... appended.
    """
    seen_counts = {}
    for abs_path, path_parts, fname in _walk_chapter_files():
        try:
            data = _load_chapter_file(abs_path)
        except Exception as e:
            print(f"[chapters] skipping {fname}: {e}")
            continue
        base_slug = (data.get("slug") or os.path.splitext(fname)[0]).strip()
        n = seen_counts.get(base_slug, 0) + 1
        seen_counts[base_slug] = n
        slug = base_slug if n == 1 else f"{base_slug}_{n}"
        if n == 2:
            # Only warn once per colliding slug, the moment the collision
            # is first detected, so this doesn't spam the console.
            print(f"[chapters] ⚠️  duplicate slug \"{base_slug}\" -- \"{fname}\" "
                  f"is now served as \"{slug}\". Give it its own \"slug\" in "
                  f"the JSON to make this permanent/predictable.")
        yield slug, abs_path, path_parts, fname, data


def _normalize_verse_entry(entry):
    """Some chapters (Aṣṭāṅgahṛdayam Sūtrasthānam, Vivekacūḍāmaṇi) store
    one JSON object per *verse* instead of one per *line*:
        {
          "sloka": "...", "padacheda": "...", "anvaya": "...",
          "lines": [ {"proof": "...", "sandhi": "...", "output": [...]}, ... ],
          "anvaya_output": [ {"anvaya": "...", "output": [...]} ]
        }
    Every other part of the app (proof text, sandhi view, the precomputed
    morph renderer, and the per-line sandhi/morph edit overlay) only knows
    how to read the flat {"proof", "sandhi", "output"} shape used by the
    other corpora. Because these entries have no top-level "proof"/
    "sandhi"/"output" at all, they were silently invisible everywhere --
    which is why these two chapters didn't open.

    This flattens each verse into its per-line entries (from "lines"),
    and -- since the anvaya (word-order rearrangement) was being dropped
    entirely -- appends it as one more entry so it renders as its own row
    instead of being lost.
    """
    lines = entry.get("lines")
    if not isinstance(lines, list):
        # Already flat -- nothing to do.
        return [entry]

    anvaya = (entry.get("anvaya") or "").strip()

    flat = []
    for line in lines:
        if isinstance(line, dict):
            flat_line = {
                "proof": line.get("proof", ""),
                "sandhi": line.get("sandhi", ""),
                "output": line.get("output", []),
            }
            # Carry the verse's anvaya (word-order rearrangement) onto
            # each of its own lines too -- not just the synthetic अन्वयः
            # row appended below -- purely as extra context data. Nothing
            # in the renderer reads this key, but it lets a correction
            # saved from any line in this verse report its anvaya
            # alongside proof/sandhi (e.g. into the Google Sheets log).
            if anvaya:
                flat_line["anvaya"] = anvaya
            flat.append(flat_line)

    if anvaya:
        anvaya_output = []
        ao = entry.get("anvaya_output")
        if isinstance(ao, list) and ao and isinstance(ao[0], dict):
            anvaya_output = ao[0].get("output", [])
        flat.append({
            "proof": "",
            "sandhi": anvaya,
            "output": anvaya_output,
            "label": "अन्वयः",
            "anvaya": anvaya,
        })

    return flat if flat else [entry]


def _normalize_chapter_content(chapter):
    """Flatten any per-verse (sloka/lines/anvaya) entries in a chapter's
    "content" into the flat per-line shape the rest of the app expects.
    No-op for chapters that are already flat (yoga, Charaka Saṃhitā, ...)."""
    content = chapter.get("content")
    if not isinstance(content, list):
        return chapter
    new_content = []
    for entry in content:
        if isinstance(entry, dict):
            new_content.extend(_normalize_verse_entry(entry))
        else:
            new_content.append(entry)
    chapter = dict(chapter)
    chapter["content"] = new_content
    return chapter


# ── Sanskrit ordinal chapter-number parsing ─────────────────────────
# Chapter titles here are of the form STEM + "ोऽध्यायः" (sandhi of the
# ordinal's visarga -अः with the अ of अध्यायः, e.g. "प्रथम" + "ऽध्यायः"
# -> "प्रथमोऽध्यायः"). Since nothing else in these files encodes the
# chapter number, this table lets the server read it straight out of
# the title text. Covers 1-40, which comfortably covers every sthāna
# in Charaka Saṃhitā (the longest, Sūtra/Cikitsā, has 30 chapters).
_ORDINAL_WORD_TO_NUM = {
    "प्रथम": 1, "द्वितीय": 2, "तृतीय": 3, "चतुर्थ": 4, "पञ्चम": 5,
    "षष्ठ": 6, "सप्तम": 7, "अष्टम": 8, "नवम": 9, "दशम": 10,
    "एकादश": 11, "द्वादश": 12, "त्रयोदश": 13, "चतुर्दश": 14, "पञ्चदश": 15,
    "षोडश": 16, "सप्तदश": 17, "अष्टादश": 18, "ऊनविंश": 19, "विंश": 20,
    "एकविंश": 21, "द्वाविंश": 22, "त्रयोविंश": 23, "चतुर्विंश": 24, "पञ्चविंश": 25,
    "षड्विंश": 26, "सप्तविंश": 27, "अष्टाविंश": 28, "ऊनत्रिंश": 29, "त्रिंश": 30,
    "एकत्रिंश": 31, "द्वात्रिंश": 32, "त्रयस्त्रिंश": 33, "चतुस्त्रिंश": 34, "पञ्चत्रिंश": 35,
    "षट्त्रिंश": 36, "सप्तत्रिंश": 37, "अष्टात्रिंश": 38, "ऊनचत्वारिंश": 39, "चत्वारिंश": 40,
}
# Longest stem first, so e.g. "एकविंश" (21) is tried before the shorter
# "विंश" (20) that is a suffix of it -- avoids matching the wrong number.
_ORDINAL_WORDS_BY_LEN = sorted(_ORDINAL_WORD_TO_NUM, key=len, reverse=True)
_ADHYAYA_SUFFIX = "ोऽध्यायः"


def _ordinal_chapter_number(*texts):
    """Look for a Sanskrit ordinal word immediately followed by the
    'ऽध्यायः' (chapter) suffix in any of the given strings, and return
    the chapter number it names, or None if no match is found."""
    for text in texts:
        if not text:
            continue
        if _ADHYAYA_SUFFIX not in text:
            continue
        for word in _ORDINAL_WORDS_BY_LEN:
            if (word + _ADHYAYA_SUFFIX) in text:
                return _ORDINAL_WORD_TO_NUM[word]
    return None


def _chapter_order_key(data, fname):
    """Numeric sort key for a chapter, so the sidebar lists chapters in
    real chapter order (1, 2, 3 ... 10, 11, 12) instead of alphabetical
    filename/title order (which scrambles as soon as chapter names are
    Sanskrit ordinal words -- "दशमः" (10) sorts before "एकादशः" (11)
    alphabetically, etc).

    Preference order:
      1. an explicit "order" (or "chapter_number") field in the JSON --
         the most reliable, if you have it.
      2. the Sanskrit ordinal word embedded in the title/name (e.g.
         "प्रथमोऽध्यायः" -> 1, "एकादशोऽध्यायः" -> 11) -- this is what
         fires for your current files, with no changes needed to them.
      3. a leading number in the slug or filename (e.g. "10_..." or
         "chapter-10"), if present.
      4. fall back so unordered chapters sort to the end instead of
         scrambling the ones that ARE ordered.
    """
    explicit = data.get("order", data.get("chapter_number"))
    if isinstance(explicit, (int, float)):
        return (0, explicit)

    ordinal = _ordinal_chapter_number(data.get("title"), data.get("name"), fname)
    if ordinal is not None:
        return (0, ordinal)

    for candidate in (data.get("slug") or "", fname):
        m = re.search(r"\d+", candidate)
        if m:
            return (0, int(m.group()))

    return (1, 0)


# Slug -> real display title, for chapter files whose own JSON doesn't
# set a distinguishing "title"/"name" (e.g. all three files under
# yoga/ fell back to the shared slug "yoga"/"yoga_2"/"yoga_3"). The
# cleanest long-term fix is to add "title"/"name" directly to each
# chapter's JSON -- that's the single source of truth everywhere else
# in the app -- but this override keeps the sidebar/heading correct in
# the meantime, or for files you'd rather not touch.
#
# NOTE: which physical file becomes "yoga" vs "yoga_2" vs "yoga_3" is
# decided by _walk_chapter_files_with_slugs() in on-disk filename sort
# order (the first file os.walk() reaches keeps the bare slug). Double
# check the sidebar order matches SY Yoga Sūtra -> SY Gheraṇḍa Saṃhitā
# -> HYP after this change, and swap the values below if it doesn't.
_TITLE_OVERRIDES = {
    "yoga": "SY Yoga Sutra",
    "yoga_2": "SY Gheranda Samhita",
    "yoga_3": "HYP",
}


def _apply_title_override(slug, data):
    override = _TITLE_OVERRIDES.get(slug)
    if override is None:
        return data.get("title", slug), data.get("name", data.get("title", slug))
    return override, override


def list_chapters():
    """Scan CHAPTERS_DIR (recursively) and return lightweight metadata for
    every chapter JSON file -- used to build the file tree without
    loading full content."""
    out = []
    for slug, abs_path, path_parts, fname, data in _walk_chapter_files_with_slugs():
        derived_sthana, derived_subfolder = _derive_sthana_and_subfolder(path_parts)
        title, name = _apply_title_override(slug, data)
        out.append({
            "slug": slug,
            "title": title,
            "name": name,
            "sthana": data.get("sthana") or derived_sthana,
            "subfolder": data.get("subfolder") or derived_subfolder,
            "filename": fname,
            "_order_key": _chapter_order_key(data, fname),
        })

    # Sort within each (sthana, subfolder) group by the numeric order key,
    # falling back to filename. _buildFileTree() in db.js groups entries
    # by sthana/subfolder in the order it encounters them in this list,
    # so sorting here is what fixes the sidebar ordering.
    out.sort(key=lambda e: (e["sthana"], e["subfolder"], e["_order_key"], e["filename"]))
    for e in out:
        del e["_order_key"]
    return out


def get_chapter_by_slug(slug):
    """Read one chapter's JSON fresh from disk (resolving the same
    de-duplicated slug list_chapters() built the sidebar from), and
    flatten any per-verse (sloka/lines/anvaya) entries before returning.
    Returns None if not found."""
    for s, abs_path, _path_parts, fname, data in _walk_chapter_files_with_slugs():
        if s == slug:
            return _normalize_chapter_content(data)
    return None



def _apply_user_overlay(chapter, slug, email):
    """Merge one user's saved edits on top of the base chapter JSON.
    Never mutates anything on disk -- returns a new dict."""
    content = [dict(c) for c in chapter.get("content", [])]
    title, _name = _apply_title_override(slug, chapter)
    result = {
        "success": True,
        "slug": slug,
        "title": title,
        "content": content,
        "proofOverride": None,
    }
    if not email:
        return result

    conn = get_db()
    try:
        proof_row = conn.execute(
            "SELECT content FROM user_proof_edits WHERE email=? AND slug=?",
            (email, slug),
        ).fetchone()
        if proof_row:
            result["proofOverride"] = proof_row["content"]

        sandhi_rows = conn.execute(
            "SELECT line_index, token_index, edited FROM user_sandhi_edits "
            "WHERE email=? AND slug=?",
            (email, slug),
        ).fetchall()
        sandhi_overrides = {}
        for r in sandhi_rows:
            sandhi_overrides.setdefault(r["line_index"], {})[r["token_index"]] = r["edited"]

        morph_rows = conn.execute(
            "SELECT word, edited, original FROM user_morph_corrections "
            "WHERE email=? AND slug=?",
            (email, slug),
        ).fetchall()
        morph_overrides = {r["word"]: r["edited"] for r in morph_rows}
    finally:
        conn.close()

    for i, entry in enumerate(content):
        # sandhi token overrides
        if i in sandhi_overrides and entry.get("sandhi"):
            tokens = [t.strip() for t in entry["sandhi"].split("+")]
            for tok_idx, edited in sandhi_overrides[i].items():
                if 0 <= tok_idx < len(tokens):
                    tokens[tok_idx] = edited
            entry["sandhi"] = "+".join(tokens)

        # morph output overrides -- only meaningful for the grouped
        # {word, analyses} shape; flat string exports are left as-is.
        output = entry.get("output")
        if isinstance(output, list) and output and isinstance(output[0], dict):
            new_output = []
            for w in output:
                w = dict(w)
                word = w.get("word", "")
                if word in morph_overrides:
                    edited = morph_overrides[word]
                    w["analyses"] = [edited] + [a for a in (w.get("analyses") or []) if a != edited]
                    w["source"] = "user_correction"
                new_output.append(w)
            entry["output"] = new_output

    return result


init_db()
_chapters_at_start = list_chapters()
print(f"✓ Chapters directory: {CHAPTERS_DIR}")
if not os.path.isdir(CHAPTERS_DIR):
    print("  ⚠️  This folder does not exist. Create it, or set the VANMAYI_CHAPTERS_DIR")
    print("     environment variable to point at your real chapters folder, then restart.")
elif not _chapters_at_start:
    print("  ⚠️  No .json chapter files found anywhere under this folder.")
else:
    print(f"  Found {len(_chapters_at_start)} chapter(s):")
    for c in _chapters_at_start:
        print(f"    - [{c['sthana']} / {c['subfolder']}] {c['slug']}  ({c['filename']})")

# LT-PROC paths
LT_PROC_BINS = [
    r"/mnt/c/Users/sinch/OneDrive/Desktop/morph/bin/finalmaha.bin",
    r"/mnt/c/Users/sinch/OneDrive/Desktop/morph/bin/wif.bin",
    r"/mnt/c/Users/sinch/OneDrive/Desktop/morph/bin/waxXiwa.bin",
    r"/mnt/c/Users/sinch/OneDrive/Desktop/morph/bin/kqw.bin",
]
FINALMAHA_BIN = LT_PROC_BINS[0]

# ─── VIBHAKTI MAP ──────────────────────────────────────────
VIBHAKTI_MAP = {
    "१": "प्रथमा", "२": "द्वितीया", "३": "तृतीया", "४": "चतुर्थी",
    "५": "पञ्चमी", "६": "षष्ठी", "७": "सप्तमी", "८": "सम्बोधना",
}

# ─── OUTPUT-DISPLAY OVERRIDES (wif.bin / waxXiwa.bin / kqw.bin only) ─
# For these three bins the client wants:
#   - lakara-suffixed tags like "शतृ_लट्" displayed as just "शतृ"
#   - the "ध्" anubandha marker dropped from the displayed analysis
# This does NOT affect finalmaha.bin or split-search output.
TRIM_FILTER_BINS = ("wif.bin", "waxXiwa.bin", "kqw.bin")


def _is_trim_filter_bin(source_bin):
    return any(b in source_bin for b in TRIM_FILTER_BINS)


def _trim_lakara_suffix(val_dev):
    # e.g. "शतृ_लट्" -> "शतृ"  (keep only what's before the first "_")
    return val_dev.split("_")[0] if "_" in val_dev else val_dev


# ─── TRANSLITERATION ───────────────────────────────────────
def wx_to_deva(text):
    try:
        from aksharamukha.transliterate import process
        return process("WX", "Devanagari", text)
    except Exception:
        return text

def deva_to_wx(text):
    try:
        from aksharamukha.transliterate import process
        return process("Devanagari", "WX", text)
    except Exception:
        return text

# ─── CLEAN TEXT ────────────────────────────────────────────
def clean_text(text: str) -> str:
    text = text.replace("ऽ", "अ")
    text = re.sub(r"([\u0900-\u097F]):", r"\1ः", text)
    text = re.sub(r"॥\d+॥", " ", text)
    text = re.sub(r"[।॥]", " ", text)
    text = text.replace("+", " ")
    # '-' joins members of a multi-member compound (e.g. a long Dvandva
    # list like "श्यामा-त्रिवृच्चतुरङ्गुल-तिल्वक-..."). Drop it (rather than
    # turning it into a space) so the joined members fuse into one word —
    # "फलजीमूतकेक्ष्वाकु-धामार्गव-..." becomes "फलजीमूतकेक्ष्वाकुधामार्गव..."
    # — which is then looked up in lt-proc as a single token.
    text = text.replace("-", "")
    text = re.sub(r"[^\s\u0900-\u097F]", " ", text)
    words = []
    for w in text.split():
        if w.endswith("ं"):
            w = w[:-1] + "म्"
        words.append(w)
    return " ".join(words)

# ─── LT-PROC ───────────────────────────────────────────────
def run_ltproc(tokens, bin_path):
    proc = subprocess.Popen(
        ["wsl", "lt-proc", "-c", bin_path],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    stdout, stderr = proc.communicate("\n".join(tokens))
    if proc.returncode != 0:
        raise RuntimeError(stderr)
    return stdout

def is_unknown_output(out):
    return all("/*" in l for l in out.strip().splitlines())

def is_devanagari_number(word):
    return all("०" <= ch <= "९" for ch in word)

def generate_suffixes(word):
    # Shortest suffix (last 2 letters) FIRST, growing outward toward the
    # full word LAST -- i.e. i counts DOWN from len(word)-2 to 0, so
    # word[i:] starts at a 2-letter tail and gets one letter longer each
    # step until it's the whole word.
    return [word[i:] for i in range(len(word) - 2, -1, -1)]

def split_search_finalmaha(wx_word):
    suffixes = generate_suffixes(wx_word)
    print(f"    [split] word='{wx_word}'  trying {len(suffixes)} suffixes, "
          f"shortest-first: {suffixes}")

    for suffix_wx in suffixes:
        # If the word ends in the bare "mA" ending, that 2-letter suffix
        # on its own is too ambiguous/noisy to search against
        # finalmaha.bin -- skip it and fall through to the next
        # (longer) suffix instead, e.g. for "parAwmA" skip "mA" and go
        # straight on to "wmA", "AwmA", etc.
        if suffix_wx == "mA" and wx_word.endswith("mA"):
            print(f"    [split] --- suffix '{suffix_wx}' is the bare 'mA' ending "
                  f"-- skipping this suffix and moving to the next longer one")
            continue

        prefix_wx = wx_word[: -len(suffix_wx)] if wx_word.endswith(suffix_wx) else ""
        print(f"    [split] --- trying suffix '{suffix_wx}' "
              f"(prefix would be '{prefix_wx}') against finalmaha.bin")
        try:
            out = run_ltproc([suffix_wx], FINALMAHA_BIN)
            print(f"    [split]     raw lt-proc output: {out.strip()!r}")

            if is_unknown_output(out):
                print(f"    [split]     -> unknown to finalmaha.bin, skipping suffix '{suffix_wx}'")
                continue

            fixed = []
            for line in out.strip().splitlines():
                if not line.startswith("^"):
                    continue
                parts = line.split("/")
                parts[0] = f"^{wx_word}"
                new_parts = [parts[0]]
                for p in parts[1:]:
                    if p.startswith("*"):
                        continue
                    lemma_wx = p.split("<")[0]
                    tags = p[len(lemma_wx):]
                    candidate_wx = prefix_wx + lemma_wx + tags
                    candidate_deva = wx_to_deva(candidate_wx)
                    lemma_deva = wx_to_deva(lemma_wx)          # <-- check the OUTPUT lemma only

                    if "सर्व" in lemma_deva:                    # <-- was: "सर्व" in candidate_deva
                        print(f"    [split]     candidate '{candidate_wx}' -> '{candidate_deva}' "
                            f"rejected (lt-proc lemma '{lemma_deva}' is सर्वादि/pronoun-paradigm fallback)")
                        continue

                    print(f"    [split]     candidate '{candidate_wx}' -> '{candidate_deva}' accepted")
                    new_parts.append(candidate_wx)
                if len(new_parts) > 1:
                    fixed.append("/".join(new_parts))

            if fixed:
                print(f"    [split] >>> MATCH on suffix '{suffix_wx}' "
                      f"(prefix '{prefix_wx}' + lemma from suffix)")
                return {"output": "\n".join(fixed), "suffix": suffix_wx}
            else:
                print(f"    [split]     all readings on suffix '{suffix_wx}' were rejected "
                      f"(e.g. सर्व-tagged) -- treating as not found, trying shorter suffix")
        except Exception as e:
            print("Split error:", e)

    print(f"    [split] no suffix of '{wx_word}' matched anything "
          f"(tried shortest-to-longest, up to and including the whole word) -- split search failed")
    return None

def normalize_tags(tags):
    mapping = {"ना": "नाम", "अव्य्": "अव्ययम्", "उ": "उत्तम"}
    result = []
    for t in tags:
        t = mapping.get(t, t)
        t = VIBHAKTI_MAP.get(t, t)
        result.append(t)
    return result

# ---------------- FIX WIF / WAXXITA FORMAT ----------------
# ---------------- FIX WIF / KQW / WAXXITA FORMAT ----------------
def fix_wif_kqw_format(text, source_bin, original_word=None):
    """
    FORMAT RULES

    KQW:
        अन्विच्छत् नाम पुं प्रथमा एक ;
        इष्२ अनु शतृ_लट् ध् इषुँ तुदादिः

    WIF WITH UPASARGA:
        वि_आङ्_ख्या कर्तरि लृट् उत्तम बहु ;
        ख्या अदादिः परस्मैपदी

    WIF WITHOUT UPASARGA:
        कर्तरि लट् प्र एक ;
        ब्रू अदादिः परस्मैपदी
    """

    tokens = text.split()

    if not tokens:
        return text

    # =====================================================
    # KQW FORMAT
    # =====================================================
    if "kqw.bin" in source_bin:

        varga_markers = {
            "नाम",
            "अव्ययम्",
        }

        varga_idx = None

        for i, token in enumerate(tokens):
            if token in varga_markers:
                varga_idx = i
                break

        if varga_idx is None:
            return text

        lemma_idx = varga_idx - 1

        if lemma_idx < 0:
            return text

        kqw_lemma = tokens[lemma_idx]

        kqw_info = tokens[:lemma_idx]
        nominal_info = tokens[varga_idx:]

        left_side = " ".join(
            [kqw_lemma] + nominal_info
        ).strip()

        right_side = " ".join(
            kqw_info
        ).strip()

        return f"{left_side} ; {right_side}"

    # =====================================================
    # APPLY WIF FORMAT ONLY TO WIF / WAXXIWA
    # =====================================================
    if not any(
        bin_name in source_bin
        for bin_name in ("wif.bin", "waxXiwa.bin")
    ):
        return text

    # =====================================================
    # FIRST TOKEN = DHATU
    # =====================================================
    lemma = re.sub(r"\d+", "", tokens[0])

    prayoga_markers = {
        "कर्तरि",
        "कर्मणि",
        "भावे",
    }

    pada_markers = {
        "परस्मैपदी",
        "आत्मनेपदी",
    }

    prayoga_idx = None

    for i, token in enumerate(tokens):
        if token in prayoga_markers:
            prayoga_idx = i
            break

    if prayoga_idx is None:
        return text

    upasargas = tokens[1:prayoga_idx]

    pada_idx = None

    for i in range(prayoga_idx, len(tokens)):
        if tokens[i] in pada_markers:
            pada_idx = i
            break

    if pada_idx is None:
        return text

    pada = tokens[pada_idx]

    left_grammar = tokens[prayoga_idx:pada_idx]
    right_grammar = tokens[pada_idx + 1:]

    # =====================================================
    # LEFT SIDE
    # =====================================================
    if upasargas:
        # वि_आङ्_ख्या
        left_word = "_".join(upasargas + [lemma])

        left_side = " ".join(
            [left_word] + left_grammar
        ).strip()

    else:
        # UI already displays the word separately.
        # Don't repeat it in the analysis.
        left_side = " ".join(left_grammar).strip()

    # =====================================================
    # RIGHT SIDE
    # =====================================================
    if upasargas:
        # ख्या अदादिः परस्मैपदी
        right_side = " ".join(
            right_grammar + [pada]
        ).strip()
    else:
        # ब्रू अदादिः परस्मैपदी
        right_side = " ".join(
            [lemma] + right_grammar + [pada]
        ).strip()

    return f"{left_side} ; {right_side}"
# ---------------- PARSE OUTPUT ----------------
def parse_output(out_with_source, original_word_wx):
    """
    Parse each / separated lt-proc reading as ONE complete analysis.
    """

    original_deva = wx_to_deva(original_word_wx)
    all_analyses = []

    for raw_output, source_bin, suffix in out_with_source:
        is_split_result = suffix is not None
        # Only wif.bin / waxXiwa.bin / kqw.bin get the "शतृ_लट्"->"शतृ"
        # trim and the "ध्" filter applied to their displayed output.
        trim_filter = _is_trim_filter_bin(source_bin)

        for line in raw_output.strip().splitlines():
            if not line.startswith("^"):
                continue

            parts = line.strip("^$").split("/")

            for p in parts[1:]:
                if p.startswith("*"):
                    continue

                p = p.strip()
                if not p:
                    continue

                elements = []

                # Text before first <
                lemma_wx = p.split("<", 1)[0]

                if lemma_wx:
                    lemma = wx_to_deva(lemma_wx)

                    if (
                        original_deva.endswith("त्वम्")
                        and "युष्मद्" in lemma
                    ):
                        continue

                    elements.append(lemma)

                pattern = re.compile(r"<([^>]+)>|([^<]+)")

                for tag_content, plain_text in pattern.findall(p):

                    # ---------------- TAG ----------------
                    if tag_content:
                        if ":" not in tag_content:
                            continue

                        key, val = tag_content.split(":", 1)

                        key_dev = wx_to_deva(key)
                        val_dev = wx_to_deva(val.strip())

                        # Ignore level tags
                        if "लेवेल्" in key_dev:
                            continue

                        if trim_filter:
                            # e.g. "शतृ_लट्" -> "शतृ"
                            val_dev = _trim_lakara_suffix(val_dev)

                        # Show "कृत्" before kqw pratyaya only
                        if (
                            source_bin.endswith("kqw.bin")
                            and key == "kqw_prawyayaH"
                        ):
                            elements.append(f"कृत् {val_dev}")
                        else:
                            elements.append(val_dev)

                    # ---------------- TEXT BETWEEN TAGS ----------------
                    elif plain_text:
                        plain_text = plain_text.strip()

                        if not plain_text:
                            continue

                        if lemma_wx and plain_text == lemma_wx:
                            continue

                        plain_dev = wx_to_deva(plain_text)

                        if plain_dev:
                            elements.append(plain_dev)

                elements = normalize_tags(elements)

                elements = [
                    t for t in elements
                    if t != "अ"
                ]

                if trim_filter:
                    # drop the bare "ध्" anubandha marker from display
                    elements = [t for t in elements if t != "ध्"]

                if (
                    is_split_result
                    and "अव्ययम्" in elements
                ):
                    continue

                analysis_text = " ".join(elements).strip()

                if not analysis_text:
                    continue

                analysis_text = fix_wif_kqw_format(
                    analysis_text,
                    source_bin,
                    original_deva
                )

                if (
                    analysis_text
                    and analysis_text not in all_analyses
                ):
                    all_analyses.append(analysis_text)

    return [
        {
            "word": original_deva,
            "analyses": all_analyses
        }
    ]
def run_analysis(raw_text):
    lines = raw_text.splitlines()

    for line in lines:
        if not line.strip():
            continue

        cleaned = clean_text(line)
        print("\n==============================")
        print("INPUT :", line)
        print("CLEAN :", cleaned)

        tokens = cleaned.split()

        try:
            wx_text = deva_to_wx(" ".join(tokens))
            wx_tokens = wx_text.split()
            print("WX TOKENS:", wx_tokens)
        except Exception as e:
            print("WX ERROR:", e)
            continue

        token_results = []

        for token in wx_tokens:
            print("\n------------------------------")
            print("PROCESSING TOKEN:", token)

            found = False

            for bin_path in LT_PROC_BINS:
                try:
                    out = run_ltproc([token], bin_path)

                    print("BIN:", os.path.basename(bin_path))
                    print("RAW OUTPUT:", repr(out))
                    print("UNKNOWN?:", is_unknown_output(out))

                    if not is_unknown_output(out):
                        print(">>> FOUND IN", os.path.basename(bin_path))

                        token_results.append(
                            (token, [(out.strip(), bin_path, None)])
                        )
                        found = True
                        break

                except Exception as e:
                    print("BIN ERROR:", os.path.basename(bin_path), e)

            if not found:
                print(">>> CALLING SPLIT SEARCH FOR:", token)

                split_data = split_search_finalmaha(token)

                if split_data:
                    print(">>> SPLIT SEARCH FOUND")
                    print(split_data["output"])

                    token_results.append(
                        (
                            token,
                            [
                                (
                                    split_data["output"],
                                    FINALMAHA_BIN,
                                    split_data["suffix"],
                                )
                            ],
                        )
                    )
                    found = True
                else:
                    print(">>> SPLIT SEARCH FAILED")

            if not found:
                print(">>> NO ANALYSIS FOUND")

                # Keep an explicit unknown lt-proc reading.
                # parse_output() skips the /* reading and returns an empty
                # analyses list; run_analysis() then displays:
                # No answer found
                token_results.append(
                    (
                        token,
                        [
                            (
                                f"^{token}/*{token}$",
                                "",
                                None,
                            )
                        ],
                    )
                )

        parsed = []

        for token, token_lines in token_results:
            print("\nPARSING TOKEN:", token)
            print(token_lines)

            parsed.extend(parse_output(token_lines, token))

        yield f"###SENTENCE### {line}\n"

        for entry in parsed:
            orig = entry["word"]

            if is_devanagari_number(orig):
                continue

            source_tag = (
                " ###USER_CORRECTION###"
                if entry.get("source") == "user_correction"
                else ""
            )

            yield f"###WORD### {orig}{source_tag}\n"

            if entry["analyses"]:
                for a in entry["analyses"]:
                    print("FINAL ANALYSIS:", a)
                    yield f"###LINE### {a}\n"
            else:
                print("FINAL ANALYSIS: No answer found")
                yield f"###LINE### No answer found\n"

        yield "---\n"

    yield "DONE\n"

# ─── HTTP HANDLER ──────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        print(f"[{self.address_string()}] {fmt % args}")

    def _cors(self):
        origin = self.headers.get("Origin")
        self.send_header("Access-Control-Allow-Origin", origin if origin else "*")
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _get_cookie(self, name):
        raw = self.headers.get("Cookie")
        if not raw:
            return None
        for part in raw.split(";"):
            part = part.strip()
            if part.startswith(name + "="):
                return part[len(name) + 1:]
        return None

    def _current_email(self):
        """Look up the logged-in user's email from the session cookie
        against the SQLite `sessions` table. Returns None if there's no
        cookie, or the cookie's token isn't a live session."""
        token = self._get_cookie("vanmayi_session")
        if not token:
            return None
        try:
            conn = get_db()
            try:
                row = conn.execute("SELECT email FROM sessions WHERE token = ?", (token,)).fetchone()
                return row["email"] if row else None
            finally:
                conn.close()
        except Exception as e:
            print(f"[ERROR] session lookup failed: {e}")
            return None

    def _set_session_cookie(self, token):
        self.send_header("Set-Cookie", f"vanmayi_session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000")

    def _clear_session_cookie(self):
        self.send_header("Set-Cookie", "vanmayi_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/" or path == "":
            path = "/morph.html"

        if path == "/whoami":
            self._handle_whoami()
            return

        # Get user morph corrections (per-user rows in shared SQLite file)
        if path == "/get_user_morph_corrections":
            query = parse_qs(urlparse(self.path).query)
            slug = query.get("slug", [""])[0]
            email = self._current_email() or query.get("email", [""])[0]

            if not email:
                self._send_json(400, {"error": "email required"})
                return

            try:
                conn = get_db()
                try:
                    rows = conn.execute(
                        "SELECT word, edited, original, updated_at FROM user_morph_corrections "
                        "WHERE email=? AND slug=?",
                        (email, slug),
                    ).fetchall()
                finally:
                    conn.close()
                result = {
                    r["word"]: {
                        "edited": r["edited"],
                        "original": r["original"],
                        "updatedAt": r["updated_at"],
                    }
                    for r in rows
                }
                self._send_json(200, result)
            except Exception as e:
                print(f"[ERROR] SQLite query failed: {e}")
                self._send_json(200, {})
            return

        # Get user progress (per-user rows in shared SQLite file)
        if path == "/get_user_progress":
            query = parse_qs(urlparse(self.path).query)
            email = self._current_email() or query.get("email", [""])[0]
            slug = query.get("slug", [""])[0]
            tool = query.get("tool", [""])[0]

            if not email:
                self._send_json(400, {"error": "email required"})
                return

            try:
                sql = "SELECT email, slug, tool, status, updated_at FROM user_progress WHERE email=?"
                params = [email]
                if slug:
                    sql += " AND slug=?"
                    params.append(slug)
                if tool:
                    sql += " AND tool=?"
                    params.append(tool)
                conn = get_db()
                try:
                    rows = conn.execute(sql, params).fetchall()
                finally:
                    conn.close()
                progress = [
                    {
                        "email": r["email"],
                        "slug": r["slug"],
                        "tool": r["tool"],
                        "status": r["status"],
                        "updatedAt": r["updated_at"],
                    }
                    for r in rows
                ]
                self._send_json(200, progress)
            except Exception as e:
                print(f"[ERROR] SQLite query failed: {e}")
                self._send_json(200, [])
            return

        if path == "/get_user_analysis_cache":
            query = parse_qs(urlparse(self.path).query)
            email = self._current_email() or query.get("email", [""])[0]
            slug = query.get("slug", [""])[0]
            if not email or not slug:
                self._send_json(200, {"found": False})
                return
            try:
                conn = get_db()
                try:
                    row = conn.execute(
                        "SELECT full_output, proof_lines, sandhi_lines, input_text FROM user_analysis_cache "
                        "WHERE email=? AND slug=?", (email, slug)
                    ).fetchone()
                finally:
                    conn.close()
                if not row:
                    self._send_json(200, {"found": False})
                    return
                self._send_json(200, {
                    "found": True,
                    "fullOutput": row["full_output"],
                    "proofLines": json.loads(row["proof_lines"]),
                    "sandhiLines": json.loads(row["sandhi_lines"]),
                    "inputText": row["input_text"],
                })
            except Exception as e:
                print(f"[ERROR] SQLite analysis-cache read failed: {e}")
                self._send_json(200, {"found": False})
            return

        if path == "/list_chapters":
            try:
                arr = list_chapters()
            except Exception as e:
                print(f"[ERROR] list_chapters failed: {e}")
                arr = []
            self._send_json(200, arr)
            return

        if path == "/get_chapter":
            query = parse_qs(urlparse(self.path).query)
            slug = query.get("slug", [""])[0]
            email = self._current_email() or query.get("email", [""])[0].strip()

            if not slug:
                self._send_json(400, {"success": False, "error": "slug required"})
                return

            try:
                chapter = get_chapter_by_slug(slug)
            except Exception as e:
                print(f"[ERROR] get_chapter_by_slug failed: {e}")
                chapter = None

            if chapter is None:
                self._send_json(200, {"success": False, "content": []})
                return

            try:
                merged = _apply_user_overlay(chapter, slug, email)
            except Exception as e:
                print(f"[ERROR] applying user overlay failed: {e}")
                _fallback_title, _fallback_name = _apply_title_override(slug, chapter)
                merged = {"success": True, "slug": slug, "title": _fallback_title,
                          "content": chapter.get("content", []), "proofOverride": None}
            self._send_json(200, merged)
            return

        # Static files. Checked directly next to server.py first, then
        # inside common subfolders (js/, css/, images/) as a fallback,
        # so files organised into those folders are still found.
        base_dir = os.path.dirname(os.path.abspath(__file__))
        rel = path.lstrip("/")
        candidates = [os.path.join(base_dir, rel)]
        ext = os.path.splitext(rel)[1].lower()
        if ext == ".js":
            candidates.append(os.path.join(base_dir, "js", rel))
        elif ext == ".css":
            candidates.append(os.path.join(base_dir, "css", rel))
        elif ext in (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico"):
            candidates.append(os.path.join(base_dir, "images", rel))

        file_path = next((c for c in candidates if os.path.isfile(c)), None)

        if file_path:
            ext = os.path.splitext(file_path)[1].lower()
            mime = {
                ".html": "text/html; charset=utf-8",
                ".css": "text/css",
                ".js": "application/javascript",
                ".json": "application/json",
                ".txt": "text/plain; charset=utf-8",
            }.get(ext, "application/octet-stream")
            with open(file_path, "rb") as f:
                data = f.read()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(data)))
            # HTML/JS/CSS are actively edited during development (this is
            # exactly what caused a fixed morph.html/db.js to keep looking
            # "the same" in the browser -- it was serving a cached copy).
            # Force a revalidation on every load instead of letting the
            # browser cache these heuristically.
            if ext in (".html", ".js", ".css"):
                self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
            self.end_headers()
            self.wfile.write(data)
        else:
            print(f"[404] Requested '{path}' -> checked: {', '.join(candidates)}  (none found)")
            self._send_json(404, {"error": f"Not found: {path}"})

    def do_POST(self):
        if self.path == "/analyze":
            self._handle_analyze()
        elif self.path == "/save_user_proof_edit":
            self._handle_save_user_proof_edit()
        elif self.path == "/save_user_sandhi_edit":
            self._handle_save_user_sandhi_edit()
        elif self.path == "/save_user_morph_correction":
            self._handle_save_user_morph_correction()
        elif self.path == "/delete_user_morph_correction":
            self._handle_delete_user_morph_correction()
        elif self.path == "/save_user_progress":
            self._handle_save_user_progress()
        elif self.path == "/save_user_analysis_cache":
            self._handle_save_user_analysis_cache()
        elif self.path == "/register":
            self._handle_register()
        elif self.path == "/login":
            self._handle_login()
        elif self.path == "/logout":
            self._handle_logout()
        else:
            self._send_json(404, {"error": "not found"})

    def _handle_analyze(self):
        content_type = self.headers.get("Content-Type", "")
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        raw_text = ""

        if "multipart/form-data" in content_type:
            environ = {
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": content_type,
                "CONTENT_LENGTH": str(length),
            }
            fp = io.BytesIO(body)
            form = cgi.FieldStorage(fp=fp, environ=environ, keep_blank_values=True)
            if "file" in form and form["file"].filename:
                raw_text = form["file"].file.read().decode("utf-8")
            elif "text" in form:
                raw_text = form["text"].value
        elif "application/x-www-form-urlencoded" in content_type:
            parsed = parse_qs(body.decode("utf-8"))
            raw_text = parsed.get("text", [""])[0]
        else:
            try:
                data = json.loads(body)
                raw_text = data.get("text", "")
            except Exception:
                raw_text = body.decode("utf-8", errors="replace")

        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Transfer-Encoding", "chunked")
        self.end_headers()

        try:
            for chunk in run_analysis(raw_text):
                encoded = chunk.encode("utf-8")
                size_hex = f"{len(encoded):X}\r\n".encode()
                self.wfile.write(size_hex)
                self.wfile.write(encoded)
                self.wfile.write(b"\r\n")
                self.wfile.flush()
            self.wfile.write(b"0\r\n\r\n")
            self.wfile.flush()
        except BrokenPipeError:
            pass

    def _handle_save_user_proof_edit(self):
        """Save one user's full proof-text edit for a chapter. This never
        touches the chapters/*.json file -- it's an overlay only that
        user's own /get_chapter calls will see."""
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
        except Exception:
            self._send_json(400, {"error": "bad json"})
            return

        email = self._current_email() or data.get("email", "").strip()
        slug = data.get("slug", "").strip()
        content = data.get("content", "")

        if not email or not slug:
            self._send_json(400, {"error": "email and slug are required"})
            return

        now = datetime.now().isoformat()
        try:
            conn = get_db()
            try:
                with _db_write_lock:
                    conn.execute(
                        "INSERT INTO user_proof_edits (email, slug, content, updated_at) "
                        "VALUES (?, ?, ?, ?) "
                        "ON CONFLICT(email, slug) DO UPDATE SET "
                        "content=excluded.content, updated_at=excluded.updated_at",
                        (email, slug, content, now),
                    )
                    conn.commit()
            finally:
                conn.close()
        except Exception as e:
            print(f"[ERROR] Could not save proof edit: {e}")
            self._send_json(500, {"error": str(e)})
            return

        self._send_json(200, {"status": "ok"})

    def _handle_save_user_sandhi_edit(self):
        """Save one user's override for a single sandhi token, addressed
        by (line_index, token_index) within the chapter's content array."""
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
        except Exception:
            self._send_json(400, {"error": "bad json"})
            return

        email = self._current_email() or data.get("email", "").strip()
        slug = data.get("slug", "").strip()
        try:
            line_index = int(data.get("line_index"))
            token_index = int(data.get("token_index"))
        except (TypeError, ValueError):
            self._send_json(400, {"error": "line_index and token_index must be integers"})
            return
        edited = data.get("edited", "").strip()

        if not email or not slug or not edited:
            self._send_json(400, {"error": "email, slug, and edited are required"})
            return

        now = datetime.now().isoformat()
        try:
            conn = get_db()
            try:
                with _db_write_lock:
                    conn.execute(
                        "INSERT INTO user_sandhi_edits (email, slug, line_index, token_index, edited, updated_at) "
                        "VALUES (?, ?, ?, ?, ?, ?) "
                        "ON CONFLICT(email, slug, line_index, token_index) DO UPDATE SET "
                        "edited=excluded.edited, updated_at=excluded.updated_at",
                        (email, slug, line_index, token_index, edited, now),
                    )
                    conn.commit()
            finally:
                conn.close()
        except Exception as e:
            print(f"[ERROR] Could not save sandhi edit: {e}")
            self._send_json(500, {"error": str(e)})
            return

        self._send_json(200, {"status": "ok"})

    def _handle_save_user_morph_correction(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
        except Exception as e:
            self._send_json(400, {"error": f"bad json: {str(e)}"})
            return

        email = self._current_email() or data.get("email", "").strip()
        slug = data.get("slug", "").strip()
        word = data.get("word", "").strip()
        edited = data.get("edited", "").strip()
        original = data.get("original", "")
        # Extra context for the Google Sheets log only (not stored in
        # SQLite, which keeps its existing schema) -- proof/sandhi/anvaya
        # text for the line this word came from, and the account's display
        # name. All optional: an older/unmodified frontend that doesn't
        # send them just logs those columns blank.
        proof = data.get("proof", "") or ""
        sandhi = data.get("sandhi", "") or ""
        anvaya = data.get("anvaya", "") or ""
        username = (data.get("username") or "").strip()

        print(f"[SQLite] Saving: {email}/{slug}/{word}")

        if not email or not slug or not word:
            self._send_json(400, {"error": "email, slug, and word are required"})
            return

        if not username:
            username = _lookup_username(email)

        now = datetime.now().isoformat()
        try:
            conn = get_db()
            try:
                with _db_write_lock:
                    conn.execute(
                        "INSERT INTO user_morph_corrections (email, slug, word, edited, original, updated_at) "
                        "VALUES (?, ?, ?, ?, ?, ?) "
                        "ON CONFLICT(email, slug, word) DO UPDATE SET "
                        "edited=excluded.edited, original=excluded.original, updated_at=excluded.updated_at",
                        (email, slug, word, edited, original, now),
                    )
                    conn.commit()
            finally:
                conn.close()
            print(f"[SQLite] Saved correction for {email}/{slug}/{word}")
            # Mirror into Google Sheets in the background so the HTTP
            # response isn't held up waiting on a network call to Google.
            # SQLite (above) is already durable at this point. New
            # corrections get a new row; edits to an existing correction
            # update that row in place instead of duplicating it.
            threading.Thread(
                target=upsert_correction_in_sheet,
                args=(email, slug, word, original, edited),
                kwargs=dict(proof=proof, sandhi=sandhi, anvaya=anvaya, username=username),
                daemon=True,
            ).start()
            self._send_json(200, {"status": "ok", "word": word})
        except Exception as e:
            print(f"[ERROR] SQLite save failed: {e}")
            self._send_json(500, {"error": str(e)})

    def _handle_delete_user_morph_correction(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
        except Exception as e:
            self._send_json(400, {"error": f"bad json: {str(e)}"})
            return

        email = self._current_email() or data.get("email", "").strip()
        slug = data.get("slug", "").strip()
        word = data.get("word", "").strip()

        if not email or not slug or not word:
            self._send_json(400, {"error": "email, slug, and word are required"})
            return

        try:
            conn = get_db()
            try:
                with _db_write_lock:
                    conn.execute(
                        "DELETE FROM user_morph_corrections WHERE email=? AND slug=? AND word=?",
                        (email, slug, word),
                    )
                    conn.commit()
            finally:
                conn.close()
            print(f"[SQLite] Deleted correction for {email}/{slug}/{word}")
            # Remove the matching row from Google Sheets in the background,
            # same as the save path — SQLite (above) is already durable.
            threading.Thread(
                target=delete_correction_from_sheet,
                args=(email, slug, word),
                daemon=True,
            ).start()
            self._send_json(200, {"status": "ok", "word": word})
        except Exception as e:
            print(f"[ERROR] SQLite delete failed: {e}")
            self._send_json(500, {"error": str(e)})

    def _handle_save_user_progress(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
        except Exception as e:
            self._send_json(400, {"error": f"bad json: {str(e)}"})
            return

        email = self._current_email() or data.get("email", "").strip()
        slug = data.get("slug", "").strip()
        tool = data.get("tool", "").strip()
        status = data.get("status", "").strip()

        print(f"[SQLite] Progress: {email}/{slug}/{tool} → {status}")

        if not email or not slug or not tool:
            self._send_json(400, {"error": "email, slug, and tool are required"})
            return

        now = datetime.now().isoformat()
        try:
            conn = get_db()
            try:
                with _db_write_lock:
                    conn.execute(
                        "INSERT INTO user_progress (email, slug, tool, status, updated_at) "
                        "VALUES (?, ?, ?, ?, ?) "
                        "ON CONFLICT(email, slug, tool) DO UPDATE SET "
                        "status=excluded.status, updated_at=excluded.updated_at",
                        (email, slug, tool, status, now),
                    )
                    conn.commit()
            finally:
                conn.close()
            print(f"[SQLite] Progress saved")
            self._send_json(200, {"status": "ok"})
        except Exception as e:
            print(f"[ERROR] SQLite progress save failed: {e}")
            self._send_json(500, {"error": str(e)})

    def _handle_save_user_analysis_cache(self):
        """Save this user's raw computed proof/sandhi/output for a
        chapter they analysed live, so reopening it skips re-running
        lt-proc. SQLite only -- this used to be a localStorage cache."""
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
        except Exception as e:
            self._send_json(400, {"error": f"bad json: {str(e)}"})
            return

        email = self._current_email() or data.get("email", "").strip()
        slug = data.get("slug", "").strip()
        full_output = data.get("full_output", "")
        proof_lines = json.dumps(data.get("proof_lines", []))
        sandhi_lines = json.dumps(data.get("sandhi_lines", []))
        input_text = data.get("input_text", "")

        if not email or not slug:
            self._send_json(400, {"error": "email and slug are required"})
            return

        now = datetime.now().isoformat()
        try:
            conn = get_db()
            try:
                with _db_write_lock:
                    conn.execute(
                        "INSERT INTO user_analysis_cache "
                        "(email, slug, full_output, proof_lines, sandhi_lines, input_text, updated_at) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?) "
                        "ON CONFLICT(email, slug) DO UPDATE SET "
                        "full_output=excluded.full_output, proof_lines=excluded.proof_lines, "
                        "sandhi_lines=excluded.sandhi_lines, input_text=excluded.input_text, "
                        "updated_at=excluded.updated_at",
                        (email, slug, full_output, proof_lines, sandhi_lines, input_text, now),
                    )
                    conn.commit()
            finally:
                conn.close()
            self._send_json(200, {"status": "ok"})
        except Exception as e:
            print(f"[ERROR] SQLite analysis-cache save failed: {e}")
            self._send_json(500, {"error": str(e)})

    def _handle_register(self):
        """Create a new account. Stores email (PK), username, and a
        PBKDF2-hashed password in the users table. Never stores the
        plaintext password."""
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
        except Exception:
            self._send_json(400, {"error": "bad json"})
            return

        email = (data.get("email") or "").strip().lower()
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""

        if not email or not _EMAIL_RE.match(email):
            self._send_json(400, {"error": "A valid email address is required."})
            return
        if not username:
            self._send_json(400, {"error": "Username is required."})
            return
        if len(password) < 4:
            self._send_json(400, {"error": "Password must be at least 4 characters."})
            return

        now = datetime.now().isoformat()
        token = secrets.token_hex(32)
        try:
            conn = get_db()
            try:
                existing = conn.execute("SELECT email FROM users WHERE email = ?", (email,)).fetchone()
                if existing:
                    self._send_json(409, {"error": "An account with this email already exists."})
                    return
                with _db_write_lock:
                    conn.execute(
                        "INSERT INTO users (email, username, password, created_at) VALUES (?, ?, ?, ?)",
                        (email, username, _hash_password(password), now),
                    )
                    conn.execute(
                        "INSERT INTO sessions (token, email, created_at) VALUES (?, ?, ?)",
                        (token, email, now),
                    )
                    conn.commit()
            finally:
                conn.close()
        except Exception as e:
            print(f"[ERROR] register failed: {e}")
            self._send_json(500, {"error": str(e)})
            return

        self._send_json(200, {"ok": True, "email": email, "username": username},
                         extra_headers=[("Set-Cookie", f"vanmayi_session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000")])

    def _handle_login(self):
        """Verify email + password against the users table."""
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
        except Exception:
            self._send_json(400, {"error": "bad json"})
            return

        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not email or not password:
            self._send_json(400, {"ok": False, "error": "Email and password are required."})
            return

        try:
            conn = get_db()
            try:
                row = conn.execute(
                    "SELECT email, username, password FROM users WHERE email = ?", (email,)
                ).fetchone()
            finally:
                conn.close()
        except Exception as e:
            print(f"[ERROR] login lookup failed: {e}")
            self._send_json(500, {"ok": False, "error": str(e)})
            return

        if not row or not _verify_password(password, row["password"]):
            self._send_json(401, {"ok": False, "error": "Invalid email or password."})
            return

        token = secrets.token_hex(32)
        try:
            conn = get_db()
            try:
                with _db_write_lock:
                    conn.execute(
                        "INSERT INTO sessions (token, email, created_at) VALUES (?, ?, ?)",
                        (token, row["email"], datetime.now().isoformat()),
                    )
                    conn.commit()
            finally:
                conn.close()
        except Exception as e:
            print(f"[ERROR] session create failed: {e}")
            self._send_json(500, {"ok": False, "error": str(e)})
            return

        self._send_json(200, {"ok": True, "email": row["email"], "username": row["username"]},
                         extra_headers=[("Set-Cookie", f"vanmayi_session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000")])

    def _handle_logout(self):
        """Delete this browser's session row from SQLite and clear its cookie."""
        token = self._get_cookie("vanmayi_session")
        if token:
            try:
                conn = get_db()
                try:
                    with _db_write_lock:
                        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
                        conn.commit()
                finally:
                    conn.close()
            except Exception as e:
                print(f"[ERROR] logout failed: {e}")
        self._send_json(200, {"ok": True}, extra_headers=[("Set-Cookie", "vanmayi_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")])

    def _handle_whoami(self):
        """Tell the browser who (if anyone) its session cookie belongs to,
        without the browser ever having to store that identity itself."""
        email = self._current_email()
        if not email:
            self._send_json(200, {"ok": False})
            return
        try:
            conn = get_db()
            try:
                row = conn.execute("SELECT email, username FROM users WHERE email = ?", (email,)).fetchone()
            finally:
                conn.close()
        except Exception as e:
            self._send_json(500, {"ok": False, "error": str(e)})
            return
        if not row:
            self._send_json(200, {"ok": False})
            return
        self._send_json(200, {"ok": True, "email": row["email"], "username": row["username"]})

    def _send_json(self, code, obj, extra_headers=None):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, private")
        if extra_headers:
            for name, value in extra_headers:
                self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print("=" * 50)
    print("Vanmayi Morphological Analyser Server")
    print("=" * 50)

    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"✓ Server running at http://localhost:{PORT}")
    print(f"  Serving static files (db.js, auth.html, morph.html, style.css) from: {os.path.dirname(os.path.abspath(__file__))}")
    print(f"  Chapters on disk: {len(_chapters_at_start)}  (from {CHAPTERS_DIR})")
    print(f"  lt-proc bins configured: {len(LT_PROC_BINS)}")
    print(f"✓ SQLite database (accounts + per-user edits only): {DB_PATH}")

    print("\n  Keep this terminal open. Stop with Ctrl+C.")
    print("=" * 50)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")