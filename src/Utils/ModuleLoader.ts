import { readdir } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

export class ModuleLoader {
  static async loadModule<T>(path: string): Promise<T | null> {
    try {
      // Resolve the absolute path
      const absolutePath = resolve(path);
      
      // Convert the path to a file URL
      const moduleUrl = `file://${absolutePath}`;
      
      // Handle Windows paths by ensuring proper URL formatting
      const formattedUrl = process.platform === 'win32'
        ? moduleUrl.replace(/\\/g, '/') 
        : moduleUrl;
      
      // Import the module
      const module = await import(formattedUrl);
      return module.default as T;
    } catch (error) {
      console.error(`Failed to load module at ${path}`, error);
      return null;
    }
  }

  static async loadModulesFromDirectory<T>(
    directory: string,
    validator: (module: unknown) => boolean,
  ): Promise<T[]> {
    const modules: T[] = [];
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.ts')) {
          const modulePath = join(directory, entry.name);
          const module = await this.loadModule<T>(modulePath);
          
          if (module && validator(module)) {
            modules.push(module);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to load modules from ${directory}`, error);
    }
    return modules;
  }
}