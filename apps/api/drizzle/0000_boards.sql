CREATE TABLE "boards" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
