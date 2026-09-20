FROM archlinux:base-devel@sha256:61f7de2dd88cc4ba1fe36c24cfe1a503c3936984492d6405eeab013ce6ac68c5
RUN pacman -Syu --noconfirm --needed \
    git python python-setuptools pkgconf libx11 libxkbfile libsecret krb5 \
    curl ripgrep librsvg desktop-file-utils xorg-server-xvfb xorg-xauth \
    gtk3 nss alsa-lib libxss libxrandr mesa libdrm libcups at-spi2-core \
    libxcomposite libxdamage libxfixes libxkbcommon pango dbus unzip dpkg \
    && pacman -Scc --noconfirm
WORKDIR /workspace
