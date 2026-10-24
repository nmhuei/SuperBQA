# UCS deployment and recovery

This package builds **this checkout**, including the club interface and backend, through [the upstream multi-stage Dockerfile](../deploy/rctf/Dockerfile). It does not deploy the stock upstream rCTF image. The image contains the built web client, API, CLI, migrations, nginx, and supervisor. Use [deploy/club/compose.yaml](../deploy/club/compose.yaml) through [scripts/club-ops.sh](../scripts/club-ops.sh).

## Deployment model and prerequisites

Use a maintained Linux host with Docker Engine **28 or newer**, Compose **2.24 or newer**, Bash, Python **3.11 or newer**, GNU coreutils, `flock`, `tar`, and gzip. The operator needs Docker access. The upstream sizing starting point is 2 CPU cores and 4 GiB RAM; allow additional space for image builds, database growth, and multiple full backup copies. Measure actual event load before opening registration.

| Component          | Baseline                                      | Responsibility                       |
| ------------------ | --------------------------------------------- | ------------------------------------ |
| Application        | Local release tag, built from this repository | API, frontend, CLI, migrations       |
| Bun build/runtime  | `oven/bun:1.4.4-alpine`                       | Pinned in upstream Dockerfile        |
| PostgreSQL         | `postgres:18.0`                               | Persistent authoritative data        |
| Redis              | `redis:8.2.6`                                 | Persistent cache, rate limits, locks |
| Host reverse proxy | Operator-managed nginx or equivalent          | Public HTTPS and certificate renewal |

The PostgreSQL and Redis pins match this checkout's upstream Compose baseline. They are explicit version tags, not immutable digests, and do not imply that the newest security patches are installed. Review patch releases and test upgrades before changing these pins; keep the selected image artifacts for recovery.

Only application HTTP is published, on **127.0.0.1:8080** by default. PostgreSQL and Redis have no host ports and share an internal Docker network. The app also has an outbound network for configured providers. Named volumes persist PostgreSQL, Redis, and local uploads. Each service has a health check, restart policy, and a three-file/10 MiB-per-file Docker log limit. Application root files are read-only; `/tmp` is a bounded 256 MiB tmpfs. [Docker documents localhost publishing and its pre-28.0.0 limitation](https://docs.docker.com/engine/network/port-publishing/).

## First deployment

From the repository root:

```sh
./scripts/club-ops.sh init https://ctf.example.com
./scripts/club-ops.sh validate
./scripts/club-ops.sh build
./scripts/club-ops.sh up
./scripts/club-ops.sh status
```

`init` refuses to overwrite existing state. It generates independent database/Redis passwords and a cryptographic token key; it creates no users or admin credentials. The event starts at initialization and ends 72 hours later. Edit the event dates and public copy in `deploy/club/config/00-club.yaml` before launch. The helper builds a unique local image tag in `.env`; preserve that tag for the life of a release.

`deploy/club/.env` is private, mode **600**, ignored by Git and excluded from Docker's build context. The generated `config/` directory is also ignored and excluded. Its YAML is **public configuration only**, mode 644 so the container's unprivileged rCTF user can read it. Put token keys, database passwords, SMTP credentials, and other secrets in `.env`, using supported environment overrides. Never add credentials to the public YAML or examples. Keep secret-containing backups mode 600 in a directory mode 700. Do not print a fully expanded `docker compose config` in shared logs; it contains secrets. The helper's `validate` uses `--quiet`.

The configuration mount is `/app/rctf.d`; `RCTF_CONF_PATH` explicitly points there. Environment overrides follow the [upstream configuration loader](../packages/config/src/loader.ts). Database migration runs before the API starts. No demo seed runs in production: **do not run `dev:mock` or `rctf seed` against this stack**.

Until email is configured, native registration returns a team login token without email verification. Keep initial setup behind localhost access. Register a dedicated operator account and retain its login token privately, then promote it:

```sh
./scripts/club-ops.sh compose exec -T rctf rctf user promote operator@example.com
./scripts/club-ops.sh compose exec -T rctf rctf user list-admins
```

Before opening public registration, set `RCTF_SMTP_URL` in `.env`, enable the commented `email` block in `config/00-club.yaml`, and test delivery and account recovery. SMTP URLs with special dotenv characters should be single-quoted. Apply configuration changes with:

```sh
./scripts/club-ops.sh up
```

Environment changes recreate containers; public YAML-only changes also require recreation:

```sh
./scripts/club-ops.sh compose up -d --no-build --force-recreate --wait rctf
```

## Accounts, club membership, and administration

rCTF accounts are **team accounts**. A team's login/invite token grants access to the same account; roster email entries are not independent role-bearing accounts. Club membership is attached to the rCTF account ID and is shared by that account's participants. Use a dedicated operator account and do not share its team token with competitors.

New accounts start with the club's guest role. An administrator with `usersWrite` can grant or revoke club membership. Club members can access archives and practice; administration is a separate permission system. `settingsWrite` controls creating event archives. Practice solves have separate persistence from live event solves and must not change an archived scoreboard. The normal `rctf user promote EMAIL` command grants all administrative permissions; use `--perms challsRead,challsWrite` when only challenge management is needed. Demote with `rctf user demote EMAIL`.

## HTTPS and network access

Use [nginx.example.conf](../deploy/club/nginx.example.conf) on the Docker host, replacing the domain and certificate paths. Obtain a certificate first, run `nginx -t`, reload nginx, and test certificate renewal separately. The example terminates HTTPS and forwards to localhost:8080. It replaces client-supplied forwarding headers at the public boundary. The public `RCTF_ORIGIN` must match the browser origin. The default `proxy.trust: 2` represents this host proxy plus the bundled nginx; adjust it when the real proxy chain changes.

Allow public traffic only to the host proxy's 80/443 ports and restrict administrative host access. Verify that database ports remain unpublished with `./scripts/club-ops.sh compose ps`. For a VirtualBox NAT guest, forward host 80/443 to the guest reverse proxy, or use SSH port forwarding for private inspection. A localhost-only application port in the guest is intentionally not reachable through a NAT rule targeting the guest's external interface. Do not publish database ports to work around browser access. For private access, tunnel to the guest's localhost service, for example `ssh -L 8080:127.0.0.1:8080 operator@guest`.

## Backups

```sh
./scripts/club-ops.sh backup
./scripts/club-ops.sh verify /absolute/path/to/rctf-club-v1-TIMESTAMP.tar.gz
```

Backup **pauses the application** while taking a consistent database/uploads snapshot, then restarts it if it was running. Plan this interruption. A per-project lock prevents overlapping helper `up`, `backup`, and `restore` operations under the same operator account; do not bypass that lock with simultaneous direct Docker changes or another operator account. Operations reject an existing app container whose configuration mount belongs to another state directory.

The versioned archive contains:

- A custom-format `pg_dump` of the **entire rCTF database**, including accounts, challenge flags, settings, migration history, memberships, archived standings/challenges, and practice solves.
- A tar archive of the local uploads volume, including challenge downloads and avatars.
- Public configuration and the complete private `.env`, including the original token key needed to retain logins.
- The exact running application image ID/tag, PostgreSQL major version, creation time, and SHA-256 checksums for every payload. A separate `.sha256` file checks the outer archive.

The single dedicated database is restored under the configured `rctf` role; unrelated cluster roles/tablespaces are not backed up. Redis stores derived data and transient locks, so restore clears this stack's Redis and rebuilds caches. [PostgreSQL documents the scope of `pg_dump` and custom-format restores](https://www.postgresql.org/docs/18/app-pgdump.html).

Retain the matching application image alongside each recoverable release:

```sh
umask 077
app_container="$(./scripts/club-ops.sh compose ps -q rctf)"
image_tag="$(docker inspect --format '{{.Config.Image}}' "$app_container")"
docker save "$image_tag" | gzip > /secure/backup/rctf-application-image.tar.gz
sha256sum /secure/backup/rctf-application-image.tar.gz > /secure/backup/rctf-application-image.tar.gz.sha256
```

Copy backups and image artifacts off the application host. Backups contain credentials and challenge answers: encrypt them before off-host storage, restrict access, and verify downloaded checksums. Checksums detect corruption; they do not authenticate an untrusted backup. Set retention and scheduling according to acceptable data loss and available disk space. This full-backup design has no point-in-time recovery; add PostgreSQL WAL archiving if the event requires a smaller recovery window. External object stores, challenge instances, mail providers, DNS, certificates, and host proxy configuration require their own recovery procedures.

## Restore and recovery drill

Restore requires an explicit destructive flag and an initialized destination. It verifies checksums, archive paths, format version, and dump readability **before replacing data**. It also requires the exact application image ID recorded in the backup. Load the saved image if necessary:

```sh
gzip -dc /secure/backup/rctf-application-image.tar.gz | docker load
./scripts/club-ops.sh restore /secure/backup/rctf-club-v1-TIMESTAMP.tar.gz --replace-data
./scripts/club-ops.sh status
```

Restore stops the app, replaces the database and uploads, restores secrets/configuration, resets dedicated Redis caches, and starts the archived application image. The destination's Compose project name, bind address, HTTP port, and public origin are retained. A failure after replacement begins leaves the app stopped and retains a private `.restore-*` staging directory for investigation. Inspect the failing step, fix its cause, and rerun restore; do not start the app against a partially restored database.

Before relying on a backup, perform an isolated drill. Use a separate host or a separate state directory, project name, port, and Docker volumes. The [Compose project name isolates project resources](https://docs.docker.com/compose/intro/compose-application-model/). Restored provider secrets may contact external systems: block outbound mail, webhooks, and instancer traffic in the drill environment before restoring.

```sh
export CLUB_STATE_DIR=/srv/rctf-club-drill
./scripts/club-ops.sh init http://127.0.0.1:8081 rctf-club-drill 8081
./scripts/club-ops.sh restore /secure/backup/rctf-club-v1-TIMESTAMP.tar.gz --replace-data
./scripts/club-ops.sh status
```

Verify login with an existing token, a known challenge upload, archived scoreboard values, member/guest access, and a practice submission that leaves archived points unchanged. Record actual recovery time and backup age. Confirm project/volume names before removing drill resources. Unset `CLUB_STATE_DIR` before operating the live deployment again.

## Upgrades, rollback, and ongoing checks

Take and verify a full backup and retain the current image before changing source, configuration, or database versions. Deploy a reviewed revision; change `RCTF_RELEASE` to a **new unique tag**, build it, then run `up`. Never overwrite a retained release tag. Test the same revision and migration sequence in the recovery environment first. Builds use the lockfile and current checkout; an uncommitted checkout must be retained separately if it is used for a release.

Schema migrations are forward-only. Restarting an older image against a migrated database is not a reliable rollback. To roll back an incompatible migration, restore the pre-upgrade database/uploads/configuration **and** its exact image; writes after that backup are lost. A PostgreSQL major upgrade requires a separate tested migration procedure, not changing the image tag over the same data volume. Maintenance and recovery can interrupt service; this package makes no zero-downtime guarantee.

Monitor `/api/readyz`, container health, disk usage, certificate expiry, backup age, and application error logs. Health checks report failure; Docker restart policies restart exited processes, not every unhealthy-but-running container. Use `status` and `logs` to investigate before restarting. Test recovery periodically and before major events.

## Validation performed for this package

The standalone Compose **2.40.3** CLI accepts the generated configuration. Automated assertions check current-source build paths, unpublished database ports, internal database networking, loopback HTTP, health checks, named volumes, restart policies, and bounded logs. The upstream rCTF schema accepts generated configuration with its secret environment overrides. Ten Python safety tests cover valid archives, corruption, unsafe paths/symlinks, private file modes, initialization non-overwrite, distinct drill initialization, recovery identity preservation, and command guards rejecting a moved image tag or another state's project before stopping the app. Command-guard tests use a stub Docker CLI and do not claim container execution.

```sh
bash -n scripts/club-ops.sh
python3 -m unittest discover -s deploy/club -p 'test_*.py'
./scripts/club-ops.sh validate
```

The focused [Club operations checks workflow](../.github/workflows/club-checks.yml) repeats shell checks, backup safety tests, and generated Compose validation on relevant changes. Existing repository workflows remain responsible for application linting, type checks, and tests. This operations workflow does not publish or deploy an image.

**Docker image build, container startup, and container-based backup/restore have not been executed in the current workspace because a Docker daemon is unavailable.** Complete the first deployment and recovery drill on the target Docker host before treating this as a validated production installation. Local native Bun/PostgreSQL/Redis development checks are separate evidence and do not replace that drill.
