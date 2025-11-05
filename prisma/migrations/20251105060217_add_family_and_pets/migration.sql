-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "phoneNumber" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT DEFAULT 'US',
    "maritalStatus" TEXT,
    "dependents" INTEGER DEFAULT 0,
    "occupation" TEXT,
    "employer" TEXT,
    "industry" TEXT,
    "yearsOfExperience" INTEGER,
    "educationLevel" TEXT,
    "skills" TEXT,
    "linkedInUrl" TEXT,
    "websiteUrl" TEXT,
    "incomeRange" TEXT,
    "netWorthRange" TEXT,
    "financialGoals" TEXT,
    "riskTolerance" TEXT,
    "retirementAge" INTEGER,
    "healthStatus" TEXT,
    "fitnessLevel" TEXT,
    "fitnessGoals" TEXT,
    "dietaryPreferences" TEXT,
    "medicalConditions" TEXT,
    "bio" TEXT,
    "interests" TEXT,
    "hobbies" TEXT,
    "values" TEXT,
    "lifeGoals" TEXT,
    "profileCompletion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plaid_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plaid_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plaid_accounts" (
    "id" TEXT NOT NULL,
    "plaidItemId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "officialName" TEXT,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "mask" TEXT,
    "currentBalance" DOUBLE PRECISION,
    "availableBalance" DOUBLE PRECISION,
    "limit" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plaid_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plaid_transactions" (
    "id" TEXT NOT NULL,
    "plaidItemId" TEXT NOT NULL,
    "plaidAccountId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "merchantName" TEXT,
    "category" TEXT[],
    "pending" BOOLEAN NOT NULL DEFAULT false,
    "paymentChannel" TEXT,
    "transactionType" TEXT,
    "isoCurrencyCode" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plaid_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "nickname" TEXT,
    "relationship" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "bloodType" TEXT,
    "allergies" TEXT,
    "medications" TEXT,
    "medicalNotes" TEXT,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "occupation" TEXT,
    "employer" TEXT,
    "school" TEXT,
    "grade" TEXT,
    "photoUrl" TEXT,
    "notes" TEXT,
    "favoriteThings" JSONB,
    "isDependent" BOOLEAN NOT NULL DEFAULT false,
    "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "breed" TEXT,
    "color" TEXT,
    "gender" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "adoptionDate" TIMESTAMP(3),
    "age" INTEGER,
    "weight" DOUBLE PRECISION,
    "weightUnit" TEXT DEFAULT 'lbs',
    "microchipNumber" TEXT,
    "vetName" TEXT,
    "vetPhone" TEXT,
    "vetEmail" TEXT,
    "vetAddress" TEXT,
    "allergies" TEXT,
    "medications" TEXT,
    "medicalConditions" TEXT,
    "medicalNotes" TEXT,
    "feedingSchedule" JSONB,
    "exerciseNeeds" TEXT,
    "specialNeeds" TEXT,
    "behaviorNotes" TEXT,
    "photoUrl" TEXT,
    "photos" TEXT[],
    "insuranceProvider" TEXT,
    "insurancePolicyNumber" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isServiceAnimal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_appointments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyMemberId" TEXT,
    "petId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "providerName" TEXT,
    "facilityName" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "phone" TEXT,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "duration" INTEGER,
    "timezone" TEXT DEFAULT 'UTC',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "reminderTime" TIMESTAMP(3),
    "reason" TEXT,
    "notes" TEXT,
    "cost" DOUBLE PRECISION,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "insuranceClaimed" BOOLEAN NOT NULL DEFAULT false,
    "documents" TEXT[],
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "recurrenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "family_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "calendarConnectionId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "attendees" TEXT,
    "recurrence" TEXT,
    "reminderMinutes" INTEGER,
    "meetingLink" TEXT,
    "calendarName" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_network_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "profileUrl" TEXT,
    "profileImageUrl" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_network_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_network_metrics" (
    "id" TEXT NOT NULL,
    "socialNetworkConnectionId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "postsCount" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION,
    "impressions" INTEGER,
    "reach" INTEGER,
    "profileViews" INTEGER,
    "linkClicks" INTEGER,
    "estimatedValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_network_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_network_followers" (
    "id" TEXT NOT NULL,
    "socialNetworkConnectionId" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "profileUrl" TEXT,
    "followerCount" INTEGER,
    "verifiedStatus" BOOLEAN NOT NULL DEFAULT false,
    "influenceScore" DOUBLE PRECISION,
    "industry" TEXT,
    "location" TEXT,
    "bio" TEXT,
    "engagementRate" DOUBLE PRECISION,
    "lastInteraction" TIMESTAMP(3),
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_network_followers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_value_insights" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "insightType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "score" INTEGER,
    "recommendations" TEXT,
    "dataPoints" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "network_value_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE INDEX "user_profiles_userId_idx" ON "user_profiles"("userId");

-- CreateIndex
CREATE INDEX "plaid_items_userId_idx" ON "plaid_items"("userId");

-- CreateIndex
CREATE INDEX "plaid_items_status_idx" ON "plaid_items"("status");

-- CreateIndex
CREATE UNIQUE INDEX "plaid_items_userId_itemId_key" ON "plaid_items"("userId", "itemId");

-- CreateIndex
CREATE INDEX "plaid_accounts_plaidItemId_idx" ON "plaid_accounts"("plaidItemId");

-- CreateIndex
CREATE UNIQUE INDEX "plaid_accounts_plaidItemId_accountId_key" ON "plaid_accounts"("plaidItemId", "accountId");

-- CreateIndex
CREATE INDEX "plaid_transactions_plaidItemId_idx" ON "plaid_transactions"("plaidItemId");

-- CreateIndex
CREATE INDEX "plaid_transactions_plaidAccountId_idx" ON "plaid_transactions"("plaidAccountId");

-- CreateIndex
CREATE INDEX "plaid_transactions_date_idx" ON "plaid_transactions"("date");

-- CreateIndex
CREATE UNIQUE INDEX "plaid_transactions_plaidItemId_transactionId_key" ON "plaid_transactions"("plaidItemId", "transactionId");

-- CreateIndex
CREATE INDEX "family_members_userId_idx" ON "family_members"("userId");

-- CreateIndex
CREATE INDEX "family_members_relationship_idx" ON "family_members"("relationship");

-- CreateIndex
CREATE INDEX "family_members_isActive_idx" ON "family_members"("isActive");

-- CreateIndex
CREATE INDEX "pets_userId_idx" ON "pets"("userId");

-- CreateIndex
CREATE INDEX "pets_species_idx" ON "pets"("species");

-- CreateIndex
CREATE INDEX "pets_isActive_idx" ON "pets"("isActive");

-- CreateIndex
CREATE INDEX "family_appointments_userId_idx" ON "family_appointments"("userId");

-- CreateIndex
CREATE INDEX "family_appointments_familyMemberId_idx" ON "family_appointments"("familyMemberId");

-- CreateIndex
CREATE INDEX "family_appointments_petId_idx" ON "family_appointments"("petId");

-- CreateIndex
CREATE INDEX "family_appointments_appointmentDate_idx" ON "family_appointments"("appointmentDate");

-- CreateIndex
CREATE INDEX "family_appointments_status_idx" ON "family_appointments"("status");

-- CreateIndex
CREATE INDEX "family_appointments_type_idx" ON "family_appointments"("type");

-- CreateIndex
CREATE INDEX "calendar_connections_userId_idx" ON "calendar_connections"("userId");

-- CreateIndex
CREATE INDEX "calendar_connections_provider_idx" ON "calendar_connections"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connections_userId_provider_email_key" ON "calendar_connections"("userId", "provider", "email");

-- CreateIndex
CREATE INDEX "calendar_events_calendarConnectionId_idx" ON "calendar_events"("calendarConnectionId");

-- CreateIndex
CREATE INDEX "calendar_events_startTime_idx" ON "calendar_events"("startTime");

-- CreateIndex
CREATE INDEX "calendar_events_status_idx" ON "calendar_events"("status");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_calendarConnectionId_eventId_key" ON "calendar_events"("calendarConnectionId", "eventId");

-- CreateIndex
CREATE INDEX "social_network_connections_userId_idx" ON "social_network_connections"("userId");

-- CreateIndex
CREATE INDEX "social_network_connections_platform_idx" ON "social_network_connections"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "social_network_connections_userId_platform_username_key" ON "social_network_connections"("userId", "platform", "username");

-- CreateIndex
CREATE INDEX "social_network_metrics_socialNetworkConnectionId_idx" ON "social_network_metrics"("socialNetworkConnectionId");

-- CreateIndex
CREATE INDEX "social_network_metrics_date_idx" ON "social_network_metrics"("date");

-- CreateIndex
CREATE INDEX "social_network_followers_socialNetworkConnectionId_idx" ON "social_network_followers"("socialNetworkConnectionId");

-- CreateIndex
CREATE INDEX "social_network_followers_influenceScore_idx" ON "social_network_followers"("influenceScore");

-- CreateIndex
CREATE UNIQUE INDEX "social_network_followers_socialNetworkConnectionId_follower_key" ON "social_network_followers"("socialNetworkConnectionId", "followerId");

-- CreateIndex
CREATE INDEX "network_value_insights_userId_idx" ON "network_value_insights"("userId");

-- CreateIndex
CREATE INDEX "network_value_insights_platform_idx" ON "network_value_insights"("platform");

-- CreateIndex
CREATE INDEX "network_value_insights_generatedAt_idx" ON "network_value_insights"("generatedAt");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plaid_items" ADD CONSTRAINT "plaid_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plaid_accounts" ADD CONSTRAINT "plaid_accounts_plaidItemId_fkey" FOREIGN KEY ("plaidItemId") REFERENCES "plaid_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plaid_transactions" ADD CONSTRAINT "plaid_transactions_plaidItemId_fkey" FOREIGN KEY ("plaidItemId") REFERENCES "plaid_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plaid_transactions" ADD CONSTRAINT "plaid_transactions_plaidAccountId_fkey" FOREIGN KEY ("plaidAccountId") REFERENCES "plaid_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_appointments" ADD CONSTRAINT "family_appointments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_appointments" ADD CONSTRAINT "family_appointments_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "family_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_appointments" ADD CONSTRAINT "family_appointments_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_calendarConnectionId_fkey" FOREIGN KEY ("calendarConnectionId") REFERENCES "calendar_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_network_connections" ADD CONSTRAINT "social_network_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_network_metrics" ADD CONSTRAINT "social_network_metrics_socialNetworkConnectionId_fkey" FOREIGN KEY ("socialNetworkConnectionId") REFERENCES "social_network_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_network_followers" ADD CONSTRAINT "social_network_followers_socialNetworkConnectionId_fkey" FOREIGN KEY ("socialNetworkConnectionId") REFERENCES "social_network_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_value_insights" ADD CONSTRAINT "network_value_insights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
