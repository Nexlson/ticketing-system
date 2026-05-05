/*
  Warnings:

  - You are about to drop the column `lock_expires_at` on the `tickets` table. All the data in the column will be lost.
  - You are about to drop the column `locked_by_user_id` on the `tickets` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `tickets` DROP FOREIGN KEY `tickets_locked_by_user_id_fkey`;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `payment_reference_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `tickets` DROP COLUMN `lock_expires_at`,
    DROP COLUMN `locked_by_user_id`;
