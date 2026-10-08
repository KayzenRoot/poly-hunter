# Isolated PH-M02-WO-001 Node 24 Alpine 3.24 canary; do not use as canonical before gates pass.
FROM --platform=linux/amd64 node:24.21.0-alpine3.24@sha256:83f1c388c31fb2e51f7cbd4dea949b96260798c98f206e8e4696bc93bd964e3a

RUN set -eux; \
    printf '%s\n' 'https://dl-cdn.alpinelinux.org/alpine/v3.24/main' > /tmp/alpine.repositories; \
    apk list --installed | sed 's/ .*//' | sort > /tmp/alpine-packages.before; \
    apk add --no-cache --repositories-file /tmp/alpine.repositories 'zlib=1.3.2-r1'; \
    apk list --installed | sed 's/ .*//' | sort > /tmp/alpine-packages.after; \
    node -e 'const fs=require("node:fs");const names=p=>fs.readFileSync(p,"utf8").trim().split(/\r?\n/).map(x=>x.replace(/^zlib-.*$/,"zlib-<version>")).sort().join("\n");if(names("/tmp/alpine-packages.before")!==names("/tmp/alpine-packages.after"))throw new Error("package set changed beyond zlib");const installed=fs.readFileSync("/tmp/alpine-packages.after","utf8");if(!installed.split(/\r?\n/).some(x=>x.startsWith("zlib-1.3.2-r1")))throw new Error("zlib 1.3.2-r1 absent");console.log("only zlib updated to 1.3.2-r1")'; \
    rm -f /tmp/alpine.repositories /tmp/alpine-packages.before /tmp/alpine-packages.after
WORKDIR /workspace

RUN mkdir -p /workspace && chown node:node /workspace

COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node apps/web/package.json apps/web/package.json
COPY --chown=node:node apps/worker/package.json apps/worker/package.json
COPY --chown=node:node packages/contracts/package.json packages/contracts/package.json
COPY --chown=node:node packages/domain/package.json packages/domain/package.json
COPY --chown=node:node packages/db/package.json packages/db/package.json
COPY --chown=node:node packages/testkit/package.json packages/testkit/package.json
COPY --chown=node:node packages/polymarket/package.json packages/polymarket/package.json

RUN mkdir -p apps/web/.next && chown -R node:node /workspace

# Keep Node 24 and npm stable, then refresh only npm's vulnerable bundled
# dependencies within the ranges declared by npm's own dependency tree.
RUN set -eu; \
    npm install --global --no-audit --no-fund --ignore-scripts npm@12.2.0; \
    root="$(npm root --global)/npm/node_modules"; \
    test "$root" = "/usr/local/lib/node_modules/npm/node_modules"; \
    tmp="$(mktemp -d)"; \
    cd "$tmp"; \
    npm pack --ignore-scripts --json \
      brace-expansion@5.0.11 \
      undici@6.28.1 \
      http-cache-semantics@4.3.0 > pack.json; \
    node -e 'const fs=require("node:fs");const expected={"brace-expansion":["5.0.11","sha512-awigjhi6cLTh90bdw6+QJ9CtmJmyYhEIi70iCbc8Rozn04Fw9FeQIBjv/E22FFGuCGx1bLJyUfB64x/szUSXUg=="],"undici":["6.28.1","sha512-zWpdTVD54H48CIybL0rWQ3ukpb9d23wM7eH5RtfdmeP70cWHNjtfo7P4vZX+5CoDcO53J4Pu5uXp7lNfjc6DRA=="],"http-cache-semantics":["4.3.0","sha512-M5t5LlJpS1UHMjvwRQVdFHvPISGeLAxNcrWuJkeGh0KxsqCHZ1O3NXZU/8x7cD0BDcGW8kapxMKTvwlqrNkHkA=="]};const packed=JSON.parse(fs.readFileSync("pack.json","utf8"));for(const [name,[version,integrity]] of Object.entries(expected)){const item=packed[name];if(!item||item.version!==version||item.integrity!==integrity)throw new Error("npm tarball identity mismatch: "+name)}'; \
    for spec in brace-expansion:5.0.11 undici:6.28.1 http-cache-semantics:4.3.0; do \
      package="${spec%%:*}"; \
      version="${spec#*:}"; \
      rm -rf "$root/$package"; \
      mkdir -p "$root/$package"; \
      tar -xzf "$tmp/$package-$version.tgz" --strip-components=1 -C "$root/$package"; \
    done; \
    node -e 'const fs=require("node:fs");const path=require("node:path");const root="/usr/local/lib/node_modules/npm/node_modules";const semver=require(path.join(root,"semver"));const pkg=name=>JSON.parse(fs.readFileSync(path.join(root,name,"package.json"),"utf8"));const expected={"brace-expansion":"5.0.11",undici:"6.28.1","http-cache-semantics":"4.3.0",tar:"7.5.22","ip-address":"10.5.0"};for(const [name,version] of Object.entries(expected)){if(pkg(name).version!==version)throw new Error(name+" version mismatch")}for(const [parent,dependency] of [["minimatch","brace-expansion"],["node-gyp","undici"],["make-fetch-happen","http-cache-semantics"]]){if(!semver.satisfies(pkg(dependency).version,pkg(parent).dependencies[dependency]))throw new Error(dependency+" falls outside "+parent+" declared range")}if(!semver.satisfies(pkg("balanced-match").version,pkg("brace-expansion").dependencies["balanced-match"]))throw new Error("balanced-match falls outside brace-expansion declared range")'; \
    npm --version; \
    npm ls --global --all brace-expansion undici tar ip-address http-cache-semantics balanced-match; \
    rm -rf "$tmp"

USER node

RUN npm ci --ignore-scripts

COPY --chown=node:node tsconfig.base.json ./
