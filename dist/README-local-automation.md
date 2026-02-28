# Local fully-automated builds (no GitHub / no CI)

If you cannot or do not want to host this repository on GitHub/CI, you can run a fully-local automated build/publish flow on your Windows machine. This creates timestamped build folders and a ZIP under %USERPROFILE%\InAccord-Builds so non-technical users can double-click artifacts.

Files added:
- `scripts/local_build_and_publish.ps1` — runs `bun run build`, copies `dist/` and launcher scripts to a timestamped folder, creates a ZIP, and updates a `latest` folder.
- `scripts/setup_local_automation.ps1` — registers a Windows Scheduled Task (daily at 02:00) that runs the previous script.

How to use (recommended, one-time):

1. Open an elevated PowerShell (Run as Administrator) if your environment blocks scheduled tasks for the current user.
2. Run the setup script to register the scheduled task:

```powershell
cd E:\InAccord-Apps\scripts
.\setup_local_automation.ps1
```

3. The scheduled task will run daily at 02:00 and place artifacts in `%USERPROFILE%\InAccord-Builds\<timestamp>` and a `latest` copy.

If you prefer to test immediately instead of scheduling, run:

```powershell
cd E:\InAccord-Apps\scripts
.\local_build_and_publish.ps1
```

Notes & requirements:
- Requires `bun` to be installed and available on PATH (same tool used by the repository build).
- The script does not upload artifacts to the internet — everything stays local.
- If you later want CI/GitHub automation, this repository already includes a GitHub Actions workflow that will build and publish nightly releases; enabling that requires hosting the repo on GitHub and enabling Actions.

Alternative when Task Scheduler is unavailable
----------------------------------------------
Some environments disable Windows Task Scheduler. In that case this repository includes a Login-daemon option which runs at user login (no admin needed):

- `scripts/daemon_local_builder.ps1` — a background loop that runs `local_build_and_publish.ps1` immediately and then daily at 02:00. It stops when a file named `daemon.stop` is created in `%USERPROFILE%\InAccord-Builds`.
- `scripts/setup_startup_automation.ps1` — creates a shortcut in your user Startup folder so the daemon runs at each login. This does not require Task Scheduler or admin permissions.

To install the Login-daemon (no admin):

```powershell
cd E:\InAccord-Apps\scripts
.\setup_startup_automation.ps1
```

This will create a shortcut named "InAccord Local Builder" in the current user's Startup folder and the daemon will run at next login. If you want me to create this shortcut now on this machine, say "Yes, create Startup entry" and I'll run the script for you.

If you want, I can register the scheduled task for you now (I will run the setup script). Confirm if you want me to run it on this machine and whether it's okay to create a scheduled task named "InAccord Local Build".
