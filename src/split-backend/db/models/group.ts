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
      // How many decimals `currency`'s minor unit has (2 for INR, 0 for JPY):
      // the scale of every amount in this group. Set by the server from the
      // currency, and changed only along with it.
      currency_decimals: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 2,
      },
      // Emoji and colour name the app draws the group's icon with. The app owns
      // the list of both; NULL for groups made before icons.
      icon: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      icon_color: {
        type: DataTypes.TEXT,
        allowNull: true,
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
