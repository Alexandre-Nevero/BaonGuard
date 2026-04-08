import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend.stellar_client import StellarClient

logger = logging.getLogger(__name__)

# ── Pydantic models ────────────────────────────────────────────────────────────

class InitializeRequest(BaseModel):
    student_address: str = Field(..., description="Stellar G-address of the student wallet")
    token_address: str = Field(..., description="Stellar C-address of the USDC token contract")
    daily_limit: int = Field(..., gt=0, description="Max stroops the student can withdraw per 24h")


class WithdrawRequest(BaseModel):
    student_address: str = Field(..., description="Must match the address registered at initialization")
    amount: int = Field(..., gt=0, description="Amount in stroops to withdraw")


class VaultInfoResponse(BaseModel):
    student_address: str
    daily_limit: int
    last_withdrawal_timestamp: int
    current_balance: int


class ErrorResponse(BaseModel):
    error: str


# ── App setup ─────────────────────────────────────────────────────────────────

stellar_client: StellarClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global stellar_client
    stellar_client = StellarClient()
    logger.info("StellarClient initialized")
    yield
    stellar_client = None


app = FastAPI(title="BaonGuard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global exception handler ──────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(status_code=500, content={"error": str(exc)})


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/vault-info", response_model=VaultInfoResponse)
async def get_vault_info():
    """Return current vault state from the Soroban contract."""
    logger.info("GET /vault-info")
    try:
        result = await stellar_client.call_contract_view("get_vault_info", [])
        # result is a tuple: (student_address, daily_limit, last_withdrawal_timestamp, balance)
        return VaultInfoResponse(
            student_address=str(result[0]),
            daily_limit=int(result[1]),
            last_withdrawal_timestamp=int(result[2]),
            current_balance=int(result[3]),
        )
    except Exception as exc:
        logger.error("GET /vault-info failed: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/initialize")
async def initialize(body: InitializeRequest):
    """Initialize the vault with student address, token address, and daily limit."""
    logger.info("POST /initialize student=%s", body.student_address)
    try:
        tx_hash = await stellar_client.invoke_contract(
            "initialize",
            [body.student_address, body.token_address, body.daily_limit],
        )
        return {"tx_hash": tx_hash}
    except Exception as exc:
        logger.error("POST /initialize failed: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/withdraw")
async def withdraw(body: WithdrawRequest):
    """Withdraw stroops from the vault to the student wallet."""
    logger.info("POST /withdraw student=%s amount=%d", body.student_address, body.amount)
    try:
        tx_hash = await stellar_client.invoke_contract(
            "withdraw",
            [body.student_address, body.amount],
        )
        return {"tx_hash": tx_hash}
    except Exception as exc:
        logger.error("POST /withdraw failed: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))
