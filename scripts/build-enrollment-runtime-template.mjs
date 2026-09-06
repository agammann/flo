import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { enrollmentRuntimeBoundary } from "./enrollment-runtime-boundary.mjs";

const ref = name => ({ Ref: name });
const sub = value => ({ "Fn::Sub": value });
const attr = (name, field) => ({ "Fn::GetAtt": [name, field] });
const retained = { DeletionPolicy: "Retain", UpdateReplacePolicy: "Retain" };
const tableParameters = { auth: "AuthTable", links: "LinksTable", requests: "RequestsTable", approvals: "ApprovalsTable", audit: "AuditTable" };

// Generates a reviewable template only. No AWS calls, secret reads or deployment.
// Baseline identity policies are unchanged Autopilot output; explicit maximum
// permission boundaries are built separately via the IAM reference workflow.
export function buildEnrollmentRuntimeTemplate(baselines) {
  const Parameters = {
    ExistingApiId: { Type: "String", AllowedPattern: "[a-z0-9]{10}", Description: "Existing customer HTTP API. Its stage, login and read-only role remain unchanged." },
    PublicOrigin: { Type: "String", AllowedPattern: "https://[a-z0-9]{10}\\.execute-api\\.us-west-2\\.amazonaws\\.com", Description: "Exact existing HTTPS origin, without trailing slash." },
    LwaClientId: { Type: "String", MinLength: 1, MaxLength: 100, Description: "Existing public Login with Amazon client ID; not its client secret." },
    StateSecretArn: { Type: "String", AllowedPattern: "arn:aws:secretsmanager:us-west-2:[0-9]{12}:secret:[A-Za-z0-9/_+=.@-]+", Description: "Existing auth-state encryption secret ARN. CloudFormation resolves encryptionKey privately." },
    LambdaEnvironmentKeyArn: { Type: "String", AllowedPattern: "arn:aws:kms:us-west-2:[0-9]{12}:key/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}", Description: "Verified existing alias/aws/lambda key ARN in this account/region. Boundary scope only; does not change function encryption or create a key." },
    RequestDynamoKeyArn: { Type: "String", AllowedPattern: "arn:aws:kms:us-west-2:[0-9]{12}:key/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}", Description: "Verified existing shared KMS key of AuthTable, LinksTable and RequestsTable; distinct from LambdaEnvironmentKeyArn. Request boundary only; no key or table changes." },
    ArtifactBucket: { Type: "String", AllowedPattern: "[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]", Description: "Reviewed private versioned us-west-2 artifact bucket." },
    ReleaseId: { Type: "String", AllowedPattern: "[a-z0-9-]{1,64}", Description: "New reviewed ID on EVERY code/configuration update to publish new immutable versions." },
    EnableEnrollment: { Type: "String", Default: "false", AllowedValues: ["false", "true"], Description: "Keep false until deployment and tests are approved." },
    EnableRedemption: { Type: "String", Default: "false", AllowedValues: ["false", "true"], Description: "Separate link-creation gate. Keep false during request-only identity verification; requires its own approved stateful test plan." },
    PublishRoutes: { Type: "String", Default: "false", AllowedValues: ["false", "true"], Description: "Explicit review gate for four same-origin pairing routes, not repair or approval routes." },
    EnableApproval: { Type: "String", Default: "false", AllowedValues: ["false", "true"], Description: "Keep false until independent fictional customer designation and operator access are reviewed." },
    ApprovalDesignation: { Type: "String", Default: "null", MaxLength: 2048, NoEcho: true, Description: "Privately supplied independently verified designation JSON; never event-controlled or fabricated." }
  };
  for (const name of Object.values(tableParameters)) Parameters[name] = { Type: "String", AllowedPattern: "[A-Za-z0-9_.-]{3,255}", Description: "Existing reviewed table; no creation, restoration or replacement in this template." };
  for (const kind of ["Request", "Redemption", "Approval"]) {
    Parameters[`${kind}ArtifactKey`] = { Type: "String", AllowedPattern: `flo-enrollment/${kind.toLowerCase()}/[a-f0-9]{64}\\.zip`, Description: "Content-addressed artifact, separately packaged from tested source." };
    Parameters[`${kind}ArtifactVersion`] = { Type: "String", MinLength: 1, Description: "Immutable S3 object version." };
    Parameters[`${kind}CodeSha256`] = { Type: "String", AllowedPattern: "[A-Za-z0-9+/]{43}=", Description: "Base64 SHA-256 of exact uploaded ZIP; Lambda version publication checks it." };
  }
  const Resources = {};
  for (const [kind, cap] of [["request", "Request"], ["redemption", "Redemption"], ["approval", "Approval"]]) {
    const name = `\${AWS::StackName}-${kind}`;
    const tokenConfig = { account: "114599789754", region: "us-west-2", tables: Object.fromEntries(Object.keys(tableParameters).map(k => [k, `TOKEN_${k}`])),
      logGroup: `/aws/lambda/TOKEN_${kind}`, lambdaEnvironmentKeyArn: "arn:aws:kms:us-west-2:114599789754:key/00000000-0000-0000-0000-000000000000",
      ...(kind === "request" ? { redemptionVersionArn: "arn:aws:lambda:us-west-2:114599789754:function:TOKEN_redemption:1",
        requestDynamoKeyArn: "arn:aws:kms:us-west-2:114599789754:key/00000000-0000-0000-0000-000000000001" } : {}) };
    const substitutions = new Map(Object.entries(tableParameters).map(([key, parameter]) => [
      `arn:aws:dynamodb:us-west-2:114599789754:table/TOKEN_${key}`,
      sub(`arn:\${AWS::Partition}:dynamodb:\${AWS::Region}:\${AWS::AccountId}:table/\${${parameter}}`)
    ]));
    substitutions.set(`arn:aws:logs:us-west-2:114599789754:log-group:/aws/lambda/TOKEN_${kind}:log-stream:*`, sub(`arn:\${AWS::Partition}:logs:\${AWS::Region}:\${AWS::AccountId}:log-group:/aws/lambda/${name}:log-stream:*`));
    substitutions.set(tokenConfig.redemptionVersionArn, ref("RedemptionVersion"));
    substitutions.set(tokenConfig.lambdaEnvironmentKeyArn, ref("LambdaEnvironmentKeyArn"));
    if (kind === "request") {
      substitutions.set(tokenConfig.requestDynamoKeyArn, ref("RequestDynamoKeyArn"));
      for (const key of ["auth", "links", "requests"]) substitutions.set(`TOKEN_${key}`, ref(tableParameters[key]));
    }
    substitutions.set("114599789754", ref("AWS::AccountId"));
    substitutions.set(`arn:aws:lambda:us-west-2:114599789754:function:TOKEN_${kind}`, sub(`arn:\${AWS::Partition}:lambda:\${AWS::Region}:\${AWS::AccountId}:function:${name}`));
    const replace = value => typeof value === "string" ? substitutions.get(value) ?? value : Array.isArray(value) ? value.map(replace) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replace(v)])) : value;
    Resources[`${cap}Boundary`] = { Type: "AWS::IAM::ManagedPolicy", Properties: {
      Description: `${kind} maximum authority, grants nothing alone`, PolicyDocument: replace(enrollmentRuntimeBoundary(kind, tokenConfig)) } };
    Resources[`${cap}Role`] = { Type: "AWS::IAM::Role", Properties: {
      // Lambda's documented execution-role trust pattern; do not assume that
      // service-to-service SourceArn keys are populated on AssumeRole.
      AssumeRolePolicyDocument: { Version: "2012-10-17", Statement: [{ Effect: "Allow", Principal: { Service: "lambda.amazonaws.com" }, Action: "sts:AssumeRole" }] },
      PermissionsBoundary: ref(`${cap}Boundary`),
      ManagedPolicyArns: ["arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"]
    } };
    Resources[`${cap}Baseline`] = { Type: "AWS::IAM::ManagedPolicy", Properties: { Roles: [ref(`${cap}Role`)],
      Description: "Unmodified generated baseline, usable only with the mandatory exact-resource boundary",
      PolicyDocument: baselines.roles[kind].generated.Policies[0].Policy } };
    Resources[`${cap}Logs`] = { Type: "AWS::Logs::LogGroup", ...retained, Properties: { LogGroupName: sub(`/aws/lambda/${name}`), RetentionInDays: 7 } };
    const variables = {
      FLO_CUSTOMER_AUTH_TABLE: ref("AuthTable"), FLO_CUSTOMER_LINKS_TABLE: ref("LinksTable"),
      FLO_ENROLLMENT_REQUESTS_TABLE: ref("RequestsTable"), FLO_ENROLLMENT_APPROVALS_TABLE: ref("ApprovalsTable"), FLO_ENROLLMENT_AUDIT_TABLE: ref("AuditTable")
    };
    if (kind === "approval") Object.assign(variables, { FLO_PRIVATE_APPROVAL_ENABLED: ref("EnableApproval"), FLO_PRIVATE_APPROVAL_DESIGNATION: ref("ApprovalDesignation") });
    else Object.assign(variables, { FLO_ENROLLMENT_ENABLED: ref(kind === "redemption" ? "EnableRedemption" : "EnableEnrollment"), FLO_AWS_ACCOUNT_ID: ref("AWS::AccountId"), LWA_CLIENT_ID: ref("LwaClientId"),
      FLO_CUSTOMER_PUBLIC_ORIGIN: ref("PublicOrigin"), FLO_CUSTOMER_STATE_KEY: sub("{{resolve:secretsmanager:${StateSecretArn}:SecretString:encryptionKey}}") });
    if (kind === "request") Object.assign(variables, { FLO_CUSTOMER_API_ID: ref("ExistingApiId"), FLO_REDEMPTION_FUNCTION_ARN: ref("RedemptionVersion") });
    Resources[`${cap}Function`] = { Type: "AWS::Lambda::Function", DependsOn: [`${cap}Logs`, `${cap}Baseline`], Properties: {
      FunctionName: sub(name), Description: sub(`Reviewed ${kind} release \${ReleaseId}`), Runtime: "nodejs22.x", Handler: "index.handler", Architectures: ["x86_64"], Role: attr(`${cap}Role`, "Arn"),
      MemorySize: 256, Timeout: kind === "request" ? 20 : 10, ReservedConcurrentExecutions: 1,
      Code: { S3Bucket: ref("ArtifactBucket"), S3Key: ref(`${cap}ArtifactKey`), S3ObjectVersion: ref(`${cap}ArtifactVersion`) },
      // Platform start/report records expose operational metrics, not the event
      // payload. Keep application detail filtered and retention finite.
      Environment: { Variables: variables }, LoggingConfig: { LogFormat: "JSON", ApplicationLogLevel: "WARN", SystemLogLevel: "INFO" }
    } };
    Resources[`${cap}Version`] = { Type: "AWS::Lambda::Version", ...retained, Properties: {
      FunctionName: ref(`${cap}Function`), CodeSha256: ref(`${cap}CodeSha256`), Description: sub(`Reviewed ${kind} release \${ReleaseId}`)
    } };
  }
  Resources.PairingIntegration = { Type: "AWS::ApiGatewayV2::Integration", Condition: "ExposeRoutes", Properties: {
    ApiId: ref("ExistingApiId"), IntegrationType: "AWS_PROXY", IntegrationUri: ref("RequestVersion"), PayloadFormatVersion: "2.0", TimeoutInMillis: 25000
  } };
  for (const [id, method, path] of [["PairingPage", "GET", "pairing"], ["PairingAsset", "GET", "pairing.js"], ["StartPairing", "POST", "enrollment/request"], ["RedeemPairing", "POST", "enrollment/redeem"]]) {
    const condition = id === "RedeemPairing" ? "ExposeRedemptionRoute" : "ExposeRoutes";
    Resources[`${id}Permission`] = { Type: "AWS::Lambda::Permission", Condition: condition, Properties: {
      Action: "lambda:InvokeFunction", FunctionName: ref("RequestVersion"), Principal: "apigateway.amazonaws.com", SourceAccount: ref("AWS::AccountId"),
      SourceArn: sub(`arn:\${AWS::Partition}:execute-api:\${AWS::Region}:\${AWS::AccountId}:\${ExistingApiId}/$default/${method}/${path}`)
    } };
    Resources[`${id}Route`] = { Type: "AWS::ApiGatewayV2::Route", Condition: condition, DependsOn: [`${id}Permission`], Properties: {
      ApiId: ref("ExistingApiId"), RouteKey: `${method} /${path}`, AuthorizationType: "NONE", Target: sub("integrations/${PairingIntegration}")
    } };
  }
  return { AWSTemplateFormatVersion: "2010-09-09", Description: "Flo us-west-2 enrollment runtime REVIEW ONLY. No repair data, operator grants, customer links or replacement website. Explicit approval required.",
    Metadata: { IntendedAccount: "114599789754", IntendedRegion: "us-west-2", BaselineGenerator: "iam-policy-autopilot 0.3.0", ApprovalState: "NOT_APPROVED_FOR_DEPLOYMENT" },
    Parameters, Conditions: {
      ExposeRoutes: { "Fn::And": [{ "Fn::Equals": [ref("PublishRoutes"), "true"] }, { "Fn::Equals": [ref("EnableEnrollment"), "true"] }] },
      ExposeRedemptionRoute: { "Fn::And": [{ Condition: "ExposeRoutes" }, { "Fn::Equals": [ref("EnableRedemption"), "true"] }] }
    },
    Resources, Outputs: Object.fromEntries(["Request", "Redemption", "Approval"].map(cap => [`${cap}VersionArn`, { Description: "Exact numeric published version; not a grant to invoke it", Value: ref(`${cap}Version`) }])) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baseline = JSON.parse(await readFile(new URL("../infra/aws/customer-enrollment/runtime-autopilot-baselines.json", import.meta.url), "utf8"));
  console.info(JSON.stringify(buildEnrollmentRuntimeTemplate(baseline), null, 2));
}
