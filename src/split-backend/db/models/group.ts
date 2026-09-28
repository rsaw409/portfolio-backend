import { DataTypes, Sequelize } from 'sequelize';

const createGroupModel = (sequelize: Sequelize, schema: string) => {
  const User = sequelize.define(
    'Group',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      // ISO 4217 code. Display metadata only: amounts stay in the minor unit
      // (paise for INR) whatever the currency.
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'INR',
      },
      // Same contract as transactions.idempotency_key: the unique index stops
      // a retried createGroup making a second group, and NULLs never collide.
      idempotency_key: {
        type: DataTypes.STRING,
      },
    },
    {
      schema,
      timestamps: true,
      underscored: true,
      tableName: 'groups',
      indexes: [
        {
          name: 'groups_idempotency_key',
          unique: true,
          fields: ['idempotency_key'],
        },
      ],
    }
  );
  return User;
};

export default createGroupModel;
