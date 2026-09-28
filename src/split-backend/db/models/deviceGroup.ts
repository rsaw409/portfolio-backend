import { DataTypes, Sequelize } from 'sequelize';

/**
 * Which OneSignal subscriptions (one per app install) follow which groups. The
 * backend reads this to decide who a group's notifications go to.
 */
const createDeviceGroupModel = (sequelize: Sequelize, schema: string) => {
  const DeviceGroup = sequelize.define(
    'DeviceGroup',
    {
      subscription_id: {
        type: DataTypes.TEXT,
        allowNull: false,
        primaryKey: true,
      },
      group_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'groups',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
    },
    {
      schema,
      // updated_at only: it records when the device last confirmed the group.
      timestamps: true,
      createdAt: false,
      underscored: true,
      tableName: 'device_groups',
      // Notifications look devices up by group.
      indexes: [{ name: 'device_groups_group_id', fields: ['group_id'] }],
    }
  );
  return DeviceGroup;
};

export default createDeviceGroupModel;
