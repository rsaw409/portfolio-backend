import { QueryTypes, Sequelize } from 'sequelize';
import DB from '../../../postgres.js';
import { User } from '../../../types/portfolio.js';

const psql: Sequelize = DB.getSequelize();
const schemaname: string = DB.portfolio_backend;

const getuser = async (email: string, name?: string): Promise<User> => {
  if (name) {
    const [user] = await psql.models.users.findOrCreate({
      where: { user_email: email },
      defaults: { user_email: email, name: name },
    });
    return user as unknown as User;
  } else {
    const user = await psql.models.users.findOne({
      where: { user_email: email },
    });
    return user as unknown as User;
  }
};

const addOrUpdateUser = async (
  { user_email, name, about, profile_url, social_links }: User,
  user_id: number
) => {
  const dbUser: any = await psql.models.users.findOne({
    where: { user_email: user_email, id: user_id },
  })!;

  let dataChange = false;

  if (name && name !== dbUser.name) {
    dbUser.name = name;
    dataChange = true;
  }
  if (about && about !== dbUser.about) {
    dbUser.about = about;
    dataChange = true;
  }
  if (profile_url && profile_url !== dbUser.profile_url) {
    dbUser.profile_url = profile_url;
    dataChange = true;
  }

  if (social_links && social_links !== dbUser.social_links) {
    dbUser.social_links = social_links;
    dataChange = true;
  }

  if (dataChange) {
    await dbUser.save();
  }

  return dbUser;
};

const getUserIdFromEmail = async (email: string) => {
  const query = `select id from ${schemaname}.users where user_email = :email`;
  const res: Array<{ id: number }> = await psql.query(query, {
    type: QueryTypes.SELECT,
    replacements: { email },
    raw: true,
  });
  return res[0]?.id;
};

const findOrCreateUser = async ({
  email,
  name,
}: {
  email: string;
  name: string;
}) => {
  return psql.models.users.findOrCreate({
    where: { user_email: email },
    defaults: {
      user_email: email,
      name: name,
    },
  });
};

export { getuser, addOrUpdateUser, getUserIdFromEmail, findOrCreateUser };
