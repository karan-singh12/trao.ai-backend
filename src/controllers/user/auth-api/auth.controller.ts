import { Request, Response } from 'express';
import { userRepository } from '../../../repositories/user';
import { PasswordService } from '../../../services/auth/password.service';
import { TokenService } from '../../../services/auth/token.service';
import * as apiRes from '../../../utils/apiResponse';
import { USER } from '../../../utils/responseMssg';

export const signUp = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, email, password } = req.body;

    const exists = await userRepository.existsByEmail(email);
    if (exists) {
      return apiRes.conflictResponse(res, USER.emailAlreadyExists);
    }

    const hashedPassword = await PasswordService.hashPassword(password);
    const user = await userRepository.create({
      name,
      email,
      password: hashedPassword,
    });

    const userId = user._id.toString();
    const { token } = TokenService.generateAccessToken(userId, user.email, user.role);

    return apiRes.createdResponse(res, USER.singUpSuccess, {
      token,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return apiRes.errorResponse(res, error);
  }
};

export const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body;

    const user = await userRepository.findWithPassword(email);
    if (!user) {
      return apiRes.unauthorizedResponse(res, USER.invalidLogin);
    }

    if (!user.isActive) {
      return apiRes.forbiddenResponse(res, USER.accountDeactivated);
    }

    const isMatch = await PasswordService.verifyPassword(password, user.password);
    if (!isMatch) {
      return apiRes.unauthorizedResponse(res, USER.invalidLogin);
    }

    const userId = user._id.toString();
    const { token } = TokenService.generateAccessToken(userId, user.email, user.role);

    return apiRes.successResponse(res, USER.loginSuccess, {
      token,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return apiRes.errorResponse(res, error);
  }
};
