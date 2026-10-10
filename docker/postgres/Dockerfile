# syntax=docker/dockerfile:1.7
# Local PostgreSQL 17.11 image with only the Alpine 3.24 zlib security update.
ARG SOURCE_DATE_EPOCH=0
FROM postgres:17.11-alpine3.24@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24
ARG SOURCE_DATE_EPOCH

RUN set -eux; \
    test "$(cut -d. -f1,2 /etc/alpine-release)" = "3.24"; \
    awk -F: '/^P:/{p=substr($0,3)} /^V:/{print p "-" substr($0,3)}' /lib/apk/db/installed | sort > /tmp/apk.before; \
    awk -F: '$1=="P"{p=$2} $1=="V"&&p=="zlib"{print $2; exit}' /lib/apk/db/installed > /tmp/zlib.before; \
    cp /etc/apk/repositories /tmp/apk.repositories; \
    printf '%s\n' 'https://dl-cdn.alpinelinux.org/alpine/v3.24/main' > /etc/apk/repositories; \
    apk update; \
    apk add --no-cache --upgrade 'zlib=1.3.2-r1'; \
    mv /tmp/apk.repositories /etc/apk/repositories; \
    awk -F: '/^P:/{p=substr($0,3)} /^V:/{print p "-" substr($0,3)}' /lib/apk/db/installed | sort > /tmp/apk.after; \
    awk -F: '$1=="P"{p=$2} $1=="V"&&p=="zlib"{print $2; exit}' /lib/apk/db/installed > /tmp/zlib.after; \
    test "$(cat /tmp/zlib.before)" = '1.3.2-r0'; \
    test "$(cat /tmp/zlib.after)" = '1.3.2-r1'; \
    grep -v '^zlib-' /tmp/apk.before > /tmp/apk.before.other; \
    grep -v '^zlib-' /tmp/apk.after > /tmp/apk.after.other; \
    diff -u /tmp/apk.before.other /tmp/apk.after.other; \
    rm -rf /var/cache/apk/* /tmp/apk.before /tmp/apk.after /tmp/apk.before.other /tmp/apk.after.other /tmp/zlib.before /tmp/zlib.after; \
    rm -f /var/log/apk.log; \
    chown postgres:postgres "$PGDATA"; \
    chmod 700 "$PGDATA"

# The canonical Compose volume is initialized with postgres-owned PGDATA.
# Starting as postgres avoids a root phase in the official image entrypoint.
USER postgres
