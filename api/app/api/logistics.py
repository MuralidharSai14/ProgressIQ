"""
PROGRESSIQ - Material Logistics API
Tracks material shipments and inventory levels for a project.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.connection import get_db
from app.utils.auth_deps import get_project_or_404
from app.models.models import MaterialShipment, Project, ScheduleActivity
from app.schemas.schemas import (
    MaterialShipmentCreate,
    MaterialShipmentUpdate,
    MaterialShipmentOut,
    SuccessResponse,
)

router = APIRouter()


@router.get("/projects/{project_id}/materials", response_model=dict)
async def list_materials(
    project_id: int,
    status: str | None = None,
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List all material shipments for a project with summary stats."""
    project = await get_project_or_404(project_id, db)

    query = select(MaterialShipment).where(MaterialShipment.project_id == project_id)
    if status:
        query = query.where(MaterialShipment.status == status)
    if category:
        query = query.where(MaterialShipment.category == category)
    query = query.order_by(MaterialShipment.created_at.desc())
    rows = (await db.execute(query)).scalars().all()

    all_rows = (await db.execute(
        select(MaterialShipment).where(MaterialShipment.project_id == project_id)
    )).scalars().all()

    status_counts: dict = {}
    for s in all_rows:
        status_counts[s.status] = status_counts.get(s.status, 0) + 1

    total_required = sum(s.required_quantity for s in all_rows)
    total_delivered = sum(s.delivered_quantity for s in all_rows)
    delivery_pct = round((total_delivered / total_required * 100), 1) if total_required > 0 else 0.0

    return {
        "project_id": project_id,
        "total": len(all_rows),
        "filtered": len(rows),
        "status_counts": status_counts,
        "total_required": total_required,
        "total_delivered": total_delivered,
        "overall_delivery_pct": delivery_pct,
        "shipments": [MaterialShipmentOut.model_validate(r).model_dump() for r in rows],
    }


@router.post("/projects/{project_id}/materials", response_model=dict, status_code=201)
async def create_material(
    project_id: int,
    data: MaterialShipmentCreate,
    db: AsyncSession = Depends(get_db),
):
    """Add a new material shipment record."""
    project = await get_project_or_404(project_id, db)

    if data.activity_id:
        act = await db.execute(
            select(ScheduleActivity).where(ScheduleActivity.id == data.activity_id)
        )
        if not act.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Activity not found")

    shipment = MaterialShipment(project_id=project_id, **data.model_dump())
    db.add(shipment)
    await db.commit()
    await db.refresh(shipment)

    return {
        "success": True,
        "message": f"Material '{shipment.material_name}' added successfully",
        "shipment": MaterialShipmentOut.model_validate(shipment).model_dump(),
    }


@router.patch("/materials/{shipment_id}", response_model=dict)
async def update_material(
    shipment_id: int,
    data: MaterialShipmentUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a material shipment (e.g. delivered quantity, status)."""
    result = await db.execute(
        select(MaterialShipment).where(MaterialShipment.id == shipment_id)
    )
    shipment = result.scalar_one_or_none()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(shipment, field, value)

    await db.commit()
    await db.refresh(shipment)

    return {
        "success": True,
        "message": "Shipment updated",
        "shipment": MaterialShipmentOut.model_validate(shipment).model_dump(),
    }


@router.delete("/materials/{shipment_id}", response_model=SuccessResponse)
async def delete_material(shipment_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a material shipment record."""
    result = await db.execute(
        select(MaterialShipment).where(MaterialShipment.id == shipment_id)
    )
    shipment = result.scalar_one_or_none()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    await db.delete(shipment)
    await db.commit()
    return SuccessResponse(message="Material shipment deleted")


@router.get("/projects/{project_id}/materials/shortages", response_model=dict)
async def get_material_shortages(project_id: int, db: AsyncSession = Depends(get_db)):
    """Detect materials in shortage or critical delay that could block activities."""
    project = await get_project_or_404(project_id, db)

    rows = (await db.execute(
        select(MaterialShipment).where(
            MaterialShipment.project_id == project_id,
            MaterialShipment.status.in_(["shortage", "delayed", "cancelled"]),
        )
    )).scalars().all()

    conflicts = []
    for s in rows:
        shortage_pct = 0.0
        if s.required_quantity > 0:
            shortage_pct = round(
                max(0.0, (s.required_quantity - s.delivered_quantity) / s.required_quantity * 100), 1
            )
        conflicts.append({
            "shipment_id": s.id,
            "material_name": s.material_name,
            "category": s.category,
            "status": s.status,
            "priority": s.priority,
            "shortage_pct": shortage_pct,
            "activity_id": s.activity_id,
            "delay_reason": s.delay_reason,
            "expected_delivery": s.expected_delivery.isoformat() if s.expected_delivery else None,
        })

    return {
        "project_id": project_id,
        "conflict_count": len(conflicts),
        "conflicts": conflicts,
    }
