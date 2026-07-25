import { DataTypes, Sequelize, Model, Optional } from 'sequelize';
import { Skill } from '../../../types/portfolio.js';

interface SkillCreationAttributes extends Optional<Skill, 'id'> {}

const createSkillModel = (sequelize: Sequelize, schema: string) => {
  return sequelize.define<Model<Skill, SkillCreationAttributes>>(
    'skills',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      skill_name: { type: DataTypes.STRING, allowNull: false },
      skill_category: { type: DataTypes.STRING, defaultValue: 'Misc' },
      skill_proficiency: {
        type: DataTypes.INTEGER,
        validate: {
          min: 0,
          max: 100,
        },
      },
    },
    {
      schema,
      timestamps: false,
    }
  );
};

export default createSkillModel;
