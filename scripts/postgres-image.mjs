#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = path.join(root, "docker", "postgres", "image.lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const args = process.argv.slice(2);
const command = args.shift();

function option(name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--"))
    throw new Error(`${name} requires a value`);
  args.splice(index, 2);
  return value;
}

function flag(name) {
  const index = args.indexOf(name);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
}

function run(
  executable,
  commandArgs,
  { env = process.env, cwd = root, input } = {},
) {
  const result = spawnSync(executable, commandArgs, {
    cwd,
    env,
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${executable} ${commandArgs.join(" ")} exited ${result.status}\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function docker(commandArgs, options) {
  return run("docker", commandArgs, options);
}

function digestFile(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function inspectImage() {
  const raw = docker([
    "image",
    "inspect",
    lock.image,
    "--format",
    "{{json .}}",
  ]).stdout.trim();
  return JSON.parse(raw);
}

function assertImageIdentity(metadata, image) {
  const manifest = metadata["containerimage.digest"];
  const config = metadata["containerimage.config.digest"];
  if (manifest !== lock.manifestDigest) {
    throw new Error(
      `Built manifest ${manifest} differs from locked ${lock.manifestDigest}`,
    );
  }
  if (config !== lock.configDigest) {
    throw new Error(
      `Built config ${config} differs from locked ${lock.configDigest}`,
    );
  }
  if (image.Id !== lock.manifestDigest && image.Id !== lock.configDigest) {
    throw new Error(
      `Loaded image ID ${image.Id} matches neither the locked manifest nor config digest`,
    );
  }
  if (`${image.Os}/${image.Architecture}` !== lock.platform) {
    throw new Error(
      `Loaded platform ${image.Os}/${image.Architecture} differs from ${lock.platform}`,
    );
  }
  if (image.Config.User !== lock.runtimeUser) {
    throw new Error(
      `Image default user ${image.Config.User} differs from ${lock.runtimeUser}`,
    );
  }
}

function inspectRuntime() {
  const script = [
    "set -eu",
    `test "$(id -u)" = '${lock.runtimeUid}'`,
    `test "$(postgres --version)" = 'postgres (PostgreSQL) ${lock.postgresVersion}'`,
    `test "$(cut -d. -f1,2 /etc/alpine-release)" = '${lock.alpineVersion}'`,
    `apk list -I | grep -Fq 'zlib-${lock.zlibVersion} '`,
    `test "$(sha256sum /usr/lib/libz.so.1 | cut -d' ' -f1)" = '${lock.libzSha256}'`,
    `test "$(stat -c '%u' '${lock.pgdataPath}')" = '${lock.runtimeUid}'`,
    `test "$(stat -c '%g' '${lock.pgdataPath}')" = '${lock.runtimeUid}'`,
    `test "$(stat -c '%a' '${lock.pgdataPath}')" = '700'`,
    `printf 'uid='; id -u; postgres --version; cut -d. -f1,2 /etc/alpine-release; apk list -I | grep -F 'zlib-${lock.zlibVersion} '; sha256sum /usr/lib/libz.so.1; stat -c '%u:%g:%a %n' "$PGDATA"`,
  ].join("; ");
  return docker([
    "run",
    "--rm",
    "--platform",
    lock.platform,
    "--entrypoint",
    "sh",
    lock.image,
    "-ec",
    script,
  ]).stdout.trim();
}

function build({ noCache = false, receiptPath } = {}) {
  const temporaryDirectory = mkdtempSync(
    path.join(os.tmpdir(), "polyhunter-postgres-"),
  );
  const archivePath = path.join(temporaryDirectory, "postgres-image.tar");
  const metadataPath = path.join(temporaryDirectory, "build-metadata.json");
  let buildOutput = "";
  try {
    const buildArgs = [
      "buildx",
      "build",
      "--pull",
      "--platform",
      lock.platform,
      "--provenance=false",
      "--build-arg",
      `SOURCE_DATE_EPOCH=${lock.sourceDateEpoch}`,
      "--metadata-file",
      metadataPath,
      "--output",
      `type=docker,dest=${archivePath},rewrite-timestamp=true`,
      "--tag",
      lock.image,
      "--file",
      "docker/postgres/Dockerfile",
    ];
    if (noCache) buildArgs.push("--no-cache");
    buildArgs.push(".");
    const buildResult = docker(buildArgs);
    buildOutput = `${buildResult.stdout}${buildResult.stderr}`;
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
    const archiveSha256 = digestFile(archivePath);
    docker(["image", "load", "--input", archivePath]);
    const image = inspectImage();
    assertImageIdentity(metadata, image);
    const runtime = inspectRuntime();
    const receipt = {
      schemaVersion: 1,
      image: lock.image,
      manifestDigest: metadata["containerimage.digest"],
      configDigest: metadata["containerimage.config.digest"],
      platform: lock.platform,
      sourceBase: lock.sourceBase,
      sourceDateEpoch: lock.sourceDateEpoch,
      defaultUser: image.Config.User,
      postgresVersion: lock.postgresVersion,
      alpineVersion: lock.alpineVersion,
      zlibVersion: lock.zlibVersion,
      libzSha256: lock.libzSha256,
      pgdataPath: lock.pgdataPath,
      runtimeVerification: runtime,
      archiveSha256,
      noCache,
      buildCommand: `docker buildx build --pull --platform ${lock.platform} --provenance=false --build-arg SOURCE_DATE_EPOCH=${lock.sourceDateEpoch} --metadata-file <temporary-directory>/build-metadata.json --output type=docker,dest=<temporary-directory>/postgres-image.tar,rewrite-timestamp=true --tag ${lock.image} --file docker/postgres/Dockerfile${noCache ? " --no-cache" : ""} .`,
      buildLog: buildOutput.replaceAll(
        temporaryDirectory,
        "<temporary-directory>",
      ),
    };
    if (receiptPath) {
      const absoluteReceipt = path.resolve(receiptPath);
      mkdirSync(path.dirname(absoluteReceipt), { recursive: true });
      writeFileSync(absoluteReceipt, `${JSON.stringify(receipt, null, 2)}\n`);
    }
    return receipt;
  } finally {
    if (existsSync(archivePath)) rmSync(archivePath);
    if (existsSync(metadataPath)) rmSync(metadataPath);
    try {
      rmSync(temporaryDirectory, { recursive: false });
    } catch {
      // Leave unexpected BuildKit files for diagnosis; no broad cleanup is attempted.
    }
  }
}

function readReceipt(receiptPath) {
  if (!receiptPath) throw new Error("--receipt is required");
  return {
    file: path.resolve(receiptPath),
    value: JSON.parse(readFileSync(receiptPath, "utf8")),
  };
}

function writeReceipt(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function verifyContainer(name, receiptPath) {
  const { file, value } = readReceipt(receiptPath);
  const deadline = Date.now() + 120_000;
  let state;
  while (Date.now() < deadline) {
    const raw = docker([
      "inspect",
      name,
      "--format",
      "{{json .}}",
    ]).stdout.trim();
    const container = JSON.parse(raw);
    state = container.State?.Health?.Status ?? container.State?.Status;
    if (
      container.Image !== lock.manifestDigest &&
      container.Image !== lock.configDigest
    ) {
      throw new Error(
        `Container image ${container.Image} matches neither the locked manifest nor config digest`,
      );
    }
    if (container.Config?.User !== lock.runtimeUser) {
      throw new Error(
        `Container runtime user ${container.Config?.User} differs from ${lock.runtimeUser}`,
      );
    }
    if (
      state === "healthy" ||
      (!container.State?.Health && state === "running")
    ) {
      const output = docker([
        "exec",
        name,
        "sh",
        "-ec",
        `test "$(id -u)" = '${lock.runtimeUid}'; test "$(postgres --version)" = 'postgres (PostgreSQL) ${lock.postgresVersion}'; apk list -I | grep -Fq 'zlib-${lock.zlibVersion} '; test "$(sha256sum /usr/lib/libz.so.1 | cut -d' ' -f1)" = '${lock.libzSha256}'; test "$(stat -c '%u:%g:%a' "$PGDATA")" = '70:70:700'; printf 'uid='; id -u; postgres --version; apk list -I | grep -F 'zlib-${lock.zlibVersion} '; sha256sum /usr/lib/libz.so.1; stat -c '%u:%g:%a %n' "$PGDATA"`,
      ]).stdout.trim();
      value.runtimeContainer = {
        name,
        state,
        containerImageId: container.Image,
        configuredUser: container.Config.User,
        verification: output,
      };
      value.runtimeIdentityPassed = true;
      writeReceipt(file, value);
      return value.runtimeContainer;
    }
    if (state === "exited" || state === "dead") {
      throw new Error(`Container ${name} entered ${state}`);
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  throw new Error(
    `Container ${name} did not become healthy within 120 seconds (last state ${state})`,
  );
}

try {
  if (command === "build") {
    const noCache = flag("--no-cache");
    const receiptPath = option("--receipt");
    if (args.length) throw new Error(`Unexpected arguments: ${args.join(" ")}`);
    const result = build({ noCache, receiptPath });
    console.log(JSON.stringify(result, null, 2));
  } else if (command === "verify-container") {
    const name = option("--name");
    const receiptPath = option("--receipt");
    if (!name || args.length)
      throw new Error(
        "Usage: verify-container --name CONTAINER --receipt PATH",
      );
    console.log(JSON.stringify(verifyContainer(name, receiptPath), null, 2));
  } else if (command === "record-ci") {
    const { file, value } = readReceipt(option("--receipt"));
    if (args.length) throw new Error(`Unexpected arguments: ${args.join(" ")}`);
    if (
      !process.env.GITHUB_ACTIONS ||
      !process.env.GITHUB_SHA ||
      !process.env.GITHUB_RUN_ID
    ) {
      throw new Error(
        "record-ci is restricted to a GitHub Actions run with exact SHA/run metadata",
      );
    }
    const validatedSha =
      process.env.POLYHUNTER_VALIDATED_SHA ?? process.env.GITHUB_SHA;
    const checkoutSha = run("git", ["rev-parse", "HEAD"]).stdout.trim();
    if (!/^[0-9a-f]{40}$/i.test(validatedSha) || checkoutSha !== validatedSha) {
      throw new Error(
        `Checkout HEAD ${checkoutSha} differs from validated PR/source SHA ${validatedSha}`,
      );
    }
    if (
      value.manifestDigest !== lock.manifestDigest ||
      value.configDigest !== lock.configDigest
    ) {
      throw new Error(
        "Receipt does not contain the locked exact PostgreSQL image identity",
      );
    }
    if (!value.runtimeIdentityPassed)
      throw new Error("Runtime image identity was not verified");
    value.ci = {
      provider: "GitHub Actions",
      workflow: process.env.GITHUB_WORKFLOW,
      job: process.env.GITHUB_JOB,
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      repository: process.env.GITHUB_REPOSITORY,
      commitSha: validatedSha,
      workflowEventSha: process.env.GITHUB_SHA,
      pullRequestHeadSha:
        process.env.GITHUB_EVENT_NAME === "pull_request" ? validatedSha : null,
      migration:
        "PASS (workflow reaches receipt step only after migration command succeeds)",
      integration:
        "PASS (workflow reaches receipt step only after integration command succeeds)",
    };
    writeReceipt(file, value);
    console.log(`Recorded exact-head CI receipt for ${process.env.GITHUB_SHA}`);
  } else if (command === "up" || command === "rebuild") {
    const noCache = command === "rebuild";
    if (args.length) throw new Error(`Unexpected arguments: ${args.join(" ")}`);
    const compose = ["compose", "--project-name", "polyhunter-local"];
    docker([
      ...compose,
      "build",
      "--pull",
      ...(noCache ? ["--no-cache"] : []),
      "web",
      "worker",
    ]);
    const imageReceipt = build({ noCache });
    console.log(
      `Verified PostgreSQL image ${imageReceipt.manifestDigest} (${imageReceipt.configDigest})`,
    );
    const environment = {
      ...process.env,
      POLYHUNTER_POSTGRES_IMAGE: lock.image,
    };
    run("docker", [...compose, "config", "--quiet"], { env: environment });
    docker(
      [
        ...compose,
        "up",
        "--detach",
        "--no-build",
        ...(noCache ? ["--force-recreate"] : []),
      ],
      { env: environment },
    );
  } else {
    throw new Error(
      "Usage: node scripts/postgres-image.mjs <build|verify-container|record-ci|up|rebuild>",
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
