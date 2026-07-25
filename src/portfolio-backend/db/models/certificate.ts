import { DataTypes, Sequelize, Model, Optional } from 'sequelize';
import { Certificate } from '../../../types/portfolio.js';

interface CertificateCreationAttributes extends Optional<Certificate, 'id'> {}

const createCertificateModel = (sequelize: Sequelize, schema: string) => {
  return sequelize.define<Model<Certificate, CertificateCreationAttributes>>(
    'certificates',
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
      certificate_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      certificate_description: { type: DataTypes.STRING, defaultValue: 'N/A' },

      certification_authority: { type: DataTypes.STRING },

      certification_date: { type: DataTypes.DATEONLY },
      certification_expiry: { type: DataTypes.DATEONLY },

      verification_url: { type: DataTypes.STRING },

      // eg values. eg- AWS, Javascript
      technology_tags: { type: DataTypes.ARRAY(DataTypes.STRING) },
    },
    {
      schema,
      timestamps: false,
    }
  );
};

export default createCertificateModel;
