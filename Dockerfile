FROM archlinux:base-devel@sha256:624bdc7fc6615155d67bc34cf7146c0c9fd0e3c92943977da63a630e4ca49c30
RUN pacman -Syu --noconfirm --needed \
    git python python-setuptools pkgconf libx11 libxkbfile libsecret krb5 \
    curl ripgrep librsvg desktop-file-utils xorg-server-xvfb xorg-xauth \
    gtk3 nss alsa-lib libxss libxrandr mesa libdrm libcups at-spi2-core \
    libxcomposite libxdamage libxfixes libxkbcommon pango dbus unzip dpkg \
    && pacman -Scc --noconfirm
WORKDIR /workspace
