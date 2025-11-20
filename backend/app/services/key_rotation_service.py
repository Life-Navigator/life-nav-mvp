"""
Key Rotation Service for Encryption Keys.

Features:
- Zero-downtime key rotation
- Batch processing with progress tracking
- Rollback capability
- Audit logging
- Multiple key versions support
"""

from datetime import datetime
from uuid import UUID

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import get_encryption_service
from app.models.user import User

logger = structlog.get_logger()


class KeyRotationService:
    """
    Service for rotating encryption keys.

    Supports zero-downtime rotation by:
    1. Generating new KEK
    2. Re-encrypting all DEKs with new KEK
    3. Keeping old KEK available for reads during transition
    4. Switching to new KEK for all operations
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.encryption_service = get_encryption_service()

    async def rotate_all_mfa_secrets(
        self,
        batch_size: int = 100,
    ) -> dict:
        """
        Rotate encryption keys for all MFA secrets.

        Process:
        1. Fetch users with MFA enabled in batches
        2. Re-encrypt each user's DEK with new KEK
        3. Update database
        4. Track progress and failures

        Args:
            batch_size: Number of users to process per batch

        Returns:
            Dictionary with rotation statistics
        """
        stats = {
            "total_users": 0,
            "processed": 0,
            "failed": 0,
            "skipped": 0,
            "start_time": datetime.utcnow(),
        }

        try:
            # Get total count
            count_query = select(User).where(
                User.mfa_enabled == True,
                User.mfa_secret_dek.isnot(None),
            )
            result = await self.db.execute(count_query)
            stats["total_users"] = len(result.all())

            logger.info(
                "key_rotation_started",
                total_users=stats["total_users"],
            )

            # Process in batches
            offset = 0
            while True:
                # Fetch batch
                query = (
                    select(User)
                    .where(
                        User.mfa_enabled == True,
                        User.mfa_secret_dek.isnot(None),
                    )
                    .limit(batch_size)
                    .offset(offset)
                )

                result = await self.db.execute(query)
                users = result.scalars().all()

                if not users:
                    break  # No more users to process

                # Process each user in batch
                for user in users:
                    try:
                        # Rotate DEK
                        success = user.rotate_mfa_encryption()

                        if success:
                            stats["processed"] += 1
                            logger.info(
                                "mfa_key_rotated",
                                user_id=str(user.id),
                            )
                        else:
                            stats["skipped"] += 1

                    except Exception as e:
                        stats["failed"] += 1
                        logger.error(
                            "mfa_key_rotation_failed",
                            user_id=str(user.id),
                            error=str(e),
                        )

                # Commit batch
                await self.db.commit()

                offset += batch_size

                # Log progress
                logger.info(
                    "key_rotation_progress",
                    processed=stats["processed"],
                    total=stats["total_users"],
                    percent=round((stats["processed"] / stats["total_users"]) * 100, 2),
                )

            stats["end_time"] = datetime.utcnow()
            stats["duration_seconds"] = (
                stats["end_time"] - stats["start_time"]
            ).total_seconds()

            logger.info(
                "key_rotation_completed",
                **stats,
            )

            return stats

        except Exception as e:
            logger.error("key_rotation_error", error=str(e))
            raise

    async def migrate_plaintext_to_encrypted(
        self,
        batch_size: int = 100,
    ) -> dict:
        """
        Migrate plaintext MFA secrets to encrypted storage.

        This is a one-time migration script to encrypt existing
        plaintext MFA secrets.

        Args:
            batch_size: Number of users to process per batch

        Returns:
            Migration statistics
        """
        stats = {
            "total_users": 0,
            "migrated": 0,
            "failed": 0,
            "already_encrypted": 0,
            "start_time": datetime.utcnow(),
        }

        try:
            # Get total count of users with plaintext MFA secrets
            count_query = select(User).where(
                User.mfa_enabled == True,
                User.mfa_secret.isnot(None),
                User.mfa_secret_encrypted.is_(None),  # Not yet encrypted
            )
            result = await self.db.execute(count_query)
            stats["total_users"] = len(result.all())

            logger.info(
                "mfa_migration_started",
                total_users=stats["total_users"],
            )

            # Process in batches
            offset = 0
            while True:
                # Fetch batch
                query = (
                    select(User)
                    .where(
                        User.mfa_enabled == True,
                        User.mfa_secret.isnot(None),
                        User.mfa_secret_encrypted.is_(None),
                    )
                    .limit(batch_size)
                    .offset(offset)
                )

                result = await self.db.execute(query)
                users = result.scalars().all()

                if not users:
                    break

                # Migrate each user
                for user in users:
                    try:
                        if user.mfa_secret:
                            # Encrypt the plaintext secret
                            user.set_mfa_secret(user.mfa_secret)
                            stats["migrated"] += 1

                            logger.info(
                                "mfa_secret_encrypted",
                                user_id=str(user.id),
                            )
                        else:
                            stats["already_encrypted"] += 1

                    except Exception as e:
                        stats["failed"] += 1
                        logger.error(
                            "mfa_migration_failed",
                            user_id=str(user.id),
                            error=str(e),
                        )

                # Commit batch
                await self.db.commit()

                offset += batch_size

                # Log progress
                if stats["total_users"] > 0:
                    logger.info(
                        "migration_progress",
                        migrated=stats["migrated"],
                        total=stats["total_users"],
                        percent=round(
                            (stats["migrated"] / stats["total_users"]) * 100, 2
                        ),
                    )

            stats["end_time"] = datetime.utcnow()
            stats["duration_seconds"] = (
                stats["end_time"] - stats["start_time"]
            ).total_seconds()

            logger.info(
                "mfa_migration_completed",
                **stats,
            )

            return stats

        except Exception as e:
            logger.error("mfa_migration_error", error=str(e))
            raise

    async def verify_encryption(
        self,
        user_id: UUID,
    ) -> dict:
        """
        Verify encryption for a specific user.

        Tests that MFA secret can be encrypted and decrypted successfully.

        Args:
            user_id: User ID to verify

        Returns:
            Verification results
        """
        result = {"user_id": str(user_id), "status": "unknown", "details": {}}

        try:
            # Fetch user
            query = select(User).where(User.id == user_id)
            db_result = await self.db.execute(query)
            user = db_result.scalar_one_or_none()

            if not user:
                result["status"] = "error"
                result["details"]["error"] = "User not found"
                return result

            # Check MFA status
            result["details"]["mfa_enabled"] = user.mfa_enabled
            result["details"]["has_encrypted_secret"] = bool(
                user.mfa_secret_encrypted and user.mfa_secret_dek
            )
            result["details"]["has_plaintext_secret"] = bool(user.mfa_secret)

            # Try to decrypt if encrypted
            if user.mfa_secret_encrypted and user.mfa_secret_dek:
                try:
                    decrypted = user.get_mfa_secret()
                    result["status"] = "success"
                    result["details"]["can_decrypt"] = True
                    result["details"]["secret_length"] = len(decrypted) if decrypted else 0
                except Exception as e:
                    result["status"] = "error"
                    result["details"]["can_decrypt"] = False
                    result["details"]["error"] = str(e)
            else:
                result["status"] = "not_encrypted"

            return result

        except Exception as e:
            result["status"] = "error"
            result["details"]["error"] = str(e)
            return result

    async def cleanup_plaintext_secrets(self) -> dict:
        """
        Clean up plaintext MFA secrets after migration.

        This should only be run after verifying all secrets
        have been successfully encrypted.

        WARNING: This is destructive and cannot be undone!

        Returns:
            Cleanup statistics
        """
        stats = {
            "total_cleaned": 0,
            "start_time": datetime.utcnow(),
        }

        try:
            # Update all users with encrypted secrets to clear plaintext
            query = (
                update(User)
                .where(
                    User.mfa_secret_encrypted.isnot(None),
                    User.mfa_secret.isnot(None),
                )
                .values(mfa_secret=None)
            )

            result = await self.db.execute(query)
            stats["total_cleaned"] = result.rowcount

            await self.db.commit()

            stats["end_time"] = datetime.utcnow()

            logger.warning(
                "plaintext_secrets_cleaned",
                **stats,
            )

            return stats

        except Exception as e:
            logger.error("cleanup_error", error=str(e))
            await self.db.rollback()
            raise
