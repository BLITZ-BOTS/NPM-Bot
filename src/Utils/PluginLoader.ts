import type { Command, Event, Plugin, PluginConfig } from "../Types/Plugin";
import { parse } from "yaml";
import { Validators } from "../Validators/Validators";
import { ModuleLoader } from "./ModuleLoader";
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";

export class PluginLoader {
  private PluginsDir: string;

  /**
   * Constructs the PluginLoader with an optional directory path.
   * @param pluginsDir - The directory path where plugins are stored. Defaults to './plugins' if not provided.
   */
  constructor(pluginsDir?: string) {
    this.PluginsDir = pluginsDir
      ? pluginsDir
      : join(process.cwd(), 'plugins');
  }

  /**
   * Loads all plugins from the configured directory.
   * @returns A list of loaded plugins.
   */
  async LoadPlugins(): Promise<Plugin[]> {
    const Plugins: Plugin[] = [];

    try {
      const dirEntries = await readdir(this.PluginsDir, { withFileTypes: true });
      for (const dirEntry of dirEntries) {
        if (dirEntry.isDirectory()) {
          const Plugin = await this.LoadPluginFiles(dirEntry.name);
          if (Plugin) {
            Plugins.push(Plugin);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load plugins directory", error);
    }
    return Plugins;
  }

  /**
   * Loads the files for a specific plugin, including config, commands, and events.
   * @param PluginName - The name of the plugin to load.
   * @returns A loaded plugin or null if loading failed.
   */
  private async LoadPluginFiles(PluginName: string): Promise<Plugin | null> {
    try {
      const PluginPath = join(this.PluginsDir, PluginName);

      // Load the configuration, falling back to defaults for name and version
      const PluginConfigRaw = await this.LoadPluginConfig(PluginPath);
      const PluginConfig: PluginConfig = {
        name: PluginConfigRaw?.name ?? PluginName, // Use the folder name if missing
        version: PluginConfigRaw?.version ?? "unknown", // Default version
        description: PluginConfigRaw?.description ?? "No description provided",
        config: PluginConfigRaw?.config ?? {}, // Default empty object
      };

      if (!PluginConfig.name || !PluginConfig.version) {
        console.error(
          `Plugin ${PluginName} is missing mandatory fields: 'name' and/or 'version'. Skipping.`,
        );
        return null;
      }

      const PluginCommands = await this.LoadPluginCommands(PluginPath);
      const PluginEvents = await this.LoadPluginEvents(PluginPath);

      console.info(
        `Successfully loaded plugin: ${PluginConfig.name} v${PluginConfig.version}`,
      );

      return {
        config: PluginConfig,
        commands: PluginCommands,
        events: PluginEvents,
      };
    } catch (error) {
      console.error(
        `Failed to load plugin ${PluginName}`,
        error,
      );
      return null;
    }
  }

  /**
   * Loads and parses the plugin's configuration file (`blitz.config.yaml`).
   * @param PluginPath - The path to the plugin directory.
   * @returns A parsed configuration object or null if the configuration is invalid or missing.
   */
  private async LoadPluginConfig(
    PluginPath: string,
  ): Promise<Partial<PluginConfig> | null> {
    try {
      const PluginConfigPath = join(PluginPath, 'blitz.config.yaml');
      const PluginConfigRAW = await readFile(PluginConfigPath, 'utf-8');
      const PluginConfig = parse(PluginConfigRAW);

      if (!Validators.isPluginConfig(PluginConfig)) {
        console.warn(
          "Invalid plugin configuration format; skipping validation.",
        );
        return null;
      }

      return PluginConfig;
    } catch (error) {
      console.warn(
        "No valid configuration file found; proceeding without config.",
        error,
      );
      return null;
    }
  }

  /**
   * Loads all commands for the plugin from the 'commands' directory.
   * @param PluginPath - The path to the plugin directory.
   * @returns A list of command modules or an empty array if no commands exist.
   */
  private async LoadPluginCommands(PluginPath: string): Promise<Command[]> {
    const PluginCommandPath = join(PluginPath, 'commands');

    try {
      const stats = await stat(PluginCommandPath);
      if (!stats.isDirectory()) {
        return [];
      }
      return await ModuleLoader.loadModulesFromDirectory<Command>(
        PluginCommandPath,
        Validators.isCommand,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Silently return an empty array if the directory does not exist
        return [];
      }
      console.error(
        `Failed to load commands from: ${PluginCommandPath}`,
        error,
      );
      return [];
    }
  }

  /**
   * Loads all events for the plugin from the 'events' directory.
   * @param PluginPath - The path to the plugin directory.
   * @returns A list of event modules or an empty array if no events exist.
   */
  private async LoadPluginEvents(PluginPath: string): Promise<Event[]> {
    const PluginEventPath = join(PluginPath, 'events');

    try {
      const stats = await stat(PluginEventPath);
      if (!stats.isDirectory()) {
        return [];
      }
      return await ModuleLoader.loadModulesFromDirectory<Event>(
        PluginEventPath,
        Validators.isEvent,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Silently return an empty array if the directory does not exist
        return [];
      }
      console.error(`Failed to load events from: ${PluginEventPath}`, error);
      return [];
    }
  }
}