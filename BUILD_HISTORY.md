> Historical record from the original checkout. See [README.md](README.md) for the standalone build and CI.

# Code Personal

This is a local, personal Linux x64 build of upstream VS Code OSS stable **1.136.1**,
with the upstream source-built Copilot extension. It is not a Microsoft binary
distribution and does not use Microsoft's commercial extension gallery configuration.

## Provenance and inspection

- Selected stable tag: `1.136.1` (latest GitHub stable release checked 2026-09-06).
- Build commit: `a44adf7f53e00964ab890f9f8758a334f1fc15bc`.
- Local branch: `personal/1.136.1`.
- Initial checkout was `814ab138a8994ee8984c0acd6816ad77e2aa3cef`, version 1.138.0.
  The user explicitly chose the latest stable tag containing bundled Copilot.
- Node: **24.18.0**, from this tag's `.nvmrc`; npm **11.16.0**.
- Electron: **42.10.0**, from upstream `.npmrc`.
- Host: CachyOS x86_64, KDE Plasma Wayland.

References inspected:

- [Current upstream build prerequisites and workflow](https://github.com/microsoft/vscode/wiki/How-to-Contribute).
- [Stable release](https://github.com/microsoft/vscode/releases/tag/1.136.1).
- [Open VSX's current product configuration](https://github.com/eclipse-openvsx/openvsx/wiki/Using-Open-VSX-in-VS-Code).
- Local `build/gulpfile.vscode.ts`, `build/gulpfile.extensions.ts`,
  `build/lib/extensions.ts`, `build/lib/copilot.ts`, `build/lib/electron.ts`,
  `build/gulpfile.vscode.linux.ts`, and `resources/linux/` templates.
- [Electron 42 Linux window identity](https://github.com/electron/electron/blob/v42.10.0/shell/browser/native_window_views.cc)
  and [desktop-name handling](https://github.com/electron/electron/blob/v42.10.0/lib/browser/init.ts).

The full local `vscode-linux-x64` task runs `compile-copilot-extension-build`
after cleaning and compiling the other extensions, on both current build branches.
Running that Copilot task separately first would waste work and its output would
be cleaned. Copilot is built from `extensions/copilot`; its extension ID is
`GitHub.copilot-chat` and its upstream display name is GitHub Copilot. The upstream
manifest includes the completion, Chat, agent and Next Edit Suggestions features.
The separate `@github/copilot-linux-x64` runtime is also packaged by upstream.

## Changes

Only three upstream inputs are customized:

1. `product.json`: merges `.personal-build/product-overrides.json`, overriding
   name, executable, data/shared/server/tunnel names, Linux icon, URL protocol,
   and adding the public Open VSX gallery. All unrelated upstream keys are preserved,
   including `defaultChatAgent`, trusted extension authentication, GitHub auth,
   Copilot endpoints, built-in extensions, completion/NES and telemetry configuration.
2. `resources/linux/code.png`: rendered from the original purple bracket/slash
   icon at `.personal-build/assets/code-personal.svg`. No Microsoft branded icon
   is copied. Replace that SVG and rebuild to change all installed Linux icon assets.
3. `src/vs/workbench/browser/media/code-icon.svg`: copied from the same personal
   SVG for the in-window titlebar and banner. Linux's desktop icon and this
   workbench asset are independent upstream; both must be customized.

All helpers live in `.personal-build/`; see its README. **No TypeScript or CSS
logic patches** are applied. `package.json` in the checkout stays upstream. Upstream
packaging sets the output package name to `Code Personal` and its `desktopName`
to `code-personal.desktop`.

Packaging also adds a small **Open VSX signature-verification adapter** under
`resources/app/node_modules/@vscode/vsce-sign/`. This is a local compatibility
module, not Microsoft's proprietary verifier. It bundles pinned `node-ovsx-sign`
1.2.0, translates its success/errors to the current VS Code result format, and
retains dependency license notices. The additional dependency lockfile lives in
`.personal-build/verifier/`; upstream `package.json` and `package-lock.json` stay
unchanged. `package-verifier.mjs` uses the existing build's esbuild to package the
runtime. `extensions.verifySignature` stays at its upstream enabled default.

The generated desktop entries come from upstream templates. The sole template
correction in the helper is `StartupWMClass=code-personal`: Electron 42 uses
`desktopName` minus `.desktop` for both X11 WM_CLASS and Wayland application ID.
The upstream template still substitutes the display name there. No X11 class flags
or forced Wayland flags are needed in the installed launcher.

## Identity and storage

| Purpose | Code Personal |
| --- | --- |
| Display name | `Code Personal` |
| Executable and CLI | `code-personal` |
| Desktop file / Wayland app ID | `code-personal.desktop` / `code-personal` |
| X11 StartupWMClass | `code-personal` |
| Icon name | `code-personal` |
| URL protocol | `code-personal://` |
| Configuration, databases and extension global/workspace state | `${XDG_CONFIG_HOME:-~/.config}/Code Personal/` |
| Installed user extensions | `~/.code-personal/extensions/` |
| Runtime arguments | `~/.code-personal/argv.json` |
| Shared application data | `~/.code-personal-shared/` |
| Server data (if a server is subsequently built/used) | `~/.code-personal-server/` |

Isolation follows upstream identity handling in
`src/vs/platform/environment/node/userDataPath.ts` and
`src/vs/platform/environment/common/environmentService.ts`, not launcher
`--user-data-dir` flags. Explicit CLI overrides, portable mode, and upstream
environment overrides such as `VSCODE_EXTENSIONS` still take precedence; do not
point them at the WORK editor's paths. Nothing here reads/copies the WORK profile
or extension storage, changes its defaults, or modifies the installed `code`.

GitHub authentication uses the upstream provider and its dynamic URI scheme.
Application databases and Electron credential identity are separate. Browser
cookies/SSO and the operating system wallet itself remain shared OS facilities;
choose the personal GitHub account in the browser when signing in.

## Build

Required Arch packages were already present: `base-devel`, `gcc`, `make`, `pkgconf`,
`python`, `python-setuptools`, `libx11`, `libxkbfile`, `libsecret`, `krb5`,
`fakeroot`, `desktop-file-utils`, and `librsvg`. Node 24.18.0 was installed locally
through the existing nvm installation, without changing the system Node or using sudo.

```bash
git fetch origin tag 1.136.1
git switch -c personal/1.136.1 1.136.1
source ~/.nvm/nvm.sh
nvm install 24.18.0
nvm use 24.18.0
npm ci
node .personal-build/customize.mjs
npm run gulp vscode-linux-x64
bash .personal-build/package.sh
cd .personal-build/arch
makepkg --cleanbuild
```

For subsequent builds, `./.personal-build/build.sh` performs dependency installation,
customization, the full upstream build, payload verification and archive preparation.
`--skip-install` skips only dependency installation. Run `makepkg --cleanbuild` in
`.personal-build/arch` afterwards to create the package. Generated dependencies,
output directories, logs, archives and package payloads must not be committed.

## Artifacts and installation

Verified output paths for this checkout:

- Runnable application: `/home/kenshinouu/projects/VSCode-linux-x64/`.
- CLI: `/home/kenshinouu/projects/VSCode-linux-x64/bin/code-personal`.
- Archive: `.personal-build/dist/code-personal-1.136.1-linux-x64.tar.gz`.
- Desktop entries: `.personal-build/dist/code-personal.desktop` and
  `.personal-build/dist/code-personal-url-handler.desktop`.
- Arch recipe: `.personal-build/arch/PKGBUILD`, generated with actual SHA-256 checksums.
- Arch package: `.personal-build/arch/code-personal-1.136.1-3-x86_64.pkg.tar.zst`.

Review `PKGBUILD` and the package contents before installing:

```bash
cd /home/kenshinouu/projects/vscode/.personal-build/arch
less PKGBUILD
bsdtar -tf code-personal-1.136.1-3-x86_64.pkg.tar.zst
sudo pacman -U ./code-personal-1.136.1-3-x86_64.pkg.tar.zst
```

The package installs the application to `/opt/code-personal/`, a symlink at
`/usr/bin/code-personal` (the Arch package-managed alternative to `/usr/local/bin`),
desktop entries in `/usr/share/applications/`, and distinct SVG/PNG icons in the
hicolor theme. It has no conflict, replacement, or provision of `code` or
`visual-studio-code-bin`. Pacman's desktop/icon hooks refresh KDE's application
catalog. It registers its own protocol without changing default text-file handlers.
If KDE hasn't refreshed, run `kbuildsycoca6 --noincremental` as your normal user.

Start **Code Personal** from KDE's application menu and pin that running application.
The URL handler remains hidden from the application menu. To explicitly select
the new protocol handler if necessary:

```bash
xdg-mime default code-personal-url-handler.desktop x-scheme-handler/code-personal
```

No global installation is performed by the build helpers.

## Uninstall

```bash
sudo pacman -R code-personal
```

Unpin Code Personal in Plasma. Configuration and extensions remain for reinstall;
if you deliberately want to erase personal data, delete only the Code Personal
paths in the table above. Do not delete `~/.config/Code` or `~/.vscode`.

## Updating upstream

Keep the `.personal-build` layer and this document in a local commit (along with
the two customized inputs). Fetch a new stable tag, then rebase your local changes
onto it, resolving `product.json` by keeping new upstream content and rerunning
`node .personal-build/customize.mjs`. Alternatively, start a new branch at the tag
and copy only `.personal-build` and this document onto it, then customize.

Update `.personal-build/upstream.json` to the new tag and its exact upstream commit.
Reinspect `.nvmrc`, Copilot task dependencies, gallery configuration and Electron's
desktop identity handling before rebuilding. The metadata verifier rejects any
unintended loss of upstream fields. Update this document's tag/commit and validation
results for the new build. Do not mix output from different revisions or hand-edit
only the packaged product file: upstream also inlines product metadata into JS.

## Verification and limitations

Icon correction (package release 2): the first build still showed the generic OSS
icon inside the titlebar. The customization helper now copies the personal SVG
to the workbench icon input as well. For this asset-only correction, the existing
`out-vscode` and runnable package's standalone `media/code-icon.svg` and
`vs/workbench/browser/media/code-icon.svg` were refreshed atomically, then
`bash .personal-build/package.sh` and `makepkg --cleanbuild` regenerated the
archives/package. No code recompilation was required; the bundled CSS references
the standalone SVG. A separate temporary-profile launch confirmed that the live
titlebar fetched the exact personal SVG; screenshot:
`.personal-build/logs/icon-titlebar.png`, result:
`.personal-build/logs/icon-verification.json`. The user's running personal window
and profile were left open and unchanged. Future full builds apply it automatically.
**Fully close and reopen Code Personal** to load changed icons: the user confirmed
that Reload Window retained the cached icon. Installed builds need the updated
package installed first, then a restart.

Extension-install correction (package release 3): the initial smoke tests missed
the complete gallery installation path. Installing Claude Code exposed
`Could not load vsce-sign module Cannot find package '@vscode/vsce-sign'`. Open VSX
also uses Ed25519 signatures instead of Microsoft's PKCS7 format; simply adding
Microsoft's module would not fix compatibility. The packaging adapter uses the
[Open VSX-compatible verifier](https://github.com/filiptronicek/node-ovsx-sign)
and does not bypass failed checks. Public signing keys come from Open VSX over
HTTPS. Alternate `OVSX_REGISTRY_URL`/`VSX_REGISTRY_URL` overrides are rejected by
this adapter because this build is configured specifically for open-vsx.org.

Validated against the actual `Anthropic.claude-code@2.1.263` Linux x64 download:

- Original VSIX/signature: `Success`, `didExecute: true`.
- Modified VSIX (changed ZIP comment while retaining a valid ZIP structure):
  rejected with `SignatureManifestIsInvalid`, `didExecute: true`.
- Normal packaged CLI installation from Open VSX into an isolated test profile:
  `Extension signature verification result for anthropic.claude-code: Success.
  Executed: true.` Installation completed successfully, without any signature
  bypass flags or user-setting changes.

Evidence: `.personal-build/logs/verifier-tests.json`, `gallery-install.log`, and
`verifier-bundle.log`. The current unpacked build was updated in place. **Fully
close every Code Personal window and reopen it before retrying installation**:
the shared process caches its failed module import. No personal extensions were
installed by the test; its extension directory was isolated under the ignored
`.personal-build/logs/gallery-test/` directory.

Completed on 2026-09-06:

- `npm ci` completed successfully using Node 24.18.0 and the upstream lockfiles.
- `npm run gulp vscode-linux-x64` completed successfully. The log shows
  `compile-copilot-extension-build` ran once, and the Copilot bundle reported zero
  errors. Upstream extension/media type checks completed without errors.
- CLI `bin/code-personal --version` returned `1.136.1`, the stable commit above,
  and `x64`. `ldd` found no missing executable shared libraries.
- `.personal-build/verify.mjs` passed: identity, every unrelated upstream product
  field, distinct PNG, packaged desktopName, GitHub authentication manifest,
  Copilot `0.64.1` manifest and `dist/extension.js`, `dist/copilotCLIShim.js`,
  Linux Copilot native runtime `runtime.node`, and executable ripgrep payload.
- `.personal-build/smoke.mjs` launched the packaged binary with normal sandboxing
  and without data/extension-directory overrides. The live renderer reported
  `/home/kenshinouu/.config/Code Personal`; natural extension/shared directories
  were created at `/home/kenshinouu/.code-personal/extensions` and
  `/home/kenshinouu/.code-personal-shared`.
- Wayland protocol logging recorded `xdg_toplevel.set_app_id("code-personal")`.
  The existing `code` processes remained running simultaneously. At inspection,
  no descriptor in the personal process tree referenced the WORK data/extension
  directories. This is a live descriptor snapshot, not a full filesystem trace.
- The workbench rendered and displayed the Chat/Agent interface; screenshot:
  `.personal-build/logs/workbench.png`. Report: `.personal-build/logs/smoke.json`.
  The test instance was closed afterwards; its personal profile remains.
- `desktop-file-validate` passed for both generated desktop entries.
- `makepkg --cleanbuild` produced the Arch package successfully, without sudo or
  installation. Package payload files stay under the intended
  personal application/launcher/icon/license paths, and **zero file collisions**
  with the installed `visual-studio-code-bin` package (checked against pacman's
  database). No system files or official VS Code package files were modified.

The first-launch profile deliberately follows upstream behavior: Copilot is
installed but initially disabled until the user completes Chat setup.
`ensureChatExtensionInitialDisabledState()` in the upstream extension enablement
service implements this. Complete the normal **Sign In** / Copilot setup flow;
the build does not patch this gating or turn off AI. The unsigned-in smoke test
therefore does not claim that Copilot's authenticated extension session activated.

Startup logs showed no workbench crash or missing library. They did show the
upstream OSS Remote Tunnels limitation: `tunnelApplicationConfig` is absent,
so Remote Tunnels is unavailable. A Node `url.parse()` deprecation warning came
from the agent host. Neither prevents desktop startup. Full Plasma pin/unpin
behavior with installed icon/desktop files and authenticated Copilot behavior
remain the manual acceptance steps below; the package was prepared, not installed.

Logs: `.personal-build/logs/{npm-ci,build,makepkg,launch}.log`; metadata/payload
report: `.personal-build/logs/verification.json`. To repeat the desktop test,
close existing Code Personal windows and run, from this checkout:

```bash
source ~/.nvm/nvm.sh
nvm use
node .personal-build/smoke.mjs
```

Manual acceptance after installing:

1. Keep the WORK editor open and launch `code-personal`. Confirm two separate
   Plasma entries and independently pin each. Confirm the purple Personal icon.
2. Open **Developer: Open User Data Folder**, then **Extensions: Open Extensions
   Folder**. Confirm the personal paths listed above.
3. Search Open VSX for a third-party extension and install it; it must appear only
   in the personal extension directory.
4. Sign in through Copilot's normal GitHub flow using the personal account. Confirm
   `code-personal://` callbacks open Code Personal. No PAT is needed.
5. In a trusted scratch project, type a function and confirm inline ghost text;
   ask Copilot Chat a question, run an agent task and accept a harmless file edit.
   Enable/use Next Edit Suggestions where offered by upstream and your entitlement.
6. Restart Code Personal and confirm its personal session persists independently
   of the WORK editor. Inspect **GitHub Copilot** output and **Developer: Show
   Running Extensions** if any feature fails.

Authentication, service entitlement, model access and account-specific completions
cannot be proven without an interactive personal sign-in. Open VSX has a different
catalog from Microsoft's Marketplace. Optional upstream agent SDK or dictation
downloads may still occur on demand. Server/tunnel naming is configured, but this
desktop build does not independently build or validate a remote server/tunnel
distribution. This personal build must be updated by rebuilding/reinstalling.
