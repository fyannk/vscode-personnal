FROM archlinux:base-devel@sha256:51dd3d24f7fba779e7c471caeee7804c50e8c134ad948e19685a1c83a42facc3
RUN pacman -Syu --noconfirm --needed \
    git python python-setuptools pkgconf libx11 libxkbfile libsecret krb5 \
    curl ripgrep librsvg desktop-file-utils xorg-server-xvfb xorg-xauth \
    gtk3 nss alsa-lib libxss libxrandr mesa libdrm libcups at-spi2-core \
    libxcomposite libxdamage libxfixes libxkbcommon pango dbus unzip dpkg \
    && pacman -Scc --noconfirm
WORKDIR /workspace
