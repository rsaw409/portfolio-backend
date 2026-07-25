import { vi, describe, test, beforeEach, expect, Mock } from 'vitest';

vi.mock('sequelize', () => {
  return {
    Sequelize: vi.fn(function (connStr) {
      expect(connStr).toEqual('tests-postgres');
      return {
        authenticate: vi.fn(),
        sync: vi.fn(({ alter, force }) => {
          expect(alter).toEqual(true);
          expect(force).toEqual(undefined);
        }),
        query: vi.fn(),
      };
    }),
  };
});

vi.mock('../../../../src/@rsaw409/logger.js', () => {
  return {
    default: {
      error: vi.fn(),
      info: vi.fn(),
    },
  };
});

vi.mock('../../../../src/portfolio-backend/db/models/certificate.js', () => {
  return {
    default: vi.fn(),
  };
});

vi.mock('../../../../src/portfolio-backend/db/models/project.js', () => {
  return {
    default: vi.fn(),
  };
});

vi.mock(
  '../../../../src/portfolio-backend/db/models/work-experience.js',
  () => {
    return {
      default: vi.fn(),
    };
  }
);

vi.mock('../../../../src/portfolio-backend/db/models/education.js', () => {
  return {
    default: vi.fn(),
  };
});

vi.mock('../../../../src/portfolio-backend/db/models/skill.js', () => {
  return {
    default: vi.fn(),
  };
});

vi.mock('../../../../src/portfolio-backend/db/models/user.js', () => {
  return {
    default: vi.fn(),
  };
});

const { default: initializePortfolioDB } = await import(
  '../../../../src/portfolio-backend/db/postgres.js'
);
const { Sequelize } = await import('sequelize');
const { default: createCertificateModel } = await import(
  '../../../../src/portfolio-backend/db/models/certificate.js'
);
const { default: createProjectModel } = await import(
  '../../../../src/portfolio-backend/db/models/project.js'
);
const { default: createWorkExperienceModel } = await import(
  '../../../../src/portfolio-backend/db/models/work-experience.js'
);
const { default: createEducationModel } = await import(
  '../../../../src/portfolio-backend/db/models/education.js'
);
const { default: createSkillModel } = await import(
  '../../../../src/portfolio-backend/db/models/skill.js'
);
const { default: createUserModel } = await import(
  '../../../../src/portfolio-backend/db/models/user.js'
);

describe('TEST PortfolioDB initialization', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('Should init initializeSplitDB', async () => {
    const ss = new Sequelize('tests-postgres');
    const schemaName = 'test-schema';
    await initializePortfolioDB(ss, schemaName);
    expect(createCertificateModel).toHaveBeenCalledWith(ss, schemaName);
    expect(createProjectModel).toHaveBeenCalledWith(ss, schemaName);
    expect(createWorkExperienceModel).toHaveBeenCalledWith(ss, schemaName);
    expect(createEducationModel).toHaveBeenCalledWith(ss, schemaName);
    expect(createSkillModel).toHaveBeenCalledWith(ss, schemaName);
    expect(createUserModel).toHaveBeenCalledWith(ss, schemaName);
  });

  test('Should log error in initializeSplitDB', async () => {
    (createUserModel as Mock).mockImplementation(() => {
      throw new Error('Error in creating model');
    });
    const ss = new Sequelize('tests-postgres');
    const schemaName = 'test-schema';
    await initializePortfolioDB(ss, schemaName);
  });
});
