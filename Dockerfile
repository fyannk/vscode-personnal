FROM archlinux:base-devel@sha256:84cd9ef000b3cff245ec028e87965b84724f4bf1cc63fc2741ba927b88515ed6
RUN pacman -Syu --noconfirm --needed \
    git python python-setuptools pkgconf libx11 libxkbfile libsecret krb5 \
    curl ripgrep librsvg desktop-file-utils xorg-server-xvfb xorg-xauth \
    gtk3 nss alsa-lib libxss libxrandr mesa libdrm libcups at-spi2-core \
    libxcomposite libxdamage libxfixes libxkbcommon pango dbus unzip \
    && pacman -Scc --noconfirm
WORKDIR /workspace
