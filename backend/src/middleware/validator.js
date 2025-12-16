
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';


import { ErrorCodes } from '../utils/errorCodes.js';


export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errorCode: ErrorCodes.VALIDATION_ERROR,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      })),
      requestId: req.requestId
    });
  }
  next();
};

// Custom MongoDB ObjectId validator
export const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(value);
};

export const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('country')
    .trim()
    .notEmpty()
    .withMessage('Country is required')
];

export const loginValidation = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

export const submissionValidation = [
  body('url')
    .trim()
    .notEmpty()
    .withMessage('URL is required')
    .isURL()
    .withMessage('Please provide a valid URL'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('publisher')
    .trim()
    .notEmpty()
    .withMessage('Publisher is required')
    .isLength({ max: 100 })
    .withMessage('Publisher cannot exceed 100 characters'),
  body('country')
    .trim()
    .notEmpty()
    .withMessage('Country is required'),
  body('category')
    .isIn(['primary', 'secondary', 'unreliable'])
    .withMessage('Category must be primary, secondary, or unreliable')
];


export const verificationValidation = [
  body('status')
    .isIn(['approved', 'rejected'])
    .withMessage('Status must be approved or rejected'),
  body('verifierNotes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

export const batchOperationValidation = [
  body('action')
    .isIn(['approve', 'reject', 'delete', 'update'])
    .withMessage('Action must be approve, reject, delete, or update'),
  body('submissionIds')
    .optional()
    .isArray({ min: 1, max: 1000 })
    .withMessage('submissionIds must be an array with 1-1000 items'),

  body('submissionIds.*')
    .optional()
    .custom(isValidObjectId)
    .withMessage('Each submission ID must be a valid MongoDB ObjectId'),
  body('filters')
    .optional()
    .isObject()
    .withMessage('Filters must be an object'),
  body('filters.status')
    .optional()
    .isIn(['pending', 'approved', 'rejected'])
    .withMessage('Status filter must be pending, approved, or rejected'),
  body('filters.category')
    .optional()
    .isIn(['primary', 'secondary', 'unreliable'])
    .withMessage('Category filter must be primary, secondary, or unreliable'),
  body('filters.country')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Country filter cannot be empty'),
  body('filters.dateFrom')
    .optional()
    .isISO8601()
    .withMessage('DateFrom must be a valid ISO 8601 date'),
  body('filters.dateTo')
    .optional()
    .isISO8601()
    .withMessage('DateTo must be a valid ISO 8601 date'),
  body('updateData')
    .optional()
    .isObject()
    .withMessage('Update data must be an object'),
  body('updateData.credibility')
    .optional()
    .isIn(['credible', 'unreliable'])
    .withMessage('Credibility must be credible or unreliable'),
  body('updateData.verifierNotes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Verifier notes cannot exceed 500 characters'),
  body('updateData.category')
    .optional()
    .isIn(['primary', 'secondary', 'unreliable'])
    .withMessage('Category must be primary, secondary, or unreliable'),
  body('updateData.wikipediaArticle')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Wikipedia article cannot exceed 500 characters'),
  body('batchNotes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Batch notes cannot exceed 500 characters')
];

export const exportValidation = [
  body('format')
    .optional()
    .isIn(['csv', 'json'])
    .withMessage('Format must be csv or json'),
  body('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected'])
    .withMessage('Status filter must be pending, approved, or rejected'),
  body('category')
    .optional()
    .isIn(['primary', 'secondary', 'unreliable'])
    .withMessage('Category filter must be primary, secondary, or unreliable'),
  body('country')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Country filter cannot be empty'),
  body('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('DateFrom must be a valid ISO 8601 date'),
  body('dateTo')
    .optional()
    .isISO8601()
    .withMessage('DateTo must be a valid ISO 8601 date'),
  body('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term cannot exceed 100 characters'),

  body('submitter')
    .optional()
    .custom(isValidObjectId)
    .withMessage('Submitter must be a valid MongoDB ObjectId'),
  body('limit')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Limit must be between 1 and 10000'),
  body('offset')
    .optional()
    .isInt({ min: 0, max: 100000 })
    .withMessage('Offset must be between 0 and 100000')
];
