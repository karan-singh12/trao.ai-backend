import { User, IUserDocument } from '../../models/user';

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role?: 'user' | 'admin';
}

export const userRepository = {
  findByEmail: (email: string): Promise<IUserDocument | null> => {
    return User.findOne({ email: email.toLowerCase().trim() });
  },

  findWithPassword: (email: string): Promise<IUserDocument | null> => {
    return User.findOne({ email: email.toLowerCase().trim() }).select('+password');
  },

  findById: (id: string): Promise<IUserDocument | null> => {
    return User.findById(id);
  },

  existsByEmail: async (email: string): Promise<boolean> => {
    const found = await User.exists({ email: email.toLowerCase().trim() });
    return Boolean(found);
  },

  create: (data: CreateUserData): Promise<IUserDocument> => {
    return User.create({
      name: data.name.trim(),
      email: data.email.toLowerCase().trim(),
      password: data.password,
      role: data.role || 'user',
      isActive: true,
    });
  },
};

export const userDb = userRepository;
export default userRepository;
