"""
Document Upload and Parsing API Endpoints
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import io

from app.core.database import get_db
from app.core.auth import get_current_user
from app.services.document_parser import DocumentParserService, ParsedTransaction
from app.services.financial_profile import FinancialProfileService
from app.models.financial_profile import Transaction, FinancialAccount

router = APIRouter()

@router.post("/upload/tax-return")
async def upload_tax_return(
    file: UploadFile = File(...),
    tax_year: Optional[int] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload and parse tax return (PDF or image)
    """
    # Validate file type
    if not file.filename.lower().endswith(('.pdf', '.png', '.jpg', '.jpeg')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be PDF or image format"
        )
    
    # Read file content
    content = await file.read()
    
    # Parse document
    parser = DocumentParserService()
    file_type = 'pdf' if file.filename.lower().endswith('.pdf') else 'image'
    
    try:
        parsed_return = await parser.parse_tax_return(content, file_type)
        
        # Override year if provided
        if tax_year:
            parsed_return.tax_year = tax_year
        
        # Update user's financial profile with tax data
        profile_service = FinancialProfileService(db)
        profile = await profile_service.get_by_user_id(current_user["id"])
        
        if profile and parsed_return.wages > 0:
            # Update income information
            profile.annual_income = parsed_return.wages
            await db.commit()
        
        return {
            "message": "Tax return parsed successfully",
            "data": {
                "tax_year": parsed_return.tax_year,
                "filing_status": parsed_return.filing_status,
                "agi": parsed_return.agi,
                "taxable_income": parsed_return.taxable_income,
                "total_tax": parsed_return.total_tax,
                "refund_or_owed": parsed_return.refund_or_owed,
                "wages": parsed_return.wages,
                "deductions": {
                    "type": parsed_return.standard_or_itemized,
                    "total": parsed_return.total_deductions,
                    "mortgage_interest": parsed_return.mortgage_interest,
                    "charitable": parsed_return.charitable_donations,
                    "salt": parsed_return.state_local_taxes
                }
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Error parsing tax return: {str(e)}"
        )

@router.post("/upload/bank-statement")
async def upload_bank_statement(
    file: UploadFile = File(...),
    account_name: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload and parse bank statement (PDF)
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be PDF format"
        )
    
    content = await file.read()
    parser = DocumentParserService()
    
    try:
        account, transactions = await parser.parse_bank_statement(content, 'pdf')
        
        # Get user's profile
        profile_service = FinancialProfileService(db)
        profile = await profile_service.get_by_user_id(current_user["id"])
        
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Financial profile not found. Please create a profile first."
            )
        
        # Create or update account
        existing_account = None
        if account.account_number:
            result = await db.execute(
                select(FinancialAccount).where(
                    FinancialAccount.profile_id == profile.id,
                    FinancialAccount.account_number_masked == account.account_number
                )
            )
            existing_account = result.scalar_one_or_none()
        
        if existing_account:
            # Update balance
            existing_account.current_balance = account.balance
            existing_account.last_sync = account.as_of_date
            db_account = existing_account
        else:
            # Create new account
            db_account = FinancialAccount(
                profile_id=profile.id,
                account_name=account_name or f"{account.institution} Account",
                account_type=account.account_type,
                institution=account.institution,
                account_number_masked=account.account_number,
                current_balance=account.balance,
                last_sync=account.as_of_date
            )
            db.add(db_account)
            await db.flush()
        
        # Add transactions
        added_count = 0
        for trans in transactions:
            # Check if transaction already exists (avoid duplicates)
            existing = await db.execute(
                select(Transaction).where(
                    Transaction.account_id == db_account.id,
                    Transaction.transaction_date == trans.date,
                    Transaction.amount == trans.amount,
                    Transaction.description == trans.description
                )
            )
            if not existing.scalar_one_or_none():
                db_trans = Transaction(
                    profile_id=profile.id,
                    account_id=db_account.id,
                    transaction_date=trans.date,
                    amount=trans.amount,
                    description=trans.description,
                    category=trans.category,
                    transaction_type=trans.transaction_type,
                    merchant_name=trans.merchant
                )
                db.add(db_trans)
                added_count += 1
        
        await db.commit()
        
        return {
            "message": "Bank statement parsed successfully",
            "account": {
                "name": db_account.account_name,
                "number": account.account_number,
                "balance": account.balance,
                "institution": account.institution
            },
            "transactions": {
                "total_found": len(transactions),
                "new_added": added_count,
                "categories": list(set(t.category for t in transactions if t.category))
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Error parsing bank statement: {str(e)}"
        )

@router.post("/upload/transactions-csv")
async def upload_transactions_csv(
    file: UploadFile = File(...),
    account_id: Optional[str] = Form(None),
    format_type: str = Form("auto"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload and parse CSV transaction file
    Format types: auto, chase, bofa, mint, generic
    """
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be CSV format"
        )
    
    content = await file.read()
    parser = DocumentParserService()
    
    try:
        transactions = await parser.parse_csv_transactions(content, format_type)
        
        # Get user's profile
        profile_service = FinancialProfileService(db)
        profile = await profile_service.get_by_user_id(current_user["id"])
        
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Financial profile not found"
            )
        
        # Get account if specified
        db_account = None
        if account_id:
            result = await db.execute(
                select(FinancialAccount).where(
                    FinancialAccount.id == account_id,
                    FinancialAccount.profile_id == profile.id
                )
            )
            db_account = result.scalar_one_or_none()
        
        # Add transactions
        added_count = 0
        categories_found = set()
        
        for trans in transactions:
            # Skip if duplicate
            existing = await db.execute(
                select(Transaction).where(
                    Transaction.profile_id == profile.id,
                    Transaction.transaction_date == trans.date,
                    Transaction.amount == trans.amount,
                    Transaction.description == trans.description
                )
            )
            
            if not existing.scalar_one_or_none():
                db_trans = Transaction(
                    profile_id=profile.id,
                    account_id=db_account.id if db_account else None,
                    transaction_date=trans.date,
                    amount=trans.amount,
                    description=trans.description,
                    category=trans.category,
                    transaction_type=trans.transaction_type,
                    merchant_name=trans.merchant
                )
                db.add(db_trans)
                added_count += 1
                
                if trans.category:
                    categories_found.add(trans.category)
        
        await db.commit()
        
        # Calculate spending summary
        spending_by_category = {}
        for trans in transactions:
            if trans.category and trans.transaction_type == 'debit':
                if trans.category not in spending_by_category:
                    spending_by_category[trans.category] = 0
                spending_by_category[trans.category] += trans.amount
        
        return {
            "message": "Transactions imported successfully",
            "summary": {
                "total_transactions": len(transactions),
                "new_added": added_count,
                "duplicates_skipped": len(transactions) - added_count,
                "categories_found": list(categories_found),
                "date_range": {
                    "start": min(t.date for t in transactions).isoformat() if transactions else None,
                    "end": max(t.date for t in transactions).isoformat() if transactions else None
                }
            },
            "spending_summary": spending_by_category
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Error parsing CSV: {str(e)}"
        )

@router.post("/upload/investment-statement")
async def upload_investment_statement(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload and parse investment/brokerage statement
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be PDF format"
        )
    
    content = await file.read()
    parser = DocumentParserService()
    
    try:
        investment_data = await parser.parse_investment_statement(content)
        
        # Update user's profile with investment data
        profile_service = FinancialProfileService(db)
        profile = await profile_service.get_by_user_id(current_user["id"])
        
        if profile:
            # Update invested assets
            profile.invested_assets = investment_data.get('account_value', 0)
            await db.commit()
        
        return {
            "message": "Investment statement parsed successfully",
            "data": investment_data
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Error parsing investment statement: {str(e)}"
        )

@router.get("/supported-formats")
async def get_supported_formats():
    """
    Get list of supported document formats and CSV types
    """
    return {
        "document_formats": {
            "tax_returns": [".pdf", ".png", ".jpg", ".jpeg"],
            "bank_statements": [".pdf"],
            "investment_statements": [".pdf"],
            "transaction_files": [".csv"],
            "financial_documents": [".docx", ".pdf"]
        },
        "csv_formats": {
            "auto": "Auto-detect format",
            "chase": "Chase Bank",
            "bofa": "Bank of America",
            "wells_fargo": "Wells Fargo",
            "mint": "Mint.com export",
            "quicken": "Quicken export",
            "generic": "Generic CSV (Date, Description, Amount)"
        },
        "tips": [
            "PDF tax returns work best with official IRS forms",
            "Bank statements should include transaction details",
            "CSV files should have headers",
            "Remove sensitive info like full SSN before uploading"
        ]
    }