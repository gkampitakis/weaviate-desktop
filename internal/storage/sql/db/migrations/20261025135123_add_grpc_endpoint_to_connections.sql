-- migrate:up
ALTER TABLE "connections" ADD COLUMN "grpc_endpoint" TEXT;

-- migrate:down
ALTER TABLE "connections" DROP COLUMN "grpc_endpoint";
