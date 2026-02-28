# Admin quickstart: enable fully-automated nightly builds (GitHub Actions)

Purpose
-------
This document is intended for an administrator who is allowed to create a Git repository and enable CI (GitHub Actions). Following these steps will make the repository run nightly builds and publish artifacts fully automatically with zero intervention from end users.

Summary of what will happen
- Create a new repository on GitHub (or use an existing one).
- Push the current workspace to that repository.
- Ensure GitHub Actions is enabled for the repo (it usually is by default).
- The included workflow `.github/workflows/build-launcher-windows.yml` will run on schedule and publish artifacts (nightly prereleases). No local machines need to be modified.

Files to provide the admin
--------------------------
Provide the admin with the entire repository folder (zip the workspace or give access to the machine). The admin needs to run a few git commands to publish it.

Exact admin commands (Linux/macOS/Windows with Git installed)

1. Create a repository on GitHub (via web UI). Note the repo URL, e.g. `https://github.com/ORGNAME/REPO.git`.

2. On the machine with the workspace (or after extracting the zip), run the following in a shell with Git installed:

```bash
cd /path/to/InAccord-Apps
git init
git add --all
git commit -m "Initial import: InAccord local workspace"
git branch -M main
git remote add origin https://github.com/ORGNAME/REPO.git
git push -u origin main --force
```

3. Enable GitHub Actions (if disabled by org policy, an admin with org permissions must enable Actions for this repo or allow specified workflows). If the organization blocks Actions, contact the org security team to allow the following workflow file or allow Actions for this repo.

4. Verify the workflow runs: go to the repository -> Actions tab -> you should see the scheduled workflow `.github/workflows/build-launcher-windows.yml`. To test immediately, trigger a workflow run from the Actions page (there is a "Run workflow" button for scheduled workflows) or push a small change.

5. Confirm artifacts: after the workflow completes, a prerelease will be created and the built artifact (exe or zip) will be attached. The Actions run log will show `Created release` and `Upload artifact` steps.

Notes for admins in tightly-controlled environments
-------------------------------------------------
- If the organization policy prevents creating GitHub repos or running Actions, you must either: (A) allow a single repository and enable Actions for it, or (B) provide an internal CI runner capable of reading the repository and running the included workflow (the workflow is standard and can be adapted to GitLab/Azure DevOps).
- If the org requires code review or scanning before enabling Actions, run those policies; the workflow is pure build/publish logic and does not contain secrets.

Alternative: admin-run pack and host the artifacts
--------------------------------------------------
If CI is impossible, an admin can run this locally once and host the artifact (ZIP/EXE) on an internal share or web server. Steps:

1. On a machine with `bun` installed and this repository extracted, run:

```powershell
cd E:\InAccord-Apps
bun run build
```

2. Copy the `dist/` folder (and `launch-discord.*` wrappers) to a network share or the internal downloads site for users.

Questions or help
-----------------
If you want, I can prepare a small ZIP of the repository that you can hand to your admin. I cannot push to your org's GitHub account without a repo URL and credentials. Tell me which you prefer:

- "Provide ZIP" — I will produce a ZIP file of the workspace (you or your admin will download it from this environment). NOTE: I cannot upload files to the internet for you; I will create the ZIP in the repo so it can be collected from this workspace.
- "Prepare git bundle commands for admin" — I will add a short script the admin can run to create a git bundle they can import to a remote server.

If you are comfortable with an admin performing the steps above, give the admin this file and they can enable fully-automated CI.
