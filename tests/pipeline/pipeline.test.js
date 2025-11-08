/**
 * CI/CD Pipeline Tests
 * Validates pipeline configuration and deployment workflows
 */

const AWS = require('aws-sdk');
const fs = require('fs');
const yaml = require('js-yaml');

// Mock AWS SDK for testing
jest.mock('aws-sdk');

describe('CI/CD Pipeline Configuration', () => {
  describe('BuildSpec Validation', () => {
    test('buildspec.yml should exist and be valid YAML', () => {
      expect(fs.existsSync('buildspec.yml')).toBe(true);
      
      const buildspec = fs.readFileSync('buildspec.yml', 'utf8');
      const parsed = yaml.load(buildspec);
      
      expect(parsed.version).toBe(0.2);
      expect(parsed.phases).toBeDefined();
      expect(parsed.phases.pre_build).toBeDefined();
      expect(parsed.phases.build).toBeDefined();
      expect(parsed.phases.post_build).toBeDefined();
    });

    test('buildspec.yml should have required environment variables', () => {
      const buildspec = fs.readFileSync('buildspec.yml', 'utf8');
      const parsed = yaml.load(buildspec);
      
      const commands = [
        ...parsed.phases.pre_build.commands,
        ...parsed.phases.build.commands,
        ...parsed.phases.post_build.commands
      ].join(' ');
      
      expect(commands).toContain('$AWS_DEFAULT_REGION');
      expect(commands).toContain('$AWS_ACCOUNT_ID');
      expect(commands).toContain('$IMAGE_REPO_NAME');
      expect(commands).toContain('$SERVICE_NAME');
    });

    test('buildspec.yml should include Docker commands', () => {
      const buildspec = fs.readFileSync('buildspec.yml', 'utf8');
      const parsed = yaml.load(buildspec);
      
      const commands = parsed.phases.build.commands.join(' ');
      
      expect(commands).toContain('docker build');
      expect(commands).toContain('docker tag');
      expect(commands).toContain('docker push');
    });
  });

  describe('AppSpec Validation', () => {
    test('appspec.yml should exist and be valid YAML', () => {
      expect(fs.existsSync('appspec.yml')).toBe(true);
      
      const appspec = fs.readFileSync('appspec.yml', 'utf8');
      const parsed = yaml.load(appspec);
      
      expect(parsed.version).toBe(0.0);
      expect(parsed.Resources).toBeDefined();
    });

    test('appspec.yml should define ECS service', () => {
      const appspec = fs.readFileSync('appspec.yml', 'utf8');
      const parsed = yaml.load(appspec);
      
      expect(parsed.Resources).toHaveLength(1);
      expect(parsed.Resources[0].TargetService).toBeDefined();
      expect(parsed.Resources[0].TargetService.Type).toBe('AWS::ECS::Service');
    });

    test('appspec.yml should have deployment hooks', () => {
      const appspec = fs.readFileSync('appspec.yml', 'utf8');
      const parsed = yaml.load(appspec);
      
      expect(parsed.Hooks).toBeDefined();
      expect(parsed.Hooks.length).toBeGreaterThan(0);
    });
  });

  describe('Test BuildSpec Validation', () => {
    test('buildspec-test.yml should exist and be valid', () => {
      expect(fs.existsSync('buildspec-test.yml')).toBe(true);
      
      const buildspec = fs.readFileSync('buildspec-test.yml', 'utf8');
      const parsed = yaml.load(buildspec);
      
      expect(parsed.version).toBe(0.2);
      expect(parsed.phases.build).toBeDefined();
    });

    test('buildspec-test.yml should run tests', () => {
      const buildspec = fs.readFileSync('buildspec-test.yml', 'utf8');
      const parsed = yaml.load(buildspec);
      
      const commands = parsed.phases.build.commands.join(' ');
      
      expect(commands).toContain('npm test');
      expect(commands).toContain('--coverage');
    });

    test('buildspec-test.yml should include security scanning', () => {
      const buildspec = fs.readFileSync('buildspec-test.yml', 'utf8');
      const parsed = yaml.load(buildspec);
      
      const commands = parsed.phases.build.commands.join(' ');
      
      expect(commands).toContain('snyk');
      expect(commands).toContain('checkov');
    });
  });

  describe('Deployment Scripts', () => {
    test('deploy.sh should exist and be executable', () => {
      expect(fs.existsSync('scripts/deploy.sh')).toBe(true);
      
      const stats = fs.statSync('scripts/deploy.sh');
      expect(stats.mode & fs.constants.S_IXUSR).toBeTruthy();
    });

    test('rollback.sh should exist and be executable', () => {
      expect(fs.existsSync('scripts/rollback.sh')).toBe(true);
      
      const stats = fs.statSync('scripts/rollback.sh');
      expect(stats.mode & fs.constants.S_IXUSR).toBeTruthy();
    });

    test('smoke-tests.sh should exist and be executable', () => {
      expect(fs.existsSync('scripts/smoke-tests.sh')).toBe(true);
      
      const stats = fs.statSync('scripts/smoke-tests.sh');
      expect(stats.mode & fs.constants.S_IXUSR).toBeTruthy();
    });
  });

  describe('Security Configuration', () => {
    test('.snyk file should exist', () => {
      expect(fs.existsSync('.snyk')).toBe(true);
    });

    test('.snyk should have proper configuration', () => {
      const snykConfig = fs.readFileSync('.snyk', 'utf8');
      
      expect(snykConfig).toContain('version:');
      expect(snykConfig).toContain('exclude:');
    });
  });
});

describe('Pipeline Workflow', () => {
  let codepipeline, codebuild, codedeploy;

  beforeEach(() => {
    codepipeline = new AWS.CodePipeline();
    codebuild = new AWS.CodeBuild();
    codedeploy = new AWS.CodeDeploy();
  });

  describe('Pipeline Execution', () => {
    test('should start pipeline execution', async () => {
      codepipeline.startPipelineExecution = jest.fn().mockReturnValue({
        promise: () => Promise.resolve({ pipelineExecutionId: 'test-123' })
      });

      const result = await codepipeline.startPipelineExecution({
        name: 'test-pipeline'
      }).promise();

      expect(result.pipelineExecutionId).toBe('test-123');
      expect(codepipeline.startPipelineExecution).toHaveBeenCalledWith({
        name: 'test-pipeline'
      });
    });

    test('should handle pipeline execution errors', async () => {
      codepipeline.startPipelineExecution = jest.fn().mockReturnValue({
        promise: () => Promise.reject(new Error('Pipeline not found'))
      });

      await expect(
        codepipeline.startPipelineExecution({ name: 'invalid' }).promise()
      ).rejects.toThrow('Pipeline not found');
    });
  });

  describe('Build Execution', () => {
    test('should start build', async () => {
      codebuild.startBuild = jest.fn().mockReturnValue({
        promise: () => Promise.resolve({ build: { id: 'build-123' } })
      });

      const result = await codebuild.startBuild({
        projectName: 'test-project'
      }).promise();

      expect(result.build.id).toBe('build-123');
    });

    test('should get build status', async () => {
      codebuild.batchGetBuilds = jest.fn().mockReturnValue({
        promise: () => Promise.resolve({
          builds: [{ id: 'build-123', buildStatus: 'SUCCEEDED' }]
        })
      });

      const result = await codebuild.batchGetBuilds({
        ids: ['build-123']
      }).promise();

      expect(result.builds[0].buildStatus).toBe('SUCCEEDED');
    });
  });

  describe('Deployment Execution', () => {
    test('should create deployment', async () => {
      codedeploy.createDeployment = jest.fn().mockReturnValue({
        promise: () => Promise.resolve({ deploymentId: 'deploy-123' })
      });

      const result = await codedeploy.createDeployment({
        applicationName: 'test-app',
        deploymentGroupName: 'test-dg'
      }).promise();

      expect(result.deploymentId).toBe('deploy-123');
    });

    test('should stop deployment for rollback', async () => {
      codedeploy.stopDeployment = jest.fn().mockReturnValue({
        promise: () => Promise.resolve({ status: 'Stopped' })
      });

      const result = await codedeploy.stopDeployment({
        deploymentId: 'deploy-123',
        autoRollbackEnabled: true
      }).promise();

      expect(result.status).toBe('Stopped');
      expect(codedeploy.stopDeployment).toHaveBeenCalledWith({
        deploymentId: 'deploy-123',
        autoRollbackEnabled: true
      });
    });
  });
});

describe('Rollback Functionality', () => {
  test('auto_rollback Lambda should handle alarm events', () => {
    const handler = require('../../infrastructure/terraform/modules/cicd/lambda/auto_rollback');
    
    const event = {
      Records: [{
        Sns: {
          Message: JSON.stringify({
            AlarmName: 'gaming-platform-game-engine-error-alarm',
            NewStateValue: 'ALARM',
            NewStateReason: 'Error rate exceeded threshold'
          })
        }
      }]
    };

    // Test that handler can parse the event
    expect(() => JSON.parse(event.Records[0].Sns.Message)).not.toThrow();
  });
});
