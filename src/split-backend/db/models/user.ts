import { DataTypes, Sequelize } from 'sequelize';

const createUserModel = (sequelize: Sequelize, schema: string) => {
  const User = sequelize.define(
    'User',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      avatar: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      group_id: {
        type: DataTypes.INTEGER,
        references: {
          model: 'groups',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
    },
    {
      schema,
      timestamps: true,
      underscored: true,
      tableName: 'users',
    }
  );
  return User;
};

export default createUserModel;
