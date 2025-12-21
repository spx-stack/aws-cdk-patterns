import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NetworkStack } from '../../lib/stacks/network-stack';

describe('NetworkStack', () => {
  let app: cdk.App;
  let stack: NetworkStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new NetworkStack(app, 'TestNetworkStack', {
      config: {
        maxAzs: 2,
        natGateways: 1,
        enableFlowLogs: true,
      },
    });
    template = Template.fromStack(stack);
  });

  test('creates VPC', () => {
    template.resourceCountIs('AWS::EC2::VPC', 1);
  });

  test('creates correct number of subnets', () => {
    // 2 AZs * 3 tiers = 6 subnets
    template.resourceCountIs('AWS::EC2::Subnet', 6);
  });

  test('creates NAT Gateway', () => {
    template.resourceCountIs('AWS::EC2::NatGateway', 1);
  });

  test('creates VPC Flow Logs', () => {
    template.resourceCountIs('AWS::EC2::FlowLog', 1);
  });

  test('creates S3 VPC Endpoint', () => {
    template.hasResourceProperties('AWS::EC2::VPCEndpoint', {
      ServiceName: {
        'Fn::Join': [
          '',
          ['com.amazonaws.', { Ref: 'AWS::Region' }, '.s3'],
        ],
      },
      VpcEndpointType: 'Gateway',
    });
  });

  test('exports VPC ID', () => {
    template.hasOutput('VpcId', {
      Export: {
        Name: 'TestNetworkStack-VpcId',
      },
    });
  });
});
