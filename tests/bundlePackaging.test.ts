import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

function parsePackMetadata(output: string) {
  const jsonMatch = output.match(/(?:^|\n)\[\s*\{/);
  if (!jsonMatch || jsonMatch.index === undefined) {
    throw new Error(`npm pack did not return JSON:\n${output}`);
  }
  const jsonStart = jsonMatch.index + (output[jsonMatch.index] === "\n" ? 1 : 0);
  return JSON.parse(output.slice(jsonStart)) as Array<{
    filename?: string;
    files?: Array<{ path: string }>;
  }>;
}

describe("DeepSeek Harness bundle packaging", () => {
  it("owns the sidebar replacement in the bundle layer", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(root, "package.json"), "utf8"),
    ) as {
      name?: string;
      files?: string[];
      scripts?: Record<string, string>;
      engines?: { node?: string };
      dsh?: {
        bundle?: { patch?: string };
        client?: { inject?: string[] };
      };
      peerDependencies?: Record<string, string>;
    };
    const patch = readFileSync(resolve(root, "cordis.patch.yml"), "utf8");
    const copyInplace = readFileSync(
      resolve(root, "scripts/copy-inplace.mjs"),
      "utf8",
    );

    expect(manifest.name).toBe("dsh-dingze");
    expect(manifest.dsh?.bundle?.patch).toBe("./cordis.patch.yml");
    expect(manifest.files).toContain("cordis.patch.yml");
    expect(manifest.files).toContain("README.md");
    expect(manifest.files).toContain("LICENSE");
    expect(manifest.files).toContain("docs/*.md");
    expect(manifest.files).not.toContain("lib/collect-publish.mjs");
    expect(manifest.scripts?.prepare).toBe("npm run build");
    expect(manifest.scripts?.["release:check"]).toBe(
      "node scripts/check-release.mjs",
    );
    expect(manifest.engines?.node).toBe(">=22.19.0");
    expect(manifest.dsh?.client?.inject).toEqual(expect.arrayContaining([
      "@deepseek-ai/dsh-client-ui-settings",
      "@deepseek-ai/dsh-client-ui-settings-plugins",
    ]));
    expect(manifest.peerDependencies?.["@deepseek-ai/dsh-settings"])
      .toContain("0.1.0-rc.7");
    expect(patch).toMatch(/^- id: ui-sidebar\n  disabled: true$/m);
    expect(patch).toMatch(/^- insert:\n    - id: dsh-dingze\n      name: dsh-dingze$/m);
    expect(copyInplace).not.toContain(".dsh/profiles");
    expect(copyInplace).toContain("libDirectory");
  });

  it("keeps runtime files in the real npm tarball", () => {
    const packDirectory = mkdtempSync(join(tmpdir(), "dsh-dingze-pack-"));
    const runtimeFiles = [
      "lib/index.js",
      "lib/client.js",
      "lib/typert.host.js",
    ];

    try {
      for (const runtimeFile of runtimeFiles) {
        expect(existsSync(resolve(root, runtimeFile))).toBe(true);
      }

      const output = execFileSync(
        "npm",
        [
          "pack",
          "--ignore-scripts",
          "--json",
          "--pack-destination",
          packDirectory,
        ],
        { cwd: root, encoding: "utf8" },
      );
      const metadata = parsePackMetadata(output);
      const filename = metadata[0]?.filename;
      expect(filename).toBeTruthy();

      const tarball = resolve(packDirectory, filename!);
      expect(existsSync(tarball)).toBe(true);

      const entries = execFileSync("tar", ["-tzf", tarball], {
        encoding: "utf8",
      })
        .trim()
        .split("\n")
        .map((entry) => entry.replace(/^package\//, ""));
      const packedFiles = new Set(entries);

      expect([...packedFiles]).toEqual(expect.arrayContaining([
        "README.md",
        "LICENSE",
        "cordis.patch.yml",
        "lib/index.js",
        "lib/client.js",
        "lib/typert.host.js",
      ]));
      expect([...packedFiles].some((entry) => entry.includes("collect-publish"))).toBe(false);
    } finally {
      rmSync(packDirectory, { recursive: true, force: true });
    }
  });
});
