-- AlterTable
ALTER TABLE `events` ADD COLUMN `category` VARCHAR(191) NULL,
    ADD COLUMN `cover_color_1` VARCHAR(191) NULL,
    ADD COLUMN `cover_color_2` VARCHAR(191) NULL,
    ADD COLUMN `description` TEXT NULL;

-- AlterTable
ALTER TABLE `ticket_tiers` ADD COLUMN `color` VARCHAR(191) NULL,
    ADD COLUMN `tier_key` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `role` VARCHAR(191) NOT NULL DEFAULT 'user';

-- AlterTable
ALTER TABLE `venues` ADD COLUMN `city` VARCHAR(191) NULL;
