#!/usr/bin/env python3
"""
Encryption Management CLI.

Commands:
- migrate: Migrate plaintext MFA secrets to encrypted
- rotate: Rotate encryption keys
- verify: Verify encryption for specific user
- generate-key: Generate new encryption key
- cleanup: Remove plaintext secrets after migration
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import click
import structlog
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.services.key_rotation_service import KeyRotationService

logger = structlog.get_logger()


def get_async_session() -> AsyncSession:
    """Create async database session."""
    engine = create_async_engine(
        str(settings.DATABASE_URL),
        echo=False,
    )

    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    return async_session()


@click.group()
def cli():
    """Encryption management CLI."""
    pass


@cli.command()
@click.option(
    "--batch-size",
    default=100,
    help="Number of users to process per batch",
)
def migrate(batch_size: int):
    """
    Migrate plaintext MFA secrets to encrypted storage.

    This is a one-time migration that:
    1. Finds all users with plaintext MFA secrets
    2. Encrypts them using envelope encryption
    3. Stores encrypted data + DEK in database
    4. Keeps plaintext for rollback safety
    """
    click.echo("🔐 Starting MFA secret encryption migration...")
    click.echo(f"   Batch size: {batch_size}")
    click.echo()

    async def _migrate():
        async with get_async_session() as db:
            service = KeyRotationService(db)
            stats = await service.migrate_plaintext_to_encrypted(batch_size=batch_size)

            click.echo()
            click.echo("✅ Migration completed!")
            click.echo(f"   Total users: {stats['total_users']}")
            click.echo(f"   Migrated: {stats['migrated']}")
            click.echo(f"   Already encrypted: {stats['already_encrypted']}")
            click.echo(f"   Failed: {stats['failed']}")
            click.echo(f"   Duration: {stats['duration_seconds']:.2f}s")

            if stats["failed"] > 0:
                click.echo()
                click.echo("⚠️  Some migrations failed. Check logs for details.")
                sys.exit(1)

    asyncio.run(_migrate())


@cli.command()
@click.option(
    "--batch-size",
    default=100,
    help="Number of users to process per batch",
)
@click.confirmation_option(
    prompt="Are you sure you want to rotate encryption keys?"
)
def rotate(batch_size: int):
    """
    Rotate encryption keys for all MFA secrets.

    This re-encrypts all DEKs with a new KEK.
    Used during key rotation or after suspected key compromise.

    WARNING: This is a sensitive operation. Ensure you have backups!
    """
    click.echo("🔄 Starting encryption key rotation...")
    click.echo(f"   Batch size: {batch_size}")
    click.echo()

    async def _rotate():
        async with get_async_session() as db:
            service = KeyRotationService(db)
            stats = await service.rotate_all_mfa_secrets(batch_size=batch_size)

            click.echo()
            click.echo("✅ Key rotation completed!")
            click.echo(f"   Total users: {stats['total_users']}")
            click.echo(f"   Processed: {stats['processed']}")
            click.echo(f"   Skipped: {stats['skipped']}")
            click.echo(f"   Failed: {stats['failed']}")
            click.echo(f"   Duration: {stats['duration_seconds']:.2f}s")

            if stats["failed"] > 0:
                click.echo()
                click.echo("⚠️  Some rotations failed. Check logs for details.")
                sys.exit(1)

    asyncio.run(_rotate())


@cli.command()
@click.argument("user_id")
def verify(user_id: str):
    """
    Verify encryption for a specific user.

    Tests that MFA secret can be encrypted/decrypted successfully.

    USER_ID: UUID of user to verify
    """
    click.echo(f"🔍 Verifying encryption for user {user_id}...")
    click.echo()

    from uuid import UUID

    async def _verify():
        async with get_async_session() as db:
            service = KeyRotationService(db)
            result = await service.verify_encryption(UUID(user_id))

            click.echo(f"   Status: {result['status']}")
            click.echo(f"   MFA Enabled: {result['details'].get('mfa_enabled', False)}")
            click.echo(
                f"   Has Encrypted Secret: {result['details'].get('has_encrypted_secret', False)}"
            )
            click.echo(
                f"   Has Plaintext Secret: {result['details'].get('has_plaintext_secret', False)}"
            )

            if "can_decrypt" in result["details"]:
                click.echo(f"   Can Decrypt: {result['details']['can_decrypt']}")

            if "secret_length" in result["details"]:
                click.echo(f"   Secret Length: {result['details']['secret_length']}")

            if "error" in result["details"]:
                click.echo(f"   Error: {result['details']['error']}")
                sys.exit(1)

    asyncio.run(_verify())


@cli.command()
def generate_key():
    """
    Generate a new encryption key.

    Generates a cryptographically secure 32-byte key
    and displays it in hexadecimal format.

    Add this to your GitHub Secrets as ENCRYPTION_KEY.
    """
    import secrets

    key = secrets.token_hex(32)  # 32 bytes = 64 hex chars

    click.echo("🔑 Generated new encryption key:")
    click.echo()
    click.echo(f"   {key}")
    click.echo()
    click.echo("Add to GitHub Secrets:")
    click.echo(f"   gh secret set ENCRYPTION_KEY -b '{key}'")
    click.echo()
    click.echo("Or add to .env:")
    click.echo(f"   ENCRYPTION_KEY={key}")
    click.echo()
    click.echo("⚠️  Store this key securely! If lost, encrypted data is unrecoverable.")


@cli.command()
@click.confirmation_option(
    prompt="⚠️  This will permanently delete plaintext MFA secrets. Continue?"
)
def cleanup():
    """
    Clean up plaintext MFA secrets after migration.

    This removes the deprecated plaintext column values
    after verifying encrypted storage is working.

    WARNING: This cannot be undone! Ensure encryption is working first.
    """
    click.echo("🧹 Cleaning up plaintext MFA secrets...")
    click.echo()

    async def _cleanup():
        async with get_async_session() as db:
            service = KeyRotationService(db)
            stats = await service.cleanup_plaintext_secrets()

            click.echo()
            click.echo("✅ Cleanup completed!")
            click.echo(f"   Secrets cleaned: {stats['total_cleaned']}")

    asyncio.run(_cleanup())


@cli.command()
def check():
    """Check encryption configuration."""
    click.echo("🔍 Checking encryption configuration...")
    click.echo()

    # Check if encryption key is set
    if not settings.ENCRYPTION_KEY:
        click.echo("❌ ENCRYPTION_KEY not configured")
        click.echo("   Run: python scripts/manage_encryption.py generate-key")
        sys.exit(1)

    # Check key length
    if len(settings.ENCRYPTION_KEY) != 64:
        click.echo("❌ ENCRYPTION_KEY must be 64 hex characters (32 bytes)")
        click.echo(f"   Current length: {len(settings.ENCRYPTION_KEY)}")
        sys.exit(1)

    # Check if encryption is enabled
    if not settings.ENCRYPTION_ENABLED:
        click.echo("⚠️  ENCRYPTION_ENABLED is False")
        click.echo("   Set ENCRYPTION_ENABLED=true in environment")

    # Try to initialize encryption service
    try:
        from app.core.encryption import get_encryption_service

        service = get_encryption_service()
        click.echo("✅ Encryption service initialized successfully")
        click.echo(f"   Key version: {service.CURRENT_KEY_VERSION}")
        click.echo(f"   Algorithm: AES-256-GCM")
        click.echo(f"   KDF: Argon2id")

        # Test encryption/decryption
        test_data = "test_secret_12345"
        from app.core.encryption import EncryptionContext

        encrypted, dek = service.encrypt(
            test_data,
            context=EncryptionContext.MFA_SECRET,
        )
        decrypted = service.decrypt(encrypted, dek, context=EncryptionContext.MFA_SECRET)

        if decrypted == test_data:
            click.echo("✅ Encryption/decryption test passed")
        else:
            click.echo("❌ Encryption/decryption test failed")
            sys.exit(1)

    except Exception as e:
        click.echo(f"❌ Failed to initialize encryption service: {e}")
        sys.exit(1)

    click.echo()
    click.echo("✅ Encryption configuration is correct!")


if __name__ == "__main__":
    cli()
