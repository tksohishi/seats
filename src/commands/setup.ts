import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getConfigPath, writeConfig } from "../core/config";
import { CliError } from "../core/errors";

class MaskedOutput extends Writable {
  _write(_chunk: unknown, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    callback();
  }
}

async function promptHidden(promptText: string): Promise<string> {
  if (!input.isTTY) {
    throw new CliError("Interactive setup requires a TTY.", 2);
  }

  output.write(promptText);
  const rl = createInterface({
    input,
    output: new MaskedOutput(),
    terminal: true
  });

  try {
    const value = await rl.question("");
    output.write("\n");
    return value.trim();
  } finally {
    rl.close();
  }
}

export async function runSetup(): Promise<void> {
  const apiKey = await promptHidden("Enter seats.aero API key: ");
  if (!apiKey) {
    throw new CliError("API key cannot be empty.", 2);
  }
  const configPath = getConfigPath();
  await writeConfig(apiKey, configPath);
  console.log(`Saved API key to ${configPath}`);
}
