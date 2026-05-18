import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSessions1715170000000 implements MigrationInterface {
  name = 'CreateSessions1715170000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        refresh_token_hash text NOT NULL,
        refresh_token_fingerprint varchar(128) NOT NULL,
        device_id varchar(255),
        device_info text,
        ip varchar(100),
        user_agent text,
        issued_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT FK_sessions_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // ensure the column exists (safe if table partially created by previous runs)
    await queryRunner.query(
      `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS refresh_token_fingerprint varchar(128);`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS UQ_sessions_refresh_token_fingerprint ON sessions(refresh_token_fingerprint);`,
    );

    // ensure other indexed columns exist (safe if table partially created)
    await queryRunner.query(
      `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id uuid;`,
    );

    await queryRunner.query(
      `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz;`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_sessions_user_id ON sessions(user_id);`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_sessions_expires_at ON sessions(expires_at);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS IDX_sessions_expires_at;');
    await queryRunner.query('DROP INDEX IF EXISTS IDX_sessions_user_id;');
    await queryRunner.query(
      'DROP INDEX IF EXISTS UQ_sessions_refresh_token_fingerprint;',
    );
    await queryRunner.query('DROP TABLE IF EXISTS sessions;');
  }
}
