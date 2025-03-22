import * as cdk from 'aws-cdk-lib';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { LambdaPipeline } from './lambda-pipeline';

export class DdcCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ddbLambda = new LambdaPipeline(this, "DdcLambdaPipeline", {
      region: "us-east-1",
      functionName: "DdcLambda",
      githubOwner: "DuckDuckCode-tech",
      githubRepo: "lambda",
      githubBranch: "main",
      timeout: cdk.Duration.minutes(10),
    });

    const table = new ddb.Table(this, 'DDCTable', {
      partitionKey: { name: 'pk', type: ddb.AttributeType.STRING },
      tableName: 'DDCTable',
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
    });
  }
}
