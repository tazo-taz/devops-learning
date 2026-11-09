import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserAge1793964947540 implements MigrationInterface {
    name = 'AddUserAge1793964947540'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "age" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "age"`);
    }

}
