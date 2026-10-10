# Construction Tracker

## What it is

Construction Tracker is Dominic's one-person dashboard for his building jobs. It is timing first: for each job it
shows where it is, what is overdue, what comes next and what he is waiting on, with every date in plain words
("Mon 21 Sep, in 4 days"). Red means overdue and nothing else. Changes come in only
through a Telegram bot: Dominic texts, sends a voice note or a photo, and the bot shows a confirm card. Nothing
is saved until he taps Confirm. The web app is read-only, plus a Setup area on a desktop computer for new jobs,
programs, templates and trades. There is a live demo with made-up data at
https://sct-x.github.io/construction-tracker/. The demo keeps its data in your browser. Its bar at the top sets
the "today is" date and resets the data.

## Run the full stack on a Mac

You need Node 22 (22.12 or newer). Pick one way to install it.

With nvm (reads the version from `.nvmrc`):

```bash
nvm install
```

Or with Homebrew (then follow the PATH line Homebrew prints):

```bash
brew install node@22
```

Get the code and install the packages:

```bash
git clone https://github.com/sct-X/construction-tracker.git
```

```bash
cd construction-tracker
```

```bash
npm ci
```

Make your settings file, then fill it in (see [Fill .env](#fill-env)):

```bash
cp .env.example .env
```

Build the web app (the server serves it):

```bash
npm run build
```

Start everything. One process runs the web app, the API, the reminder scheduler and the Telegram bot:

```bash
npm start
```

Open http://127.0.0.1:8787 in a browser. Stop the app with Ctrl+C.

On the real date every demo job reads "On track". To see the demo's numbers exactly as the tests do (Beatty St
+5 days, $1,430), set `CT_TODAY=2026-09-17` in `.env` and start again.

With no bot token the app still runs. The log says `Telegram bot off: TELEGRAM_BOT_TOKEN is not set.` and the
day's reminders are written to the log instead of Telegram.

### Where the data lives

Everything is in one folder, `DATA_DIR` (default `./data`, relative to the folder you run `npm start` in):

- `tracker.db`: the SQLite database (plus `tracker.db-wal` and `tracker.db-shm` while it runs).
- `photos/`: photos. Photos from the bot land in `photos/telegram/`.
- `audio/`: voice notes from the bot.
- `bot-state.json`: small flags the bot remembers.

The first start loads the demo jobs (Park Rd, Seaview St, Beatty St and so on) into an empty database. To
start a new machine with no demo jobs instead, put `SEED=empty` in `.env` before the first start.

### Reset the data

Stop the app first. This deletes the database and loads the demo jobs again. Photos and voice notes are kept.

```bash
npm run seed -- --reset
```

### Going live with real jobs

When Dominic is ready to use it for real, swap the demo jobs for an empty start. It keeps the two sides,
Dominic, the duplex template and the trades list. It removes every job, item, shipment, note, photo record and
change.

1. Stop the app (Ctrl+C, or stop the service).
2. Back up the whole `DATA_DIR` folder (default `data/`), for example by copying it:

```bash
cp -R data data-backup
```

3. Recreate the database empty:

```bash
npm run seed -- --reset --empty
```

4. Start the app again with `npm start`.
5. On a desktop computer, open Setup and create each real job from the duplex template (or as a design job).
   Add or fix trades under Setup, Trades.

Old photo and voice files stay in `photos/` and `audio/` on disk; the app no longer points at them. You can
delete those two folders' contents after the backup.

## Create the Telegram bot

Do this once, in the Telegram app, on any phone or computer.

1. Open a chat with **@BotFather** (it has a blue tick).
2. Send `/newbot`.
3. Send a display name, for example `Dominic's Tracker`.
4. Send a username. It must end in `bot`, for example `dominic_tracker_bot`.
5. BotFather replies with a token like `123456789:AAH...`. Copy it into `.env` as `TELEGRAM_BOT_TOKEN`.
   Treat it like a password. If it leaks, send `/revoke` to BotFather and use the new one.
6. Send `/setprivacy`, pick the bot, choose **Enable**.
7. Send `/setjoingroups`, pick the bot, choose **Disable**. Now nobody can add it to a group.

Optional: send `/setcommands`, pick the bot, and paste this so Telegram shows a menu:

```
undo - Undo the last change
reminders - What's due now
cancel - Drop the open question
help - What I can do
```

### Find Dominic's Telegram user ID

The bot listens to one Telegram user ID only. Everyone else gets no reply and nothing is saved; each attempt is
logged. It also ignores group chats. There are two ways to find the number.

Easiest: Dominic opens a chat with **@userinfobot** and sends any message. It replies with his `Id`, a number
like `123456789`.

Or use this app's log:

1. Put the token in `.env` and a placeholder ID: `DOMINIC_TELEGRAM_USER_ID=1`.
2. Run `npm start`.
3. Dominic sends the bot any message.
4. The log prints a line like
   `Ignored a text message from Telegram user 123456789 (@dominic): not the allowed user.`
5. Stop the app, put that number in `.env` as `DOMINIC_TELEGRAM_USER_ID`, and start it again.

When it is right, the log says `Telegram bot @dominic_tracker_bot is listening.`

## Fill .env

`.env` is never committed. `npm test` needs none of it. Restart the app after you change it.

| Variable | What it does | Needed? |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | The bot's token from BotFather. | Yes, for the bot. Without it the bot is off. |
| `DOMINIC_TELEGRAM_USER_ID` | The one Telegram user the bot listens to (a number). | Yes, for the bot. |
| `TELEGRAM_ALLOWED_USER_ID` | Old name for `DOMINIC_TELEGRAM_USER_ID`. Only read if that line is deleted. | No. |
| `LLM_MODEL` | The model that reads Dominic's messages. One line to switch. | Yes, to read typed messages. |
| `LLM_PROVIDER` | Only when `LLM_MODEL` is blank or not a known family. | No. |
| `OPENAI_API_KEY` | Key for `gpt-*` models. Also used by cloud voice. | For `gpt-*` models. |
| `GEMINI_API_KEY` | Key for `gemini-*` models (`GOOGLE_API_KEY` also works). | For `gemini-*` models. |
| `ANTHROPIC_API_KEY` | Key for `claude-*` models. | For `claude-*` models. |
| `LLM_BASE_URL` | Another address for the model provider's API (a compatible server). | No. |
| `LLM_MAX_TOKENS` | Longest reply the model may write, in tokens. Default 4096 (1024 for `claude-*`). | No. |
| `LLM_TIMEOUT_MS` | How long to wait for the model before giving up, in milliseconds. Default 30000. | No. |
| `LLM_REASONING_EFFORT` | `gpt-*` only: how hard the model thinks (`minimal`, `low`, `medium`, `high`). | No. |
| `LLM_THINKING_BUDGET` | `gemini-*` only: tokens the model may spend thinking (`0` = off). | No. |
| `TRANSCRIBER` | Voice notes: `local` (whisper.cpp on this machine) or `cloud` (OpenAI). | For voice notes. |
| `WHISPER_CPP_BIN` | Path to whisper.cpp's program. Blank = `whisper-cli` on the PATH. | No. |
| `WHISPER_MODEL_PATH` | The whisper model file, e.g. `./models/ggml-base.en.bin`. | For local voice. |
| `WHISPER_THREADS` | CPU threads for whisper.cpp. Blank = its default. | No. |
| `FFMPEG_BIN` | Path to ffmpeg. Blank = `ffmpeg` on the PATH. | For local voice. |
| `TRANSCRIBE_MODEL` | Cloud voice model (default `gpt-4o-mini-transcribe`). | No. |
| `TRANSCRIBE_API_KEY` | A separate key for cloud voice only. Blank = `OPENAI_API_KEY`. | No. |
| `TRANSCRIBE_BASE_URL` | Another OpenAI-compatible voice service. | No. |
| `TELEGRAM_API_ROOT` | A self-hosted Telegram Bot API server. Blank = Telegram's. | No. |
| `NET_CONNECT_ATTEMPT_MS` | How long each connection try (IPv6, then IPv4) may take before the next, in milliseconds. Default `2500` (Node's own 250 is too short on some networks). | No. |
| `DATA_DIR` | The data folder (database, photos, voice notes). Default `./data`. | No. |
| `PORT` | The web app's port. Default `8787`. | No. |
| `HOST` | The address it listens on. Default `127.0.0.1` (this machine only). Keep it. | No. |
| `ALLOWED_HOSTS` | Extra host names allowed to use the app, comma-separated (e.g. a Tailscale name). | No. |
| `REMINDER_TIME` | Sydney time the daily reminders go out, `HH:MM`. Default `07:00`. | No. |
| `SEED` | What a new, empty database starts with: `demo` (default, the made-up jobs) or `empty` (template and trades, no jobs). | No. |
| `CT_TODAY` | Pretend today is this date (`YYYY-MM-DD`). `2026-09-17` gives the demo's numbers. Blank for real use. | No. |
| `TZ_TODAY_OVERRIDE` | Old name for `CT_TODAY`. Only read when `CT_TODAY` is blank. | No. |
| `WEB_DIST` | Folder of the built web app. Default `packages/web/dist`. | No. |
| `ENV_FILE` | Read a settings file other than `./.env`. Set it in the shell, not in `.env`. | No. |
| `EVAL_MODELS` | Eval only: which models to try, comma-separated. | No. |
| `EVAL_CONCURRENCY` | Eval only: how many cases run at once. Default 4. | No. |
| `EVAL_TIMEOUT_MS` | Eval only: time limit for each case, in milliseconds. Default 90000. | No. |

### The model

`LLM_MODEL` picks the provider by its name. Fill in the matching key:

- `gpt-5-mini` (the default) needs `OPENAI_API_KEY`.
- `gemini-2.5-flash` needs `GEMINI_API_KEY`.
- `claude-haiku-4-5` needs `ANTHROPIC_API_KEY`.

Run the eval (below) to compare them on Dominic's kind of messages before you choose.

With no key the bot still starts. Reminders, `/undo`, `/reminders`, buttons and photo filing by buttons work.
Typed messages get "I can't read messages yet: add a model key to .env." The log says `No language model: ...`.

### Voice notes on this machine (whisper.cpp)

Local voice keeps the audio on this machine. It needs whisper.cpp, a model file and ffmpeg.

Install whisper.cpp. Homebrew now calls the formula `whisper.cpp`; the old name `whisper-cpp` still works. Its
program is `whisper-cli`.

```bash
brew install whisper-cpp
```

Install ffmpeg (it turns Telegram's voice format into WAV for whisper):

```bash
brew install ffmpeg
```

Download a model into `models/` (git-ignored). `base.en` is about 150 MB and fine for short notes. `small.en`
(about 490 MB) is more accurate and slower; swap the name in the URL to use it.

```bash
mkdir -p models
```

```bash
curl -L -o models/ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
```

Then set these in `.env`:

```
TRANSCRIBER=local
WHISPER_MODEL_PATH=./models/ggml-base.en.bin
```

The log says `Voice notes: ...` when it is on, or `Voice notes off: <reason>` when something is missing.
Note: the automated tests check this path with a fake whisper; the real whisper.cpp step has not been run on the
build Mac yet, so try one voice note after setting it up.

### Voice notes in the cloud

Set `TRANSCRIBER=cloud`. It uses `OPENAI_API_KEY` (or `TRANSCRIBE_API_KEY`). The audio is sent to OpenAI. The app
never picks the cloud by itself.

## Using it day to day

Dominic talks to the bot like he would to a site manager. Each change comes back as a card with what changes,
the new finish date, the slip and its cost (the bot's confirm card is the one place the finish impact shows; the
web never shows a finish, slip or money). He taps **Confirm**, **Edit** or **Cancel**. Examples:

- `Park Rd windows now arriving 16 Nov`
- `tiler cant start beatty till the 12th`
- `roof plumbing at park rd is finished`
- `booked the pump for seaview`
- `tile warehouse says the park rd tiles are 10 weeks lead time now`
- `note for park rd: rained out this arvo, cladders packed up at 1`
- `confirmed park rd and seaview with the boys this morning`
- Questions change nothing: `what's Park Rd looking like for finish`, `what are we still waiting on at seaview`

If a name could mean two things ("the windows are late"), the bot asks with buttons instead of guessing.

**Voice notes:** hold the microphone and talk. The card starts with `Heard: "..."` so he can check the words.

**Photos:** send them as files so they stay full size (in Telegram: attach, then File, then pick the photo). Add
a caption that says the job and what it shows, for example `seaview plumbing under slab`. No caption, or a
caption that fits more than one category, gets buttons. A hold point (like a slab inspection) can't be signed off
until each required photo category has a photo; the bot says which ones are missing.

**Commands:**

- `/undo` takes back the last saved change. Reply `undo` to a saved card to take back that one.
- `/reminders` (or "fire reminders") sends what is due now. The daily reminders arrive by themselves at
  `REMINDER_TIME`.
- `/cancel` drops an open question. `/help` explains the bot.

The web app at http://127.0.0.1:8787 shows the results, timing first. The Overview (home) has one card per job:
its stage bar, its stage and how many items are overdue. Each job's first page shows its progress, the next hold
point, everything overdue and the trades on site this week; its tabs hold the program, Waiting on, Shipments,
photos and notes. Waiting on is one list for every job, grouped Overdue, This week and Later, with a Call button
for each trade. Changes lists every change with the message that caused it. Setup (desktop only) adds jobs from
templates, edits programs and templates, and keeps the trades list.

## Troubleshooting

**Bot doesn't answer: network.** If the terminal shows `Can't reach Telegram, retrying: ETIMEDOUT` (or grammY's
`Network request for 'sendMessage' failed!`), this machine can't open a connection to api.telegram.org in time.
On some home networks the IPv6 route is dead and IPv4 is slow, so each try runs out of time. The app already
waits 2.5 seconds per try; raise `NET_CONNECT_ATTEMPT_MS` in `.env` (e.g. `5000`) and restart. To check by hand:
`node --network-family-autoselection-attempt-timeout=2500 -e "fetch('https://api.telegram.org/').then(r => console.log(r.status))"`
should print `302` (or `200`). If it still times out, the network or a firewall is blocking Telegram. When it gets
through again the log says `Reached Telegram again.`

## Run the tests and the eval

Unit and integration tests (no keys, no bot token):

```bash
npm test
```

Type checks:

```bash
npm run typecheck
```

Browser tests. Install Chromium once:

```bash
npx playwright install chromium
```

Then run them. They build what they need and start their own servers on ports 4310 and 4320:

```bash
npx playwright test
```

### The eval

The eval sends 33 realistic messages from Dominic through each model you have a key for, and checks that the
right change (or the right question) comes out. Nothing is written anywhere. It is not part of `npm test`, and
it costs a few cents per model.

```bash
npm run eval
```

Keys come from `.env` (or the shell). A model with no key shows `skipped (no key)`. The run still exits 0.

A free run with a fake model that always gives the right answer (it should say 33/33):

```bash
npm run eval -- --dry
```

For each model it prints the pass rate (`pass 27/30 (90%)`), the failed cases with a short reason, the tokens,
an estimated cost, and the median time per message. Then one summary table. Higher pass rate wins; cost and time
break ties. The cost is an estimate from the price table in `packages/llm/src/pricing.ts`, not the bill. More in
`packages/eval/README.md`.

## Move to a Windows or Linux mini PC

The same steps work natively on Windows and Linux. No Docker.

1. Install Node 22. Windows: the LTS 22 installer from https://nodejs.org. Linux: nvm (as on the Mac) or your
   distribution's Node 22 packages.
2. Get the code with `git clone` and run the same commands as on the Mac, from `npm ci` to `npm start`. On
   Windows, make the settings file with this instead of `cp`:

```powershell
copy .env.example .env
```

3. `npm ci` downloads a ready-made SQLite driver (better-sqlite3) for Windows x64, Linux x64 and arm64, and
   macOS. Only if it fails while compiling ("gyp ERR!") do you need build tools. On Windows, rerun the Node
   installer and tick "Automatically install the necessary tools". On Linux:

```bash
sudo apt install build-essential python3
```

4. Voice on this machine needs ffmpeg and whisper.cpp (or use `TRANSCRIBER=cloud`). ffmpeg on Linux:

```bash
sudo apt install ffmpeg
```

   ffmpeg on Windows:

```powershell
winget install Gyan.FFmpeg
```

   whisper.cpp has no apt or winget package. On Linux, build it from https://github.com/ggml-org/whisper.cpp
   (its README has the two cmake commands). On Windows, its GitHub releases page has ready-made downloads that
   contain `whisper-cli.exe` (check the page for the current file name). Download the model as on the Mac. If
   `whisper-cli` or `ffmpeg` is not on the PATH, put their full paths in `WHISPER_CPP_BIN` and `FFMPEG_BIN`.

### Move the data

Only one machine may run the bot at a time. Telegram allows one listener per token.

1. Stop the app on the Mac.
2. Copy the whole `DATA_DIR` folder (default `data/`) to the same place on the mini PC.
3. Start the app on the mini PC.

To copy while the app is running, take a safe copy of the database first, then copy `photos/` and `audio/`:

```bash
sqlite3 data/tracker.db ".backup data/tracker-backup.db"
```

On the new machine, rename `tracker-backup.db` to `tracker.db`.

### Keep it running on Linux (systemd)

The app runs its own scheduler for reminders and the Monday snapshot, so no cron job is needed. Put this in
`/etc/systemd/system/construction-tracker.service`, with your user name and folder:

```ini
[Unit]
Description=Construction Tracker (web app, reminders, Telegram bot)
After=network-online.target
Wants=network-online.target

[Service]
User=scott
WorkingDirectory=/home/scott/construction-tracker
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

The app reads `.env` from `WorkingDirectory`, so no `EnvironmentFile=` line is needed. For `ExecStart`, use the
path this prints:

```bash
which npm
```

If Node came from nvm, systemd can't find it by itself. Add a line under `[Service]` with the folder
`which npm` printed, for example `Environment=PATH=/home/scott/.nvm/versions/node/v22.20.0/bin:/usr/bin:/bin`.

Then turn the service on:

```bash
sudo systemctl daemon-reload
```

```bash
sudo systemctl enable --now construction-tracker
```

Watch the log:

```bash
journalctl -u construction-tracker -f
```

### Keep it running on Windows (NSSM)

NSSM turns a program into a Windows service that starts at boot and restarts if it stops. Download it from
https://nssm.cc. No Task Scheduler entry is needed: the app sends reminders itself. These commands are for an
administrator PowerShell, with the code in `C:\construction-tracker`. They run what `npm start` runs, without
npm in between, so stopping the service stops the app cleanly.

```powershell
nssm install ConstructionTracker "C:\Program Files\nodejs\node.exe" "node_modules\tsx\dist\cli.mjs --tsconfig packages\server\tsconfig.json packages\server\src\main.ts"
```

```powershell
nssm set ConstructionTracker AppDirectory C:\construction-tracker
```

```powershell
nssm set ConstructionTracker AppStdout C:\construction-tracker\data\service.log
```

```powershell
nssm set ConstructionTracker AppStderr C:\construction-tracker\data\service.log
```

```powershell
nssm start ConstructionTracker
```

### Power and sleep

The mini PC must stay awake, or reminders and the bot stop.

- Windows: Settings, System, Power: set sleep to Never.
- Linux: turn off sleep for good with the command below.
- In the BIOS, turn on "power on after power loss" (often "Restore on AC power loss") so it comes back after
  an outage. The service then starts the app.

```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

On the Mac: System Settings, Energy (or Battery, Options): turn on "Prevent automatic sleeping when the
display is off" and "Start up automatically after a power failure".

### Nothing is exposed to the internet

The bot uses long polling: it calls out to Telegram and never accepts incoming connections. The web app listens
on `127.0.0.1`, so only the machine itself can open it, and the API refuses any other host name. No router or
firewall changes are needed.

### Optional: Scott's remote access with Tailscale

Tailscale gives Scott a private link to the mini PC from his own computer, without opening anything to the
internet. Install Tailscale on both and sign in to the same account. On the mini PC:

```bash
tailscale serve --bg 8787
```

It prints an address like `https://mini.tailnet-name.ts.net`. Add that name to `.env` and restart the app:

```
ALLOWED_HOSTS=mini.tailnet-name.ts.net
```

Only devices in Scott's Tailscale network can open it. Keep `HOST=127.0.0.1`.

## Deploys of the demo

Every push to `main` runs `.github/workflows/ci.yml` on GitHub Actions:

- tests and type checks on macOS, Windows and Linux,
- the browser tests (Playwright) on Linux,
- then, if both pass, it builds the web app with the made-up data and publishes it to GitHub Pages at
  https://sct-x.github.io/construction-tracker/.

No keys or tokens are used in CI. The Pages source in the repo settings must be "GitHub Actions".

## Project layout

- `packages/core`: types, the forecast calculator, every allowed change (operations), the demo seed data.
- `packages/server`: SQLite storage, the HTTP API, the scheduler (Monday snapshot, reminders), `npm start`.
- `packages/bot`: the Telegram bot (grammY): allowlist, confirm cards, undo, voice notes, photos, reminders.
- `packages/llm`: the model layer (OpenAI, Gemini, Anthropic) that turns messages into operations.
- `packages/web`: the web app (Vite, React): read-only screens and desktop Setup; mock or API data.
- `packages/eval`: the parser eval (`npm run eval`).
- `e2e`: the Playwright browser tests.

Where decisions live:

- `SPEC.md`: what the app must do (the contract).
- `PROGRESS.md`: stage checklist and every decision made along the way, dated.
- `docs/CONTRACTS.md`: how the parts fit together (types, functions, behaviour).
- `docs/reviews/`: each stage's independent review and what was fixed.
