import { DataTypes, Sequelize } from 'sequelize';

const createTransactionPartModel = (sequelize: Sequelize, schema: string) => {
  const TransactionPart = sequelize.define(
    'TransactionPart',
    {
      user_id: {
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
      transaction_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'transactions',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
    },
    {
      schema,
      timestamps: true,
      underscored: true,
      tableName: 'transaction_parts',
    }
  );
  return TransactionPart;
};

export default createTransactionPartModel;
