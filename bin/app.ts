#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/stacks/network-stack';
import { ComputeStack } from '../lib/stacks/compute-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { ServerlessStack } from '../lib/stacks/serverless-stack';
import { environments } from '../lib/config/environments';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const envName = app.node.tryGetContext('env') || 'dev';
const envConfig = environments[envName as keyof typeof environments];

if (!envConfig) {
  throw new Error(`Unknown environment: ${envName}`);
}

const env: cdk.Environment = {
  account: envConfig.account || process.env.CDK_DEFAULT_ACCOUNT,
  region: envConfig.region || process.env.CDK_DEFAULT_REGION,
};

// Network Stack
const networkStack = new NetworkStack(app, `${envName}-NetworkStack`, {
  env,
  config: envConfig.vpc,
  tags: {
    Environment: envName,
    Project: 'aws-cdk-patterns',
  },
});

// Database Stack
const databaseStack = new DatabaseStack(app, `${envName}-DatabaseStack`, {
  env,
  vpc: networkStack.vpc,
  config: envConfig.database,
  tags: {
    Environment: envName,
    Project: 'aws-cdk-patterns',
  },
});

// Compute Stack
const computeStack = new ComputeStack(app, `${envName}-ComputeStack`, {
  env,
  vpc: networkStack.vpc,
  database: databaseStack.database,
  config: envConfig.ecs,
  tags: {
    Environment: envName,
    Project: 'aws-cdk-patterns',
  },
});

// Serverless Stack
const serverlessStack = new ServerlessStack(app, `${envName}-ServerlessStack`, {
  env,
  vpc: networkStack.vpc,
  config: envConfig.serverless,
  tags: {
    Environment: envName,
    Project: 'aws-cdk-patterns',
  },
});

// Add dependencies
databaseStack.addDependency(networkStack);
computeStack.addDependency(databaseStack);
serverlessStack.addDependency(networkStack);
