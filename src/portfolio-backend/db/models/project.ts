import { DataTypes, Sequelize, Model, Optional } from 'sequelize';

import { Project } from '../../../types/portfolio.js';

interface ProjectCreationAttributes extends Optional<Project, 'id'> {}

const createProjectModel = (sequelize: Sequelize, schema: string) => {
  return sequelize.define<Model<Project, ProjectCreationAttributes>>(
    'projects',
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
      project_name: { type: DataTypes.STRING, allowNull: false },
      project_description: { type: DataTypes.STRING, defaultValue: 'N/A' },

      github_url: { type: DataTypes.STRING },
      web_url: { type: DataTypes.STRING },
      play_store_url: { type: DataTypes.STRING },

      // values. eg- Node.js, React.js, Flutter
      technology_tags: { type: DataTypes.ARRAY(DataTypes.STRING) },
    },
    {
      schema,
      timestamps: false,
    }
  );
};

export default createProjectModel;
