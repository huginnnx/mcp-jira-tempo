import dotenv from 'dotenv';
import path from 'path';
import { Logger } from './logger.util.js';
import fs from 'fs';
import os from 'os';

// Create a contextualized logger for this file
const configLogger = Logger.forContext('utils/config.util.ts');

// Log config utility initialization
configLogger.debug('Config utility initialized');

/**
 * Configuration loader that handles multiple sources with priority:
 * 1. Direct ENV pass (process.env)
 * 2. .env file in project root
 * 3. Global config file at $HOME/.mcp/configs.json
 */
class ConfigLoader {
	private packageName: string;
	private configLoaded: boolean = false;

	/**
	 * Create a new ConfigLoader instance
	 * @param packageName The package name to use for global config lookup
	 */
	constructor(packageName: string) {
		this.packageName = packageName;
	}

	/**
	 * Load configuration from all sources with proper priority
	 */
	load(): void {
		if (this.configLoaded) {
			configLogger.debug(
				'[src/utils/config.util.ts@load] Configuration already loaded, skipping',
			);
			return;
		}

		configLogger.debug(
			'[src/utils/config.util.ts@load] Loading configuration...',
		);

		// Priority 3: Load from global config file
		this.loadFromGlobalConfig();

		// Priority 2: Load from .env file
		this.loadFromEnvFile();

		// Priority 1: Direct ENV pass is already in process.env
		// No need to do anything as it already has highest priority

		this.configLoaded = true;
		configLogger.debug(
			'[src/utils/config.util.ts@load] Configuration loaded successfully',
		);
	}

	/**
	 * Load configuration from .env file in project root
	 */
	private loadFromEnvFile(): void {
		const methodLogger = Logger.forContext(
			'utils/config.util.ts',
			'loadFromEnvFile',
		);

		try {
			// Use quiet mode to prevent dotenv from outputting to STDIO
			// which interferes with MCP's JSON-RPC communication
			const result = dotenv.config({ quiet: true });
			if (result.error) {
				methodLogger.debug(
					'[src/utils/config.util.ts@loadFromEnvFile] No .env file found or error reading it',
				);
				return;
			}
			methodLogger.debug(
				'[src/utils/config.util.ts@loadFromEnvFile] Loaded configuration from .env file',
			);
		} catch (error) {
			methodLogger.error(
				'[src/utils/config.util.ts@loadFromEnvFile] Error loading .env file',
				error,
			);
		}
	}

	/**
	 * Merge `environments` from the first matching top-level key into process.env
	 * (only when the variable is not already set).
	 */
	private applyGlobalEnvSection(
		root: Record<string, unknown>,
		potentialKeys: string[],
		label: string,
	): void {
		const methodLogger = Logger.forContext(
			'utils/config.util.ts',
			'applyGlobalEnvSection',
		);

		for (const key of potentialKeys) {
			const section = root[key];
			if (
				section &&
				typeof section === 'object' &&
				'environments' in section &&
				(section as { environments?: Record<string, unknown> })
					.environments &&
				typeof (section as { environments: Record<string, unknown> })
					.environments === 'object'
			) {
				const environments = (
					section as { environments: Record<string, unknown> }
				).environments;
				for (const [envKey, value] of Object.entries(environments)) {
					if (process.env[envKey] === undefined) {
						process.env[envKey] = String(value);
					}
				}
				methodLogger.debug(
					`[src/utils/config.util.ts@applyGlobalEnvSection] Loaded ${label} global config using key: ${key}`,
				);
				return;
			}
		}

		methodLogger.debug(
			`[src/utils/config.util.ts@applyGlobalEnvSection] No ${label} configuration for keys: ${potentialKeys.join(', ')}`,
		);
	}

	/**
	 * Load configuration from global config file at $HOME/.mcp/configs.json
	 */
	private loadFromGlobalConfig(): void {
		const methodLogger = Logger.forContext(
			'utils/config.util.ts',
			'loadFromGlobalConfig',
		);

		try {
			const homedir = os.homedir();
			const globalConfigPath = path.join(homedir, '.mcp', 'configs.json');

			if (!fs.existsSync(globalConfigPath)) {
				methodLogger.debug(
					'[src/utils/config.util.ts@loadFromGlobalConfig] Global config file not found',
				);
				return;
			}

			const configContent = fs.readFileSync(globalConfigPath, 'utf8');
			const root = JSON.parse(configContent) as Record<string, unknown>;

			const shortKey = 'jira';
			const atlassianProductKey = 'atlassian-jira';
			const fullPackageName = this.packageName;
			const unscopedPackageName =
				fullPackageName.split('/')[1] || fullPackageName;

			const jiraKeys = [
				shortKey,
				atlassianProductKey,
				fullPackageName,
				unscopedPackageName,
			];
			this.applyGlobalEnvSection(root, jiraKeys, 'Jira');

			const tempoKeys = ['tempo', 'tempo-cloud'];
			this.applyGlobalEnvSection(root, tempoKeys, 'Tempo');
		} catch (error) {
			methodLogger.error(
				'[src/utils/config.util.ts@loadFromGlobalConfig] Error loading global config file',
				error,
			);
		}
	}

	/**
	 * Get a configuration value
	 * @param key The configuration key
	 * @param defaultValue The default value if the key is not found
	 * @returns The configuration value or the default value
	 */
	get(key: string, defaultValue?: string): string | undefined {
		return process.env[key] || defaultValue;
	}

	/**
	 * Get a boolean configuration value
	 * @param key The configuration key
	 * @param defaultValue The default value if the key is not found
	 * @returns The boolean configuration value or the default value
	 */
	getBoolean(key: string, defaultValue: boolean = false): boolean {
		const value = this.get(key);
		if (value === undefined) {
			return defaultValue;
		}
		return value.toLowerCase() === 'true';
	}
}

// Create and export a singleton instance with the package name from package.json
export const config = new ConfigLoader('@aashari/mcp-server-atlassian-jira');
