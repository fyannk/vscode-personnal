# Code Personal

An independent customization/packaging project for **upstream VS Code OSS stable**,
with bundled upstream Copilot, Open VSX and a compatible signature verifier.
The repository is `vscode-personnal`; the app/command remain **Code Personal** /
**`code-personal`**.

Only customizations are tracked. Builds fetch upstream into `.work/<version>/vscode`
and produce `dist/` artifacts. Your existing VS Code checkout, WORK editor, profiles,
credentials and extensions are never copied into this project.

## Build locally

Use the disposable Arch container with Docker available to your normal user:

```bash
git clone git@github.com:fyannk/vscode-personnal.git
cd vscode-personnal
./scripts/build-container.sh
```

Local builds default to the exact tag/commit in `upstream.json`. To select another:

```bash
./scripts/build-container.sh --tag 1.136.1 --commit a44adf7f53e00964ab890f9f8758a334f1fc15bc
```

The container installs Arch dependencies and builds as an unprivileged user.
The exact Node version from upstream `.nvmrc` is downloaded and its official SHA-256
checksum checked. `./scripts/build.sh` also works natively with the dependencies
listed in `Dockerfile`; close existing Code Personal windows before its smoke test.

Allow roughly 25–35 GB of disk per build tree and substantial memory. CI adds an 8 GB swap
on its disposable runner. `.work/<version>` is a generated cache, not a development
checkout; remove that version directory when no longer needed. Rebuilding a version
reuses its checkout and reapplies the overlay.

## GitHub Actions

**Build Code Personal releases** runs every six hours at minute 17, on relevant
pushes to `main`, and on manual dispatch. It:

1. Finds the latest stable `microsoft/vscode` release and resolves its exact commit.
2. Skips an already published personal package revision; retries an unfinished draft.
3. Builds inside Arch Linux. Missing Copilot or changed build assumptions fail the run.
4. Verifies preserved upstream metadata, separate identity/storage, matching icons,
   and bundled Copilot manifest/runtime files.
5. Launches the desktop under Xvfb, installs a real Open VSX extension with signature
   checks enabled, and requires an altered VSIX to fail verification.
6. Produces the Arch and Debian/Ubuntu packages, application archive, checksums and
   source provenance.
7. Installs the Debian package on the Ubuntu 24.04 runner, checks its launcher and
   version, then removes it.
8. Publishes assets to this private repository's **Releases** only after checks pass.

Release tags are `personal-v<VS_CODE_VERSION>-r<PACKAGE_REVISION>`. Bump
`packageRevision` in `config.json` for a customization update to an already published
VS Code version; it is the `pkgrel` of the Arch package and the Debian revision of the
`.deb`. Keep previous packages for rollback.

Scheduled builds follow the latest stable release; `upstream.json` remains the
reviewed default for local builds. Every artifact includes `build-info.json` with
both upstream and customization commits. Arch packages update inside the pinned
base image: builds are traceable, not claimed to be byte-for-byte reproducible.

To run manually: **Actions → Build Code Personal releases → Run workflow**.
Choose `latest` or a numeric stable tag. Clear **publish** for a test-only build,
even if that version is already released. The release artifact is deleted once
its assets are uploaded (otherwise it expires after one day); failure logs are
retained for seven days; release assets remain until deleted. Private Actions usage is subject
to your GitHub account's allowance and billing settings.

Actions must be enabled and the workflow present on the default branch. This is
polling, not an instant upstream release webhook; GitHub may delay scheduled runs.
No PAT or additional secret is needed. The build job has read access; only a separate
publication job has write access. Checkout does not persist credentials, and no
GitHub token is passed into the build container. Actions/base image are pinned;
Dependabot proposes updates for Actions, Docker and verifier dependencies.

References: [workflow triggers](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows),
[upstream build guide](https://github.com/microsoft/vscode/wiki/How-to-Contribute),
[Open VSX configuration](https://github.com/eclipse-openvsx/openvsx/wiki/Using-Open-VSX-in-VS-Code).

## Install, update, or roll back

Download the package for your distribution from **Releases**, or use your local
`dist/` package.

Arch Linux / CachyOS:

```bash
sudo pacman -U ./code-personal-<version>-<revision>-x86_64.pkg.tar.zst
```

Ubuntu / Debian (the `./` prefix makes `apt` resolve dependencies from the file):

```bash
sudo apt install ./code-personal_<version>-<revision>_amd64.deb
```

Both packages install the same layout: `/opt/code-personal`, `/usr/bin/code-personal`,
separate desktop entries and `code-personal` icons. They do not conflict with
`visual-studio-code-bin`, `code` or `codium`. The Debian package declares upstream's
own `.deb` runtime dependencies and is verified to install on Ubuntu 22.04 and 24.04.
Fully close and reopen Code Personal after updates; Reload Window can retain an old
icon or cached shared-process module.

CI publishes packages; it does **not** install updates on your computer. Roll back
with `sudo pacman -U` or `sudo apt install ./…` on a saved package. Uninstall with
`sudo pacman -R code-personal` or `sudo apt remove code-personal`; your personal
profile and extensions remain.

| Data | Default path |
| --- | --- |
| Configuration and sessions | `~/.config/Code Personal` (or `$XDG_CONFIG_HOME/Code Personal`) |
| Extensions | `~/.code-personal/extensions` |
| Shared data | `~/.code-personal-shared` |
| Server data identity | `~/.code-personal-server` |
| URL scheme | `code-personal://` |

Upstream explicit path/environment overrides still apply; never point them at the
WORK editor's storage.

## Open Remote SSH

Every release bundles **Code Personal Remote - SSH**, a branded adaptation of Open
Remote - SSH. On first connection it downloads the matching **Code Personal remote
server** archive from that same release—never a VSCodium or Microsoft VS Code server.
Remote data and remote extensions live in `~/.code-personal-server`.

Use **Code Personal Remote - SSH: Connect to Host…**. The extension preserves the
standard `remote.SSH.*` setting names, including
`remote.SSH.serverDownloadUrlTemplate` for an intentional private mirror. A remote
host that requires an HTTP(S) proxy should expose its usual `http_proxy` /
`https_proxy` environment variables to a login shell; the installer runs through
`bash -l`, so normal remote profile configuration is used.

The bundled resolver uses the `code-personal-ssh` remote authority. This keeps it
separate from a user-installed Open Remote - SSH extension, which owns
`ssh-remote`; open existing `ssh-remote` windows again through the Code Personal
command after upgrading.

The release archive can still be installed manually on air-gapped hosts. Replace
`HOST` with its SSH alias and use the commit on the second line of
`code-personal --version`:

```bash
commit=$(code-personal --version | sed -n '2p')
scp code-personal-server-<version>-linux-x64.tar.gz HOST:/tmp/code-personal-server.tar.gz
ssh HOST "mkdir -p ~/.code-personal-server/bin/$commit && tar -xzf /tmp/code-personal-server.tar.gz --strip-components=1 -C ~/.code-personal-server/bin/$commit && rm /tmp/code-personal-server.tar.gz"
```

Packaging includes the Open VSX verifier (`@vscode/vsce-sign`) in both the desktop
and server payloads and checks that the server's Node runtime can import it.
If an older server reports **Signature verification was not executed**, inspect
its `data/logs/*/remoteagent.log` for `Could not load vsce-sign module`. Reinstall
the corrected server archive, then restart the remote server before reconnecting:
the running process caches a failed verifier import. Keep
`extensions.verifySignature` enabled.
Use a Linux x64 archive for Linux x64 hosts; other architectures are not built yet.

## Maintain the customization

- `overlay/product-overrides.json`: identity, Open VSX endpoints, and the narrow
  proposed-API allow-list for bundled Code Personal Remote - SSH. It permits only
  `code-personal.code-personal-remote-ssh` to use the two remote APIs it declares;
  do not add unrelated extensions or proposals without reviewing their manifests.
- `overlay/remote-ssh/`: vendored MIT source for Code Personal Remote - SSH,
  derived from Open Remote - SSH 0.3.1. Its server resolver is branded and refuses
  to fall back to any other distribution. Keep the upstream attribution and licenses
  when updating it.
- `overlay/customize.mjs`: applies the overrides and patches the upstream
  `telemetry.telemetryLevel` default to `off`. VS Code OSS has no Microsoft
  telemetry endpoint or crash upload URL, but bundled Copilot reports usage to
  GitHub unless this setting is `off`; users can still opt in. The patch and
  `verify.mjs` fail the build if upstream moves the setting.
- `overlay/assets/code-personal.svg`: editable icon for desktop PNG and titlebar SVG.
- `overlay/verifier/`: pinned `node-ovsx-sign` and its API adapter.
  `package-verifier.mjs` bundles the runtime/license notices without modifying
  upstream package files or disabling verification.
- `overlay/arch/PKGBUILD.in`: package layout; revision comes from `config.json`.
- `overlay/debian/control.in` and `overlay/deb-package.mjs`: the Debian package, built
  with `dpkg-deb` inside the Arch container from the same verified application tree
  and layout. Its `Depends` come from upstream's `build/linux/debian/dep-lists.ts`
  (the reference list behind Microsoft's own `.deb`), plus `libsecret` and Kerberos
  like the Arch package. No maintainer scripts: dpkg triggers refresh the desktop
  and icon databases.
- `scripts/`: preparation, build environment, release planning and artifact collection.
- `tests/`: release-planning tests. Run `npm test` with Node 22 or newer.
- `BUILD_HISTORY.md`: historical notes from the original checkout, including the
  icon/signature fixes. Its old filesystem paths are historical.

If upstream changes Copilot, product fields, Electron identity or signatures, inspect
the failed run and update the smallest relevant helper. The workflow does not merge
patches or bypass failures automatically. Update `overlay/verifier/package-lock.json`
deliberately when updating verifier dependencies.

## Verification limits

CI tests a headless X11 desktop, not Plasma Wayland pinning. Only the disposable
container smoke test uses `--no-sandbox`, because nested browser sandboxing is not
available there. This flag is never written into the app, launcher, desktop entries
or user settings. Installed builds keep upstream sandbox behavior.

Personal authentication, entitled Copilot responses, ghost text, agents and Next Edit
Suggestions still need manual checks after significant updates. Upstream enables
bundled Copilot through normal Chat setup/sign-in. Open VSX has a different catalog
from Microsoft's Marketplace. OSS Remote Tunnels lacks commercial configuration;
server/tunnel distributions are not separately built. No VSCodium patch set or
commercial product configuration is used.

For personal use. Upstream and dependency notices are retained; the verifier includes
EPL-2.0 code.
