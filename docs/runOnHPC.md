# Running Transition batch calculations on an HPC cluster (Apptainer)

This documents what is needed to package Transition as an [Apptainer](https://apptainer.org/)
(formerly Singularity) image and run batch calculations (batch routing,
batch accessibility maps) as SLURM jobs on a cluster such as those operated
by Calcul Quebec / the Digital Research Alliance of Canada.

It complements [runWithDocker.md](runWithDocker.md) (single-machine, Docker)
and [tasks.md](tasks.md) (CLI tasks). Apptainer is required instead of
Docker on these clusters because compute nodes do not run a Docker daemon
and do not grant users root access, both of which Docker needs; Apptainer
runs unprivileged containers and is what's installed on Alliance/Calcul
Quebec clusters (`module load apptainer`).

## 1. Build the image

Transition's CI already builds and publishes a Docker image on every push to
`main` (`chairemobilite/transition` on Docker Hub and `ghcr.io`, see
`.github/workflows/build-docker-image.yml`), so there is no need to
reimplement the Dockerfile as an Apptainer definition file. `apptainer/transition.def`
in this repo simply builds from that published image and adds the
environment/help metadata useful for batch runs.

Building a `.sif` from a definition file (or with `--fakeroot`) requires
root, or the use of a remote build service. Calcul Quebec login and compute
nodes do not allow this, so build the image somewhere else and transfer it
to the cluster:

```shell
# On a machine where you have root (or CI):
apptainer build transition.sif apptainer/transition.def

# Transfer to the cluster's project space (large, shared, backed-up storage):
scp transition.sif myuser@cluster:/project/def-yourpiname/transition/images/
```

Alternatively, `apptainer pull` can convert a public image without root:

```shell
apptainer pull transition.sif docker://chairemobilite/transition:latest
```

You will also need a PostGIS image the same way:

```shell
apptainer pull postgis.sif docker://postgis/postgis:latest
```

## 2. Constraints specific to the cluster

A few properties of HPC clusters change how the app must be run compared to
`docker compose` on a desktop:

- **No Docker Compose / no multi-container orchestration.** Each service
  (the app, PostGIS) is its own image, started as its own `apptainer
  instance` on the same compute node, talking over `localhost`. trRouting,
  OSRM, and memcached don't need their own instance: Transition already
  starts them as subprocesses inside the app container (see
  `packages/chaire-lib-backend/src/utils/processManagers`), exactly as it
  does in the current single Docker container.
- **Read-only image, unprivileged user.** The `.sif` is read-only and runs
  as your own cluster user, not root. Anything that needs to be written
  (PostGIS data, the project's `runtime/` directory, caches) must be bind
  mounted from `$SCRATCH`/`$PROJECT`/`$SLURM_TMPDIR`, the way the existing
  `docker-compose.yml` volumes map `runtime/imports`, `runtime/osrm`, and
  `runtime/cache`.
- **No internet on compute nodes.** Most Alliance/Calcul Quebec clusters
  block outbound internet from compute nodes. `yarn install` / `yarn
  build:prod` are already done at image-build time, so that's fine, but the
  OSM/OSRM data preparation tasks
  (`packages/chaire-lib-backend/src/scripts/osm/*.task.ts`,
  `.../osrm/downloadOsmNetworkData.task.ts`,
  `.../osrm/prepareOsmNetworkData.task.ts`) must be run ahead of time on a
  login node or your own machine, with the resulting `runtime/` directory
  copied to `$PROJECT`/`$SCRATCH` and bind-mounted at job time.
- **`$HOME` is mounted by default.** Apptainer binds the host `$HOME` into
  the container by default, which can shadow `/app` or clash with Node's
  use of `$HOME` for caches. Prefer `--no-home` and explicit `--bind`
  mounts for the project directory (mapped to `/config`, matching
  `PROJECT_CONFIG=/config/config.js`, as in `runWithDocker.md`) and any
  scratch paths.
- **Resource sizing must match the SLURM allocation.** The backend already
  runs Node with `--max-old-space-size=4096` (see `transition-backend`'s
  `start` script); make sure `#SBATCH --mem` covers that plus PostGIS and
  OS overhead, and size `--cpus-per-task` for however many trRouting/OSRM
  worker processes and DB connections the job needs.

## 3. Database

There is no managed PostGIS service on these clusters, so PostGIS runs as
its own Apptainer instance for the lifetime of the job, with its data
directory bound to fast local/scratch storage:

```shell
apptainer instance start \
    --bind "$SLURM_TMPDIR/pgdata:/var/lib/postgresql/data" \
    --env POSTGRES_PASSWORD=pass \
    postgis.sif pg
```

The app then connects to it over `PG_CONNECTION_STRING_PREFIX=postgres://postgres:pass@127.0.0.1:5432/`.
If a job needs the database to persist across multiple jobs (e.g. import
once, run many batch calculations), point `--bind` at `$PROJECT`/`$SCRATCH`
storage instead of `$SLURM_TMPDIR`, which is deleted at the end of each job.

Run `yarn setup && yarn migrate` (see `runWithDocker.md`, step 6.1) once
against that database before the first batch job.

## 4. Submitting a batch calculation without the UI

This is the part most specific to unattended HPC use: batch routing and
batch accessibility-map calculations are currently implemented as jobs in
Transition's job queue (`ExecutableJob`, see
`packages/transition-backend/src/services/executableJob/` and
`.../api/services.socketRoutes.ts`), executed by a worker pool
(`packages/transition-backend/src/tasks/TransitionWorkerPool.ts`) inside a
running backend server. Jobs are created and monitored over the
authenticated socket.io API used by the web UI — there is currently no
plain CLI task for it, unlike the OSM/OSRM/import tasks listed in
`tasks.md`.

Two ways to drive this from a SLURM job:

1. **Start the server headlessly and script the socket.io API.** Run
   `yarn start` (or `node lib/server.js`) inside the container as a
   background process, then use a small `socket.io-client` Node script,
   run with a second `apptainer exec`, that logs in as a service user,
   emits the same batch-route/batch-accessibility-map event the UI does,
   and polls job status until it completes before downloading the result
   files. `apptainer/slurm-batch-example.sh` shows where this fits in a job
   script. This requires no code changes, but needs a real user account
   (`yarn create-user`) and a bit of glue script.
2. **Add a dedicated CLI task** that calls `batchRoute()` /
   `batchAccessibilityMap()` (`packages/transition-backend/src/services/transitRouting/TrRoutingBatch.ts`
   and `TrAccessibilityMapBatch.ts`) directly, the same functions the
   worker pool calls, without going through `ExecutableJob`, the socket API,
   or a full server process. This is more work but is the cleaner long-term
   fit for cluster batch jobs (no server/session/user management needed,
   easier to reason about exit codes and SLURM array jobs). Recommended as
   a follow-up if HPC batch usage becomes routine.

## 5. Putting it together

`apptainer/transition.def` and `apptainer/slurm-batch-example.sh` in this
repo are a starting point for the above: a definition file that builds on
the project's published Docker image, and an example SLURM script that
starts PostGIS as an Apptainer instance, runs migrations, and runs a batch
job. Both need to be adapted (account name, resource requests, storage
paths, and — per section 4 — the actual job submission mechanism) and
validated on the target cluster; they have not been build- or run-tested
against a real Calcul Quebec allocation.
