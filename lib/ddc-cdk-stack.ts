import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LambdaPipeline } from './lambda-pipeline';

export class DdcCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ddbLambda = new LambdaPipeline(this, "DdcLambdaPipeline", {
      region: "us-east-2",
      functionName: "DdcLambda",
      githubOwner: "DuckDuckCode-tech",
      githubRepo: "lambda",
      githubBranch: "main",
      timeout: cdk.Duration.minutes(10),
    })
  }
}
