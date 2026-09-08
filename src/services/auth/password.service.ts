import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export class PasswordService {
  private static readonly SALT_ROUNDS = 10;

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  static hashOTP(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  static verifyOTP(otp: string, hash: string): boolean {
    const otpHash = this.hashOTP(otp);
    return otpHash === hash;
  }
}
