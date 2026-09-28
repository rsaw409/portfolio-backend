import { DataTypes, Sequelize } from 'sequelize';

const createTransactionModel = (sequelize: Sequelize, schema: string) => {
  const Transaction = sequelize.define(
    'Transaction',
    {
      by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      // In the group currency's minor unit (paise for INR). BIGINT comes back from node-postgres as a number; see the
      // INT8 type parser in src/postgres.ts.
      amount: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING,
      },
      // One key per written row, supplied by the client. The unique index on
      // this column is what stops a retry writing the same expense twice.
      // Postgres treats NULLs as distinct, so clients that send no key are
      // unaffected and keep the old at-least-once behaviour.
      idempotency_key: {
        type: DataTypes.STRING,
      },
    },
    {
      schema,
      timestamps: true,
      underscored: true,
      tableName: 'transactions',
      // sync() adds this to an existing table too, and skips it where an
      // index of this name already exists.
      indexes: [
        {
          name: 'transactions_idempotency_key',
          unique: true,
          fields: ['idempotency_key'],
        },
      ],
    }
  );
  return Transaction;
};

export default createTransactionModel;
