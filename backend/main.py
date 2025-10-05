from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Field, Session, create_engine, select, delete
from typing import Optional, List
from datetime import datetime, date, timedelta, timezone
from pydantic import BaseModel
import os

# ---- DB ----
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///app.db")
if DATABASE_URL.startswith("sqlite:///") and not DATABASE_URL.startswith("sqlite:////"):
    DATABASE_URL = "sqlite:////app/data/app.db"
engine = create_engine(DATABASE_URL, echo=False)

# ---- Models ----
class Child(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    weekly_allowance_cents: int = 0
    allowance_start_date: date = Field(default_factory=lambda: date.today())
    last_allowance_applied: Optional[date] = None

class Transaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    child_id: int = Field(foreign_key="child.id")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    cents: int
    kind: str   # 'allowance' | 'purchase' | 'adjustment' | 'initial'
    note: Optional[str] = None

# ---- App ----
app = FastAPI(title="Kids Allowance API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Helpers ----
def usd(cents: int) -> float:
    return round(cents / 100.0, 2)

def most_recent_sunday(on: date) -> date:
    return on - timedelta(days=(on.weekday() + 1) % 7)

def balance_cents(s: Session, child_id: int) -> int:
    return sum(t.cents for t in s.exec(select(Transaction).where(Transaction.child_id == child_id)))

def apply_due_allowances():
    today = date.today()
    today_sun = most_recent_sunday(today)
    with Session(engine) as s:
        for ch in s.exec(select(Child)).all():
            if ch.weekly_allowance_cents <= 0:
                continue
            start = ch.allowance_start_date
            first_sun = start + timedelta(days=(6 - start.weekday()) % 7)
            last_applied = ch.last_allowance_applied
            from_sun = first_sun if last_applied is None else last_applied + timedelta(days=7)
            cur = from_sun
            updated = False
            while cur <= today_sun:
                if cur >= first_sun:
                    s.add(Transaction(
                        child_id=ch.id,
                        cents=ch.weekly_allowance_cents,
                        kind="allowance",
                        note=f"Weekly allowance {cur.isoformat()}",
                    ))
                    ch.last_allowance_applied = cur
                    updated = True
                cur += timedelta(days=7)
            if updated:
                s.add(ch)
        s.commit()

# ---- Schemas ----
class ChildCreate(BaseModel):
    name: str
    weekly_allowance: float = 0.0
    starting_balance: float = 0.0
    allowance_start_date: Optional[date] = None

class ChildOut(BaseModel):
    id: int
    name: str
    weekly_allowance: float
    balance: float
    last_allowance_applied: Optional[date]

class MoneyIn(BaseModel):
    child_id: int
    amount: float
    note: Optional[str] = None

# ---- Startup ----
@app.on_event("startup")
def startup_event():
    SQLModel.metadata.create_all(engine)
    apply_due_allowances()

# ---- Routes ----
@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/children", response_model=List[ChildOut])
def list_children():
    apply_due_allowances()
    with Session(engine) as s:
        out = []
        for ch in s.exec(select(Child)).all():
            bal = balance_cents(s, ch.id)
            out.append(ChildOut(
                id=ch.id,
                name=ch.name,
                weekly_allowance=usd(ch.weekly_allowance_cents),
                balance=usd(bal),
                last_allowance_applied=ch.last_allowance_applied
            ))
        return out

@app.post("/api/children", response_model=ChildOut, status_code=201)
def add_child(payload: ChildCreate):
    with Session(engine) as s:
        ch = Child(
            name=payload.name,
            weekly_allowance_cents=int(round(payload.weekly_allowance * 100)),
            allowance_start_date=payload.allowance_start_date or date.today()
        )
        s.add(ch)
        s.commit()
        s.refresh(ch)
        if payload.starting_balance > 0:
            s.add(Transaction(
                child_id=ch.id,
                cents=int(round(payload.starting_balance * 100)),
                kind="initial",
                note="Starting balance",
            ))
            s.commit()
        bal = balance_cents(s, ch.id)
        return ChildOut(
            id=ch.id,
            name=ch.name,
            weekly_allowance=usd(ch.weekly_allowance_cents),
            balance=usd(bal),
            last_allowance_applied=ch.last_allowance_applied
        )

@app.post("/api/purchase", status_code=201)
def purchase(p: MoneyIn):
    with Session(engine) as s:
        ch = s.get(Child, p.child_id)
        if not ch:
            raise HTTPException(status_code=404, detail="Child not found")
        cents = int(round(p.amount * 100))
        if cents <= 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")
        s.add(Transaction(child_id=ch.id, cents=-cents, kind="purchase", note=p.note))
        s.commit()
        return {"ok": True}

@app.post("/api/adjust", status_code=201)
def adjust_balance(p: MoneyIn):
    with Session(engine) as s:
        ch = s.get(Child, p.child_id)
        if not ch:
            raise HTTPException(status_code=404, detail="Child not found")
        cents = int(round(p.amount * 100))
        if cents == 0:
            raise HTTPException(status_code=400, detail="Amount cannot be zero")
        s.add(Transaction(child_id=ch.id, cents=cents, kind="adjustment", note=p.note or "Manual adjustment"))
        s.commit()
        return {"ok": True}

@app.post("/api/allowance/run")
def run_allowance():
    apply_due_allowances()
    return {"ok": True}

@app.get("/api/children/{child_id}/history")
def history(child_id: int):
    with Session(engine) as s:
        ch = s.get(Child, child_id)
        if not ch:
            raise HTTPException(status_code=404, detail="Child not found")
        tx = s.exec(
            select(Transaction)
            .where(Transaction.child_id == child_id)
            .order_by(Transaction.timestamp.desc())
        ).all()
        return [
            {
                "id": t.id,
                "timestamp": t.timestamp.isoformat(),
                "amount": round(t.cents / 100, 2),
                "kind": t.kind,
                "note": t.note,
            }
            for t in tx
        ]

@app.delete("/api/children/{child_id}")
def delete_child(child_id: int):
    with Session(engine) as s:
        ch = s.get(Child, child_id)
        if not ch:
            raise HTTPException(status_code=404, detail="Child not found")
        s.exec(delete(Transaction).where(Transaction.child_id == child_id))
        s.delete(ch)
        s.commit()
        return {"ok": True}
