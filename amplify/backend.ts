import { defineBackend } from '@aws-amplify/backend';
import { Stack } from 'aws-cdk-lib';
import {
  AuthorizationType,
  Cors,
  LambdaIntegration,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { Policy, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { pdfProcessor } from './functions/pdf-processor/resource';
import { storage } from './storage/resource';

const backend = defineBackend({
  auth,
  data,
  pdfProcessor,
  storage,
});

// Create a new API stack
const apiStack = backend.createStack('api-stack');

// Create a new REST API
const pdfRestApi = new RestApi(apiStack, 'PdfRestApi', {
  restApiName: 'pdf-processor-api',
  deploy: true,
  deployOptions: {
    stageName: 'dev',
  },
  defaultCorsPreflightOptions: {
    allowOrigins: Cors.ALL_ORIGINS,
    allowMethods: Cors.ALL_METHODS,
    allowHeaders: Cors.DEFAULT_HEADERS,
  },
});

// Create a Lambda integration
const lambdaIntegration = new LambdaIntegration(
  backend.pdfProcessor.resources.lambda
);

// Create a resource path for PDF processing with IAM authorization
const pdfPath = pdfRestApi.root.addResource('process-pdf');
pdfPath.addMethod('POST', lambdaIntegration, {
  authorizationType: AuthorizationType.IAM,
});

// Create an IAM policy to allow Invoke access to the API
const apiRestPolicy = new Policy(apiStack, 'PdfRestApiPolicy', {
  statements: [
    new PolicyStatement({
      actions: ['execute-api:Invoke'],
      resources: [
        `${pdfRestApi.arnForExecuteApi('*', '/process-pdf', 'dev')}`,
      ],
    }),
  ],
});

// Attach the policy to both authenticated and unauthenticated IAM roles
backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(
  apiRestPolicy
);
backend.auth.resources.unauthenticatedUserIamRole.attachInlinePolicy(
  apiRestPolicy
);

// Create Bedrock policy for PDF processing function
const pdfProcessorBedrockPolicy = new Policy(
  Stack.of(backend.pdfProcessor.resources.lambda),
  'PdfProcessorBedrockPolicy',
  {
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:Converse'
        ],
        resources: [
          // Foundation model ARNs for Claude 3.5 Sonnet
          'arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0',
          'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0',
          'arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0',
          // Foundation model ARNs for Claude 3 Sonnet (backup)
          'arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0',
          'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0',
          'arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0'
        ],
      }),
    ],
  }
);

// Create S3 policy for PDF processing function
const pdfProcessorS3Policy = new Policy(
  Stack.of(backend.pdfProcessor.resources.lambda),
  'PdfProcessorS3Policy',
  {
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          's3:GetObject',
          's3:PutObject',
          's3:DeleteObject'
        ],
        resources: [
          `${backend.storage.resources.bucket.bucketArn}/*`
        ],
      }),
    ],
  }
);

// Attach policies to the PDF processor function
backend.pdfProcessor.resources.lambda.role?.attachInlinePolicy(
  pdfProcessorBedrockPolicy
);
backend.pdfProcessor.resources.lambda.role?.attachInlinePolicy(
  pdfProcessorS3Policy
);

// Add outputs to the configuration file
backend.addOutput({
  custom: {
    API: {
      [pdfRestApi.restApiName]: {
        endpoint: pdfRestApi.url,
        region: Stack.of(pdfRestApi).region,
        apiName: pdfRestApi.restApiName,
      },
    },
  },
});
