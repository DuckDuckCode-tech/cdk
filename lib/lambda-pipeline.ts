import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";

export interface LambdaPipelineProps {
	readonly region: string;
	readonly functionName: string;
	readonly githubOwner: string;
	readonly githubRepo: string;
	readonly githubBranch: string;
	readonly timeout?: cdk.Duration;
}

export class LambdaPipeline extends Construct {
	readonly pipeline: codepipeline.Pipeline;
	readonly lambdaFunction: lambda.Function;

	constructor(scope: Construct, id: string, props: LambdaPipelineProps) {
		super(scope, id);

		const { functionName } = props;

		this.pipeline = new codepipeline.Pipeline(this, `DDCLambdaPipeline-${functionName}`, {
			pipelineName: `${functionName}-pipeline`
		});

		this.lambdaFunction = new lambda.Function(this, `DDCLambda-${functionName}`, {
			functionName: functionName,
			runtime: lambda.Runtime.NODEJS_22_X,
			code: lambda.Code.fromInline("// Initial placeholder code"),
			handler: "dist/main.handler",
			timeout: props.timeout ?? cdk.Duration.seconds(30)
		});

		this.addPipelineStages(props);
	}

	addPipelineStages(props: LambdaPipelineProps): void {
		const { region, functionName, githubOwner, githubRepo, githubBranch } = props;

		const sourceOutput = new codepipeline.Artifact(`${functionName}DDCLambdaSourceArtifact`);
		this.pipeline.addStage({
			stageName: "Source",
			actions: [
				new codepipeline_actions.CodeStarConnectionsSourceAction({
					actionName: "GitHub_Source",
					owner: githubOwner,
					repo: githubRepo,
					branch: githubBranch,
					connectionArn: "arn:aws:codeconnections:us-east-1:939880360164:connection/47eec894-a6e9-4073-b4b3-02efa7dfe6c0",
					output: sourceOutput
				})
			]
		});

		const buildOutput = new codepipeline.Artifact(`${functionName}DDCLambdaBuildArtifact`);
		const buildProject = new codebuild.PipelineProject(this, `${functionName}DDCLambdaBuildProject`, {
			environment: {
				buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
				privileged: true
			},
			buildSpec: codebuild.BuildSpec.fromObject({
				version: "0.2",
				phases: {
					install: {
						commands: [
							`export GITHUB_TOKEN=$(aws secretsmanager get-secret-value --secret-id github-token --region ${region} --query SecretString --output text | jq -r '."github-token"')`,
							'git config --global url."https://$GITHUB_TOKEN@github.com/".insteadOf https://github.com/',
							'git config --global url."https://$GITHUB_TOKEN@github.com/".insteadOf ssh://git@github.com/',
							"npm install"
						]
					},
					build: {
						commands: ["npm run build", "zip -r function.zip dist/* node_modules/* package.json"]
					}
				},
				artifacts: {
					files: ["function.zip"]
				}
			})
		});
		buildProject.addToRolePolicy(
			new iam.PolicyStatement({
				actions: ["secretsmanager:GetSecretValue"],
				resources: ["arn:aws:secretsmanager:us-east-1:939880360164:secret:github-token-BiIohH"]
			})
		);
		this.pipeline.addStage({
			stageName: "Build",
			actions: [
				new codepipeline_actions.CodeBuildAction({
					actionName: "Build",
					project: buildProject,
					input: sourceOutput,
					outputs: [buildOutput]
				})
			]
		});

		const deployProject = new codebuild.PipelineProject(this, `${functionName}DDCLambdaDeployProject`, {
			environment: {
				buildImage: codebuild.LinuxBuildImage.STANDARD_7_0
			},
			environmentVariables: {
				AWS_REGION: { value: region },
				LAMBDA_NAME: { value: functionName }
			},
			buildSpec: codebuild.BuildSpec.fromObject({
				version: "0.2",
				phases: {
					build: {
						commands: ["aws lambda update-function-code --function-name $LAMBDA_NAME --zip-file fileb://function.zip --region $AWS_REGION"]
					}
				}
			})
		});
		deployProject.addToRolePolicy(
			new iam.PolicyStatement({
				actions: ["lambda:UpdateFunctionCode"],
				resources: [this.lambdaFunction.functionArn]
			})
		);
		this.pipeline.addStage({
			stageName: "Deploy",
			actions: [
				new codepipeline_actions.CodeBuildAction({
					actionName: "Deploy",
					project: deployProject,
					input: buildOutput
				})
			]
		});
	}
}
