import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { EcsConfig } from '../config/environments';

export interface ComputeStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  database: rds.DatabaseCluster;
  config: EcsConfig;
}

/**
 * Compute Stack - ECS Fargate Service with ALB
 */
export class ComputeStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly service: ecs_patterns.ApplicationLoadBalancedFargateService;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // ECS Cluster
    this.cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.vpc,
      containerInsights: true,
      enableFargateCapacityProviders: true,
    });

    // Fargate Service with ALB
    this.service = new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      'Service',
      {
        cluster: this.cluster,
        taskImageOptions: {
          image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
          containerPort: 80,
          environment: {
            NODE_ENV: 'production',
          },
          secrets: {
            // Database credentials from Secrets Manager
            // DB_HOST: ecs.Secret.fromSecretsManager(props.database.secret, 'host'),
            // DB_PASSWORD: ecs.Secret.fromSecretsManager(props.database.secret, 'password'),
          },
        },
        cpu: props.config.cpu,
        memoryLimitMiB: props.config.memory,
        desiredCount: props.config.desiredCount,
        publicLoadBalancer: true,

        // Capacity providers
        capacityProviderStrategies: props.config.useFargateSpot
          ? [
              { capacityProvider: 'FARGATE_SPOT', weight: 80 },
              { capacityProvider: 'FARGATE', weight: 20 },
            ]
          : [{ capacityProvider: 'FARGATE', weight: 100 }],

        // Health check
        healthCheckGracePeriod: cdk.Duration.seconds(60),

        // Circuit breaker
        circuitBreaker: { rollback: true },
      }
    );

    // Auto-scaling
    const scaling = this.service.service.autoScaleTaskCount({
      minCapacity: props.config.minCapacity,
      maxCapacity: props.config.maxCapacity,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Allow ECS to access database
    props.database.connections.allowFrom(
      this.service.service,
      ec2.Port.tcp(5432),
      'Allow ECS to access Aurora'
    );

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDns', {
      value: this.service.loadBalancer.loadBalancerDnsName,
      description: 'Load Balancer DNS',
      exportName: `${id}-AlbDns`,
    });

    new cdk.CfnOutput(this, 'ServiceUrl', {
      value: `http://${this.service.loadBalancer.loadBalancerDnsName}`,
      description: 'Service URL',
    });
  }
}
