#!/bin/bash
# Example SLURM batch script to run a Transition batch calculation on a
# Calcul Quebec / Alliance cluster using Apptainer.
#
# This is a starting point, not a ready-to-run script: adapt the account,
# time/resource requests, paths, and DB credentials to your allocation, and
# validate it on the target cluster before relying on it. See
# ../docs/runOnHPC.md for the full explanation of each step.

#SBATCH --job-name=transition-batch
#SBATCH --account=def-yourpiname
#SBATCH --time=04:00:00
#SBATCH --cpus-per-task=8
#SBATCH --mem=16G
#SBATCH --output=transition-batch-%j.out

set -euo pipefail

module load apptainer

# Adjust to your allocation's filesystems (project space for images/inputs,
# scratch for large working data, $SLURM_TMPDIR for fast node-local storage).
IMAGES_DIR="$PROJECT/transition/images"
PROJECT_DATA_DIR="$PROJECT/transition/project"   # contains config.js, .env, runtime/
PGDATA="$SLURM_TMPDIR/pgdata"

APP_IMAGE="$IMAGES_DIR/transition.sif"
PG_IMAGE="$IMAGES_DIR/postgis.sif"   # apptainer pull postgis.sif docker://postgis/postgis:latest

mkdir -p "$PGDATA"

# --- Start PostGIS as a separate Apptainer instance -----------------------
apptainer instance start \
    --bind "$PGDATA:/var/lib/postgresql/data" \
    --env POSTGRES_PASSWORD=pass \
    "$PG_IMAGE" pg

cleanup() {
    apptainer instance stop pg || true
}
trap cleanup EXIT

until apptainer exec instance://pg pg_isready -h 127.0.0.1 >/dev/null 2>&1; do
    sleep 2
done

APP_ENV=(
    --env PROJECT_CONFIG=/config/config.js
    --env TRANSITION_DOTENV=/config/.env
    --env PG_CONNECTION_STRING_PREFIX=postgres://postgres:pass@127.0.0.1:5432/
)

# --- One-time setup (safe to re-run; skip if already done for this DB) ----
apptainer exec --bind "$PROJECT_DATA_DIR:/config" "${APP_ENV[@]}" "$APP_IMAGE" \
    sh -c "yarn setup && yarn migrate"

# --- Run the batch calculation ---------------------------------------------
# Batch routing/accessibility-map jobs currently go through Transition's job
# queue, which is driven over the socket.io API of a running server rather
# than a plain CLI task. Two options, see docs/runOnHPC.md for details:
#   1. Start the server headlessly and drive it with a small socket.io-client
#      script that logs in, submits the job, and polls until completion.
#   2. Add a dedicated CLI task that calls the batch routing/accessibility
#      functions directly (recommended follow-up for cluster-friendliness).
apptainer exec --bind "$PROJECT_DATA_DIR:/config" "${APP_ENV[@]}" "$APP_IMAGE" \
    node submit-and-wait-for-batch-job.js --input /config/runtime/imports/demand.csv
