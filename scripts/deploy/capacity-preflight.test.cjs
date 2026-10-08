"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const wrapper = path.join(__dirname, "deploy-pixeltec-mx-wrapper.sh");

function run(t, { available = "25000000", used = "80%", dockerAvailable = available, broken = false, malformed = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wo547-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, ".git"));
  const bin = path.join(dir, "bin"); fs.mkdirSync(bin);
  const script = (name, body) => fs.writeFileSync(path.join(bin, name), "#!/bin/sh\n" + body, { mode: 0o755 });
  script("flock", "exit 0\n"); // lock itself has an existing integration suite.
  script("df", broken ? "exit 1\n" : malformed ? "echo unreadable\n" : `echo 'Filesystem 1024-blocks Used Available Capacity Mounted on'\ncase "$*" in *'/var/lib/docker'*) free=${dockerAvailable};; *) free=${available};; esac\necho "disk 100000000 80000000 $free ${used} /"\n`);
  script("git", `touch '${dir}/git-reached'\nexit 1\n`);
  script("docker", `touch '${dir}/docker-reached'\nexit 1\n`);
  const result = spawnSync("bash", [wrapper, "--sha", "a".repeat(40), "--check-only"], { encoding: "utf8", env: { ...process.env, PATH: bin + ":" + process.env.PATH, DEPLOY_EXPECTED_USER: os.userInfo().username, DEPLOY_APP_DIR: dir, DEPLOY_LOCK_FILE: path.join(dir, "lock") } });
  assert.notEqual(result.status, 0); // even valid capacity stops at the fake git.
  assert.equal(fs.existsSync(path.join(dir, "docker-reached")), false);
  return { result, reachedGit: fs.existsSync(path.join(dir, "git-reached")) };
}

for (const [name, options] of Object.entries({ red: { used: "89%" }, lowFree: { available: "20971519" }, dockerLow: { dockerAvailable: "1000" }, failedMeasurement: { broken: true }, malformed: { malformed: true } })) {
  test(`WO547: ${name} stops before git/build/activation`, (t) => {
    const { result, reachedGit } = run(t, options);
    assert.equal(reachedGit, false);
    assert.match(result.stderr, /capacidad/);
  });
}
test("WO547: exact safe boundary reaches normal SHA validation", (t) => {
  assert.equal(run(t, { used: "85%", available: "20971520" }).reachedGit, true);
});
