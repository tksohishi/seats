import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CliError } from "./errors";

type SeatsConfig = {
  apiKey: string;
};

export function getConfigPath(env: Record<string, string | undefined> = process.env): string {
  const home = env.HOME;
  if (!home) {
    throw new CliError("HOME environment variable is not set.", 2);
  }
  return join(home, ".config", "seats", "config.json");
}

export async function readConfig(
  configPath: string = getConfigPath(),
  env: Record<string, string | undefined> = process.env
): Promise<SeatsConfig | null> {
  const envKey = env.SEATS_AERO_API_KEY?.trim();
  if (envKey) {
    return { apiKey: envKey };
  }

  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<SeatsConfig>;
    if (typeof parsed.apiKey === "string" && parsed.apiKey.trim().length > 0) {
      return { apiKey: parsed.apiKey.trim() };
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeConfig(apiKey: string, configPath: string = getConfigPath()): Promise<void> {
  const dir = dirname(configPath);
  await mkdir(dir, { recursive: true });
  const content = JSON.stringify({ apiKey }, null, 2);
  await writeFile(configPath, `${content}\n`, { mode: 0o600 });
}
