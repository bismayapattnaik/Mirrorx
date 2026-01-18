import { describe, it, expect, vi } from 'vitest';
import { signupSchema, loginSchema, updateProfileSchema } from '@mirrorx/shared';

describe('Auth Validation Schemas', () => {
  describe('Signup Schema', () => {
    it('should validate correct signup data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const result = signupSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'not-an-email',
        password: 'password123',
      };

      const result = signupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'short',
      };

      const result = signupSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should allow signup without name', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = signupSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('Login Schema', () => {
    it('should validate correct login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '',
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Update Profile Schema', () => {
    it('should validate phone number', () => {
      const validData = {
        name: 'Updated Name',
        phone: '9876543210',
      };

      const result = updateProfileSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid Indian phone number', () => {
      const invalidData = {
        phone: '1234567890', // Does not start with 6-9
      };

      const result = updateProfileSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should allow empty update', () => {
      const result = updateProfileSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});
