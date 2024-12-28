import type {
    ChatInputCommandInteraction,
    Client,
    SlashCommandBuilder,
  } from "discord.js";
  
  export interface PluginConfig {
    name: string;
    description: string;
    version: string;
    config: Record<string, unknown>;
  }
  
  export interface Command {
    data: SlashCommandBuilder;
    action: (
      client: Client,
      interaction: ChatInputCommandInteraction,
      config: Record<string, unknown>,
    ) => Promise<void>;
  }
  
  export interface Event {
    event: string;
    once?: boolean;
    action: (
      client: Client,
      config: Record<string, unknown>,
      ...args: unknown[]
    ) => Promise<void>;
  }
  
  export interface Plugin {
    config: PluginConfig;
    commands: Command[];
    events: Event[];
  }