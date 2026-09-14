"""
PROGRESSIQ — Authentication API Endpoints
Registration, Login, Current User profile, User Listing, and Seed Test Accounts.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.database.connection import get_db
from app.models.models import User, UserRole
from app.schemas.schemas import UserRegister, UserLogin, UserOut, TokenResponse
from app.utils.security import hash_password, verify_password, create_access_token
from app.utils.auth_deps import get_current_user, require_roles

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

# Pre-configured test accounts for instant multi-device testing
DEFAULT_TEST_USERS = [
    {
        "email": "admin@progressiq.ai",
        "password": "admin123",
        "full_name": "Executive Administrator",
        "role": UserRole.ADMIN.value,
        "organization": "National Infrastructure Board",
    },
    {
        "email": "pm@progressiq.ai",
        "password": "pm123",
        "full_name": "Rajesh Sharma",
        "role": UserRole.PROJECT_MANAGER.value,
        "organization": "Indravati River Bridge JV",
    },
    {
        "email": "engineer@progressiq.ai",
        "password": "engineer123",
        "full_name": "Amit Kumar",
        "role": UserRole.SITE_ENGINEER.value,
        "organization": "Indravati River Bridge JV",
    },
    {
        "email": "site@progressiq.ai",
        "password": "site123",
        "full_name": "Suresh Babu",
        "role": UserRole.SITE_ENGINEER.value,
        "organization": "Indravati River Bridge JV",
    },
    {
        "email": "owner@progressiq.ai",
        "password": "owner123",
        "full_name": "Vikram Nair",
        "role": UserRole.PROJECT_MANAGER.value,
        "organization": "Ministry of Transport",
    },
    {
        "email": "auditor@progressiq.ai",
        "password": "audit123",
        "full_name": "Priya Patel",
        "role": UserRole.VIEWER.value,
        "organization": "Quality Assurance Board",
    },
    {
        "email": "viewer@progressiq.ai",
        "password": "viewer123",
        "full_name": "Deepa Reddy",
        "role": UserRole.VIEWER.value,
        "organization": "Ministry of Transport",
    },
]


async def seed_default_users(db: AsyncSession) -> int:
    """Creates default test users if they do not already exist in the database."""
    created_count = 0
    for udata in DEFAULT_TEST_USERS:
        res = await db.execute(select(User).where(User.email == udata["email"]))
        existing = res.scalar_one_or_none()
        if not existing:
            user = User(
                email=udata["email"],
                hashed_password=hash_password(udata["password"]),
                full_name=udata["full_name"],
                role=udata["role"],
                organization=udata.get("organization"),
                is_active=True,
            )
            db.add(user)
            created_count += 1
    if created_count > 0:
        await db.commit()
        logger.info(f"✅ Seeded {created_count} default test user accounts")
    return created_count


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_user(data: UserRegister, db: AsyncSession = Depends(get_db)):
    """Register a new user account and return JWT token."""
    email_clean = data.email.strip().lower()
    
    # Check if email exists
    res = await db.execute(select(User).where(User.email == email_clean))
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    # Validate role
    role_val = data.role.lower() if data.role else UserRole.SITE_ENGINEER.value
    valid_roles = [r.value for r in UserRole]
    if role_val not in valid_roles:
        role_val = UserRole.SITE_ENGINEER.value

    user = User(
        email=email_clean,
        hashed_password=hash_password(data.password),
        full_name=data.full_name.strip(),
        role=role_val,
        organization=data.organization.strip() if data.organization else None,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Create JWT
    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})
    return TokenResponse(access_token=token, token_type="bearer", user=user)


@router.post("/login", response_model=TokenResponse)
async def login_user(data: UserLogin, db: AsyncSession = Depends(get_db)):
    """Log in with email and password to receive JWT token."""
    # Always ensure seed users & demo projects exist (handles Vercel /tmp resets on cold start)
    await seed_default_users(db)
    try:
        from app.services.demo_loader import ensure_all_demo_projects_seeded
        await ensure_all_demo_projects_seeded(db)
    except Exception as e:
        logger.warning(f"Demo project auto-seed notice: {e}")

    email_clean = data.email.strip().lower()
    res = await db.execute(select(User).where(User.email == email_clean))
    user = res.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Please contact your administrator.",
        )

    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})
    return TokenResponse(access_token=token, token_type="bearer", user=user)


@router.get("/me", response_model=UserOut)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    """Get the profile of the currently logged-in user."""
    return current_user


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all registered users (for team management)."""
    res = await db.execute(select(User).order_by(User.created_at.desc()))
    return res.scalars().all()


@router.post("/seed-test-users")
async def seed_test_users_endpoint(db: AsyncSession = Depends(get_db)):
    """Manually seed or re-seed the test accounts."""
    count = await seed_default_users(db)
    return {
        "success": True,
        "message": f"Test accounts verified/created: {count} new accounts added.",
        "accounts": [
            {"email": u["email"], "password": u["password"], "role": u["role"], "name": u["full_name"]}
            for u in DEFAULT_TEST_USERS
        ],
    }
