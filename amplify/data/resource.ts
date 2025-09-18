import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Data model for Document Extractor application
 * Includes User profiles and Activity logs for tracking document processing
 */
const schema = a.schema({
  // User profile model - extends Cognito user data
  User: a
    .model({
      email: a.string().required(),
      firstName: a.string().required(),
      lastName: a.string().required(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      // Activity logs relationship
      activityLogs: a.hasMany('ActivityLog', 'userId'),
    })
    .authorization((allow) => [
      allow.owner(), // Users can only access their own profile
    ]),

  // Activity log model for tracking user actions and document processing
  ActivityLog: a
    .model({
      userId: a.id().required(),
      action: a.string().required(), // e.g., 'login', 'upload_document', 'extract_data', 'view_dashboard'
      details: a.json(), // Additional context about the action (file info, extracted data, etc.)
      ipAddress: a.string(),
      userAgent: a.string(),
      createdAt: a.datetime().required(),
      // Relationships
      user: a.belongsTo('User', 'userId'),
    })
    .secondaryIndexes((index) => [
      index('userId').sortKeys(['createdAt']).queryField('activityLogsByUserId'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create']),
      allow.guest().to(['read']), // Users can only access their own logs
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool', // Use Cognito User Pool for authentication
  },
});

/**
 * Frontend Usage Example:
 * 
 * import { generateClient } from "aws-amplify/data";
 * import type { Schema } from "./amplify/data/resource";
 * 
 * const client = generateClient<Schema>();
 * 
 * // Log document upload activity
 * const uploadLog = await client.models.ActivityLog.create({
 *   userId: currentUser.id,
 *   action: 'upload_document',
 *   details: { 
 *     fileName: 'patient-document.pdf',
 *     fileSize: 1024000,
 *     fileType: 'application/pdf'
 *   },
 *   createdAt: new Date().toISOString(),
 * });
 * 
 * // Log data extraction activity
 * const extractionLog = await client.models.ActivityLog.create({
 *   userId: currentUser.id,
 *   action: 'extract_data',
 *   details: { 
 *     extractedData: {
 *       firstName: 'John',
 *       lastName: 'Doe',
 *       dateOfBirth: '1990-01-01'
 *     }
 *   },
 *   createdAt: new Date().toISOString(),
 * });
 * 
 * // List user's activity logs
 * const { data: activities } = await client.models.ActivityLog.list({
 *   filter: { userId: { eq: currentUser.id } }
 * });
 */
