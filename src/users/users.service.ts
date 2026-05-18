import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async createUser(payload: Partial<User>): Promise<User> {
    const user = this.userRepository.create(payload);
    return this.userRepository.save(user);
  }

  async saveUser(user: User): Promise<User> {
    return this.userRepository.save(user);
  }

  async getMe(userId: string): Promise<Record<string, unknown>> {
    const user = await this.findById(userId);
    return this.toSafeUser(user);
  }

  async updateProfile(
    userId: string,
    dto: UpdateUserDto,
  ): Promise<Record<string, unknown>> {
    const user = await this.findById(userId);

    Object.assign(user, {
      name: dto.name ?? user.name,
      age: dto.age ?? user.age,
      gender: dto.gender ?? user.gender,
      height: dto.height ?? user.height,
      weight: dto.weight ?? user.weight,
      activityLevel: dto.activityLevel ?? user.activityLevel,
      metabolismRate: dto.metabolismRate ?? user.metabolismRate,
      dietaryPreference: dto.dietaryPreference ?? user.dietaryPreference,
      profileImageUrl: dto.profileImageUrl ?? user.profileImageUrl,
      profileImagePublicId:
        dto.profileImagePublicId ?? user.profileImagePublicId,
    });

    const updatedUser = await this.userRepository.save(user);
    return this.toSafeUser(updatedUser);
  }

  async removeById(
    targetUserId: string,
    requesterUserId: string,
  ): Promise<{ message: string }> {
    if (targetUserId !== requesterUserId) {
      throw new ForbiddenException('You can only delete your own account');
    }

    const user = await this.findById(targetUserId);
    await this.userRepository.remove(user);

    return { message: 'User deleted successfully' };
  }

  toSafeUser(user: User): Record<string, unknown> {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      age: user.age,
      gender: user.gender,
      height: user.height,
      weight: user.weight,
      activityLevel: user.activityLevel,
      metabolismRate: user.metabolismRate,
      dietaryPreference: user.dietaryPreference,
      profileImageUrl: user.profileImageUrl,
      profileImagePublicId: user.profileImagePublicId,
      createdAt: user.createdAt,
    };
  }
}
