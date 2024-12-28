import {
    Client,
    Collection,
    IntentsBitField,
    Interaction,
    REST,
    Routes,
  } from "discord.js";
  import { PluginLoader } from "./Utils/PluginLoader";
  import { Command, Plugin } from "./Types/Plugin";
  
  export class Bot {
    private readonly client: Client;
    private readonly token: string;
    private plugins: Plugin[] = [];
    private readonly commands: Collection<string, Command> = new Collection();
    private pluginsDir: string;
    private server?: string;
  
    constructor({
      token,
      intents,
      pluginsDir = `${process.cwd()}/plugins`,
      server,
    }: {
      token: string;
      intents?: IntentsBitField[];
      pluginsDir?: string;
      server?: string;
    }) {
      this.token = token;
      this.pluginsDir = pluginsDir;
      if (server) {
        this.server = server;
      }
  
      const defaultIntents = [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildMembers,
      ];
  
      this.client = new Client({
        intents: intents || defaultIntents,
      });
  
      this.client.once("ready", () => {
        if (this.client.user) {
          console.log(`${this.client.user.username} is online!`);
        }
      });
    }
  
    async start() {
      await this.loadPlugins();
      this.registerEventHandlers();
  
      this.client.once("ready", async () => {
        await this.registerCommands();
      });
  
      await this.client.login(this.token);
      (this.client as any).token = undefined;
    }
  
    private async loadPlugins() {
      const pluginLoader = new PluginLoader(this.pluginsDir);
      this.plugins = await pluginLoader.LoadPlugins();
  
      for (const plugin of this.plugins) {
        for (const command of plugin.commands) {
          this.commands.set(command.data.name, command);
        }
      }
      console.info(
        `Loaded ${this.plugins.length} plugins with ${this.commands.size} commands`,
      );
    }
  
    private async registerCommands() {
      if (!this.client.user) {
        console.error(
          "Client user is not available. Commands registration aborted.",
        );
        return;
      }
  
      const rest = new REST({ version: "10" }).setToken(this.token);
      const commands = this.plugins.flatMap((plugin) =>
        plugin.commands.map((cmd) => cmd.data.toJSON())
      );
  
      try {
        if (this.server) {
          await rest.put(
            Routes.applicationGuildCommands(this.client.user.id, this.server),
            {
              body: commands,
            },
          );
        } else {
          await rest.put(Routes.applicationCommands(this.client.user.id), {
            body: commands,
          });
        }
  
        console.info("Successfully registered application commands");
      } catch (error) {
        console.error("Failed to register application commands", error);
      }
    }
  
    private registerEventHandlers() {
      this.client.on("interactionCreate", async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
  
        const command = this.commands.get(interaction.commandName);
        if (!command) {
          console.warn(`Command ${interaction.commandName} not found.`);
          return;
        }
  
        try {
          const plugin = this.plugins.find((p) =>
            p.commands.some((cmd) => cmd.data.name === interaction.commandName)
          );
          if (!plugin) return;
  
          await command.action(this.client, interaction, plugin.config.config);
        } catch (error) {
          console.error(
            `Error executing command ${interaction.commandName}`,
            error,
          );
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: "There was an error executing this command!",
              ephemeral: true,
            });
          } else {
            await interaction.reply({
              content: "There was an error executing this command!",
              ephemeral: true,
            });
          }
        }
      });
  
      for (const plugin of this.plugins) {
        for (const event of plugin.events) {
          const handler = (...args: unknown[]) =>
            event.action(this.client, plugin.config.config, ...args);
          if (event.once) {
            this.client.once(event.event, handler);
          } else {
            this.client.on(event.event, handler);
          }
        }
      }
    }
  }