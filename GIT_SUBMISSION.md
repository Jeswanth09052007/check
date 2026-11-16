# Git submission

No remote repository URL was supplied, so this package has not been pushed to a remote. Run these commands from the extracted project folder after reviewing `.gitignore` and filling in your contribution document:

```bash
git init
git add .
git status
git commit -m "Convert IndAI frontend to React and integrate research workflows"
git branch -M main
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

If you already have a repository, copy these source files into its working tree instead of creating another repository. Preserve the existing history, review `git diff`, commit the actual work and push your branch using your group's workflow. Do not force-push or overwrite teammates' commits.

`.gitignore` excludes environment secrets, dependencies, saved user/payment data, uploads, and build outputs. Review staged files before committing. Do not add `.env`, credential exports, real institute rosters, or runtime state.

The migration's true history is this delivered change; earlier original history was not present in the uploaded ZIP. Do not fabricate commits or backdate individual contributions. Each student should make and explain genuine follow-up changes. Add the final repository URL and your own commit hashes to INDIVIDUAL_CONTRIBUTION.md.

To create your individual submission ZIP, include the source, package lockfiles, README and your completed contribution document. Exclude dependencies, `.env`, generated credential CSVs and real saved data. The provided ZIP is already structured this way and includes prebuilt outputs for convenience.
