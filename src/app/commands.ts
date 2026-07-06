import type { CommandSpec } from "./contracts";

const registry = new Map<string, CommandSpec>();

export function registerCommand(cmd: CommandSpec): void {
  registry.set(cmd.id, cmd);
}

export function allCommands(): CommandSpec[] {
  return [...registry.values()].filter((c) => (c.visible ? c.visible() : true));
}

export function runCommand(id: string): boolean {
  const cmd = registry.get(id);
  if (!cmd || (cmd.visible && !cmd.visible())) return false;
  cmd.run();
  return true;
}
