-- DropIndex
DROP INDEX "order_items_orderId_idx";

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "order_items_orderId_position_idx" ON "order_items"("orderId", "position");
