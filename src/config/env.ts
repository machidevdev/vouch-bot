import * as dotenv from 'dotenv';
import path from 'path';

// Load environment-specific .env file
const environment = process.env.APP_ENV || 'local';
const envPath = path.resolve(process.cwd(), `.env.${environment}`);

// Load the environment-specific .env file if it exists
if (environment !== 'production') {
  dotenv.config({ path: envPath });
}

// Validate required environment variables
const requiredEnvVars = ['BOT_TOKEN', 'DATABASE_URL', 'ALLOWED_GROUP_ID'] as const;
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

export const config = {
  environment,
  botToken: process.env.BOT_TOKEN!,
  databaseUrl: process.env.DATABASE_URL!,
  allowedGroupId: process.env.ALLOWED_GROUP_ID!,
  isProduction: environment === 'production',
  isStaging: environment === 'staging',
  isDevelopment: environment === 'local',
} as const;

// Log the current environment (but not sensitive values)
console.log(`Environment: ${config.environment}`);
console.log(`Is Production: ${config.isProduction}`);
console.log(`Is Staging: ${config.isStaging}`);
console.log(`Is Development: ${config.isDevelopment}`); 