FROM archlinux:base-devel@sha256:fa2d4ce3310ddd90a4208e5168be8ad367da5129af1245f38fd2d803bcbe3239
RUN pacman -Syu --noconfirm --needed \
    git python python-setuptools pkgconf libx11 libxkbfile libsecret krb5 \
    curl ripgrep librsvg desktop-file-utils xorg-server-xvfb xorg-xauth \
    gtk3 nss alsa-lib libxss libxrandr mesa libdrm libcups at-spi2-core \
    libxcomposite libxdamage libxfixes libxkbcommon pango dbus unzip dpkg \
    && pacman -Scc --noconfirm
WORKDIR /workspace
