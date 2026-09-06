import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { EnrollmentTransactions } from "./customer-enrollment.js";
import type { EnrollmentTables } from "./customer-enrollment-dynamodb-common.js";
import { DynamoEnrollmentStarter } from "./customer-enrollment-dynamodb-start.js";
import { DynamoEnrollmentApprover } from "./customer-enrollment-dynamodb-approve.js";
import { DynamoEnrollmentRedeemer } from "./customer-enrollment-dynamodb-redeem.js";

export type { EnrollmentTables } from "./customer-enrollment-dynamodb-common.js";
/** Composite for local contracts only. Never construct this union of authority
 * in a public Lambda. Deployed processes must use single-purpose adapters
 * with independently reviewed IAM credentials. */
export class DynamoEnrollmentTransactions implements EnrollmentTransactions {
  readonly start: EnrollmentTransactions["start"];
  readonly approve: EnrollmentTransactions["approve"];
  readonly redeem: EnrollmentTransactions["redeem"];
  constructor(client: DynamoDBDocumentClient, tables: EnrollmentTables, now: () => number = Date.now) {
    const starter = new DynamoEnrollmentStarter(client, tables, now);
    const approver = new DynamoEnrollmentApprover(client, tables, now);
    const redeemer = new DynamoEnrollmentRedeemer(client, tables, now);
    this.start = starter.start.bind(starter);
    this.approve = approver.approve.bind(approver);
    this.redeem = redeemer.redeem.bind(redeemer);
  }
}
