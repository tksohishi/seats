import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readConfig } from "../src/core/config";

describe("readConfig", () => {
  test("env key takes precedence", async () => {
    const dir = join(process.cwd(), "tmp", "test-env");
    await mkdir(dir, { recursive: true });
    const configPath = join(dir, "config.json");
    await writeFile(configPath, JSON.stringify({ apiKey: "file-key" }), "utf8");
    const config = await readConfig(configPath, { SEATS_AERO_API_KEY: "env-key" });
    expect(config?.apiKey).toBe("env-key");
  });

  test("reads file key", async () => {
    const dir = join(process.cwd(), "tmp", "test-file");
    await mkdir(dir, { recursive: true });
    const configPath = join(dir, "config.json");
    await writeFile(configPath, JSON.stringify({ apiKey: "file-key" }), "utf8");
    const config = await readConfig(configPath, {});
    expect(config?.apiKey).toBe("file-key");
  });
});
