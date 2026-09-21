-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('GOLD', 'USD', 'EUR', 'CAR', 'STOCK', 'CRYPTO', 'PROPERTY', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('QUANTITY', 'FIXED');

-- CreateEnum
CREATE TYPE "ValuationSource" AS ENUM ('INITIAL', 'MANUAL');

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "owner" "Owner" NOT NULL,
    "quantity" BIGINT NOT NULL DEFAULT 100000000,
    "unit" TEXT,
    "purchaseUnitPrice" BIGINT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_valuations" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "unitPrice" BIGINT NOT NULL,
    "quantity" BIGINT NOT NULL,
    "value" BIGINT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "source" "ValuationSource" NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assets_isActive_idx" ON "assets"("isActive");

-- CreateIndex
CREATE INDEX "assets_owner_idx" ON "assets"("owner");

-- CreateIndex
CREATE INDEX "assets_type_idx" ON "assets"("type");

-- CreateIndex
CREATE INDEX "asset_valuations_assetId_asOf_idx" ON "asset_valuations"("assetId", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "asset_valuations_assetId_asOf_key" ON "asset_valuations"("assetId", "asOf");

-- AddForeignKey
ALTER TABLE "asset_valuations" ADD CONSTRAINT "asset_valuations_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariants the API also enforces, restated here so no path can write a bad
-- row: not a migration, not a psql session, not a future feature that forgets.

-- You cannot hold a negative amount of something, and zero of it is not a
-- holding. A negative quantity would silently flip the sign of a valuation.
ALTER TABLE "assets"
  ADD CONSTRAINT "assets_quantity_positive" CHECK ("quantity" > 0);

-- Money paid is never negative; rule G.2 keeps direction out of the number.
ALTER TABLE "assets"
  ADD CONSTRAINT "assets_purchase_price_non_negative"
  CHECK ("purchaseUnitPrice" >= 0);

-- A fixed-value asset is one thing, not a per-unit holding: exactly one of
-- it, and no unit label to count it in.
ALTER TABLE "assets"
  ADD CONSTRAINT "assets_fixed_shape"
  CHECK ("kind" <> 'FIXED' OR ("quantity" = 100000000 AND "unit" IS NULL));

-- A per-unit holding has to say what the unit is, or "18" means nothing.
ALTER TABLE "assets"
  ADD CONSTRAINT "assets_quantity_shape"
  CHECK ("kind" <> 'QUANTITY' OR "unit" IS NOT NULL);

ALTER TABLE "asset_valuations"
  ADD CONSTRAINT "asset_valuations_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "asset_valuations"
  ADD CONSTRAINT "asset_valuations_unit_price_non_negative"
  CHECK ("unitPrice" >= 0);

-- A valuation's stored total must be the product it claims to be, to within
-- the Rial the rounding is allowed to move it. Without this the history table
-- could carry a total that matches neither its price nor its quantity, and
-- nothing downstream would ever notice.
--
-- Cast to numeric first: the product of a Rial price and a 10^8-scaled
-- quantity leaves bigint's range at around 900 million Toman, which a flat in
-- Tehran passes comfortably. numeric is arbitrary precision, so the check
-- cannot itself become the thing that rejects a valid row.
ALTER TABLE "asset_valuations"
  ADD CONSTRAINT "asset_valuations_value_matches_product"
  CHECK (
    abs(
      "value"::numeric - "unitPrice"::numeric * "quantity"::numeric / 100000000
    ) <= 1
  );
