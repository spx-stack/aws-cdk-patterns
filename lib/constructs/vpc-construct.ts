import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface VpcConstructProps {
  /**
   * Maximum number of Availability Zones to use
   * @default 3
   */
  maxAzs?: number;

  /**
   * Number of NAT Gateways to create
   * Set to 0 for development environments to save costs
   * @default 1
   */
  natGateways?: number;

  /**
   * Enable VPC Flow Logs
   * @default true
   */
  enableFlowLogs?: boolean;

  /**
   * CIDR block for the VPC
   * @default '10.0.0.0/16'
   */
  cidr?: string;
}

/**
 * VPC construct with best practices:
 * - Three-tier subnet architecture (public, private, isolated)
 * - NAT Gateway for private subnets
 * - VPC Flow Logs
 * - VPC Endpoints for AWS services
 */
export class VpcConstruct extends Construct {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: VpcConstructProps = {}) {
    super(scope, id);

    const {
      maxAzs = 3,
      natGateways = 1,
      enableFlowLogs = true,
      cidr = '10.0.0.0/16',
    } = props;

    // Create VPC with three-tier architecture
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(cidr),
      maxAzs,
      natGateways,

      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
          mapPublicIpOnLaunch: false,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Add VPC Flow Logs
    if (enableFlowLogs) {
      const logGroup = new logs.LogGroup(this, 'FlowLogGroup', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      new ec2.FlowLog(this, 'FlowLog', {
        resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
        destination: ec2.FlowLogDestination.toCloudWatchLogs(logGroup),
        trafficType: ec2.FlowLogTrafficType.ALL,
      });
    }

    // Add VPC Endpoints for common AWS services
    this.addVpcEndpoints();

    // Add tags
    cdk.Tags.of(this.vpc).add('Name', `${id}-vpc`);
  }

  private addVpcEndpoints(): void {
    // S3 Gateway Endpoint (free)
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // DynamoDB Gateway Endpoint (free)
    this.vpc.addGatewayEndpoint('DynamoDbEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    // Interface Endpoints (cost money, add only if needed)
    // Uncomment as needed:

    // this.vpc.addInterfaceEndpoint('EcrEndpoint', {
    //   service: ec2.InterfaceVpcEndpointAwsService.ECR,
    // });

    // this.vpc.addInterfaceEndpoint('EcrDockerEndpoint', {
    //   service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
    // });

    // this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
    //   service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    // });
  }
}
