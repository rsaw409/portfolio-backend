import { vi, describe, test, expect, beforeEach } from 'vitest';
import { Sequelize } from 'sequelize';
import { ErrorMessage } from '../../../../../src/@rsaw409/constant.js';

// Never connects: it only builds models and renders SQL.
const sequelize = new Sequelize('postgres://u:p@localhost:5432/db', {
  logging: false,
});
const { default: createUserModel } =
  await import('../../../../../src/split-backend/db/models/user.js');
const User = createUserModel(sequelize, 'split_backend');

vi.mock('../../../../../src/postgres.js', () => {
  return {
    default: {
      getSequelize: vi.fn(() => sequelize),
      split_backend: 'split_backend',
      portfolio_backend: 'portfolio_backend',
    },
  };
});

const { createUser, updateUser } =
  await import('../../../../../src/split-backend/db/queries/user.js');

const findOne = vi.spyOn(User, 'findOne');
const create = vi.spyOn(User, 'create');
const findByPk = vi.spyOn(User, 'findByPk');

/** The WHERE clause the duplicate-name check would send to Postgres. */
const renderedWhere = () => {
  const [[options]] = findOne.mock.calls;
  // queryGenerator is untyped in Sequelize 6.
  const generator = (sequelize.getQueryInterface() as any).queryGenerator;
  return generator.whereQuery(options!.where, { model: User }) as string;
};

describe('createUser', () => {
  // Stubbed afresh each time: a reset spy would fall back to the real query.
  beforeEach(() => {
    findOne.mockReset().mockResolvedValue(null);
    create
      .mockReset()
      .mockImplementation(async (values: any) => User.build(values));
  });

  test('looks for an existing name case-insensitively, within the group', async () => {
    await createUser({ name: 'Rohit', group_id: 7 });
    expect(renderedWhere()).toBe(
      `WHERE lower("name") = lower('Rohit') AND "group_id" = 7`
    );
  });

  test('rejects a name already in the group in another case', async () => {
    findOne.mockResolvedValue(User.build({ name: 'rohit', group_id: 7 }));
    await expect(createUser({ name: 'ROHIT', group_id: 7 })).rejects.toThrow(
      'User Already Exists'
    );
    expect(create).not.toHaveBeenCalled();
  });

  test('creates the user when the name is new to the group', async () => {
    await createUser({ name: 'Rohit', group_id: 7, avatar: 'seed' });
    expect(create).toHaveBeenCalledWith({
      name: 'Rohit',
      avatar: 'seed',
      group_id: 7,
    });
  });
});

describe('updateUser', () => {
  const stored = () => {
    const user = User.build(
      { id: 3, group_id: 7, name: 'rohit', avatar: 'old' },
      { isNewRecord: false }
    );
    // Applies the change in memory instead of saving it.
    vi.spyOn(user, 'update').mockImplementation(async (values: any) =>
      user.set(values)
    );
    return user;
  };

  beforeEach(() => {
    findOne.mockReset().mockResolvedValue(null);
    findByPk.mockReset();
  });

  test('returns undefined for an unknown user', async () => {
    findByPk.mockResolvedValue(null);
    expect(await updateUser({ user_id: 404, name: 'Rohit' })).toBeUndefined();
    expect(findOne).not.toHaveBeenCalled();
  });

  test("looks for a namesake in the user's group, leaving the user out", async () => {
    const user = stored();
    findByPk.mockResolvedValue(user);
    // Only a case change of their own name, so no one else is found.
    const updated = await updateUser({ user_id: 3, name: 'Rohit' });
    expect(renderedWhere()).toBe(
      `WHERE lower("name") = lower('Rohit') AND "group_id" = 7 AND "id" != 3`
    );
    expect(user.update).toHaveBeenCalledWith({ name: 'Rohit' });
    expect(updated?.user.get()).toMatchObject({
      id: 3,
      name: 'Rohit',
      avatar: 'old',
    });
    // As it was before, so the caller can tell the name changed.
    expect(updated?.previous).toEqual({ name: 'rohit', avatar: 'old' });
  });

  test('rejects a name another user in the group has, in any case', async () => {
    const user = stored();
    findByPk.mockResolvedValue(user);
    findOne.mockResolvedValue(User.build({ id: 4, group_id: 7, name: 'Amit' }));
    await expect(updateUser({ user_id: 3, name: 'AMIT' })).rejects.toThrow(
      ErrorMessage.UserExists
    );
    expect(user.update).not.toHaveBeenCalled();
  });

  test('changes only the avatar when only the avatar is sent', async () => {
    const user = stored();
    findByPk.mockResolvedValue(user);
    const updated = await updateUser({ user_id: 3, avatar: 'new' });
    expect(findOne).not.toHaveBeenCalled();
    expect(user.update).toHaveBeenCalledWith({ avatar: 'new' });
    expect(updated?.user.get()).toMatchObject({
      name: 'rohit',
      avatar: 'new',
    });
    expect(updated?.previous).toEqual({ name: 'rohit', avatar: 'old' });
  });
});
