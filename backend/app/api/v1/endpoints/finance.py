"""
Finance domain endpoints.
Handles financial accounts, transactions, and budgets.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession, TenantID
from app.core.logging import logger
from app.models.finance import Budget, FinancialAccount, Transaction
from app.schemas.finance import (
    BudgetCreate,
    BudgetResponse,
    BudgetUpdate,
    FinancialAccountCreate,
    FinancialAccountResponse,
    FinancialAccountUpdate,
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
    TransactionBulkCreate,
    TransactionBulkResponse,
)

router = APIRouter()


# ============================================================================
# FinancialAccount Endpoints
# ============================================================================


@router.get("/accounts", response_model=list[FinancialAccountResponse])
async def list_financial_accounts(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
):
    """
    List all financial accounts for the current user.

    Supports pagination via skip and limit parameters.
    """
    result = await db.execute(
        select(FinancialAccount)
        .where(FinancialAccount.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .order_by(FinancialAccount.created_at.desc())
    )
    accounts = result.scalars().all()

    logger.info(
        "List financial accounts",
        user_id=str(current_user.id),
        count=len(accounts),
    )

    return [FinancialAccountResponse.model_validate(acc) for acc in accounts]


@router.get("/accounts/{account_id}", response_model=FinancialAccountResponse)
async def get_financial_account(
    account_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Get a specific financial account by ID.

    Returns 404 if account not found or user doesn't have access.
    """
    result = await db.execute(select(FinancialAccount).where(FinancialAccount.id == account_id))
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial account not found",
        )

    # Authorization check: ensure user owns this account
    if account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this account",
        )

    logger.info("Get financial account", account_id=str(account_id))
    return FinancialAccountResponse.model_validate(account)


@router.post(
    "/accounts", response_model=FinancialAccountResponse, status_code=status.HTTP_201_CREATED
)
async def create_financial_account(
    data: FinancialAccountCreate,
    db: DBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Create a new financial account.

    Associates the account with the current user and tenant.
    """
    account = FinancialAccount(
        **data.model_dump(),
        user_id=current_user.id,
        tenant_id=tenant_id,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)

    logger.info("Financial account created", account_id=str(account.id))
    return FinancialAccountResponse.model_validate(account)


@router.patch("/accounts/{account_id}", response_model=FinancialAccountResponse)
async def update_financial_account(
    account_id: UUID,
    data: FinancialAccountUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Update a financial account.

    Only updates fields provided in the request body.
    """
    result = await db.execute(select(FinancialAccount).where(FinancialAccount.id == account_id))
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial account not found",
        )

    # Authorization check: ensure user owns this account
    if account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this account",
        )

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(account, key, value)

    await db.commit()
    await db.refresh(account)

    logger.info("Financial account updated", account_id=str(account_id))
    return FinancialAccountResponse.model_validate(account)


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_financial_account(
    account_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Delete a financial account.

    Soft deletes the account by setting deleted_at timestamp.
    """
    result = await db.execute(select(FinancialAccount).where(FinancialAccount.id == account_id))
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial account not found",
        )

    # Authorization check: ensure user owns this account
    if account.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this account",
        )

    await db.delete(account)
    await db.commit()

    logger.info("Financial account deleted", account_id=str(account_id))
    return None


# ============================================================================
# Transaction Endpoints
# ============================================================================


@router.get("/transactions", response_model=list[TransactionResponse])
async def list_transactions(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    account_id: UUID | None = None,
):
    """
    List all transactions for the current user.

    Optionally filter by account_id.
    Supports pagination via skip and limit parameters.
    """
    query = select(Transaction).where(Transaction.user_id == current_user.id)

    if account_id:
        query = query.where(Transaction.account_id == account_id)

    query = query.offset(skip).limit(limit).order_by(Transaction.transaction_date.desc())

    result = await db.execute(query)
    transactions = result.scalars().all()

    logger.info(
        "List transactions",
        user_id=str(current_user.id),
        count=len(transactions),
        account_id=str(account_id) if account_id else None,
    )

    return [TransactionResponse.model_validate(txn) for txn in transactions]


@router.get("/transactions/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Get a specific transaction by ID.

    Returns 404 if transaction not found or user doesn't have access.
    """
    result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )

    # Authorization check: ensure user owns this transaction
    if transaction.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this transaction",
        )

    logger.info("Get transaction", transaction_id=str(transaction_id))
    return TransactionResponse.model_validate(transaction)


@router.post(
    "/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED
)
async def create_transaction(
    data: TransactionCreate,
    db: DBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Create a new transaction.

    Associates the transaction with the current user and tenant.
    """
    transaction = Transaction(
        **data.model_dump(),
        user_id=current_user.id,
        tenant_id=tenant_id,
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)

    logger.info("Transaction created", transaction_id=str(transaction.id))
    return TransactionResponse.model_validate(transaction)


@router.patch("/transactions/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: UUID,
    data: TransactionUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Update a transaction.

    Only updates fields provided in the request body.
    """
    result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )

    # Authorization check: ensure user owns this transaction
    if transaction.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this transaction",
        )

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(transaction, key, value)

    await db.commit()
    await db.refresh(transaction)

    logger.info("Transaction updated", transaction_id=str(transaction_id))
    return TransactionResponse.model_validate(transaction)


@router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Delete a transaction.

    Soft deletes the transaction by setting deleted_at timestamp.
    """
    result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )

    # Authorization check: ensure user owns this transaction
    if transaction.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this transaction",
        )

    await db.delete(transaction)
    await db.commit()

    logger.info("Transaction deleted", transaction_id=str(transaction_id))
    return None


@router.post("/transactions/bulk", response_model=TransactionBulkResponse)
async def create_transactions_bulk(
    data: TransactionBulkCreate,
    db: DBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Bulk create transactions from OCR extraction.

    Used by the OCR pipeline to save extracted transactions.
    Creates transactions in a single database operation for efficiency.
    """
    from datetime import datetime as dt
    from app.models.finance import TransactionType as TxType

    created_ids: list[UUID] = []
    errors: list[str] = []
    skipped = 0

    # Get default account if not specified
    default_account_id = data.account_id
    if not default_account_id:
        # Try to get user's first account
        result = await db.execute(
            select(FinancialAccount)
            .where(FinancialAccount.user_id == current_user.id)
            .order_by(FinancialAccount.created_at)
            .limit(1)
        )
        default_account = result.scalar_one_or_none()

        if not default_account:
            # Create a default "OCR Imports" account
            default_account = FinancialAccount(
                user_id=current_user.id,
                tenant_id=tenant_id,
                account_name="OCR Imports",
                account_type="CHECKING",
                is_manual=True,
                currency="USD",
            )
            db.add(default_account)
            await db.flush()

        default_account_id = default_account.id

    for i, tx_item in enumerate(data.transactions):
        try:
            # Parse date if string
            tx_date = tx_item.transaction_date
            if isinstance(tx_date, str):
                try:
                    tx_date = dt.strptime(tx_date, "%Y-%m-%d").date()
                except ValueError:
                    tx_date = dt.now().date()

            # Map transaction type string to enum
            tx_type = TxType.DEBIT
            if tx_item.transaction_type.lower() in ("credit", "cr"):
                tx_type = TxType.CREDIT

            transaction = Transaction(
                user_id=current_user.id,
                tenant_id=tenant_id,
                account_id=default_account_id,
                transaction_date=tx_date,
                amount=tx_item.amount,
                description=tx_item.description,
                category=tx_item.category,
                transaction_type=tx_type,
                is_recurring=False,
                is_pending=False,
                metadata_=tx_item.metadata_ or {"source": "ocr"},
            )
            db.add(transaction)
            await db.flush()
            created_ids.append(transaction.id)

        except Exception as e:
            errors.append(f"Transaction {i + 1}: {str(e)}")
            skipped += 1

    await db.commit()

    logger.info(
        "Bulk transactions created",
        user_id=str(current_user.id),
        created_count=len(created_ids),
        skipped_count=skipped,
        error_count=len(errors),
    )

    return TransactionBulkResponse(
        created_count=len(created_ids),
        skipped_count=skipped,
        errors=errors,
        transaction_ids=created_ids,
    )


# ============================================================================
# Budget Endpoints
# ============================================================================


@router.get("/budgets", response_model=list[BudgetResponse])
async def list_budgets(
    db: DBSession,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
):
    """
    List all budgets for the current user.

    Supports pagination via skip and limit parameters.
    """
    result = await db.execute(
        select(Budget)
        .where(Budget.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .order_by(Budget.created_at.desc())
    )
    budgets = result.scalars().all()

    logger.info(
        "List budgets",
        user_id=str(current_user.id),
        count=len(budgets),
    )

    return [BudgetResponse.model_validate(budget) for budget in budgets]


@router.get("/budgets/{budget_id}", response_model=BudgetResponse)
async def get_budget(
    budget_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Get a specific budget by ID.

    Returns 404 if budget not found or user doesn't have access.
    """
    result = await db.execute(select(Budget).where(Budget.id == budget_id))
    budget = result.scalar_one_or_none()

    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found",
        )

    # Authorization check: ensure user owns this budget
    if budget.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this budget",
        )

    logger.info("Get budget", budget_id=str(budget_id))
    return BudgetResponse.model_validate(budget)


@router.post("/budgets", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(
    data: BudgetCreate,
    db: DBSession,
    current_user: CurrentUser,
    tenant_id: TenantID,
):
    """
    Create a new budget.

    Associates the budget with the current user and tenant.
    """
    budget = Budget(
        **data.model_dump(),
        user_id=current_user.id,
        tenant_id=tenant_id,
    )
    db.add(budget)
    await db.commit()
    await db.refresh(budget)

    logger.info("Budget created", budget_id=str(budget.id))
    return BudgetResponse.model_validate(budget)


@router.patch("/budgets/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: UUID,
    data: BudgetUpdate,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Update a budget.

    Only updates fields provided in the request body.
    """
    result = await db.execute(select(Budget).where(Budget.id == budget_id))
    budget = result.scalar_one_or_none()

    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found",
        )

    # Authorization check: ensure user owns this budget
    if budget.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this budget",
        )

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(budget, key, value)

    await db.commit()
    await db.refresh(budget)

    logger.info("Budget updated", budget_id=str(budget_id))
    return BudgetResponse.model_validate(budget)


@router.delete("/budgets/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Delete a budget.

    Soft deletes the budget by setting deleted_at timestamp.
    """
    result = await db.execute(select(Budget).where(Budget.id == budget_id))
    budget = result.scalar_one_or_none()

    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found",
        )

    # Authorization check: ensure user owns this budget
    if budget.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this budget",
        )

    await db.delete(budget)
    await db.commit()

    logger.info("Budget deleted", budget_id=str(budget_id))
    return None
