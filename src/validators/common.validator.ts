import Joi from 'joi';

const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*[0-9])[a-zA-Z0-9!@#$%^&*()_+\-=[\]{}|\\:;"'<>,.?/]{6,15}$/;

export const strongPassword = Joi.string()
  .pattern(PASSWORD_REGEX)
  .messages({
    'string.pattern.base':
      'Password must be 6–15 characters long, include at least one letter and one number. Special characters are allowed.',
  });
