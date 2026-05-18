import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixSessionsUserIdForeignKey1715170000001
  implements MigrationInterface
{
  name = 'FixSessionsUserIdForeignKey1715170000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old foreign key constraint if it exists
    await queryRunner.query(`
      ALTER TABLE sessions 
      DROP CONSTRAINT IF EXISTS "FK_57de40bc620f456c7311aa3a1e6";
    `);

    // Drop the old FK_sessions_user_id if it exists
    await queryRunner.query(`
      ALTER TABLE sessions 
      DROP CONSTRAINT IF EXISTS "FK_sessions_user_id";
    `);

    // Recreate the foreign key with CASCADE DELETE
    await queryRunner.query(`
      ALTER TABLE sessions 
      ADD CONSTRAINT FK_sessions_user_id 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to the original constraint (without CASCADE)
    await queryRunner.query(`
      ALTER TABLE sessions 
      DROP CONSTRAINT IF EXISTS "FK_sessions_user_id";
    `);

    // If you want to restore the old constraint name
    await queryRunner.query(`
      ALTER TABLE sessions 
      ADD CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6" 
      FOREIGN KEY (user_id) REFERENCES users(id);
    `);
  }
}
