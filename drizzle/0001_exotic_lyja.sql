-- Dropping the FK to allow for sharding and separating the order table from users.
-- This denormalizes the user but allows Order to be a full entity and prevents the need for cross shard transactions.
ALTER TABLE "orders" DROP CONSTRAINT "orders_user_id_users_id_fk";
