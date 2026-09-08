import Joi from 'joi';
import { strongPassword } from '../common.validator';

const sharedEmail = Joi.string().email().lowercase().trim();

export const userSignupSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().required().messages({
    'string.empty': 'Name is required.',
    'string.min': 'Name must be at least 2 characters long.',
    'any.required': 'Name is required.',
  }),
  email: sharedEmail.required().messages({
    'string.empty': 'Email is required.',
    'string.email': 'Please enter a valid email address.',
    'any.required': 'Email is required.',
  }),
  password: strongPassword.required().messages({
    'string.empty': 'Password is required.',
    'any.required': 'Password is required.',
  }),
});

export const userLoginSchema = Joi.object({
  email: sharedEmail.required().messages({
    'string.empty': 'Email is required.',
    'string.email': 'Please enter a valid email address.',
    'any.required': 'Email is required.',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required.',
    'any.required': 'Password is required.',
  }),
});
