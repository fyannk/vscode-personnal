# Code Personal Remote - SSH

This bundled extension is a Code Personal adaptation of Open Remote - SSH
version 0.3.1, source commit `1240a12185b8f671ad4ec45b92acbbffb7b8c95d`.

Upstream source: https://github.com/jeanp413/open-remote-ssh

The upstream MIT license is retained in `LICENSE.txt`.

The bundled SSH transport includes Jean Philippe's `ssh2` fork at commit
`a169f627213aa663e0aa2fd2f0ef5c8931890c26` (MIT); its license is retained as
`SSH2-LICENSE.txt` in the installed extension.

Code Personal changes the extension identity and UI text, uses the matching
Code Personal server archive configured in the application product metadata,
and refuses to fall back to another distribution's server archive.
