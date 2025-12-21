import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { VpcConstruct } from '../constructs/vpc-construct';
import { VpcConfig } from '../config/environments';

export interface NetworkStackProps extends cdk.StackProps {
  config: VpcConfig;
}

/**
 * Network Stack - VPC and networking resources
 */
export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const vpcConstruct = new VpcConstruct(this, 'Vpc', {
      maxAzs: props.config.maxAzs,
      natGateways: props.config.natGateways,
      enableFlowLogs: props.config.enableFlowLogs,
    });

    this.vpc = vpcConstruct.vpc;

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${id}-VpcId`,
    });

    new cdk.CfnOutput(this, 'PrivateSubnets', {
      value: this.vpc.privateSubnets.map((s) => s.subnetId).join(','),
      description: 'Private Subnet IDs',
      exportName: `${id}-PrivateSubnets`,
    });
  }
}
