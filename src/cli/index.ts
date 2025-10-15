#!/usr/bin/env node

import { Command } from "commander";
import { DataSource } from "typeorm";
import { ApiKey, TrafficLog, AccessEvent } from "../entities";
import { ApiKeyService } from "../services/api-key.service";

const program = new Command();

program
  .name("sentinel")
  .description("NestJS Sentinel CLI for API key and database management")
  .version("1.1.0");

// Initialize database command
program
  .command("init-db")
  .description("Initialize database tables")
  .option("-u, --url <url>", "Database URL", "sqlite://./sentinel.db")
  .action(async (options) => {
    try {
      console.log("Initializing database...");

      const dataSource = new DataSource({
        type: options.url.startsWith("mysql") ? "mysql" : "sqlite",
        url: options.url.startsWith("sqlite") ? undefined : options.url,
        database: options.url.startsWith("sqlite")
          ? options.url.replace("sqlite://", "")
          : undefined,
        entities: [ApiKey, TrafficLog, AccessEvent],
        synchronize: true,
        logging: false,
      });

      await dataSource.initialize();
      console.log("✅ Database initialized successfully!");
      await dataSource.destroy();
    } catch (error) {
      console.error("❌ Failed to initialize database:", error);
      process.exit(1);
    }
  });

// Create API key command
program
  .command("create-key")
  .description("Create a new API key")
  .requiredOption("--owner-type <type>", "Owner type (user|service)")
  .requiredOption("--owner-id <id>", "Owner ID")
  .option("--scopes <scopes>", "Comma-separated scopes", "")
  .option("--name <name>", "API key name")
  .option("--expires <date>", "Expiration date (ISO string)")
  .option("-u, --url <url>", "Database URL", "sqlite://./sentinel.db")
  .action(async (options) => {
    try {
      console.log("Creating API key...");

      const dataSource = new DataSource({
        type: options.url.startsWith("mysql") ? "mysql" : "sqlite",
        url: options.url.startsWith("sqlite") ? undefined : options.url,
        database: options.url.startsWith("sqlite")
          ? options.url.replace("sqlite://", "")
          : undefined,
        entities: [ApiKey, TrafficLog, AccessEvent],
        synchronize: false,
        logging: false,
      });

      await dataSource.initialize();

      const apiKeyRepository = dataSource.getRepository(ApiKey);
      const apiKeyService = new ApiKeyService(apiKeyRepository);

      const scopes = options.scopes
        ? options.scopes.split(",").map((s: string) => s.trim())
        : [];
      const expiresAt = options.expires ? new Date(options.expires) : undefined;

      const result = await apiKeyService.createKey(
        options.ownerType,
        options.ownerId,
        scopes,
        options.name,
        expiresAt
      );

      console.log("✅ API key created successfully!");
      console.log("📋 Details:");
      console.log(`   ID: ${result.apiKey.id}`);
      console.log(`   Name: ${result.apiKey.name}`);
      console.log(
        `   Owner: ${result.apiKey.ownerType}:${result.apiKey.ownerId}`
      );
      console.log(`   Scopes: [${result.apiKey.scopes.join(", ")}]`);
      console.log(`   Expires: ${result.apiKey.expiresAt || "Never"}`);
      console.log(`🔑 API Key: ${result.rawKey}`);
      console.log("⚠️  Save this key securely - it cannot be recovered!");

      await dataSource.destroy();
    } catch (error) {
      console.error("❌ Failed to create API key:", error);
      process.exit(1);
    }
  });

// List API keys command
program
  .command("list-keys")
  .description("List API keys")
  .option("--owner-type <type>", "Filter by owner type")
  .option("--owner-id <id>", "Filter by owner ID")
  .option("-u, --url <url>", "Database URL", "sqlite://./sentinel.db")
  .action(async (options) => {
    try {
      const dataSource = new DataSource({
        type: options.url.startsWith("mysql") ? "mysql" : "sqlite",
        url: options.url.startsWith("sqlite") ? undefined : options.url,
        database: options.url.startsWith("sqlite")
          ? options.url.replace("sqlite://", "")
          : undefined,
        entities: [ApiKey, TrafficLog, AccessEvent],
        synchronize: false,
        logging: false,
      });

      await dataSource.initialize();

      const apiKeyRepository = dataSource.getRepository(ApiKey);
      let apiKeys: ApiKey[];

      if (options.ownerType && options.ownerId) {
        apiKeys = await apiKeyRepository.find({
          where: { ownerType: options.ownerType, ownerId: options.ownerId },
          order: { createdAt: "DESC" },
        });
      } else {
        apiKeys = await apiKeyRepository.find({
          order: { createdAt: "DESC" },
        });
      }

      console.log(`📋 Found ${apiKeys.length} API keys:`);
      console.log("");

      apiKeys.forEach((key) => {
        console.log(`🔑 ${key.name}`);
        console.log(`   ID: ${key.id}`);
        console.log(`   Owner: ${key.ownerType}:${key.ownerId}`);
        console.log(`   Scopes: [${key.scopes.join(", ")}]`);
        console.log(`   Active: ${key.isActive ? "✅" : "❌"}`);
        console.log(`   Created: ${key.createdAt.toISOString()}`);
        console.log(
          `   Last Used: ${key.lastUsedAt?.toISOString() || "Never"}`
        );
        console.log(`   Expires: ${key.expiresAt?.toISOString() || "Never"}`);
        console.log("");
      });

      await dataSource.destroy();
    } catch (error) {
      console.error("❌ Failed to list API keys:", error);
      process.exit(1);
    }
  });

// Revoke API key command
program
  .command("revoke-key")
  .description("Revoke an API key")
  .requiredOption("--id <id>", "API key ID")
  .option("-u, --url <url>", "Database URL", "sqlite://./sentinel.db")
  .action(async (options) => {
    try {
      const dataSource = new DataSource({
        type: options.url.startsWith("mysql") ? "mysql" : "sqlite",
        url: options.url.startsWith("sqlite") ? undefined : options.url,
        database: options.url.startsWith("sqlite")
          ? options.url.replace("sqlite://", "")
          : undefined,
        entities: [ApiKey, TrafficLog, AccessEvent],
        synchronize: false,
        logging: false,
      });

      await dataSource.initialize();

      const apiKeyRepository = dataSource.getRepository(ApiKey);
      const apiKeyService = new ApiKeyService(apiKeyRepository);

      const success = await apiKeyService.invalidateKey(options.id);

      if (success) {
        console.log("✅ API key revoked successfully!");
      } else {
        console.log("❌ API key not found or already revoked");
      }

      await dataSource.destroy();
    } catch (error) {
      console.error("❌ Failed to revoke API key:", error);
      process.exit(1);
    }
  });

// Traffic stats command
program
  .command("stats")
  .description("Show traffic statistics")
  .option("--since <date>", "Show stats since date (ISO string)")
  .option("-u, --url <url>", "Database URL", "sqlite://./sentinel.db")
  .action(async (options) => {
    try {
      const dataSource = new DataSource({
        type: options.url.startsWith("mysql") ? "mysql" : "sqlite",
        url: options.url.startsWith("sqlite") ? undefined : options.url,
        database: options.url.startsWith("sqlite")
          ? options.url.replace("sqlite://", "")
          : undefined,
        entities: [ApiKey, TrafficLog, AccessEvent],
        synchronize: false,
        logging: false,
      });

      await dataSource.initialize();

      const trafficLogRepository = dataSource.getRepository(TrafficLog);
      const accessEventRepository = dataSource.getRepository(AccessEvent);

      const since = options.since ? new Date(options.since) : undefined;

      // Get traffic logs
      const trafficQuery = trafficLogRepository.createQueryBuilder("log");
      if (since) {
        trafficQuery.where("log.timestamp >= :since", { since });
      }
      const logs = await trafficQuery.getMany();

      // Get access events
      const accessQuery = accessEventRepository.createQueryBuilder("event");
      if (since) {
        accessQuery.where("event.timestamp >= :since", { since });
      }
      const events = await accessQuery.getMany();

      console.log("📊 Traffic Statistics");
      console.log("====================");
      console.log(
        `Period: ${since ? `Since ${since.toISOString()}` : "All time"}`
      );
      console.log("");
      console.log(`🔢 Total Requests: ${logs.length}`);
      console.log(`🌐 Unique IPs: ${new Set(logs.map((l) => l.ip)).size}`);
      console.log(
        `⏱️  Average Response Time: ${logs.length ? Math.round((logs.reduce((sum, l) => sum + l.durationMs, 0) / logs.length) * 100) / 100 : 0}ms`
      );
      console.log("");

      // Status code distribution
      const statusCodes: Record<number, number> = {};
      logs.forEach((log) => {
        statusCodes[log.statusCode] = (statusCodes[log.statusCode] || 0) + 1;
      });

      console.log("📈 Status Code Distribution:");
      Object.entries(statusCodes).forEach(([code, count]) => {
        console.log(`   ${code}: ${count}`);
      });
      console.log("");

      // Access events
      const allowedEvents = events.filter((e) => e.decision === "allow").length;
      const deniedEvents = events.filter((e) => e.decision === "deny").length;

      console.log("🔐 Access Events:");
      console.log(`   Allowed: ${allowedEvents}`);
      console.log(`   Denied: ${deniedEvents}`);

      await dataSource.destroy();
    } catch (error) {
      console.error("❌ Failed to get stats:", error);
      process.exit(1);
    }
  });

program.parse();
