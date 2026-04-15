import os
from typing import Optional

from fastapi import Header

CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL", "")

_jwks_client = None


def _get_jwks_client():
    global _jwks_client
    if _jwks_client is None and CLERK_JWKS_URL:
        from jwt import PyJWKClient  # PyJWT >= 2.4
        _jwks_client = PyJWKClient(CLERK_JWKS_URL, cache_jwk_set=True, lifespan=300)
    return _jwks_client


async def optional_user(authorization: str = Header(default=None)) -> Optional[dict]:
    """
    Returns the decoded JWT payload when a valid Clerk Bearer token is present.
    Returns None for guests (no token or CLERK_JWKS_URL not configured).
    Never raises — all auth failures silently become guest mode.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    client = _get_jwks_client()
    if client is None:
        return None
    try:
        import jwt as pyjwt

        signing_key = client.get_signing_key_from_jwt(token)
        payload = pyjwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        return payload
    except Exception:
        return None
