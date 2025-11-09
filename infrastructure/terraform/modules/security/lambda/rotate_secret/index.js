/**
 * AWS Secrets Manager Rotation Lambda
 * Handles automatic rotation of database credentials, Redis auth tokens, and JWT secrets
 */

const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();
const crypto = require('crypto');

exports.handler = async (event) => {
  console.log('Rotation event:', JSON.stringify(event, null, 2));

  const { SecretId, ClientRequestToken, Step } = event;

  try {
    switch (Step) {
      case 'createSecret':
        await createSecret(SecretId, ClientRequestToken);
        break;
      case 'setSecret':
        await setSecret(SecretId, ClientRequestToken);
        break;
      case 'testSecret':
        await testSecret(SecretId, ClientRequestToken);
        break;
      case 'finishSecret':
        await finishSecret(SecretId, ClientRequestToken);
        break;
      default:
        throw new Error(`Invalid step: ${Step}`);
    }

    console.log(`Successfully completed step: ${Step}`);
    return { statusCode: 200, body: 'Success' };
  } catch (error) {
    console.error(`Error in step ${Step}:`, error);
    throw error;
  }
};

/**
 * Create a new secret version with a new password
 */
async function createSecret(secretId, token) {
  console.log('Creating new secret version');

  // Get the current secret
  const currentSecret = await secretsManager.getSecretValue({
    SecretId: secretId,
    VersionStage: 'AWSCURRENT'
  }).promise();

  const currentSecretData = JSON.parse(currentSecret.SecretString);

  // Generate a new password
  const newPassword = generateSecurePassword();

  // Create new secret version
  const newSecretData = {
    ...currentSecretData,
    password: newPassword,
    rotatedAt: new Date().toISOString()
  };

  await secretsManager.putSecretValue({
    SecretId: secretId,
    ClientRequestToken: token,
    SecretString: JSON.stringify(newSecretData),
    VersionStages: ['AWSPENDING']
  }).promise();

  console.log('New secret version created');
}

/**
 * Set the new secret in the service (database, Redis, etc.)
 */
async function setSecret(secretId, token) {
  console.log('Setting new secret in service');

  // Get the pending secret
  const pendingSecret = await secretsManager.getSecretValue({
    SecretId: secretId,
    VersionId: token,
    VersionStage: 'AWSPENDING'
  }).promise();

  const secretData = JSON.parse(pendingSecret.SecretString);

  // Determine secret type and update accordingly
  if (secretData.engine === 'postgres' || secretData.engine === 'mysql') {
    await updateDatabasePassword(secretData);
  } else if (secretData.type === 'redis') {
    await updateRedisAuthToken(secretData);
  } else if (secretData.type === 'jwt') {
    // JWT secrets don't need to be set in an external service
    console.log('JWT secret rotation - no external service update needed');
  }

  console.log('Secret set in service');
}

/**
 * Test the new secret to ensure it works
 */
async function testSecret(secretId, token) {
  console.log('Testing new secret');

  // Get the pending secret
  const pendingSecret = await secretsManager.getSecretValue({
    SecretId: secretId,
    VersionId: token,
    VersionStage: 'AWSPENDING'
  }).promise();

  const secretData = JSON.parse(pendingSecret.SecretString);

  // Test connection based on secret type
  if (secretData.engine === 'postgres' || secretData.engine === 'mysql') {
    await testDatabaseConnection(secretData);
  } else if (secretData.type === 'redis') {
    await testRedisConnection(secretData);
  } else if (secretData.type === 'jwt') {
    // JWT secrets are always valid if they're properly formatted
    if (!secretData.password || secretData.password.length < 32) {
      throw new Error('JWT secret is too short');
    }
  }

  console.log('Secret test successful');
}

/**
 * Finalize the rotation by marking the new version as current
 */
async function finishSecret(secretId, token) {
  console.log('Finishing secret rotation');

  // Get current version
  const metadata = await secretsManager.describeSecret({
    SecretId: secretId
  }).promise();

  let currentVersion;
  for (const [version, stages] of Object.entries(metadata.VersionIdsToStages)) {
    if (stages.includes('AWSCURRENT')) {
      currentVersion = version;
      break;
    }
  }

  if (currentVersion === token) {
    console.log('Version already marked as AWSCURRENT');
    return;
  }

  // Move AWSCURRENT stage to new version
  await secretsManager.updateSecretVersionStage({
    SecretId: secretId,
    VersionStage: 'AWSCURRENT',
    MoveToVersionId: token,
    RemoveFromVersionId: currentVersion
  }).promise();

  console.log('Secret rotation completed');
}

/**
 * Generate a secure random password
 */
function generateSecurePassword(length = 32) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let password = '';
  const randomBytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }

  return password;
}

/**
 * Update database password (RDS)
 */
async function updateDatabasePassword(secretData) {
  const rds = new AWS.RDS();

  // For RDS, we need to modify the master user password
  await rds.modifyDBInstance({
    DBInstanceIdentifier: secretData.dbInstanceIdentifier,
    MasterUserPassword: secretData.password,
    ApplyImmediately: true
  }).promise();

  console.log('Database password updated');
}

/**
 * Update Redis auth token (ElastiCache)
 */
async function updateRedisAuthToken(secretData) {
  const elasticache = new AWS.ElastiCache();

  // For ElastiCache, we need to modify the auth token
  await elasticache.modifyReplicationGroup({
    ReplicationGroupId: secretData.replicationGroupId,
    AuthToken: secretData.password,
    AuthTokenUpdateStrategy: 'ROTATE',
    ApplyImmediately: true
  }).promise();

  console.log('Redis auth token updated');
}

/**
 * Test database connection
 */
async function testDatabaseConnection(secretData) {
  // In a real implementation, you would connect to the database
  // and verify the credentials work
  console.log('Testing database connection (simulated)');
  
  // Simulate connection test
  if (!secretData.password) {
    throw new Error('Database password is empty');
  }

  return true;
}

/**
 * Test Redis connection
 */
async function testRedisConnection(secretData) {
  // In a real implementation, you would connect to Redis
  // and verify the auth token works
  console.log('Testing Redis connection (simulated)');

  // Simulate connection test
  if (!secretData.password) {
    throw new Error('Redis auth token is empty');
  }

  return true;
}
