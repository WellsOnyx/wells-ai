#!/bin/bash

# Create NextAuth migration for Wells AI
# This script creates the database migration for NextAuth tables

echo "Creating NextAuth database migration..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL environment variable is not set"
  echo "Please set it in your .env file or .env.local"
  exit 1
fi

# Run Prisma migration
npx prisma migrate dev --name add_nextauth_tables

if [ $? -eq 0 ]; then
  echo "✅ NextAuth migration created successfully!"
  echo ""
  echo "Next steps:"
  echo "1. Review the migration in prisma/migrations/"
  echo "2. Generate Prisma client: npx prisma generate"
  echo "3. Test authentication: npm run dev"
else
  echo "❌ Migration failed. Please check your database connection."
  exit 1
fi
