# Club security operations

This supplements [deployment and recovery](DEPLOYMENT.md) and the upstream
[security policy](../.github/SECURITY.md). It describes implemented checks and
the release work that still requires a real Docker host. A passing source scan
does not certify a production installation.

## Repeatable checks

Run from the repository root with Git, Python 3.10+, Bash, curl, tar, sha256sum,
and the repository's Bun **1.4.4**. The installer supports Linux x86-64 and ARM64;
it downloads release archives into a temporary directory and verifies committed
SHA-256 pins before installing Gitleaks **8.30.1**, Trivy **0.76.1**, and actionlint
**1.7.12**. Review a version and its published checksums together when updating.
Do not pipe a remote installer into a shell.

```sh
./scripts/club-security-tools.sh /tmp/rctf-security-tools gitleaks trivy actionlint
export PATH="/tmp/rctf-security-tools:$PATH"
./scripts/club-security.sh self-test
actionlint .github/workflows/club-security.yml .github/workflows/ci.yml
bash -n scripts/club-security.sh scripts/club-security-tools.sh
shellcheck scripts/club-security.sh scripts/club-security-tools.sh
./scripts/club-security.sh secrets
./scripts/club-security.sh dependencies
./scripts/club-security.sh configuration
./scripts/club-security.sh sbom /tmp/club-source.cdx.json
```

ShellCheck is also available on the workflow's Ubuntu runner. Install it through
your operating system's package manager for the local lint command. Existing
application CI continues to use `bun install --frozen-lockfile`; the security
audit reads the lockfile directly and does not install packages or run their
lifecycle scripts.

| Check                   | Actual scope and failure behavior                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source boundary         | `git ls-files --cached --others --exclude-standard` copies tracked files and new nonignored files into a private temporary snapshot. Ignored `.env`, generated config, backups, uploads and dependencies are excluded. A force-added secret remains scanned even if its path is ignored. Source symlinks, parent-directory symlinks and submodules fail closed. |
| Secrets                 | Gitleaks defaults with 100% redacted output; any finding fails. Five existing public seed/example values have exact-value **and** exact-path exceptions under the generic-key rule. No entire source directory is allowed. Suppression comments and `.gitleaksignore` files are disabled. This checks current contents, not deleted secrets in Git history.     |
| Dependencies            | `bun audit --audit-level=high` audits the root workspace lock, including developer tools. High and critical advisories fail; registry errors also fail. No `--ignore`, production-only filter, automatic upgrade, or advisory suppression is used. Nested standalone test projects are inventoried by the SBOM but are outside this Bun audit command.          |
| Container configuration | Trivy checks `deploy/rctf` Dockerfiles for high/critical misconfiguration, with an empty ignore file. Compose validation and archive guards remain in [Club operations checks](../.github/workflows/club-checks.yml). Optional instancer/Terraform profiles are outside this club deployment check.                                                             |
| Inventory               | Trivy emits a CycloneDX source SBOM, including development dependencies and supported lockfiles. This is a dependency inventory, not a complete final-image/OS inventory or license compliance report. No vulnerability database is required for this command.                                                                                                  |

The [Club security checks workflow](../.github/workflows/club-security.yml) is called
by [CI](../.github/workflows/ci.yml) for pull requests, pushes to `main`, release
tags and manual CI runs. Every image build/publish matrix job requires its success
alongside application tests. It also supports manual scans and runs weekly to catch
new advisories without a source change; separate PR/push triggers are omitted to
avoid duplicate scans. It has only `contents: read`, pins actions
by full commit SHA, persists no checkout credentials, and receives no deployment
secrets. Failed checks remain failures while subsequent scans collect evidence.
Only the source SBOM is uploaded, retained for 14 days. Secret reports and source
snapshots are not uploaded. Scan tools and advisory/check feeds need network
access; an unavailable scanner or failed audit is not a clean result.

The guard test runs six real temporary-repository tests, then proves an invented
GitHub token and a generic key in a file with an example exception are rejected
and redacted. It also proves an unsafe temporary Dockerfile is rejected by the
root-user rule. The fixture credentials never contact an external service.

## Threat model and trust boundaries

| Boundary                                   | Control and remaining exposure                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous visitor or player → API          | Server-side authentication, banned-account checks, permission checks and rate limits are authoritative. Client navigation is not authorization. Keep the API's security-regression and club integration tests in required application CI.                                                                                                                                                                                                                         |
| Guest/member → archive and administration  | Club membership is attached to an rCTF **team account**. `usersWrite` controls membership changes, `settingsWrite` creates archives, and archive reads/practice check current membership or the appropriate administrator permission. Member does not mean administrator. A shared team login/invite token shares the team's access. Use a separate operator account.                                                                                             |
| Browser → uploads, flags and archived data | Treat uploads and all submitted text as untrusted. Archived practice omits live instancer/admin-bot workloads and redacts flags; practice solves must not rewrite the historical scoreboard. Validate resource limits and abuse controls on the target host.                                                                                                                                                                                                      |
| Platform → challenge workloads             | Challenge images, admin-bot browsing and player code are hostile workloads. Run them on separate hosts or an isolated cluster with separate service identities and explicit network rules. Never mount the platform Docker socket, database volumes, private config, cloud credentials or backup store into a challenge. Deny access to the platform database/Redis and host metadata endpoints. The club Compose stack does not provide this external isolation. |
| Host → app/database/cache                  | PostgreSQL and Redis have no published ports and use an internal network. HTTP binds to loopback for the host TLS proxy. Root on the host can inspect container environment secrets. Read-only app rootfs and bounded logs help, but do not replace host patching, access control, resource limits or network policy.                                                                                                                                             |
| Contributor/dependency → CI/release        | Pull-request scans run without production secrets or publishing permissions. Lockfiles, checksum-pinned binaries, action SHAs and reviewed changes reduce supply-chain exposure. Existing upstream release/publish workflows have their own permissions and must be reviewed separately.                                                                                                                                                                          |

## Secrets and logs

Generate credentials with `club-ops.sh init`; retain `.env` at mode 0600 in a
restricted state directory. Keep backup archives equally private and encrypt
them before off-host storage. Use real SMTP and a dedicated operator account
before public registration. Do not use development seed credentials in a live
deployment. Never paste `.env`, `docker inspect` output, expanded Compose config,
database dumps, login/invite tokens, request bodies or flags into CI artifacts,
issue reports or chat.

If a credential leaks, restrict the affected service immediately, revoke/rotate
the credential at its issuer, identify its use, and then remove the exposed
copy. Deleting it from the latest source does not revoke it or clean Git history.
Review history separately with a redacting scanner in a private checkout after
rotation; this workflow only checks current distributable contents.

Rotation requires coordinating the actual services. Changing `POSTGRES_PASSWORD`
in `.env` alone does **not** change an existing PostgreSQL role password: change
the role using an interactive protected session, update the app environment,
recreate the app, and verify readiness. Rotate Redis's configured password and
the app value together during maintenance, recreate affected containers, and
verify connections. Rotate SMTP/object-store/instancer secrets at their providers
and update consumers. A new `RCTF_TOKEN_KEY` invalidates existing encrypted login
tokens; plan account recovery and operator re-entry before applying it. Take a
new encrypted backup after a successful rotation; old backups contain old secrets
and restoring them may reintroduce a compromised credential.

The main API logger redacts authorization, cookie and proxy-authorization headers.
That is not a universal scrubber: worker logs, exception messages, provider URLs,
flags and free-form fields need separate review. The bundled nginx access format
records the request line and referrer, which can contain sensitive URL parameters.
Keep logs access-controlled, avoid credential-bearing URLs, and verify redaction
with synthetic credentials at every ingress/logger before production. Disable
debug/trace logging for routine production operation. Monitor readiness failures,
unexpected privilege changes, login abuse, errors, disk space, certificate expiry,
backup age and recovery drill age without logging submitted flags or tokens.

## Findings, patching and release gate

Assign an operator to each finding. Record the tool/version, advisory or rule ID,
affected package/version/path, runtime versus build-time use, reachability,
available fix, owner and due date. Reachability helps prioritize; it does not
silently exempt an advisory. Triage critical findings and leaked credentials
within one day, high findings within two business days, and lower severities
weekly. For confirmed exploitable critical issues, restrict the affected feature
immediately and target remediation within 24 hours; target high remediation
within seven days. These are operational targets, not an automated SLA service.

Use a focused dependency update with a refreshed Bun lock, frozen installation,
relevant tests and builds. The initial audit and subsequent remediation are
recorded in [dependency triage](DEPENDENCY-TRIAGE.md). Keep low/moderate advisories
in the patch queue even when the high-severity gate passes. Do not add blanket
allowlists or ignore unfixed advisories merely to turn a workflow green. If a
false positive is proven, scope any exception to one finding, document evidence,
and test that adjacent unsafe input still fails.

Before releasing a reviewed commit:

1. Require successful application CI, Club operations checks, and Club security
   checks for the **same commit**. A maintainer must configure those required
   checks in GitHub branch/ruleset settings; adding workflows does not change
   repository settings. CI image publication is already wired to wait for the
   reusable security job. The remaining container finding therefore blocks those
   build/publish jobs until it is resolved; do not bypass the dependency.
2. Build the release image from that commit and scan its actual filesystem/OS
   packages, then retain its immutable image ID/digest and source SBOM. For a
   local Docker image, use the pinned Trivy binary with
   `trivy image --image-src docker --scanners vuln --severity HIGH,CRITICAL --ignorefile /dev/null --exit-code 1 local/rctf-club:RELEASE`.
   Generate the matching image inventory with
   `trivy image --image-src docker --format cyclonedx --output /secure/release-image.cdx.json local/rctf-club:RELEASE`.
   These commands require the built image and vulnerability database; source
   inventory cannot substitute for them. Mutable base tags and runtime dependency
   resolution mean the source lock alone does not prove image reproducibility.
3. Verify HTTPS/proxy headers, operator recovery, guest/member/admin access,
   uploads, current-event scoring, archive access, and a practice submission on
   an isolated target-like environment. Check external service isolation and
   resource limits with the real host configuration.
4. Take and verify a pre-upgrade backup; preserve its exact application image.
   Complete a restoration drill before first production use and before schema
   or database-major upgrades. Record recovery time and data age.
5. Deploy deliberately under the existing operations lock, check readiness and
   error rates, and record the release identifier. This security workflow never
   publishes or deploys an application image.

## Recovery and rollback

Use `club-ops.sh backup`, then `club-ops.sh verify ARCHIVE`; preserve the matching
image as described in [deployment](DEPLOYMENT.md). The checksum/path tests prove
archive validation, not successful PostgreSQL restoration. Drill on a different
host or a unique state directory/project/port, with outbound mail, webhooks and
instancer access blocked. Verify existing login tokens, an upload, memberships,
archive standings and a practice solve after restoration. Schedule drills to an
owner and retain their measured result; no automatic drill is installed here.

Migrations are forward-only. An incompatible release needs the pre-upgrade
database, uploads, private configuration and exact application image restored
together; merely starting an older image against a migrated database is unsafe.
The explicit `--replace-data` restore command loses writes made after the backup.
Keep the app stopped if restoration fails and investigate the preserved private
staging directory before retrying. PostgreSQL-major migrations, external object
stores, challenge infrastructure, DNS, TLS and provider accounts need separate
recovery procedures.

## Validation and remaining gaps

Locally exercised: checksum-pinned tool installation, snapshot safety tests,
synthetic secret rejection/redaction, unsafe-Dockerfile rejection, actionlint,
source scans, Bun advisory audit and CycloneDX inventory generation. The initial
source inventory after dependency remediation contained 1,272 components; the exact count changes with the
lockfiles. Public fixture findings were reviewed individually and the narrow
exception boundary is tested. See the current check output and dependency triage
for the current advisory state.

**Trivy currently reports `DS-0002` (HIGH) for the production Dockerfile.** The
image starts its entrypoint/supervisord/nginx master as root to initialize upload
ownership and service directories; the API runs as `rctf` and nginx workers as
`nginx`. This is a real residual privilege boundary, not a clean configuration
scan. The gate stays red. Resolve it with a tested non-root container design
(including startup, migrations, upload ownership and backup/restore), or a
separately reviewed, specific risk decision with compensating controls. No
cosmetic `USER` directive or scanner suppression is included here.

No Docker daemon is available in this workspace, so image construction, image
CVE scanning, service startup, network isolation, TLS, and full container-backed
backup/restore remain **unverified**. CI execution in GitHub, required-check
settings, signed release verification, production alert delivery and host
hardening are also not established by these local checks. Complete the release
gate and recovery drill on the target infrastructure before claiming production
readiness.

Tool references: [Gitleaks configuration and redaction](https://github.com/gitleaks/gitleaks),
[Gitleaks release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1),
[Trivy release](https://github.com/aquasecurity/trivy/releases/tag/v0.76.1),
[Trivy Bun coverage](https://trivy.dev/docs/latest/guide/coverage/language/nodejs/),
[Bun audit](https://bun.sh/docs/pm/cli/audit), and
[actionlint release](https://github.com/rhysd/actionlint/releases/tag/v1.7.12).
