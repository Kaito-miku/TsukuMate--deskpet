const assert = require("node:assert");
const { describe, it } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const APP_ROOT = path.join(__dirname, "..", "..");
const REPO_ROOT = path.join(APP_ROOT, "..");
const pkg = require("../../package.json");

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("license and derivative-work attribution", () => {
  it("declares AGPL-3.0-only in metadata and license files", () => {
    assert.strictEqual(pkg.license, "AGPL-3.0-only");
    assert.match(readRepoFile("LICENSE"), /GNU AFFERO GENERAL PUBLIC LICENSE/);
    assert.match(readRepoFile("tsukumate/LICENSE"), /GNU AFFERO GENERAL PUBLIC LICENSE/);
  });

  it("publishes the maintained source and preserves upstream attribution", () => {
    const notice = readRepoFile("NOTICE.md");
    const readme = readRepoFile("README.md");
    for (const content of [notice, readme]) {
      assert.match(content, /Kaito-miku\/TsukuMate--deskpet/);
      assert.match(content, /OpenBMB\/MiniCPM-Desk-Pet/);
      assert.match(content, /rullerzhou-afk\/clawd-on-desk/);
    }
  });

  it("points product metadata at the maintained source repository", () => {
    assert.strictEqual(
      pkg.repository.url,
      "https://github.com/Kaito-miku/TsukuMate--deskpet.git"
    );
    assert.strictEqual(
      pkg.homepage,
      "https://github.com/Kaito-miku/TsukuMate--deskpet"
    );
  });
});
