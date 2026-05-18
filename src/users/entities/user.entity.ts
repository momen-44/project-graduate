import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ActivityLevelEnum } from '../../common/enums/activity-level.enum';
import { DietaryPreferenceEnum } from '../../common/enums/dietary-preference.enum';
import { GenderEnum } from '../../common/enums/gender.enum';
import { FoodRequest } from '../../food/entities/food-request.entity';
import { DailyCalculation } from '../../calories/daily-calculation.entity';
import { PasswordReset } from '../../auth/entities/password-reset.entity';
import { MetabolismRate } from '../../common/enums/MetabolismRate.enum';

@Entity('users')
@Index('UQ_users_email', ['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'int', nullable: true })
  age!: number | null;

  @Column({ type: 'enum', enum: GenderEnum, nullable: true })
  gender!: GenderEnum | null;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  height!: number | null;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  weight!: number | null;

  @Column({
    type: 'enum',
    enum: ActivityLevelEnum,
    nullable: true,
    name: 'activity_level',
  })
  activityLevel!: ActivityLevelEnum | null;

  @Column({
    type: 'enum',
    enum: MetabolismRate,
    default: MetabolismRate.NORMAL,
  })
  metabolismRate!: MetabolismRate;

  @Column({
    type: 'enum',
    enum: DietaryPreferenceEnum,
    nullable: true,
    name: 'dietary_preference',
  })
  dietaryPreference!: DietaryPreferenceEnum | null;

  @Column({ type: 'text', nullable: true, name: 'profile_image_url' })
  profileImageUrl!: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'profile_image_public_id',
  })
  profileImagePublicId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => FoodRequest, (foodRequest) => foodRequest.user)
  foodRequests!: FoodRequest[];

  @OneToMany(
    () => DailyCalculation,
    (dailyCalculation) => dailyCalculation.user,
  )
  dailyCalculations!: DailyCalculation[];

  @OneToMany(() => PasswordReset, (passwordReset) => passwordReset.user)
  passwordResets!: PasswordReset[];
}
