#!/usr/bin/env bash
# Deploy: assemble and publish the gh-pages branch deterministically from main.
#
# gh-pages root will contain exactly:
#   .nojekyll, index.html (marketing), legal/, docs/, app/ (= app/dist contents)
#
# Usage: ./scripts/deploy.sh   (run from anywhere)
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT="$SCRIPT_DIR/.."
cd "$ROOT"
ROOT=$(pwd)

echo "==> Repo root: $ROOT"

# --- Safety checks -----------------------------------------------------
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree is not clean. Commit or stash changes before deploying." >&2
  git status --porcelain >&2
  exit 1
fi

ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "==> Current branch: $ORIGINAL_BRANCH (will return here at the end)"

# Ensure gh-pages exists locally (fetch from origin if it doesn't).
if ! git show-ref --verify --quiet refs/heads/gh-pages; then
  echo "==> Local gh-pages branch not found; fetching from origin..."
  if git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
    git fetch origin gh-pages:gh-pages
  else
    echo "==> No gh-pages branch on origin either; it will be created fresh."
  fi
fi

# --- Build the app -------------------------------------------------------
echo "==> Building app..."
(
  cd "$ROOT/app"
  npm ci --silent || npm install
  npm run build
)

if [ ! -f "$ROOT/app/dist/index.html" ]; then
  echo "ERROR: app/dist/index.html not found after build. Aborting." >&2
  exit 1
fi
echo "==> App build OK ($ROOT/app/dist/index.html present)"

# --- Stage the desired gh-pages tree in a temp dir -----------------------
STAGE_DIR=$(mktemp -d)
trap 'rm -rf "$STAGE_DIR"' EXIT

echo "==> Staging gh-pages tree in $STAGE_DIR"
cp "$ROOT/index.html" "$STAGE_DIR/index.html"
cp -R "$ROOT/legal" "$STAGE_DIR/legal"
cp -R "$ROOT/docs" "$STAGE_DIR/docs"
mkdir -p "$STAGE_DIR/app"
cp -R "$ROOT/app/dist/." "$STAGE_DIR/app/"
touch "$STAGE_DIR/.nojekyll"

# --- Publish via a dedicated worktree -------------------------------------
WORKTREE_DIR=$(mktemp -d)
rmdir "$WORKTREE_DIR"
echo "==> Setting up gh-pages worktree at $WORKTREE_DIR"

if git show-ref --verify --quiet refs/heads/gh-pages; then
  git worktree add "$WORKTREE_DIR" gh-pages
else
  git worktree add --orphan -b gh-pages "$WORKTREE_DIR"
fi

cleanup_worktree() {
  git worktree remove --force "$WORKTREE_DIR" >/dev/null 2>&1 || true
  rm -rf "$STAGE_DIR"
}
trap cleanup_worktree EXIT

echo "==> Clearing stale tracked content in worktree"
(
  cd "$WORKTREE_DIR"
  git rm -rf --quiet . >/dev/null 2>&1 || true
)
# git rm leaves untracked files (e.g. .nojekyll) behind; clean those too.
find "$WORKTREE_DIR" -mindepth 1 -maxdepth 1 -not -name '.git' -exec rm -rf {} +

echo "==> Copying staged tree into worktree"
cp -R "$STAGE_DIR/." "$WORKTREE_DIR/"

echo "==> Committing gh-pages"
(
  cd "$WORKTREE_DIR"
  git add -A
  if git diff --cached --quiet; then
    echo "==> No changes to gh-pages; nothing to commit."
  else
    git commit -m "Deploy: assemble gh-pages (marketing + app build)"
  fi
  echo "==> Pushing gh-pages to origin"
  git push origin gh-pages
)

MAIN_SHA=$(git rev-parse "$ORIGINAL_BRANCH")
GHPAGES_SHA=$(git -C "$WORKTREE_DIR" rev-parse gh-pages)

echo "==> Deployed"
echo "    $ORIGINAL_BRANCH: $MAIN_SHA"
echo "    gh-pages: $GHPAGES_SHA"

# trap will remove the worktree and stage dir; explicitly return to original branch
git checkout "$ORIGINAL_BRANCH" >/dev/null 2>&1 || true
echo "==> Back on $ORIGINAL_BRANCH"
