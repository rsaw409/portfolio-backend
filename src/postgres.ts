import pg from 'pg';
import { Sequelize } from 'sequelize';
import logger from '../src/@rsaw409/logger.js';

import connectToPortfolioDB from './portfolio-backend/db/postgres.js';
import connectToSplitDB from './split-backend/db/postgres.js';

/**
 * node-postgres returns BIGINT (int8) as a string, since it can exceed
 * Number.MAX_SAFE_INTEGER. Amounts are stored in minor units (paise) and stay far below that,
 * so return a number — and fail loudly rather than round if one ever does not.
 * This also turns count(*) results, which are int8, into numbers.
 */
const parseBigInt = (value: string): number => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new RangeError(`BIGINT ${value} is outside the safe integer range`);
  }
  return parsed;
};

pg.types.setTypeParser(pg.types.builtins.INT8, parseBigInt);

class DBConnection {
  static #instance: DBConnection;

  readonly portfolio_backend: string = 'portfolio_backend';
  readonly split_backend: string = 'split_backend';
  readonly #sequelize: Sequelize;

  static #isInitialized: boolean;

  private constructor(connStr: string) {
    logger.info('Creating DB instance.');
    this.#sequelize = new Sequelize(connStr, {
      logging: false,
      // The same pg module the INT8 parser above is registered on.
      dialectModule: pg,
    });
    DBConnection.#isInitialized = false;
  }

  static getInstance(): DBConnection {
    if (DBConnection.#instance) {
      return DBConnection.#instance;
    }

    if (!process.env.postgresConnStr) {
      throw new Error(`postgresConnStr env variable not set`);
    }

    DBConnection.#instance = new DBConnection(process.env.postgresConnStr);
    return DBConnection.#instance;
  }

  getSequelize(): Sequelize {
    return this.#sequelize;
  }

  async init({ alter = false } = {}) {
    if (DBConnection.#isInitialized === true) {
      logger.info('DB already initialized.');
      return;
    }
    await this.#sequelize.authenticate();
    logger.info('Connection has been verified.');

    await connectToPortfolioDB(this.#sequelize, this.portfolio_backend);
    await connectToSplitDB(this.#sequelize, this.split_backend);
    await this.#sequelize.sync({ alter: alter });
    await this.#createIndexes({ alter: alter });

    logger.info('Database Sync Done for all DB');

    DBConnection.#isInitialized = true;
  }

  async #createIndexes({ alter = false }) {
    if (alter === false) return;
    const psql: Sequelize = this.#sequelize;
    await psql.query(
      'create unique index if not exists users_user_email on portfolio_backend.users (user_email)'
    );
    await psql.query(
      'create index if not exists certificates_user_id on portfolio_backend.certificates (user_id)'
    );
    await psql.query(
      'create index if not exists education_user_id on portfolio_backend.education (user_id)'
    );
    await psql.query(
      'create index if not exists projects_user_id on portfolio_backend.projects (user_id)'
    );
    await psql.query(
      'create index if not exists skills_user_id on portfolio_backend.skills (user_id)'
    );
    await psql.query(
      'create index if not exists work_experiences_user_id on portfolio_backend.work_experiences (user_id)'
    );

    await psql.query(
      'create index if not exists groups_name on split_backend.groups (name)'
    );
    await psql.query(
      'create index if not exists users_group_id on split_backend.users (group_id)'
    );
    await psql.query(
      'create index if not exists transactions_by on split_backend.transactions (by)'
    );
    await psql.query(
      'create index if not exists transaction_parts_transaction_id on split_backend.transaction_parts (transaction_id)'
    );
    await psql.query(
      'create index if not exists transaction_parts_user_id on split_backend.transaction_parts (user_id)'
    );
  }
}

const db: DBConnection = DBConnection.getInstance();

export default db;
export { DBConnection, parseBigInt };
